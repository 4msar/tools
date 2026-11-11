<script setup lang="ts">
import { computed, ref } from "vue";
import { Plus, X } from "lucide-vue-next";
import { Btn, CopyButton, Field, Notice, Panel, ToolPage } from "@/components/ui";

const zones: string[] = (() => {
    try {
        return Intl.supportedValuesOf("timeZone");
    } catch {
        return ["UTC"];
    }
})();
const allZones = zones.includes("UTC") ? zones : ["UTC", ...zones];
const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

function parts(ms: number, tz: string) {
    const f = new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
        hour: "numeric", minute: "numeric", second: "numeric",
    });
    const o: Record<string, number> = {};
    for (const p of f.formatToParts(new Date(ms))) if (p.type !== "literal") o[p.type] = Number(p.value);
    return o;
}
function wallAsUtc(ms: number, tz: string) {
    const p = parts(ms, tz);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}
function offsetMin(ms: number, tz: string) {
    return (wallAsUtc(ms, tz) - Math.floor(ms / 1000) * 1000) / 60000;
}
function fmtOffset(min: number) {
    const a = Math.abs(min);
    return `UTC${min < 0 ? "-" : "+"}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}
function abbr(ms: number, tz: string) {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date(ms)).find((p) => p.type === "timeZoneName")?.value ?? "";
}
/** Wall-clock time in zone -> UTC ms. Handles DST by re-checking the offset at the result. */
function zonedToUtc(wall: number, tz: string) {
    let utc = wall - offsetMin(wall, tz) * 60000;
    const off2 = offsetMin(utc, tz);
    utc = wall - off2 * 60000;
    return utc;
}

function toLocalInput(ms: number, tz: string) {
    const p = parts(ms, tz);
    const z = (n: number) => String(n).padStart(2, "0");
    return `${p.year}-${z(p.month)}-${z(p.day)}T${z(p.hour)}:${z(p.minute)}`;
}

const source = ref(localTz);
const input = ref(toLocalInput(Date.now(), localTz));
const targets = ref<string[]>([...new Set(["UTC", localTz, "America/New_York", "Europe/London", "Asia/Tokyo", "Asia/Dhaka"])]);
const newZone = ref("");

const sourceValid = computed(() => allZones.includes(source.value));

const instant = computed<{ utc: number; gap: boolean } | null>(() => {
    if (!sourceValid.value) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(input.value);
    if (!m) return null;
    const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
    const utc = zonedToUtc(wall, source.value);
    return { utc, gap: wallAsUtc(utc, source.value) !== wall };
});

function dayNum(ms: number, tz: string) {
    return Math.floor(wallAsUtc(ms, tz) / 864e5);
}

const rows = computed(() => {
    const i = instant.value;
    if (!i) return [];
    const srcDay = dayNum(i.utc, source.value);
    return targets.value.map((tz) => {
        const d = new Date(i.utc);
        const time = new Intl.DateTimeFormat("en-US", {
            timeZone: tz, weekday: "short", year: "numeric", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
        }).format(d);
        const delta = dayNum(i.utc, tz) - srcDay;
        return {
            tz, time, abbr: abbr(i.utc, tz), offset: fmtOffset(offsetMin(i.utc, tz)),
            day: delta === 0 ? "" : `${delta > 0 ? "+" : ""}${delta} day${Math.abs(delta) === 1 ? "" : "s"}`,
            copy: `${toLocalInput(i.utc, tz).replace("T", " ")} ${tz}`,
        };
    });
});

function addZone() {
    const z = newZone.value.trim();
    if (!allZones.includes(z) || targets.value.includes(z)) return;
    targets.value.push(z);
    newZone.value = "";
}
function useNow() {
    input.value = toLocalInput(Date.now(), source.value);
}
function changeSource() {
    if (allZones.includes(source.value) && instant.value) input.value = toLocalInput(instant.value.utc, source.value);
}
</script>

<template>
    <ToolPage>
        <Panel title="Source">
            <div class="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <Field label="Date and time"><input v-model="input" type="datetime-local" step="1" class="input" /></Field>
                <Field label="Source time zone">
                    <input v-model="source" list="tz-all" class="input" placeholder="Search zones…" spellcheck="false" @change="changeSource" />
                </Field>
                <Btn @click="useNow">Now</Btn>
            </div>
            <datalist id="tz-all"><option v-for="z in allZones" :key="z" :value="z" /></datalist>
            <div class="mt-3 flex flex-col gap-2">
                <Notice v-if="!sourceValid" type="error">Unknown time zone. Pick one from the suggestions (e.g. Europe/Paris).</Notice>
                <Notice v-else-if="instant?.gap" type="warning">This local time does not exist in {{ source }} (it falls in a DST gap), so it was shifted forward.</Notice>
                <p v-else-if="instant" class="text-xs text-muted">{{ abbr(instant.utc, source) }} · {{ fmtOffset(offsetMin(instant.utc, source)) }} · UTC {{ new Date(instant.utc).toISOString() }}</p>
            </div>
        </Panel>

        <Panel title="Converted" flush>
            <div class="flex gap-2 border-b border-line p-3">
                <input v-model="newZone" list="tz-all" class="input" placeholder="Add a target zone…" spellcheck="false" aria-label="Add target zone" @keydown.enter="addZone" />
                <Btn @click="addZone"><Plus /> Add</Btn>
            </div>
            <p v-if="!rows.length" class="p-4 text-sm text-muted">Enter a valid date and source zone.</p>
            <ul v-else class="divide-y divide-line">
                <li v-for="r in rows" :key="r.tz" class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                    <div class="min-w-40 flex-1">
                        <div class="text-sm font-medium">{{ r.tz }}</div>
                        <div class="text-xs text-muted">{{ r.abbr }} · {{ r.offset }}</div>
                    </div>
                    <div class="font-mono text-sm tabular-nums">{{ r.time }}</div>
                    <span v-if="r.day" class="chip !border-accent/30 !bg-accent/10 !text-accent">{{ r.day }}</span>
                    <div class="ml-auto flex items-center">
                        <CopyButton :text="r.copy" icon-only />
                        <Btn size="sm" variant="ghost" :title="`Remove ${r.tz}`" @click="targets = targets.filter((x) => x !== r.tz)"><X /></Btn>
                    </div>
                </li>
            </ul>
        </Panel>
    </ToolPage>
</template>
