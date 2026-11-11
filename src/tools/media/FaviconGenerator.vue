<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Download, ImageUp } from "lucide-vue-next";
import { zipSync, strToU8 } from "fflate";
import { Btn, CodeArea, CopyButton, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { downloadBlob } from "@/composables/useClipboard";

const source = ref<"image" | "text">("text");
const img = ref<HTMLImageElement | null>(null);
const fileName = ref("");
const error = ref("");

const text = ref("D");
const fg = ref("#ffffff");
const bg = ref("#4f46e5");
const shape = ref<"rounded" | "square" | "circle">("rounded");
const fit = ref<"contain" | "cover">("contain");
const padding = ref(0);
const appName = ref("My App");
const themeColor = ref("#4f46e5");

const SIZES = [
    { name: "favicon-16x16.png", size: 16 },
    { name: "favicon-32x32.png", size: 32 },
    { name: "favicon-48x48.png", size: 48 },
    { name: "apple-touch-icon.png", size: 180 },
    { name: "android-chrome-192x192.png", size: 192 },
    { name: "android-chrome-512x512.png", size: 512 },
];

function draw(size: number, opaque = false): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    if (source.value === "text") {
        // Apple touch icons must be opaque squares; iOS rounds them itself.
        const r = opaque || shape.value === "square" ? 0 : shape.value === "circle" ? size / 2 : size * 0.22;
        ctx.fillStyle = bg.value;
        ctx.beginPath();
        ctx.roundRect(0, 0, size, size, r);
        ctx.fill();
        const t = [...text.value.trim()].slice(0, 3).join("") || "?";
        const scale = t.length === 1 ? 0.68 : t.length === 2 ? 0.5 : 0.36;
        ctx.fillStyle = fg.value;
        ctx.font = `700 ${size * scale}px system-ui, -apple-system, "Segoe UI", Roboto, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        const m = ctx.measureText(t);
        ctx.fillText(t, size / 2, size / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
    } else if (img.value) {
        if (opaque) {
            ctx.fillStyle = bg.value;
            ctx.fillRect(0, 0, size, size);
        }
        const pad = (size * padding.value) / 100;
        const box = size - pad * 2;
        const { naturalWidth: w, naturalHeight: h } = img.value;
        const s = fit.value === "contain" ? Math.min(box / w, box / h) : Math.max(box / w, box / h);
        ctx.save();
        ctx.beginPath();
        ctx.rect(pad, pad, box, box);
        ctx.clip();
        ctx.drawImage(img.value, (size - w * s) / 2, (size - h * s) / 2, w * s, h * s);
        ctx.restore();
    }
    return c;
}

const previews = ref<{ name: string; size: number; url: string }[]>([]);
const ready = computed(() => source.value === "text" || !!img.value);

function refresh() {
    previews.value = ready.value ? SIZES.map((s) => ({ ...s, url: draw(s.size, s.size === 180).toDataURL("image/png") })) : [];
}
watch([source, img, text, fg, bg, shape, fit, padding], refresh, { immediate: true });

let objectUrl = "";
function loadFile(f: File | undefined) {
    error.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
        error.value = "Choose an image file (PNG, JPEG, SVG or WebP).";
        return;
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
        img.value = im;
        fileName.value = f.name;
        source.value = "image";
    };
    im.onerror = () => (error.value = "The browser could not read that image.");
    im.src = objectUrl;
}
onBeforeUnmount(() => objectUrl && URL.revokeObjectURL(objectUrl));

const toPng = (c: HTMLCanvasElement) => new Promise<Uint8Array>((res, rej) => c.toBlob(async (b) => (b ? res(new Uint8Array(await b.arrayBuffer())) : rej(new Error("PNG export failed"))), "image/png"));

// ICO container holding PNG-compressed images (supported by every current browser and Windows Vista+).
function buildIco(images: { size: number; data: Uint8Array }[]): Uint8Array<ArrayBuffer> {
    const header = 6 + 16 * images.length;
    const out = new Uint8Array(header + images.reduce((n, i) => n + i.data.length, 0));
    const dv = new DataView(out.buffer);
    dv.setUint16(2, 1, true);
    dv.setUint16(4, images.length, true);
    let offset = header;
    images.forEach((im, i) => {
        const p = 6 + i * 16;
        out[p] = im.size >= 256 ? 0 : im.size;
        out[p + 1] = im.size >= 256 ? 0 : im.size;
        dv.setUint16(p + 4, 1, true);
        dv.setUint16(p + 6, 32, true);
        dv.setUint32(p + 8, im.data.length, true);
        dv.setUint32(p + 12, offset, true);
        out.set(im.data, offset);
        offset += im.data.length;
    });
    return out;
}

const manifest = computed(() =>
    JSON.stringify(
        {
            name: appName.value || "My App",
            short_name: (appName.value || "My App").slice(0, 12),
            icons: [
                { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
                { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
            ],
            theme_color: themeColor.value,
            background_color: "#ffffff",
            display: "standalone",
        },
        null,
        2,
    ),
);
const html = computed(() =>
    [
        '<link rel="icon" href="/favicon.ico" sizes="48x48">',
        '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
        '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
        '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
        '<link rel="manifest" href="/site.webmanifest">',
        `<meta name="theme-color" content="${themeColor.value}">`,
    ].join("\n"),
);

const busy = ref(false);
async function ico() {
    return buildIco(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await toPng(draw(size)) }))));
}
async function downloadIco() {
    downloadBlob(await ico(), "favicon.ico", "image/x-icon");
}
async function downloadZip() {
    busy.value = true;
    error.value = "";
    try {
        const files: Record<string, Uint8Array> = { "favicon.ico": await ico(), "site.webmanifest": strToU8(manifest.value + "\n"), "head.html": strToU8(html.value + "\n") };
        for (const s of SIZES) files[s.name] = await toPng(draw(s.size, s.size === 180));
        downloadBlob(new Uint8Array(zipSync(files, { level: 6 })), "favicon.zip", "application/zip");
    } catch (e) {
        error.value = (e as Error).message;
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="source" :options="[{ value: 'text', label: 'Letter or emoji' }, { value: 'image', label: 'Image' }]" />
        </template>

        <div class="grid gap-4 lg:grid-cols-[22rem_1fr]">
            <Panel title="Source">
                <div class="flex flex-col gap-3">
                    <template v-if="source === 'text'">
                        <Field label="Text" hint="One to three characters, or an emoji">
                            <input v-model="text" class="input text-lg" maxlength="8" />
                        </Field>
                        <div class="grid grid-cols-2 gap-3">
                            <Field label="Text color"><input v-model="fg" type="color" class="h-9 w-full cursor-pointer rounded-md border border-line bg-surface" /></Field>
                            <Field label="Background"><input v-model="bg" type="color" class="h-9 w-full cursor-pointer rounded-md border border-line bg-surface" /></Field>
                        </div>
                        <Field label="Shape">
                            <select v-model="shape" class="select"><option value="rounded">Rounded square</option><option value="circle">Circle</option><option value="square">Square</option></select>
                        </Field>
                    </template>
                    <template v-else>
                        <label
                            class="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted hover:bg-subtle"
                            @dragover.prevent @drop.prevent="loadFile($event.dataTransfer?.files[0])"
                        >
                            <ImageUp class="size-6" />
                            <span>{{ fileName || "Drop an image here or click to choose" }}</span>
                            <span class="text-xs">A square PNG or SVG of 512 px or more works best</span>
                            <input type="file" accept="image/*" class="hidden" @change="loadFile(($event.target as HTMLInputElement).files?.[0])" />
                        </label>
                        <Field label="Fit">
                            <select v-model="fit" class="select"><option value="contain">Contain (keep whole image)</option><option value="cover">Cover (crop to square)</option></select>
                        </Field>
                        <Field :label="`Padding: ${padding}%`"><input v-model.number="padding" type="range" min="0" max="25" class="range" /></Field>
                        <Field label="Apple icon background" hint="iOS does not allow transparent touch icons">
                            <input v-model="bg" type="color" class="h-9 w-full cursor-pointer rounded-md border border-line bg-surface" />
                        </Field>
                    </template>
                    <div class="grid grid-cols-2 gap-3 border-t border-line pt-3">
                        <Field label="App name"><input v-model="appName" class="input" /></Field>
                        <Field label="Theme color"><input v-model="themeColor" type="color" class="h-9 w-full cursor-pointer rounded-md border border-line bg-surface" /></Field>
                    </div>
                </div>
            </Panel>

            <Panel title="Icons">
                <template #actions>
                    <Btn size="sm" :disabled="!ready" @click="downloadIco"><Download /> favicon.ico</Btn>
                    <Btn size="sm" variant="primary" :disabled="!ready || busy" @click="downloadZip"><Download /> {{ busy ? "Building…" : "Download all (.zip)" }}</Btn>
                </template>
                <Notice v-if="error" type="error" class="mb-3">{{ error }}</Notice>
                <p v-if="!ready" class="text-sm text-muted">Choose an image to generate the icons.</p>
                <div v-else class="flex flex-wrap items-end gap-5">
                    <a v-for="p in previews" :key="p.name" :href="p.url" :download="p.name" class="group flex flex-col items-center gap-2" :title="`Download ${p.name}`">
                        <img :src="p.url" :alt="p.name" :width="Math.min(p.size, 128)" :height="Math.min(p.size, 128)" class="rounded border border-line bg-[conic-gradient(#8882_25%,transparent_0_50%,#8882_0_75%,transparent_0)] bg-[length:12px_12px]" />
                        <span class="text-xs text-muted group-hover:text-fg">{{ p.size }} × {{ p.size }}</span>
                    </a>
                </div>
                <p v-if="ready" class="mt-4 text-xs text-muted">The .ico file contains 16, 32 and 48 px images. The zip adds every PNG, <code class="code">site.webmanifest</code> and the HTML below.</p>
            </Panel>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="HTML for <head>" flush>
                <template #actions><CopyButton :text="html" /></template>
                <CodeArea :model-value="html" readonly :wrap="false" height="11rem" />
            </Panel>
            <Panel title="site.webmanifest" flush>
                <template #actions><CopyButton :text="manifest" /></template>
                <CodeArea :model-value="manifest" readonly :wrap="false" height="11rem" />
            </Panel>
        </div>
    </ToolPage>
</template>
