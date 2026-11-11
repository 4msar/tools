<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from "vue";
import { Play } from "lucide-vue-next";
import { Btn, CopyButton, Field, Panel, ToolPage } from "@/components/ui";

const p = reactive({ x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 });
const duration = ref(1);

const presets: { name: string; v: [number, number, number, number] }[] = [
    { name: "ease", v: [0.25, 0.1, 0.25, 1] }, { name: "linear", v: [0, 0, 1, 1] }, { name: "ease-in", v: [0.42, 0, 1, 1] },
    { name: "ease-out", v: [0, 0, 0.58, 1] }, { name: "ease-in-out", v: [0.42, 0, 0.58, 1] },
    { name: "in-quad", v: [0.11, 0, 0.5, 0] }, { name: "out-quad", v: [0.5, 1, 0.89, 1] }, { name: "in-out-quad", v: [0.45, 0, 0.55, 1] },
    { name: "in-cubic", v: [0.32, 0, 0.67, 0] }, { name: "out-cubic", v: [0.33, 1, 0.68, 1] }, { name: "in-out-cubic", v: [0.65, 0, 0.35, 1] },
    { name: "in-quart", v: [0.5, 0, 0.75, 0] }, { name: "out-quart", v: [0.25, 1, 0.5, 1] }, { name: "in-out-quart", v: [0.76, 0, 0.24, 1] },
    { name: "in-expo", v: [0.7, 0, 0.84, 0] }, { name: "out-expo", v: [0.16, 1, 0.3, 1] }, { name: "in-out-expo", v: [0.87, 0, 0.13, 1] },
    { name: "in-circ", v: [0.55, 0, 1, 0.45] }, { name: "out-circ", v: [0, 0.55, 0.45, 1] },
    { name: "in-back", v: [0.36, 0, 0.66, -0.56] }, { name: "out-back", v: [0.34, 1.56, 0.64, 1] }, { name: "in-out-back", v: [0.68, -0.6, 0.32, 1.6] },
];

const r = (n: number) => Math.round(n * 100) / 100;
const value = computed(() => `cubic-bezier(${r(p.x1)}, ${r(p.y1)}, ${r(p.x2)}, ${r(p.y2)})`);
const activePreset = computed(() => presets.find((x) => x.v.every((n, i) => n === [r(p.x1), r(p.y1), r(p.x2), r(p.y2)][i]))?.name ?? "");
function apply(v: [number, number, number, number]) {
    [p.x1, p.y1, p.x2, p.y2] = v;
    play();
}

// Graph: x 0..1 maps to 0..SIZE, y from -0.5..1.5 so overshoot is visible.
const SIZE = 260;
const PAD = SIZE / 2;
const H = SIZE + PAD * 2;
const gx = (x: number) => x * SIZE;
const gy = (y: number) => PAD + (1 - y) * SIZE;
const path = computed(() => `M0,${gy(0)} C${gx(p.x1)},${gy(p.y1)} ${gx(p.x2)},${gy(p.y2)} ${SIZE},${gy(1)}`);

const svg = ref<SVGSVGElement | null>(null);
let dragging: 1 | 2 | null = null;
function move(e: PointerEvent) {
    if (!dragging || !svg.value) return;
    const rect = svg.value.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, ((e.clientX - rect.left) / rect.width)));
    const y = Math.min(1.5, Math.max(-0.5, 1 - (((e.clientY - rect.top) / rect.height) * H - PAD) / SIZE));
    if (dragging === 1) [p.x1, p.y1] = [r(x), r(y)];
    else [p.x2, p.y2] = [r(x), r(y)];
}
function down(which: 1 | 2, e: PointerEvent) {
    dragging = which;
    (e.target as Element).setPointerCapture(e.pointerId);
}
function up() {
    if (dragging) play();
    dragging = null;
}
function key(which: 1 | 2, e: KeyboardEvent) {
    const step = e.shiftKey ? 0.1 : 0.01;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (!d) return;
    e.preventDefault();
    const [kx, ky] = which === 1 ? (["x1", "y1"] as const) : (["x2", "y2"] as const);
    p[kx] = r(Math.min(1, Math.max(0, p[kx] + d[0])));
    p[ky] = r(Math.min(1.5, Math.max(-0.5, p[ky] + d[1])));
}

// Preview animation: toggling the flag moves the balls to the other side.
const moved = ref(false);
let timer = 0;
function play() {
    clearTimeout(timer);
    timer = window.setTimeout(() => (moved.value = !moved.value), 30);
}
onBeforeUnmount(() => clearTimeout(timer));

const css = computed(() => `transition: transform ${duration.value}s ${value.value};\n\n/* or as a custom property */\n--ease: ${value.value};\nanimation-timing-function: var(--ease);`);
const tailwind = computed(() => `ease-[cubic-bezier(${r(p.x1)},${r(p.y1)},${r(p.x2)},${r(p.y2)})]`);
const clampX = (k: "x1" | "x2") => (p[k] = Math.min(1, Math.max(0, Number(p[k]) || 0)));
</script>

<template>
    <ToolPage>
        <div class="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
            <Panel title="Curve">
                <svg
                    ref="svg" :viewBox="`-12 0 ${SIZE + 24} ${H}`" class="mx-auto block w-full max-w-[300px] touch-none select-none"
                    role="img" aria-label="Bezier curve editor" @pointermove="move" @pointerup="up" @pointercancel="up"
                >
                    <rect x="0" :y="gy(1)" :width="SIZE" :height="SIZE" class="fill-subtle stroke-line" />
                    <line x1="0" :y1="gy(0)" :x2="SIZE" :y2="gy(1)" class="stroke-line" stroke-dasharray="4 4" />
                    <line x1="0" :y1="gy(0)" :x2="gx(p.x1)" :y2="gy(p.y1)" class="stroke-muted" stroke-width="1.5" />
                    <line :x1="SIZE" :y1="gy(1)" :x2="gx(p.x2)" :y2="gy(p.y2)" class="stroke-muted" stroke-width="1.5" />
                    <path :d="path" fill="none" class="stroke-accent" stroke-width="3.5" stroke-linecap="round" />
                    <circle
                        :cx="gx(p.x1)" :cy="gy(p.y1)" r="9" tabindex="0" role="slider" aria-label="First control point" :aria-valuetext="`${p.x1}, ${p.y1}`"
                        class="cursor-grab fill-danger stroke-surface outline-none focus-visible:stroke-fg" stroke-width="2.5" @pointerdown="down(1, $event)" @keydown="key(1, $event)"
                    />
                    <circle
                        :cx="gx(p.x2)" :cy="gy(p.y2)" r="9" tabindex="0" role="slider" aria-label="Second control point" :aria-valuetext="`${p.x2}, ${p.y2}`"
                        class="cursor-grab fill-info stroke-surface outline-none focus-visible:stroke-fg" stroke-width="2.5" @pointerdown="down(2, $event)" @keydown="key(2, $event)"
                    />
                </svg>
                <div class="mt-3 grid grid-cols-4 gap-2">
                    <Field label="x1"><input v-model.number="p.x1" type="number" step="0.01" min="0" max="1" class="input !px-2" @change="clampX('x1')" /></Field>
                    <Field label="y1"><input v-model.number="p.y1" type="number" step="0.01" class="input !px-2" /></Field>
                    <Field label="x2"><input v-model.number="p.x2" type="number" step="0.01" min="0" max="1" class="input !px-2" @change="clampX('x2')" /></Field>
                    <Field label="y2"><input v-model.number="p.y2" type="number" step="0.01" class="input !px-2" /></Field>
                </div>
            </Panel>

            <div class="flex min-w-0 flex-col gap-4">
                <Panel title="Preview">
                    <template #actions>
                        <label class="flex items-center gap-2 text-xs text-muted">Duration
                            <input v-model.number="duration" type="range" min="0.2" max="3" step="0.1" class="range !w-28" /> <span class="w-8 font-mono text-fg">{{ duration }}s</span>
                        </label>
                        <Btn size="sm" variant="primary" @click="play"><Play /> Play</Btn>
                    </template>
                    <div class="flex flex-col gap-3">
                        <div v-for="row in [{ label: 'Yours', ease: value, cls: 'bg-accent' }, { label: 'linear', ease: 'linear', cls: 'bg-muted' }]" :key="row.label" class="flex items-center gap-3">
                            <span class="w-12 shrink-0 text-xs text-muted">{{ row.label }}</span>
                            <div class="relative h-9 flex-1 rounded-full bg-subtle px-1">
                                <div class="absolute top-1 left-1 size-7 rounded-full motion-reduce:!transition-none" :class="row.cls" :style="{ left: moved ? 'calc(100% - 2rem)' : '0.25rem', transition: `left ${duration}s ${row.ease}` }" />
                            </div>
                        </div>
                    </div>
                </Panel>

                <Panel title="CSS" flush>
                    <template #actions><CopyButton :text="value" label="Copy value" /><CopyButton :text="css" label="Copy CSS" /></template>
                    <pre class="overflow-auto p-4 font-mono text-[13px]">{{ css }}</pre>
                    <div class="flex items-center justify-between gap-2 border-t border-line px-4 py-2">
                        <code class="min-w-0 font-mono text-xs break-all text-muted">Tailwind: {{ tailwind }}</code><CopyButton :text="tailwind" icon-only />
                    </div>
                </Panel>

                <Panel title="Presets">
                    <div class="flex flex-wrap gap-1.5">
                        <button
                            v-for="x in presets" :key="x.name" type="button" class="cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors"
                            :class="activePreset === x.name ? 'border-accent bg-accent/10 font-medium' : 'border-line text-muted hover:text-fg'" @click="apply(x.v)"
                        >{{ x.name }}</button>
                    </div>
                </Panel>
            </div>
        </div>
    </ToolPage>
</template>
