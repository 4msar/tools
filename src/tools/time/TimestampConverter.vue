<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { Plus, X } from "lucide-vue-next";
import { Btn, CopyButton, Notice, Panel, Tabs, ToolPage } from "@/components/ui";

const nowMs = ref(Date.now());
let timer: number | undefined;
onMounted(() => {
    timer = window.setInterval(() => (nowMs.value = Date.now()), 100);
});
onUnmounted(() => window.clearInterval(timer));

type Unit = "auto" | "s" | "ms" | "us" | "ns";
const unit = ref<Unit>("auto");
const input = ref("now");

const zones: string[] = (() => {
    try {
        return Intl.supportedValuesOf("timeZone");
    } catch {
        return ["UTC"];
    }
})();
const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const extraZones = ref<string[]>(["America/New_York", "Europe/London", "Asia/Tokyo", "Asia/Dhaka"]);
const newZone = ref("");

const unitAlias: Record<string, "ms" | "s" | "min" | "h" | "d" | "w" | "mo" | "y"> = {
    ms: "ms", msec: "ms", millisecond: "ms", milliseconds: "ms",
    s: "s", sec: "s", secs: "s", second: "s", seconds: "s",
    m: "min", min: "min", mins: "min", minute: "min", minutes: "min",
    h: "h", hr: "h", hrs: "h", hour: "h", hours: "h",
    d: "d", day: "d", days: "d",
    w: "w", wk: "w", week: "w", weeks: "w",
    mo: "mo", month: "mo", months: "mo",
    y: "y", yr: "y", year: "y", years: "y",
};
const unitMs = { ms: 1, s: 1e3, min: 6e4, h: 36e5, d: 864e5, w: 6048e5 } as const;

function applyOffset(base: number, sign: 1 | -1, rest: string): number | string {
    let t = base;
    let consumed = rest;
    const re = /(\d+(?:\.\d+)?)\s*([a-z]+)/gi;
    let m: RegExpExecArray | null;
    let any = false;
    while ((m = re.exec(rest))) {
        const key = unitAlias[m[2].toLowerCase()];
        if (!key) return `Unknown unit "${m[2]}"`;
        const n = parseFloat(m[1]) * sign;
        any = true;
        if (key === "y" || key === "mo") {
            const d = new Date(t);
            d.setUTCMonth(d.getUTCMonth() + Math.trunc(key === "y" ? n * 12 : n));
            t = d.getTime();
        } else t += n * unitMs[key];
    }
    consumed = rest.replace(re, "").replace(/[\s,]|and/gi, "");
    if (!any || consumed) return "Could not read the offset (try 1d, 2h30m, 3 weeks)";
    return t;
}

const parsed = computed<{ ms: number; note: string } | { error: string } | null>(() => {
    const raw = input.value.trim();
    if (!raw) return null;
    const rel = /^now\s*(?:([+-])\s*(.+))?$/i.exec(raw);
    if (rel) {
        if (!rel[1]) return { ms: nowMs.value, note: "Current time" };
        const r = applyOffset(nowMs.value, rel[1] === "+" ? 1 : -1, rel[2]);
        return typeof r === "string" ? { error: r } : { ms: r, note: "Relative to now" };
    }
    if (/^[+-]?\d+(\.\d+)?$/.test(raw)) {
        const digits = raw.replace(/^[+-]/, "").split(".")[0].length;
        let u: Exclude<Unit, "auto"> = "s";
        if (unit.value === "auto") u = digits <= 11 ? "s" : digits <= 14 ? "ms" : digits <= 17 ? "us" : "ns";
        else u = unit.value;
        const div = { s: 1e-3, ms: 1, us: 1e3, ns: 1e6 }[u];
        const ms = Number(raw) / div;
        const label = { s: "seconds", ms: "milliseconds", us: "microseconds", ns: "nanoseconds" }[u];
        if (!Number.isFinite(ms) || Math.abs(ms) > 8.64e15) return { error: "Timestamp is out of range." };
        return { ms: Math.round(ms), note: `Interpreted as ${label}${unit.value === "auto" ? ` (${digits} digits)` : ""}` };
    }
    const t = Date.parse(raw);
    if (Number.isNaN(t)) return { error: "Could not parse. Try a Unix timestamp, ISO 8601, RFC 2822, or now - 1d." };
    return { ms: t, note: "Parsed as a date string" };
});

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
    return `UTC${min < 0 ? "-" : "+"}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}
function abbr(ms: number, tz: string) {
    const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" });
    return f.formatToParts(new Date(ms)).find((p) => p.type === "timeZoneName")?.value ?? "";
}
function fmtZone(ms: number, tz: string) {
    return new Intl.DateTimeFormat("sv-SE", {
        timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).format(new Date(ms));
}

function relative(ms: number) {
    const diff = (ms - nowMs.value) / 1000;
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const steps: [number, Intl.RelativeTimeFormatUnit][] = [[60, "second"], [3600, "minute"], [86400, "hour"], [2592000, "day"], [31557600, "month"], [Infinity, "year"]];
    const divs = [1, 60, 3600, 86400, 2592000, 31557600];
    const a = Math.abs(diff);
    for (let i = 0; i < steps.length; i++) {
        if (a < steps[i][0]) return rtf.format(Math.trunc(diff / divs[i]), steps[i][1]);
    }
    return "";
}

function dayOfYear(ms: number) {
    const d = new Date(ms);
    return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5);
}
function isoWeek(ms: number) {
    const d = new Date(ms);
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = Date.UTC(t.getUTCFullYear(), 0, 1);
    return `${t.getUTCFullYear()}-W${String(Math.ceil(((t.getTime() - y0) / 864e5 + 1) / 7)).padStart(2, "0")}`;
}

const rows = computed(() => {
    const p = parsed.value;
    if (!p || "error" in p) return [];
    const d = new Date(p.ms);
    return [
        { label: "ISO 8601 (UTC)", value: d.toISOString() },
        { label: `Local (${localTz})`, value: new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "long" }).format(d) },
        { label: "RFC 2822", value: d.toUTCString().replace("GMT", "+0000") },
        { label: "Relative", value: relative(p.ms) },
        { label: "Unix (seconds)", value: String(Math.floor(p.ms / 1000)) },
        { label: "Unix (milliseconds)", value: String(p.ms) },
        { label: "Day of year (UTC)", value: String(dayOfYear(p.ms)) },
        { label: "ISO week (UTC)", value: isoWeek(p.ms) },
    ];
});

const zoneRows = computed(() => {
    const p = parsed.value;
    if (!p || "error" in p) return [];
    return extraZones.value.map((tz) => ({
        tz, time: fmtZone(p.ms, tz), abbr: abbr(p.ms, tz), offset: fmtOffset(offsetMin(p.ms, tz)),
    }));
});

function addZone() {
    const z = newZone.value.trim();
    if (!z || !zones.includes(z) || extraZones.value.includes(z)) return;
    extraZones.value.push(z);
    newZone.value = "";
}

const examples = [
    { label: "Now", v: "now" },
    { label: "Yesterday", v: "now - 1d" },
    { label: "In 2h30m", v: "now + 2h30m" },
    { label: "ISO", v: "2024-03-05T14:30:00Z" },
    { label: "RFC 2822", v: "Tue, 05 Mar 2024 14:30:00 +0000" },
    { label: "Milliseconds", v: "1709649000000" },
];
const unitOptions = [
    { value: "auto", label: "Auto" }, { value: "s", label: "s" }, { value: "ms", label: "ms" },
    { value: "us", label: "µs" }, { value: "ns", label: "ns" },
] as const;
</script>

<template>
    <ToolPage>
        <div class="grid gap-3 sm:grid-cols-2">
            <div class="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface p-4 shadow-xs">
                <div class="min-w-0">
                    <div class="label !mb-1">Current Unix time (seconds)</div>
                    <div class="font-mono text-2xl font-semibold tabular-nums">{{ Math.floor(nowMs / 1000) }}</div>
                </div>
                <CopyButton :text="String(Math.floor(nowMs / 1000))" icon-only />
            </div>
            <div class="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface p-4 shadow-xs">
                <div class="min-w-0">
                    <div class="label !mb-1">Current Unix time (milliseconds)</div>
                    <div class="font-mono text-2xl font-semibold tabular-nums">{{ nowMs }}</div>
                </div>
                <CopyButton :text="String(nowMs)" icon-only />
            </div>
        </div>

        <Panel title="Input">
            <div class="flex flex-col gap-3">
                <input v-model="input" class="input font-mono" spellcheck="false" placeholder="1709649000, 2024-03-05T14:30:00Z, now - 1d, now + 2h30m" aria-label="Timestamp or date" />
                <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs text-muted">Numeric unit</span>
                    <Tabs v-model="unit" :options="[...unitOptions]" size="sm" />
                    <span class="ml-auto flex flex-wrap gap-1.5">
                        <button v-for="e in examples" :key="e.label" type="button" class="chip cursor-pointer hover:border-line-strong hover:text-fg" @click="input = e.v">{{ e.label }}</button>
                    </span>
                </div>
                <Notice v-if="parsed && 'error' in parsed" type="error">{{ parsed.error }}</Notice>
                <p v-else-if="parsed" class="text-xs text-muted">{{ parsed.note }}</p>
            </div>
        </Panel>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="Formats" flush>
                <p v-if="!rows.length" class="p-4 text-sm text-muted">Enter a timestamp or date above.</p>
                <ul v-else class="divide-y divide-line">
                    <li v-for="r in rows" :key="r.label" class="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div class="min-w-0">
                            <div class="text-xs text-muted">{{ r.label }}</div>
                            <div class="font-mono text-sm break-words">{{ r.value }}</div>
                        </div>
                        <CopyButton :text="r.value" icon-only />
                    </li>
                </ul>
            </Panel>

            <Panel title="Other time zones" flush>
                <div class="flex gap-2 border-b border-line p-3">
                    <input v-model="newZone" list="ts-zones" class="input" placeholder="Add a zone, e.g. Europe/Paris" aria-label="Add time zone" @keydown.enter="addZone" />
                    <datalist id="ts-zones"><option v-for="z in zones" :key="z" :value="z" /></datalist>
                    <Btn @click="addZone"><Plus /> Add</Btn>
                </div>
                <p v-if="!zoneRows.length" class="p-4 text-sm text-muted">Nothing to show.</p>
                <ul v-else class="divide-y divide-line">
                    <li v-for="z in zoneRows" :key="z.tz" class="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div class="min-w-0">
                            <div class="text-xs text-muted">{{ z.tz }} · {{ z.abbr }} · {{ z.offset }}</div>
                            <div class="font-mono text-sm">{{ z.time }}</div>
                        </div>
                        <div class="flex shrink-0 items-center">
                            <CopyButton :text="z.time" icon-only />
                            <Btn size="sm" variant="ghost" :title="`Remove ${z.tz}`" @click="extraZones = extraZones.filter((x) => x !== z.tz)"><X /></Btn>
                        </div>
                    </li>
                </ul>
            </Panel>
        </div>
    </ToolPage>
</template>
