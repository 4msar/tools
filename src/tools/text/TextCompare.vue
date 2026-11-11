<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { ArrowDown, ArrowLeftRight, ArrowUp, Sparkles, Trash2 } from "lucide-vue-next";
import { diffArrays, diffChars, diffWords, diffWordsWithSpace } from "diff";
import type { ChangeObject } from "diff";
import { Btn, CodeArea, Notice, Panel, Tabs, ToolPage } from "@/components/ui";

type Mode = "lines" | "words" | "chars";
type View = "unified" | "split";
type Kind = "eq" | "add" | "del";

const SAMPLE_A = `function greet(name) {
  console.log("Hello, " + name);
  return true;
}

const users = ["ann", "bob", "cy"];
users.forEach(greet);`;
const SAMPLE_B = `function greet(name, punctuation = "!") {
  console.log("Hello, " + name + punctuation);
  return true;
}

const users = ["ann", "bob", "cyd", "dee"];
users.forEach((u) => greet(u));`;

const left = ref(SAMPLE_A);
const right = ref(SAMPLE_B);
const mode = ref<Mode>("lines");
const view = ref<View>("unified");
const ignoreWs = ref(false);
const ignoreCase = ref(false);
const current = ref(-1);
const results = ref<HTMLElement | null>(null);

interface Row { kind: Kind; text: string; oldN?: number; newN?: number; group: number; first: boolean }
interface Seg { kind: Kind; text: string; group: number; first: boolean }
interface Pair { l?: Row; r?: Row }

const parts = computed<ChangeObject<string>[]>(() => {
    let a = left.value, b = right.value;
    if (mode.value === "lines") {
        const norm = (l: string) => {
            const t = ignoreWs.value ? l.trim() : l;
            return ignoreCase.value ? t.toLowerCase() : t;
        };
        const la = a === "" ? [] : a.split("\n");
        const lb = b === "" ? [] : b.split("\n");
        return diffArrays(la, lb, { comparator: (x, y) => norm(x) === norm(y) }).map((p) => ({
            ...p,
            value: p.value.map((l) => l + "\n").join(""),
            count: p.value.length,
        })) as ChangeObject<string>[];
    }
    if (mode.value === "words") {
        return ignoreWs.value ? diffWords(a, b, { ignoreCase: ignoreCase.value }) : diffWordsWithSpace(a, b, { ignoreCase: ignoreCase.value });
    }
    if (ignoreWs.value) {
        a = a.replace(/\s+/g, "");
        b = b.replace(/\s+/g, "");
    }
    return diffChars(a, b, { ignoreCase: ignoreCase.value });
});

const kindOf = (p: ChangeObject<string>): Kind => (p.added ? "add" : p.removed ? "del" : "eq");

function splitLines(v: string): string[] {
    const l = v.split("\n");
    if (l.length && l[l.length - 1] === "") l.pop();
    return l;
}

const rows = computed<Row[]>(() => {
    if (mode.value !== "lines") return [];
    const out: Row[] = [];
    let o = 1, n = 1, g = -1, prev: Kind = "eq";
    for (const p of parts.value) {
        const k = kindOf(p);
        let first = false;
        if (k !== "eq" && prev === "eq") {
            g++;
            first = true;
        }
        prev = k;
        for (const text of splitLines(p.value)) {
            const row: Row = { kind: k, text, group: k === "eq" ? -1 : g, first };
            first = false;
            if (k !== "add") row.oldN = o++;
            if (k !== "del") row.newN = n++;
            out.push(row);
        }
    }
    return out;
});

const segs = computed<Seg[]>(() => {
    if (mode.value === "lines") return [];
    const out: Seg[] = [];
    let g = -1, prev: Kind = "eq";
    for (const p of parts.value) {
        const k = kindOf(p);
        const first = k !== "eq" && prev === "eq";
        if (first) g++;
        prev = k;
        out.push({ kind: k, text: p.value, group: k === "eq" ? -1 : g, first });
    }
    return out;
});

const pairs = computed<Pair[]>(() => {
    const out: Pair[] = [];
    const rs = rows.value;
    for (let i = 0; i < rs.length; ) {
        if (rs[i].kind === "eq") {
            out.push({ l: rs[i], r: rs[i] });
            i++;
            continue;
        }
        const dels: Row[] = [], adds: Row[] = [];
        while (i < rs.length && rs[i].kind !== "eq") {
            (rs[i].kind === "del" ? dels : adds).push(rs[i]);
            i++;
        }
        const n = Math.max(dels.length, adds.length);
        for (let k = 0; k < n; k++) out.push({ l: dels[k], r: adds[k] });
    }
    return out;
});

const stats = computed(() => {
    let added = 0, removed = 0, groups = 0;
    for (const p of parts.value) {
        if (p.added) added += p.count ?? 0;
        else if (p.removed) removed += p.count ?? 0;
    }
    groups = mode.value === "lines" ? rows.value.filter((r) => r.first).length : segs.value.filter((s) => s.first).length;
    return { added, removed, groups };
});

const unit = computed(() => (mode.value === "lines" ? "line" : mode.value === "words" ? "token" : "char"));
const hasInput = computed(() => !!(left.value || right.value));
const identical = computed(() => hasInput.value && stats.value.groups === 0);

watch([parts, view], () => {
    current.value = -1;
});

function go(delta: number) {
    const n = stats.value.groups;
    if (!n) return;
    current.value = current.value < 0 ? (delta > 0 ? 0 : n - 1) : (current.value + delta + n) % n;
    nextTick(() => {
        results.value?.querySelector(`[data-change="${current.value}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
}

function swap() {
    [left.value, right.value] = [right.value, left.value];
}

function clearAll() {
    left.value = "";
    right.value = "";
}

function loadSample() {
    left.value = SAMPLE_A;
    right.value = SAMPLE_B;
}

const bg = (k: Kind) => (k === "add" ? "bg-success/15" : k === "del" ? "bg-danger/15" : "");
const mark = (k: Kind) => (k === "add" ? "+" : k === "del" ? "-" : " ");
const ring = (g: number) => (g >= 0 && g === current.value ? "outline-2 -outline-offset-2 outline-accent" : "");
const segBg = (k: Kind) => (k === "add" ? "bg-success/25 text-success" : k === "del" ? "bg-danger/25 text-danger line-through decoration-danger/50" : "");
</script>

<template>
    <ToolPage>
        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Tabs v-model="mode" :options="[{ value: 'lines', label: 'Lines' }, { value: 'words', label: 'Words' }, { value: 'chars', label: 'Characters' }]" />
            <label class="flex items-center gap-2"><input v-model="ignoreWs" type="checkbox" class="checkbox" /> Ignore whitespace</label>
            <label class="flex items-center gap-2"><input v-model="ignoreCase" type="checkbox" class="checkbox" /> Ignore case</label>
            <div class="ml-auto flex items-center gap-1">
                <Btn size="sm" variant="secondary" @click="loadSample"><Sparkles /> Sample</Btn>
                <Btn size="sm" variant="secondary" @click="swap"><ArrowLeftRight /> Swap</Btn>
                <Btn size="sm" variant="ghost" :disabled="!hasInput" @click="clearAll"><Trash2 /> Clear</Btn>
            </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="Original" flush>
                <CodeArea v-model="left" :wrap="false" height="14rem" placeholder="Paste the original text…" />
            </Panel>
            <Panel title="Changed" flush>
                <CodeArea v-model="right" :wrap="false" height="14rem" placeholder="Paste the changed text…" />
            </Panel>
        </div>

        <Panel flush>
            <template #title>
                <span class="flex flex-wrap items-center gap-2">
                    Differences
                    <span class="chip !text-success">+{{ stats.added }} {{ unit }}{{ stats.added === 1 ? "" : "s" }}</span>
                    <span class="chip !text-danger">-{{ stats.removed }} {{ unit }}{{ stats.removed === 1 ? "" : "s" }}</span>
                    <span class="chip">{{ stats.groups }} change{{ stats.groups === 1 ? "" : "s" }}</span>
                </span>
            </template>
            <template #actions>
                <Btn size="sm" variant="ghost" :disabled="!stats.groups" title="Previous change" @click="go(-1)"><ArrowUp /> Prev</Btn>
                <Btn size="sm" variant="ghost" :disabled="!stats.groups" title="Next change" @click="go(1)"><ArrowDown /> Next</Btn>
                <span v-if="current >= 0" class="px-1 text-xs text-muted">{{ current + 1 }} / {{ stats.groups }}</span>
                <Tabs v-model="view" size="sm" :options="[{ value: 'unified', label: 'Unified' }, { value: 'split', label: 'Side by side' }]" />
            </template>

            <div v-if="!hasInput" class="p-6 text-center text-sm text-muted">Enter text on both sides to see the differences.</div>
            <div v-else-if="identical" class="p-4"><Notice type="success">The two texts are identical{{ ignoreWs || ignoreCase ? " with the selected options" : "" }}.</Notice></div>

            <div v-else ref="results" class="max-h-[34rem] overflow-auto font-mono text-[13px] leading-relaxed">
                <!-- lines, unified -->
                <div v-if="mode === 'lines' && view === 'unified'" class="min-w-max">
                    <div v-for="(r, i) in rows" :key="i" :data-change="r.first ? r.group : undefined" class="flex" :class="[bg(r.kind), ring(r.group)]">
                        <span class="w-10 shrink-0 select-none px-2 text-right text-muted">{{ r.oldN ?? "" }}</span>
                        <span class="w-10 shrink-0 select-none px-2 text-right text-muted">{{ r.newN ?? "" }}</span>
                        <span class="w-5 shrink-0 select-none text-center" :class="r.kind === 'add' ? 'text-success' : r.kind === 'del' ? 'text-danger' : 'text-muted'">{{ mark(r.kind) }}</span>
                        <span class="whitespace-pre pr-4">{{ r.text || " " }}</span>
                    </div>
                </div>

                <!-- lines, side by side -->
                <div v-else-if="mode === 'lines'" class="grid min-w-[40rem] grid-cols-2 divide-x divide-line">
                    <template v-for="(p, i) in pairs" :key="i">
                        <div class="flex" :class="[p.l ? bg(p.l.kind) : 'bg-subtle/50', p.l ? ring(p.l.group) : '']" :data-change="p.l?.first ? p.l.group : undefined">
                            <span class="w-10 shrink-0 select-none px-2 text-right text-muted">{{ p.l?.oldN ?? "" }}</span>
                            <span class="whitespace-pre pr-4">{{ p.l ? p.l.text || " " : " " }}</span>
                        </div>
                        <div class="flex" :class="[p.r ? bg(p.r.kind) : 'bg-subtle/50', p.r ? ring(p.r.group) : '']" :data-change="!p.l?.first && p.r?.first ? p.r.group : undefined">
                            <span class="w-10 shrink-0 select-none px-2 text-right text-muted">{{ p.r?.newN ?? "" }}</span>
                            <span class="whitespace-pre pr-4">{{ p.r ? p.r.text || " " : " " }}</span>
                        </div>
                    </template>
                </div>

                <!-- words / chars, unified -->
                <div v-else-if="view === 'unified'" class="p-4 whitespace-pre-wrap break-words">
                    <template v-for="(s, i) in segs" :key="i"><span :data-change="s.first ? s.group : undefined" class="rounded-sm" :class="[segBg(s.kind), ring(s.group)]">{{ s.text }}</span></template>
                </div>

                <!-- words / chars, side by side -->
                <div v-else class="grid min-w-[30rem] grid-cols-2 divide-x divide-line">
                    <div class="p-4 whitespace-pre-wrap break-words">
                        <template v-for="(s, i) in segs" :key="i"><span v-if="s.kind !== 'add'" :data-change="s.first ? s.group : undefined" class="rounded-sm" :class="[s.kind === 'del' ? 'bg-danger/25 text-danger' : '', ring(s.group)]">{{ s.text }}</span></template>
                    </div>
                    <div class="p-4 whitespace-pre-wrap break-words">
                        <template v-for="(s, i) in segs" :key="i"><span v-if="s.kind !== 'del'" class="rounded-sm" :class="[s.kind === 'add' ? 'bg-success/25 text-success' : '', ring(s.group)]">{{ s.text }}</span></template>
                    </div>
                </div>
            </div>
        </Panel>
    </ToolPage>
</template>
