<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { toString as cronToString } from "cronstrue";
import { CronExpressionParser } from "cron-parser";
import { Btn, CopyButton, Notice, Panel, ToolPage } from "@/components/ui";

const expr = ref("*/15 9-17 * * 1-5");
const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const tz = ref("local");
const zones: string[] = (() => {
    try {
        return Intl.supportedValuesOf("timeZone");
    } catch {
        return [];
    }
})();

const presets = [
    { label: "Every minute", v: "* * * * *" },
    { label: "Every 5 minutes", v: "*/5 * * * *" },
    { label: "Hourly", v: "0 * * * *" },
    { label: "Daily at midnight", v: "0 0 * * *" },
    { label: "Weekdays 9am", v: "0 9 * * 1-5" },
    { label: "Every Monday 8:30", v: "30 8 * * 1" },
    { label: "Weekends noon", v: "0 12 * * 0,6" },
    { label: "1st of month", v: "0 0 1 * *" },
    { label: "Every Jan 1st", v: "0 0 1 1 *" },
    { label: "Every 30 sec (6 fields)", v: "*/30 * * * * *" },
];

const fieldDefs5 = [
    { name: "Minute", range: "0–59", min: 0, max: 59 },
    { name: "Hour", range: "0–23", min: 0, max: 23 },
    { name: "Day of month", range: "1–31", min: 1, max: 31 },
    { name: "Month", range: "1–12", min: 1, max: 12 },
    { name: "Day of week", range: "0–7 (Sun=0 or 7)", min: 0, max: 6 },
];
const fieldDefs6 = [{ name: "Second", range: "0–59", min: 0, max: 59 }, ...fieldDefs5];
const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MON_ABBR = ["", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAY_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const tokens = computed(() => expr.value.trim().split(/\s+/).filter(Boolean));

function name(field: string, v: string) {
    const up = v.toUpperCase();
    if (field === "Month") {
        const i = /^\d+$/.test(v) ? Number(v) : MON_ABBR.indexOf(up);
        return MONTHS[i] ?? v;
    }
    if (field === "Day of week") {
        const i = /^\d+$/.test(v) ? Number(v) : DAY_ABBR.indexOf(up);
        return DAYS[i] ?? v;
    }
    return v;
}
function mean(field: string, t: string): string {
    const unit = field.toLowerCase();
    if (t === "*" || t === "?") return `every ${unit}`;
    return t
        .split(",")
        .map((part) => {
            const [rangePart, step] = part.split("/");
            let base: string;
            if (rangePart === "*" || rangePart === "?") base = `every ${unit}`;
            else if (rangePart.includes("-")) {
                const [a, b] = rangePart.split("-");
                base = `${name(field, a)} through ${name(field, b)}`;
            } else if (/^L$/i.test(rangePart)) base = "last day";
            else if (/#/.test(rangePart)) {
                const [d, n] = rangePart.split("#");
                base = `${name(field, d)} number ${n}`;
            } else base = name(field, rangePart);
            if (step) return rangePart === "*" ? `every ${step} ${unit}s` : `every ${step} ${unit}s, ${base}`;
            return base;
        })
        .join("; ");
}

const breakdown = computed(() => {
    const t = tokens.value;
    if (t.length !== 5 && t.length !== 6) return [];
    const defs = t.length === 6 ? fieldDefs6 : fieldDefs5;
    return defs.map((d, i) => ({ ...d, value: t[i], meaning: mean(d.name, t[i]) }));
});

const description = computed(() => {
    if (!expr.value.trim()) return { text: "" };
    if (tokens.value.length !== 5 && tokens.value.length !== 6) return { error: `Expected 5 or 6 fields, found ${tokens.value.length}.` };
    try {
        return { text: cronToString(expr.value.trim(), { throwExceptionOnParseError: true, use24HourTimeFormat: false }) };
    } catch (e) {
        return { error: typeof e === "string" ? e : (e as Error).message };
    }
});

const zoneId = computed(() => (tz.value === "local" ? localTz : tz.value));

const runs = computed<{ error?: string; items: { when: string; rel: string }[] }>(() => {
    if (!expr.value.trim() || "error" in description.value) return { items: [] };
    try {
        const it = CronExpressionParser.parse(expr.value.trim(), { currentDate: new Date(), tz: zoneId.value });
        const out: { when: string; rel: string }[] = [];
        const f = new Intl.DateTimeFormat("en-US", {
            timeZone: zoneId.value, weekday: "short", year: "numeric", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "short",
        });
        const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
        const now = Date.now();
        for (let i = 0; i < 10; i++) {
            if (!it.hasNext()) break;
            const d = it.next().toDate();
            const s = (d.getTime() - now) / 1000;
            const rel =
                s < 3600 ? rtf.format(Math.round(s / 60), "minute")
                : s < 86400 ? rtf.format(Math.round(s / 3600), "hour")
                : rtf.format(Math.round(s / 86400), "day");
            out.push({ when: f.format(d), rel });
        }
        return { items: out };
    } catch (e) {
        return { items: [], error: (e as Error).message };
    }
});

// Visual builder (5 fields)
type Mode = "every" | "step" | "range" | "list";
interface BField { mode: Mode; step: string; start: string; from: string; to: string; list: string }
const builder = reactive<BField[]>(fieldDefs5.map(() => ({ mode: "every", step: "5", start: "", from: "", to: "", list: "" })));
const modeLabels: { value: Mode; label: string }[] = [
    { value: "every", label: "Every" }, { value: "step", label: "Every N" },
    { value: "range", label: "Range" }, { value: "list", label: "Specific" },
];

function buildField(b: BField, i: number): string {
    const d = fieldDefs5[i];
    if (b.mode === "every") return "*";
    if (b.mode === "step") return `${b.start || "*"}/${b.step || "1"}`;
    if (b.mode === "range") return `${b.from || d.min}-${b.to || d.max}`;
    return b.list.replace(/\s+/g, "") || String(d.min);
}
watch(builder, () => {
    expr.value = builder.map(buildField).join(" ");
}, { deep: true });
</script>

<template>
    <ToolPage>
        <Panel title="Expression">
            <template #actions><CopyButton :text="expr" /></template>
            <div class="flex flex-col gap-3">
                <input v-model="expr" class="input font-mono text-base" spellcheck="false" placeholder="*/5 * * * *" aria-label="Cron expression" />
                <div class="flex flex-wrap gap-1.5">
                    <button v-for="p in presets" :key="p.v" type="button" class="chip cursor-pointer hover:border-line-strong hover:text-fg" :title="p.v" @click="expr = p.v">{{ p.label }}</button>
                </div>
                <Notice v-if="'error' in description && description.error" type="error">{{ description.error }}</Notice>
                <p v-else-if="'text' in description && description.text" class="text-lg font-medium">{{ description.text }}</p>
                <p class="text-xs text-muted">5 fields (minute hour day-of-month month day-of-week) or 6 fields with a leading seconds field.</p>
            </div>
        </Panel>

        <div class="grid gap-4 lg:grid-cols-2">
            <div class="flex min-w-0 flex-col gap-4">
                <Panel title="Field breakdown" flush>
                    <p v-if="!breakdown.length" class="p-4 text-sm text-muted">Enter a valid expression to see its fields.</p>
                    <div v-else class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead class="text-left text-xs text-muted uppercase">
                                <tr><th class="px-4 py-2 font-medium">Field</th><th class="px-2 py-2 font-medium">Value</th><th class="px-4 py-2 font-medium">Meaning</th></tr>
                            </thead>
                            <tbody class="divide-y divide-line border-t border-line">
                                <tr v-for="f in breakdown" :key="f.name">
                                    <td class="px-4 py-2 whitespace-nowrap">{{ f.name }}<div class="text-xs text-muted">{{ f.range }}</div></td>
                                    <td class="px-2 py-2"><span class="code">{{ f.value }}</span></td>
                                    <td class="px-4 py-2">{{ f.meaning }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </Panel>

                <Panel title="Visual builder">
                    <p class="mb-3 text-xs text-muted">Editing here rewrites the 5-field expression above.</p>
                    <div class="flex flex-col gap-3">
                        <div v-for="(d, i) in fieldDefs5" :key="d.name" class="grid items-center gap-2 sm:grid-cols-[7rem_9rem_1fr]">
                            <span class="text-sm font-medium">{{ d.name }}</span>
                            <select v-model="builder[i].mode" class="select" :aria-label="`${d.name} mode`">
                                <option v-for="m in modeLabels" :key="m.value" :value="m.value">{{ m.label }}</option>
                            </select>
                            <div class="flex min-w-0 items-center gap-2">
                                <template v-if="builder[i].mode === 'step'">
                                    <input v-model="builder[i].step" type="number" min="1" class="input" aria-label="Step" />
                                    <span class="text-xs whitespace-nowrap text-muted">from</span>
                                    <input v-model="builder[i].start" class="input" placeholder="*" aria-label="Start" />
                                </template>
                                <template v-else-if="builder[i].mode === 'range'">
                                    <input v-model="builder[i].from" type="number" :min="d.min" :max="d.max" class="input" :placeholder="String(d.min)" aria-label="From" />
                                    <span class="text-xs text-muted">to</span>
                                    <input v-model="builder[i].to" type="number" :min="d.min" :max="d.max" class="input" :placeholder="String(d.max)" aria-label="To" />
                                </template>
                                <input v-else-if="builder[i].mode === 'list'" v-model="builder[i].list" class="input" :placeholder="`e.g. ${d.min},${d.min + 1}`" aria-label="Values" />
                                <span v-else class="text-xs text-muted">{{ d.range }}</span>
                            </div>
                        </div>
                    </div>
                </Panel>
            </div>

            <Panel title="Next 10 runs" flush>
                <template #actions>
                    <select v-model="tz" class="select !h-7 !w-auto max-w-48 !py-0 text-xs" aria-label="Time zone">
                        <option value="local">Local ({{ localTz }})</option>
                        <option value="UTC">UTC</option>
                        <option v-for="z in zones" :key="z" :value="z">{{ z }}</option>
                    </select>
                </template>
                <div v-if="runs.error" class="p-4"><Notice type="error">{{ runs.error }}</Notice></div>
                <p v-else-if="!runs.items.length" class="p-4 text-sm text-muted">No upcoming runs.</p>
                <ol v-else class="divide-y divide-line">
                    <li v-for="(r, i) in runs.items" :key="i" class="flex items-center gap-3 px-4 py-2.5">
                        <span class="w-5 text-right text-xs text-muted tabular-nums">{{ i + 1 }}</span>
                        <span class="min-w-0 flex-1 font-mono text-sm">{{ r.when }}</span>
                        <span class="text-xs whitespace-nowrap text-muted">{{ r.rel }}</span>
                    </li>
                </ol>
                <div class="border-t border-line px-4 py-2">
                    <Btn size="sm" variant="ghost" @click="tz = 'UTC'">Use UTC</Btn>
                </div>
            </Panel>
        </div>
    </ToolPage>
</template>
