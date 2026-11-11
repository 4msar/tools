<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowLeftRight } from "lucide-vue-next";
import { Btn, CopyButton, Field, Notice, Panel, ToolPage } from "@/components/ui";
import { copyText } from "@/composables/useClipboard";
import { toast } from "vue-sonner";

interface RGBA { r: number; g: number; b: number; a: number }

let ctx: CanvasRenderingContext2D | null = null;
function getCtx() {
    if (!ctx) {
        const c = document.createElement("canvas");
        c.width = c.height = 1;
        ctx = c.getContext("2d", { willReadFrequently: true });
    }
    return ctx;
}

/** Let the browser resolve any CSS color, then read back the sRGB pixel. */
function parseColor(input: string): RGBA | null {
    const s = input.trim();
    if (!s) return null;
    const c = getCtx();
    if (!c) return null;
    c.fillStyle = "#010203";
    c.fillStyle = s;
    const first = c.fillStyle;
    c.fillStyle = "#040506";
    c.fillStyle = s;
    if (first === "#010203" && c.fillStyle === "#040506") return null;
    c.clearRect(0, 0, 1, 1);
    c.fillRect(0, 0, 1, 1);
    const d = c.getImageData(0, 0, 1, 1).data;
    const a = d[3] / 255;
    // getImageData returns premultiplied-then-unpremultiplied values; fine for display
    return { r: d[0], g: d[1], b: d[2], a: Math.round(a * 100) / 100 };
}

const round = (n: number, p = 0) => { const f = 10 ** p; return Math.round(n * f) / f; };
const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, "0");
const toHex = (c: RGBA) => `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
const toHex8 = (c: RGBA) => toHex(c) + hex2(c.a * 255);

function toHsl({ r, g, b }: RGBA) {
    const R = r / 255, G = g / 255, B = b / 255;
    const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
    const l = (max + min) / 2;
    let h = 0;
    if (d) {
        if (max === R) h = ((G - B) / d) % 6;
        else if (max === G) h = (B - R) / d + 2;
        else h = (R - G) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return { h, s: s * 100, l: l * 100 };
}
function toHsv({ r, g, b }: RGBA) {
    const R = r / 255, G = g / 255, B = b / 255;
    const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
    const h = toHsl({ r, g, b, a: 1 }).h;
    return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
}
function toHwb(c: RGBA) {
    const { h } = toHsl(c);
    return { h, w: (Math.min(c.r, c.g, c.b) / 255) * 100, b: (1 - Math.max(c.r, c.g, c.b) / 255) * 100 };
}
function toCmyk({ r, g, b }: RGBA) {
    const R = r / 255, G = g / 255, B = b / 255;
    const k = 1 - Math.max(R, G, B);
    if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
    return { c: ((1 - R - k) / (1 - k)) * 100, m: ((1 - G - k) / (1 - k)) * 100, y: ((1 - B - k) / (1 - k)) * 100, k: k * 100 };
}
const lin = (v: number) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
function toOklch({ r, g, b }: RGBA) {
    const R = lin(r), G = lin(g), B = lin(b);
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    const C = Math.hypot(A, Bb);
    let h = (Math.atan2(Bb, A) * 180) / Math.PI;
    if (h < 0) h += 360;
    return { l: L * 100, c: C, h: C < 0.0004 ? 0 : h };
}
function luminance({ r, g, b }: RGBA) {
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function ratio(a: RGBA, b: RGBA) {
    const l1 = luminance(a), l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function mix(a: RGBA, b: RGBA, t: number): RGBA {
    return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: a.a };
}

// ---- main color state
const draft = ref("#3b82f6");
const color = ref<RGBA>(parseColor("#3b82f6") ?? { r: 59, g: 130, b: 246, a: 1 });
const invalid = ref(false);

function onText(v: string) {
    draft.value = v;
    const p = parseColor(v);
    invalid.value = !p && v.trim() !== "";
    if (p) color.value = p;
}
function setColor(c: RGBA) {
    color.value = { ...c, r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) };
    draft.value = color.value.a < 1 ? toHex8(color.value) : toHex(color.value);
    invalid.value = false;
}
function onPicker(e: Event) {
    const p = parseColor((e.target as HTMLInputElement).value);
    if (p) setColor({ ...p, a: color.value.a });
}
function onAlpha(e: Event) {
    setColor({ ...color.value, a: Number((e.target as HTMLInputElement).value) / 100 });
}

const swatch = computed(() => `rgb(${color.value.r} ${color.value.g} ${color.value.b} / ${color.value.a})`);

const formats = computed(() => {
    const c = color.value;
    const hsl = toHsl(c), hwb = toHwb(c), hsv = toHsv(c), ok = toOklch(c), cmyk = toCmyk(c);
    const alpha = c.a < 1 ? ` / ${c.a}` : "";
    const sp = c.a < 1 ? ` / ${c.a}` : "";
    return [
        { name: "HEX", value: toHex(c) },
        { name: "HEX8", value: toHex8(c) },
        { name: "RGB", value: `rgb(${c.r} ${c.g} ${c.b}${alpha})` },
        { name: "HSL", value: `hsl(${round(hsl.h)} ${round(hsl.s)}% ${round(hsl.l)}%${sp})` },
        { name: "HWB", value: `hwb(${round(hwb.h)} ${round(hwb.w)}% ${round(hwb.b)}%${sp})` },
        { name: "HSV", value: `hsv(${round(hsv.h)}, ${round(hsv.s)}%, ${round(hsv.v)}%)` },
        { name: "OKLCH", value: `oklch(${round(ok.l, 1)}% ${round(ok.c, 3)} ${round(ok.h, 1)}${sp})` },
        { name: "CMYK", value: `cmyk(${round(cmyk.c)}%, ${round(cmyk.m)}%, ${round(cmyk.y)}%, ${round(cmyk.k)}%)` },
    ];
});

// ---- tints & shades
const white: RGBA = { r: 255, g: 255, b: 255, a: 1 };
const black: RGBA = { r: 0, g: 0, b: 0, a: 1 };
const scale = computed(() => {
    const base = { ...color.value, a: 1 };
    const out: { hex: string; label: string }[] = [];
    for (let i = 5; i >= 1; i--) out.push({ hex: toHex(mix(base, white, i * 0.16)), label: `Tint ${i * 16}%` });
    out.push({ hex: toHex(base), label: "Base" });
    for (let i = 1; i <= 5; i++) out.push({ hex: toHex(mix(base, black, i * 0.16)), label: `Shade ${i * 16}%` });
    return out;
});
async function copyScale(hex: string) {
    if (await copyText(hex)) toast.success(`Copied ${hex}`);
}

// ---- contrast
const fgText = ref("#1f2937");
const bgText = ref("#ffffff");
const fg = computed(() => parseColor(fgText.value));
const bg = computed(() => parseColor(bgText.value));
const contrast = computed(() => (fg.value && bg.value ? ratio(fg.value, bg.value) : null));
const checks = computed(() => {
    const r = contrast.value;
    return [
        { label: "AA normal", min: 4.5 },
        { label: "AA large", min: 3 },
        { label: "AAA normal", min: 7 },
        { label: "AAA large", min: 4.5 },
    ].map((c) => ({ ...c, pass: r !== null && r >= c.min }));
});
function swapContrast() {
    [fgText.value, bgText.value] = [bgText.value, fgText.value];
}
function useMain(target: "fg" | "bg") {
    const v = toHex(color.value);
    if (target === "fg") fgText.value = v; else bgText.value = v;
}
function pickContrast(target: "fg" | "bg", e: Event) {
    const v = (e.target as HTMLInputElement).value;
    if (target === "fg") fgText.value = v; else bgText.value = v;
}
const hexOf = (c: RGBA | null) => (c ? toHex(c) : "#000000");
</script>

<template>
    <ToolPage>
        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="Color">
                <div class="flex flex-col gap-4">
                    <div class="flex items-stretch gap-3">
                        <label class="relative block size-20 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-line-strong" title="Pick a color">
                            <span class="absolute inset-0" style="background-image: conic-gradient(#ccc 25%, #fff 0 50%, #ccc 0 75%, #fff 0); background-size: 12px 12px" />
                            <span class="absolute inset-0" :style="{ background: swatch }" />
                            <input type="color" class="absolute inset-0 size-full cursor-pointer opacity-0" :value="toHex(color)" aria-label="Color picker" @input="onPicker" />
                        </label>
                        <div class="flex min-w-0 flex-1 flex-col justify-between gap-2">
                            <Field label="CSS color" hint="hex, rgb(), hsl(), hwb(), oklch(), or a name">
                                <input :value="draft" class="input font-mono" :class="invalid ? 'border-danger' : ''" spellcheck="false" placeholder="#3b82f6" @input="onText(($event.target as HTMLInputElement).value)" />
                            </Field>
                        </div>
                    </div>
                    <Notice v-if="invalid" type="error">Not a valid CSS color.</Notice>
                    <div>
                        <span class="label">Alpha: {{ Math.round(color.a * 100) }}%</span>
                        <input type="range" class="range w-full" min="0" max="100" :value="Math.round(color.a * 100)" aria-label="Alpha" @input="onAlpha" />
                    </div>
                </div>
            </Panel>

            <Panel title="Formats" flush>
                <ul class="divide-y divide-line">
                    <li v-for="f in formats" :key="f.name" class="flex items-center gap-3 px-4 py-1.5">
                        <span class="w-14 shrink-0 text-xs font-semibold text-muted">{{ f.name }}</span>
                        <code class="min-w-0 flex-1 truncate font-mono text-sm" :title="f.value">{{ f.value }}</code>
                        <CopyButton :text="f.value" icon-only />
                    </li>
                </ul>
            </Panel>
        </div>

        <Panel title="Tints &amp; shades">
            <div class="grid grid-cols-6 gap-2 sm:grid-cols-11">
                <button
                    v-for="s in scale"
                    :key="s.label"
                    type="button"
                    class="group flex cursor-pointer flex-col gap-1 text-left"
                    :title="`${s.label} · ${s.hex} (click to copy)`"
                    @click="copyScale(s.hex)"
                >
                    <span class="h-12 rounded-lg border border-line transition group-hover:scale-105" :style="{ background: s.hex }" />
                    <span class="truncate font-mono text-[10px] text-muted">{{ s.hex }}</span>
                </button>
            </div>
        </Panel>

        <Panel title="WCAG contrast">
            <template #actions>
                <Btn size="sm" variant="ghost" @click="swapContrast"><ArrowLeftRight /> Swap</Btn>
            </template>
            <div class="grid gap-4 lg:grid-cols-2">
                <div class="flex flex-col gap-3">
                    <div v-for="t in (['fg', 'bg'] as const)" :key="t" class="flex items-end gap-2">
                        <label class="relative block size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-line-strong">
                            <span class="absolute inset-0" :style="{ background: hexOf(t === 'fg' ? fg : bg) }" />
                            <input type="color" class="absolute inset-0 size-full cursor-pointer opacity-0" :value="hexOf(t === 'fg' ? fg : bg)" :aria-label="t === 'fg' ? 'Foreground picker' : 'Background picker'" @input="pickContrast(t, $event)" />
                        </label>
                        <Field :label="t === 'fg' ? 'Foreground' : 'Background'" class="flex-1">
                            <input v-if="t === 'fg'" v-model="fgText" class="input font-mono" spellcheck="false" />
                            <input v-else v-model="bgText" class="input font-mono" spellcheck="false" />
                        </Field>
                        <Btn size="md" variant="secondary" title="Use the color above" @click="useMain(t)">Use main</Btn>
                    </div>
                    <Notice v-if="!fg || !bg" type="error">Enter valid colors for both fields.</Notice>
                    <div v-else class="flex items-center gap-4">
                        <div class="text-4xl font-bold tabular-nums">{{ round(contrast ?? 0, 2) }}<span class="text-lg text-muted">:1</span></div>
                        <div class="grid flex-1 grid-cols-2 gap-1.5">
                            <span
                                v-for="c in checks"
                                :key="c.label"
                                class="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs font-medium"
                                :class="c.pass ? 'border-success/40 bg-success/10 text-success' : 'border-danger/40 bg-danger/10 text-danger'"
                            >
                                {{ c.label }} <span>{{ c.pass ? "Pass" : "Fail" }}</span>
                            </span>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col justify-center gap-1 rounded-xl border border-line p-5" :style="{ background: hexOf(bg), color: hexOf(fg) }">
                    <p class="text-2xl font-bold">Large sample text</p>
                    <p class="text-base">The quick brown fox jumps over the lazy dog. Normal-size body text for checking legibility.</p>
                    <p class="text-xs">Small caption text, 12px.</p>
                </div>
            </div>
        </Panel>
    </ToolPage>
</template>
