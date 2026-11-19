<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onDeactivated, ref, watch } from "vue";
import { useStorage } from "@vueuse/core";
import { Keyboard, MousePointerClick, RotateCcw, Trash2, Trophy } from "lucide-vue-next";
import { Btn, Notice, Panel, Tabs, ToolPage } from "@/components/ui";

type Mode = "time" | "words";
type Source = "words" | "quotes" | "code";
interface Settings { mode: Mode; time: number; words: number; source: Source; punctuation: boolean; numbers: boolean }
interface Entry { at: number; mode: Mode; value: number; source: Source; wpm: number; raw: number; acc: number }

const settings = useStorage<Settings>("tools:typing-test:settings", { mode: "time", time: 30, words: 50, source: "words", punctuation: false, numbers: false }, localStorage, { mergeDefaults: true });
const best = useStorage<Record<string, number>>("tools:typing-test:best", {});
const history = useStorage<Entry[]>("tools:typing-test:history", []);

const COMMON = "the be to of and a in that have I it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was were has had been said each many may find long down made did part".split(" ");
const WORDS = Array.from(new Set([...COMMON, ..."water little very through where much before right too means old same tell boy follow came want show also around form three small set put end does another large must big even such because turn here why ask went men read need land different home move try kind hand picture again change off play spell air away animal house point page letter mother answer found study still learn should world high every near add food between own below country plant last school father keep tree never start city earth eye light thought head under story saw left don't few while along might close something seem next hard open example begin life always those both paper together got group often run important until children side feet car mile night walk white sea began grow took river four carry state once book hear stop without second later miss idea enough eat face watch far Indian real almost let above girl sometimes mountain cut young talk soon list song being leave family".split(" ")]));

const QUOTES = [
    "The quick brown fox jumps over the lazy dog.",
    "Simplicity is the ultimate sophistication.",
    "A journey of a thousand miles begins with a single step.",
    "Practice makes progress, not perfection.",
    "The best way to predict the future is to build it.",
    "Slow is smooth, and smooth is fast.",
    "Small habits, repeated daily, shape the people we become.",
    "Read the error message; it is often telling you exactly what is wrong.",
    "Every expert was once a beginner who refused to quit.",
    "Good code is written for humans first and machines second.",
    "Make it work, make it right, then make it fast.",
    "Curiosity is the engine of learning.",
    "The morning light spilled over the hills and woke the sleeping town.",
    "Measure twice, cut once, and keep your tools sharp.",
    "Done is better than perfect, but understood is better than done.",
];

const CODE = [
    "const sum = (a, b) => a + b;",
    "for (let i = 0; i < items.length; i++) { total += items[i]; }",
    "const names = users.filter((u) => u.active).map((u) => u.name);",
    "if (!response.ok) throw new Error('Request failed');",
    "def add(a, b): return a + b",
    "for i in range(10): print(i * 2)",
    "squares = [x ** 2 for x in range(1, 6) if x % 2 == 1]",
    "with open('data.txt') as f: lines = f.read().splitlines()",
    "document.querySelector('#app').addEventListener('click', handle);",
    "const { data, error } = await fetch(url).then((r) => r.json());",
];

const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]) => a[rnd(a.length)];

function generate(n: number): string[] {
    const s = settings.value;
    if (s.source === "quotes" || s.source === "code") {
        const src = s.source === "quotes" ? QUOTES : CODE;
        const out: string[] = [];
        while (out.length < n) out.push(...pick(src).split(" "));
        return out.slice(0, n);
    }
    const out: string[] = [];
    let cap = true;
    for (let i = 0; i < n; i++) {
        let w = pick(WORDS);
        if (s.numbers && Math.random() < 0.15) w = String(rnd(10 ** (1 + rnd(4))));
        else if (s.punctuation) {
            if (cap) w = w[0].toUpperCase() + w.slice(1);
            cap = false;
            const r = Math.random();
            if (r < 0.08) w += ",";
            else if (r < 0.15) {
                w += pick([".", ".", "?", "!"]);
                cap = true;
            } else if (r < 0.18) w = `"${w}"`;
            else if (r < 0.2) w = `(${w})`;
            else if (r < 0.22) w += ";";
        }
        out.push(w);
    }
    return out;
}

// ---- test state ----
const words = ref<string[]>([]);
const typed = ref<string[]>([]);
const cur = ref("");
const wi = ref(0);
const status = ref<"idle" | "running" | "done">("idle");
const focused = ref(false);
const elapsed = ref(0);
const samples = ref<{ t: number; wpm: number; raw: number }[]>([]);
const keys = { total: 0, correct: 0 };
let startAt = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let lastRaw = 0;
let tabArmed = false;
const result = ref<{ wpm: number; raw: number; acc: number; consistency: number; correct: number; incorrect: number; time: number; pb: boolean } | null>(null);

const inputEl = ref<HTMLInputElement | null>(null);
const wordEls: (HTMLElement | null)[] = [];
const shift = ref(0);
const LINE = 40;

const limit = computed(() => (settings.value.mode === "time" ? settings.value.time : 0));
const bestKey = computed(() => `${settings.value.mode}-${settings.value.mode === "time" ? settings.value.time : settings.value.words}`);

function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
}

function reset(focus = false) {
    stopTimer();
    const s = settings.value;
    words.value = generate(s.mode === "time" ? 120 : s.words);
    typed.value = [];
    cur.value = "";
    wi.value = 0;
    status.value = "idle";
    elapsed.value = 0;
    samples.value = [];
    result.value = null;
    keys.total = keys.correct = 0;
    lastRaw = 0;
    shift.value = 0;
    if (focus) nextTick(() => inputEl.value?.focus());
}

function stats() {
    let correct = 0; // chars counted for WPM
    let good = 0;
    let bad = 0;
    let raw = 0;
    const upto = wi.value;
    for (let i = 0; i <= upto && i < words.value.length; i++) {
        const w = words.value[i];
        const t = i < upto ? typed.value[i] ?? "" : cur.value;
        const committed = i < upto;
        if (!committed && !t) continue;
        let m = 0;
        for (let k = 0; k < t.length && k < w.length; k++) if (t[k] === w[k]) m++;
        good += m;
        bad += t.length - m + (committed ? Math.max(0, w.length - t.length) : 0);
        raw += t.length + (committed ? 1 : 0);
        if (committed && t === w) {
            correct += w.length + 1;
            good += 1;
        } else if (!committed) correct += m;
    }
    return { correct, good, bad, raw };
}

function tick() {
    const sec = (performance.now() - startAt) / 1000;
    elapsed.value = Math.min(sec, limit.value || sec);
    const whole = Math.floor(elapsed.value);
    while (samples.value.length < whole) {
        const t = samples.value.length + 1;
        const s = stats();
        samples.value.push({ t, wpm: s.correct / 5 / (t / 60), raw: ((s.raw - lastRaw) / 5) * 60 });
        lastRaw = s.raw;
    }
    if (limit.value && sec >= limit.value) finish();
}

function start() {
    status.value = "running";
    startAt = performance.now();
    timer = setInterval(tick, 100);
}

function finish() {
    if (status.value === "done") return;
    const sec = limit.value ? limit.value : Math.max((performance.now() - startAt) / 1000, 0.5);
    stopTimer();
    const s = stats();
    const mins = sec / 60;
    const wpm = s.correct / 5 / mins;
    const raw = s.raw / 5 / mins;
    const burst = samples.value.map((x) => x.raw);
    let consistency = 100;
    if (burst.length > 1) {
        const mean = burst.reduce((a, b) => a + b, 0) / burst.length;
        const sd = Math.sqrt(burst.reduce((a, b) => a + (b - mean) ** 2, 0) / burst.length);
        consistency = mean > 0 ? Math.max(0, 100 - (sd / mean) * 100) : 0;
    }
    const acc = keys.total ? (keys.correct / keys.total) * 100 : 0;
    const w = Math.round(wpm * 10) / 10;
    const prev = best.value[bestKey.value] ?? 0;
    const pb = w > prev;
    if (pb) best.value = { ...best.value, [bestKey.value]: w };
    history.value = [{ at: Date.now(), mode: settings.value.mode, value: settings.value.mode === "time" ? settings.value.time : settings.value.words, source: settings.value.source, wpm: w, raw: Math.round(raw * 10) / 10, acc: Math.round(acc * 10) / 10 }, ...history.value].slice(0, 20);
    if (!samples.value.length || samples.value[samples.value.length - 1].t < sec) samples.value.push({ t: Math.round(sec * 10) / 10, wpm, raw });
    result.value = { wpm: w, raw: Math.round(raw * 10) / 10, acc: Math.round(acc * 10) / 10, consistency: Math.round(consistency), correct: s.good, incorrect: s.bad, time: Math.round(sec * 10) / 10, pb };
    elapsed.value = sec;
    status.value = "done";
}

function typeChar(ch: string) {
    if (status.value === "done") return;
    if (status.value === "idle") start();
    const w = words.value[wi.value];
    if (ch === " ") {
        if (!cur.value) return;
        keys.total++;
        if (cur.value === w) keys.correct++;
        typed.value[wi.value] = cur.value;
        cur.value = "";
        wi.value++;
        if (settings.value.mode === "time" && wi.value > words.value.length - 40) words.value = [...words.value, ...generate(60)];
        if (wi.value >= words.value.length) finish();
        return;
    }
    if (cur.value.length >= w.length + 10) return;
    keys.total++;
    if (w[cur.value.length] === ch) keys.correct++;
    cur.value += ch;
    if (settings.value.mode === "words" && wi.value === words.value.length - 1 && cur.value.length >= w.length) finish();
}

function backspace(word: boolean) {
    if (status.value !== "running") return;
    if (cur.value) {
        cur.value = word ? "" : cur.value.slice(0, -1);
    } else if (wi.value > 0 && typed.value[wi.value - 1] !== words.value[wi.value - 1]) {
        wi.value--;
        cur.value = word ? "" : typed.value[wi.value] ?? "";
    }
}

function onKeydown(e: KeyboardEvent) {
    if (e.key === "Tab") {
        e.preventDefault();
        tabArmed = true;
        return;
    }
    if (e.key === "Enter" && tabArmed) {
        e.preventDefault();
        reset(true);
        tabArmed = false;
        return;
    }
    tabArmed = false;
    if (e.key === "Escape") return;
    if (e.key === "Backspace") {
        e.preventDefault();
        backspace(e.ctrlKey || e.altKey || e.metaKey);
        return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length === 1) {
        e.preventDefault();
        typeChar(e.key);
    }
}

// Fallback for virtual keyboards that report key "Unidentified"
function onInput(e: Event) {
    const el = e.target as HTMLInputElement;
    for (const ch of el.value) typeChar(ch);
    el.value = "";
}

function setEl(el: unknown, i: number) {
    wordEls[i] = el as HTMLElement | null;
}

watch([wi, () => words.value.length, status], async () => {
    await nextTick();
    const el = wordEls[wi.value];
    if (el) shift.value = Math.max(0, el.offsetTop - LINE);
});

watch(settings, () => reset(), { deep: true });
reset();

function chars(i: number) {
    const w = words.value[i];
    const isCur = i === wi.value;
    const committed = i < wi.value;
    const t = committed ? typed.value[i] ?? "" : isCur ? cur.value : "";
    const out: { ch: string; cls: string }[] = [];
    const len = Math.max(w.length, t.length);
    for (let k = 0; k < len; k++) {
        let cls = "";
        let ch = "";
        if (k < w.length) {
            ch = w[k];
            if (k < t.length) cls = t[k] === w[k] ? "text-fg" : "text-danger";
            else cls = committed ? "text-fg-subtle underline decoration-danger decoration-2 underline-offset-4" : "text-fg-subtle";
        } else {
            ch = t[k];
            cls = "text-danger bg-danger-soft";
        }
        if (isCur && status.value !== "done") {
            if (k === t.length) cls += " caret-l";
            else if (k === len - 1 && t.length >= len) cls += " caret-r";
        }
        out.push({ ch, cls });
    }
    return out;
}

// ---- chart ----
const chart = computed(() => {
    const s = samples.value;
    if (s.length < 2) return null;
    const W = 480;
    const H = 140;
    const pad = { l: 30, r: 8, t: 8, b: 18 };
    const maxT = s[s.length - 1].t;
    const maxY = Math.max(10, ...s.map((p) => Math.max(p.wpm, p.raw))) * 1.1;
    const x = (t: number) => pad.l + (t / maxT) * (W - pad.l - pad.r);
    const y = (v: number) => H - pad.b - (Math.min(v, maxY) / maxY) * (H - pad.t - pad.b);
    const line = (key: "wpm" | "raw") => s.map((p) => `${x(p.t).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
    const yt = [0, 0.5, 1].map((f) => ({ v: Math.round(maxY * f), y: y(maxY * f) }));
    const xt = [0, 0.5, 1].map((f) => ({ v: Math.round(maxT * f), x: x(maxT * f) }));
    return { W, H, wpm: line("wpm"), raw: line("raw"), yt, xt, pad };
});

const timeLeft = computed(() => (limit.value ? Math.max(0, Math.ceil(limit.value - elapsed.value)) : null));
const liveWpm = computed(() => {
    if (status.value !== "running" || elapsed.value < 1) return 0;
    return Math.round(stats().correct / 5 / (elapsed.value / 60));
});
const progress = computed(() => `${Math.min(wi.value, words.value.length)}/${words.value.length}`);

function fmtDate(t: number) {
    return new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
const bestVal = computed(() => best.value[bestKey.value]);

onDeactivated(() => {
    stopTimer();
    reset();
});
onBeforeUnmount(stopTimer);
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="settings.mode" :options="[{ value: 'time', label: 'Time' }, { value: 'words', label: 'Words' }]" />
        </template>

        <Panel>
            <div class="flex flex-wrap items-center gap-x-5 gap-y-3">
                <Tabs v-if="settings.mode === 'time'" v-model="settings.time" size="sm" :options="[15, 30, 60, 120].map((v) => ({ value: v, label: `${v}s` }))" />
                <Tabs v-else v-model="settings.words" size="sm" :options="[25, 50, 100].map((v) => ({ value: v, label: String(v) }))" />
                <Tabs v-model="settings.source" size="sm" :options="[{ value: 'words', label: 'Words' }, { value: 'quotes', label: 'Quotes' }, { value: 'code', label: 'Code' }]" />
                <label class="flex items-center gap-1.5 text-sm" :class="settings.source === 'words' ? 'cursor-pointer text-fg' : 'text-muted'">
                    <input v-model="settings.punctuation" type="checkbox" class="checkbox" :disabled="settings.source !== 'words'" /> Punctuation
                </label>
                <label class="flex items-center gap-1.5 text-sm" :class="settings.source === 'words' ? 'cursor-pointer text-fg' : 'text-muted'">
                    <input v-model="settings.numbers" type="checkbox" class="checkbox" :disabled="settings.source !== 'words'" /> Numbers
                </label>
                <span v-if="bestVal" class="chip ml-auto"><Trophy class="size-3.5 text-accent" /> Best {{ bestVal }} WPM</span>
            </div>
        </Panel>

        <input
            ref="inputEl"
            class="pointer-events-none absolute size-0 opacity-0"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            aria-label="Typing input"
            @keydown="onKeydown"
            @input="onInput"
            @focus="focused = true"
            @blur="focused = false"
        />

        <Panel v-if="status !== 'done'">
            <div class="mb-3 flex items-center justify-between font-mono text-lg tabular-nums text-accent">
                <span>{{ timeLeft !== null ? timeLeft + "s" : progress }}</span>
                <span class="text-sm text-muted">{{ liveWpm }} wpm</span>
            </div>
            <div class="relative cursor-text" @click="inputEl?.focus()">
                <div class="overflow-hidden font-mono text-2xl leading-10 select-none" :style="{ height: LINE * 3 + 'px' }" :class="focused ? '' : 'blur-[3px]'">
                    <div class="relative flex flex-wrap gap-x-[1ch] transition-transform duration-100" :style="{ transform: `translateY(-${shift}px)` }">
                        <span v-for="(w, i) in words" :key="i + w" :ref="(el) => setEl(el, i)" class="inline-block">
                            <span v-for="(c, k) in chars(i)" :key="k" :class="c.cls">{{ c.ch }}</span>
                        </span>
                    </div>
                </div>
                <div v-if="!focused" class="absolute inset-0 grid place-items-center">
                    <span class="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-medium text-fg shadow-float ring-1 ring-line"><MousePointerClick class="size-4" /> Click here to focus</span>
                </div>
            </div>
            <div class="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span class="inline-flex items-center gap-1.5"><Keyboard class="size-3.5" /> <span class="kbd">Tab</span> + <span class="kbd">Enter</span> to restart</span>
                <Btn size="sm" variant="ghost" @click="reset(true)"><RotateCcw /> Restart</Btn>
            </div>
        </Panel>

        <template v-else-if="result">
            <Notice v-if="result.pb" type="success">New personal best for this mode: {{ result.wpm }} WPM.</Notice>
            <Panel title="Results">
                <template #actions><Btn size="sm" variant="primary" @click="reset(true)"><RotateCcw /> Try again</Btn></template>
                <div class="grid gap-5 lg:grid-cols-[200px_1fr]">
                    <div class="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-1">
                        <div><div class="text-xs text-muted">WPM</div><div class="font-display text-4xl font-semibold text-accent tabular-nums">{{ Math.round(result.wpm) }}</div></div>
                        <div><div class="text-xs text-muted">Accuracy</div><div class="font-display text-4xl font-semibold tabular-nums">{{ Math.round(result.acc) }}%</div></div>
                    </div>
                    <div class="min-w-0">
                        <svg v-if="chart" :viewBox="`0 0 ${chart.W} ${chart.H}`" class="w-full" role="img" aria-label="WPM per second">
                            <g font-size="9" fill="var(--fg-muted)">
                                <g v-for="t in chart.yt" :key="'y' + t.v">
                                    <line :x1="chart.pad.l" :x2="chart.W - chart.pad.r" :y1="t.y" :y2="t.y" stroke="var(--line)" stroke-width="1" />
                                    <text :x="chart.pad.l - 4" :y="t.y + 3" text-anchor="end">{{ t.v }}</text>
                                </g>
                                <text v-for="t in chart.xt" :key="'x' + t.v" :x="t.x" :y="chart.H - 4" text-anchor="middle">{{ t.v }}s</text>
                            </g>
                            <polyline :points="chart.raw" fill="none" stroke="var(--fg-subtle)" stroke-width="1.5" stroke-dasharray="3 3" stroke-linejoin="round" />
                            <polyline :points="chart.wpm" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
                        </svg>
                        <p v-else class="text-sm text-muted">Not enough data for a chart.</p>
                        <div class="mt-1 flex gap-4 text-xs text-muted">
                            <span class="inline-flex items-center gap-1.5"><span class="h-0.5 w-4 bg-accent" /> WPM</span>
                            <span class="inline-flex items-center gap-1.5"><span class="h-0 w-4 border-t-2 border-dashed border-fg-subtle" /> Raw (per second)</span>
                        </div>
                    </div>
                </div>
                <dl class="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm sm:grid-cols-4">
                    <div><dt class="text-xs text-muted">Raw WPM</dt><dd class="font-semibold tabular-nums">{{ Math.round(result.raw) }}</dd></div>
                    <div><dt class="text-xs text-muted">Consistency</dt><dd class="font-semibold tabular-nums">{{ result.consistency }}%</dd></div>
                    <div><dt class="text-xs text-muted">Correct / incorrect chars</dt><dd class="font-semibold tabular-nums"><span class="text-accent">{{ result.correct }}</span> / <span class="text-danger">{{ result.incorrect }}</span></dd></div>
                    <div><dt class="text-xs text-muted">Time</dt><dd class="font-semibold tabular-nums">{{ result.time }}s</dd></div>
                </dl>
            </Panel>
        </template>

        <Panel title="History (last 20)" flush>
            <template #actions><Btn v-if="history.length" size="sm" variant="ghost" @click="history = []"><Trash2 /> Clear</Btn></template>
            <p v-if="!history.length" class="p-4 text-sm text-muted">No tests yet. Finish a test to record it here.</p>
            <div v-else class="max-h-72 overflow-auto">
                <table class="w-full text-sm">
                    <thead class="sticky top-0 bg-surface text-left text-xs text-muted uppercase">
                        <tr><th class="px-4 py-2 font-medium">When</th><th class="px-4 py-2 font-medium">Mode</th><th class="px-4 py-2 font-medium">WPM</th><th class="px-4 py-2 font-medium">Raw</th><th class="px-4 py-2 font-medium">Acc</th></tr>
                    </thead>
                    <tbody class="divide-y divide-line border-t border-line">
                        <tr v-for="h in history" :key="h.at">
                            <td class="px-4 py-2 whitespace-nowrap text-muted">{{ fmtDate(h.at) }}</td>
                            <td class="px-4 py-2 whitespace-nowrap">{{ h.mode === "time" ? h.value + "s" : h.value + " words" }} · {{ h.source }}</td>
                            <td class="px-4 py-2 font-semibold tabular-nums">{{ h.wpm }}</td>
                            <td class="px-4 py-2 tabular-nums">{{ h.raw }}</td>
                            <td class="px-4 py-2 tabular-nums">{{ h.acc }}%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </Panel>
    </ToolPage>
</template>

<style scoped>
.caret-l {
    box-shadow: inset 2px 0 0 var(--accent);
    animation: caret-l 1s steps(1) infinite;
}
.caret-r {
    box-shadow: inset -2px 0 0 var(--accent);
    animation: caret-r 1s steps(1) infinite;
}
@keyframes caret-l {
    50% {
        box-shadow: none;
    }
}
@keyframes caret-r {
    50% {
        box-shadow: none;
    }
}
</style>
