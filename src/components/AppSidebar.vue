<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, House, Info, Search, Star, Wrench } from "lucide-vue-next";
import { categories, searchTools, tools } from "@/tools/registry";
import { favorites } from "@/composables/prefs";

const emit = defineEmits<{ navigate: [] }>();
const filter = ref("");
const collapsed = ref<Record<string, boolean>>({});

const groups = computed(() => {
    const list = filter.value ? searchTools(filter.value) : tools;
    return categories
        .map((c) => ({ ...c, items: list.filter((t) => t.category === c.id) }))
        .filter((g) => g.items.length);
});

const allCollapsed = computed(() => categories.every((c) => collapsed.value[c.id]));

function toggleAll() {
    const next = !allCollapsed.value;
    collapsed.value = Object.fromEntries(categories.map((c) => [c.id, next]));
}
</script>

<template>
    <aside class="flex h-full flex-col border-r border-line bg-surface">
        <RouterLink to="/" class="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4" @click="emit('navigate')">
            <span class="grid size-9 place-items-center rounded-full bg-surface text-fg shadow-float ring-1 ring-line">
                <Wrench class="size-4" stroke-width="1.75" />
            </span>
            <span class="leading-tight">
                <span class="block font-display text-lg font-semibold text-fg">DevTools</span>
                <span class="block text-[11px] text-fg-subtle">{{ tools.length }} tools · msar.me</span>
            </span>
        </RouterLink>

        <div class="flex shrink-0 items-center gap-2 p-3">
            <div class="relative min-w-0 flex-1">
                <Search class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-subtle" />
                <input v-model="filter" type="search" placeholder="Filter tools…" class="input h-9 pl-8 text-xs shadow-none" />
            </div>
            <button
                type="button"
                class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md bg-subtle text-fg-subtle ring-1 ring-line ring-inset hover:bg-surface hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="!!filter"
                :title="allCollapsed ? 'Expand all categories' : 'Collapse all categories'"
                :aria-label="allCollapsed ? 'Expand all categories' : 'Collapse all categories'"
                @click="toggleAll"
            >
                <ChevronsUpDown v-if="allCollapsed" class="size-4" stroke-width="1.75" />
                <ChevronsDownUp v-else class="size-4" stroke-width="1.75" />
            </button>
        </div>

        <nav class="min-h-0 flex-1 overflow-y-auto px-2 pb-6 text-sm">
            <RouterLink
                v-if="!filter"
                to="/"
                class="group mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 font-medium text-fg transition-colors hover:text-accent"
                exact-active-class="!text-accent bg-subtle"
                @click="emit('navigate')"
            >
                <House class="size-4 text-fg-subtle group-hover:text-accent" stroke-width="1.75" /> Home
            </RouterLink>

            <div v-if="!filter && favorites.length" class="mt-3">
                <div class="flex items-center gap-1.5 px-2 pb-1 text-xs font-medium text-fg-subtle">
                    <Star class="size-3" stroke-width="1.75" /> Favorites
                </div>
                <RouterLink
                    v-for="t in favorites"
                    :key="'f-' + t.id"
                    :to="'/' + t.id"
                    class="flex items-center gap-2 rounded-md px-2 py-1.5 text-fg-muted transition-colors hover:text-accent"
                    active-class="!text-accent bg-subtle font-medium"
                    @click="emit('navigate')"
                >
                    <component :is="t.icon" class="size-4 shrink-0" stroke-width="1.75" />
                    <span class="truncate">{{ t.name }}</span>
                </RouterLink>
            </div>

            <div v-for="g in groups" :key="g.id" class="mt-3">
                <button
                    type="button"
                    class="flex w-full cursor-pointer items-center gap-1.5 px-2 pb-1 text-xs font-medium text-fg-subtle transition-colors hover:text-fg"
                    @click="collapsed[g.id] = !collapsed[g.id]"
                >
                    <ChevronRight class="size-3 transition-transform" :class="collapsed[g.id] && !filter ? '' : 'rotate-90'" />
                    {{ g.name }}
                    <span class="ml-auto font-normal tabular-nums">{{ g.items.length }}</span>
                </button>
                <div v-show="!collapsed[g.id] || filter">
                    <RouterLink
                        v-for="t in g.items"
                        :key="t.id"
                        :to="'/' + t.id"
                        class="flex items-center gap-2 rounded-md px-2 py-1.5 text-fg-muted transition-colors hover:text-accent"
                        active-class="!text-accent bg-subtle font-medium"
                        @click="emit('navigate')"
                    >
                        <component :is="t.icon" class="size-4 shrink-0" stroke-width="1.75" />
                        <span class="truncate">{{ t.name }}</span>
                    </RouterLink>
                </div>
            </div>

            <p v-if="!groups.length" class="px-2 py-6 text-center text-xs text-fg-subtle">No tools match “{{ filter }}”.</p>
        </nav>

        <div class="shrink-0 border-t border-line p-2">
            <RouterLink
                to="/about"
                class="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg-muted transition-colors hover:text-accent"
                active-class="!text-accent bg-subtle font-medium"
                @click="emit('navigate')"
            >
                <Info class="size-4 text-fg-subtle group-hover:text-accent" stroke-width="1.75" /> About
            </RouterLink>
        </div>
    </aside>
</template>
