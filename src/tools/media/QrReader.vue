<script setup lang="ts">
import { onBeforeUnmount, onDeactivated, ref } from "vue";
import { useActiveEventListener } from "@/composables/useActiveEventListener";
import jsQR from "jsqr";
import { Camera, CameraOff, ImagePlus, Trash2 } from "lucide-vue-next";
import { Btn, CopyButton, Notice, Panel, ToolPage } from "@/components/ui";

const canvas = ref<HTMLCanvasElement | null>(null);
const hasImage = ref(false);
const decoded = ref("");
const error = ref("");
const dragging = ref(false);
const fileName = ref("");

const video = ref<HTMLVideoElement | null>(null);
const scanning = ref(false);
const cameraSupported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
let stream: MediaStream | null = null;
let frame = 0;
let lastScan = 0;

const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

function loadFile(file: File | undefined | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
        error.value = "That file is not an image.";
        return;
    }
    fileName.value = file.name;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
        URL.revokeObjectURL(url);
        decode(img);
    };
    img.onerror = () => {
        URL.revokeObjectURL(url);
        hasImage.value = false;
        decoded.value = "";
        error.value = "Could not load the image.";
    };
    img.src = url;
}

/** Draws a source onto the canvas (capped in size) and returns the decoded QR code, if any. */
function scanSource(src: CanvasImageSource, w: number, h: number, inversion: "attemptBoth" | "dontInvert") {
    const c = canvas.value;
    if (!c || !w || !h) return null;
    // Cap very large images to keep decoding fast.
    const max = 2000;
    const scale = Math.min(1, max / Math.max(w, h));
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(src, 0, 0, c.width, c.height);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const code = jsQR(data.data, data.width, data.height, { inversionAttempts: inversion });
    return code ? { code, ctx, c } : null;
}

function decode(img: HTMLImageElement) {
    stopCamera();
    const res = scanSource(img, img.naturalWidth, img.naturalHeight, "attemptBoth");
    hasImage.value = !!canvas.value;
    if (!res) {
        decoded.value = "";
        error.value = "No QR code found in this image. Try a sharper or larger picture.";
        return;
    }
    showResult(res);
}

function showResult({ code, ctx, c }: NonNullable<ReturnType<typeof scanSource>>) {
    error.value = "";
    decoded.value = code.data;
    const l = code.location;
    ctx.lineWidth = Math.max(3, c.width / 150);
    ctx.strokeStyle = "#22c55e";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(l.topLeftCorner.x, l.topLeftCorner.y);
    ctx.lineTo(l.topRightCorner.x, l.topRightCorner.y);
    ctx.lineTo(l.bottomRightCorner.x, l.bottomRightCorner.y);
    ctx.lineTo(l.bottomLeftCorner.x, l.bottomLeftCorner.y);
    ctx.closePath();
    ctx.stroke();
}

async function startCamera() {
    if (!cameraSupported) {
        error.value = "Camera access is not supported in this browser.";
        return;
    }
    error.value = "";
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
        });
    } catch (e) {
        const name = (e as DOMException)?.name;
        error.value =
            name === "NotAllowedError"
                ? "Camera permission was denied. Allow camera access and try again."
                : name === "NotFoundError"
                  ? "No camera was found on this device."
                  : "Could not start the camera.";
        return;
    }
    const v = video.value;
    if (!v) return stopCamera();
    hasImage.value = false;
    decoded.value = "";
    fileName.value = "";
    scanning.value = true;
    v.srcObject = stream;
    await v.play().catch(() => {});
    frame = requestAnimationFrame(tick);
}

function tick(t: number) {
    if (!scanning.value) return;
    const v = video.value;
    // Scan roughly 8 times per second to keep CPU usage low.
    if (v && v.readyState >= v.HAVE_ENOUGH_DATA && t - lastScan > 120) {
        lastScan = t;
        const res = scanSource(v, v.videoWidth, v.videoHeight, "dontInvert");
        if (res) {
            stopCamera();
            hasImage.value = true;
            fileName.value = "Camera capture";
            error.value = "";
            showResult(res);
            return;
        }
    }
    frame = requestAnimationFrame(tick);
}

function stopCamera() {
    cancelAnimationFrame(frame);
    scanning.value = false;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    if (video.value) video.value.srcObject = null;
}

onDeactivated(stopCamera);
onBeforeUnmount(stopCamera);

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
    stopCamera();
    hasImage.value = false;
    decoded.value = "";
    error.value = "";
    fileName.value = "";
}

useActiveEventListener("paste", onPaste);
</script>

<template>
    <ToolPage>
        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="Image">
                <template #actions>
                    <Btn v-if="!scanning" size="sm" :disabled="!cameraSupported" @click="startCamera"><Camera /> Scan with camera</Btn>
                    <Btn v-else size="sm" @click="stopCamera"><CameraOff /> Stop camera</Btn>
                    <Btn size="sm" variant="ghost" :disabled="!hasImage && !scanning" @click="clear"><Trash2 /> Clear</Btn>
                </template>
                <div v-show="scanning" class="relative overflow-hidden rounded-xl border border-line bg-black">
                    <video ref="video" class="mx-auto block max-h-96 w-full object-contain" muted playsinline />
                    <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div class="aspect-square w-1/2 max-w-60 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                    </div>
                    <p class="absolute inset-x-0 bottom-0 bg-black/50 py-1.5 text-center text-xs text-white">Point the camera at a QR code</p>
                </div>
                <label
                    v-show="!scanning"
                    class="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center text-sm text-muted transition"
                    :class="dragging ? 'border-accent bg-accent/10' : 'border-line-strong hover:bg-subtle'"
                    @dragover.prevent="dragging = true"
                    @dragleave.prevent="dragging = false"
                    @drop.prevent="onDrop"
                >
                    <ImagePlus class="size-7" />
                    <span><span class="font-medium text-fg">Choose an image</span>, drop it here, or paste with <kbd class="kbd">Ctrl</kbd>+<kbd class="kbd">V</kbd></span>
                    <input type="file" accept="image/*" class="hidden" @change="onFile" />
                </label>
                <div v-show="hasImage && !scanning" class="mt-4 overflow-hidden rounded-xl border border-line bg-subtle p-2">
                    <canvas ref="canvas" class="mx-auto block h-auto max-h-96 max-w-full" />
                </div>
                <p v-if="fileName && hasImage" class="mt-2 truncate text-xs text-muted">{{ fileName }}</p>
            </Panel>

            <Panel title="Result">
                <template #actions>
                    <CopyButton :text="decoded" />
                </template>
                <Notice v-if="error" type="error">{{ error }}</Notice>
                <div v-else-if="decoded" class="flex flex-col gap-3">
                    <Notice type="success">QR code decoded.</Notice>
                    <pre class="max-h-80 overflow-auto rounded-lg border border-line bg-subtle p-3 font-mono text-sm break-words whitespace-pre-wrap">{{ decoded }}</pre>
                    <a v-if="isUrl(decoded)" :href="decoded.trim()" target="_blank" rel="noopener noreferrer" class="break-all text-sm font-medium text-accent hover:underline">Open link</a>
                </div>
                <p v-else class="text-sm text-muted">The decoded text will appear here.</p>
            </Panel>
        </div>
    </ToolPage>
</template>
