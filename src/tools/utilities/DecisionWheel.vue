<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useStorage } from "@vueuse/core";
import { Coins, Dices, RotateCw, Trash2 } from "lucide-vue-next";
import { Btn, CopyButton, Field, Panel, Tabs, ToolPage } from "@/components/ui";

type Mode = "wheel" | "pick" | "coin" | "teams";
const mode = useStorage<Mode>("tools:wheel:mode", "wheel");
const text = useStorage("tools:wheel:options", "Pizza\nTacos\nSushi\nBurgers\nSalad\nPasta");
const sound = useStorage("tools:wheel:sound", true);
const eliminate = useStorage("tools:wheel:eliminate", false);

// Wheel size. "fit" fills the panel width but stays short enough to keep the Spin button on screen.
type WheelSize = "sm" | "md" | "lg" | "fit";
const wheelSize = useStorage<WheelSize>("tools:wheel:size", "fit");
const wheelSizeOptions: { value: WheelSize; label: string }[] = [
    { value: "sm", label: "S" },
    { value: "md", label: "M" },
    { value: "lg", label: "L" },
    { value: "fit", label: "Fit" },
];
const wheelMaxWidth = computed(() => ({ sm: "20rem", md: "28rem", lg: "40rem", fit: "max(18rem, calc(100dvh - 20rem))" })[wheelSize.value]);

const options = computed(() => text.value.split("\n").map((s) => s.trim()).filter(Boolean));

// secure random int in [0, n)
function rnd(n: number) {
    if (n <= 1) return 0;
    const lim = Math.floor(0x100000000 / n) * n;
    const b = new Uint32Array(1);
    do crypto.getRandomValues(b);
    while (b[0] >= lim);
    return b[0] % n;
}
function shuffle<T>(a: T[]) {
    const r = [...a];
    for (let i = r.length - 1; i > 0; i--) {
        const j = rnd(i + 1);
        [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
}

const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Wheel ----------
const palette = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316", "#84cc16"];
const color = (i: number, n: number) => (i === n - 1 && n > 1 && n % palette.length === 1 ? "#64748b" : palette[i % palette.length]);
const angle = ref(0); // radians, rotation of wheel
const spinning = ref(false);
const winner = ref<number | null>(null);
let raf = 0;
const SIZE = 400;
const cx = SIZE / 2;
const R = SIZE / 2 - 6;

function pt(a: number, r = R) {
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cx + r * Math.sin(a)).toFixed(2)}`;
}
const segments = computed(() => {
    const n = options.value.length;
    return options.value.map((label, i) => {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        const mid = (a0 + a1) / 2;
        const path = n === 1 ? "" : `M ${cx} ${cx} L ${pt(a0)} A ${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(a1)} Z`;
        const max = n > 12 ? 14 : 20;
        return { label, path, fill: color(i, n), mid, text: label.length > max ? label.slice(0, max - 1) + "…" : label, fs: n > 16 ? 10 : n > 8 ? 13 : 16 };
    });
});

let actx: AudioContext | null = null;
function tick() {
    if (!sound.value) return;
    try {
        actx ??= new AudioContext();
        if (actx.state === "suspended") void actx.resume();
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = "triangle";
        o.frequency.value = 900;
        const t = actx.currentTime;
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        o.connect(g).connect(actx.destination);
        o.start(t);
        o.stop(t + 0.06);
    } catch {
        /* audio unavailable */
    }
}

function spin() {
    if (eliminate.value && winner.value != null && !spinning.value) removeWinner();
    const n = options.value.length;
    if (spinning.value || n < 2) return;
    winner.value = null;
    spinning.value = true;
    const dur = reduced ? 900 : 4000;
    const start = angle.value;
    const turns = reduced ? 1 : 5 + rnd(3);
    const delta = turns * Math.PI * 2 + (rnd(100000) / 100000) * Math.PI * 2;
    const t0 = performance.now();
    let lastSeg = -1;
    const seg = (a: number) => {
        // pointer at top (-90deg): wheel-local angle under pointer
        const local = (((-Math.PI / 2 - a) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        return Math.floor((local / (Math.PI * 2)) * n) % n;
    };
    const step = (t: number) => {
        const p = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - p, 4);
        angle.value = start + delta * e;
        const s = seg(angle.value);
        if (lastSeg !== -1 && s !== lastSeg) tick();
        lastSeg = s;
        if (p < 1) raf = requestAnimationFrame(step);
        else {
            spinning.value = false;
            winner.value = s;
        }
    };
    raf = requestAnimationFrame(step);
}
const winnerLabel = computed(() => (winner.value != null ? options.value[winner.value] : ""));
function removeWinner() {
    if (winner.value == null) return;
    const list = options.value.slice();
    list.splice(winner.value, 1);
    text.value = list.join("\n");
    winner.value = null;
}
watch(options, (o, prev) => {
    if (!spinning.value && o.join("\n") !== prev.join("\n")) winner.value = null;
});
onBeforeUnmount(() => {
    cancelAnimationFrame(raf);
    void actx?.close();
});

// ---------- Pick ----------
const pickN = ref(1);
const picked = ref<string[]>([]);
function pick() {
    const n = Math.min(Math.max(1, Math.floor(pickN.value) || 1), options.value.length);
    picked.value = shuffle(options.value).slice(0, n);
}

// ---------- Coin & dice ----------
const coin = ref<"Heads" | "Tails" | "">("");
const coinCount = ref({ Heads: 0, Tails: 0 });
const flipping = ref(false);
function flip() {
    flipping.value = true;
    setTimeout(() => {
        const r = rnd(2) ? "Heads" : "Tails";
        coin.value = r;
        coinCount.value[r]++;
        flipping.value = false;
    }, reduced ? 0 : 500);
}
const diceN = ref(2);
const diceM = ref(6);
const diceMod = ref(0);
const dice = ref<{ rolls: number[]; total: number } | null>(null);
function roll() {
    const n = Math.min(100, Math.max(1, Math.floor(diceN.value) || 1));
    const m = Math.min(1000, Math.max(2, Math.floor(diceM.value) || 6));
    const rolls = Array.from({ length: n }, () => rnd(m) + 1);
    dice.value = { rolls, total: rolls.reduce((a, b) => a + b, 0) + (Number(diceMod.value) || 0) };
}

// ---------- Teams ----------
const teamN = ref(2);
const teams = ref<string[][]>([]);
function split() {
    const n = Math.min(Math.max(1, Math.floor(teamN.value) || 1), Math.max(1, options.value.length));
    const out: string[][] = Array.from({ length: n }, () => []);
    shuffle(options.value).forEach((o, i) => out[i % n].push(o));
    teams.value = out;
}
const teamsText = computed(() => teams.value.map((t, i) => `Team ${i + 1}: ${t.join(", ")}`).join("\n"));
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="mode" :options="[{ value: 'wheel', label: 'Wheel' }, { value: 'pick', label: 'Pick' }, { value: 'coin', label: 'Coin & dice' }, { value: 'teams', label: 'Teams' }]" />
        </template>

        <div class="grid gap-4" :class="mode === 'coin' ? '' : 'lg:grid-cols-[1fr_20rem]'">
            <Panel v-if="mode === 'wheel'" title="Wheel">
                <template #actions>
                    <span class="mr-1 text-xs text-muted">Size</span>
                    <Tabs v-model="wheelSize" size="sm" :options="wheelSizeOptions" />
                </template>
                <div class="flex flex-col items-center gap-4">
                    <div v-if="options.length < 2" class="py-16 text-sm text-muted">Add at least two options.</div>
                    <div v-else class="relative w-full" :style="{ maxWidth: wheelMaxWidth }">
                        <svg viewBox="0 0 400 400" class="block w-full drop-shadow-sm" role="img" aria-label="Decision wheel">
                            <g :style="{ transform: `rotate(${angle}rad)`, transformOrigin: '200px 200px' }">
                                <template v-for="(s, i) in segments" :key="i">
                                    <path v-if="s.path" :d="s.path" :fill="s.fill" stroke="rgba(255,255,255,0.7)" stroke-width="2" />
                                    <text :x="cx + R * 0.93" :y="cx" text-anchor="end" dominant-baseline="central" fill="#fff" :font-size="s.fs" font-weight="600" :transform="`rotate(${(s.mid * 180) / Math.PI} ${cx} ${cx})`" style="paint-order: stroke; stroke: rgba(0,0,0,0.25); stroke-width: 2px">{{ s.text }}</text>
                                </template>
                            </g>
                            <circle :cx="cx" :cy="cx" r="18" fill="currentColor" class="text-surface" stroke="currentColor" stroke-width="3" />
                            <polygon points="200,34 186,4 214,4" fill="currentColor" class="text-fg" transform="translate(0 -2)" />
                        </svg>
                    </div>
                    <Btn variant="primary" :disabled="spinning || options.length < 2" @click="spin"><RotateCw class="size-4" :class="spinning ? 'animate-spin' : ''" />{{ spinning ? "Spinning…" : "Spin" }}</Btn>
                    <div v-if="winnerLabel && !spinning" class="w-full rounded-lg bg-accent-soft px-4 py-3 text-center">
                        <div class="text-xs text-muted uppercase">Winner</div>
                        <div class="text-2xl font-semibold break-words text-accent">{{ winnerLabel }}</div>
                        <div class="mt-2 flex justify-center gap-2">
                            <Btn size="sm" @click="removeWinner"><Trash2 class="size-4" />Remove winner</Btn>
                            <CopyButton :text="winnerLabel" size="sm" label="Copy" />
                        </div>
                    </div>
                </div>
            </Panel>

            <Panel v-else-if="mode === 'pick'" title="Pick random items">
                <div class="flex flex-col gap-4">
                    <div class="flex flex-wrap items-end gap-3">
                        <Field label="How many"><input v-model.number="pickN" type="number" min="1" :max="Math.max(1, options.length)" class="input w-28" /></Field>
                        <Btn variant="primary" :disabled="!options.length" @click="pick">Pick</Btn>
                    </div>
                    <ol v-if="picked.length" class="flex flex-col gap-2">
                        <li v-for="(p, i) in picked" :key="i" class="flex items-center gap-3 rounded-lg bg-subtle px-3 py-2"><span class="w-6 text-sm text-muted">{{ i + 1 }}.</span><span class="font-medium break-words">{{ p }}</span></li>
                    </ol>
                    <div v-if="picked.length" class="flex gap-2"><CopyButton :text="picked.join('\n')" label="Copy" size="sm" /></div>
                    <p class="text-xs text-muted">Items are drawn without replacement using the browser's cryptographic random generator.</p>
                </div>
            </Panel>

            <template v-else-if="mode === 'coin'">
                <div class="grid gap-4 lg:grid-cols-2">
                    <Panel title="Coin flip">
                        <div class="flex flex-col items-center gap-4 py-2">
                            <div class="flex size-28 items-center justify-center rounded-full border-4 border-accent bg-accent-soft text-lg font-semibold text-accent transition-transform duration-500" :class="flipping ? 'rotate-y-180 scale-90' : ''">{{ flipping ? "…" : coin || "?" }}</div>
                            <Btn variant="primary" :disabled="flipping" @click="flip"><Coins class="size-4" />Flip</Btn>
                            <p class="text-xs text-muted">Heads {{ coinCount.Heads }} · Tails {{ coinCount.Tails }}</p>
                        </div>
                    </Panel>
                    <Panel title="Dice">
                        <div class="flex flex-col gap-4">
                            <div class="grid grid-cols-3 gap-2">
                                <Field label="Dice (N)"><input v-model.number="diceN" type="number" min="1" max="100" class="input" /></Field>
                                <Field label="Sides (M)"><input v-model.number="diceM" type="number" min="2" max="1000" class="input" /></Field>
                                <Field label="Modifier"><input v-model.number="diceMod" type="number" class="input" /></Field>
                            </div>
                            <div class="flex flex-wrap items-center gap-1.5">
                                <button v-for="m in [4, 6, 8, 10, 12, 20, 100]" :key="m" type="button" class="chip cursor-pointer hover:bg-subtle" @click="diceM = m">d{{ m }}</button>
                            </div>
                            <Btn variant="primary" @click="roll"><Dices class="size-4" />Roll {{ diceN }}d{{ diceM }}{{ diceMod ? (diceMod > 0 ? "+" : "") + diceMod : "" }}</Btn>
                            <div v-if="dice" class="rounded-lg bg-subtle p-3">
                                <div class="text-3xl font-semibold tabular-nums">{{ dice.total }}</div>
                                <div class="mt-1 font-mono text-xs break-words text-muted">[{{ dice.rolls.join(", ") }}]</div>
                            </div>
                        </div>
                    </Panel>
                </div>
            </template>

            <Panel v-else title="Random teams">
                <div class="flex flex-col gap-4">
                    <div class="flex flex-wrap items-end gap-3">
                        <Field label="Number of teams"><input v-model.number="teamN" type="number" min="1" :max="Math.max(1, options.length)" class="input w-28" /></Field>
                        <Btn variant="primary" :disabled="!options.length" @click="split">Split</Btn>
                        <CopyButton v-if="teams.length" :text="teamsText" label="Copy" size="sm" />
                    </div>
                    <div v-if="teams.length" class="grid gap-3 sm:grid-cols-2">
                        <div v-for="(t, i) in teams" :key="i" class="rounded-lg border border-line p-3">
                            <div class="mb-1.5 flex items-center gap-2 text-sm font-semibold"><span class="size-2.5 rounded-full" :style="{ background: palette[i % palette.length] }" />Team {{ i + 1 }}<span class="font-normal text-muted">({{ t.length }})</span></div>
                            <ul class="text-sm"><li v-for="m in t" :key="m" class="py-0.5 break-words">{{ m }}</li></ul>
                        </div>
                    </div>
                </div>
            </Panel>

            <Panel v-if="mode !== 'coin'" title="Options">
                <template #actions><span class="text-xs text-muted">{{ options.length }} items</span></template>
                <textarea v-model="text" class="input min-h-48 font-mono" rows="10" spellcheck="false" placeholder="One option per line" />
                <label v-if="mode === 'wheel'" class="mt-3 flex cursor-pointer items-center gap-2 text-sm"><input v-model="sound" type="checkbox" class="checkbox" />Tick sound</label>
                <label v-if="mode === 'wheel'" class="mt-2 flex cursor-pointer items-center gap-2 text-sm"><input v-model="eliminate" type="checkbox" class="checkbox" />Elimination mode (previous winner is removed on next spin)</label>
            </Panel>
        </div>
    </ToolPage>
</template>
