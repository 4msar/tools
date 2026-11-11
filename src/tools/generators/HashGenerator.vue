<script setup lang="ts">
import { computed, ref } from "vue";
import { FileUp, Trash2 } from "lucide-vue-next";
import { md5, sha1 } from "@noble/hashes/legacy.js";
import { sha224, sha256, sha384, sha512 } from "@noble/hashes/sha2.js";
import { keccak_256, sha3_256, sha3_512 } from "@noble/hashes/sha3.js";
import { hmac } from "@noble/hashes/hmac.js";
import { Btn, CodeArea, CopyButton, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";

interface Algo {
    name: string;
    fn: { (m: Uint8Array): Uint8Array; create: () => unknown; blockLen: number; outputLen: number };
}
const algos: Algo[] = [
    { name: "MD5", fn: md5 as unknown as Algo["fn"] },
    { name: "SHA-1", fn: sha1 as unknown as Algo["fn"] },
    { name: "SHA-224", fn: sha224 as unknown as Algo["fn"] },
    { name: "SHA-256", fn: sha256 as unknown as Algo["fn"] },
    { name: "SHA-384", fn: sha384 as unknown as Algo["fn"] },
    { name: "SHA-512", fn: sha512 as unknown as Algo["fn"] },
    { name: "SHA3-256", fn: sha3_256 as unknown as Algo["fn"] },
    { name: "SHA3-512", fn: sha3_512 as unknown as Algo["fn"] },
    { name: "Keccak-256", fn: keccak_256 as unknown as Algo["fn"] },
];

type Source = "text" | "file";
const source = ref<Source>("text");
const text = ref("Hello, world!");
const useHmac = ref(false);
const key = ref("");
const upper = ref(false);
const file = ref<File | null>(null);
const fileBytes = ref<Uint8Array | null>(null);
const loading = ref(false);
const dragging = ref(false);

const enc = new TextEncoder();
const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

const bytes = computed<Uint8Array | null>(() => (source.value === "text" ? enc.encode(text.value) : fileBytes.value));

const rows = computed(() => {
    const data = bytes.value;
    if (!data) return [];
    const k = enc.encode(key.value);
    return algos.map((a) => {
        let hex = "";
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            hex = toHex(useHmac.value ? hmac(a.fn as any, k, data) : a.fn(data));
        } catch {
            hex = "";
        }
        return { name: a.name, hex: upper.value ? hex.toUpperCase() : hex };
    });
});

const allText = computed(() => rows.value.map((r) => `${r.name}: ${r.hex}`).join("\n"));

async function loadFile(f: File | undefined | null) {
    if (!f) return;
    loading.value = true;
    file.value = f;
    fileBytes.value = null;
    try {
        fileBytes.value = new Uint8Array(await f.arrayBuffer());
    } finally {
        loading.value = false;
    }
}
function onPick(e: Event) {
    const el = e.target as HTMLInputElement;
    loadFile(el.files?.[0]);
    el.value = "";
}
function onDrop(e: DragEvent) {
    dragging.value = false;
    loadFile(e.dataTransfer?.files?.[0]);
}
function clearFile() {
    file.value = null;
    fileBytes.value = null;
}
function fmtSize(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1048576).toFixed(2)} MB`;
}
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="source" :options="[{ value: 'text', label: 'Text' }, { value: 'file', label: 'File' }]" />
        </template>

        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <label class="flex items-center gap-2"><input v-model="useHmac" type="checkbox" class="checkbox" /> HMAC</label>
            <label class="flex items-center gap-2"><input v-model="upper" type="checkbox" class="checkbox" /> Uppercase</label>
        </div>

        <Field v-if="useHmac" label="HMAC key" hint="The secret key, used as UTF-8 text.">
            <input v-model="key" class="input font-mono" placeholder="secret key" spellcheck="false" autocomplete="off" />
        </Field>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel :title="source === 'text' ? 'Input text' : 'File'" flush>
                <template #actions>
                    <Btn v-if="source === 'text'" size="sm" variant="ghost" :disabled="!text" @click="text = ''"><Trash2 /> Clear</Btn>
                    <Btn v-else size="sm" variant="ghost" :disabled="!file" @click="clearFile"><Trash2 /> Clear</Btn>
                </template>
                <CodeArea v-if="source === 'text'" v-model="text" placeholder="Type or paste text to hash…" />
                <label
                    v-else
                    class="m-4 flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm transition"
                    :class="dragging ? 'border-accent bg-accent/10' : 'border-line-strong hover:bg-subtle'"
                    @dragover.prevent="dragging = true"
                    @dragleave="dragging = false"
                    @drop.prevent="onDrop"
                >
                    <FileUp class="size-6 text-muted" />
                    <span v-if="file" class="font-medium break-all">{{ file.name }}</span>
                    <span v-if="file" class="text-xs text-muted">{{ fmtSize(file.size) }}{{ loading ? " · reading…" : "" }}</span>
                    <span v-else class="text-muted">Drop a file here or click to choose</span>
                    <input type="file" class="hidden" @change="onPick" />
                </label>
                <div class="border-t border-line px-4 py-2 text-xs text-muted">
                    {{ bytes ? bytes.length : 0 }} bytes
                </div>
            </Panel>

            <Panel title="Digests" flush>
                <template #actions><CopyButton :text="allText" label="Copy all" /></template>
                <div v-if="!bytes" class="p-4"><Notice type="info">{{ source === 'file' ? 'Choose a file to hash it.' : 'Enter text to see its hashes.' }}</Notice></div>
                <ul v-else class="divide-y divide-line">
                    <li v-for="r in rows" :key="r.name" class="flex items-start gap-2 px-4 py-2.5">
                        <div class="min-w-0 flex-1">
                            <div class="text-xs font-medium text-muted">{{ useHmac ? "HMAC-" : "" }}{{ r.name }}</div>
                            <div class="font-mono text-[13px] break-all">{{ r.hex }}</div>
                        </div>
                        <CopyButton :text="r.hex" icon-only />
                    </li>
                </ul>
            </Panel>
        </div>
    </ToolPage>
</template>
