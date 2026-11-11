<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { ArrowRight, Clock, Search, Star } from "lucide-vue-next";
import { categories, searchTools, tools, type CategoryId, type ToolDef } from "@/tools/registry";
import { favorites, isFavorite, recents, toggleFavorite } from "@/composables/prefs";

const route = useRoute();
// ?q= comes from the OpenSearch description, so the browser's address bar can search tools.
const query = ref(typeof route.query.q === "string" ? route.query.q : "");
watch(() => route.query.q, (q) => typeof q === "string" && (query.value = q));
const activeCat = ref<CategoryId | "all">("all");

const filtered = computed(() => {
    const list = searchTools(query.value);
    return activeCat.value === "all" ? list : list.filter((t) => t.category === activeCat.value);
});
const groups = computed(() =>
    categories
        .map((c) => ({ ...c, items: filtered.value.filter((t) => t.category === c.id) }))
        .filter((g) => g.items.length),
);
const showPersonal = computed(() => !query.value && activeCat.value === "all");

function star(t: ToolDef) {
    toggleFavorite(t.id);
}
</script>

<template>
    <div class="space-y-14">
        <!-- Hero -->
        <section class="rounded-2xl border border-line bg-surface px-6 py-10 shadow-card sm:px-10 sm:py-14">
            <div class="max-w-2xl">
                <p class="mb-5 text-sm text-fg-subtle">{{ tools.length }} tools · runs entirely in your browser</p>
                <h1 class="font-display text-4xl leading-10 font-semibold text-fg sm:text-5xl sm:leading-14">
                    <span class="text-accent">Developer tools.</span> Format, convert and inspect without leaving the tab.
                </h1>
                <p class="mt-5 text-base leading-7 text-fg-muted">
                    No sign-ups, no servers, no tracking. Your data stays on your machine, and every tool keeps working offline once the page has loaded.
                </p>
                <div class="relative mt-8 max-w-lg">
                    <Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" stroke-width="1.75" />
                    <input v-model="query" type="search" aria-label="Search tools" placeholder="Search tools: json, hash, cron, color…" class="input h-11 pl-9 text-base" />
                </div>
                <p class="mt-4 text-sm text-fg-subtle">
                    Press <span class="kbd">/</span> anywhere to search. Tools you open stay in tabs, so you can switch between them without losing input.
                </p>
            </div>
        </section>

        <!-- Favorites & recents -->
        <div v-if="showPersonal && (favorites.length || recents.length)" class="grid gap-10 lg:grid-cols-2">
            <section v-if="favorites.length">
                <h2 class="mb-4 flex items-center gap-2 text-sm font-semibold text-fg"><Star class="size-4 text-fg-subtle" stroke-width="1.75" /> Favorites</h2>
                <div class="flex flex-wrap gap-2">
                    <RouterLink v-for="t in favorites" :key="t.id" :to="'/' + t.id" class="flex items-center gap-2 rounded-md bg-subtle px-3 py-2 text-sm font-medium text-fg ring-1 ring-line ring-inset transition-colors hover:bg-surface hover:text-accent">
                        <component :is="t.icon" class="size-4" stroke-width="1.75" /> {{ t.name }}
                    </RouterLink>
                </div>
            </section>
            <section v-if="recents.length">
                <h2 class="mb-4 flex items-center gap-2 text-sm font-semibold text-fg"><Clock class="size-4 text-fg-subtle" stroke-width="1.75" /> Recently used</h2>
                <div class="flex flex-wrap gap-2">
                    <RouterLink v-for="t in recents.slice(0, 6)" :key="t.id" :to="'/' + t.id" class="flex items-center gap-2 rounded-md bg-subtle px-3 py-2 text-sm font-medium text-fg ring-1 ring-line ring-inset transition-colors hover:bg-surface hover:text-accent">
                        <component :is="t.icon" class="size-4" stroke-width="1.75" /> {{ t.name }}
                    </RouterLink>
                </div>
            </section>
        </div>

        <!-- Category filter -->
        <div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by category">
            <button
                type="button"
                class="shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium transition-[transform,color,background-color] duration-150 active:scale-[0.97]"
                :class="activeCat === 'all' ? 'bg-inverse text-inverse-fg' : 'bg-surface text-fg ring-1 ring-line hover:text-accent'"
                :aria-pressed="activeCat === 'all'"
                @click="activeCat = 'all'"
            >
                All
            </button>
            <button
                v-for="c in categories"
                :key="c.id"
                type="button"
                class="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-[transform,color,background-color] duration-150 active:scale-[0.97]"
                :class="activeCat === c.id ? 'bg-inverse text-inverse-fg' : 'bg-surface text-fg ring-1 ring-line hover:text-accent'"
                :aria-pressed="activeCat === c.id"
                @click="activeCat = c.id"
            >
                <component :is="c.icon" class="size-3.5" stroke-width="1.75" /> {{ c.name }}
            </button>
        </div>

        <!-- Tools -->
        <section v-for="g in groups" :key="g.id">
            <h2 class="mb-5 flex items-baseline gap-3 font-display text-3xl font-semibold text-fg">
                {{ g.name }}
                <span class="font-sans text-sm font-normal text-fg-subtle">{{ g.items.length }} tools</span>
            </h2>
            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                <div v-for="t in g.items" :key="t.id" class="group relative">
                <RouterLink
                    :to="'/' + t.id"
                    class="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-card transition-colors"
                >
                    <span class="flex items-center gap-3">
                        <span class="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-fg-subtle ring-1 ring-line transition-colors group-hover:text-accent">
                            <component :is="t.icon" class="size-4" stroke-width="1.5" />
                        </span>
                        <span class="min-w-0 pr-6 text-base leading-7 font-semibold tracking-tight text-fg transition-colors group-hover:text-accent">{{ t.name }}</span>
                    </span>
                    <span class="mt-3 line-clamp-2 text-sm leading-6 text-fg-muted">{{ t.description }}</span>
                    <span class="mt-4 flex items-center gap-2 text-xs text-fg-subtle">
                        <span v-if="t.isNew" class="rounded-sm bg-accent-soft px-1.5 py-px font-medium text-accent-strong dark:text-accent">New</span>
                        <span class="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">Open <ArrowRight class="size-3" /></span>
                    </span>
                </RouterLink>
                <button
                    type="button"
                    class="absolute top-4 right-4 cursor-pointer rounded-full p-1.5 transition"
                    :class="isFavorite(t.id) ? 'text-accent' : 'text-fg-subtle opacity-0 group-hover:opacity-100 hover:text-accent focus-visible:opacity-100'"
                    :aria-label="isFavorite(t.id) ? 'Remove from favorites' : 'Add to favorites'"
                    @click="star(t)"
                >
                    <Star class="size-4" stroke-width="1.75" :fill="isFavorite(t.id) ? 'currentColor' : 'none'" />
                </button>
                </div>
            </div>
        </section>

        <div v-if="!groups.length" class="rounded-2xl border border-dashed border-line bg-surface py-16 text-center text-sm text-fg-subtle">
            No tools match “{{ query }}”.
        </div>
    </div>
</template>
