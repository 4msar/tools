<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Eye, EyeOff, Lock, LockOpen } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";

// Output layout: "DT1" magic (3 bytes) | iterations (uint32 BE) | salt (16) | IV (12) | AES-256-GCM ciphertext + tag.
const MAGIC = [0x44, 0x54, 0x31];
const mode = ref<"encrypt" | "decrypt">("encrypt");
const input = ref("");
const password = ref("");
const show = ref(false);
const iterations = ref(600_000);
const encoding = ref<"base64" | "hex">("base64");
const output = ref("");
const error = ref("");
const busy = ref(false);

const toB64 = (u: Uint8Array) => {
    let s = "";
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return btoa(s);
};
const toHex = (u: Uint8Array) => Array.from(u, (b) => b.toString(16).padStart(2, "0")).join("");
function decode(text: string): Uint8Array<ArrayBuffer> {
    const t = text.replace(/\s+/g, "");
    if (/^[0-9a-fA-F]+$/.test(t) && t.length % 2 === 0) return Uint8Array.from(t.match(/../g)!, (h) => parseInt(h, 16));
    try {
        return Uint8Array.from(atob(t.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    } catch {
        throw new Error("The input is not valid Base64 or hex.");
    }
}

async function deriveKey(pw: string, salt: Uint8Array<ArrayBuffer>, iter: number) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function encrypt(text: string, pw: string) {
    const iter = Math.min(5_000_000, Math.max(10_000, Math.round(iterations.value) || 600_000));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(pw, salt, iter);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text)));
    const out = new Uint8Array(7 + 16 + 12 + ct.length);
    out.set(MAGIC);
    new DataView(out.buffer).setUint32(3, iter);
    out.set(salt, 7);
    out.set(iv, 23);
    out.set(ct, 35);
    return encoding.value === "hex" ? toHex(out) : toB64(out);
}

async function decrypt(text: string, pw: string) {
    const data = decode(text);
    if (data.length < 35 + 16 || MAGIC.some((b, i) => data[i] !== b)) throw new Error("This was not produced by this tool (missing DT1 header). See the format note below.");
    const iter = new DataView(data.buffer).getUint32(3);
    if (iter > 10_000_000) throw new Error("The iteration count in the header is implausibly large.");
    const key = await deriveKey(pw, data.slice(7, 23), iter);
    try {
        const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: data.slice(23, 35) }, key, data.slice(35));
        return new TextDecoder("utf-8", { fatal: false }).decode(pt);
    } catch {
        throw new Error("Decryption failed: the password is wrong or the data was changed.");
    }
}

async function runNow() {
    error.value = "";
    output.value = "";
    if (!input.value || !password.value) return;
    busy.value = true;
    try {
        output.value = mode.value === "encrypt" ? await encrypt(input.value, password.value) : await decrypt(input.value, password.value);
    } catch (e) {
        error.value = (e as Error).message;
    } finally {
        busy.value = false;
    }
}

// Results are tied to the exact inputs: clear them as soon as anything changes.
watch([input, password, mode, iterations, encoding], () => {
    output.value = "";
    error.value = "";
});

function swap() {
    const out = output.value;
    mode.value = mode.value === "encrypt" ? "decrypt" : "encrypt";
    input.value = out;
}

const strength = computed(() => {
    const p = password.value;
    if (!p) return null;
    if (p.length < 8) return { type: "warning" as const, text: "Short passwords can be guessed quickly. Use a long passphrase." };
    return null;
});
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="mode" :options="[{ value: 'encrypt', label: 'Encrypt' }, { value: 'decrypt', label: 'Decrypt' }]" />
        </template>

        <div class="grid gap-4 lg:grid-cols-2">
            <div class="flex min-w-0 flex-col gap-4">
                <Panel :title="mode === 'encrypt' ? 'Plain text' : 'Encrypted text'" flush>
                    <CodeArea v-model="input" height="14rem" :placeholder="mode === 'encrypt' ? 'Text to encrypt…' : 'Paste the Base64 or hex output of this tool…'" />
                </Panel>
                <Panel title="Password">
                    <div class="flex flex-col gap-3">
                        <div class="flex gap-2">
                            <input v-model="password" :type="show ? 'text' : 'password'" class="input font-mono" autocomplete="off" spellcheck="false" placeholder="Passphrase" aria-label="Password" @keydown.enter="runNow" />
                            <Btn :aria-label="show ? 'Hide password' : 'Show password'" @click="show = !show"><component :is="show ? EyeOff : Eye" /></Btn>
                        </div>
                        <Notice v-if="strength" :type="strength.type">{{ strength.text }}</Notice>
                        <div v-if="mode === 'encrypt'" class="grid grid-cols-2 gap-3">
                            <Field label="PBKDF2 iterations" hint="Higher is slower to brute-force"><input v-model.number="iterations" type="number" min="10000" step="50000" class="input" /></Field>
                            <Field label="Output encoding"><select v-model="encoding" class="select"><option value="base64">Base64</option><option value="hex">Hex</option></select></Field>
                        </div>
                        <div>
                            <Btn variant="primary" :disabled="!input || !password || busy" @click="runNow">
                                <component :is="mode === 'encrypt' ? Lock : LockOpen" /> {{ busy ? "Working…" : mode === "encrypt" ? "Encrypt" : "Decrypt" }}
                            </Btn>
                        </div>
                    </div>
                </Panel>
            </div>

            <Panel :title="mode === 'encrypt' ? 'Encrypted text' : 'Plain text'" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" :disabled="!output" :title="mode === 'encrypt' ? 'Decrypt this output' : 'Encrypt this output'" @click="swap">Use as input</Btn>
                    <CopyButton :text="output" />
                </template>
                <div v-if="error" class="p-4"><Notice type="error">{{ error }}</Notice></div>
                <CodeArea :model-value="output" readonly height="14rem" :placeholder="`Press ${mode === 'encrypt' ? 'Encrypt' : 'Decrypt'} to see the result`" />
                <div class="border-t border-line p-4 text-xs leading-relaxed text-muted">
                    <p><span class="font-medium text-fg">AES-256-GCM</span> with a key derived from your password by PBKDF2-HMAC-SHA-256 and a random salt. A fresh salt and IV are used every time, so encrypting the same text twice gives different output.</p>
                    <p class="mt-2">Format: <code class="code">"DT1"</code> · iterations (4 bytes) · salt (16) · IV (12) · ciphertext + 16-byte tag. Everything runs in your browser through the Web Crypto API. If you lose the password, the text cannot be recovered.</p>
                </div>
            </Panel>
        </div>
    </ToolPage>
</template>
