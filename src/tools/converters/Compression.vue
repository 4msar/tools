<script setup lang="ts">
import { computed, ref } from "vue";
import { ClipboardPaste, Download, Sparkles, Trash2, Upload } from "lucide-vue-next";
import { deflate, deflateRaw, gzip, inflate, inflateRaw } from "pako";
import { Btn, CodeArea, CopyButton, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { downloadBlob, readClipboard } from "@/composables/useClipboard";

type Mode = "compress" | "decompress";
type Format = "gzip" | "zlib" | "deflate";
type Enc = "base64" | "hex";

const mode = ref<Mode>("compress");
const format = ref<Format>("gzip");
const outEnc = ref<Enc>("base64");
const inEnc = ref<Enc>("base64");
const level = ref(6);
const input = ref("");
const fileBytes = ref<Uint8Array | null>(null);
const fileName = ref("");

const SAMPLE = "The quick brown fox jumps over the lazy dog. ".repeat(20).trim();

function toBase64(bytes: Uint8Array) {
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
}
function fromBase64(b64: string) {
    let s = b64.replace(/^data:[^,]*,/, "").replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
function toHex(bytes: Uint8Array) {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
function fromHex(h: string) {
    const s = h.replace(/0x/gi, "").replace(/[\s:,-]+/g, "");
    if (!/^([0-9a-fA-F]{2})*$/.test(s)) throw new Error("Input is not valid hex (needs an even number of hex digits).");
    return Uint8Array.from(s.match(/../g) ?? [], (x) => parseInt(x, 16));
}
function detect(b: Uint8Array): Format {
    if (b.length >= 2 && b[0] === 0x1f && b[1] === 0x8b) return "gzip";
    if (b.length >= 2 && (b[0] & 0x0f) === 8 && ((b[0] << 8) | b[1]) % 31 === 0) return "zlib";
    return "deflate";
}
const FORMAT_LABEL: Record<Format, string> = { gzip: "GZIP", zlib: "zlib", deflate: "raw deflate" };

type Res = { bytes?: Uint8Array; text: string; inSize: number; outSize: number; detected?: Format; error?: string };

const result = computed<Res>(() => {
    try {
        if (mode.value === "compress") {
            if (!input.value) return { text: "", inSize: 0, outSize: 0 };
            const data = new TextEncoder().encode(input.value);
            const opts = { level: level.value as 1 };
            const bytes = format.value === "gzip" ? gzip(data, opts) : format.value === "zlib" ? deflate(data, opts) : deflateRaw(data, opts);
            return { bytes, text: outEnc.value === "base64" ? toBase64(bytes) : toHex(bytes), inSize: data.length, outSize: bytes.length };
        }
        let raw: Uint8Array;
        if (fileBytes.value) raw = fileBytes.value;
        else if (!input.value.trim()) return { text: "", inSize: 0, outSize: 0 };
        else raw = inEnc.value === "base64" ? fromBase64(input.value) : fromHex(input.value);
        const detected = detect(raw);
        const bytes = detected === "deflate" ? inflateRaw(raw) : inflate(raw);
        const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
        return { bytes, text, inSize: raw.length, outSize: bytes.length, detected };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const bad = mode.value === "decompress" && /Base64|atob|character/i.test(msg) ? "Input is not valid Base64." : msg;
        return { text: "", inSize: 0, outSize: 0, error: mode.value === "decompress" ? `Could not decompress: ${bad}` : bad };
    }
});

const ratio = computed(() => {
    const r = result.value;
    if (!r.inSize || !r.outSize) return "";
    if (mode.value === "compress") {
        const saved = (1 - r.outSize / r.inSize) * 100;
        return `${(r.outSize / r.inSize * 100).toFixed(1)}% of original (${saved >= 0 ? "saved" : "grew by"} ${Math.abs(saved).toFixed(1)}%)`;
    }
    return `Expanded ${(r.outSize / r.inSize).toFixed(2)}×`;
});

function fmt(n: number) {
    return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(2)} KB` : `${(n / 1048576).toFixed(2)} MB`;
}

async function onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    fileBytes.value = new Uint8Array(await f.arrayBuffer());
    fileName.value = f.name;
    mode.value = "decompress";
    (e.target as HTMLInputElement).value = "";
}
function clearFile() {
    fileBytes.value = null;
    fileName.value = "";
}
function clearAll() {
    input.value = "";
    clearFile();
}
function loadSample() {
    clearFile();
    if (mode.value === "compress") input.value = SAMPLE;
    else {
        const b = gzip(new TextEncoder().encode(SAMPLE));
        inEnc.value = "base64";
        input.value = toBase64(b);
    }
}
async function paste() {
    clearFile();
    input.value = await readClipboard();
}
function download() {
    const r = result.value;
    if (!r.bytes) return;
    if (mode.value === "compress") {
        const ext = format.value === "gzip" ? "gz" : format.value === "zlib" ? "zz" : "deflate";
        downloadBlob(r.bytes as BlobPart, `compressed.${ext}`, "application/octet-stream");
    } else downloadBlob(r.bytes as BlobPart, fileName.value.replace(/\.(gz|zz|deflate)$/i, "") || "decompressed.txt", "application/octet-stream");
}
function swap() {
    if (result.value.error || !result.value.text) return;
    if (mode.value === "compress") {
        inEnc.value = outEnc.value;
        input.value = result.value.text;
        mode.value = "decompress";
    } else {
        input.value = result.value.text;
        clearFile();
        mode.value = "compress";
    }
}
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="mode" :options="[{ value: 'compress', label: 'Compress' }, { value: 'decompress', label: 'Decompress' }]" />
        </template>

        <div class="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
            <template v-if="mode === 'compress'">
                <span class="flex items-center gap-2">Format
                    <Tabs v-model="format" size="sm" :options="[{ value: 'gzip', label: 'GZIP' }, { value: 'zlib', label: 'zlib' }, { value: 'deflate', label: 'Raw deflate' }]" />
                </span>
                <span class="flex items-center gap-2">Output
                    <Tabs v-model="outEnc" size="sm" :options="[{ value: 'base64', label: 'Base64' }, { value: 'hex', label: 'Hex' }]" />
                </span>
                <label class="flex items-center gap-2">Level {{ level }}
                    <input v-model.number="level" type="range" min="1" max="9" step="1" class="range !w-32" />
                </label>
            </template>
            <template v-else>
                <span class="flex items-center gap-2">Input
                    <Tabs v-model="inEnc" size="sm" :options="[{ value: 'base64', label: 'Base64' }, { value: 'hex', label: 'Hex' }]" />
                </span>
                <span class="text-xs text-muted">Format is detected from magic bytes (1f8b = gzip, 78xx = zlib, otherwise raw deflate).</span>
            </template>
            <label class="ml-auto inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-sm font-medium shadow-xs hover:bg-subtle">
                <Upload class="size-4" /> Open .gz file
                <input type="file" class="hidden" @change="onFile" />
            </label>
            <Btn size="sm" variant="secondary" @click="loadSample"><Sparkles /> Sample</Btn>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel :title="mode === 'compress' ? 'Text' : fileBytes ? 'File' : inEnc === 'base64' ? 'Base64' : 'Hex'" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="paste"><ClipboardPaste /> Paste</Btn>
                    <Btn size="sm" variant="ghost" :disabled="!input && !fileBytes" @click="clearAll"><Trash2 /> Clear</Btn>
                </template>
                <div v-if="fileBytes && mode === 'decompress'" class="flex items-center justify-between gap-3 p-4 text-sm">
                    <span class="min-w-0 truncate font-mono">{{ fileName }} <span class="text-muted">· {{ fmt(fileBytes.length) }}</span></span>
                    <Btn size="sm" variant="secondary" @click="clearFile">Remove file</Btn>
                </div>
                <CodeArea v-else v-model="input" height="16rem" :placeholder="mode === 'compress' ? 'Text to compress…' : inEnc === 'base64' ? 'Paste compressed Base64…' : 'Paste compressed hex…'" />
            </Panel>

            <Panel :title="mode === 'compress' ? (outEnc === 'base64' ? 'Base64' : 'Hex') : 'Decompressed text'" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" :disabled="!result.text" @click="swap">Use as input</Btn>
                    <Btn size="sm" variant="ghost" :disabled="!result.bytes" @click="download"><Download /> Download</Btn>
                    <CopyButton :text="result.text" />
                </template>
                <div v-if="result.error" class="p-4"><Notice type="error">{{ result.error }}</Notice></div>
                <CodeArea v-else :model-value="result.text" readonly height="16rem" placeholder="Output appears here" />
            </Panel>
        </div>

        <div v-if="result.outSize" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div class="rounded-xl border border-line bg-surface p-3">
                <div class="text-xs text-muted">{{ mode === 'compress' ? 'Input size' : 'Compressed size' }}</div>
                <div class="text-lg font-semibold">{{ fmt(result.inSize) }}</div>
            </div>
            <div class="rounded-xl border border-line bg-surface p-3">
                <div class="text-xs text-muted">{{ mode === 'compress' ? 'Compressed size' : 'Output size' }}</div>
                <div class="text-lg font-semibold">{{ fmt(result.outSize) }}</div>
            </div>
            <div class="col-span-2 rounded-xl border border-line bg-surface p-3">
                <div class="text-xs text-muted">{{ mode === 'compress' ? 'Ratio' : 'Detected format' }}</div>
                <div class="text-lg font-semibold">{{ mode === 'compress' ? ratio : result.detected ? FORMAT_LABEL[result.detected] : '' }}</div>
                <div v-if="mode === 'decompress'" class="text-xs text-muted">{{ ratio }}</div>
                <div v-else-if="outEnc" class="text-xs text-muted">Encoded text length: {{ result.text.length }} chars</div>
            </div>
        </div>
    </ToolPage>
</template>
