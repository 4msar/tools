<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { onClickOutside, useScroll } from "@vueuse/core";
import { Ellipsis, X } from "lucide-vue-next";
import {
    closeAllTabs,
    closeOtherTabs,
    closeTabAndNavigate,
    moveTab,
    openTabs,
} from "@/composables/tabs";

const props = defineProps<{ activeId?: string; inline?: boolean }>();
const router = useRouter();
const scroller = ref<HTMLElement>();
const menuOpen = ref(false);
const menuEl = ref<HTMLElement>();
const dragId = ref<string | null>(null);
const dropIndex = ref<number | null>(null);

onClickOutside(menuEl, () => (menuOpen.value = false));

// Fade whichever edge of the strip has more tabs hidden behind it.
const { arrivedState, measure } = useScroll(scroller);
const edgeMask = computed(() => {
    const s = scroller.value;
    if (!s || s.scrollWidth <= s.clientWidth + 1) return "";
    const l = arrivedState.left ? "black" : "transparent";
    const r = arrivedState.right ? "black" : "transparent";
    return `linear-gradient(to right, ${l}, black 20px, black calc(100% - 20px), ${r})`;
});

function close(id: string, e?: Event) {
    e?.preventDefault();
    e?.stopPropagation();
    closeTabAndNavigate(id, props.activeId, (p) => router.push(p));
}

function closeOthers() {
    if (props.activeId) closeOtherTabs(props.activeId);
    menuOpen.value = false;
}

async function closeAll() {
    menuOpen.value = false;
    await router.push("/");
    closeAllTabs();
}

function onDragStart(id: string, e: DragEvent) {
    dragId.value = id;
    e.dataTransfer?.setData("text/plain", id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
}

function onDragOver(index: number, e: DragEvent) {
    if (!dragId.value) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dropIndex.value =
        e.clientX > rect.left + rect.width / 2 ? index + 1 : index;
}

function onDrop() {
    if (dragId.value && dropIndex.value !== null) {
        const from = openTabs.value.findIndex((t) => t.id === dragId.value);
        moveTab(
            dragId.value,
            dropIndex.value > from ? dropIndex.value - 1 : dropIndex.value,
        );
    }
    dragId.value = null;
    dropIndex.value = null;
}

// Keep the active tab in view. Scrolls the strip only (scrollIntoView could also move the page).
watch(
    () => [props.activeId, openTabs.value.length] as const,
    async ([id]) => {
        await nextTick();
        const s = scroller.value;
        const el = s?.querySelector<HTMLElement>(`[data-tab="${id}"]`);
        if (!s || !el) return;
        const left = el.offsetLeft;
        const right = left + el.offsetWidth;
        if (left < s.scrollLeft) s.scrollLeft = left - 24;
        else if (right > s.scrollLeft + s.clientWidth)
            s.scrollLeft = right - s.clientWidth + 24;
        measure();
    },
    { immediate: true, flush: "post" },
);
</script>

<template>
    <!-- inline: sits in the header between breadcrumb and search (desktop). Otherwise: its own row below the header. -->
    <div
        class="flex min-w-0"
        v-if="openTabs.length"
        :class="
            inline
                ? 'h-10 items-center rounded-full bg-surface/90 px-1 shadow-float ring-1 ring-line backdrop-blur'
                : 'h-10 items-end gap-1 border-b border-line px-2 sm:px-4'
        "
    >
        <div
            ref="scroller"
            class="relative flex min-w-0 flex-1 gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            :class="inline ? 'items-center' : 'items-end'"
            :style="
                edgeMask
                    ? { maskImage: edgeMask, WebkitMaskImage: edgeMask }
                    : undefined
            "
            role="tablist"
            aria-label="Open tools"
            @dragleave.self="dropIndex = null"
        >
            <div
                v-for="(t, i) in openTabs"
                :key="t.id"
                :data-tab="t.id"
                class="group relative shrink-0"
                draggable="true"
                @dragstart="onDragStart(t.id, $event)"
                @dragover="onDragOver(i, $event)"
                @drop.prevent="onDrop"
                @dragend="
                    dragId = null;
                    dropIndex = null;
                "
            >
                <span
                    v-if="dropIndex === i"
                    class="absolute inset-y-1.5 -left-px z-10 w-0.5 rounded-full bg-accent"
                />
                <span
                    v-if="dropIndex === i + 1 && i === openTabs.length - 1"
                    class="absolute inset-y-1.5 -right-px z-10 w-0.5 rounded-full bg-accent"
                />
                <RouterLink
                    :to="'/' + t.id"
                    role="tab"
                    :aria-selected="t.id === activeId"
                    class="relative flex items-center gap-1.5 font-medium transition-colors"
                    :class="[
                        inline
                            ? [
                                  'h-8 max-w-44 rounded-full pr-7 pl-3 text-sm',
                                  t.id === activeId
                                      ? 'bg-subtle text-accent'
                                      : 'text-fg hover:text-accent',
                              ]
                            : [
                                  '-mb-px h-[34px] max-w-48 rounded-t-md border border-b-0 pr-8 pl-3 text-[13px]',
                                  t.id === activeId
                                      ? 'border-line bg-surface text-fg after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-surface'
                                      : 'border-transparent text-fg-subtle hover:bg-subtle hover:text-fg',
                              ],
                        dragId === t.id ? 'opacity-50' : '',
                    ]"
                    :title="t.name"
                    @auxclick.middle="close(t.id, $event)"
                >
                    <component
                        :is="t.icon"
                        class="size-3.5 shrink-0"
                        :class="
                            inline || t.id !== activeId ? '' : 'text-accent'
                        "
                        stroke-width="1.75"
                    />
                    <span class="truncate">{{ t.name }}</span>
                </RouterLink>
                <button
                    type="button"
                    class="absolute top-1/2 right-1.5 grid size-5 -translate-y-1/2 cursor-pointer place-items-center text-fg-subtle transition hover:text-fg"
                    :class="[
                        inline
                            ? 'rounded-full hover:bg-surface'
                            : 'rounded-sm hover:bg-subtle',
                        t.id === activeId
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                    ]"
                    :aria-label="`Close ${t.name}`"
                    title="Close tab (Alt+W)"
                    @click="close(t.id, $event)"
                >
                    <X class="size-3" stroke-width="2" />
                </button>
            </div>
        </div>

        <div
            v-if="openTabs.length"
            ref="menuEl"
            class="relative shrink-0"
            :class="
                inline
                    ? 'ml-1 flex h-6 items-center border-l border-line pl-1'
                    : 'mb-1.5'
            "
        >
            <button
                type="button"
                class="grid cursor-pointer place-items-center text-fg-subtle transition-colors hover:text-accent"
                :class="
                    inline
                        ? 'size-8 rounded-full'
                        : 'size-7 rounded-md hover:bg-subtle'
                "
                aria-label="Tab options"
                :aria-expanded="menuOpen"
                @click="menuOpen = !menuOpen"
            >
                <Ellipsis class="size-4" />
            </button>
            <div
                v-if="menuOpen"
                class="absolute top-full right-0 z-30 w-52 rounded-md border border-line bg-surface p-1 text-sm shadow-float"
                :class="inline ? 'mt-3' : 'mt-1'"
                role="menu"
            >
                <button
                    type="button"
                    role="menuitem"
                    class="flex w-full cursor-pointer items-center justify-between rounded-sm px-2.5 py-1.5 text-left text-fg hover:bg-subtle disabled:opacity-50"
                    :disabled="!activeId"
                    @click="
                        activeId && close(activeId);
                        menuOpen = false;
                    "
                >
                    Close tab <span class="kbd">Alt W</span>
                </button>
                <button
                    type="button"
                    role="menuitem"
                    class="flex w-full cursor-pointer items-center rounded-sm px-2.5 py-1.5 text-left text-fg hover:bg-subtle disabled:opacity-50"
                    :disabled="!activeId || openTabs.length < 2"
                    @click="closeOthers"
                >
                    Close other tabs
                </button>
                <button
                    type="button"
                    role="menuitem"
                    class="flex w-full cursor-pointer items-center rounded-sm px-2.5 py-1.5 text-left text-danger hover:bg-danger-soft"
                    @click="closeAll"
                >
                    Close all tabs
                </button>
                <p
                    class="mt-1 border-t border-line px-2.5 pt-1.5 pb-1 text-xs text-fg-subtle"
                >
                    Switch tabs with <span class="kbd">Alt</span>
                    <span class="kbd">⇧</span> <span class="kbd">←</span>
                    <span class="kbd">→</span>
                </p>
            </div>
        </div>
    </div>
    <div v-else class="h-10" />
</template>
