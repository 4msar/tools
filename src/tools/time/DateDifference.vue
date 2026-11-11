<script setup lang="ts">
import { computed, ref } from "vue";
import { Btn, CopyButton, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";

type Mode = "diff" | "add";
const mode = ref<Mode>("diff");

function toLocalInput(d: Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const now = new Date();
now.setSeconds(0, 0);
const start = ref(toLocalInput(now));
const end = ref(toLocalInput(new Date(now.getTime() + 7 * 864e5)));

function addMonths(d: Date, n: number) {
    const r = new Date(d);
    const day = r.getDate();
    r.setDate(1);
    r.setMonth(r.getMonth() + n);
    const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
    r.setDate(Math.min(day, last));
    return r;
}

const diff = computed(() => {
    let a = new Date(start.value);
    let b = new Date(end.value);
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
    const negative = b < a;
    if (negative) [a, b] = [b, a];
    let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    if (addMonths(a, months) > b) months--;
    const afterMonths = addMonths(a, months);
    let rest = Math.floor((b.getTime() - afterMonths.getTime()) / 1000);
    const days = Math.floor(rest / 86400);
    rest -= days * 86400;
    const hours = Math.floor(rest / 3600);
    rest -= hours * 3600;
    const minutes = Math.floor(rest / 60);
    const seconds = rest - minutes * 60;
    const totalMs = b.getTime() - a.getTime();

    const dayNum = (d: Date) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
    const n = dayNum(b) - dayNum(a);
    let business = Math.floor(n / 7) * 5;
    const startDow = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getDay();
    for (let i = 0; i < n % 7; i++) {
        const dow = (startDow + i) % 7;
        if (dow !== 0 && dow !== 6) business++;
    }
    return {
        negative, years: Math.floor(months / 12), months: months % 12, days, hours, minutes, seconds,
        totalDays: totalMs / 864e5, totalHours: totalMs / 36e5, totalMinutes: totalMs / 6e4,
        totalSeconds: totalMs / 1e3, weeks: totalMs / 6048e5, business,
    };
});

const fmt = (n: number, dp = 2) => n.toLocaleString(undefined, { maximumFractionDigits: dp });

const summary = computed(() => {
    const d = diff.value;
    if (!d) return "";
    const bits: [number, string][] = [[d.years, "year"], [d.months, "month"], [d.days, "day"], [d.hours, "hour"], [d.minutes, "minute"], [d.seconds, "second"]];
    const s = bits.filter(([n]) => n).map(([n, u]) => `${n} ${u}${n === 1 ? "" : "s"}`).join(", ");
    return s || "0 seconds";
});

const stats = computed(() => {
    const d = diff.value;
    if (!d) return [];
    return [
        { label: "Total days", value: fmt(d.totalDays) },
        { label: "Total weeks", value: fmt(d.weeks) },
        { label: "Total hours", value: fmt(d.totalHours) },
        { label: "Total minutes", value: fmt(d.totalMinutes, 0) },
        { label: "Total seconds", value: fmt(d.totalSeconds, 0) },
        { label: "Business days (Mon–Fri)", value: String(d.business) },
    ];
});

// Add / subtract
const base = ref(toLocalInput(now));
const op = ref<"add" | "sub">("add");
const amt = ref({ years: 0, months: 0, weeks: 0, days: 0, hours: 0 });
const result = computed(() => {
    const d = new Date(base.value);
    if (isNaN(d.getTime())) return null;
    const s = op.value === "add" ? 1 : -1;
    let r = addMonths(d, s * (Number(amt.value.years || 0) * 12 + Number(amt.value.months || 0)));
    r = new Date(r.getTime());
    r.setDate(r.getDate() + s * (Number(amt.value.weeks || 0) * 7 + Number(amt.value.days || 0)));
    r.setTime(r.getTime() + s * Number(amt.value.hours || 0) * 36e5);
    return r;
});
const resultText = computed(() =>
    result.value ? new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(result.value) : "",
);
const resultIso = computed(() => (result.value ? toLocalInput(result.value).replace("T", " ") : ""));
const fields = [
    { key: "years", label: "Years" }, { key: "months", label: "Months" }, { key: "weeks", label: "Weeks" },
    { key: "days", label: "Days" }, { key: "hours", label: "Hours" },
] as const;

function swap() {
    [start.value, end.value] = [end.value, start.value];
}
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="mode" :options="[{ value: 'diff', label: 'Difference' }, { value: 'add', label: 'Add / subtract' }]" />
        </template>

        <template v-if="mode === 'diff'">
            <Panel title="Dates">
                <div class="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
                    <Field label="Start"><input v-model="start" type="datetime-local" class="input" /></Field>
                    <Btn variant="secondary" @click="swap">Swap</Btn>
                    <Field label="End"><input v-model="end" type="datetime-local" class="input" /></Field>
                </div>
            </Panel>

            <Notice v-if="!diff" type="error">Enter two valid dates.</Notice>
            <template v-else>
                <Panel title="Difference">
                    <template #actions><CopyButton :text="summary" /></template>
                    <div class="text-xl font-semibold">{{ summary }}</div>
                    <p v-if="diff.negative" class="mt-1 text-sm text-muted">The end date is before the start date. Showing the absolute difference.</p>
                    <div class="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
                        <div v-for="c in [{ l: 'Years', v: diff.years }, { l: 'Months', v: diff.months }, { l: 'Days', v: diff.days }, { l: 'Hours', v: diff.hours }, { l: 'Minutes', v: diff.minutes }, { l: 'Seconds', v: diff.seconds }]" :key="c.l" class="rounded-lg bg-subtle p-3 text-center">
                            <div class="font-mono text-2xl font-semibold tabular-nums">{{ c.v }}</div>
                            <div class="text-xs text-muted">{{ c.l }}</div>
                        </div>
                    </div>
                </Panel>
                <Panel title="Totals" flush>
                    <ul class="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
                        <li v-for="s in stats" :key="s.label" class="flex items-center justify-between gap-3 px-4 py-2.5 sm:border-b sm:border-line">
                            <span class="text-sm text-muted">{{ s.label }}</span>
                            <span class="flex items-center gap-1"><span class="font-mono text-sm tabular-nums">{{ s.value }}</span><CopyButton :text="s.value.replace(/,/g, '')" icon-only /></span>
                        </li>
                    </ul>
                </Panel>
                <p class="text-xs text-muted">Business days count Monday to Friday from the start date up to, but not including, the end date. Holidays are not considered.</p>
            </template>
        </template>

        <template v-else>
            <Panel title="Add or subtract">
                <div class="flex flex-col gap-4">
                    <div class="flex flex-wrap items-end gap-3">
                        <Field label="Start date"><input v-model="base" type="datetime-local" class="input" /></Field>
                        <Tabs v-model="op" :options="[{ value: 'add', label: 'Add' }, { value: 'sub', label: 'Subtract' }]" />
                    </div>
                    <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
                        <Field v-for="f in fields" :key="f.key" :label="f.label">
                            <input v-model.number="amt[f.key]" type="number" min="0" class="input tabular-nums" />
                        </Field>
                    </div>
                </div>
            </Panel>
            <Panel title="Result">
                <template #actions><CopyButton :text="resultIso" label="Copy" /></template>
                <Notice v-if="!result" type="error">Enter a valid start date.</Notice>
                <template v-else>
                    <div class="text-xl font-semibold">{{ resultText }}</div>
                    <div class="mt-1 font-mono text-sm text-muted">{{ resultIso }}</div>
                </template>
            </Panel>
        </template>
    </ToolPage>
</template>
