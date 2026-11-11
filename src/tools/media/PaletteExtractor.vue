<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { ImageUp } from "lucide-vue-next";
import { CopyButton, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { copyText } from "@/composables/useClipboard";

const count = ref(6);
const fmt = ref<"hex" | "rgb" | "hsl">("hex");
const exportAs = ref<"css" | "tailwind" | "json" | "scss">("css");
const imageUrl = ref("");
const fileName = ref("");
const error = ref("");
const pixels = ref<number[][]>([]);

function loadFile(f: File | undefined) {
    error.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
        error.value = "Choose an image file.";
        return;
    }
    if (imageUrl.value) URL.revokeObjectURL(imageUrl.value);
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
        // Downscale: about 20,000 samples is plenty for a palette.
        const scale = Math.min(1, Math.sqrt(20000 / (im.naturalWidth * im.naturalHeight)));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(im.naturalWidth * scale));
        c.height = Math.max(1, Math.round(im.naturalHeight * scale));
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(im, 0, 0, c.width, c.height);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        const px: number[][] = [];
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 127) px.push([d[i], d[i + 1], d[i + 2]]);
        pixels.value = px;
        imageUrl.value = url;
        fileName.value = f.name;
        if (!px.length) error.value = "The image is fully transparent.";
    };
    im.onerror = () => {
        URL.revokeObjectURL(url);
        error.value = "The browser could not read that image.";
    };
    im.src = url;
}
onBeforeUnmount(() => imageUrl.value && URL.revokeObjectURL(imageUrl.value));
function onPaste(e: ClipboardEvent) {
    const f = Array.from(e.clipboardData?.files ?? []).find((x) => x.type.startsWith("image/"));
    if (f) loadFile(f);
}

// Median cut: repeatedly split the box with the widest channel range at its median.
function medianCut(px: number[][], n: number): { rgb: number[]; share: number }[] {
    if (!px.length) return [];
    let boxes = [px];
    while (boxes.length < n) {
        let best = -1, bestRange = 0, bestCh = 0;
        boxes.forEach((b, i) => {
            if (b.length < 2) return;
            for (let ch = 0; ch < 3; ch++) {
                let lo = 255, hi = 0;
                for (const p of b) { if (p[ch] < lo) lo = p[ch]; if (p[ch] > hi) hi = p[ch]; }
                // weight by box size so large uniform regions do not hide small vivid ones entirely
                const score = (hi - lo) * Math.log2(b.length + 1);
                if (score > bestRange) { bestRange = score; best = i; bestCh = ch; }
            }
        });
        if (best < 0 || bestRange === 0) break;
        const b = boxes[best].slice().sort((x, y) => x[bestCh] - y[bestCh]);
        const mid = b.length >> 1;
        boxes = [...boxes.slice(0, best), b.slice(0, mid), b.slice(mid), ...boxes.slice(best + 1)];
    }
    return boxes
        .map((b) => ({ rgb: [0, 1, 2].map((ch) => Math.round(b.reduce((s, p) => s + p[ch], 0) / b.length)), share: b.length / px.length }))
        .sort((a, b) => b.share - a.share);
}

const palette = ref<{ rgb: number[]; share: number }[]>([]);
watch([pixels, count], () => (palette.value = medianCut(pixels.value, Math.min(16, Math.max(2, count.value || 6)))), { immediate: true });

const hex = (c: number[]) => "#" + c.map((x) => x.toString(16).padStart(2, "0")).join("");
function hsl([r, g, b]: number[]) {
    const [R, G, B] = [r / 255, g / 255, b / 255];
    const max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2, d = max - min;
    let h = 0;
    if (d) h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
    const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    return `hsl(${Math.round((h * 60 + 360) % 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
}
const show = (c: number[]) => (fmt.value === "hex" ? hex(c) : fmt.value === "rgb" ? `rgb(${c.join(" ")})` : hsl(c));
const lum = ([r, g, b]: number[]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

const exported = computed(() => {
    const cs = palette.value.map((p) => show(p.rgb));
    if (!cs.length) return "";
    switch (exportAs.value) {
        case "css": return `:root {\n${cs.map((c, i) => `  --color-${i + 1}: ${c};`).join("\n")}\n}`;
        case "scss": return cs.map((c, i) => `$color-${i + 1}: ${c};`).join("\n");
        case "tailwind": return `@theme {\n${cs.map((c, i) => `  --color-palette-${i + 1}: ${c};`).join("\n")}\n}`;
        default: return JSON.stringify(cs, null, 2);
    }
});
</script>

<template>
    <ToolPage>
        <div class="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]" @paste="onPaste">
            <Panel title="Image">
                <label
                    class="flex min-h-64 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line p-4 text-center text-sm text-muted hover:bg-subtle"
                    @dragover.prevent @drop.prevent="loadFile($event.dataTransfer?.files[0])"
                >
                    <img v-if="imageUrl" :src="imageUrl" :alt="fileName" class="max-h-72 max-w-full rounded" />
                    <template v-else><ImageUp class="size-7" /><span>Drop an image, paste one, or click to choose</span><span class="text-xs">It is read in your browser and never uploaded</span></template>
                    <input type="file" accept="image/*" class="hidden" @change="loadFile(($event.target as HTMLInputElement).files?.[0])" />
                </label>
                <Notice v-if="error" type="error" class="mt-3">{{ error }}</Notice>
                <div class="mt-4 grid grid-cols-2 gap-3">
                    <Field :label="`Colors: ${count}`"><input v-model.number="count" type="range" min="2" max="16" class="range" /></Field>
                    <Field label="Format"><select v-model="fmt" class="select"><option value="hex">HEX</option><option value="rgb">RGB</option><option value="hsl">HSL</option></select></Field>
                </div>
            </Panel>

            <div class="flex min-w-0 flex-col gap-4">
                <Panel title="Palette" flush>
                    <p v-if="!palette.length" class="p-4 text-sm text-muted">Choose an image to extract its dominant colors.</p>
                    <template v-else>
                        <div class="flex h-16 overflow-hidden">
                            <div v-for="(p, i) in palette" :key="i" :style="{ background: hex(p.rgb), flexGrow: Math.max(p.share, 0.04) }" class="basis-0" :title="show(p.rgb)" />
                        </div>
                        <ul class="divide-y divide-line">
                            <li v-for="(p, i) in palette" :key="i">
                                <button type="button" class="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left hover:bg-subtle" :title="`Copy ${show(p.rgb)}`" @click="copyText(show(p.rgb))">
                                    <span class="flex size-9 shrink-0 items-center justify-center rounded-md border border-line font-mono text-[10px]" :style="{ background: hex(p.rgb), color: lum(p.rgb) > 0.55 ? '#000' : '#fff' }">{{ i + 1 }}</span>
                                    <span class="min-w-0 flex-1 font-mono text-sm">{{ show(p.rgb) }}</span>
                                    <span class="text-xs text-muted tabular-nums">{{ (p.share * 100).toFixed(1) }}%</span>
                                </button>
                            </li>
                        </ul>
                    </template>
                </Panel>

                <Panel v-if="palette.length" title="Export" flush>
                    <template #actions>
                        <Tabs v-model="exportAs" size="sm" :options="[{ value: 'css', label: 'CSS' }, { value: 'tailwind', label: 'Tailwind' }, { value: 'scss', label: 'SCSS' }, { value: 'json', label: 'JSON' }]" />
                        <CopyButton :text="exported" />
                    </template>
                    <pre class="max-h-64 overflow-auto p-4 font-mono text-[13px]">{{ exported }}</pre>
                </Panel>
            </div>
        </div>
    </ToolPage>
</template>
