<script setup lang="ts">
import { onMounted, watch } from "vue";
import { onKeyStroke } from "@vueuse/core";
import { MessageCircle, Settings2, X } from "lucide-vue-next";
import ChatConsent from "./ChatConsent.vue";
import ChatSettings from "./ChatSettings.vue";
import ChatThread from "./ChatThread.vue";
import { chatSettings } from "@/chat/store";
import { engineStatus, load, supportsWebGPU } from "@/chat/engine";

const open = defineModel<boolean>({ default: false });
const view = defineModel<"consent" | "thread" | "settings">("view", {
    default: "thread",
});

onKeyStroke("Escape", () => {
    if (open.value) open.value = false;
});
onMounted(async () => {
    if (!(await supportsWebGPU())) engineStatus.value = "unsupported";
    if (
        chatSettings.value.autoLoad &&
        chatSettings.value.consented &&
        engineStatus.value !== "unsupported"
    )
        void startModel();
});
watch(open, (value) => {
    if (value && !chatSettings.value.consented) view.value = "consent";
});

async function startModel() {
    chatSettings.value.consented = true;
    view.value = "thread";
    try {
        await load(chatSettings.value.modelId);
    } catch {
        /* retrieval remains available */
    }
}

function openSettings() {
    view.value = "settings";
}
function loadFromSettings() {
    if (
        chatSettings.value.autoLoad &&
        chatSettings.value.consented &&
        engineStatus.value !== "unsupported"
    )
        void startModel();
}
</script>

<template>
    <Teleport to="body">
        <div
            class="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6"
        >
            <Transition
                enter-active-class="transition duration-200 ease-(--ease-out)"
                enter-from-class="translate-y-3 opacity-0"
                leave-active-class="transition duration-150 ease-in"
                leave-to-class="translate-y-3 opacity-0"
            >
                <section
                    v-if="open"
                    class="flex h-[min(70vh,620px)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-float sm:w-[380px]"
                    role="dialog"
                    aria-label="Find a tool assistant"
                >
                    <header
                        class="flex h-14 shrink-0 items-center justify-between border-b border-line px-4"
                    >
                        <div class="flex items-center gap-2">
                            <span
                                class="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent"
                                ><MessageCircle class="size-4"
                            /></span>
                            <div>
                                <h2 class="text-sm font-semibold text-fg">
                                    Find a tool
                                </h2>
                                <p class="text-[10px] text-fg-subtle">
                                    Private, on-device assistant
                                </p>
                            </div>
                        </div>
                        <div class="flex items-center gap-1">
                            <button
                                v-if="view === 'thread'"
                                type="button"
                                class="grid size-8 place-items-center rounded-md text-fg-subtle hover:bg-subtle hover:text-fg"
                                aria-label="Chat settings"
                                title="Chat settings"
                                @click="openSettings"
                            >
                                <Settings2 class="size-4" /></button
                            ><button
                                type="button"
                                class="grid size-8 place-items-center rounded-md text-fg-subtle hover:bg-subtle hover:text-fg"
                                aria-label="Close assistant"
                                @click="open = false"
                            >
                                <X class="size-4" />
                            </button>
                        </div>
                    </header>
                    <ChatConsent
                        v-if="view === 'consent'"
                        @start="startModel"
                        @settings="openSettings"
                    />
                    <ChatThread
                        v-else-if="view === 'thread'"
                        @settings="openSettings"
                    />
                    <ChatSettings
                        v-else
                        @back="
                            view = chatSettings.consented ? 'thread' : 'consent'
                        "
                        @load="loadFromSettings"
                    />
                </section>
            </Transition>
            <button
                type="button"
                class="grid size-12 place-items-center rounded-full bg-inverse text-inverse-fg shadow-float transition-transform hover:scale-105"
                :aria-expanded="open"
                aria-label="Find a tool"
                @click="open = !open"
            >
                <X v-if="open" class="size-5" /><MessageCircle
                    v-else
                    class="size-5"
                />
            </button>
        </div>
    </Teleport>
</template>
