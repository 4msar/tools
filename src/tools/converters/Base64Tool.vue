<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowDownUp, ClipboardPaste, Download, Trash2, Upload } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { downloadBlob, readClipboard } from "@/composables/useClipboard";

type Mode = "encode" | "decode";
const mode = ref<Mode>("encode");
const input = ref("");
const urlSafe = ref(false);
const lineWrap = ref(false);
const fileName = ref("");

function bytesToBase64(bytes: Uint8Array) {
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
}

function base64ToBytes(b64: string) {
    let s = b64.replace(/^data:[^,]*,/, "").replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const bin = atob(s);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const result = computed<{ out: string; error?: string; bytes?: Uint8Array }>(() => {
    if (!input.value) return { out: "" };
    try {
        if (mode.value === "encode") {
            let out = bytesToBase64(new TextEncoder().encode(input.value));
            if (urlSafe.value) out = out.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
            if (lineWrap.value) out = out.replace(/(.{76})/g, "$1\n").trim();
            return { out };
        }
        const bytes = base64ToBytes(input.value);
        const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
        return { out: text, bytes };
    } catch {
        return { out: "", error: "Input is not valid Base64." };
    }
});

const stats = computed(() => {
    const inBytes = new TextEncoder().encode(input.value).length;
    const outBytes = new TextEncoder().encode(result.value.out).length;
    return { inBytes, outBytes };
});

function swap() {
    if (result.value.error) return;
    input.value = result.value.out;
    mode.value = mode.value === "encode" ? "decode" : "encode";
}

async function paste() {
    input.value = await readClipboard();
}

async function onFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    fileName.value = file.name;
    const bytes = new Uint8Array(await file.arrayBuffer());
    mode.value = "decode";
    input.value = `data:${file.type || "application/octet-stream"};base64,${bytesToBase64(bytes)}`;
    (e.target as HTMLInputElement).value = "";
}

function downloadDecoded() {
    const bytes = result.value.bytes;
    if (bytes) downloadBlob(bytes as BlobPart, fileName.value || "decoded.bin", "application/octet-stream");
}
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="mode" :options="[{ value: 'encode', label: 'Encode' }, { value: 'decode', label: 'Decode' }]" />
        </template>

        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <label class="flex items-center gap-2"><input v-model="urlSafe" type="checkbox" class="checkbox" :disabled="mode === 'decode'" /> URL-safe</label>
            <label class="flex items-center gap-2"><input v-model="lineWrap" type="checkbox" class="checkbox" :disabled="mode === 'decode'" /> Wrap at 76 chars</label>
            <label class="ml-auto inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-sm font-medium shadow-xs hover:bg-subtle">
                        <Upload class="size-4" /> Encode a file
                <input type="file" class="hidden" @change="onFile" />
            </label>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel :title="mode === 'encode' ? 'Text' : 'Base64'" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="paste"><ClipboardPaste /> Paste</Btn>
                    <Btn size="sm" variant="ghost" :disabled="!input" @click="input = ''"><Trash2 /> Clear</Btn>
                </template>
                <CodeArea v-model="input" :placeholder="mode === 'encode' ? 'Type or paste text to encode…' : 'Paste Base64 or a data URI to decode…'" />
                <div class="border-t border-line px-4 py-2 text-xs text-muted">{{ input.length }} chars · {{ stats.inBytes }} bytes</div>
            </Panel>

            <Panel :title="mode === 'encode' ? 'Base64' : 'Text'" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" :disabled="!result.out" title="Use output as input" @click="swap"><ArrowDownUp /> Swap</Btn>
                    <Btn v-if="mode === 'decode' && result.bytes" size="sm" variant="ghost" @click="downloadDecoded"><Download /> Download</Btn>
                    <CopyButton :text="result.out" />
                </template>
                <div v-if="result.error" class="p-4"><Notice type="error">{{ result.error }}</Notice></div>
                <CodeArea v-else :model-value="result.out" readonly placeholder="Output appears here" />
                <div class="border-t border-line px-4 py-2 text-xs text-muted">{{ result.out.length }} chars · {{ stats.outBytes }} bytes</div>
            </Panel>
        </div>
    </ToolPage>
</template>
