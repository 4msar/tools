<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watch } from "vue";
import { onKeyStroke, useMediaQuery, useStorage } from "@vueuse/core";
import { useRouter } from "vue-router";
import { MessageCircle, MessagesSquare, Settings2, X } from "lucide-vue-next";
import { Tabs } from "@/components/ui";
import ChatConsent from "./ChatConsent.vue";
import GeneralThread from "./GeneralThread.vue";
import ChatSettings from "./ChatSettings.vue";
import ChatThread from "./ChatThread.vue";
import { chatSettings } from "@/chat/store";
import { engineStatus, load, supportsWebGPU } from "@/chat/engine";

const open = defineModel<boolean>({ default: false });
const view = defineModel<"consent" | "thread" | "settings">("view", {
    default: "thread",
});

/** "tools" finds and runs tools; "general" is General Chat, a plain conversation with the model. */
const mode = useStorage<"tools" | "general">("devtools:chat:mode", "tools");
const router = useRouter();
function manageModels() {
    void router.push("/general-chat");
    closeOnMobile();
}

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
    if (value && !chatSettings.value.consented && !chatSettings.value.skipModel)
        view.value = "consent";
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

// On phones the chat covers the page, so tapping a tool card closes it to reveal the tool.
const isPhone = useMediaQuery("(max-width: 639px)");
function closeOnMobile() {
    if (isPhone.value) open.value = false;
}
const fullScreen = computed(() => open.value && isPhone.value);

// Keep the page behind the full-screen chat from scrolling. iOS Safari ignores overflow:hidden for
// touch scrolling, so the body is pinned with position:fixed and the scroll position restored after.
let savedScroll = 0;
function lockScroll(lock: boolean) {
    const html = document.documentElement.style;
    const body = document.body.style;
    if (lock) {
        if (body.position === "fixed") return;
        savedScroll = window.scrollY;
        html.overflow = "hidden";
        html.overscrollBehavior = "none";
        Object.assign(body, { position: "fixed", top: `-${savedScroll}px`, left: "0", right: "0", width: "100%", overflow: "hidden" });
        document.addEventListener("touchstart", onTouchStart, { passive: true });
        document.addEventListener("touchmove", onTouchMove, { passive: false });
    } else if (body.position === "fixed") {
        html.overflow = "";
        html.overscrollBehavior = "";
        Object.assign(body, { position: "", top: "", left: "", right: "", width: "", overflow: "" });
        document.removeEventListener("touchstart", onTouchStart);
        document.removeEventListener("touchmove", onTouchMove);
        window.scrollTo(0, savedScroll);
    }
}

// iOS still drags (rubber-bands) the whole page, chat included, on a pinned body, most visibly with
// the keyboard open. Cancel any vertical drag unless it starts inside something that can still
// scroll that way (the message list, the textarea, a long output block).
let touchX = 0;
let touchY = 0;
function onTouchStart(e: TouchEvent) {
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
}
function onTouchMove(e: TouchEvent) {
    if (e.touches.length > 1 || !e.cancelable) return; // leave pinch-zoom alone
    const dx = e.touches[0].clientX - touchX;
    const dy = e.touches[0].clientY - touchY;
    if (Math.abs(dx) > Math.abs(dy)) return; // horizontal: code blocks and the tab bar scroll sideways
    for (let el = e.target as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
        if (!/(auto|scroll)/.test(getComputedStyle(el).overflowY) || el.scrollHeight <= el.clientHeight) continue;
        const atTop = el.scrollTop <= 0;
        const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
        if ((dy > 0 && !atTop) || (dy < 0 && !atBottom)) return;
        break;
    }
    e.preventDefault();
}

// Fit the chat to the visible area. When the on-screen keyboard opens, the visual viewport shrinks
// (and on iOS may scroll) while 100dvh stays the same, which left a gap above the keyboard.
const vv = reactive({ height: 0, top: 0, keyboard: false });
function syncViewport() {
    const v = window.visualViewport;
    if (!v) return;
    vv.height = Math.round(v.height);
    vv.top = Math.round(v.offsetTop);
    vv.keyboard = window.innerHeight - v.height > 120;
}
watch(
    fullScreen,
    (on) => {
        lockScroll(on);
        if (on) {
            syncViewport();
            // Some browsers only fire window resize when the keyboard resizes the layout.
            window.addEventListener("resize", syncViewport);
            window.visualViewport?.addEventListener("resize", syncViewport);
            window.visualViewport?.addEventListener("scroll", syncViewport);
        } else unlistenViewport();
    },
    { immediate: true },
);
function unlistenViewport() {
    window.removeEventListener("resize", syncViewport);
    window.visualViewport?.removeEventListener("resize", syncViewport);
    window.visualViewport?.removeEventListener("scroll", syncViewport);
}
onBeforeUnmount(() => {
    lockScroll(false);
    unlistenViewport();
});
const panelStyle = computed(() => (fullScreen.value && vv.height ? { top: `${vv.top}px`, height: `${vv.height}px` } : undefined));

function skipModel() {
    chatSettings.value.skipModel = true;
    view.value = "thread";
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

// Hidden (not unmounted) in compact view so an open conversation survives.
defineProps<{ hidden?: boolean }>();
</script>

<template>
    <Teleport to="body">
        <div
            v-show="!hidden"
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
                    class="flex flex-col overflow-hidden overscroll-none bg-surface max-sm:fixed max-sm:inset-x-0 max-sm:top-0 max-sm:z-50 max-sm:h-dvh max-sm:w-full max-sm:pt-[env(safe-area-inset-top)] sm:h-[min(70vh,620px)] sm:w-[380px] sm:rounded-2xl sm:border sm:border-line sm:shadow-float"
                    :class="vv.keyboard ? '' : 'max-sm:pb-[env(safe-area-inset-bottom)]'"
                    :style="panelStyle"
                    role="dialog"
                    aria-label="Find a tool assistant"
                >
                    <header
                        class="flex h-14 shrink-0 items-center justify-between border-b border-line px-4"
                    >
                        <div class="flex items-center gap-2">
                            <span
                                class="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent"
                                ><MessagesSquare
                                    v-if="mode === 'general'"
                                    class="size-4" /><MessageCircle
                                    v-else
                                    class="size-4"
                            /></span>
                            <div>
                                <h2 class="text-sm font-semibold text-fg">
                                    {{ mode === "general" ? "General chat" : "Find a tool" }}
                                </h2>
                                <p class="text-[10px] text-fg-subtle">
                                    Private, on-device assistant
                                </p>
                            </div>
                        </div>
                        <div class="flex items-center gap-1">
                            <button
                                v-if="mode === 'tools' && view === 'thread'"
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
                    <div
                        v-if="mode === 'general' || view !== 'settings'"
                        class="flex justify-center border-b border-line px-4 py-2"
                    >
                        <Tabs
                            v-model="mode"
                            size="sm"
                            :options="[
                                { value: 'tools', label: 'Tools' },
                                { value: 'general', label: 'General chat' },
                            ]"
                        />
                    </div>
                    <GeneralThread
                        v-if="mode === 'general'"
                        compact
                        @manage="manageModels"
                    />
                    <ChatConsent
                        v-else-if="view === 'consent'"
                        @start="startModel"
                        @skip="skipModel"
                        @settings="openSettings"
                    />
                    <ChatThread
                        v-else-if="view === 'thread'"
                        @settings="openSettings"
                        @open-tool="closeOnMobile"
                    />
                    <ChatSettings
                        v-else
                        @back="
                            view =
                                chatSettings.consented || chatSettings.skipModel
                                    ? 'thread'
                                    : 'consent'
                        "
                        @load="loadFromSettings"
                    />
                </section>
            </Transition>
            <button
                type="button"
                class="grid size-12 place-items-center rounded-full bg-inverse text-inverse-fg shadow-float transition-transform hover:scale-105"
                :class="open ? 'max-sm:hidden' : ''"
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
