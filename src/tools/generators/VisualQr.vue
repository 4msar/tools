<script setup lang="ts">
// Visual QR: draws the QR modules as small dots over a photo so the image shows
// through, keeps the finder / alignment / timing patterns solid, and fades the
// dots over a chosen "subject" area. Scan protection raises dot opacity wherever
// the photo underneath gives too little contrast. Everything runs locally.
import { computed, onBeforeUnmount, reactive, ref, shallowRef, watch } from "vue";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { Download, ImagePlus, RotateCcw, X } from "lucide-vue-next";
import { Btn, Field, Notice, Panel, Tabs } from "@/components/ui";
import { downloadBlob } from "@/composables/useClipboard";

const props = defineProps<{ payload: string }>();

type Shape = "ellipse" | "rect" | "none";
type Level = "L" | "M" | "Q" | "H";
const DEFAULTS = {
    zoom: 1,
    posX: 0,
    posY: 0,
    brightness: 1,
    contrast: 1,
    saturation: 1,
    imageOpacity: 100,
    shape: "ellipse" as Shape,
    focusX: 0,
    focusY: 8,
    focusW: 58,
    focusH: 80,
    feather: 35,
    focusOpacity: 40,
    bgOpacity: 100,
    guard: 50,
    fg: "#000000",
    bg: "#ffffff",
    level: "H" as Level,
    format: "card" as "card" | "stamp",
    scale: 4,
    outline: true,
};
type NumKey = {
    [K in keyof typeof DEFAULTS]: (typeof DEFAULTS)[K] extends number ? K : never;
}[keyof typeof DEFAULTS];
const s = reactive({ ...DEFAULTS });

interface SliderDef { key: NumKey; label: string; min: number; max: number; step: number; fmt: (v: number) => string }
const x2 = (v: number) => `${v.toFixed(2)}×`;
const pct = (v: number) => `${Math.round(v)}%`;
const imageSliders: SliderDef[] = [
    { key: "zoom", label: "Zoom", min: 0.5, max: 4, step: 0.01, fmt: x2 },
    { key: "posX", label: "Position X", min: -100, max: 100, step: 1, fmt: pct },
    { key: "posY", label: "Position Y", min: -100, max: 100, step: 1, fmt: pct },
    { key: "brightness", label: "Brightness", min: 0, max: 2, step: 0.01, fmt: x2 },
    { key: "contrast", label: "Contrast", min: 0, max: 2, step: 0.01, fmt: x2 },
    { key: "saturation", label: "Saturation", min: 0, max: 2, step: 0.01, fmt: x2 },
    { key: "imageOpacity", label: "Opacity", min: 0, max: 100, step: 1, fmt: pct },
];
const shapeSliders: SliderDef[] = [
    { key: "focusX", label: "Horizontal", min: -50, max: 50, step: 1, fmt: pct },
    { key: "focusY", label: "Vertical", min: -50, max: 50, step: 1, fmt: pct },
    { key: "focusW", label: "Width", min: 5, max: 100, step: 1, fmt: pct },
    { key: "focusH", label: "Height", min: 5, max: 100, step: 1, fmt: pct },
    { key: "feather", label: "Soft edge", min: 0, max: 100, step: 1, fmt: pct },
];
const dotSliders: SliderDef[] = [
    { key: "focusOpacity", label: "Dots on the subject", min: 0, max: 100, step: 1, fmt: pct },
    { key: "bgOpacity", label: "Dots on the background", min: 0, max: 100, step: 1, fmt: pct },
    { key: "guard", label: "Scan protection", min: 0, max: 100, step: 1, fmt: pct },
];
const reset = (k: NumKey) => (s[k] = DEFAULTS[k]);
function resetAll() {
    Object.assign(s, { ...DEFAULTS, level: s.level, fg: s.fg, bg: s.bg, format: s.format, scale: s.scale });
}

/* ---------- image ---------- */
const img = shallowRef<HTMLImageElement | null>(null);
const imgName = ref("");
let imgId = 0;
let imgUrl = "";
const fileInput = ref<HTMLInputElement | null>(null);
const dragOver = ref(false);
const imgError = ref("");

function loadFile(f?: File | null) {
    if (!f) return;
    imgError.value = "";
    if (!f.type.startsWith("image/")) {
        imgError.value = "That file is not an image.";
        return;
    }
    const url = URL.createObjectURL(f);
    const el = new Image();
    el.onload = () => {
        if (imgUrl) URL.revokeObjectURL(imgUrl);
        imgUrl = url;
        imgId++;
        layerCache.clear();
        img.value = el;
        imgName.value = f.name;
    };
    el.onerror = () => {
        URL.revokeObjectURL(url);
        imgError.value = "Could not read that image.";
    };
    el.src = url;
}
function onDrop(e: DragEvent) {
    dragOver.value = false;
    loadFile(e.dataTransfer?.files?.[0]);
}
function removeImage() {
    img.value = null;
    imgName.value = "";
    layerCache.clear();
    if (imgUrl) URL.revokeObjectURL(imgUrl);
    imgUrl = "";
}
onBeforeUnmount(() => imgUrl && URL.revokeObjectURL(imgUrl));

// Cover-fit the photo into a size×size square, with zoom/offset and colour tweaks.
const layerCache = new Map<string, HTMLCanvasElement>();
function imageLayer(size: number): HTMLCanvasElement | null {
    const im = img.value;
    if (!im) return null;
    const px = Math.max(16, Math.min(4096, Math.round(size)));
    const key = [imgId, px, s.zoom, s.posX, s.posY, s.brightness, s.contrast, s.saturation].join("|");
    const hit = layerCache.get(key);
    if (hit) return hit;
    const c = document.createElement("canvas");
    c.width = c.height = px;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const iw = im.naturalWidth || px;
    const ih = im.naturalHeight || px;
    const k = Math.max(px / iw, px / ih) * s.zoom;
    const ox = ((s.posX / 100) * px) / 2;
    const oy = ((s.posY / 100) * px) / 2;
    ctx.drawImage(im, (px - iw * k) / 2 + ox, (px - ih * k) / 2 + oy, iw * k, ih * k);
    if (s.brightness !== 1 || s.contrast !== 1 || s.saturation !== 1) {
        const d = ctx.getImageData(0, 0, px, px);
        const a = d.data;
        const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
        for (let i = 0; i < a.length; i += 4) {
            let r = a[i] * s.brightness, g = a[i + 1] * s.brightness, b = a[i + 2] * s.brightness;
            r = (r - 128) * s.contrast + 128;
            g = (g - 128) * s.contrast + 128;
            b = (b - 128) * s.contrast + 128;
            const y = 0.299 * r + 0.587 * g + 0.114 * b;
            a[i] = clamp(y + (r - y) * s.saturation);
            a[i + 1] = clamp(y + (g - y) * s.saturation);
            a[i + 2] = clamp(y + (b - y) * s.saturation);
        }
        ctx.putImageData(d, 0, 0);
    }
    if (layerCache.size > 4) layerCache.delete(layerCache.keys().next().value!);
    layerCache.set(key, c);
    return c;
}

/* ---------- QR matrix + module classification ---------- */
const qrError = ref("");
const qr = computed(() => {
    qrError.value = "";
    if (!props.payload) return null;
    try {
        const q = QRCode.create(props.payload, { errorCorrectionLevel: s.level });
        const n = q.modules.size;
        const dark = q.modules.data as Uint8Array;
        // alignment pattern centres
        const v = q.version;
        let coords: number[] = [];
        if (v > 1) {
            const count = Math.floor(v / 7) + 2;
            const step = n === 145 ? 26 : Math.ceil((n - 13) / (2 * count - 2)) * 2;
            coords = [n - 7];
            for (let i = 1; i < count - 1; i++) coords[i] = coords[i - 1] - step;
            coords.push(6);
            coords.reverse();
        }
        const align: [number, number][] = [];
        for (const r of coords)
            for (const c of coords) {
                if ((r === 6 && c === 6) || (r === 6 && c === n - 7) || (r === n - 7 && c === 6)) continue;
                align.push([r, c]);
            }
        // 0 dot · 1 full (timing) · 2 fixed (format/version info) · 3 skip (drawn as a pattern)
        const kind = new Uint8Array(n * n);
        for (let r = 0; r < n; r++)
            for (let c = 0; c < n; c++) {
                let k = 0;
                if ((r < 8 && c < 8) || (r < 8 && c >= n - 8) || (r >= n - 8 && c < 8)) k = 3;
                else if (align.some(([ar, ac]) => Math.abs(r - ar) <= 2 && Math.abs(c - ac) <= 2)) k = 3;
                else if (r === 6 || c === 6) k = 1;
                else if ((r === 8 && (c <= 8 || c >= n - 8)) || (c === 8 && (r <= 8 || r >= n - 8))) k = 2;
                else if (v >= 7 && ((r < 6 && c >= n - 11 && c < n - 8) || (c < 6 && r >= n - 11 && r < n - 8))) k = 2;
                kind[r * n + c] = k;
            }
        return { n, dark, kind, align };
    } catch (e) {
        qrError.value = e instanceof Error ? e.message : "Could not encode this content.";
        return null;
    }
});

const luma = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

// Soft subject mask: 1 inside, 0 outside, smoothstep across the feathered edge.
function mask(x: number, y: number) {
    if (s.shape === "none") return 0;
    const cx = 0.5 + s.focusX / 100, cy = 0.5 + s.focusY / 100;
    const hw = Math.max(0.01, s.focusW / 200), hh = Math.max(0.01, s.focusH / 200);
    const dx = Math.abs(x - cx) / hw, dy = Math.abs(y - cy) / hh;
    const d = s.shape === "rect" ? Math.max(dx, dy) : Math.hypot(dx, dy);
    const inner = 1 - s.feather / 100;
    if (d <= inner) return 1;
    if (d >= 1) return 0;
    const t = (1 - d) / (1 - inner);
    return t * t * (3 - 2 * t);
}

// Per-module dot opacity plus a share of dots that barely contrast with the photo.
const opacity = computed(() => {
    const q = qr.value;
    if (!q) return null;
    const { n, dark, kind } = q;
    // average luminance of the photo under each module
    let under: Float32Array | null = null;
    const layer = imageLayer(n * 6);
    if (layer) {
        const px = n * 6;
        const c = document.createElement("canvas");
        c.width = c.height = px;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.fillStyle = s.bg;
        ctx.fillRect(0, 0, px, px);
        ctx.globalAlpha = s.imageOpacity / 100;
        ctx.drawImage(layer, 0, 0, px, px);
        const d = ctx.getImageData(0, 0, px, px).data;
        under = new Float32Array(n * n);
        for (let r = 0; r < n; r++)
            for (let col = 0; col < n; col++) {
                let sum = 0;
                for (let y = r * 6; y < r * 6 + 6; y++)
                    for (let x = col * 6; x < col * 6 + 6; x++) {
                        const i = (y * px + x) * 4;
                        sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                    }
                under[r * n + col] = sum / (36 * 255);
            }
    }
    const lo = s.bgOpacity / 100, hi = s.focusOpacity / 100;
    const g = s.guard / 100;
    const floor = g > 0 ? 0.15 + 0.35 * g : 0;
    const fgL = luma(s.fg), bgL = luma(s.bg);
    const op = new Float32Array(n * n).fill(1);
    let total = 0, weak = 0;
    for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
            const i = r * n + c;
            if (kind[i] !== 0) continue;
            total++;
            let a = lo + (hi - lo) * mask((c + 0.5) / n, (r + 0.5) / n);
            const l = under ? under[i] : bgL;
            const isDark = dark[i] === 1;
            const contrast = Math.abs(l - (isDark ? fgL : bgL));
            const agrees = isDark ? l < 0.35 : l > 0.65; // photo already reads right
            if (floor > 0 && !agrees && contrast > 0.001 && a * contrast < floor)
                a = Math.min(1, Math.max(a, floor / contrast));
            op[i] = a;
            if (!agrees && a * contrast < 0.25) weak++;
        }
    return { op, risk: total ? weak / total : 0 };
});

/* ---------- drawing ---------- */
const QUIET = 4;

function finder(ctx: CanvasRenderingContext2D, x: number, y: number, m: number) {
    ctx.fillStyle = s.bg; ctx.fillRect(x - m, y - m, 9 * m, 9 * m);
    ctx.fillStyle = s.fg; ctx.fillRect(x, y, 7 * m, 7 * m);
    ctx.fillStyle = s.bg; ctx.fillRect(x + m, y + m, 5 * m, 5 * m);
    ctx.fillStyle = s.fg; ctx.fillRect(x + 2 * m, y + 2 * m, 3 * m, 3 * m);
}
function alignment(ctx: CanvasRenderingContext2D, x: number, y: number, m: number) {
    ctx.fillStyle = s.bg; ctx.fillRect(x - m * 0.35, y - m * 0.35, 5.7 * m, 5.7 * m);
    ctx.fillStyle = s.fg; ctx.fillRect(x, y, 5 * m, 5 * m);
    ctx.fillStyle = s.bg; ctx.fillRect(x + m, y + m, 3 * m, 3 * m);
    ctx.fillStyle = s.fg; ctx.fillRect(x + 2 * m, y + 2 * m, m, m);
}
function perforate(ctx: CanvasRenderingContext2D, size: number, m: number) {
    const holes = Math.max(8, Math.round(size / (m * 2.2)));
    const step = size / holes;
    const rad = step * 0.3;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    for (let i = 0; i <= holes; i++) {
        const p = i * step;
        for (const [x, y] of [[p, 0], [p, size], [0, p], [size, p]]) {
            ctx.moveTo(x + rad, y);
            ctx.arc(x, y, rad, 0, Math.PI * 2);
        }
    }
    ctx.fill();
    ctx.restore();
}

function render(canvas: HTMLCanvasElement, size: number, opts: { stamp: boolean; outline: boolean }) {
    const q = qr.value;
    const o = opacity.value;
    if (!q || !o) return false;
    const { n, dark, kind, align } = q;
    const m = size / (n + QUIET * 2);
    const off = QUIET * m;
    const area = n * m;
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = s.bg;
    ctx.fillRect(0, 0, size, size);
    const layer = imageLayer(area);
    if (layer) {
        ctx.globalAlpha = s.imageOpacity / 100;
        ctx.drawImage(layer, off, off, area, area);
        ctx.globalAlpha = 1;
    }
    const dot = m * 0.38;
    const pad = (m - dot) / 2;
    for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
            const i = r * n + c;
            const k = kind[i];
            if (k === 3) continue;
            const x = off + c * m, y = off + r * m;
            ctx.fillStyle = dark[i] ? s.fg : s.bg;
            if (k === 1) {
                ctx.fillRect(x, y, m + 0.3, m + 0.3);
            } else {
                ctx.globalAlpha = o.op[i];
                ctx.fillRect(x + pad, y + pad, dot, dot);
                ctx.globalAlpha = 1;
            }
        }
    for (const [r, c] of align) alignment(ctx, off + (c - 2) * m, off + (r - 2) * m, m);
    finder(ctx, off, off, m);
    finder(ctx, off + (n - 7) * m, off, m);
    finder(ctx, off, off + (n - 7) * m, m);

    if (opts.outline && s.shape !== "none") {
        const cx = off + (0.5 + s.focusX / 100) * area;
        const cy = off + (0.5 + s.focusY / 100) * area;
        const hw = (s.focusW / 200) * area, hh = (s.focusH / 200) * area;
        const u = size / 900;
        ctx.save();
        ctx.beginPath();
        if (s.shape === "rect") ctx.rect(cx - hw, cy - hh, hw * 2, hh * 2);
        else ctx.ellipse(cx, cy, hw, hh, 0, 0, Math.PI * 2);
        ctx.lineWidth = 5 * u;
        ctx.strokeStyle = "rgba(255,255,255,.85)";
        ctx.stroke();
        ctx.lineWidth = 2.5 * u;
        ctx.setLineDash([12 * u, 9 * u]);
        ctx.strokeStyle = "#0f766e";
        ctx.stroke();
        ctx.restore();
    }
    if (opts.stamp) perforate(ctx, size, m);
    return true;
}

const preview = ref<HTMLCanvasElement | null>(null);
const PREVIEW = 900;
let raf = 0;
function schedule() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
        if (preview.value) render(preview.value, PREVIEW, { stamp: s.format === "stamp", outline: s.outline });
    });
    scheduleCheck();
}

/* ---------- readability check (jsQR at shrinking sizes) ---------- */
type Status = { kind: "good" | "warn" | "bad" | "idle"; text: string };
const status = ref<Status>({ kind: "idle", text: "" });
let checkTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleCheck() {
    clearTimeout(checkTimer);
    checkTimer = setTimeout(check, 350);
}
onBeforeUnmount(() => {
    clearTimeout(checkTimer);
    cancelAnimationFrame(raf);
});
function check() {
    if (!qr.value || !props.payload) {
        status.value = { kind: "idle", text: "" };
        return;
    }
    const big = document.createElement("canvas");
    if (!render(big, 720, { stamp: false, outline: false })) return;
    const sizes = [360, 240, 170];
    const ok: number[] = [];
    for (const sz of sizes) {
        const c = document.createElement("canvas");
        c.width = c.height = sz;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(big, 0, 0, sz, sz);
        const d = ctx.getImageData(0, 0, sz, sz);
        const res = jsQR(d.data, sz, sz, { inversionAttempts: "attemptBoth" });
        if (res?.data === props.payload) ok.push(sz);
    }
    const risk = Math.round((opacity.value?.risk ?? 0) * 100);
    if (ok.length === sizes.length)
        status.value = { kind: "good", text: "Readable at every tested size. Still test the printed code with two phones." };
    else if (ok.length)
        status.value = {
            kind: "warn",
            text: `Readable only down to ${Math.min(...ok)}px — it may struggle printed small or from far away. Raise Scan protection or shorten the content.`,
        };
    else
        status.value = {
            kind: "bad",
            text: `Not readable (${risk}% of dots barely stand out). Raise Scan protection, lower the image opacity or use a lower error-correction level.`,
        };
}

/* ---------- drag the subject on the preview ---------- */
let drag: { dx: number; dy: number; id: number } | null = null;
function gridPoint(e: PointerEvent) {
    const q = qr.value;
    const el = preview.value;
    if (!q || !el) return null;
    const rect = el.getBoundingClientRect();
    const k = (n: number) => n + QUIET * 2;
    const m = 1 / k(q.n);
    const u = ((e.clientX - rect.left) / rect.width - QUIET * m) / (q.n * m);
    const v = ((e.clientY - rect.top) / rect.height - QUIET * m) / (q.n * m);
    return { u, v };
}
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
function onDown(e: PointerEvent) {
    if (s.shape === "none") return;
    const p = gridPoint(e);
    if (!p) return;
    const fx = 0.5 + s.focusX / 100, fy = 0.5 + s.focusY / 100;
    // grab inside the outline keeps the offset; elsewhere the centre jumps to the pointer
    const inside = mask(p.u, p.v) > 0 || Math.hypot((p.u - fx) / (s.focusW / 200), (p.v - fy) / (s.focusH / 200)) <= 1;
    drag = { dx: inside ? p.u - fx : 0, dy: inside ? p.v - fy : 0, id: e.pointerId };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onMove(e);
}
function onMove(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const p = gridPoint(e);
    if (!p) return;
    s.focusX = Math.round(clamp((p.u - drag.dx - 0.5) * 100, -50, 50));
    s.focusY = Math.round(clamp((p.v - drag.dy - 0.5) * 100, -50, 50));
}
function onUp() {
    drag = null;
}

/* ---------- export ---------- */
const exportSize = computed(() => (qr.value ? (qr.value.n + QUIET * 2) * 20 * s.scale : 0));
function downloadPng() {
    const size = exportSize.value;
    if (!size) return;
    if (size * size > 85e6 && !confirm(`The image will be ${size}×${size}px and may use a lot of memory. Continue?`)) return;
    const c = document.createElement("canvas");
    if (!render(c, size, { stamp: s.format === "stamp", outline: false })) return;
    c.toBlob((b) => b && downloadBlob(b, `visual-qr${s.format === "stamp" ? "-stamp" : ""}.png`, "image/png"), "image/png");
}

const levels = [
    { value: "L", label: "L" },
    { value: "M", label: "M" },
    { value: "Q", label: "Q" },
    { value: "H", label: "H" },
] as const;
const shapes = [
    { value: "ellipse", label: "Ellipse" },
    { value: "rect", label: "Rectangle" },
    { value: "none", label: "Off" },
] as const;
const formats = [
    { value: "card", label: "Card" },
    { value: "stamp", label: "Stamp" },
] as const;
const scales = [1, 2, 4, 6, 8].map((v) => ({ value: v, label: `${v}×` }));

watch([() => props.payload, s, img, preview], schedule, { deep: true, immediate: true });
</script>

<template>
    <div class="grid gap-4 lg:grid-cols-2">
        <div class="space-y-4">
            <slot />
            <Panel title="Image">
                <template #actions>
                    <Btn v-if="img" size="sm" variant="ghost" @click="removeImage"><X /> Remove</Btn>
                </template>
                <div class="space-y-4">
                    <button
                        type="button"
                        class="flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm transition-colors hover:bg-subtle"
                        :class="dragOver ? 'bg-subtle' : ''"
                        @click="fileInput?.click()"
                        @dragover.prevent="dragOver = true"
                        @dragleave="dragOver = false"
                        @drop.prevent="onDrop"
                    >
                        <ImagePlus class="size-5 text-muted" />
                        <span class="font-medium">{{ imgName || "Drag an image here" }}</span>
                        <span class="text-xs text-muted">{{ img ? "Click to replace" : "or click to browse · PNG, JPG, SVG…" }}</span>
                    </button>
                    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="loadFile(($event.target as HTMLInputElement).files?.[0]); ($event.target as HTMLInputElement).value = ''" />
                    <Notice v-if="imgError" type="error">{{ imgError }}</Notice>
                    <p class="text-xs text-muted">Your image stays on this device; nothing is uploaded.</p>
                    <div class="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                        <div v-for="sl in imageSliders" :key="sl.key">
                            <div class="mb-1 flex items-center justify-between text-xs">
                                <span class="text-muted">{{ sl.label }}</span>
                                <span class="font-mono tabular-nums">{{ sl.fmt(s[sl.key]) }}</span>
                            </div>
                            <input v-model.number="s[sl.key]" type="range" class="range" :min="sl.min" :max="sl.max" :step="sl.step" :disabled="!img" title="Double-click to reset" @dblclick="reset(sl.key)" />
                        </div>
                    </div>
                </div>
            </Panel>

            <Panel title="Subject">
                <template #actions>
                    <Btn size="sm" variant="ghost" title="Reset image, subject and dots" @click="resetAll"><RotateCcw /> Reset</Btn>
                </template>
                <div class="space-y-4">
                    <p class="text-xs text-muted">
                        Mark the part of your image that matters most. Dots get lighter there so it stays visible. Drag on the preview to move it.
                    </p>
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <Tabs v-model="s.shape" :options="[...shapes]" size="sm" />
                        <label class="flex items-center gap-2 text-sm">
                            <input v-model="s.outline" type="checkbox" class="checkbox" /> Show outline
                        </label>
                    </div>
                    <div v-if="s.shape !== 'none'" class="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                        <div v-for="sl in shapeSliders" :key="sl.key">
                            <div class="mb-1 flex items-center justify-between text-xs">
                                <span class="text-muted">{{ sl.label }}</span>
                                <span class="font-mono tabular-nums">{{ sl.fmt(s[sl.key]) }}</span>
                            </div>
                            <input v-model.number="s[sl.key]" type="range" class="range" :min="sl.min" :max="sl.max" :step="sl.step" title="Double-click to reset" @dblclick="reset(sl.key)" />
                        </div>
                    </div>
                    <div class="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                        <div v-for="sl in dotSliders" :key="sl.key">
                            <div class="mb-1 flex items-center justify-between text-xs">
                                <span class="text-muted">{{ sl.label }}</span>
                                <span class="font-mono tabular-nums">{{ sl.fmt(s[sl.key]) }}</span>
                            </div>
                            <input v-model.number="s[sl.key]" type="range" class="range" :min="sl.min" :max="sl.max" :step="sl.step" title="Double-click to reset" @dblclick="reset(sl.key)" />
                        </div>
                    </div>
                </div>
            </Panel>

            <Panel title="Code">
                <div class="grid gap-3 sm:grid-cols-2">
                    <Field label="Error correction">
                        <Tabs v-model="s.level" :options="[...levels]" size="sm" />
                    </Field>
                    <div class="grid grid-cols-2 gap-3">
                        <Field label="Dark dots"><input v-model="s.fg" type="color" class="input h-9 cursor-pointer p-1" /></Field>
                        <Field label="Light dots"><input v-model="s.bg" type="color" class="input h-9 cursor-pointer p-1" /></Field>
                    </div>
                </div>
            </Panel>
        </div>

    <Panel title="Preview" class="self-start">
        <div class="flex flex-col items-center gap-4">
            <Notice v-if="qrError" type="error" class="w-full">{{ qrError }}</Notice>
            <div v-if="!payload" class="py-16 text-sm text-muted">Fill in the content to generate a QR code.</div>
            <div
                class="w-full max-w-[560px] rounded-lg border border-line p-2"
                :class="payload && !qrError ? '' : 'hidden'"
                style="background: repeating-conic-gradient(#8881 0 25%, transparent 0 50%) 0 0 / 16px 16px"
            >
                <canvas
                    ref="preview"
                    class="mx-auto block aspect-square h-auto w-full touch-none select-none"
                    :class="s.shape !== 'none' ? 'cursor-move' : ''"
                    @pointerdown="onDown"
                    @pointermove="onMove"
                    @pointerup="onUp"
                    @pointercancel="onUp"
                />
            </div>
            <Notice
                v-if="status.kind !== 'idle' && payload && !qrError"
                :type="status.kind === 'good' ? 'success' : status.kind === 'warn' ? 'warning' : 'error'"
                class="w-full"
            >{{ status.text }}</Notice>
            <div class="flex w-full flex-wrap items-center justify-center gap-2">
                <Tabs v-model="s.format" :options="[...formats]" size="sm" />
                <Tabs v-model="s.scale" :options="scales" size="sm" />
                <span class="font-mono text-xs text-muted tabular-nums">{{ exportSize.toLocaleString() }} × {{ exportSize.toLocaleString() }} px</span>
            </div>
            <Btn variant="primary" :disabled="!payload || !!qrError" @click="downloadPng"><Download /> Download PNG</Btn>
        </div>
    </Panel>
    </div>
</template>
