<script setup lang="ts">
import { computed, ref } from "vue";
import { Upload } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";

type Page = "crc" | "luhn";
type Source = "text" | "hex" | "file";
const page = ref<Page>("crc");
const source = ref<Source>("text");
const text = ref("123456789");
const hex = ref("");
const fileName = ref("");
const fileBytes = ref<Uint8Array>(new Uint8Array());

interface CrcSpec { name: string; width: 8 | 16 | 32; poly: number; init: number; reflect: boolean; xorOut: number }
const specs: CrcSpec[] = [
    { name: "CRC-32 (IEEE)", width: 32, poly: 0x04c11db7, init: 0xffffffff, reflect: true, xorOut: 0xffffffff },
    { name: "CRC-32C (Castagnoli)", width: 32, poly: 0x1edc6f41, init: 0xffffffff, reflect: true, xorOut: 0xffffffff },
    { name: "CRC-16/CCITT-FALSE", width: 16, poly: 0x1021, init: 0xffff, reflect: false, xorOut: 0 },
    { name: "CRC-16/ARC", width: 16, poly: 0x8005, init: 0, reflect: true, xorOut: 0 },
    { name: "CRC-8", width: 8, poly: 0x07, init: 0, reflect: false, xorOut: 0 },
];

function reverseBits(v: number, width: number) {
    let r = 0;
    for (let i = 0; i < width; i++) {
        r = (r << 1) | (v & 1);
        v >>>= 1;
    }
    return r >>> 0;
}

const tables = new Map<string, Uint32Array>();
function tableFor(s: CrcSpec) {
    let t = tables.get(s.name);
    if (t) return t;
    t = new Uint32Array(256);
    const top = 2 ** (s.width - 1);
    const mask = s.width === 32 ? 0xffffffff : (1 << s.width) - 1;
    if (s.reflect) {
        const rp = reverseBits(s.poly, s.width);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ rp : c >>> 1;
            t[i] = c >>> 0;
        }
    } else {
        for (let i = 0; i < 256; i++) {
            let c = (i << (s.width - 8)) >>> 0;
            for (let k = 0; k < 8; k++) c = ((c & top ? (c << 1) ^ s.poly : c << 1) & mask) >>> 0;
            t[i] = c;
        }
    }
    tables.set(s.name, t);
    return t;
}

function crc(s: CrcSpec, data: Uint8Array) {
    const t = tableFor(s);
    const mask = s.width === 32 ? 0xffffffff : (1 << s.width) - 1;
    let c = s.init >>> 0;
    if (s.reflect) {
        for (let i = 0; i < data.length; i++) c = (t[(c ^ data[i]) & 0xff] ^ (c >>> 8)) >>> 0;
    } else {
        const sh = s.width - 8;
        for (let i = 0; i < data.length; i++) c = (((c << 8) ^ t[((c >>> sh) ^ data[i]) & 0xff]) & mask) >>> 0;
    }
    return ((c ^ s.xorOut) & mask) >>> 0;
}

function adler32(data: Uint8Array) {
    let a = 1;
    let b = 0;
    for (let i = 0; i < data.length; i++) {
        a = (a + data[i]) % 65521;
        b = (b + a) % 65521;
    }
    return ((b << 16) | a) >>> 0;
}

const parsed = computed<{ bytes: Uint8Array; error?: string }>(() => {
    if (source.value === "text") return { bytes: new TextEncoder().encode(text.value) };
    if (source.value === "file") return { bytes: fileBytes.value };
    const clean = hex.value.replace(/0x/gi, "").replace(/[\s,:\-]/g, "");
    if (clean && !/^[0-9a-fA-F]*$/.test(clean)) return { bytes: new Uint8Array(), error: "Hex input contains non-hex characters." };
    if (clean.length % 2) return { bytes: new Uint8Array(), error: "Hex input has an odd number of digits." };
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
    return { bytes: out };
});

const results = computed(() => {
    if (parsed.value.error) return [];
    const b = parsed.value.bytes;
    const list = specs.map((s) => ({ name: s.name, v: crc(s, b), digits: s.width / 4 }));
    list.push({ name: "Adler-32", v: adler32(b), digits: 8 });
    return list.map((r) => ({ name: r.name, hex: r.v.toString(16).toUpperCase().padStart(r.digits, "0"), dec: String(r.v) }));
});

async function onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    fileName.value = `${f.name} (${f.size.toLocaleString()} bytes)`;
    fileBytes.value = new Uint8Array(await f.arrayBuffer());
    (e.target as HTMLInputElement).value = "";
}

// Luhn
const luhnInput = ref("4539 1488 0343 6467");
const luhn = computed(() => {
    const raw = luhnInput.value.trim();
    if (!raw) return null;
    if (/[^\d\s-]/.test(raw)) return { error: "Only digits, spaces and dashes are allowed." };
    const digits = raw.replace(/[\s-]/g, "");
    if (!digits) return null;
    const sum = (d: string, startDouble: boolean) => {
        let total = 0;
        let dbl = startDouble;
        for (let i = d.length - 1; i >= 0; i--) {
            let n = d.charCodeAt(i) - 48;
            if (dbl) {
                n *= 2;
                if (n > 9) n -= 9;
            }
            total += n;
            dbl = !dbl;
        }
        return total;
    };
    const check = (10 - (sum(digits, true) % 10)) % 10;
    return { digits, valid: digits.length > 1 && sum(digits, false) % 10 === 0, check, full: digits + check };
});
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="page" :options="[{ value: 'crc', label: 'CRC / Adler' }, { value: 'luhn', label: 'Luhn' }]" />
        </template>

        <template v-if="page === 'crc'">
            <Panel title="Input" flush>
                <template #actions>
                    <Tabs v-model="source" size="sm" :options="[{ value: 'text', label: 'Text' }, { value: 'hex', label: 'Hex bytes' }, { value: 'file', label: 'File' }]" />
                </template>
                <CodeArea v-if="source === 'text'" v-model="text" placeholder="Type or paste text…" height="10rem" />
                <CodeArea v-else-if="source === 'hex'" v-model="hex" placeholder="e.g. 31 32 33 34 35 36 37 38 39 or 0x31,0x32" height="10rem" :invalid="!!parsed.error" />
                <div v-else class="flex min-h-40 flex-col items-center justify-center gap-2 p-4">
                    <label class="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-sm font-medium shadow-xs hover:bg-subtle">
                        <Upload class="size-4" /> Choose a file
                        <input type="file" class="hidden" @change="onFile" />
                    </label>
                    <span class="text-xs text-muted">{{ fileName || "Processed locally in your browser" }}</span>
                </div>
                <div class="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-muted">
                    <span>{{ parsed.bytes.length.toLocaleString() }} bytes</span>
                    <Btn v-if="source === 'text'" size="sm" variant="ghost" @click="text = '123456789'">Use check string</Btn>
                </div>
            </Panel>

            <Notice v-if="parsed.error" type="error">{{ parsed.error }}</Notice>
            <Panel v-else title="Checksums" flush>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="text-left text-xs text-muted uppercase">
                            <tr><th class="px-4 py-2 font-medium">Algorithm</th><th class="px-4 py-2 font-medium">Hex</th><th class="px-4 py-2 font-medium">Decimal</th></tr>
                        </thead>
                        <tbody class="divide-y divide-line border-t border-line">
                            <tr v-for="r in results" :key="r.name">
                                <td class="px-4 py-2.5 whitespace-nowrap">{{ r.name }}</td>
                                <td class="px-4 py-2.5"><span class="inline-flex items-center gap-1 font-mono">0x{{ r.hex }}<CopyButton :text="r.hex" icon-only /></span></td>
                                <td class="px-4 py-2.5"><span class="inline-flex items-center gap-1 font-mono tabular-nums">{{ r.dec }}<CopyButton :text="r.dec" icon-only /></span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </Panel>
            <p class="text-xs text-muted">For the string "123456789" the standard check values are CBF43926 (CRC-32), E3069283 (CRC-32C), 29B1 (CCITT-FALSE), BB3D (ARC), F4 (CRC-8) and 091E01DE (Adler-32).</p>
        </template>

        <template v-else>
            <Panel title="Number">
                <Field label="Digits" hint="Spaces and dashes are ignored.">
                    <input v-model="luhnInput" class="input font-mono text-base" inputmode="numeric" spellcheck="false" placeholder="Card, IMEI or other Luhn number" />
                </Field>
            </Panel>
            <Notice v-if="luhn && 'error' in luhn" type="error">{{ luhn.error }}</Notice>
            <div v-else-if="luhn" class="grid gap-4 lg:grid-cols-2">
                <Panel title="Validate">
                    <Notice :type="luhn.valid ? 'success' : 'error'">{{ luhn.valid ? "Valid: the number passes the Luhn check." : "Invalid: the number fails the Luhn check." }}</Notice>
                    <p class="mt-3 text-xs text-muted">{{ luhn.digits.length }} digits</p>
                </Panel>
                <Panel title="Check digit">
                    <p class="text-sm text-muted">Treating the input as a payload without a check digit:</p>
                    <div class="mt-2 flex items-center justify-between gap-2 rounded-lg bg-subtle px-3 py-2">
                        <span class="font-mono text-lg"><span class="text-muted">{{ luhn.digits }}</span><span class="font-semibold text-accent">{{ luhn.check }}</span></span>
                        <CopyButton :text="luhn.full" icon-only />
                    </div>
                    <div class="mt-3"><Btn size="sm" @click="luhnInput = luhn.full">Append check digit {{ luhn.check }}</Btn></div>
                </Panel>
            </div>
        </template>
    </ToolPage>
</template>
