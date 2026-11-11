<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { onKeyStroke } from "@vueuse/core";
import { CornerDownLeft, Search } from "lucide-vue-next";
import { categoryById, searchTools } from "@/tools/registry";
import { recents } from "@/composables/prefs";

const open = defineModel<boolean>("open", { default: false });
const router = useRouter();
const query = ref("");
const active = ref(0);
const inputEl = ref<HTMLInputElement>();
const listEl = ref<HTMLElement>();

const results = computed(() => {
    if (!query.value && recents.value.length) {
        const rest = searchTools("").filter((t) => !recents.value.includes(t));
        return [...recents.value, ...rest];
    }
    return searchTools(query.value);
});

watch(query, () => (active.value = 0));
watch(open, async (v) => {
    if (v) {
        query.value = "";
        active.value = 0;
        await nextTick();
        inputEl.value?.focus();
    }
});

onKeyStroke("k", (e) => {
    if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        open.value = !open.value;
    }
});
onKeyStroke("/", (e) => {
    const el = document.activeElement as HTMLElement | null;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
    e.preventDefault();
    open.value = true;
});

function go(id: string) {
    open.value = false;
    router.push("/" + id);
}

function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
        e.preventDefault();
        active.value = Math.min(active.value + 1, results.value.length - 1);
    } else if (e.key === "ArrowUp") {
        e.preventDefault();
        active.value = Math.max(active.value - 1, 0);
    } else if (e.key === "Enter") {
        const t = results.value[active.value];
        if (t) go(t.id);
    } else if (e.key === "Escape") {
        open.value = false;
        return;
    } else return;
    nextTick(() => listEl.value?.querySelector(`[data-idx="${active.value}"]`)?.scrollIntoView({ block: "nearest" }));
}
</script>

<template>
    <Teleport to="body">
        <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0"
            leave-active-class="transition duration-100 ease-in"
            leave-to-class="opacity-0"
        >
            <div v-if="open" class="fixed inset-0 z-50 flex items-start justify-center bg-inverse/25 p-4 pt-[12vh] backdrop-blur-sm" @mousedown.self="open = false">
                <div class="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-float" role="dialog" aria-label="Search tools">
                    <div class="flex items-center gap-3 border-b border-line px-4">
                        <Search class="size-4 shrink-0 text-fg-subtle" stroke-width="1.75" />
                        <input
                            ref="inputEl"
                            v-model="query"
                            type="text"
                            placeholder="Search tools — try “sha”, “yaml”, “diff”…"
                            class="h-13 w-full bg-transparent text-[15px] outline-none text-fg placeholder:text-fg-subtle"
                            @keydown="onKey"
                        />
                        <span class="kbd">esc</span>
                    </div>
                    <div ref="listEl" class="max-h-[55vh] overflow-y-auto p-2">
                        <p v-if="!query && recents.length" class="px-2 pt-1 pb-1.5 text-xs font-medium text-fg-subtle">Recent first</p>
                        <button
                            v-for="(t, i) in results"
                            :key="t.id"
                            :data-idx="i"
                            type="button"
                            class="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left"
                            :class="i === active ? 'bg-subtle' : ''"
                            @mousemove="active = i"
                            @click="go(t.id)"
                        >
                            <span class="grid size-8 shrink-0 place-items-center rounded-full bg-surface ring-1 ring-line" :class="i === active ? 'text-accent' : 'text-fg-subtle'">
                                <component :is="t.icon" class="size-4" />
                            </span>
                            <span class="min-w-0 flex-1">
                                <span class="block truncate text-sm font-medium text-fg">{{ t.name }}</span>
                                <span class="block truncate text-xs text-fg-subtle">{{ t.description }}</span>
                            </span>
                            <span class="hidden shrink-0 text-xs text-fg-subtle sm:block">{{ categoryById.get(t.category)?.name }}</span>
                            <CornerDownLeft v-if="i === active" class="size-3.5 shrink-0 text-accent" />
                        </button>
                        <p v-if="!results.length" class="py-10 text-center text-sm text-fg-subtle">No tools found.</p>
                    </div>
                    <div class="flex items-center gap-4 border-t border-line bg-subtle px-4 py-2 text-xs text-fg-subtle">
                        <span class="flex items-center gap-1"><span class="kbd">↑</span><span class="kbd">↓</span> navigate</span>
                        <span class="flex items-center gap-1"><span class="kbd">↵</span> open</span>
                        <span class="ml-auto">{{ results.length }} tools</span>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>
