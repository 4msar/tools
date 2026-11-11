<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RefreshCw } from "lucide-vue-next";
import QRCode from "qrcode";
import { Btn, CopyButton, Field, Notice, Panel, ToolPage } from "@/components/ui";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function b32decode(s: string): Uint8Array<ArrayBuffer> {
    const clean = s.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
    if (!clean) throw new Error("Enter a Base32 secret.");
    let bits = 0;
    let val = 0;
    const out: number[] = [];
    for (const c of clean) {
        const i = B32.indexOf(c);
        if (i < 0) throw new Error(`"${c}" is not a Base32 character (A-Z and 2-7 only).`);
        val = (val << 5) | i;
        bits += 5;
        if (bits >= 8) {
            bits -= 8;
            out.push((val >> bits) & 0xff);
        }
    }
    if (!out.length) throw new Error("The secret is too short.");
    return new Uint8Array(out);
}
function b32encode(bytes: Uint8Array): string {
    let bits = 0;
    let val = 0;
    let out = "";
    for (const b of bytes) {
        val = (val << 8) | b;
        bits += 8;
        while (bits >= 5) {
            bits -= 5;
            out += B32[(val >> bits) & 31];
        }
    }
    if (bits) out += B32[(val << (5 - bits)) & 31];
    return out;
}

const secret = ref("");
const algorithm = ref<"SHA-1" | "SHA-256" | "SHA-512">("SHA-1");
const digits = ref(6);
const period = ref(30);
const issuer = ref("Example");
const account = ref("user@example.com");

function randomSecret() {
    secret.value = b32encode(crypto.getRandomValues(new Uint8Array(20))).replace(/(.{4})/g, "$1 ").trim();
}

// RFC 6238 (TOTP) on top of RFC 4226 (HOTP).
async function hotp(key: Uint8Array<ArrayBuffer>, counter: number): Promise<string> {
    const msg = new DataView(new ArrayBuffer(8));
    msg.setUint32(0, Math.floor(counter / 2 ** 32));
    msg.setUint32(4, counter >>> 0);
    const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: algorithm.value }, false, ["sign"]);
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, msg));
    const o = mac[mac.length - 1] & 15;
    const bin = ((mac[o] & 0x7f) << 24) | (mac[o + 1] << 16) | (mac[o + 2] << 8) | mac[o + 3];
    return (bin % 10 ** digits.value).toString().padStart(digits.value, "0");
}

const now = ref(Date.now());
const code = ref("");
const nextCode = ref("");
const prevCode = ref("");
const error = ref("");
const step = computed(() => Math.max(1, Number(period.value) || 30));
const counter = computed(() => Math.floor(now.value / 1000 / step.value));
const remaining = computed(() => step.value - (Math.floor(now.value / 1000) % step.value));

let run = 0;
async function update() {
    const id = ++run;
    if (!secret.value.trim()) {
        code.value = nextCode.value = prevCode.value = error.value = "";
        return;
    }
    try {
        const key = b32decode(secret.value);
        const [p, c, n] = await Promise.all([hotp(key, counter.value - 1), hotp(key, counter.value), hotp(key, counter.value + 1)]);
        if (id !== run) return;
        [prevCode.value, code.value, nextCode.value] = [p, c, n];
        error.value = "";
    } catch (e) {
        if (id !== run) return;
        code.value = nextCode.value = prevCode.value = "";
        error.value = (e as Error).message;
    }
}
watch([secret, algorithm, digits, counter], update, { immediate: true });

let timer = 0;
onMounted(() => {
    timer = window.setInterval(() => (now.value = Date.now()), 500);
});
onBeforeUnmount(() => clearInterval(timer));

const uri = computed(() => {
    const s = secret.value.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
    if (!s || error.value) return "";
    const label = encodeURIComponent(issuer.value ? `${issuer.value}:${account.value}` : account.value);
    const q = new URLSearchParams({ secret: s });
    if (issuer.value) q.set("issuer", issuer.value);
    if (algorithm.value !== "SHA-1") q.set("algorithm", algorithm.value.replace("-", ""));
    if (digits.value !== 6) q.set("digits", String(digits.value));
    if (step.value !== 30) q.set("period", String(step.value));
    return `otpauth://totp/${label}?${q}`;
});

const qr = ref("");
watch(
    uri,
    async (u) => {
        qr.value = u ? await QRCode.toDataURL(u, { margin: 2, width: 220, errorCorrectionLevel: "M" }).catch(() => "") : "";
    },
    { immediate: true },
);

const pretty = (c: string) => (c.length === 6 ? `${c.slice(0, 3)} ${c.slice(3)}` : c.length === 8 ? `${c.slice(0, 4)} ${c.slice(4)}` : c);

function importUri(text: string) {
    try {
        const u = new URL(text.trim());
        if (u.protocol !== "otpauth:") return false;
        const label = decodeURIComponent(u.pathname.replace(/^\/+(totp\/)?/, ""));
        secret.value = u.searchParams.get("secret") ?? "";
        issuer.value = u.searchParams.get("issuer") ?? (label.includes(":") ? label.split(":")[0] : "");
        account.value = label.includes(":") ? label.split(":").slice(1).join(":").trim() : label;
        const a = (u.searchParams.get("algorithm") ?? "SHA1").toUpperCase().replace(/^SHA-?/, "SHA-");
        algorithm.value = a === "SHA-256" || a === "SHA-512" ? a : "SHA-1";
        digits.value = Number(u.searchParams.get("digits")) || 6;
        period.value = Number(u.searchParams.get("period")) || 30;
        return true;
    } catch {
        return false;
    }
}
function onSecretInput() {
    if (secret.value.trim().startsWith("otpauth://")) importUri(secret.value);
}
</script>

<template>
    <ToolPage>
        <div class="grid gap-4 lg:grid-cols-2">
            <div class="flex min-w-0 flex-col gap-4">
                <Panel title="Secret">
                    <template #actions><Btn size="sm" variant="ghost" @click="randomSecret"><RefreshCw /> Generate</Btn></template>
                    <div class="flex flex-col gap-3">
                        <Field label="Base32 secret" hint="Or paste an otpauth:// link to import all settings.">
                            <input v-model="secret" class="input font-mono" spellcheck="false" autocomplete="off" placeholder="JBSW Y3DP EHPK 3PXP" @input="onSecretInput" />
                        </Field>
                        <div class="grid grid-cols-3 gap-3">
                            <Field label="Algorithm">
                                <select v-model="algorithm" class="select"><option>SHA-1</option><option>SHA-256</option><option>SHA-512</option></select>
                            </Field>
                            <Field label="Digits">
                                <select v-model.number="digits" class="select"><option :value="6">6</option><option :value="7">7</option><option :value="8">8</option></select>
                            </Field>
                            <Field label="Period (s)"><input v-model.number="period" type="number" min="1" class="input" /></Field>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <Field label="Issuer"><input v-model="issuer" class="input" placeholder="Example" /></Field>
                            <Field label="Account"><input v-model="account" class="input" placeholder="user@example.com" /></Field>
                        </div>
                    </div>
                </Panel>
                <Notice type="warning">Use this for testing and development. A secret for a real account belongs in an authenticator app, not a web page.</Notice>
            </div>

            <div class="flex min-w-0 flex-col gap-4">
                <Panel title="Current code">
                    <Notice v-if="error" type="error">{{ error }}</Notice>
                    <p v-else-if="!code" class="text-sm text-muted">Enter or generate a secret to see codes.</p>
                    <template v-else>
                        <div class="flex items-center justify-between gap-3">
                            <div class="font-mono text-5xl font-semibold tracking-wider tabular-nums">{{ pretty(code) }}</div>
                            <CopyButton :text="code" size="md" variant="secondary" />
                        </div>
                        <div class="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-subtle">
                            <div class="h-full rounded-full transition-all duration-500 ease-linear" :class="remaining <= 5 ? 'bg-danger' : 'bg-accent'" :style="{ width: (remaining / step) * 100 + '%' }" />
                        </div>
                        <div class="mt-2 flex justify-between text-xs text-muted">
                            <span>Changes in {{ remaining }}s</span>
                            <span>Previous <span class="font-mono">{{ pretty(prevCode) }}</span> · Next <span class="font-mono">{{ pretty(nextCode) }}</span></span>
                        </div>
                    </template>
                </Panel>

                <Panel title="Authenticator setup">
                    <p v-if="!uri" class="text-sm text-muted">The QR code appears once the secret is valid.</p>
                    <div v-else class="flex flex-col gap-4 sm:flex-row">
                        <img v-if="qr" :src="qr" alt="otpauth QR code" width="160" height="160" class="size-40 shrink-0 rounded-lg border border-line bg-white" />
                        <div class="min-w-0 flex-1">
                            <div class="mb-1 flex items-center justify-between"><span class="label !mb-0">otpauth URI</span><CopyButton :text="uri" icon-only /></div>
                            <p class="rounded-lg bg-subtle p-3 font-mono text-xs break-all">{{ uri }}</p>
                            <p class="mt-2 text-xs text-muted">Scan with Google Authenticator, 1Password, Authy or any TOTP app. Many apps only support SHA-1, 6 digits and 30 seconds.</p>
                        </div>
                    </div>
                </Panel>
            </div>
        </div>
    </ToolPage>
</template>
