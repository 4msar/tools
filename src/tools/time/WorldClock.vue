<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref } from "vue";
import { useStorage } from "@vueuse/core";
import { ArrowDown, ArrowUp, Moon, Plus, Sun, X } from "lucide-vue-next";
import { Btn, CopyButton, Field, Panel, Tabs, ToolPage } from "@/components/ui";

interface Zone { tz: string; label: string }

const supported: string[] = (() => {
    try { return Intl.supportedValuesOf("timeZone"); } catch { return ["UTC"]; }
})();
const allZones = supported.includes("UTC") ? supported : ["UTC", ...supported];
const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

function city(tz: string) {
    return (tz.split("/").pop() ?? tz).replace(/_/g, " ");
}
function parts(ms: number, tz: string) {
    const f = new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
        hour: "numeric", minute: "numeric", second: "numeric",
    });
    const o: Record<string, number> = {};
    for (const p of f.formatToParts(new Date(ms))) if (p.type !== "literal") o[p.type] = Number(p.value);
    return o;
}
function offsetMin(ms: number, tz: string) {
    const p = parts(ms, tz);
    return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000) / 60000;
}
function fmtOffset(min: number) {
    const a = Math.abs(min);
    const m = a % 60;
    return `UTC${min < 0 ? "-" : "+"}${Math.floor(a / 60)}${m ? ":" + String(m).padStart(2, "0") : ""}`;
}
function fmtDiff(min: number) {
    if (min === 0) return "same time";
    const a = Math.abs(min);
    const m = a % 60;
    return `${min < 0 ? "-" : "+"}${Math.floor(a / 60)}h${m ? String(m).padStart(2, "0") : ""}`;
}
function abbr(ms: number, tz: string) {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
        .formatToParts(new Date(ms)).find((p) => p.type === "timeZoneName")?.value ?? "";
}
function zonedToUtc(wall: number, tz: string) {
    const utc = wall - offsetMin(wall, tz) * 60000;
    return wall - offsetMin(utc, tz) * 60000;
}

const defaults: Zone[] = [
    { tz: localTz, label: "" },
    ...["UTC", "America/New_York", "Europe/London", "Asia/Tokyo"].filter((z) => z !== localTz).map((tz) => ({ tz, label: "" })),
];
const zones = useStorage<Zone[]>("tools:world-clock:zones", defaults);
const hour12 = useStorage("tools:world-clock:12h", false);
const mode = ref<"clocks" | "planner">("clocks");
const workStart = useStorage("tools:world-clock:work-start", 9);
const workEnd = useStorage("tools:world-clock:work-end", 17);

const search = ref("");
const customLabel = ref("");
const selected = ref("");
const filtered = computed(() => {
    const q = search.value.trim().toLowerCase().replace(/\s+/g, "_");
    const list = q ? allZones.filter((z) => z.toLowerCase().includes(q)) : allZones;
    return list.slice(0, 300);
});
function addZone() {
    const tz = selected.value || (allZones.includes(search.value.trim()) ? search.value.trim() : "");
    if (!tz) return;
    zones.value = [...zones.value, { tz, label: customLabel.value.trim() }];
    customLabel.value = "";
    selected.value = "";
    search.value = "";
}
function removeZone(i: number) {
    zones.value = zones.value.filter((_, idx) => idx !== i);
}
function move(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= zones.value.length) return;
    const a = [...zones.value];
    [a[i], a[j]] = [a[j], a[i]];
    zones.value = a;
}
const name = (z: Zone) => z.label || city(z.tz);

// Ticking
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
function start() {
    stop();
    now.value = Date.now();
    timer = setInterval(() => (now.value = Date.now()), 1000);
}
function stop() {
    if (timer) clearInterval(timer);
    timer = undefined;
}
start();
onActivated(start);
onDeactivated(stop);
onBeforeUnmount(stop);

const z2 = (n: number) => String(n).padStart(2, "0");
const localOff = computed(() => offsetMin(now.value, localTz));

const cards = computed(() => zones.value.map((z) => {
    const p = parts(now.value, z.tz);
    const off = offsetMin(now.value, z.tz);
    const h = p.hour;
    const time = hour12.value
        ? `${h % 12 || 12}:${z2(p.minute)}:${z2(p.second)} ${h < 12 ? "AM" : "PM"}`
        : `${z2(h)}:${z2(p.minute)}:${z2(p.second)}`;
    return {
        z,
        time,
        date: new Intl.DateTimeFormat("en-US", { timeZone: z.tz, weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(now.value)),
        offset: fmtOffset(off),
        abbr: abbr(now.value, z.tz),
        diff: fmtDiff(off - localOff.value),
        day: h >= 6 && h < 18,
        hAngle: ((h % 12) + p.minute / 60) * 30,
        mAngle: (p.minute + p.second / 60) * 6,
        sAngle: p.second * 6,
    };
}));

// Planner
const date = ref(new Date().toISOString().slice(0, 10));
const picked = ref<number | null>(null);
const hover = ref<number | null>(null);
const active = computed(() => hover.value ?? picked.value);

const columns = computed(() => {
    const base = zones.value[0];
    if (!base) return [];
    const [y, m, d] = date.value.split("-").map(Number);
    if (!y) return [];
    return Array.from({ length: 24 }, (_, h) => zonedToUtc(Date.UTC(y, m - 1, d, h), base.tz));
});
type Kind = "work" | "edge" | "night";
function kindOf(frac: number): Kind {
    if (frac >= workStart.value && frac < workEnd.value) return "work";
    if (frac >= 7 && frac < 22) return "edge";
    return "night";
}
const rows = computed(() => zones.value.map((z) => ({
    z,
    cells: columns.value.map((ms) => {
        const p = parts(ms, z.tz);
        const frac = p.hour + p.minute / 60;
        const off = offsetMin(ms, z.tz);
        return { h: p.hour, min: p.minute, kind: kindOf(frac), odd: off % 60 !== 0, newDay: p.hour === 0 };
    }),
})));
const best = computed(() => columns.value.map((_, i) => rows.value.length > 0 && rows.value.every((r) => r.cells[i].kind === "work")));
const bestCount = computed(() => best.value.filter(Boolean).length);

function fmtHM(h: number, m: number) {
    if (hour12.value) return `${h % 12 || 12}:${z2(m)} ${h < 12 ? "AM" : "PM"}`;
    return `${z2(h)}:${z2(m)}`;
}
const summaryRows = computed(() => {
    const i = active.value;
    if (i == null || !columns.value[i]) return [];
    return zones.value.map((z) => {
        const ms = columns.value[i];
        const p = parts(ms, z.tz);
        const wd = new Intl.DateTimeFormat("en-US", { timeZone: z.tz, weekday: "short" }).format(new Date(ms));
        return { name: name(z), wd, time: fmtHM(p.hour, p.minute), date: new Intl.DateTimeFormat("en-US", { timeZone: z.tz, month: "short", day: "numeric" }).format(new Date(ms)) };
    });
});
const summaryText = computed(() => {
    const r = summaryRows.value;
    if (!r.length) return "";
    return `${r[0].wd} ${r.map((x) => `${x.time} ${x.name}`).join(" / ")}`;
});

const cellClass: Record<Kind, string> = {
    work: "bg-accent text-white",
    edge: "bg-accent-soft text-fg",
    night: "bg-subtle text-muted",
};
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="mode" size="sm" :options="[{ value: 'clocks', label: 'Clocks' }, { value: 'planner', label: 'Meeting planner' }]" />
        </template>

        <div class="space-y-4">
            <Panel title="Time zones">
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="hour12 = !hour12">{{ hour12 ? "12-hour" : "24-hour" }}</Btn>
                </template>
                <div class="grid gap-3 p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                    <Field label="Search">
                        <input v-model="search" class="input" placeholder="e.g. Kolkata, Berlin…" />
                    </Field>
                    <Field label="Zone">
                        <select v-model="selected" class="select">
                            <option value="" disabled>Select a zone ({{ filtered.length }})</option>
                            <option v-for="z in filtered" :key="z" :value="z">{{ city(z) }} — {{ z }}</option>
                        </select>
                    </Field>
                    <Field label="Custom label (optional)">
                        <input v-model="customLabel" class="input" placeholder="e.g. Office" @keydown.enter="addZone" />
                    </Field>
                    <Btn :disabled="!selected" @click="addZone"><Plus /> Add</Btn>
                </div>
            </Panel>

            <div v-if="!zones.length" class="text-sm text-muted">No zones yet. Add one above.</div>

            <div v-else-if="mode === 'clocks'" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div v-for="(c, i) in cards" :key="c.z.tz + i" class="rounded-lg border border-line bg-surface p-4">
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                            <div class="flex items-center gap-1.5 text-sm font-semibold text-fg">
                                <Sun v-if="c.day" class="size-4 shrink-0 text-accent" />
                                <Moon v-else class="size-4 shrink-0 text-muted" />
                                <span class="truncate">{{ name(c.z) }}</span>
                            </div>
                            <div class="truncate text-xs text-muted">{{ c.z.tz }}</div>
                        </div>
                        <div class="flex shrink-0">
                            <Btn size="sm" variant="ghost" :disabled="i === 0" title="Move up" @click="move(i, -1)"><ArrowUp /></Btn>
                            <Btn size="sm" variant="ghost" :disabled="i === cards.length - 1" title="Move down" @click="move(i, 1)"><ArrowDown /></Btn>
                            <Btn size="sm" variant="ghost" title="Remove" @click="removeZone(i)"><X /></Btn>
                        </div>
                    </div>
                    <div class="mt-3 flex items-center gap-4">
                        <svg viewBox="-50 -50 100 100" class="size-20 shrink-0 text-fg" aria-hidden="true">
                            <circle r="47" class="fill-subtle stroke-line" stroke-width="2" />
                            <line v-for="n in 12" :key="n" :x1="0" :y1="-42" :x2="0" :y2="n % 3 === 0 ? -36 : -39" stroke="currentColor" stroke-width="2" :transform="`rotate(${n * 30})`" />
                            <line x1="0" y1="0" x2="0" y2="-24" stroke="currentColor" stroke-width="4" stroke-linecap="round" :transform="`rotate(${c.hAngle})`" />
                            <line x1="0" y1="0" x2="0" y2="-36" stroke="currentColor" stroke-width="3" stroke-linecap="round" :transform="`rotate(${c.mAngle})`" />
                            <line x1="0" y1="6" x2="0" y2="-38" class="stroke-accent" stroke-width="1.5" stroke-linecap="round" :transform="`rotate(${c.sAngle})`" />
                            <circle r="3" class="fill-accent" />
                        </svg>
                        <div class="min-w-0">
                            <div class="font-mono text-2xl font-semibold tabular-nums text-fg">{{ c.time }}</div>
                            <div class="text-sm text-muted">{{ c.date }}</div>
                        </div>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-1.5">
                        <span class="chip">{{ c.offset }}</span>
                        <span class="chip">{{ c.abbr }}</span>
                        <span class="chip">{{ c.diff }}</span>
                    </div>
                </div>
            </div>

            <Panel v-else title="Meeting planner">
                <div class="space-y-4 p-3">
                    <div class="grid gap-3 sm:grid-cols-3">
                        <Field label="Date"><input v-model="date" type="date" class="input" /></Field>
                        <Field label="Work starts"><select v-model.number="workStart" class="select"><option v-for="h in 24" :key="h" :value="h - 1">{{ z2(h - 1) }}:00</option></select></Field>
                        <Field label="Work ends"><select v-model.number="workEnd" class="select"><option v-for="h in 24" :key="h" :value="h">{{ z2(h) }}:00</option></select></Field>
                    </div>
                    <div class="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span class="chip"><span class="size-2.5 rounded-sm bg-accent" /> Working</span>
                        <span class="chip"><span class="size-2.5 rounded-sm bg-accent-soft ring-1 ring-line" /> Early / late</span>
                        <span class="chip"><span class="size-2.5 rounded-sm bg-subtle ring-1 ring-line" /> Night</span>
                        <span class="chip"><span class="size-2.5 rounded-sm ring-2 ring-accent" /> Everyone working ({{ bestCount }})</span>
                        <span>Columns follow the first zone's local hours.</span>
                    </div>

                    <div class="overflow-x-auto" @mouseleave="hover = null">
                        <div class="min-w-[56rem]">
                            <div v-for="(r, ri) in rows" :key="r.z.tz + ri" class="mb-1.5 flex items-center gap-2">
                                <div class="w-28 shrink-0 truncate text-xs font-medium text-fg" :title="r.z.tz">{{ name(r.z) }}</div>
                                <div class="grid flex-1 grid-cols-24 gap-px" style="grid-template-columns: repeat(24, minmax(0, 1fr))">
                                    <button
                                        v-for="(c, i) in r.cells"
                                        :key="i"
                                        type="button"
                                        class="flex h-9 flex-col items-center justify-center rounded-sm font-mono text-[10px] leading-tight transition-colors"
                                        :class="[
                                            cellClass[c.kind],
                                            best[i] ? 'ring-2 ring-accent ring-offset-1 ring-offset-surface' : '',
                                            active === i ? 'outline-2 outline-fg' : '',
                                            active !== null && active !== i ? 'opacity-70' : '',
                                        ]"
                                        :style="active === i ? 'outline-style:solid;outline-offset:1px' : ''"
                                        @mouseenter="hover = i"
                                        @click="picked = picked === i ? null : i"
                                    >
                                        <span>{{ c.odd ? `${c.h}:${z2(c.min)}` : c.h }}</span>
                                        <span v-if="c.newDay" class="text-[8px] opacity-80">new day</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="rounded-md border border-line bg-subtle p-3">
                        <template v-if="summaryRows.length">
                            <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <div class="text-sm font-semibold text-fg">{{ picked !== null && hover === null ? "Selected time" : "Hovered time" }}</div>
                                <CopyButton :text="summaryText" label="Copy summary" />
                            </div>
                            <ul class="grid gap-1 text-sm sm:grid-cols-2">
                                <li v-for="s in summaryRows" :key="s.name" class="flex justify-between gap-2">
                                    <span class="text-muted">{{ s.name }}</span>
                                    <span class="font-mono text-fg">{{ s.wd }} {{ s.date }}, {{ s.time }}</span>
                                </li>
                            </ul>
                            <p class="mt-2 break-words font-mono text-xs text-muted">{{ summaryText }}</p>
                        </template>
                        <p v-else class="text-sm text-muted">Hover or click a column to see the time in every zone.</p>
                    </div>
                </div>
            </Panel>
        </div>
    </ToolPage>
</template>
