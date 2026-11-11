<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ClipboardPaste, Sparkles, Trash2 } from "lucide-vue-next";
import { compactVerify, importJWK, importSPKI, importX509 } from "jose";
import type { JWK } from "jose";
import { Btn, CodeArea, CopyButton, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import JwtSign from "./JwtSign.vue";
import { readClipboard } from "@/composables/useClipboard";

const SAMPLE =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
const SAMPLE_SECRET = "your-256-bit-secret";

const mode = ref<"decode" | "sign">("decode");
const token = ref("");
const secret = ref("");
const publicKey = ref("");
const secretB64 = ref(false);

function b64urlToBytes(s: string): Uint8Array {
    let b = s.replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    return Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
}
const b64urlToText = (s: string) => new TextDecoder().decode(b64urlToBytes(s));

interface Decoded {
    parts: [string, string, string];
    header: Record<string, unknown>;
    payload: unknown;
    payloadIsJson: boolean;
    payloadText: string;
    sigBytes: number;
    alg: string;
}

const decoded = computed<{ ok?: Decoded; error?: string }>(() => {
    const t = token.value.trim().replace(/^bearer\s+/i, "").replace(/\s+/g, "");
    if (!t) return {};
    const segs = t.split(".");
    if (segs.length !== 3) return { error: `A JWT has 3 dot-separated parts; found ${segs.length}. (Encrypted JWE tokens are not supported.)` };
    try {
        const header = JSON.parse(b64urlToText(segs[0]));
        if (typeof header !== "object" || header === null) throw new Error("Header is not a JSON object.");
        const payloadText = b64urlToText(segs[1]);
        let payload: unknown = payloadText, payloadIsJson = false;
        try {
            payload = JSON.parse(payloadText);
            payloadIsJson = true;
        } catch {
            /* not JSON: show raw */
        }
        return {
            ok: {
                parts: [segs[0], segs[1], segs[2]],
                header,
                payload,
                payloadIsJson,
                payloadText,
                sigBytes: segs[2] ? b64urlToBytes(segs[2]).length : 0,
                alg: String(header.alg ?? ""),
            },
        };
    } catch (e) {
        return { error: "Could not decode the token: " + (e instanceof Error ? e.message : "invalid Base64URL or JSON.") };
    }
});

const pretty = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v, null, 2));

// ---------- time claims ----------
const nowTick = ref(Date.now());

function rel(ms: number): string {
    const s = Math.round(Math.abs(ms) / 1000);
    const units: [string, number][] = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]];
    for (const [name, sec] of units) {
        if (s >= sec) {
            const n = Math.floor(s / sec);
            return `${n} ${name}${n === 1 ? "" : "s"}`;
        }
    }
    return "0 seconds";
}

const timeClaims = computed(() => {
    const p = decoded.value.ok?.payload;
    if (!p || typeof p !== "object") return [];
    const o = p as Record<string, unknown>;
    const names: [string, string][] = [["iat", "Issued at"], ["nbf", "Not before"], ["exp", "Expires"]];
    return names.flatMap(([k, label]) => {
        const v = o[k];
        if (typeof v !== "number" || !isFinite(v)) return [];
        const ms = v * 1000;
        const d = new Date(ms);
        if (isNaN(d.getTime())) return [];
        const diff = ms - nowTick.value;
        return [{ k, label, local: d.toLocaleString(), iso: d.toISOString(), relative: diff > 0 ? `in ${rel(diff)}` : `${rel(diff)} ago` }];
    });
});

const status = computed<{ type: "success" | "error" | "warning" | "info"; text: string } | null>(() => {
    const p = decoded.value.ok?.payload;
    if (!p || typeof p !== "object") return null;
    const o = p as Record<string, unknown>;
    const exp = typeof o.exp === "number" ? o.exp * 1000 : null;
    const nbf = typeof o.nbf === "number" ? o.nbf * 1000 : null;
    const now = nowTick.value;
    if (exp !== null && exp <= now) return { type: "error", text: `Expired ${rel(now - exp)} ago` };
    if (nbf !== null && nbf > now) return { type: "warning", text: `Not valid yet: becomes valid in ${rel(nbf - now)}` };
    if (exp !== null) return { type: "success", text: `Valid: expires in ${rel(exp - now)}` };
    return { type: "info", text: "No expiry (exp) claim: the token never expires." };
});

const CLAIMS: Record<string, string> = {
    iss: "Issuer", sub: "Subject", aud: "Audience", exp: "Expiration time", nbf: "Not before", iat: "Issued at", jti: "JWT ID",
    nonce: "Nonce", scope: "Scopes", azp: "Authorized party", email: "Email", name: "Name",
};
const claimRows = computed(() => {
    const p = decoded.value.ok?.payload;
    if (!p || typeof p !== "object" || Array.isArray(p)) return [];
    return Object.entries(p as Record<string, unknown>).map(([k, v]) => ({ k, label: CLAIMS[k] ?? "", v: typeof v === "string" ? v : JSON.stringify(v) }));
});

// ---------- signature verification ----------
type V = { state: "idle" | "pending" | "valid" | "invalid" | "error"; message: string };
const verify = ref<V>({ state: "idle", message: "" });
let reqId = 0;

const isHmac = computed(() => /^HS(256|384|512)$/.test(decoded.value.ok?.alg ?? ""));
const keyInput = computed(() => (isHmac.value ? secret.value : publicKey.value));

async function runVerify() {
    const id = ++reqId;
    const d = decoded.value.ok;
    if (!d) {
        verify.value = { state: "idle", message: "" };
        return;
    }
    const alg = d.alg;
    if (alg.toLowerCase() === "none" || !alg) {
        verify.value = { state: "error", message: 'This token is unsecured (alg "none"). It has no signature to verify and should never be trusted.' };
        return;
    }
    if (!keyInput.value.trim()) {
        verify.value = { state: "idle", message: "" };
        return;
    }
    verify.value = { state: "pending", message: "Verifying…" };
    try {
        let key: CryptoKey | Uint8Array;
        if (isHmac.value) {
            key = secretB64.value ? b64urlToBytes(secret.value.trim()) : new TextEncoder().encode(secret.value);
        } else {
            const k = publicKey.value.trim();
            if (k.startsWith("{")) {
                const jwk = JSON.parse(k) as JWK;
                const res = await importJWK(jwk, alg);
                if (res instanceof Uint8Array) throw new Error("The JWK is a symmetric key; this token uses an asymmetric algorithm.");
                key = res;
            } else if (/BEGIN CERTIFICATE/.test(k)) key = await importX509(k, alg);
            else if (/BEGIN PUBLIC KEY/.test(k)) key = await importSPKI(k, alg);
            else if (/BEGIN RSA PUBLIC KEY/.test(k)) throw new Error("PKCS#1 keys are not supported. Convert to SPKI (BEGIN PUBLIC KEY) or paste a JWK.");
            else throw new Error("Paste a PEM public key (BEGIN PUBLIC KEY), an X.509 certificate or a JWK.");
        }
        await compactVerify(token.value.trim().replace(/^bearer\s+/i, "").replace(/\s+/g, ""), key, { algorithms: [alg] });
        if (id === reqId) verify.value = { state: "valid", message: `Signature verified (${alg}).` };
    } catch (e) {
        if (id !== reqId) return;
        const msg = e instanceof Error ? e.message : String(e);
        const code = (e as { code?: string }).code;
        verify.value =
            code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED"
                ? { state: "invalid", message: "Invalid signature: the key does not match this token or it was tampered with." }
                : { state: "error", message: msg };
    }
}

watch([() => token.value, keyInput, secretB64], runVerify, { immediate: true });

const verifyNoticeType = computed(() => ({ idle: "info", pending: "info", valid: "success", invalid: "error", error: "warning" })[verify.value.state] as "info" | "success" | "error" | "warning");

function loadSample() {
    token.value = SAMPLE;
    secret.value = SAMPLE_SECRET;
    secretB64.value = false;
}
async function paste() {
    token.value = await readClipboard();
}

watch(token, () => {
    nowTick.value = Date.now();
});

function fromSigner(t: string, key: string, hmac: boolean) {
    token.value = t;
    if (hmac) {
        secret.value = key;
        secretB64.value = false;
    } else publicKey.value = key;
    mode.value = "decode";
}
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="mode" :options="[{ value: 'decode', label: 'Decode & verify' }, { value: 'sign', label: 'Sign' }]" />
        </template>

        <JwtSign v-show="mode === 'sign'" @decode="fromSigner" />

        <template v-if="mode === 'decode'">
        <Panel title="Encoded token" flush>
            <template #actions>
                <Btn size="sm" variant="ghost" @click="loadSample"><Sparkles /> Sample</Btn>
                <Btn size="sm" variant="ghost" @click="paste"><ClipboardPaste /> Paste</Btn>
                <Btn size="sm" variant="ghost" :disabled="!token" @click="token = ''"><Trash2 /> Clear</Btn>
            </template>
            <CodeArea v-model="token" height="7rem" :invalid="!!decoded.error" placeholder="Paste a JWT (eyJhbGciOi…)" />
            <div v-if="decoded.ok" class="border-t border-line p-4 font-mono text-[13px] leading-relaxed break-all">
                <span class="text-danger">{{ decoded.ok.parts[0] }}</span><span class="text-muted">.</span><span class="text-accent">{{ decoded.ok.parts[1] }}</span><span class="text-muted">.</span><span class="text-warning">{{ decoded.ok.parts[2] }}</span>
            </div>
        </Panel>

        <Notice v-if="decoded.error" type="error">{{ decoded.error }}</Notice>

        <template v-if="decoded.ok">
            <Notice v-if="status" :type="status.type">{{ status.text }}</Notice>

            <div class="grid gap-4 lg:grid-cols-2">
                <Panel flush>
                    <template #title><span class="text-danger">Header</span></template>
                    <template #actions><CopyButton :text="pretty(decoded.ok.header)" /></template>
                    <CodeArea :model-value="pretty(decoded.ok.header)" readonly :wrap="false" height="10rem" />
                </Panel>
                <Panel flush>
                    <template #title><span class="text-accent">Payload</span></template>
                    <template #actions><CopyButton :text="pretty(decoded.ok.payload)" /></template>
                    <CodeArea :model-value="pretty(decoded.ok.payload)" readonly :wrap="false" height="10rem" />
                </Panel>
            </div>

            <div v-if="timeClaims.length || claimRows.length" class="grid gap-4 lg:grid-cols-2">
                <Panel v-if="timeClaims.length" title="Time claims" flush>
                    <div class="divide-y divide-line text-sm">
                        <div v-for="c in timeClaims" :key="c.k" class="px-4 py-2.5">
                            <div class="flex items-baseline justify-between gap-2">
                                <span class="font-medium">{{ c.label }} <code class="code">{{ c.k }}</code></span>
                                <span class="text-xs text-muted">{{ c.relative }}</span>
                            </div>
                            <div class="text-muted">{{ c.local }}</div>
                            <div class="font-mono text-xs text-muted">{{ c.iso }}</div>
                        </div>
                    </div>
                </Panel>
                <Panel v-if="claimRows.length" title="Claims" flush>
                    <div class="divide-y divide-line text-sm">
                        <div v-for="c in claimRows" :key="c.k" class="flex gap-3 px-4 py-2">
                            <div class="w-28 shrink-0"><code class="code">{{ c.k }}</code><div v-if="c.label" class="text-xs text-muted">{{ c.label }}</div></div>
                            <div class="min-w-0 font-mono text-[13px] break-all">{{ c.v }}</div>
                        </div>
                    </div>
                </Panel>
            </div>

            <Panel flush>
                <template #title><span class="text-warning">Signature</span> <span class="ml-1 text-xs font-normal text-muted">{{ decoded.ok.alg || "no alg" }}</span></template>
                <template #actions><CopyButton :text="decoded.ok.parts[2]" /></template>
                <div class="space-y-3 p-4">
                    <div class="font-mono text-[13px] break-all text-muted">{{ decoded.ok.parts[2] || "(empty)" }} <span v-if="decoded.ok.sigBytes">· {{ decoded.ok.sigBytes }} bytes</span></div>

                    <template v-if="decoded.ok.alg && decoded.ok.alg.toLowerCase() !== 'none'">
                        <template v-if="isHmac">
                            <Field label="Secret" hint="Used locally in your browser to check the HMAC. Nothing is sent anywhere.">
                                <input v-model="secret" class="input font-mono" spellcheck="false" autocomplete="off" placeholder="your-256-bit-secret" />
                            </Field>
                            <label class="flex items-center gap-2 text-sm"><input v-model="secretB64" type="checkbox" class="checkbox" /> Secret is Base64URL encoded</label>
                        </template>
                        <Field v-else label="Public key (PEM, X.509 certificate or JWK)" hint="RS*, PS*, ES* and EdDSA tokens are verified with the issuer's public key.">
                            <textarea v-model="publicKey" class="input min-h-32 py-2 font-mono text-[13px]" spellcheck="false" placeholder="-----BEGIN PUBLIC KEY-----&#10;…&#10;-----END PUBLIC KEY-----&#10;or {&quot;kty&quot;:&quot;RSA&quot;,&quot;n&quot;:&quot;…&quot;,&quot;e&quot;:&quot;AQAB&quot;}" />
                        </Field>
                    </template>

                    <Notice v-if="verify.state !== 'idle'" :type="verifyNoticeType">{{ verify.message }}</Notice>
                    <p v-else-if="decoded.ok.alg.toLowerCase() !== 'none'" class="text-xs text-muted">Enter a {{ isHmac ? "secret" : "public key" }} to verify the signature.</p>
                </div>
            </Panel>
        </template>
        </template>
    </ToolPage>
</template>
