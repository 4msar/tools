<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import {
    Copy, Download, Eraser, FlipHorizontal2, FlipVertical2, Grid3x3, ImageUp, Layers, PaintBucket, Pause, Pencil, Pipette, Play, Plus, Redo2, Slash, Square, Trash2, Undo2,
} from "lucide-vue-next";
import { Btn, Field, Notice, Panel, ToolPage } from "@/components/ui";
import { downloadBlob } from "@/composables/useClipboard";

type Tool = "pencil" | "eraser" | "fill" | "picker" | "line" | "rect";
const tools: { id: Tool; label: string; key: string; icon: typeof Pencil }[] = [
    { id: "pencil", label: "Pencil", key: "B", icon: Pencil },
    { id: "eraser", label: "Eraser", key: "E", icon: Eraser },
    { id: "fill", label: "Fill", key: "G", icon: PaintBucket },
    { id: "picker", label: "Color picker", key: "I", icon: Pipette },
    { id: "line", label: "Line", key: "L", icon: Slash },
    { id: "rect", label: "Rectangle", key: "R", icon: Square },
];
const PALETTES: Record<string, string[]> = {
    "PICO-8": ["#000000", "#1d2b53", "#7e2553", "#008751", "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8", "#ff004d", "#ffa300", "#ffec27", "#00e436", "#29adff", "#83769c", "#ff77a8", "#ffccaa"],
    "Sweetie 16": ["#1a1c2c", "#5d275d", "#b13e53", "#ef7d57", "#ffcd75", "#a7f070", "#38b764", "#257179", "#29366f", "#3b5dc9", "#41a6f6", "#73eff7", "#f4f4f4", "#94b0c2", "#566c86", "#333c57"],
    "Handheld green": ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"],
    "Grayscale": ["#000000", "#242424", "#494949", "#6d6d6d", "#929292", "#b6b6b6", "#dbdbdb", "#ffffff"],
};

const size = ref(16);
const tool = ref<Tool>("pencil");
const color = ref("#ff004d");
const paletteName = ref("PICO-8");
const mirror = ref(false);
const showGrid = ref(true);
const onion = ref(false);
const fps = ref(6);
const playing = ref(true);
const scale = ref(8);
const error = ref("");

const blank = (n = size.value) => new Uint8ClampedArray(n * n * 4);
const frames = shallowRef<Uint8ClampedArray[]>([blank()]);
const cur = ref(0);
const thumbs = ref<string[]>([""]);

const main = ref<HTMLCanvasElement | null>(null);
const ghost = ref<HTMLCanvasElement | null>(null);
const preview = ref<HTMLCanvasElement | null>(null);

// ---- history ----
interface Snap { frames: Uint8ClampedArray[]; cur: number; size: number }
const undoStack = shallowRef<Snap[]>([]);
const redoStack = shallowRef<Snap[]>([]);
const snap = (): Snap => ({ frames: frames.value.map((f) => f.slice()), cur: cur.value, size: size.value });
function remember() {
    undoStack.value = [...undoStack.value.slice(-59), snap()];
    redoStack.value = [];
}
function restore(s: Snap) {
    size.value = s.size;
    frames.value = s.frames.map((f) => f.slice());
    cur.value = Math.min(s.cur, s.frames.length - 1);
    refreshAll();
}
function undo() {
    const s = undoStack.value.at(-1);
    if (!s) return;
    redoStack.value = [...redoStack.value, snap()];
    undoStack.value = undoStack.value.slice(0, -1);
    restore(s);
}
function redo() {
    const s = redoStack.value.at(-1);
    if (!s) return;
    undoStack.value = [...undoStack.value, snap()];
    redoStack.value = redoStack.value.slice(0, -1);
    restore(s);
}

// ---- pixels ----
const rgba = (hex: string): [number, number, number, number] => (/^#[0-9a-f]{6}$/i.test(hex) ? [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255] : [0, 0, 0, 255]);
const toHex = (d: Uint8ClampedArray, i: number) => "#" + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("");
function put(d: Uint8ClampedArray, x: number, y: number, c: number[]) {
    const n = size.value;
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    d.set(c, (y * n + x) * 4);
}
function plot(d: Uint8ClampedArray, x: number, y: number, c: number[]) {
    put(d, x, y, c);
    if (mirror.value) put(d, size.value - 1 - x, y, c);
}
function line(d: Uint8ClampedArray, x0: number, y0: number, x1: number, y1: number, c: number[]) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
        plot(d, x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
    }
}
function rect(d: Uint8ClampedArray, x0: number, y0: number, x1: number, y1: number, c: number[]) {
    const [l, r, t, b] = [Math.min(x0, x1), Math.max(x0, x1), Math.min(y0, y1), Math.max(y0, y1)];
    for (let x = l; x <= r; x++) { plot(d, x, t, c); plot(d, x, b, c); }
    for (let y = t; y <= b; y++) { plot(d, l, y, c); plot(d, r, y, c); }
}
function fill(d: Uint8ClampedArray, x: number, y: number, c: number[]) {
    const n = size.value;
    const at = (px: number, py: number) => (py * n + px) * 4;
    const t = Array.from(d.subarray(at(x, y), at(x, y) + 4));
    if (t.every((v, i) => v === c[i])) return;
    const stack = [[x, y]];
    while (stack.length) {
        const [px, py] = stack.pop()!;
        if (px < 0 || py < 0 || px >= n || py >= n) continue;
        const i = at(px, py);
        if (d[i] !== t[0] || d[i + 1] !== t[1] || d[i + 2] !== t[2] || d[i + 3] !== t[3]) continue;
        d.set(c, i);
        stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
}

// ---- drawing to canvases ----
function paint(c: HTMLCanvasElement | null, data: Uint8ClampedArray | null) {
    if (!c) return;
    const n = size.value;
    if (c.width !== n) c.width = c.height = n;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, n, n);
    if (data) ctx.putImageData(new ImageData(new Uint8ClampedArray(data), n, n), 0, 0);
}
function redraw() {
    paint(main.value, frames.value[cur.value]);
    paint(ghost.value, onion.value && frames.value.length > 1 ? frames.value[(cur.value - 1 + frames.value.length) % frames.value.length] : null);
}
function thumb(data: Uint8ClampedArray) {
    const c = document.createElement("canvas");
    paint(c, data);
    return c.toDataURL();
}
function refreshThumb(i = cur.value) {
    const t = thumbs.value.slice();
    t[i] = thumb(frames.value[i]);
    thumbs.value = t;
}
function refreshAll() {
    thumbs.value = frames.value.map(thumb);
    nextTick(redraw);
}
watch([cur, onion], redraw, { flush: "post" });

// ---- pointer handling ----
let drawing = false;
let start: [number, number] | null = null;
let last: [number, number] | null = null;
let base: Uint8ClampedArray | null = null;
function cell(e: PointerEvent): [number, number] {
    const r = main.value!.getBoundingClientRect();
    const n = size.value;
    return [Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n))), Math.min(n - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * n)))];
}
function down(e: PointerEvent) {
    if (e.button !== 0 && e.button !== 2) return;
    const [x, y] = cell(e);
    const d = frames.value[cur.value];
    const erase = tool.value === "eraser" || e.button === 2;
    if (tool.value === "picker") {
        const i = (y * size.value + x) * 4;
        if (d[i + 3]) color.value = toHex(d, i);
        tool.value = "pencil";
        return;
    }
    remember();
    const c = erase ? [0, 0, 0, 0] : rgba(color.value);
    if (tool.value === "fill" && !erase) {
        fill(d, x, y, c);
        if (mirror.value) fill(d, size.value - 1 - x, y, c);
        redraw();
        refreshThumb();
        return;
    }
    drawing = true;
    start = last = [x, y];
    base = d.slice();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    plot(d, x, y, c);
    redraw();
}
function move(e: PointerEvent) {
    if (!drawing || !last || !start) return;
    const [x, y] = cell(e);
    if (x === last[0] && y === last[1]) return;
    const d = frames.value[cur.value];
    const c = tool.value === "eraser" || e.buttons === 2 ? [0, 0, 0, 0] : rgba(color.value);
    if (tool.value === "line" || tool.value === "rect") {
        d.set(base!); // shapes are redrawn from the stroke's starting state
        (tool.value === "line" ? line : rect)(d, start[0], start[1], x, y, c);
    } else line(d, last[0], last[1], x, y, c);
    last = [x, y];
    redraw();
}
function up() {
    if (!drawing) return;
    drawing = false;
    base = null;
    refreshThumb();
}

// ---- frame operations ----
function setFrames(f: Uint8ClampedArray[], index: number) {
    frames.value = f;
    cur.value = index;
    refreshAll();
}
function addFrame(copy: boolean) {
    if (frames.value.length >= 32) return;
    remember();
    const f = frames.value.slice();
    f.splice(cur.value + 1, 0, copy ? frames.value[cur.value].slice() : blank());
    setFrames(f, cur.value + 1);
}
function removeFrame() {
    if (frames.value.length < 2) return;
    remember();
    setFrames(frames.value.filter((_, i) => i !== cur.value), Math.max(0, cur.value - 1));
}
function clearFrame() {
    remember();
    frames.value[cur.value].fill(0);
    redraw();
    refreshThumb();
}
function flip(horizontal: boolean) {
    remember();
    const n = size.value;
    const src = frames.value[cur.value];
    const out = blank();
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const from = (y * n + x) * 4;
        const to = ((horizontal ? y : n - 1 - y) * n + (horizontal ? n - 1 - x : x)) * 4;
        out.set(src.subarray(from, from + 4), to);
    }
    src.set(out);
    redraw();
    refreshThumb();
}
function resize(n: number) {
    if (n === size.value) return;
    remember();
    const old = size.value;
    const m = Math.min(old, n);
    const next = frames.value.map((f) => {
        const out = new Uint8ClampedArray(n * n * 4);
        for (let y = 0; y < m; y++) out.set(f.subarray(y * old * 4, (y * old + m) * 4), y * n * 4);
        return out;
    });
    size.value = n;
    frames.value = next;
    refreshAll();
}

// ---- animation preview ----
let frameNo = 0;
let timer = 0;
function tick() {
    if (playing.value) frameNo = (frameNo + 1) % frames.value.length;
    else frameNo = cur.value;
    paint(preview.value, frames.value[frameNo % frames.value.length]);
}
function restart() {
    clearInterval(timer);
    timer = window.setInterval(tick, 1000 / Math.min(30, Math.max(1, fps.value || 6)));
}
watch(fps, restart);
onMounted(() => {
    refreshAll();
    restart();
});
onBeforeUnmount(() => clearInterval(timer));

// ---- export / import ----
function render(list: Uint8ClampedArray[], k: number, columns = list.length): HTMLCanvasElement {
    const n = size.value;
    const rows = Math.ceil(list.length / columns);
    const out = document.createElement("canvas");
    out.width = n * k * columns;
    out.height = n * k * rows;
    const ctx = out.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const tmp = document.createElement("canvas");
    list.forEach((f, i) => {
        paint(tmp, f);
        ctx.drawImage(tmp, (i % columns) * n * k, Math.floor(i / columns) * n * k, n * k, n * k);
    });
    return out;
}
const save = (c: HTMLCanvasElement, name: string) => c.toBlob((b) => b && downloadBlob(b, name, "image/png"), "image/png");
const exportFrame = () => save(render([frames.value[cur.value]], scale.value), `sprite-${cur.value + 1}.png`);
function exportSheet() {
    save(render(frames.value, scale.value), "spritesheet.png");
    const n = size.value * scale.value;
    const meta = { frames: frames.value.map((_, i) => ({ x: i * n, y: 0, w: n, h: n })), meta: { size: { w: n * frames.value.length, h: n }, frameRate: fps.value } };
    downloadBlob(JSON.stringify(meta, null, 2), "spritesheet.json", "application/json");
}
function importImage(f: File | undefined) {
    error.value = "";
    if (!f) return;
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
        remember();
        const n = size.value;
        const c = document.createElement("canvas");
        c.width = c.height = n;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.imageSmoothingEnabled = im.naturalWidth > n * 4;
        const s = Math.min(n / im.naturalWidth, n / im.naturalHeight);
        ctx.drawImage(im, (n - im.naturalWidth * s) / 2, (n - im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s);
        const d = ctx.getImageData(0, 0, n, n).data;
        for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 127 ? 255 : 0; // hard alpha edges
        frames.value[cur.value].set(d);
        URL.revokeObjectURL(url);
        redraw();
        refreshThumb();
    };
    im.onerror = () => {
        URL.revokeObjectURL(url);
        error.value = "The browser could not read that image.";
    };
    im.src = url;
}

function onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest("input, select, textarea")) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        return e.shiftKey ? redo() : undo();
    }
    if (mod || e.altKey) return;
    const t = tools.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
    if (t) tool.value = t.id;
    else if (e.key === "ArrowRight") cur.value = (cur.value + 1) % frames.value.length;
    else if (e.key === "ArrowLeft") cur.value = (cur.value - 1 + frames.value.length) % frames.value.length;
    else return;
    e.preventDefault();
}

const gridStyle = computed(() => ({ backgroundSize: `${100 / size.value}% ${100 / size.value}%` }));
const sheetSize = computed(() => `${size.value * scale.value * frames.value.length} × ${size.value * scale.value}`);
</script>

<template>
    <ToolPage>
        <div class="grid gap-4 outline-none lg:grid-cols-[13rem_minmax(0,1fr)_15rem]" tabindex="-1" @keydown="onKey">
            <div class="flex min-w-0 flex-col gap-4">
                <Panel title="Tools">
                    <div class="grid grid-cols-3 gap-1.5">
                        <button
                            v-for="t in tools" :key="t.id" type="button" :title="`${t.label} (${t.key})`" :aria-label="t.label" :aria-pressed="tool === t.id"
                            class="flex h-10 cursor-pointer items-center justify-center rounded-md border transition-colors"
                            :class="tool === t.id ? 'border-accent bg-accent/15 text-fg' : 'border-line text-muted hover:text-fg'" @click="tool = t.id"
                        ><component :is="t.icon" class="size-4" /></button>
                    </div>
                    <div class="mt-3 flex flex-col gap-2 text-sm">
                        <label class="flex items-center gap-2"><input v-model="mirror" type="checkbox" class="checkbox" /> Mirror horizontally</label>
                        <label class="flex items-center gap-2"><input v-model="showGrid" type="checkbox" class="checkbox" /> <Grid3x3 class="size-3.5 text-muted" /> Grid</label>
                        <label class="flex items-center gap-2"><input v-model="onion" type="checkbox" class="checkbox" /> <Layers class="size-3.5 text-muted" /> Onion skin</label>
                    </div>
                </Panel>

                <Panel title="Color">
                    <div class="flex items-center gap-2">
                        <input v-model="color" type="color" class="size-9 shrink-0 cursor-pointer rounded-md border border-line bg-surface" aria-label="Current color" />
                        <input v-model="color" class="input font-mono" maxlength="7" spellcheck="false" aria-label="Current color hex" />
                    </div>
                    <select v-model="paletteName" class="select mt-3" aria-label="Palette"><option v-for="(_, k) in PALETTES" :key="k">{{ k }}</option></select>
                    <div class="mt-2 grid grid-cols-8 gap-1">
                        <button
                            v-for="c in PALETTES[paletteName]" :key="c" type="button" :title="c" :aria-label="`Use ${c}`"
                            class="aspect-square cursor-pointer rounded-sm ring-offset-1 ring-offset-surface" :class="color === c ? 'ring-2 ring-fg' : 'ring-1 ring-line'" :style="{ background: c }" @click="color = c"
                        />
                    </div>
                </Panel>
            </div>

            <Panel :title="`Frame ${cur + 1} of ${frames.length}`">
                <template #actions>
                    <Btn size="sm" variant="ghost" aria-label="Undo" title="Undo (Ctrl+Z)" :disabled="!undoStack.length" @click="undo"><Undo2 /></Btn>
                    <Btn size="sm" variant="ghost" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" :disabled="!redoStack.length" @click="redo"><Redo2 /></Btn>
                    <Btn size="sm" variant="ghost" aria-label="Flip horizontally" title="Flip horizontally" @click="flip(true)"><FlipHorizontal2 /></Btn>
                    <Btn size="sm" variant="ghost" aria-label="Flip vertically" title="Flip vertically" @click="flip(false)"><FlipVertical2 /></Btn>
                    <Btn size="sm" variant="ghost" title="Clear this frame" @click="clearFrame"><Trash2 /> Clear</Btn>
                </template>
                <div class="checker relative mx-auto aspect-square w-full max-w-[32rem] overflow-hidden rounded-lg border border-line">
                    <canvas ref="ghost" class="pix pointer-events-none absolute inset-0 size-full opacity-30" />
                    <canvas
                        ref="main" class="pix absolute inset-0 size-full touch-none" :class="tool === 'picker' ? 'cursor-copy' : 'cursor-crosshair'"
                        aria-label="Drawing canvas" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @contextmenu.prevent
                    />
                    <div v-if="showGrid" class="pixgrid pointer-events-none absolute inset-0" :style="gridStyle" />
                </div>
                <p class="mt-2 text-center text-xs text-muted">Right-click erases. Shortcuts: B pencil, E eraser, G fill, I picker, L line, R rectangle, ← → frames.</p>

                <div class="mt-4 flex items-center gap-2 overflow-x-auto border-t border-line pt-4 pb-1">
                    <button
                        v-for="(t, i) in thumbs" :key="i" type="button" :aria-label="`Frame ${i + 1}`" :aria-pressed="cur === i"
                        class="checker relative size-14 shrink-0 cursor-pointer overflow-hidden rounded-md border-2" :class="cur === i ? 'border-accent' : 'border-line'" @click="cur = i"
                    >
                        <img v-if="t" :src="t" alt="" class="pix size-full" />
                        <span class="absolute right-0.5 bottom-0 rounded bg-black/55 px-1 font-mono text-[9px] text-white">{{ i + 1 }}</span>
                    </button>
                    <div class="flex shrink-0 flex-col gap-1">
                        <Btn size="sm" :disabled="frames.length >= 32" title="Add an empty frame" @click="addFrame(false)"><Plus /> New</Btn>
                        <Btn size="sm" :disabled="frames.length >= 32" title="Duplicate this frame" @click="addFrame(true)"><Copy /> Copy</Btn>
                    </div>
                    <Btn size="sm" variant="ghost" class="shrink-0" :disabled="frames.length < 2" title="Delete this frame" aria-label="Delete frame" @click="removeFrame"><Trash2 /></Btn>
                </div>
            </Panel>

            <div class="flex min-w-0 flex-col gap-4">
                <Panel title="Animation">
                    <template #actions><Btn size="sm" variant="ghost" :aria-label="playing ? 'Pause' : 'Play'" @click="playing = !playing"><component :is="playing ? Pause : Play" /></Btn></template>
                    <div class="checker mx-auto aspect-square w-32 overflow-hidden rounded-lg border border-line"><canvas ref="preview" class="pix size-full" /></div>
                    <Field :label="`${fps} frames per second`" class="mt-3"><input v-model.number="fps" type="range" min="1" max="24" class="range" /></Field>
                </Panel>

                <Panel title="Canvas">
                    <Field label="Size">
                        <select :value="size" class="select" @change="resize(Number(($event.target as HTMLSelectElement).value))">
                            <option v-for="n in [8, 16, 24, 32, 48, 64]" :key="n" :value="n">{{ n }} × {{ n }}</option>
                        </select>
                    </Field>
                    <label class="mt-3 flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-line text-sm font-medium hover:bg-subtle">
                        <ImageUp class="size-4" /> Import image into frame
                        <input type="file" accept="image/*" class="hidden" @change="importImage(($event.target as HTMLInputElement).files?.[0]); ($event.target as HTMLInputElement).value = ''" />
                    </label>
                    <Notice v-if="error" type="error" class="mt-2">{{ error }}</Notice>
                </Panel>

                <Panel title="Export">
                    <Field :label="`Scale: ${scale}× (${size * scale} px per frame)`"><input v-model.number="scale" type="range" min="1" max="32" class="range" /></Field>
                    <div class="mt-3 flex flex-col gap-2">
                        <Btn variant="primary" @click="exportFrame"><Download /> This frame (PNG)</Btn>
                        <Btn @click="exportSheet"><Download /> Sprite sheet + JSON</Btn>
                    </div>
                    <p class="mt-2 text-xs text-muted">Sheet: {{ sheetSize }} px, frames left to right.</p>
                </Panel>
            </div>
        </div>
    </ToolPage>
</template>

<style scoped>
.pix {
    image-rendering: pixelated;
}
.checker {
    background-image: conic-gradient(#8883 25%, transparent 0 50%, #8883 0 75%, transparent 0);
    background-size: 16px 16px;
}
.pixgrid {
    background-image: linear-gradient(to right, #8885 1px, transparent 1px), linear-gradient(to bottom, #8885 1px, transparent 1px);
}
</style>
