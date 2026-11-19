<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useStorage } from "@vueuse/core";
import { Search } from "lucide-vue-next";
import { Btn, CopyButton, Field, Notice, Panel, ToolPage } from "@/components/ui";

const TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "CAA", "SRV", "PTR"] as const;
const COMMON = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "CAA"];
const TYPE_NAMES: Record<number, string> = { 1: "A", 2: "NS", 5: "CNAME", 6: "SOA", 12: "PTR", 15: "MX", 16: "TXT", 28: "AAAA", 33: "SRV", 257: "CAA", 43: "DS", 46: "RRSIG", 48: "DNSKEY" };
const RCODES: Record<number, string> = { 0: "NOERROR", 1: "FORMERR", 2: "SERVFAIL", 3: "NXDOMAIN", 4: "NOTIMP", 5: "REFUSED" };

interface DohAnswer { name: string; type: number; TTL: number; data: string }
interface DohResponse { Status: number; AD?: boolean; Answer?: DohAnswer[]; Authority?: DohAnswer[] }
interface Row { name: string; ttl: number; type: string; data: string }
interface TypeResult { type: string; status: number; ad: boolean; rows: Row[]; error: string }

const domain = useStorage("tools:dns:domain", "example.com");
const resolver = useStorage<"cloudflare" | "google">("tools:dns:resolver", "cloudflare");
const selected = useStorage<string[]>("tools:dns:types", ["A", "AAAA", "MX", "TXT", "NS"]);
const emailCheck = useStorage("tools:dns:email", true);

const loading = ref(false);
const error = ref("");
const results = ref<TypeResult[]>([]);
const queriedName = ref("");
const reverse = ref(false);
const spfRecords = ref<string[] | null>(null);
const dmarcRecords = ref<string[] | null>(null);
const emailError = ref("");
let ctrl: AbortController | null = null;

function toggle(t: string) {
    selected.value = selected.value.includes(t) ? selected.value.filter((x) => x !== t) : [...selected.value, t];
}

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
function expandV6(ip: string): string[] | null {
    let s = ip.toLowerCase();
    if (!/^[0-9a-f:]+$/.test(s) || s.split("::").length > 2) return null;
    let groups: string[];
    if (s.includes("::")) {
        const [h = "", t = ""] = s.split("::");
        const head = h ? h.split(":") : [];
        const tail = t ? t.split(":") : [];
        const fill = 8 - head.length - tail.length;
        if (fill < 1) return null;
        groups = [...head, ...Array<string>(fill).fill("0"), ...tail];
    } else groups = s.split(":");
    if (groups.length !== 8 || groups.some((g) => g.length < 1 || g.length > 4)) return null;
    s = groups.map((g) => g.padStart(4, "0")).join("");
    return s.split("");
}

function normalize(raw: string): { name: string; reverse: boolean } | null {
    let v = raw.trim();
    if (!v) return null;
    v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/^[^@/]*@/, "");
    if (v.startsWith("[")) {
        const end = v.indexOf("]");
        if (end > 0) v = v.slice(1, end);
    }
    const v6 = expandV6(v.split(/[/?#%]/)[0] ?? "");
    if (v6) return { name: [...v6].reverse().join(".") + ".ip6.arpa", reverse: true };
    v = (v.split(/[/?#]/)[0] ?? "").replace(/:\d+$/, "").replace(/\.$/, "").toLowerCase();
    const m = IPV4.exec(v);
    if (m) {
        const parts = m.slice(1, 5).map(Number);
        if (parts.every((p) => p <= 255)) return { name: [...parts].reverse().join(".") + ".in-addr.arpa", reverse: true };
        return null;
    }
    return v ? { name: v, reverse: false } : null;
}

async function doh(name: string, type: string, signal: AbortSignal): Promise<DohResponse> {
    const n = encodeURIComponent(name);
    const url = resolver.value === "google" ? `https://dns.google/resolve?name=${n}&type=${type}` : `https://cloudflare-dns.com/dns-query?name=${n}&type=${type}`;
    const res = await fetch(url, { signal, headers: { accept: "application/dns-json" } });
    if (!res.ok) throw new Error(`Resolver answered HTTP ${res.status}.`);
    return (await res.json()) as DohResponse;
}

function unquoteTxt(data: string): string {
    const parts = [...data.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => (m[1] ?? "").replace(/\\(.)/g, "$1"));
    return parts.length ? parts.join("") : data;
}
function formatData(type: string, data: string): string {
    return type === "TXT" ? unquoteTxt(data) : data;
}
function humanTtl(s: number): string {
    if (s < 60) return `${s}s`;
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const out: string[] = [];
    if (d) out.push(`${d}d`);
    if (h) out.push(`${h}h`);
    if (m) out.push(`${m}m`);
    if (sec && !d && !h) out.push(`${sec}s`);
    return out.join(" ");
}
function sortRows(type: string, rows: Row[]): Row[] {
    if (type !== "MX") return rows;
    const pri = (r: Row) => parseInt(r.data, 10) || 0;
    return [...rows].sort((a, b) => pri(a) - pri(b));
}

async function queryType(name: string, type: string, signal: AbortSignal): Promise<TypeResult> {
    try {
        const r = await doh(name, type, signal);
        const wanted = (r.Answer ?? []).filter((a) => TYPE_NAMES[a.type] === type || type === "ANY");
        const rows = sortRows(type, wanted.map((a) => ({ name: a.name, ttl: a.TTL, type: TYPE_NAMES[a.type] ?? String(a.type), data: formatData(TYPE_NAMES[a.type] ?? "", a.data) })));
        const cnames = (r.Answer ?? []).filter((a) => a.type === 5 && type !== "CNAME").map((a) => ({ name: a.name, ttl: a.TTL, type: "CNAME", data: a.data }));
        return { type, status: r.Status, ad: !!r.AD, rows: [...cnames, ...rows], error: "" };
    } catch (e) {
        const err = e as Error;
        return { type, status: -1, ad: false, rows: [], error: err.name === "AbortError" ? "Timed out or cancelled." : err.message || "Query failed." };
    }
}

async function txtRecords(name: string, signal: AbortSignal): Promise<string[]> {
    const r = await doh(name, "TXT", signal);
    return (r.Answer ?? []).filter((a) => a.type === 16).map((a) => unquoteTxt(a.data));
}

async function lookup() {
    const n = normalize(domain.value);
    if (!n) {
        error.value = "Enter a valid domain or IP address.";
        return;
    }
    ctrl?.abort();
    ctrl = new AbortController();
    const signal = ctrl.signal;
    const timer = setTimeout(() => ctrl?.abort(), 20000);
    loading.value = true;
    error.value = "";
    emailError.value = "";
    results.value = [];
    spfRecords.value = null;
    dmarcRecords.value = null;
    queriedName.value = n.name;
    reverse.value = n.reverse;
    const types = n.reverse ? ["PTR"] : TYPES.filter((t) => selected.value.includes(t));
    if (!types.length) {
        loading.value = false;
        clearTimeout(timer);
        error.value = "Select at least one record type.";
        return;
    }
    try {
        const tasks: Promise<unknown>[] = [
            Promise.all(types.map((t) => queryType(n.name, t, signal))).then((r) => (results.value = r)),
        ];
        if (emailCheck.value && !n.reverse) {
            tasks.push(
                Promise.all([txtRecords(n.name, signal), txtRecords(`_dmarc.${n.name}`, signal)])
                    .then(([t, d]) => {
                        spfRecords.value = t;
                        dmarcRecords.value = d;
                    })
                    .catch((e: Error) => {
                        emailError.value = e.name === "AbortError" ? "Email security lookup timed out." : e.message;
                    }),
            );
        }
        await Promise.all(tasks);
    } finally {
        clearTimeout(timer);
        loading.value = false;
    }
}

onBeforeUnmount(() => ctrl?.abort());

function statusLabel(s: number) {
    return s < 0 ? "ERROR" : (RCODES[s] ?? `RCODE ${s}`);
}
function statusClass(s: number) {
    return s === 0 ? "bg-accent-soft text-accent-strong dark:text-accent" : s === 3 ? "bg-warn-soft text-warn" : "bg-danger-soft text-danger";
}

// ---- Email security ----
interface Mech { raw: string; qualifier: string; meaning: string; kind: string; lookup: boolean }
const QUAL: Record<string, string> = { "+": "Pass", "-": "Fail (reject)", "~": "SoftFail", "?": "Neutral" };
const spf = computed(() => {
    if (!spfRecords.value) return null;
    const recs = spfRecords.value.filter((t) => /^v=spf1(\s|$)/i.test(t.trim()));
    if (!recs.length) return { found: false as const };
    const record = recs[0] ?? "";
    const mechs: Mech[] = [];
    let lookups = 0;
    const warnings: string[] = [];
    if (recs.length > 1) warnings.push(`${recs.length} SPF records found. Only one is allowed; receivers return PermError.`);
    for (const tok of record.trim().split(/\s+/).slice(1)) {
        const m = /^([+\-~?])?([a-z0-9]+)(?:([:=/])(.*))?$/i.exec(tok);
        if (!m) {
            mechs.push({ raw: tok, qualifier: "", meaning: "Unrecognised term", kind: tok, lookup: false });
            continue;
        }
        const q = m[1] ?? (m[3] === "=" ? "" : "+");
        const kind = (m[2] ?? "").toLowerCase();
        const lookup = ["include", "a", "mx", "ptr", "exists", "redirect"].includes(kind);
        if (lookup) lookups++;
        let meaning = QUAL[q] ?? "";
        if (kind === "redirect") meaning = "Use another domain's policy";
        if (kind === "exp") meaning = "Explanation message domain";
        mechs.push({ raw: tok, qualifier: q, meaning, kind, lookup });
    }
    const all = mechs.find((x) => x.kind === "all");
    if (!all && !mechs.some((x) => x.kind === "redirect")) warnings.push('No "all" mechanism or redirect: unmatched senders get a Neutral result.');
    if (all?.qualifier === "+") warnings.push('"+all" allows any server to send mail as this domain.');
    if (all?.qualifier === "?") warnings.push('"?all" gives no protection (Neutral).');
    if (mechs.some((x) => x.kind === "ptr")) warnings.push('"ptr" is deprecated and slow; avoid it.');
    if (lookups > 10) warnings.push(`${lookups} DNS-lookup mechanisms exceed the limit of 10 (PermError).`);
    return { found: true as const, record, mechs, lookups, warnings };
});

const DMARC_HELP: Record<string, string> = {
    v: "Protocol version",
    p: "Policy for the domain: none (monitor), quarantine, reject",
    sp: "Policy for subdomains",
    pct: "Percentage of messages the policy applies to",
    rua: "Aggregate report addresses",
    ruf: "Forensic (failure) report addresses",
    adkim: "DKIM alignment: r = relaxed, s = strict",
    aspf: "SPF alignment: r = relaxed, s = strict",
    fo: "Failure reporting options",
    ri: "Aggregate report interval (seconds)",
    rf: "Failure report format",
};
const dmarc = computed(() => {
    if (!dmarcRecords.value) return null;
    const record = dmarcRecords.value.find((t) => /^v=DMARC1\b/i.test(t.trim()));
    if (!record) return { found: false as const };
    const tags: { k: string; v: string; help: string }[] = [];
    for (const part of record.split(";")) {
        const i = part.indexOf("=");
        if (i < 0) continue;
        const k = part.slice(0, i).trim().toLowerCase();
        const v = part.slice(i + 1).trim();
        if (k) tags.push({ k, v, help: DMARC_HELP[k] ?? "" });
    }
    const get = (k: string) => tags.find((t) => t.k === k)?.v;
    const warnings: string[] = [];
    const p = get("p")?.toLowerCase();
    if (!p) warnings.push('Missing required "p" tag.');
    else if (p === "none") warnings.push("Policy is p=none: monitoring only, spoofed mail is not blocked.");
    const sp = get("sp")?.toLowerCase();
    if (sp === "none" && p && p !== "none") warnings.push("Subdomains use sp=none and are not protected.");
    const pct = get("pct");
    if (pct && Number(pct) < 100) warnings.push(`Policy applies to only ${pct}% of messages.`);
    if (!get("rua")) warnings.push("No rua address: you will not receive aggregate reports.");
    return { found: true as const, record, tags, warnings };
});

// ---- Export ----
const textOut = computed(() => {
    const lines: string[] = [];
    for (const r of results.value) {
        lines.push(`;; ${queriedName.value} ${r.type} - ${statusLabel(r.status)}${r.ad ? " (AD)" : ""}`);
        if (r.error) lines.push(`;; ${r.error}`);
        for (const x of r.rows) lines.push(`${x.name}\t${x.ttl}\t${x.type}\t${x.data}`);
        lines.push("");
    }
    return lines.join("\n").trim();
});
const jsonOut = computed(() =>
    results.value.length
        ? JSON.stringify({ name: queriedName.value, resolver: resolver.value, results: results.value.map((r) => ({ type: r.type, status: statusLabel(r.status), ad: r.ad, records: r.rows, error: r.error || undefined })) }, null, 2)
        : "",
);
</script>

<template>
    <ToolPage>
        <Panel title="Lookup">
            <form class="space-y-4" @submit.prevent="lookup">
                <div class="flex flex-col gap-2 sm:flex-row">
                    <input v-model="domain" class="input flex-1 font-mono" spellcheck="false" autocapitalize="off" placeholder="example.com or 8.8.8.8 (reverse lookup)" />
                    <select v-model="resolver" class="select sm:w-44" aria-label="Resolver">
                        <option value="cloudflare">Cloudflare</option>
                        <option value="google">Google</option>
                    </select>
                    <Btn type="submit" variant="primary" :disabled="loading || !domain.trim()"><Search class="size-4" />{{ loading ? "Querying…" : "Lookup" }}</Btn>
                </div>
                <Field label="Record types" hint="IPv4/IPv6 input is looked up as PTR automatically.">
                    <div class="flex flex-wrap items-center gap-1.5">
                        <button
                            v-for="t in TYPES"
                            :key="t"
                            type="button"
                            class="chip cursor-pointer font-mono transition-colors"
                            :class="selected.includes(t) ? '!bg-inverse !text-inverse-fg' : 'hover:text-fg'"
                            :aria-pressed="selected.includes(t)"
                            @click="toggle(t)"
                        >
                            {{ t }}
                        </button>
                        <Btn size="sm" variant="ghost" @click="selected = [...COMMON]">All common</Btn>
                        <Btn size="sm" variant="ghost" @click="selected = []">Clear</Btn>
                    </div>
                </Field>
                <label class="flex cursor-pointer items-center gap-2 text-sm">
                    <input v-model="emailCheck" type="checkbox" class="checkbox" /> Include email security check (SPF and DMARC)
                </label>
            </form>
        </Panel>

        <Notice v-if="error" type="error">{{ error }}</Notice>
        <Notice v-if="loading" type="info">Querying {{ resolver === "google" ? "Google" : "Cloudflare" }} DNS…</Notice>

        <template v-if="results.length">
            <Panel :title="reverse ? `Reverse lookup: ${queriedName}` : `Records for ${queriedName}`">
                <template #actions>
                    <CopyButton :text="textOut" label="Copy text" />
                    <CopyButton :text="jsonOut" label="Copy JSON" />
                </template>
                <div class="space-y-5">
                    <section v-for="r in results" :key="r.type">
                        <div class="mb-2 flex flex-wrap items-center gap-2">
                            <span class="chip font-mono font-semibold text-fg">{{ r.type }}</span>
                            <span class="rounded px-1.5 py-0.5 text-xs font-medium" :class="statusClass(r.status)">{{ statusLabel(r.status) }}</span>
                            <span v-if="r.ad" class="rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent-strong dark:text-accent" title="Authenticated Data: DNSSEC validated">AD (DNSSEC)</span>
                            <span v-if="r.error" class="text-xs text-danger">{{ r.error }}</span>
                        </div>
                        <div v-if="r.rows.length" class="overflow-x-auto rounded-md border border-line">
                            <table class="w-full text-left text-sm">
                                <thead class="bg-subtle text-xs text-muted">
                                    <tr><th class="px-3 py-1.5 font-medium">Name</th><th class="px-3 py-1.5 font-medium">Type</th><th class="px-3 py-1.5 font-medium">TTL</th><th class="px-3 py-1.5 font-medium">Data</th></tr>
                                </thead>
                                <tbody class="divide-y divide-line">
                                    <tr v-for="(x, i) in r.rows" :key="i" class="align-top">
                                        <td class="px-3 py-1.5 font-mono text-[13px] break-all">{{ x.name }}</td>
                                        <td class="px-3 py-1.5 font-mono text-[13px] text-muted">{{ x.type }}</td>
                                        <td class="px-3 py-1.5 whitespace-nowrap text-muted" :title="`${x.ttl}s`">{{ humanTtl(x.ttl) }}</td>
                                        <td class="px-3 py-1.5 font-mono text-[13px] break-all">{{ x.data }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p v-else-if="!r.error" class="text-sm text-muted">No {{ r.type }} records.</p>
                    </section>
                </div>
            </Panel>
        </template>

        <Notice v-if="emailError" type="error">{{ emailError }}</Notice>

        <Panel v-if="spf || dmarc" title="Email security">
            <div class="grid gap-6 lg:grid-cols-2">
                <section class="min-w-0 space-y-3">
                    <h4 class="text-sm font-semibold">SPF</h4>
                    <template v-if="spf?.found">
                        <code class="code block break-all">{{ spf.record }}</code>
                        <div class="text-sm">
                            DNS lookups:
                            <span class="font-semibold" :class="spf.lookups > 10 ? 'text-danger' : 'text-success'">{{ spf.lookups }} / 10</span>
                            <span class="ml-1 text-xs text-muted">(top-level terms only; nested includes not followed)</span>
                        </div>
                        <ul class="divide-y divide-line rounded-md border border-line text-sm">
                            <li v-for="(m, i) in spf.mechs" :key="i" class="flex flex-wrap items-baseline gap-x-3 px-3 py-1.5">
                                <span class="font-mono text-[13px] break-all">{{ m.raw }}</span>
                                <span class="text-xs text-muted">{{ m.meaning }}</span>
                                <span v-if="m.lookup" class="chip ml-auto">lookup</span>
                            </li>
                        </ul>
                        <Notice v-for="w in spf.warnings" :key="w" type="warning">{{ w }}</Notice>
                        <Notice v-if="!spf.warnings.length" type="success">SPF record looks healthy.</Notice>
                    </template>
                    <Notice v-else type="warning">No SPF record found (TXT starting with v=spf1).</Notice>
                </section>
                <section class="min-w-0 space-y-3">
                    <h4 class="text-sm font-semibold">DMARC <span class="font-mono text-xs font-normal text-muted">_dmarc.{{ queriedName }}</span></h4>
                    <template v-if="dmarc?.found">
                        <code class="code block break-all">{{ dmarc.record }}</code>
                        <ul class="divide-y divide-line rounded-md border border-line text-sm">
                            <li v-for="t in dmarc.tags" :key="t.k" class="px-3 py-1.5">
                                <span class="font-mono text-[13px] font-semibold">{{ t.k }}</span>=<span class="font-mono text-[13px] break-all">{{ t.v }}</span>
                                <span v-if="t.help" class="block text-xs text-muted">{{ t.help }}</span>
                            </li>
                        </ul>
                        <Notice v-for="w in dmarc.warnings" :key="w" type="warning">{{ w }}</Notice>
                        <Notice v-if="!dmarc.warnings.length" type="success">DMARC policy looks healthy.</Notice>
                    </template>
                    <Notice v-else type="warning">No DMARC record found.</Notice>
                </section>
            </div>
        </Panel>

        <Notice type="info">Queries are sent from your browser to the selected public resolver ({{ resolver === "google" ? "dns.google" : "cloudflare-dns.com" }}) over HTTPS. The domain you enter is visible to that resolver.</Notice>
    </ToolPage>
</template>
