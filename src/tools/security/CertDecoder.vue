<script setup lang="ts">
import { ref, watch } from "vue";
import { ClipboardPaste, Sparkles, Trash2, Upload } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Notice, Panel, ToolPage } from "@/components/ui";
import { readClipboard } from "@/composables/useClipboard";

// A throwaway self-signed certificate for example.com (its private key was discarded), used only as sample input.
const SAMPLE = `-----BEGIN CERTIFICATE-----
MIIBtjCCAVygAwIBAgIJALZnrv7F3jzbMAoGCCqGSM49BAMCMDkxCzAJBgNVBAYT
AlVTMRQwEgYDVQQKDAtFeGFtcGxlIEluYzEUMBIGA1UEAwwLZXhhbXBsZS5jb20w
HhcNMjYxMTExMTgzNTE4WhcNMzYxMTA4MTgzNTE4WjA5MQswCQYDVQQGEwJVUzEU
MBIGA1UECgwLRXhhbXBsZSBJbmMxFDASBgNVBAMMC2V4YW1wbGUuY29tMFkwEwYH
KoZIzj0CAQYIKoZIzj0DAQcDQgAEkNP9XbzYsqqvxh+a8CrOqKxIG8c76bKKDLLO
eqiAfkMSzi9jL047zhr4ZDzPym5ngplREXwlFKEzRhpSsTMQnaNNMEswJwYDVR0R
BCAwHoILZXhhbXBsZS5jb22CD3d3dy5leGFtcGxlLmNvbTALBgNVHQ8EBAMCB4Aw
EwYDVR0lBAwwCgYIKwYBBQUHAwEwCgYIKoZIzj0EAwIDSAAwRQIhANX4DojtBCkv
itR4+IsWcekhUYsQ4O3jHet4yySZlbOeAiBE5y//oO66s8A50V9U6cWbsvTPLGjT
m2FKVCF4PK0clw==
-----END CERTIFICATE-----`;

const input = ref("");
interface Row { k: string; v: string; mono?: boolean }
interface Item { kind: "Certificate" | "Certificate request"; title: string; status?: { type: "success" | "error" | "warning" | "info"; text: string }; sections: { title: string; rows: Row[] }[] }
const items = ref<Item[]>([]);
const error = ref("");
const busy = ref(false);

const EKU: Record<string, string> = {
    "1.3.6.1.5.5.7.3.1": "TLS server authentication", "1.3.6.1.5.5.7.3.2": "TLS client authentication", "1.3.6.1.5.5.7.3.3": "Code signing",
    "1.3.6.1.5.5.7.3.4": "Email protection", "1.3.6.1.5.5.7.3.8": "Time stamping", "1.3.6.1.5.5.7.3.9": "OCSP signing",
};
const EXT: Record<string, string> = {
    "2.5.29.14": "Subject Key Identifier", "2.5.29.15": "Key Usage", "2.5.29.17": "Subject Alternative Name", "2.5.29.19": "Basic Constraints",
    "2.5.29.31": "CRL Distribution Points", "2.5.29.32": "Certificate Policies", "2.5.29.35": "Authority Key Identifier", "2.5.29.37": "Extended Key Usage",
    "1.3.6.1.5.5.7.1.1": "Authority Information Access", "1.3.6.1.4.1.11129.2.4.2": "Certificate Transparency SCTs",
};
const hex = (b: ArrayBuffer, sep = ":") => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join(sep).toUpperCase();

function keyInfo(alg: Algorithm): string {
    const a = alg as Algorithm & { modulusLength?: number; namedCurve?: string };
    if (a.modulusLength) return `RSA ${a.modulusLength} bits`;
    if (a.namedCurve) return `${a.name} ${a.namedCurve}`;
    // The library leaves the raw OID when it cannot map the key parameters (for example explicit EC curve parameters).
    const OIDS: Record<string, string> = { "1.2.840.10045.2.1": "Elliptic curve (custom or explicit parameters)", "1.2.840.113549.1.1.1": "RSA", "1.3.101.112": "Ed25519", "1.3.101.113": "Ed448" };
    return OIDS[a.name] ?? a.name;
}
function sigInfo(alg: Algorithm): string {
    const a = alg as Algorithm & { hash?: { name: string } };
    return a.hash?.name ? `${a.name} with ${a.hash.name}` : a.name;
}
function rel(ms: number) {
    const d = Math.round(Math.abs(ms) / 86400000);
    return d > 730 ? `${Math.round(d / 365)} years` : d > 60 ? `${Math.round(d / 30)} months` : `${d} day${d === 1 ? "" : "s"}`;
}

let run = 0;
async function parse() {
    const id = ++run;
    const text = input.value.trim();
    error.value = "";
    if (!text) {
        items.value = [];
        return;
    }
    busy.value = true;
    try {
        await import("@abraham/reflection"); // Reflect metadata polyfill required by the x509 library
        const x509 = await import("@peculiar/x509");
        const blocks = text.match(/-----BEGIN [A-Z0-9 ]+-----[\s\S]*?-----END [A-Z0-9 ]+-----/g) ?? [text];
        const out: Item[] = [];
        for (const block of blocks) {
            const label = /-----BEGIN ([A-Z0-9 ]+)-----/.exec(block)?.[1] ?? "";
            if (/PRIVATE KEY/.test(label)) throw new Error("That is a private key, not a certificate. Never paste private keys into web pages you do not trust.");
            const names = (san: InstanceType<typeof x509.SubjectAlternativeNameExtension> | null) => san?.names.items.map((n) => `${n.type}: ${n.value}`).join("\n") ?? "";
            const usages = (ku: InstanceType<typeof x509.KeyUsagesExtension> | null) =>
                ku ? Object.entries(x509.KeyUsageFlags).filter(([, v]) => typeof v === "number" && (ku.usages & (v as number)) !== 0).map(([k]) => k).join(", ") : "";

            if (/REQUEST/.test(label)) {
                const csr = new x509.Pkcs10CertificateRequest(block);
                const ok = await csr.verify().catch(() => false);
                const san = csr.extensions.find((e): e is InstanceType<typeof x509.SubjectAlternativeNameExtension> => e instanceof x509.SubjectAlternativeNameExtension) ?? null;
                const ku = csr.extensions.find((e): e is InstanceType<typeof x509.KeyUsagesExtension> => e instanceof x509.KeyUsagesExtension) ?? null;
                out.push({
                    kind: "Certificate request",
                    title: csr.subject || "(empty subject)",
                    status: ok ? { type: "success", text: "The request's self-signature is valid." } : { type: "error", text: "The request's signature could not be verified." },
                    sections: [{
                        title: "Request",
                        rows: [
                            { k: "Subject", v: csr.subject },
                            { k: "Public key", v: keyInfo(csr.publicKey.algorithm) },
                            { k: "Signature algorithm", v: sigInfo(csr.signatureAlgorithm) },
                            { k: "Subject alternative names", v: names(san) },
                            { k: "Key usage", v: usages(ku) },
                        ].filter((r) => r.v),
                    }],
                });
                continue;
            }

            const cert = new x509.X509Certificate(block);
            const now = Date.now();
            const [sha256, sha1, selfSigned, keyId] = await Promise.all([
                cert.getThumbprint("SHA-256"), cert.getThumbprint("SHA-1"), cert.isSelfSigned().catch(() => false), cert.publicKey.getThumbprint("SHA-256"),
            ]);
            const bc = cert.getExtension(x509.BasicConstraintsExtension);
            const eku = cert.getExtension(x509.ExtendedKeyUsageExtension);
            const left = cert.notAfter.getTime() - now;
            const status: Item["status"] =
                left < 0 ? { type: "error", text: `Expired ${rel(left)} ago.` }
                : cert.notBefore.getTime() > now ? { type: "warning", text: `Not valid yet: starts in ${rel(cert.notBefore.getTime() - now)}.` }
                : left < 30 * 86400000 ? { type: "warning", text: `Expires soon: ${rel(left)} left.` }
                : { type: "success", text: `Valid for another ${rel(left)}.` };
            out.push({
                kind: "Certificate",
                title: /CN=([^,]+)/.exec(cert.subject)?.[1] ?? cert.subject,
                status,
                sections: [
                    {
                        title: "Identity",
                        rows: [
                            { k: "Subject", v: cert.subject },
                            { k: "Issuer", v: cert.issuer + (selfSigned ? "  (self-signed)" : "") },
                            { k: "Subject alternative names", v: names(cert.getExtension(x509.SubjectAlternativeNameExtension)) },
                            { k: "Serial number", v: cert.serialNumber.toUpperCase().match(/.{1,2}/g)?.join(":") ?? "", mono: true },
                        ].filter((r) => r.v),
                    },
                    {
                        title: "Validity",
                        rows: [
                            { k: "Not before", v: `${cert.notBefore.toISOString()}  (${cert.notBefore.toLocaleString()})` },
                            { k: "Not after", v: `${cert.notAfter.toISOString()}  (${cert.notAfter.toLocaleString()})` },
                            { k: "Lifetime", v: rel(cert.notAfter.getTime() - cert.notBefore.getTime()) },
                        ],
                    },
                    {
                        title: "Key and usage",
                        rows: [
                            { k: "Public key", v: keyInfo(cert.publicKey.algorithm) },
                            { k: "Signature algorithm", v: sigInfo(cert.signatureAlgorithm) },
                            { k: "Certificate authority", v: bc ? (bc.ca ? `Yes${bc.pathLength !== undefined ? ` (path length ${bc.pathLength})` : ""}` : "No") : "" },
                            { k: "Key usage", v: usages(cert.getExtension(x509.KeyUsagesExtension)) },
                            { k: "Extended key usage", v: eku ? eku.usages.map((u) => EKU[String(u)] ?? String(u)).join(", ") : "" },
                        ].filter((r) => r.v),
                    },
                    {
                        title: "Fingerprints",
                        rows: [
                            { k: "SHA-256", v: hex(sha256), mono: true },
                            { k: "SHA-1", v: hex(sha1), mono: true },
                            { k: "Public key SHA-256", v: hex(keyId), mono: true },
                        ],
                    },
                    {
                        title: "Extensions",
                        rows: cert.extensions.map((e) => ({ k: EXT[e.type] ?? e.type, v: `${e.type}${e.critical ? "  · critical" : ""}`, mono: true })),
                    },
                ].filter((s) => s.rows.length),
            });
        }
        if (id === run) items.value = out;
    } catch (e) {
        if (id !== run) return;
        items.value = [];
        const msg = (e as Error).message;
        error.value = /private key/i.test(msg) ? msg : `Could not read a certificate or CSR: ${msg}`;
    } finally {
        if (id === run) busy.value = false;
    }
}
watch(input, parse);

async function paste() {
    input.value = await readClipboard();
}
async function onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = "";
    if (!f) return;
    const buf = new Uint8Array(await f.arrayBuffer());
    // PEM files are text; DER files are binary and start with an ASN.1 SEQUENCE (0x30).
    if (buf[0] === 0x30) {
        let s = "";
        for (const b of buf) s += String.fromCharCode(b);
        input.value = `-----BEGIN CERTIFICATE-----\n${btoa(s).match(/.{1,64}/g)!.join("\n")}\n-----END CERTIFICATE-----`;
    } else input.value = new TextDecoder().decode(buf);
}
const rowsText = (it: Item) => it.sections.flatMap((s) => [`# ${s.title}`, ...s.rows.map((r) => `${r.k}: ${r.v.replace(/\n/g, ", ")}`), ""]).join("\n");
</script>

<template>
    <ToolPage>
        <Panel title="PEM certificate or CSR" flush>
            <template #actions>
                <label class="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted hover:bg-subtle hover:text-fg">
                    <Upload class="size-3.5" /> Open<input type="file" class="hidden" accept=".pem,.crt,.cer,.der,.csr,.txt" @change="onFile" />
                </label>
                <Btn size="sm" variant="ghost" @click="input = SAMPLE"><Sparkles /> Sample</Btn>
                <Btn size="sm" variant="ghost" @click="paste"><ClipboardPaste /> Paste</Btn>
                <Btn size="sm" variant="ghost" :disabled="!input" @click="input = ''"><Trash2 /> Clear</Btn>
            </template>
            <CodeArea v-model="input" :wrap="false" height="11rem" :invalid="!!error" placeholder="-----BEGIN CERTIFICATE-----&#10;…&#10;-----END CERTIFICATE-----&#10;&#10;A chain of several certificates, or a CERTIFICATE REQUEST, also works." />
        </Panel>

        <Notice v-if="error" type="error">{{ error }}</Notice>
        <p v-else-if="busy && !items.length" class="text-sm text-muted">Decoding…</p>

        <template v-for="(it, i) in items" :key="i">
            <Panel flush>
                <template #title>{{ it.kind }}<template v-if="items.length > 1"> {{ i + 1 }} of {{ items.length }}</template>: <span class="font-normal">{{ it.title }}</span></template>
                <template #actions><CopyButton :text="rowsText(it)" /></template>
                <div v-if="it.status" class="border-b border-line p-4"><Notice :type="it.status.type">{{ it.status.text }}</Notice></div>
                <div v-for="s in it.sections" :key="s.title" class="border-b border-line last:border-0">
                    <div class="bg-subtle px-4 py-1.5 text-xs font-medium text-muted uppercase">{{ s.title }}</div>
                    <dl class="divide-y divide-line text-sm">
                        <div v-for="r in s.rows" :key="r.k" class="flex flex-col gap-0.5 px-4 py-2 sm:flex-row sm:gap-3">
                            <dt class="w-52 shrink-0 text-muted">{{ r.k }}</dt>
                            <dd class="min-w-0 break-all whitespace-pre-wrap" :class="r.mono ? 'font-mono text-xs leading-5' : ''">{{ r.v }}</dd>
                        </div>
                    </dl>
                </div>
            </Panel>
        </template>
        <p class="text-xs text-muted">Decoding happens in your browser. This shows what the certificate says; it does not check the chain against trusted roots or revocation lists.</p>
    </ToolPage>
</template>
