<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, House, Info, Search, Settings, Star, Wrench } from "lucide-vue-next";
import { categories, searchTools, tools } from "@/tools/registry";
import { favorites, sidebarGroupsCollapsed as collapsed } from "@/composables/prefs";
import { APP_VERSION, BUILD_DATE } from "@/site";
import { desktopSettingsOpen, isDesktopApp } from "@/desktop/bridge";

// desktop: the desktop app's shell — sits on the tinted canvas, and the search box opens the command palette.
const props = defineProps<{ variant?: "desktop" }>();
const emit = defineEmits<{ navigate: []; search: [] }>();
const desktop = computed(() => props.variant === "desktop");
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
// Nav item styles: the desktop shell highlights with a raised fill instead of the subtle tint.
const itemActive = computed(() =>
    desktop.value ? "!text-fg bg-bg font-medium ring-1 ring-line shadow-card" : "!text-accent bg-subtle font-medium",
);
const itemHover = computed(() => (desktop.value ? "hover:bg-bg/60 hover:text-fg" : "hover:text-accent"));
const filter = ref("");
const nav = ref<HTMLElement>();
const route = useRoute();

const groups = computed(() => {
    const list = filter.value ? searchTools(filter.value) : tools;
    return categories
        .map((c) => ({ ...c, items: list.filter((t) => t.category === c.id) }))
        .filter((g) => g.items.length);
});

// The category of the open tool is always kept expanded.
const activeCategory = computed(() => tools.find((t) => t.id === route.meta.toolId)?.category);
const isCollapsed = (id: string) => !!collapsed.value[id] && id !== activeCategory.value;

const allCollapsed = computed(() =>
    categories.every((c) => c.id === activeCategory.value || collapsed.value[c.id]),
);

function toggleAll() {
    const next = !allCollapsed.value;
    collapsed.value = Object.fromEntries(categories.map((c) => [c.id, next && c.id !== activeCategory.value]));
}

function toggleGroup(id: string) {
    if (id === activeCategory.value) return;
    collapsed.value = { ...collapsed.value, [id]: !collapsed.value[id] };
}

// Keep the active tool visible in the sidebar: expand its category and scroll it into view.
async function revealActive(smooth: boolean) {
    const id = route.meta.toolId as string | undefined;
    if (!id) return;
    const tool = tools.find((t) => t.id === id);
    if (tool && collapsed.value[tool.category]) collapsed.value = { ...collapsed.value, [tool.category]: false };
    await nextTick();
    const container = nav.value;
    const el = container?.querySelector<HTMLElement>(`[data-tool="${id}"]`);
    if (!container || !el) return;
    const c = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top >= c.top && r.bottom <= c.bottom) return;
    // Scroll only the nav (not the page), centering the item.
    const top = container.scrollTop + (r.top - c.top) - (c.height - r.height) / 2;
    container.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
}

// Jump instantly on first load (route resolves after mount); animate on later navigation.
watch(() => route.meta.toolId, (_id, prev) => revealActive(prev !== undefined), { flush: "post" });
onMounted(() => revealActive(false));
</script>

<template>
    <aside class="flex h-full flex-col" :class="desktop ? 'bg-subtle' : 'border-r border-line bg-surface'">
        <RouterLink
            to="/"
            class="flex h-14 shrink-0 items-center gap-2.5 px-4"
            :class="desktop ? '' : 'border-b border-line'"
            @click="emit('navigate')"
        >
            <span class="grid size-9 place-items-center rounded-full bg-surface text-fg shadow-float ring-1 ring-line">
                <Wrench class="size-4" stroke-width="1.75" />
            </span>
            <span class="leading-tight">
                <span class="block font-display text-lg font-semibold text-fg">DevTools</span>
                <span class="block text-[11px] text-fg-subtle">{{ tools.length }} tools · msar.me</span>
            </span>
        </RouterLink>

        <div class="flex shrink-0 items-center gap-2 p-3">
            <button
                v-if="desktop"
                type="button"
                class="flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md bg-bg px-2.5 text-xs text-fg-subtle ring-1 ring-line transition-colors ring-inset hover:text-fg"
                @click="emit('search')"
            >
                <Search class="size-3.5 shrink-0" />
                <span class="truncate">Search tools…</span>
                <span class="ml-auto flex shrink-0 gap-0.5"><span class="kbd">{{ isMac ? "⌘" : "Ctrl" }}</span><span class="kbd">K</span></span>
            </button>
            <div v-else class="relative min-w-0 flex-1">
                <Search class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-subtle" />
                <input v-model="filter" type="search" placeholder="Filter tools…" class="input h-9 pl-8 text-xs shadow-none" />
            </div>
            <button
                type="button"
                class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-fg-subtle ring-1 ring-line ring-inset hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                :class="desktop ? 'bg-bg' : 'bg-subtle hover:bg-surface'"
                :disabled="!!filter"
                :title="allCollapsed ? 'Expand all categories' : 'Collapse all categories'"
                :aria-label="allCollapsed ? 'Expand all categories' : 'Collapse all categories'"
                @click="toggleAll"
            >
                <ChevronsUpDown v-if="allCollapsed" class="size-4" stroke-width="1.75" />
                <ChevronsDownUp v-else class="size-4" stroke-width="1.75" />
            </button>
        </div>

        <nav ref="nav" class="min-h-0 flex-1 overflow-y-auto px-2 pb-6 text-sm">
            <RouterLink
                v-if="!filter"
                to="/"
                class="group mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 font-medium text-fg transition-colors"
                :class="itemHover"
                :exact-active-class="itemActive"
                @click="emit('navigate')"
            >
                <House class="size-4 text-fg-subtle" :class="desktop ? '' : 'group-hover:text-accent'" stroke-width="1.75" /> Home
            </RouterLink>

            <div v-if="!filter && favorites.length" class="mt-3">
                <div class="flex items-center gap-1.5 px-2 pb-1 text-xs font-medium text-fg-subtle">
                    <Star class="size-3" stroke-width="1.75" /> Favorites
                </div>
                <RouterLink
                    v-for="t in favorites"
                    :key="'f-' + t.id"
                    :to="'/' + t.id"
                    class="flex items-center gap-2 rounded-md px-2 py-1.5 text-fg-muted transition-colors"
                    :class="itemHover"
                    :active-class="itemActive"
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
                    @click="toggleGroup(g.id)"
                >
                    <ChevronRight class="size-3 transition-transform" :class="isCollapsed(g.id) && !filter ? '' : 'rotate-90'" />
                    {{ g.name }}
                    <span class="ml-auto font-normal tabular-nums">{{ g.items.length }}</span>
                </button>
                <div v-show="!isCollapsed(g.id) || filter">
                    <RouterLink
                        v-for="t in g.items"
                        :key="t.id"
                        :to="'/' + t.id"
                        :data-tool="t.id"
                        class="flex items-center gap-2 rounded-md px-2 py-1.5 text-fg-muted transition-colors"
                        :class="itemHover"
                        :active-class="itemActive"
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
                class="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg-muted transition-colors"
                :class="itemHover"
                :active-class="itemActive"
                @click="emit('navigate')"
            >
                <Info class="size-4 text-fg-subtle" :class="desktop ? '' : 'group-hover:text-accent'" stroke-width="1.75" /> About
                <span
                    class="ml-auto text-[11px] font-normal tabular-nums text-fg-subtle"
                    :title="BUILD_DATE ? `Built ${new Date(BUILD_DATE).toLocaleString()}` : undefined"
                >
                    v{{ APP_VERSION }}
                </span>
            </RouterLink>
            <button
                v-if="desktop && isDesktopApp"
                type="button"
                class="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg-muted transition-colors"
                :class="itemHover"
                @click="desktopSettingsOpen = true"
            >
                <Settings class="size-4 text-fg-subtle" stroke-width="1.75" /> Settings
            </button>
        </div>
    </aside>
</template>
