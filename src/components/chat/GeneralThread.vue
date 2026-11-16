<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { ArrowUp, Bot, Check, Copy, Cpu, Download, RefreshCw, Square } from "lucide-vue-next";
import { engineError, engineProgress, engineStatus, loadedModel, supportsWebGPU } from "@/chat/engine";
import { gcActive, gcBusy, gcEnsureModel, gcRegenerate, gcSend, gcSettings, gcStop } from "@/chat/general";
import { copyText } from "@/composables/useClipboard";

/**
 * The General Chat conversation view, used full size on the tool page and `compact` in the chatbox.
 */
const props = defineProps<{ compact?: boolean }>();
const emit = defineEmits<{ manage: [] }>();

const input = ref("");
const listEl = ref<HTMLElement>();
const inputEl = ref<HTMLTextAreaElement>();
const copied = ref("");

const messages = computed(() => gcActive.value?.messages ?? []);
const modelReady = computed(() => loadedModel.value === gcSettings.value.modelId && (engineStatus.value === "ready" || engineStatus.value === "generating"));
const downloading = computed(() => engineStatus.value === "downloading");
const progress = computed(() => Math.round(engineProgress.value.progress * 100));
const shortName = (id: string) => id.replace(/-MLC.*$/, "").replace(/-q\d\w*$/, "");

onMounted(async () => {
    if (!(await supportsWebGPU())) engineStatus.value = "unsupported";
});

function render(md: string) {
    return DOMPurify.sanitize(marked.parse(md, { gfm: true, breaks: true, async: false }) as string);
}

async function scrollDown() {
    await nextTick();
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight;
}
watch(() => [messages.value.length, messages.value.at(-1)?.content.length], scrollDown);
onMounted(scrollDown);

function autosize() {
    const el = inputEl.value;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, props.compact ? 120 : 200)}px`;
}

async function send() {
    const text = input.value;
    if (!text.trim() || gcBusy.value || downloading.value) return;
    input.value = "";
    await nextTick();
    autosize();
    await gcSend(text);
}

async function copy(id: string, text: string) {
    if (await copyText(text)) {
        copied.value = id;
        setTimeout(() => (copied.value = ""), 1200);
    }
}

function loadModel() {
    void gcEnsureModel().catch(() => {});
}
</script>

<template>
    <div class="flex min-h-0 flex-1 flex-col">
        <!-- Model status -->
        <div class="flex items-center gap-2 border-b border-line px-4 py-2 text-xs" :class="compact ? '' : 'sm:px-5'">
            <Cpu class="size-3.5 shrink-0 text-fg-subtle" />
            <span class="min-w-0 flex-1 truncate font-mono text-fg-muted" :title="gcSettings.modelId">{{ shortName(gcSettings.modelId) }}</span>
            <span v-if="modelReady" class="chip !py-0 text-accent">Loaded</span>
            <button type="button" class="shrink-0 cursor-pointer font-medium text-fg-subtle underline-offset-2 hover:text-fg hover:underline" @click="emit('manage')">
                {{ compact ? "Change" : "Models" }}
            </button>
        </div>

        <div ref="listEl" class="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4" :class="compact ? '' : 'sm:p-5'">
            <div v-if="!messages.length" class="flex h-full flex-col items-center justify-center px-4 text-center">
                <div class="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent"><Bot class="size-5" /></div>
                <p class="mt-3 text-sm font-medium text-fg">Chat with an on-device model</p>
                <p class="mt-1 max-w-xs text-xs leading-5 text-fg-subtle">
                    Ask anything. The model runs in your browser with WebGPU, so your messages never leave this device. It isn't connected to the tools.
                </p>
            </div>

            <template v-for="(m, i) in messages" :key="m.id">
                <div v-if="m.role === 'user'" class="flex justify-end">
                    <div class="max-w-[85%] rounded-2xl rounded-br-md bg-inverse px-3.5 py-2.5 text-sm leading-6 whitespace-pre-wrap text-inverse-fg">{{ m.content }}</div>
                </div>
                <div v-else class="group max-w-full">
                    <div
                        class="rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm leading-6"
                        :class="m.error ? 'bg-danger-soft text-danger' : 'bg-subtle text-fg'"
                    >
                        <p v-if="m.error" class="whitespace-pre-wrap">{{ m.content }}</p>
                        <!-- eslint-disable-next-line vue/no-v-html -- sanitized with DOMPurify -->
                        <div v-else-if="m.content" class="prose-tool gc-md" v-html="render(m.content)" />
                        <span v-if="m.streaming" class="inline-block h-3 w-1 animate-pulse bg-accent align-middle" />
                    </div>
                    <div v-if="!m.streaming && m.content" class="mt-1 flex gap-1 pl-1 text-fg-subtle">
                        <button type="button" class="grid size-7 cursor-pointer place-items-center rounded-md hover:bg-subtle hover:text-fg" :aria-label="copied === m.id ? 'Copied' : 'Copy reply'" @click="copy(m.id, m.content)">
                            <Check v-if="copied === m.id" class="size-3.5 text-accent" /><Copy v-else class="size-3.5" />
                        </button>
                        <button
                            v-if="i === messages.length - 1"
                            type="button"
                            class="grid size-7 cursor-pointer place-items-center rounded-md hover:bg-subtle hover:text-fg disabled:opacity-40"
                            aria-label="Regenerate reply"
                            :disabled="gcBusy"
                            @click="gcRegenerate"
                        >
                            <RefreshCw class="size-3.5" />
                        </button>
                    </div>
                </div>
            </template>
        </div>

        <div class="border-t border-line p-3" :class="compact ? '' : 'sm:p-4'">
            <!-- Model not loaded / downloading / unsupported -->
            <div v-if="engineStatus === 'unsupported'" class="mb-2 rounded-lg bg-warn-soft px-3 py-2 text-xs leading-5 text-warn">
                WebGPU isn't available in this browser, so models can't run here. Try a recent Chrome, Edge or Safari.
            </div>
            <div v-else-if="downloading" class="mb-2 rounded-lg bg-subtle px-3 py-2">
                <div class="flex justify-between text-xs font-medium text-fg"><span>Loading {{ shortName(gcSettings.modelId) }}</span><span>{{ progress }}%</span></div>
                <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line"><div class="h-full rounded-full bg-accent transition-[width]" :style="{ width: `${progress}%` }" /></div>
                <p class="mt-1 truncate text-[11px] text-fg-subtle">{{ engineProgress.text }}</p>
            </div>
            <div v-else-if="!modelReady" class="mb-2 flex items-center gap-2 rounded-lg bg-subtle px-3 py-2 text-xs text-fg-muted">
                <span class="min-w-0 flex-1">
                    <template v-if="engineStatus === 'error' && engineError">Couldn't load the model: {{ engineError }}</template>
                    <template v-else>The model downloads once, then loads from your browser's cache. It also loads when you send.</template>
                </span>
                <button type="button" class="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md bg-inverse px-2 py-1 font-semibold text-inverse-fg hover:opacity-90" @click="loadModel">
                    <Download class="size-3.5" /> Load
                </button>
            </div>

            <form class="flex items-end gap-2 rounded-xl border border-line bg-subtle p-1.5 focus-within:border-ring" @submit.prevent="send">
                <textarea
                    ref="inputEl"
                    v-model="input"
                    rows="1"
                    class="max-h-52 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-base text-fg outline-none placeholder:text-fg-subtle sm:text-sm"
                    placeholder="Message the model…"
                    aria-label="Message"
                    :disabled="engineStatus === 'unsupported'"
                    @input="autosize"
                    @keydown.enter.exact.prevent="send"
                />
                <button v-if="gcBusy" type="button" class="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-fg" aria-label="Stop generating" @click="gcStop">
                    <Square class="size-3.5 fill-current" />
                </button>
                <button v-else type="submit" class="grid size-9 shrink-0 place-items-center rounded-lg bg-inverse text-inverse-fg disabled:opacity-40" aria-label="Send message" :disabled="!input.trim() || downloading || engineStatus === 'unsupported'">
                    <ArrowUp class="size-4" />
                </button>
            </form>
            <p class="mt-1.5 px-1 text-[10px] text-fg-subtle">Runs on your device · <span class="kbd">Shift</span>+<span class="kbd">Enter</span> for a new line</p>
        </div>
    </div>
</template>

<style scoped>
.gc-md :deep(> :first-child) {
    margin-top: 0;
}
.gc-md :deep(> :last-child) {
    margin-bottom: 0;
}
.gc-md :deep(pre) {
    white-space: pre;
}
</style>
