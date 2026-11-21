<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
    ArrowUp,
    ExternalLink,
    CircleCheck,
    CircleAlert,
    Plus,
    Square,
    Sparkles,
    Settings2,
} from "lucide-vue-next";
import { rankTools } from "@/chat/retrieval";
import { actionExamples, runAction } from "@/chat/actions";
import { sendToTool } from "@/composables/handoff";
import CopyButton from "@/components/ui/CopyButton.vue";
import { ask, engineStatus, stop } from "@/chat/engine";
import { recents } from "@/composables/prefs";
import {
    activeSession,
    chatSettings,
    ensureSession,
    newChat,
    updateSession,
    type ChatMessage,
} from "@/chat/store";
import { toolById } from "@/tools/registry";

const emit = defineEmits<{ settings: []; consent: []; openTool: [] }>();
/** Recently used tools, offered as one-tap chips in the empty chat. */
const recentTools = computed(() => recents.value.slice(0, 4));
const router = useRouter();
const input = ref("");
const listEl = ref<HTMLElement>();
const busy = ref(false);

watch(
    () => activeSession.value?.messages.length,
    async () => {
        await nextTick();
        if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight;
    },
);

function patchMessage(
    sessionId: string,
    messageId: string,
    change: (message: ChatMessage) => ChatMessage,
) {
    updateSession(sessionId, (session) => ({
        ...session,
        updatedAt: Date.now(),
        messages: session.messages.map((message) =>
            message.id === messageId ? change(message) : message,
        ),
    }));
}

/** "Opened X." reads as "Open X." when the tool page stays closed and the card below opens it. */
const unopened = (summary: string) => summary.replace(/^Opened\b/, "Open");

async function runCommand(text: string) {
    const action = await runAction(text);
    if (!action) return false;
    const willOpen = !!action.open || !!chatSettings.value.openToolOnRun;
    const summary = willOpen ? action.summary : unopened(action.summary);
    const session = ensureSession();
    updateSession(session.id, (current) => ({
        ...current,
        title: current.messages.length ? current.title : text.slice(0, 42),
        updatedAt: Date.now(),
        messages: [
            ...current.messages,
            { id: crypto.randomUUID(), role: "user", content: text },
            { id: crypto.randomUUID(), role: "assistant", content: summary, action },
        ],
    }));
    input.value = "";
    if (willOpen) {
        if (action.handoff) sendToTool(action.toolId, action.handoff);
        openTool(action.toolId);
        emit("openTool");
    }
    return true;
}

async function send(preset?: string) {
    const text = (preset ?? input.value).trim();
    if (!text || busy.value) return;
    busy.value = true;
    try {
        if (await runCommand(text)) return;
    } finally {
        busy.value = false;
    }
    const session = ensureSession();
    const matches = rankTools(text);
    const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
    };
    const assistantId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        toolIds: matches.map((tool) => tool.id),
        streaming: true,
    };
    updateSession(session.id, (current) => ({
        ...current,
        title: current.messages.length ? current.title : text.slice(0, 42),
        updatedAt: Date.now(),
        messages: [...current.messages, userMessage, assistantMessage],
    }));
    input.value = "";
    busy.value = true;
    const history = [...session.messages, userMessage].map((message) => ({
        role: message.role,
        content: message.content,
    }));
    const fallback = matches.length
        ? `I found ${matches.length} tool${matches.length === 1 ? "" : "s"} that should help. Pick one below to get started.`
        : "I could not find a close match yet. Try naming the format, protocol, or kind of output you need.";
    try {
        if (engineStatus.value === "ready") {
            await ask(
                [
                    {
                        role: "system",
                        content: `You help users choose a developer tool. Answer in 2 or 3 concise sentences. Do not invent tools or links. Candidate tools:\n${matches.map((tool) => `${tool.name} — ${tool.description}`).join("\n")}`,
                    },
                    ...history,
                ],
                (token) =>
                    patchMessage(session.id, assistantId, (message) => ({
                        ...message,
                        content: message.content + token,
                    })),
            );
        }
        patchMessage(session.id, assistantId, (message) => ({
            ...message,
            content: message.content || fallback,
            streaming: false,
        }));
    } catch {
        patchMessage(session.id, assistantId, (message) => ({
            ...message,
            content: fallback,
            streaming: false,
        }));
    } finally {
        busy.value = false;
    }
}

function openTool(id: string) {
    if (toolById.has(id) && router.currentRoute.value.path !== "/" + id) router.push("/" + id);
}

function reopen(message: ChatMessage) {
    const action = message.action!;
    if (action.handoff) sendToTool(action.toolId, action.handoff);
    openTool(action.toolId);
    emit("openTool");
}

/** A suggested-tool card was tapped. */
function pickTool(id: string) {
    openTool(id);
    emit("openTool");
}

/** ↑ in an empty box brings back the last message, to tweak and resend. */
function recallLast(event: KeyboardEvent) {
    if (input.value) return;
    const last = activeSession.value?.messages.findLast((m) => m.role === "user");
    if (!last) return;
    event.preventDefault();
    input.value = last.content;
}

function startNewChat() {
    newChat();
}
</script>

<template>
    <div class="flex min-h-0 flex-1 flex-col">
        <div ref="listEl" class="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
            <div
                v-if="!activeSession?.messages.length"
                class="flex h-full flex-col items-center justify-center px-5 text-center"
            >
                <div
                    class="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent"
                >
                    <Sparkles class="size-5" />
                </div>
                <p class="mt-3 text-sm font-medium text-fg">
                    What are you trying to make?
                </p>
                <p class="mt-1 max-w-[260px] text-xs leading-5 text-fg-subtle">
                    Find a tool, or tell me what to do and I'll run it and
                    open the tool for you.
                </p>
                <div class="mt-4 flex max-w-[300px] flex-wrap justify-center gap-1.5">
                    <button
                        v-for="example in actionExamples"
                        :key="example"
                        type="button"
                        class="rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-fg-subtle transition-colors hover:border-accent hover:text-fg"
                        @click="send(example)"
                    >
                        {{ example }}
                    </button>
                </div>
                <div v-if="recentTools.length" class="mt-5 w-full max-w-[300px]">
                    <p class="mb-1.5 text-[10px] font-semibold tracking-wide text-fg-subtle uppercase">
                        Recently used
                    </p>
                    <div class="flex flex-wrap justify-center gap-1.5">
                        <button
                            v-for="tool in recentTools"
                            :key="tool.id"
                            type="button"
                            class="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-fg-subtle transition-colors hover:border-accent hover:text-fg"
                            @click="pickTool(tool.id)"
                        >
                            <component :is="tool.icon" class="size-3.5" />{{ tool.name }}
                        </button>
                    </div>
                </div>
            </div>
            <template
                v-for="message in activeSession?.messages"
                :key="message.id"
            >
                <div
                    class="flex"
                    :class="
                        message.role === 'user'
                            ? 'justify-end'
                            : 'justify-start'
                    "
                >
                    <div
                        class="max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-6"
                        :class="
                            message.role === 'user'
                                ? 'rounded-br-md bg-inverse text-inverse-fg'
                                : 'rounded-bl-md bg-subtle text-fg'
                        "
                    >
                        <p class="whitespace-pre-wrap">
                            {{ message.content
                            }}<span
                                v-if="message.streaming"
                                class="ml-1 inline-block h-3 w-1 animate-pulse bg-accent align-middle"
                            />
                        </p>
                    </div>
                </div>
                <div
                    v-if="message.action"
                    class="ml-1 overflow-hidden rounded-xl border border-line bg-surface"
                >
                    <div
                        v-if="message.action.output"
                        class="relative border-b border-line"
                    >
                        <pre
                            class="max-h-48 overflow-auto p-3 pr-16 font-mono text-xs leading-5 break-all whitespace-pre-wrap text-fg"
                            >{{ message.action.output }}</pre
                        >
                        <div class="absolute top-1.5 right-1.5">
                            <CopyButton :text="message.action.output" />
                        </div>
                    </div>
                    <button
                        type="button"
                        class="group flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-fg-subtle transition-colors hover:bg-subtle hover:text-fg"
                        @click="reopen(message)"
                    >
                        <CircleAlert
                            v-if="message.action.error"
                            class="size-3.5 shrink-0 text-warn"
                        /><CircleCheck
                            v-else
                            class="size-3.5 shrink-0 text-accent"
                        />
                        <component
                            :is="toolById.get(message.action.toolId)?.icon"
                            class="size-3.5 shrink-0"
                        />
                        <span class="flex-1 truncate"
                            >Open in {{ toolById.get(message.action.toolId)?.name }}</span
                        >
                        <ExternalLink class="size-3.5 shrink-0 group-hover:text-accent" />
                    </button>
                </div>
                <div
                    v-if="
                        message.role === 'assistant' &&
                        !message.streaming &&
                        message.toolIds?.length
                    "
                    class="space-y-2 pl-1"
                >
                    <button
                        v-for="id in message.toolIds"
                        :key="id"
                        type="button"
                        class="group flex w-full items-start gap-3 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-accent hover:bg-subtle"
                        @click="pickTool(id)"
                    >
                        <span
                            class="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"
                            ><component
                                :is="toolById.get(id)?.icon"
                                class="size-4"
                        /></span>
                        <span class="min-w-0 flex-1"
                            ><span class="block text-sm font-medium text-fg">{{
                                toolById.get(id)?.name
                            }}</span
                            ><span
                                class="mt-0.5 block text-xs leading-5 text-fg-subtle"
                                >{{ toolById.get(id)?.description }}</span
                            ></span
                        >
                        <ExternalLink
                            class="mt-1 size-3.5 shrink-0 text-fg-subtle transition-colors group-hover:text-accent"
                        />
                    </button>
                </div>
            </template>
        </div>
        <div class="border-t border-line p-3">
            <form
                class="flex items-end gap-2 rounded-xl border border-line bg-subtle p-1.5 focus-within:border-ring"
                @submit.prevent="send()"
            >
                <textarea
                    v-model="input"
                    rows="1"
                    class="field-sizing-content max-h-24 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-base text-fg sm:text-sm outline-none placeholder:text-fg-subtle"
                    placeholder="Ask, or say “base64 encode hello”…"
                    aria-label="Describe what you need"
                    @keydown.enter.exact.prevent="send()"
                    @keydown.up="recallLast"
                />
                <button
                    v-if="busy"
                    type="button"
                    class="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-fg"
                    aria-label="Stop generating"
                    @click="stop"
                >
                    <Square class="size-3.5 fill-current" />
                </button>
                <button
                    v-else
                    type="submit"
                    class="grid size-9 shrink-0 place-items-center rounded-lg bg-inverse text-inverse-fg disabled:opacity-40"
                    aria-label="Send message"
                    :disabled="!input.trim()"
                >
                    <ArrowUp class="size-4" />
                </button>
            </form>
            <div class="mt-2 flex items-center justify-between px-1">
                <span class="text-[10px] text-fg-subtle"
                    >Private by design · runs in your browser</span
                ><span class="flex gap-1"
                    ><button
                        type="button"
                        class="grid size-7 place-items-center rounded-md text-fg-subtle hover:bg-subtle hover:text-fg"
                        aria-label="New conversation"
                        title="New conversation"
                        @click="startNewChat"
                    >
                        <Plus class="size-4" /></button
                    ><button
                        type="button"
                        class="grid size-7 place-items-center rounded-md text-fg-subtle hover:bg-subtle hover:text-fg"
                        aria-label="Chat settings"
                        title="Chat settings"
                        @click="emit('settings')"
                    >
                        <Settings2 class="size-4" /></button
                ></span>
            </div>
        </div>
    </div>
</template>
