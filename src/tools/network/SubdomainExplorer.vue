<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useStorage } from "@vueuse/core";
import { Download, Network, Search } from "lucide-vue-next";
import { Btn, CopyButton, Notice, Panel, ToolPage } from "@/components/ui";
import { downloadBlob } from "@/composables/useClipboard";

interface Row { name: string; first: string; last: string; wildcard: boolean }
interface Res { state: "pending" | "alive" | "dead" | "error"; records: string[] }

const domain = useStorage("tools:subdomains:domain", "example.com");
const loading = ref(false);
const error = ref("");
const source = ref("");
const rows = ref<Row[]>([]);
const filter = ref("");
const resolving = ref(false);
const resolved = ref<Record<string, Res>>({});
let ctrl: AbortController | null = null;

function cleanDomain(v: string) {
    return v.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/^\*\./, "").split(/[/?#:]/)[0].replace(/\.$/, "");
}

async function fetchJson(url: string, signal: AbortSignal, ms: number) {
    const inner = new AbortController();
    const t = setTimeout(() => inner.abort(), ms);
    const onAbort = () => inner.abort();
    signal.addEventListener("abort", onAbort);
    try {
        const res = await fetch(url, { signal: inner.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(t);
        signal.removeEventListener("abort", onAbort);
    }
}

function build(entries: { names: string[]; first: string; last: string }[], base: string) {
    const map = new Map<string, Row>();
    for (const e of entries) {
        for (const raw of e.names) {
            let n = raw.trim().toLowerCase();
            if (!n) continue;
            const wildcard = n.startsWith("*.");
            if (wildcard) n = n.slice(2);
            if (n !== base && !n.endsWith("." + base)) continue;
            const cur = map.get(n);
            if (!cur) map.set(n, { name: n, first: e.first, last: e.last, wildcard });
            else {
                if (e.first && (!cur.first || e.first < cur.first)) cur.first = e.first;
                if (e.last && e.last > cur.last) cur.last = e.last;
                cur.wildcard ||= wildcard;
            }
        }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
const day = (s?: string) => (s ? String(s).slice(0, 10) : "");

async function search() {
    const base = cleanDomain(domain.value);
    if (!base) return;
    ctrl?.abort();
    ctrl = new AbortController();
    loading.value = true;
    error.value = "";
    rows.value = [];
    resolved.value = {};
    source.value = "";
    const sig = ctrl.signal;
    try {
        try {
            const j = (await fetchJson(`https://crt.sh/?q=%25.${encodeURIComponent(base)}&output=json`, sig, 30000)) as { name_value: string; not_before: string; not_after: string }[];
            rows.value = build(j.map((c) => ({ names: String(c.name_value).split("\n"), first: day(c.not_before), last: day(c.not_after) })), base);
            source.value = "crt.sh";
        } catch (e) {
            if (sig.aborted) throw e;
            const j = (await fetchJson(`https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(base)}&include_subdomains=true&expand=dns_names`, sig, 30000)) as { dns_names: string[]; not_before: string; not_after: string }[];
            rows.value = build(j.map((c) => ({ names: c.dns_names ?? [], first: day(c.not_before), last: day(c.not_after) })), base);
            source.value = "Cert Spotter (crt.sh unavailable)";
        }
        if (!rows.value.length) error.value = "No certificates found for this domain.";
    } catch (e) {
        error.value = sig.aborted ? "Search was cancelled." : "Both crt.sh and Cert Spotter failed or timed out. Try again in a moment (crt.sh is often overloaded).";
    } finally {
        loading.value = false;
    }
}

const filtered = computed(() => {
    const q = filter.value.trim().toLowerCase();
    return q ? rows.value.filter((r) => r.name.includes(q)) : rows.value;
});

async function resolveAll() {
    if (resolving.value) return;
    resolving.value = true;
    const list = filtered.value.filter((r) => !r.name.startsWith("*")).map((r) => r.name);
    const queue = [...list];
    for (const n of list) resolved.value[n] = { state: "pending", records: [] };
    const signal = (ctrl ??= new AbortController()).signal;
    async function worker() {
        while (queue.length && !signal.aborted) {
            const n = queue.shift()!;
            try {
                const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(n)}&type=A`, { headers: { accept: "application/dns-json" }, signal });
                const j = (await res.json()) as { Status: number; Answer?: { type: number; data: string }[] };
                const recs = (j.Answer ?? []).filter((a) => a.type === 1 || a.type === 5).map((a) => (a.type === 5 ? "CNAME " : "") + a.data.replace(/\.$/, ""));
                resolved.value[n] = { state: recs.some((r) => !r.startsWith("CNAME")) ? "alive" : "dead", records: recs };
            } catch {
                resolved.value[n] = { state: "error", records: [] };
            }
        }
    }
    await Promise.all(Array.from({ length: 6 }, worker));
    resolving.value = false;
}

onBeforeUnmount(() => ctrl?.abort());

const wildcards = computed(() => rows.value.filter((r) => r.wildcard).length);
const names = computed(() => filtered.value.map((r) => r.name).join("\n"));
function exportAs(kind: "txt" | "csv" | "json") {
    const base = cleanDomain(domain.value) || "subdomains";
    if (kind === "txt") downloadBlob(names.value, `${base}-subdomains.txt`);
    else if (kind === "json") downloadBlob(JSON.stringify(filtered.value.map((r) => ({ ...r, ...(resolved.value[r.name] ? { dns: resolved.value[r.name].state, records: resolved.value[r.name].records } : {}) })), null, 2), `${base}-subdomains.json`, "application/json");
    else {
        const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
        const lines = ["name,first_seen,last_seen,wildcard,dns,records", ...filtered.value.map((r) => [esc(r.name), r.first, r.last, r.wildcard, resolved.value[r.name]?.state ?? "", esc((resolved.value[r.name]?.records ?? []).join(" "))].join(","))];
        downloadBlob(lines.join("\n"), `${base}-subdomains.csv`, "text/csv");
    }
}
</script>

<template>
    <ToolPage>
        <Panel title="Domain">
            <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="search">
                <input v-model="domain" class="input flex-1 font-mono" spellcheck="false" autocapitalize="off" placeholder="example.com" />
                <Btn type="submit" variant="primary" :disabled="loading || !domain.trim()"><Search class="size-4" />{{ loading ? "Searching…" : "Find subdomains" }}</Btn>
            </form>
        </Panel>

        <Notice v-if="loading" type="info">Querying Certificate Transparency logs. crt.sh can take up to 30 seconds.</Notice>
        <Notice v-if="error" type="error">{{ error }}</Notice>

        <Panel v-if="rows.length" flush>
            <template #title>{{ filtered.length }} of {{ rows.length }} names<span v-if="wildcards" class="ml-2 text-xs font-normal text-muted">{{ wildcards }} with wildcard certs</span></template>
            <template #actions>
                <Btn size="sm" :disabled="resolving" @click="resolveAll"><Network class="size-4" />{{ resolving ? "Resolving…" : "Resolve" }}</Btn>
                <CopyButton :text="names" label="Copy all" size="sm" />
                <Btn size="sm" variant="ghost" @click="exportAs('txt')"><Download class="size-4" />TXT</Btn>
                <Btn size="sm" variant="ghost" @click="exportAs('csv')">CSV</Btn>
                <Btn size="sm" variant="ghost" @click="exportAs('json')">JSON</Btn>
            </template>
            <div class="border-b border-line p-3"><input v-model="filter" class="input" placeholder="Filter names…" /></div>
            <div class="max-h-[32rem] overflow-auto">
                <table class="w-full text-sm">
                    <thead class="sticky top-0 bg-surface text-left text-xs text-muted uppercase">
                        <tr><th class="px-4 py-2 font-medium">Name</th><th class="px-4 py-2 font-medium whitespace-nowrap">First seen</th><th class="px-4 py-2 font-medium whitespace-nowrap">Last seen</th><th class="px-4 py-2 font-medium">DNS</th></tr>
                    </thead>
                    <tbody class="divide-y divide-line border-t border-line">
                        <tr v-for="r in filtered" :key="r.name">
                            <td class="px-4 py-2 font-mono text-[13px] break-all">{{ r.name }}<span v-if="r.wildcard" class="chip ml-2">wildcard</span></td>
                            <td class="px-4 py-2 whitespace-nowrap text-muted">{{ r.first || "-" }}</td>
                            <td class="px-4 py-2 whitespace-nowrap text-muted">{{ r.last || "-" }}</td>
                            <td class="px-4 py-2">
                                <template v-if="resolved[r.name]">
                                    <span v-if="resolved[r.name].state === 'pending'" class="text-xs text-muted">…</span>
                                    <span v-else-if="resolved[r.name].state === 'error'" class="chip">error</span>
                                    <div v-else class="flex flex-wrap items-center gap-1.5">
                                        <span class="chip" :class="resolved[r.name].state === 'alive' ? 'text-success' : 'text-danger'">{{ resolved[r.name].state }}</span>
                                        <span v-for="rec in resolved[r.name].records" :key="rec" class="font-mono text-xs text-muted">{{ rec }}</span>
                                    </div>
                                </template>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </Panel>

        <Notice type="info">This is passive discovery from public Certificate Transparency logs{{ source ? ` (source: ${source})` : "" }}. It only finds names that have had a TLS certificate issued; it will miss internal or certificate-less hosts, and listed names may no longer exist. Use Resolve to check which still answer DNS.</Notice>
    </ToolPage>
</template>
