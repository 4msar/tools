<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Download, ImageUp, Plus, X } from "lucide-vue-next";
import { Btn, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";

// Simulation matrices in linear RGB (Machado, Oliveira & Fernandes 2009, severity 1.0; achromatopsia uses luminance).
type Kind = "normal" | "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia";
const M: Record<Exclude<Kind, "normal">, number[]> = {
    protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
    deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
    tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
    achromatopsia: [0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722],
};
const kinds: { id: Kind; name: string; note: string }[] = [
    { id: "normal", name: "Normal vision", note: "Original" },
    { id: "protanopia", name: "Protanopia", note: "No red cones · about 1% of men" },
    { id: "deuteranopia", name: "Deuteranopia", note: "No green cones · about 1% of men" },
    { id: "tritanopia", name: "Tritanopia", note: "No blue cones · very rare" },
    { id: "achromatopsia", name: "Achromatopsia", note: "No color vision · very rare" },
];

const toLin = new Float32Array(256);
for (let i = 0; i < 256; i++) {
    const c = i / 255;
    toLin[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
const toSrgb = (v: number) => {
    const c = Math.min(1, Math.max(0, v));
    return Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055) * 255);
};
function sim(r: number, g: number, b: number, k: Kind): [number, number, number] {
    if (k === "normal") return [r, g, b];
    const m = M[k];
    const [R, G, B] = [toLin[r], toLin[g], toLin[b]];
    return [toSrgb(m[0] * R + m[1] * G + m[2] * B), toSrgb(m[3] * R + m[4] * G + m[5] * B), toSrgb(m[6] * R + m[7] * G + m[8] * B)];
}

const mode = ref<"colors" | "image">("colors");

// ---- palette mode ----
const colors = ref(["#ef4444", "#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#14b8a6"]);
const hexToRgb = (h: string): [number, number, number] => (/^#[0-9a-f]{6}$/i.test(h) ? [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] : [0, 0, 0]);
const rgbToHex = (c: number[]) => "#" + c.map((x) => x.toString(16).padStart(2, "0")).join("");
const table = computed(() => kinds.map((k) => ({ ...k, cells: colors.value.map((c) => rgbToHex(sim(...hexToRgb(c), k.id))) })));

// Pairs that are clearly different normally but nearly identical under a simulation.
const dist = (a: string, b: string) => Math.hypot(...hexToRgb(a).map((v, i) => v - hexToRgb(b)[i]));
const clashes = computed(() => {
    const out: string[] = [];
    for (const row of table.value.slice(1, 4)) {
        for (let i = 0; i < colors.value.length; i++) {
            for (let j = i + 1; j < colors.value.length; j++) {
                if (dist(colors.value[i], colors.value[j]) > 80 && dist(row.cells[i], row.cells[j]) < 40) out.push(`Colors ${i + 1} and ${j + 1} look almost the same with ${row.name.toLowerCase()}.`);
            }
        }
    }
    return out;
});

// ---- image mode ----
const kind = ref<Kind>("deuteranopia");
const canvas = ref<HTMLCanvasElement | null>(null);
const source = ref<ImageData | null>(null);
const fileName = ref("");
const error = ref("");
let objectUrl = "";

function loadFile(f: File | undefined) {
    error.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
        error.value = "Choose an image file.";
        return;
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(im.naturalWidth * scale));
        c.height = Math.max(1, Math.round(im.naturalHeight * scale));
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(im, 0, 0, c.width, c.height);
        source.value = ctx.getImageData(0, 0, c.width, c.height);
        fileName.value = f.name;
    };
    im.onerror = () => (error.value = "The browser could not read that image.");
    im.src = objectUrl;
}
onBeforeUnmount(() => objectUrl && URL.revokeObjectURL(objectUrl));

function render() {
    const c = canvas.value;
    const src = source.value;
    if (!c || !src) return;
    c.width = src.width;
    c.height = src.height;
    const out = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
    if (kind.value !== "normal") {
        const m = M[kind.value];
        const d = out.data;
        for (let i = 0; i < d.length; i += 4) {
            const R = toLin[d[i]], G = toLin[d[i + 1]], B = toLin[d[i + 2]];
            d[i] = toSrgb(m[0] * R + m[1] * G + m[2] * B);
            d[i + 1] = toSrgb(m[3] * R + m[4] * G + m[5] * B);
            d[i + 2] = toSrgb(m[6] * R + m[7] * G + m[8] * B);
        }
    }
    c.getContext("2d")!.putImageData(out, 0, 0);
}
watch([source, kind, canvas, mode], render, { flush: "post" });

function download() {
    canvas.value?.toBlob((b) => {
        if (!b) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = `${fileName.value.replace(/\.[^.]+$/, "") || "image"}-${kind.value}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
}
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="mode" :options="[{ value: 'colors', label: 'Colors' }, { value: 'image', label: 'Image' }]" />
        </template>

        <template v-if="mode === 'colors'">
            <Panel title="Your colors">
                <div class="flex flex-wrap items-end gap-3">
                    <div v-for="(_, i) in colors" :key="i" class="flex flex-col items-center gap-1">
                        <div class="relative">
                            <input v-model="colors[i]" type="color" class="size-12 cursor-pointer rounded-lg border border-line bg-surface" :aria-label="`Color ${i + 1}`" />
                            <button v-if="colors.length > 2" type="button" class="absolute -top-1.5 -right-1.5 flex size-4 cursor-pointer items-center justify-center rounded-full bg-fg text-bg" :aria-label="`Remove color ${i + 1}`" @click="colors.splice(i, 1)"><X class="size-3" /></button>
                        </div>
                        <input v-model="colors[i]" class="input !h-7 !w-20 !px-1.5 !py-0 text-center font-mono text-xs" spellcheck="false" :aria-label="`Color ${i + 1} hex`" />
                    </div>
                    <Btn v-if="colors.length < 10" class="mb-8" @click="colors.push('#64748b')"><Plus /> Add</Btn>
                </div>
            </Panel>

            <Panel title="How they are seen" flush>
                <div class="divide-y divide-line">
                    <div v-for="row in table" :key="row.id" class="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                        <div class="w-56 shrink-0"><div class="text-sm font-medium">{{ row.name }}</div><div class="text-xs text-muted">{{ row.note }}</div></div>
                        <div class="flex min-w-0 flex-1 overflow-hidden rounded-lg border border-line">
                            <div v-for="(c, i) in row.cells" :key="i" class="flex h-12 flex-1 items-end justify-center pb-1" :style="{ background: c }" :title="c">
                                <span class="rounded bg-black/45 px-1 font-mono text-[10px] text-white">{{ i + 1 }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </Panel>
            <Notice v-if="clashes.length" type="warning"><ul class="list-inside list-disc space-y-0.5"><li v-for="c in clashes" :key="c">{{ c }}</li></ul></Notice>
            <Notice v-else type="success">No pair of these colors collapses into the same shade in the red-green or blue-yellow simulations.</Notice>
        </template>

        <template v-else>
            <div class="grid gap-4 lg:grid-cols-[18rem_1fr]">
                <Panel title="Image">
                    <div class="flex flex-col gap-3">
                        <label class="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted hover:bg-subtle" @dragover.prevent @drop.prevent="loadFile($event.dataTransfer?.files[0])">
                            <ImageUp class="size-6" /><span class="break-all">{{ fileName || "Drop a screenshot or image, or click to choose" }}</span>
                            <input type="file" accept="image/*" class="hidden" @change="loadFile(($event.target as HTMLInputElement).files?.[0])" />
                        </label>
                        <Notice v-if="error" type="error">{{ error }}</Notice>
                        <Field label="Simulate">
                            <div class="flex flex-col gap-1">
                                <label v-for="k in kinds" :key="k.id" class="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-subtle" :class="kind === k.id ? 'bg-subtle' : ''">
                                    <input v-model="kind" type="radio" :value="k.id" class="mt-1 accent-(--accent)" />
                                    <span><span class="font-medium">{{ k.name }}</span><span class="block text-xs text-muted">{{ k.note }}</span></span>
                                </label>
                            </div>
                        </Field>
                    </div>
                </Panel>
                <Panel :title="kinds.find((k) => k.id === kind)?.name" flush>
                    <template #actions><Btn size="sm" variant="ghost" :disabled="!source" @click="download"><Download /> Download PNG</Btn></template>
                    <div class="flex min-h-[20rem] items-center justify-center overflow-auto p-4">
                        <p v-if="!source" class="text-sm text-muted">Choose an image to see it simulated. Nothing is uploaded.</p>
                        <canvas v-show="source" ref="canvas" class="h-auto max-w-full rounded" />
                    </div>
                </Panel>
            </div>
        </template>
        <p class="text-xs text-muted">Simulations are approximations of complete (dichromatic) deficiencies. Milder forms are more common, and real perception varies from person to person.</p>
    </ToolPage>
</template>
