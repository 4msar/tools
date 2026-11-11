<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { KeyRound, ScanSearch } from "lucide-vue-next";
import { CompactSign, exportPKCS8, exportSPKI, generateKeyPair, importPKCS8 } from "jose";
import { Btn, CodeArea, CopyButton, Field, Notice, Panel } from "@/components/ui";

const emit = defineEmits<{ decode: [token: string, key: string, hmac: boolean] }>();

const ALGS = ["HS256", "HS384", "HS512", "RS256", "RS384", "RS512", "PS256", "ES256", "ES384", "EdDSA"];
const alg = ref("HS256");
const isHmac = computed(() => alg.value.startsWith("HS"));

const now = Math.floor(Date.now() / 1000);
const payload = ref(JSON.stringify({ sub: "1234567890", name: "John Doe", iat: now, exp: now + 3600 }, null, 2));
const extraHeader = ref("");
const secret = ref("your-256-bit-secret");
const privateKey = ref("");
const publicKey = ref("");
const token = ref("");
const error = ref("");
const busy = ref(false);

const header = computed(() => {
    let extra: Record<string, unknown> = {};
    if (extraHeader.value.trim()) extra = JSON.parse(extraHeader.value);
    return { typ: "JWT", ...extra, alg: alg.value };
});

let reqId = 0;
async function sign() {
    const id = ++reqId;
    error.value = "";
    try {
        let body: unknown;
        try {
            body = JSON.parse(payload.value);
        } catch (e) {
            throw new Error("Payload is not valid JSON: " + (e as Error).message);
        }
        let head: Record<string, unknown>;
        try {
            head = JSON.parse(JSON.stringify(header.value));
        } catch (e) {
            throw new Error("Extra header fields are not valid JSON: " + (e as Error).message);
        }
        let key: CryptoKey | Uint8Array;
        if (isHmac.value) {
            if (!secret.value) throw new Error("Enter a secret to sign with.");
            key = new TextEncoder().encode(secret.value);
        } else {
            if (!privateKey.value.trim()) {
                token.value = "";
                return;
            }
            if (!/BEGIN PRIVATE KEY/.test(privateKey.value)) throw new Error("Paste a PKCS#8 private key (BEGIN PRIVATE KEY), or generate a key pair.");
            key = await importPKCS8(privateKey.value.trim(), alg.value);
        }
        const jws = await new CompactSign(new TextEncoder().encode(JSON.stringify(body))).setProtectedHeader(head as { alg: string }).sign(key);
        if (id === reqId) token.value = jws;
    } catch (e) {
        if (id !== reqId) return;
        token.value = "";
        error.value = e instanceof Error ? e.message : String(e);
    }
}

async function generate() {
    busy.value = true;
    error.value = "";
    try {
        const pair = await generateKeyPair(alg.value, { extractable: true });
        privateKey.value = await exportPKCS8(pair.privateKey);
        publicKey.value = await exportSPKI(pair.publicKey);
    } catch (e) {
        error.value = "Could not generate a key pair: " + (e as Error).message;
    } finally {
        busy.value = false;
    }
}

function setTimes() {
    try {
        const p = JSON.parse(payload.value);
        const t = Math.floor(Date.now() / 1000);
        p.iat = t;
        p.exp = t + 3600;
        payload.value = JSON.stringify(p, null, 2);
    } catch {
        error.value = "Payload is not valid JSON.";
    }
}

watch(alg, (a, old) => {
    if (a.startsWith("HS") !== old.startsWith("HS") || !a.startsWith("HS")) {
        privateKey.value = "";
        publicKey.value = "";
    }
});
watch([alg, payload, extraHeader, secret, privateKey], sign, { immediate: true });
</script>

<template>
    <div class="grid gap-4 lg:grid-cols-2">
        <div class="flex min-w-0 flex-col gap-4">
            <Panel title="Header">
                <div class="grid gap-3 sm:grid-cols-2">
                    <Field label="Algorithm">
                        <select v-model="alg" class="select">
                            <option v-for="a in ALGS" :key="a" :value="a">{{ a }}</option>
                        </select>
                    </Field>
                    <Field label="Extra header fields (JSON)" hint='Optional, e.g. {"kid":"key-1"}'>
                        <input v-model="extraHeader" class="input font-mono" spellcheck="false" placeholder='{"kid":"key-1"}' />
                    </Field>
                </div>
            </Panel>
            <Panel title="Payload" flush>
                <template #actions><Btn size="sm" variant="ghost" title="Set iat to now and exp to one hour from now" @click="setTimes">Refresh iat / exp</Btn></template>
                <CodeArea v-model="payload" :wrap="false" height="14rem" placeholder='{"sub":"123"}' />
            </Panel>
        </div>

        <div class="flex min-w-0 flex-col gap-4">
            <Panel :title="isHmac ? 'Secret' : 'Private key'">
                <Field v-if="isHmac" label="Secret" hint="Signing happens in your browser. Nothing is sent anywhere.">
                    <input v-model="secret" class="input font-mono" spellcheck="false" autocomplete="off" />
                </Field>
                <div v-else class="space-y-3">
                    <Field label="Private key (PKCS#8 PEM)" hint="Use a throwaway key here. Never paste a production private key into a web page.">
                        <textarea v-model="privateKey" class="input min-h-32 py-2 font-mono text-[13px]" spellcheck="false" placeholder="-----BEGIN PRIVATE KEY-----&#10;…&#10;-----END PRIVATE KEY-----" />
                    </Field>
                    <Btn :disabled="busy" @click="generate"><KeyRound /> {{ busy ? "Generating…" : `Generate ${alg} key pair` }}</Btn>
                    <Field v-if="publicKey" label="Matching public key (for verifying)">
                        <div class="relative">
                            <pre class="max-h-40 overflow-auto rounded-lg bg-subtle p-3 font-mono text-xs break-all whitespace-pre-wrap">{{ publicKey }}</pre>
                            <div class="absolute top-1.5 right-1.5"><CopyButton :text="publicKey" icon-only /></div>
                        </div>
                    </Field>
                </div>
            </Panel>

            <Panel title="Signed token" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" :disabled="!token" @click="emit('decode', token, isHmac ? secret : publicKey, isHmac)"><ScanSearch /> Decode</Btn>
                    <CopyButton :text="token" />
                </template>
                <div v-if="error" class="p-4"><Notice type="error">{{ error }}</Notice></div>
                <p v-else-if="!token" class="p-4 text-sm text-muted">{{ isHmac ? "Enter a payload and secret." : "Paste or generate a private key to sign the token." }}</p>
                <div v-else class="p-4 font-mono text-[13px] leading-relaxed break-all">{{ token }}</div>
            </Panel>
        </div>
    </div>
</template>
