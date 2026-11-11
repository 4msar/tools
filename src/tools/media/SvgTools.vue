<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Download, Sparkles, Trash2, Upload } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { downloadBlob } from "@/composables/useClipboard";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Created with a vector editor -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="240px" height="160px" viewBox="0 0 240 160" version="1.1">
    <title>Sample</title>
    <defs>
        <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#4f46e5;stop-opacity:1.000000" />
            <stop offset="100%" style="stop-color:#06b6d4;stop-opacity:1.000000" />
        </linearGradient>
    </defs>
    <g id="Layer_1" fill="none" stroke="none">
        <rect x="0.000000" y="0.000000" width="240.000000" height="160.000000" rx="16.000000" fill="url(#sky)"></rect>
        <circle cx="180.000000" cy="48.000000" r="22.000000" fill="#fde68a"></circle>
        <path d="M 0.000000,160.000000 L 70.000000,70.000000 L 120.000000,130.000000 L 160.000000,95.000000 L 240.000000,160.000000 Z" fill="#0f172a" fill-opacity="0.550000"></path>
    </g>
</svg>`;

const input = ref(SAMPLE);
const tab = ref<"optimized" | "datauri" | "css" | "jsx">("optimized");
const multipass = ref(true);
const keepViewBox = ref(true);
const precision = ref(2);
const bg = ref<"checker" | "light" | "dark">("checker");

// Validate as XML and read the intrinsic size.
const meta = computed<{ error?: string; w: number; h: number }>(() => {
    if (!input.value.trim()) return { w: 0, h: 0 };
    const doc = new DOMParser().parseFromString(input.value, "image/svg+xml");
    const err = doc.querySelector("parsererror");
    const root = doc.documentElement;
    if (err || root.nodeName.toLowerCase() !== "svg") return { error: err ? "This is not valid SVG (XML parse error)." : "The root element is not <svg>.", w: 0, h: 0 };
    const vb = (root.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
    const w = parseFloat(root.getAttribute("width") ?? "") || vb[2] || 300;
    const h = parseFloat(root.getAttribute("height") ?? "") || vb[3] || 150;
    return { w, h };
});

const optimized = ref("");
const optError = ref("");
let run = 0;
watch(
    [input, multipass, keepViewBox, precision, () => meta.value.error],
    async () => {
        const id = ++run;
        optError.value = "";
        if (!input.value.trim() || meta.value.error) {
            optimized.value = "";
            return;
        }
        try {
            const { optimize } = await import("svgo/browser");
            const res = optimize(input.value, {
                multipass: multipass.value,
                floatPrecision: precision.value,
                plugins: keepViewBox.value ? ["preset-default"] : ["preset-default", "removeViewBox"],
            });
            if (id === run) optimized.value = res.data;
        } catch (e) {
            if (id === run) {
                optimized.value = "";
                optError.value = (e as Error).message;
            }
        }
    },
    { immediate: true },
);

const best = computed(() => optimized.value || input.value.trim());
const bytes = (s: string) => new TextEncoder().encode(s).length;
const saved = computed(() => {
    const a = bytes(input.value);
    const b = bytes(optimized.value);
    return a && b ? { a, b, pct: Math.round((1 - b / a) * 100) } : null;
});

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const b64Chunked = (s: string) => {
    const u = new TextEncoder().encode(s);
    let out = "";
    for (let i = 0; i < u.length; i += 0x8000) out += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return btoa(out);
};
// Compact URL-encoded data URI (smaller than Base64 for SVG).
const uriEncoded = computed(() => "data:image/svg+xml," + best.value.replace(/"/g, "'").replace(/\s+/g, " ").replace(/[\r\n%#()<>?[\\\]^`{|}]/g, encodeURIComponent));
const uriBase64 = computed(() => "data:image/svg+xml;base64," + (best.value.length < 30000 ? b64(best.value) : b64Chunked(best.value)));
const previewSrc = computed(() => (meta.value.error || !input.value.trim() ? "" : "data:image/svg+xml;base64," + b64Chunked(input.value)));

const jsx = computed(() =>
    best.value
        .replace(/<\?xml[^>]*\?>\s*/g, "")
        .replace(/\s(xmlns:xlink|xml:space|version)="[^"]*"/g, "")
        .replace(/\bclass=/g, "className=")
        .replace(/\bxlink:href=/g, "href=")
        .replace(/\s([a-z]+(?:-[a-z]+)+)=/g, (_m, name: string) => (name.startsWith("data-") || name.startsWith("aria-") ? ` ${name}=` : ` ${name.replace(/-([a-z])/g, (_x, c: string) => c.toUpperCase())}=`))
        .replace(/style="([^"]*)"/g, (_m, css: string) => {
            const obj = css.split(";").map((d) => d.trim()).filter(Boolean).map((d) => {
                const i = d.indexOf(":");
                return `${d.slice(0, i).trim().replace(/-([a-z])/g, (_x, c: string) => c.toUpperCase())}: "${d.slice(i + 1).trim()}"`;
            });
            return `style={{ ${obj.join(", ")} }}`;
        }),
);

const outputs = computed(() => ({
    optimized: optimized.value,
    datauri: `${uriEncoded.value}\n\n${uriBase64.value}`,
    css: `background-image: url("${uriEncoded.value}");`,
    jsx: `export function Icon(props) {\n  return (\n${jsx.value.replace(/<svg/, "<svg {...props}").split("\n").map((l) => "    " + l).join("\n")}\n  );\n}`,
}));

// ---- PNG export ----
const pngWidth = ref(512);
const pngBg = ref("");
const pngError = ref("");
const pngHeight = computed(() => (meta.value.w ? Math.round((pngWidth.value || 0) * (meta.value.h / meta.value.w)) : 0));
function exportPng() {
    pngError.value = "";
    const w = Math.min(8192, Math.max(1, Math.round(pngWidth.value || 0)));
    const h = Math.max(1, Math.round(w * (meta.value.h / meta.value.w)));
    const img = new Image();
    img.onload = () => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d")!;
        if (pngBg.value) {
            ctx.fillStyle = pngBg.value;
            ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(img, 0, 0, w, h);
        c.toBlob((b) => (b ? downloadBlob(b, "image.png", "image/png") : (pngError.value = "Could not render the PNG.")), "image/png");
    };
    img.onerror = () => (pngError.value = "The browser could not render this SVG.");
    img.src = previewSrc.value;
}

async function onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) input.value = await f.text();
    (e.target as HTMLInputElement).value = "";
}
const fmtB = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(2)} KB`);
</script>

<template>
    <ToolPage>
        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="SVG source" flush>
                <template #actions>
                    <label class="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted hover:bg-subtle hover:text-fg">
                        <Upload class="size-3.5" /> Open<input type="file" class="hidden" accept=".svg,image/svg+xml" @change="onFile" />
                    </label>
                    <Btn size="sm" variant="ghost" @click="input = SAMPLE"><Sparkles /> Sample</Btn>
                    <Btn size="sm" variant="ghost" :disabled="!input" @click="input = ''"><Trash2 /> Clear</Btn>
                </template>
                <CodeArea v-model="input" :wrap="false" height="20rem" :invalid="!!meta.error" placeholder="Paste SVG markup or open a file…" />
                <div v-if="meta.error" class="border-t border-line px-4 py-2 text-xs text-danger">{{ meta.error }}</div>
            </Panel>

            <Panel title="Preview" flush>
                <template #actions>
                    <span v-if="meta.w" class="mr-1 text-xs text-muted">{{ meta.w }} × {{ meta.h }}</span>
                    <Tabs v-model="bg" size="sm" :options="[{ value: 'checker', label: 'Grid' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]" />
                </template>
                <!-- Rendered through <img>, so scripts inside the SVG cannot run. -->
                <div class="flex h-[20rem] items-center justify-center overflow-auto p-4" :class="bg === 'light' ? 'bg-white' : bg === 'dark' ? 'bg-neutral-900' : 'checker'">
                    <img v-if="previewSrc" :src="previewSrc" alt="SVG preview" class="max-h-full max-w-full" />
                    <span v-else class="text-sm text-muted">Nothing to preview.</span>
                </div>
            </Panel>
        </div>

        <Panel flush>
            <template #title>
                Output
                <span v-if="saved" class="ml-2 text-xs font-normal text-muted">{{ fmtB(saved.a) }} → {{ fmtB(saved.b) }} <span class="text-success">({{ saved.pct }}% smaller)</span></span>
            </template>
            <template #actions>
                <Tabs v-model="tab" size="sm" :options="[{ value: 'optimized', label: 'Optimized' }, { value: 'datauri', label: 'Data URI' }, { value: 'css', label: 'CSS' }, { value: 'jsx', label: 'JSX' }]" />
                <Btn v-if="tab === 'optimized'" size="sm" variant="ghost" :disabled="!optimized" @click="downloadBlob(optimized, 'optimized.svg', 'image/svg+xml')"><Download /> Download</Btn>
                <CopyButton :text="outputs[tab]" />
            </template>
            <div class="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-4 py-2 text-sm">
                <label class="flex items-center gap-2"><input v-model="multipass" type="checkbox" class="checkbox" /> Multipass</label>
                <label class="flex items-center gap-2"><input v-model="keepViewBox" type="checkbox" class="checkbox" /> Keep viewBox</label>
                <label class="flex items-center gap-2"><span class="text-muted">Decimal places</span><input v-model.number="precision" type="number" min="0" max="8" class="input !w-20" /></label>
            </div>
            <div v-if="optError" class="p-4"><Notice type="error">Could not optimize: {{ optError }}</Notice></div>
            <CodeArea v-else :model-value="outputs[tab]" readonly height="14rem" placeholder="Output appears here" />
        </Panel>

        <Panel title="Export as PNG">
            <div class="flex flex-wrap items-end gap-3">
                <Field label="Width (px)"><input v-model.number="pngWidth" type="number" min="1" max="8192" class="input !w-32" /></Field>
                <Field label="Height (px)"><input :value="pngHeight" class="input !w-32" readonly tabindex="-1" /></Field>
                <Field label="Background" hint="Empty keeps it transparent"><input v-model="pngBg" class="input !w-40 font-mono" placeholder="transparent" spellcheck="false" /></Field>
                <div class="pb-6"><Btn variant="primary" :disabled="!previewSrc" @click="exportPng"><Download /> Download PNG</Btn></div>
            </div>
            <Notice v-if="pngError" type="error" class="mt-3">{{ pngError }}</Notice>
        </Panel>
    </ToolPage>
</template>

<style scoped>
.checker {
    background-image: conic-gradient(#8882 25%, transparent 0 50%, #8882 0 75%, transparent 0);
    background-size: 20px 20px;
}
</style>
