<script setup lang="ts">
import { ref } from "vue";
import { Download, KeyRound } from "lucide-vue-next";
import { Btn, CopyButton, Field, Notice, Panel, ToolPage } from "@/components/ui";
import { downloadBlob } from "@/composables/useClipboard";

type Kind = "ed25519" | "rsa-2048" | "rsa-3072" | "rsa-4096" | "ecdsa-256" | "ecdsa-384";
const kinds: { value: Kind; label: string }[] = [
    { value: "ed25519", label: "Ed25519 (recommended for SSH)" },
    { value: "rsa-2048", label: "RSA 2048" },
    { value: "rsa-3072", label: "RSA 3072" },
    { value: "rsa-4096", label: "RSA 4096" },
    { value: "ecdsa-256", label: "ECDSA P-256" },
    { value: "ecdsa-384", label: "ECDSA P-384" },
];
const kind = ref<Kind>("ed25519");
const comment = ref("user@host");
const busy = ref(false);
const error = ref("");

interface Result { kind: Kind; privatePem: string; publicPem: string; ssh: string; sshPrivate: string; fingerprint: string; jwk: string; file: string }
const result = ref<Result | null>(null);

const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const pem = (label: string, der: Uint8Array) => `-----BEGIN ${label}-----\n${b64(der).match(/.{1,64}/g)!.join("\n")}\n-----END ${label}-----\n`;

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) {
        out.set(p, o);
        o += p.length;
    }
    return out;
}
const u32 = (n: number) => new Uint8Array([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
// SSH wire types (RFC 4251): length-prefixed string and big-endian mpint.
const str = (v: Uint8Array | string) => {
    const b = typeof v === "string" ? enc.encode(v) : v;
    return concat(u32(b.length), b);
};
const mpint = (v: Uint8Array) => {
    let i = 0;
    while (i < v.length - 1 && v[i] === 0) i++;
    const t = v.subarray(i);
    return str(t[0] & 0x80 ? concat(new Uint8Array([0]), t) : t);
};

function sshBlob(jwk: JsonWebKey): { type: string; blob: Uint8Array<ArrayBuffer> } {
    if (jwk.kty === "RSA") return { type: "ssh-rsa", blob: concat(str("ssh-rsa"), mpint(fromB64url(jwk.e!)), mpint(fromB64url(jwk.n!))) };
    if (jwk.kty === "OKP") return { type: "ssh-ed25519", blob: concat(str("ssh-ed25519"), str(fromB64url(jwk.x!))) };
    const curve = jwk.crv === "P-384" ? "nistp384" : "nistp256";
    const type = `ecdsa-sha2-${curve}`;
    return { type, blob: concat(str(type), str(curve), str(concat(new Uint8Array([4]), fromB64url(jwk.x!), fromB64url(jwk.y!)))) };
}

// Unencrypted "openssh-key-v1" private key container for Ed25519.
function opensshEd25519(pub: Uint8Array, seed: Uint8Array, blob: Uint8Array, cmt: string): string {
    const check = crypto.getRandomValues(new Uint8Array(4));
    let priv = concat(check, check, str("ssh-ed25519"), str(pub), str(concat(seed, pub)), str(cmt));
    const pad = (8 - (priv.length % 8)) % 8;
    priv = concat(priv, Uint8Array.from({ length: pad }, (_, i) => i + 1));
    const body = concat(enc.encode("openssh-key-v1\0"), str("none"), str("none"), str(""), u32(1), str(blob), str(priv));
    return `-----BEGIN OPENSSH PRIVATE KEY-----\n${b64(body).match(/.{1,70}/g)!.join("\n")}\n-----END OPENSSH PRIVATE KEY-----\n`;
}

async function generate() {
    busy.value = true;
    error.value = "";
    try {
        const k = kind.value;
        const alg: RsaHashedKeyGenParams | EcKeyGenParams | { name: string } =
            k === "ed25519" ? { name: "Ed25519" }
            : k.startsWith("rsa") ? { name: "RSASSA-PKCS1-v1_5", modulusLength: Number(k.slice(4)), publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }
            : { name: "ECDSA", namedCurve: k === "ecdsa-384" ? "P-384" : "P-256" };
        const pair = (await crypto.subtle.generateKey(alg, true, ["sign", "verify"])) as CryptoKeyPair;
        const [pkcs8, spki, pubJwk, privJwk] = await Promise.all([
            crypto.subtle.exportKey("pkcs8", pair.privateKey),
            crypto.subtle.exportKey("spki", pair.publicKey),
            crypto.subtle.exportKey("jwk", pair.publicKey),
            crypto.subtle.exportKey("jwk", pair.privateKey),
        ]);
        const { type, blob } = sshBlob(pubJwk);
        const c = comment.value.trim();
        const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", blob));
        const { kty, crv, n, e, x, y } = pubJwk;
        result.value = {
            kind: k,
            privatePem: pem("PRIVATE KEY", new Uint8Array(pkcs8)),
            publicPem: pem("PUBLIC KEY", new Uint8Array(spki)),
            ssh: `${type} ${b64(blob)}${c ? " " + c : ""}`,
            sshPrivate: k === "ed25519" ? opensshEd25519(fromB64url(pubJwk.x!), fromB64url(privJwk.d!), blob, c) : "",
            fingerprint: "SHA256:" + b64(digest).replace(/=+$/, ""),
            jwk: JSON.stringify(Object.fromEntries(Object.entries({ kty, crv, n, e, x, y }).filter(([, v]) => v !== undefined)), null, 2),
            file: k === "ed25519" ? "id_ed25519" : k.startsWith("rsa") ? "id_rsa" : "id_ecdsa",
        };
    } catch (e) {
        result.value = null;
        const msg = (e as Error).message;
        error.value = kind.value === "ed25519" && /algorithm|not supported|unrecognized/i.test(msg) ? "This browser cannot generate Ed25519 keys yet. Update it, or choose RSA or ECDSA." : msg;
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <ToolPage>
        <Panel>
            <div class="flex flex-wrap items-end gap-3">
                <Field label="Key type" class="min-w-64"><select v-model="kind" class="select"><option v-for="k in kinds" :key="k.value" :value="k.value">{{ k.label }}</option></select></Field>
                <Field label="Comment" class="min-w-48"><input v-model="comment" class="input" spellcheck="false" placeholder="user@host" /></Field>
                <Btn variant="primary" :disabled="busy" @click="generate"><KeyRound /> {{ busy ? "Generating…" : "Generate key pair" }}</Btn>
            </div>
        </Panel>

        <Notice v-if="error" type="error">{{ error }}</Notice>
        <Notice v-else-if="!result" type="info">Keys are generated by your browser's Web Crypto API and never leave this page. They are not stored: copy or download them before you leave.</Notice>

        <template v-if="result">
            <Panel title="SSH public key">
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="downloadBlob(result.ssh + '\n', result.file + '.pub')"><Download /> {{ result.file }}.pub</Btn>
                    <CopyButton :text="result.ssh" />
                </template>
                <p class="rounded-lg bg-subtle p-3 font-mono text-xs break-all">{{ result.ssh }}</p>
                <p class="mt-2 text-xs text-muted">Fingerprint <span class="font-mono text-fg">{{ result.fingerprint }}</span> · add the line above to <code class="code">~/.ssh/authorized_keys</code> or your Git host.</p>
            </Panel>

            <div class="grid gap-4 lg:grid-cols-2">
                <Panel v-if="result.sshPrivate" title="Private key (OpenSSH)" flush>
                    <template #actions>
                        <Btn size="sm" variant="ghost" @click="downloadBlob(result.sshPrivate, result.file)"><Download /> {{ result.file }}</Btn>
                        <CopyButton :text="result.sshPrivate" />
                    </template>
                    <pre class="max-h-64 overflow-auto p-4 font-mono text-xs">{{ result.sshPrivate }}</pre>
                </Panel>
                <Panel title="Private key (PKCS#8 PEM)" flush>
                    <template #actions>
                        <Btn size="sm" variant="ghost" @click="downloadBlob(result.privatePem, result.sshPrivate ? 'private.pem' : result.file)"><Download /> {{ result.sshPrivate ? "private.pem" : result.file }}</Btn>
                        <CopyButton :text="result.privatePem" />
                    </template>
                    <pre class="max-h-64 overflow-auto p-4 font-mono text-xs">{{ result.privatePem }}</pre>
                </Panel>
                <Panel title="Public key (SPKI PEM)" flush>
                    <template #actions>
                        <Btn size="sm" variant="ghost" @click="downloadBlob(result.publicPem, 'public.pem')"><Download /> public.pem</Btn>
                        <CopyButton :text="result.publicPem" />
                    </template>
                    <pre class="max-h-64 overflow-auto p-4 font-mono text-xs">{{ result.publicPem }}</pre>
                </Panel>
                <Panel title="Public key (JWK)" flush>
                    <template #actions><CopyButton :text="result.jwk" /></template>
                    <pre class="max-h-64 overflow-auto p-4 font-mono text-xs break-all whitespace-pre-wrap">{{ result.jwk }}</pre>
                </Panel>
            </div>

            <Notice type="warning">
                The private key is not protected by a passphrase. After saving it, run <code class="code">chmod 600 {{ result.file }}</code> and add a passphrase with <code class="code">ssh-keygen -p -f {{ result.file }}</code>.
                <template v-if="!result.sshPrivate"> OpenSSH reads the PKCS#8 PEM file directly for RSA and ECDSA keys.</template>
            </Notice>
        </template>
    </ToolPage>
</template>
