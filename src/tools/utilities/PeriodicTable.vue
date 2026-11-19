<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useStorage } from "@vueuse/core";
import { Search, X } from "lucide-vue-next";
import { Panel, Tabs, ToolPage } from "@/components/ui";
import { categories, elements, shells, stateAt, type Category, type Element, type State } from "./elements";

type ColorBy = "category" | "state" | "en" | "mass";
const colorBy = useStorage<ColorBy>("tools:periodic-table:color-by", "category");
const query = ref("");
const temp = ref(298);
const useTemp = ref(false);
const highlight = ref<Category | State | null>(null);
const selected = ref<Element>(elements[0]);
watch(useTemp, (v) => {
    if (v) colorBy.value = "state";
    highlight.value = null;
});
watch(colorBy, () => (highlight.value = null));

const catClass: Record<Category, string> = {
    "alkali metal": "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
    "alkaline earth": "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
    "transition metal": "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    "post-transition metal": "bg-lime-100 text-lime-900 dark:bg-lime-950 dark:text-lime-200",
    metalloid: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
    nonmetal: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
    halogen: "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200",
    "noble gas": "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200",
    lanthanide: "bg-pink-100 text-pink-900 dark:bg-pink-950 dark:text-pink-200",
    actinide: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
};
const stateClass: Record<State, string> = {
    solid: "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100",
    liquid: "bg-sky-200 text-sky-900 dark:bg-sky-900 dark:text-sky-100",
    gas: "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
};

const enRange = [0.7, 4];
const massRange = [1, 294];

function effectiveState(e: Element): State | null {
    return useTemp.value ? stateAt(e, temp.value) : e.state;
}

function cellKey(e: Element): string | null {
    if (colorBy.value === "category") return e.category;
    return effectiveState(e);
}

function heat(v: number | null, [lo, hi]: number[]) {
    if (v == null) return undefined;
    const p = Math.round(8 + ((v - lo) / (hi - lo)) * 82);
    return { background: `color-mix(in oklab, var(--accent) ${p}%, var(--surface))` };
}

function cellStyle(e: Element) {
    if (colorBy.value === "en") return heat(e.en, enRange);
    if (colorBy.value === "mass") return heat(e.mass, massRange);
    return undefined;
}

function cellClass(e: Element) {
    if (colorBy.value === "category") return catClass[e.category];
    if (colorBy.value === "state") {
        const s = effectiveState(e);
        return s ? stateClass[s] : "bg-subtle text-muted";
    }
    const v = colorBy.value === "en" ? e.en : e.mass;
    return v == null ? "bg-subtle text-muted" : "text-fg";
}

const q = computed(() => query.value.trim().toLowerCase());
function matches(e: Element) {
    if (!q.value) return true;
    return e.name.toLowerCase().includes(q.value) || e.symbol.toLowerCase() === q.value || e.symbol.toLowerCase().startsWith(q.value) || String(e.number) === q.value;
}
function dimmed(e: Element) {
    if (!matches(e)) return true;
    if (highlight.value && cellKey(e) !== highlight.value) return true;
    return false;
}
const matchCount = computed(() => (q.value ? elements.filter(matches).length : 0));

interface Cell { e: Element; row: number; col: number }
const cells = computed<Cell[]>(() =>
    elements.map((e) => {
        if (e.group == null) {
            const isLn = e.category === "lanthanide";
            const idx = isLn ? e.number - 57 : e.number - 89;
            return { e, row: isLn ? 9 : 10, col: 3 + idx };
        }
        return { e, row: e.period, col: e.group };
    }),
);

const legend = computed<{ key: Category | State; label: string; cls: string }[]>(() =>
    colorBy.value === "category"
        ? categories.map((c) => ({ key: c, label: c, cls: catClass[c] }))
        : colorBy.value === "state"
          ? (["solid", "liquid", "gas"] as State[]).map((s) => ({ key: s, label: s, cls: stateClass[s] }))
          : [],
);

const shellList = computed(() => shells(selected.value));
const bohrSize = 220;
function electronDots(shellIdx: number, count: number) {
    const r = 22 + shellIdx * 14;
    return Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 - Math.PI / 2;
        return { x: bohrSize / 2 + r * Math.cos(a), y: bohrSize / 2 + r * Math.sin(a) };
    });
}

function fmt(v: number | null, unit = "", dp?: number) {
    if (v == null) return "Unknown";
    return `${dp != null ? v.toFixed(dp) : v} ${unit}`.trim();
}
function celsius(k: number | null) {
    return k == null ? "" : ` (${(k - 273.15).toFixed(1)} °C)`;
}
const sel = computed(() => selected.value);
const detail = computed(() => {
    const e = sel.value;
    const gas = e.state === "gas";
    const predicted = e.number >= 104;
    return [
        ["Atomic number", String(e.number)],
        ["Atomic mass", `${e.mass} u`],
        ["Category", e.category],
        ["Group / period", `${e.group ?? "f-block"} / ${e.period}`],
        ["Electron configuration", e.config],
        ["Electronegativity (Pauling)", fmt(e.en)],
        ["Melting point", e.melt == null ? "Unknown" : `${e.melt} K${celsius(e.melt)}`],
        ["Boiling point", e.boil == null ? "Unknown" : `${e.boil} K${celsius(e.boil)}`],
        ["Density", e.density == null ? "Unknown" : gas ? `${e.density} g/L` : `${e.density} g/cm³`],
        ["State at STP", predicted ? `${e.state} (predicted)` : e.state],
        ["Discovered", e.year == null ? "Ancient times" : String(e.year)],
    ] as [string, string][];
});
const stateNow = computed(() => stateAt(sel.value, temp.value));
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs
                v-model="colorBy"
                :options="[
                    { value: 'category', label: 'Category' },
                    { value: 'state', label: 'State' },
                    { value: 'en', label: 'Electronegativity' },
                    { value: 'mass', label: 'Atomic mass' },
                ]"
            />
        </template>

        <Panel>
            <div class="grid gap-4 sm:grid-cols-2">
                <label class="block">
                    <span class="label">Search</span>
                    <div class="relative">
                        <Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
                        <input v-model="query" class="input pl-9" placeholder="Name, symbol or number" spellcheck="false" />
                        <button v-if="query" type="button" class="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-fg-subtle hover:text-fg" aria-label="Clear" @click="query = ''">
                            <X class="size-4" />
                        </button>
                    </div>
                    <span v-if="q" class="mt-1 block text-xs text-muted">{{ matchCount }} match{{ matchCount === 1 ? "" : "es" }}</span>
                </label>
                <div>
                    <div class="mb-1.5 flex items-center justify-between">
                        <label class="flex cursor-pointer items-center gap-2 text-sm font-medium text-fg">
                            <input v-model="useTemp" type="checkbox" class="checkbox" /> State at temperature
                        </label>
                        <span class="font-mono text-sm tabular-nums" :class="useTemp ? 'text-fg' : 'text-muted'">{{ temp }} K <span class="text-muted">/ {{ (temp - 273.15).toFixed(0) }} °C</span></span>
                    </div>
                    <input v-model.number="temp" type="range" min="0" max="6000" step="1" class="range" :disabled="!useTemp" aria-label="Temperature in kelvin" />
                    <span class="mt-1 block text-xs text-muted">Uses melting and boiling points at 1 atm. Switches colouring to State.</span>
                </div>
            </div>
        </Panel>

        <div class="overflow-x-auto rounded-2xl border border-line bg-surface p-3 shadow-card">
            <div class="grid min-w-[880px] gap-1" style="grid-template-columns: repeat(18, minmax(0, 1fr))">
                <button
                    v-for="c in cells"
                    :key="c.e.number"
                    type="button"
                    class="relative flex aspect-square cursor-pointer flex-col items-center justify-center rounded-md leading-none transition-[opacity,box-shadow,transform] duration-150 hover:scale-105 hover:z-10"
                    :class="[cellClass(c.e), dimmed(c.e) ? 'opacity-20' : '', selected.number === c.e.number ? 'ring-2 ring-accent' : 'ring-1 ring-black/5 dark:ring-white/10']"
                    :style="{ gridRow: c.row, gridColumn: c.col, ...cellStyle(c.e) }"
                    :title="`${c.e.name} (${c.e.number})`"
                    @click="selected = c.e"
                >
                    <span class="absolute top-0.5 left-1 text-[9px] opacity-70">{{ c.e.number }}</span>
                    <span class="text-sm font-semibold">{{ c.e.symbol }}</span>
                    <span class="mt-0.5 hidden max-w-full truncate px-0.5 text-[8px] opacity-80 xl:block">{{ c.e.name }}</span>
                </button>
                <div class="flex aspect-square items-center justify-center rounded-md bg-pink-50 text-[9px] text-pink-900 ring-1 ring-pink-200 dark:bg-pink-950/40 dark:text-pink-200 dark:ring-pink-900" style="grid-row: 6; grid-column: 3">57–71</div>
                <div class="flex aspect-square items-center justify-center rounded-md bg-rose-50 text-[9px] text-rose-900 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900" style="grid-row: 7; grid-column: 3">89–103</div>
                <div class="self-center text-right text-[10px] text-muted" style="grid-row: 9; grid-column: 1 / 3">Lanthanides</div>
                <div class="self-center text-right text-[10px] text-muted" style="grid-row: 10; grid-column: 1 / 3">Actinides</div>
                <div v-if="colorBy === 'en' || colorBy === 'mass'" class="flex items-center gap-2 text-[10px] text-muted" style="grid-row: 1; grid-column: 4 / 13">
                    <span>{{ colorBy === "en" ? enRange[0] : massRange[0] }}</span>
                    <span class="h-2 flex-1 rounded-full" style="background: linear-gradient(to right, color-mix(in oklab, var(--accent) 8%, var(--surface)), var(--accent))" />
                    <span>{{ colorBy === "en" ? enRange[1] : massRange[1] }}</span>
                    <span>{{ colorBy === "en" ? "Pauling" : "u" }}</span>
                </div>
            </div>
        </div>

        <div v-if="legend.length" class="flex flex-wrap items-center gap-1.5">
            <button
                v-for="l in legend"
                :key="l.key"
                type="button"
                class="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs capitalize ring-1 transition-opacity"
                :class="[l.cls, highlight === l.key ? 'ring-2 ring-accent' : 'ring-black/10 dark:ring-white/10', highlight && highlight !== l.key ? 'opacity-50' : '']"
                @click="highlight = highlight === l.key ? null : l.key"
            >
                {{ l.label }}
            </button>
            <button v-if="highlight" type="button" class="cursor-pointer text-xs text-accent hover:underline" @click="highlight = null">Clear</button>
        </div>
        <p v-else class="text-xs text-muted">Grey cells have no data.</p>

        <Panel :title="`${sel.name} (${sel.symbol})`">
            <div class="grid gap-6 md:grid-cols-[1fr_240px]">
                <dl class="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    <div v-for="[k, v] in detail" :key="k" class="min-w-0 border-b border-line pb-1.5">
                        <dt class="text-xs text-muted">{{ k }}</dt>
                        <dd class="font-medium break-words capitalize-first" :class="k === 'Electron configuration' ? 'font-mono' : ''">{{ v }}</dd>
                    </div>
                    <div v-if="useTemp" class="min-w-0 border-b border-line pb-1.5 sm:col-span-2">
                        <dt class="text-xs text-muted">State at {{ temp }} K</dt>
                        <dd class="font-medium">{{ stateNow ?? "Unknown (no melting/boiling data)" }}</dd>
                    </div>
                </dl>
                <div class="flex flex-col items-center gap-2">
                    <svg :viewBox="`0 0 ${bohrSize} ${bohrSize}`" class="w-full max-w-[240px]" role="img" :aria-label="`Bohr model of ${sel.name}`">
                        <circle v-for="(_, i) in shellList" :key="'r' + i" :cx="bohrSize / 2" :cy="bohrSize / 2" :r="22 + i * 14" fill="none" stroke="var(--line)" stroke-width="1" />
                        <circle :cx="bohrSize / 2" :cy="bohrSize / 2" r="12" fill="var(--accent)" />
                        <text :x="bohrSize / 2" :y="bohrSize / 2 + 3.5" text-anchor="middle" font-size="9" font-weight="600" fill="var(--accent-fg)">{{ sel.number }}+</text>
                        <template v-for="(n, i) in shellList" :key="'s' + i">
                            <circle v-for="(d, j) in electronDots(i, n)" :key="j" :cx="d.x" :cy="d.y" r="2.6" fill="var(--accent-strong)" />
                        </template>
                    </svg>
                    <p class="font-mono text-xs text-muted">Shells: {{ shellList.join(", ") }}</p>
                </div>
            </div>
        </Panel>
    </ToolPage>
</template>

<style scoped>
.capitalize-first::first-letter {
    text-transform: uppercase;
}
</style>
