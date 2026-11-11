<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useActiveEventListener } from "@/composables/useActiveEventListener";
import { Download, FlipHorizontal2, FlipVertical2, ImagePlus, Link2, Link2Off, RotateCw, Trash2 } from "lucide-vue-next";
import { Btn, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { downloadBlob } from "@/composables/useClipboard";

type Fmt = "image/jpeg" | "image/png" | "image/webp" | "image/avif";

function supports(mime: string) {
    try {
        const c = document.createElement("canvas");
        c.width = c.height = 1;
        return c.toDataURL(mime).startsWith(`data:${mime}`);
    } catch {
        return false;
    }
}
const formats = computed(() => {
    const list: { value: Fmt; label: string }[] = [
        { value: "image/jpeg", label: "JPEG" },
        { value: "image/png", label: "PNG" },
    ];
    if (supports("image/webp")) list.push({ value: "image/webp", label: "WebP" });
    if (supports("image/avif")) list.push({ value: "image/avif", label: "AVIF" });
    return list;
});
const ext: Record<Fmt, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

const img = ref<HTMLImageElement | null>(null);
const srcUrl = ref("");
const srcName = ref("");
const srcSize = ref(0);
const srcType = ref("");
const error = ref("");
const dragging = ref(false);

const format = ref<Fmt>("image/webp");
const quality = ref(85);
const resizeMode = ref<"dimensions" | "percent">("dimensions");
const width = ref(0);
const height = ref(0);
const lock = ref(true);
const percent = ref(100);
const rotation = ref(0);
const flipH = ref(false);
const flipV = ref(false);
const bg = ref("#ffffff");

const outUrl = ref("");
const outBlob = ref<Blob | null>(null);
const busy = ref(false);

// Source dims after rotation
const rotW = computed(() => (!img.value ? 0 : rotation.value % 180 ? img.value.naturalHeight : img.value.naturalWidth));
const rotH = computed(() => (!img.value ? 0 : rotation.value % 180 ? img.value.naturalWidth : img.value.naturalHeight));

const target = computed(() => {
    if (!img.value) return { w: 0, h: 0 };
    if (resizeMode.value === "percent") {
        const f = Math.max(1, percent.value || 1) / 100;
        return { w: Math.max(1, Math.round(rotW.value * f)), h: Math.max(1, Math.round(rotH.value * f)) };
    }
    return { w: Math.max(1, Math.round(width.value || 1)), h: Math.max(1, Math.round(height.value || 1)) };
});

function onWidth(e: Event) {
    const v = Math.max(1, Math.round(Number((e.target as HTMLInputElement).value) || 1));
    width.value = v;
    if (lock.value && rotW.value) height.value = Math.max(1, Math.round((v * rotH.value) / rotW.value));
}
function onHeight(e: Event) {
    const v = Math.max(1, Math.round(Number((e.target as HTMLInputElement).value) || 1));
    height.value = v;
    if (lock.value && rotH.value) width.value = Math.max(1, Math.round((v * rotW.value) / rotH.value));
}
function resetSize() {
    width.value = rotW.value;
    height.value = rotH.value;
    percent.value = 100;
}
function rotate() {
    rotation.value = (rotation.value + 90) % 360;
    [width.value, height.value] = [height.value, width.value];
}

function loadFile(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
        error.value = "That file is not an image.";
        return;
    }
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => {
        if (srcUrl.value) URL.revokeObjectURL(srcUrl.value);
        srcUrl.value = url;
        srcName.value = file.name || "pasted-image";
        srcSize.value = file.size;
        srcType.value = file.type;
        error.value = "";
        rotation.value = 0;
        flipH.value = flipV.value = false;
        img.value = el;
        width.value = el.naturalWidth;
        height.value = el.naturalHeight;
        percent.value = 100;
    };
    el.onerror = () => {
        URL.revokeObjectURL(url);
        error.value = "Could not load that image.";
    };
    el.src = url;
}
function onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    loadFile(input.files?.[0]);
    input.value = "";
}
function onDrop(e: DragEvent) {
    dragging.value = false;
    loadFile(e.dataTransfer?.files?.[0]);
}
function onPaste(e: ClipboardEvent) {
    const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
    if (item) {
        e.preventDefault();
        loadFile(item.getAsFile());
    }
}
function clear() {
    if (srcUrl.value) URL.revokeObjectURL(srcUrl.value);
    if (outUrl.value) URL.revokeObjectURL(outUrl.value);
    img.value = null;
    srcUrl.value = outUrl.value = "";
    outBlob.value = null;
    error.value = "";
}

let token = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
async function render() {
    const el = img.value;
    if (!el) return;
    const my = ++token;
    busy.value = true;
    const { w, h } = target.value;
    if (w * h > 268_000_000) {
        error.value = "Output dimensions are too large for the browser canvas.";
        busy.value = false;
        return;
    }
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    if (format.value === "image/jpeg") {
        ctx.fillStyle = bg.value;
        ctx.fillRect(0, 0, w, h);
    }
    ctx.imageSmoothingQuality = "high";
    ctx.translate(w / 2, h / 2);
    ctx.rotate((rotation.value * Math.PI) / 180);
    ctx.scale(flipH.value ? -1 : 1, flipV.value ? -1 : 1);
    const swapped = rotation.value % 180 !== 0;
    const dw = swapped ? h : w;
    const dh = swapped ? w : h;
    ctx.drawImage(el, -dw / 2, -dh / 2, dw, dh);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, format.value, quality.value / 100));
    if (my !== token) return;
    busy.value = false;
    if (!blob) {
        error.value = "This browser could not encode the image in that format.";
        return;
    }
    error.value = "";
    if (outUrl.value) URL.revokeObjectURL(outUrl.value);
    outBlob.value = blob;
    outUrl.value = URL.createObjectURL(blob);
}
watch([img, format, quality, resizeMode, width, height, percent, rotation, flipH, flipV, bg], () => {
    clearTimeout(timer);
    timer = setTimeout(render, 200);
});

const lossy = computed(() => format.value !== "image/png");
const mismatch = computed(() => !!outBlob.value && outBlob.value.type !== format.value);
const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);
const savings = computed(() => (outBlob.value && srcSize.value ? Math.round((1 - outBlob.value.size / srcSize.value) * 100) : 0));
const outName = computed(() => `${srcName.value.replace(/\.[^.]+$/, "") || "image"}.${ext[outBlob.value?.type as Fmt] ?? ext[format.value]}`);

function download() {
    if (outBlob.value) downloadBlob(outBlob.value, outName.value, outBlob.value.type);
}

useActiveEventListener("paste", onPaste);
onBeforeUnmount(() => {
    clearTimeout(timer);
    if (srcUrl.value) URL.revokeObjectURL(srcUrl.value);
    if (outUrl.value) URL.revokeObjectURL(outUrl.value);
});
</script>

<template>
    <ToolPage>
        <label
            v-if="!img"
            class="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center text-sm text-muted transition"
            :class="dragging ? 'border-accent bg-accent/10' : 'border-line-strong hover:bg-subtle'"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="onDrop"
        >
            <ImagePlus class="size-8" />
            <span><span class="font-medium text-fg">Choose an image</span>, drop it here, or paste with <kbd class="kbd">Ctrl</kbd>+<kbd class="kbd">V</kbd></span>
            <input type="file" accept="image/*" class="hidden" @change="onFile" />
        </label>
        <Notice v-if="error" type="error">{{ error }}</Notice>

        <template v-if="img">
            <div class="grid gap-4 lg:grid-cols-3">
                <Panel title="Source">
                    <template #actions>
                        <label class="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted hover:bg-subtle hover:text-fg">
                            <ImagePlus class="size-4" /> Replace
                            <input type="file" accept="image/*" class="hidden" @change="onFile" />
                        </label>
                        <Btn size="sm" variant="ghost" @click="clear"><Trash2 /> Clear</Btn>
                    </template>
                    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                        <dt class="text-muted">Name</dt><dd class="truncate" :title="srcName">{{ srcName }}</dd>
                        <dt class="text-muted">Dimensions</dt><dd>{{ img.naturalWidth }} × {{ img.naturalHeight }} px</dd>
                        <dt class="text-muted">Size</dt><dd>{{ fmtSize(srcSize) }}</dd>
                        <dt class="text-muted">Type</dt><dd>{{ srcType || "unknown" }}</dd>
                    </dl>
                </Panel>

                <Panel title="Output" class="lg:col-span-2">
                    <div class="grid gap-4 sm:grid-cols-2">
                        <Field label="Format">
                            <Tabs v-model="format" :options="formats" />
                        </Field>
                        <Field :label="`Quality: ${quality}%`" :hint="lossy ? undefined : 'PNG is lossless; quality is ignored.'">
                            <input v-model.number="quality" type="range" min="1" max="100" class="range w-full" :disabled="!lossy" />
                        </Field>
                        <Field v-if="format === 'image/jpeg'" label="Background (JPEG has no transparency)">
                            <input v-model="bg" type="color" class="h-9 w-full cursor-pointer rounded-lg border border-line bg-surface p-1" />
                        </Field>
                    </div>
                </Panel>
            </div>

            <Panel title="Resize &amp; transform">
                <template #actions>
                    <Tabs v-model="resizeMode" size="sm" :options="[{ value: 'dimensions', label: 'Pixels' }, { value: 'percent', label: 'Percent' }]" />
                </template>
                <div class="flex flex-wrap items-end gap-4">
                    <template v-if="resizeMode === 'dimensions'">
                        <Field label="Width (px)" class="w-28">
                            <input :value="width" type="number" min="1" class="input" @input="onWidth" />
                        </Field>
                        <Btn variant="ghost" :title="lock ? 'Aspect ratio locked' : 'Aspect ratio unlocked'" @click="lock = !lock">
                            <Link2 v-if="lock" /><Link2Off v-else />
                        </Btn>
                        <Field label="Height (px)" class="w-28">
                            <input :value="height" type="number" min="1" class="input" @input="onHeight" />
                        </Field>
                    </template>
                    <Field v-else label="Scale (%)" class="w-28">
                        <input v-model.number="percent" type="number" min="1" max="1000" class="input" />
                    </Field>
                    <Btn variant="ghost" @click="resetSize">Reset size</Btn>
                    <div class="ml-auto flex items-center gap-1">
                        <Btn variant="secondary" title="Rotate 90° clockwise" @click="rotate"><RotateCw /> Rotate</Btn>
                        <Btn :variant="flipH ? 'primary' : 'secondary'" title="Flip horizontally" @click="flipH = !flipH"><FlipHorizontal2 /></Btn>
                        <Btn :variant="flipV ? 'primary' : 'secondary'" title="Flip vertically" @click="flipV = !flipV"><FlipVertical2 /></Btn>
                    </div>
                </div>
                <p class="mt-3 text-xs text-muted">Output: {{ target.w }} × {{ target.h }} px</p>
            </Panel>

            <Notice v-if="mismatch" type="warning">This browser could not encode {{ formats.find((f) => f.value === format)?.label }}, so it produced {{ outBlob?.type }} instead.</Notice>

            <div class="grid gap-4 lg:grid-cols-2">
                <Panel title="Before">
                    <template #actions><span class="text-xs text-muted">{{ fmtSize(srcSize) }}</span></template>
                    <div class="flex min-h-40 items-center justify-center overflow-hidden rounded-lg border border-line bg-subtle p-2">
                        <img :src="srcUrl" alt="Original" class="max-h-80 max-w-full object-contain" />
                    </div>
                </Panel>
                <Panel title="After">
                    <template #actions>
                        <span v-if="outBlob" class="text-xs text-muted">
                            {{ fmtSize(outBlob.size) }}
                            <span :class="savings >= 0 ? 'text-success' : 'text-warning'">({{ savings >= 0 ? "-" : "+" }}{{ Math.abs(savings) }}%)</span>
                        </span>
                        <Btn size="sm" variant="primary" :disabled="!outBlob || busy" @click="download"><Download /> Download</Btn>
                    </template>
                    <div class="flex min-h-40 items-center justify-center overflow-hidden rounded-lg border border-line bg-subtle p-2">
                        <img v-if="outUrl" :src="outUrl" alt="Converted" class="max-h-80 max-w-full object-contain" />
                        <span v-else class="text-sm text-muted">Rendering…</span>
                    </div>
                </Panel>
            </div>
        </template>
    </ToolPage>
</template>
