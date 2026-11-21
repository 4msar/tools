<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useStorage } from "@vueuse/core";
import { Search, ChevronDown, ChevronRight } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Notice, Panel, ToolPage } from "@/components/ui";
import { useHandoff } from "@/composables/handoff";

type Kind = "domain" | "ip" | "asn";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

const query = useStorage("tools:whois:query", "example.com");
const loading = ref(false);
const error = ref("");
const data = ref<Json>(null);
const kind = ref<Kind>("domain");
const showRaw = ref(false);
let ctrl: AbortController | null = null;

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/;
function normalize(raw: string): { kind: Kind; value: string } | null {
    let v = raw.trim();
    if (!v) return null;
    if (/^as\d+$/i.test(v)) return { kind: "asn", value: v.slice(2) };
    if (/^\d+$/.test(v)) return { kind: "asn", value: v };
    v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
    v = v.replace(/^[^@/]*@/, "");
    if (v.startsWith("[")) {
        const end = v.indexOf("]");
        if (end > 0) return { kind: "ip", value: v.slice(1, end) };
    }
    v = v.split(/[/?#]/)[0];
    if (IPV4.test(v) || /^[0-9a-f:]+:[0-9a-f:]*$/i.test(v)) return { kind: "ip", value: v };
    v = v.replace(/:\d+$/, "").replace(/\.$/, "").toLowerCase();
    return v ? { kind: "domain", value: v } : null;
}

async function lookup() {
    const n = normalize(query.value);
    if (!n) return;
    ctrl?.abort();
    ctrl = new AbortController();
    const timer = setTimeout(() => ctrl?.abort(), 20000);
    loading.value = true;
    error.value = "";
    data.value = null;
    kind.value = n.kind;
    const path = n.kind === "domain" ? "domain" : n.kind === "ip" ? "ip" : "autnum";
    try {
        const res = await fetch(`https://rdap.org/${path}/${encodeURIComponent(n.value).replace(/%3A/gi, ":")}`, {
            signal: ctrl.signal,
            headers: { accept: "application/rdap+json, application/json" },
        });
        if (res.status === 404) throw new Error(`No RDAP record found for "${n.value}". The TLD may not offer RDAP.`);
        if (!res.ok) throw new Error(`RDAP server answered HTTP ${res.status}.`);
        data.value = await res.json();
    } catch (e) {
        const err = e as Error;
        error.value = err.name === "AbortError" ? "Lookup timed out or was cancelled." : err.message || "Lookup failed.";
    } finally {
        clearTimeout(timer);
        loading.value = false;
    }
}

onBeforeUnmount(() => ctrl?.abort());

useHandoff<{ input?: string }>("whois-lookup", (p) => {
    if (!p.input) return;
    query.value = p.input;
    lookup();
});

function vcardField(entity: Json, field: string): string {
    const arr = entity?.vcardArray?.[1];
    if (!Array.isArray(arr)) return "";
    const row = arr.find((r: Json[]) => r[0] === field);
    const val = row?.[3];
    return Array.isArray(val) ? val.filter(Boolean).join(", ") : (val ?? "");
}

interface Contact { role: string; name: string; email: string; org: string; handle: string }
function flatEntities(list: Json[] | undefined): Json[] {
    const out: Json[] = [];
    for (const e of list ?? []) {
        out.push(e);
        out.push(...flatEntities(e.entities));
    }
    return out;
}
const contacts = computed<Contact[]>(() => {
    const all = flatEntities(data.value?.entities);
    const res: Contact[] = [];
    for (const e of all) {
        for (const role of (e.roles as string[]) ?? []) {
            res.push({ role, name: vcardField(e, "fn"), email: vcardField(e, "email"), org: vcardField(e, "org"), handle: e.handle ?? "" });
        }
    }
    return res;
});
const registrar = computed(() => contacts.value.find((c) => c.role === "registrar"));
const otherContacts = computed(() => contacts.value.filter((c) => c.role !== "registrar" && (c.name || c.email || c.org)));

const events = computed(() => {
    const labels: Record<string, string> = {
        registration: "Registered",
        expiration: "Expires",
        "last changed": "Last changed",
        "last update of RDAP database": "RDAP updated",
        transfer: "Transferred",
        reregistration: "Re-registered",
    };
    return ((data.value?.events as Json[]) ?? []).map((e) => {
        const d = new Date(e.eventDate);
        const days = Math.round((d.getTime() - Date.now()) / 86400000);
        const valid = !isNaN(d.getTime());
        let rel = "";
        if (valid) {
            if (e.eventAction === "expiration") rel = days >= 0 ? `expires in ${days} day${days === 1 ? "" : "s"}` : `expired ${-days} day${days === -1 ? "" : "s"} ago`;
            else rel = days <= 0 ? `${-days} day${days === -1 ? "" : "s"} ago` : `in ${days} days`;
        }
        return { action: labels[e.eventAction] ?? e.eventAction, date: valid ? d.toLocaleString() : e.eventDate, rel, expired: e.eventAction === "expiration" && days < 0, soon: e.eventAction === "expiration" && days >= 0 && days <= 30 };
    });
});

const nameservers = computed(() => ((data.value?.nameservers as Json[]) ?? []).map((n) => String(n.ldhName ?? n.unicodeName ?? "").toLowerCase()).filter(Boolean));
const statuses = computed<string[]>(() => data.value?.status ?? []);
const dnssec = computed(() => {
    const s = data.value?.secureDNS;
    if (!s) return "";
    return s.delegationSigned ? "Signed (DNSSEC enabled)" : "Unsigned";
});
const title = computed(() => data.value?.ldhName ?? data.value?.name ?? data.value?.handle ?? "");
const ipInfo = computed(() => {
    if (kind.value === "domain" || !data.value) return [];
    const d = data.value;
    const rows: [string, string][] = [];
    if (kind.value === "ip") {
        if (d.startAddress) rows.push(["Range", `${d.startAddress} - ${d.endAddress}`]);
        const cidrs = (d.cidr0_cidrs as Json[])?.map((c) => `${c.v4prefix ?? c.v6prefix}/${c.length}`).join(", ");
        if (cidrs) rows.push(["CIDR", cidrs]);
        if (d.name) rows.push(["Name", d.name]);
        if (d.country) rows.push(["Country", d.country]);
        if (d.type) rows.push(["Type", d.type]);
        if (d.ipVersion) rows.push(["Version", d.ipVersion]);
        if (d.handle) rows.push(["Handle", d.handle]);
        if (d.parentHandle) rows.push(["Parent", d.parentHandle]);
    } else {
        if (d.handle) rows.push(["Handle", d.handle]);
        if (d.name) rows.push(["Name", d.name]);
        if (d.startAutnum != null) rows.push(["Range", d.startAutnum === d.endAutnum ? `AS${d.startAutnum}` : `AS${d.startAutnum} - AS${d.endAutnum}`]);
        if (d.country) rows.push(["Country", d.country]);
        if (d.type) rows.push(["Type", d.type]);
    }
    return rows;
});
const raw = computed(() => (data.value ? JSON.stringify(data.value, null, 2) : ""));
</script>

<template>
    <ToolPage>
        <Panel title="Lookup">
            <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="lookup">
                <input v-model="query" class="input flex-1 font-mono" spellcheck="false" autocapitalize="off" placeholder="example.com, 8.8.8.8, 2606:4700::1111 or AS13335" />
                <Btn type="submit" variant="primary" :disabled="loading || !query.trim()"><Search class="size-4" />{{ loading ? "Looking up…" : "Lookup" }}</Btn>
            </form>
        </Panel>

        <Notice v-if="error" type="error">{{ error }}</Notice>
        <Notice v-if="loading" type="info">Querying RDAP…</Notice>

        <template v-if="data">
            <Panel :title="title || 'Result'">
                <dl class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
                    <template v-if="kind === 'domain'">
                        <dt class="text-muted">Registrar</dt>
                        <dd>{{ registrar?.name || registrar?.org || "Unknown" }}<span v-if="registrar?.handle" class="ml-2 text-xs text-muted">IANA {{ registrar.handle }}</span></dd>
                        <dt class="text-muted">DNSSEC</dt>
                        <dd>{{ dnssec || "Unknown" }}</dd>
                        <dt class="text-muted">Status</dt>
                        <dd class="flex flex-wrap gap-1.5"><span v-for="s in statuses" :key="s" class="chip">{{ s }}</span><span v-if="!statuses.length" class="text-muted">None</span></dd>
                        <dt class="text-muted">Nameservers</dt>
                        <dd class="flex flex-col gap-1 font-mono text-[13px]"><span v-for="n in nameservers" :key="n">{{ n }}</span><span v-if="!nameservers.length" class="font-sans text-muted">None</span></dd>
                    </template>
                    <template v-else>
                        <template v-for="[k, v] in ipInfo" :key="k">
                            <dt class="text-muted">{{ k }}</dt>
                            <dd class="font-mono break-all">{{ v }}</dd>
                        </template>
                        <template v-if="statuses.length">
                            <dt class="text-muted">Status</dt>
                            <dd class="flex flex-wrap gap-1.5"><span v-for="s in statuses" :key="s" class="chip">{{ s }}</span></dd>
                        </template>
                    </template>
                </dl>
            </Panel>

            <div class="grid gap-4 lg:grid-cols-2">
                <Panel v-if="events.length" title="Events">
                    <ul class="divide-y divide-line text-sm">
                        <li v-for="(e, i) in events" :key="i" class="flex flex-wrap items-baseline justify-between gap-x-3 py-2 first:pt-0 last:pb-0">
                            <span class="font-medium">{{ e.action }}</span>
                            <span class="text-right text-muted">
                                {{ e.date }}
                                <span v-if="e.rel" class="ml-1 rounded px-1.5 py-0.5 text-xs" :class="e.expired ? 'bg-danger-soft text-danger' : e.soon ? 'bg-warning-soft text-warning' : 'bg-subtle'">{{ e.rel }}</span>
                            </span>
                        </li>
                    </ul>
                </Panel>
                <Panel v-if="otherContacts.length" title="Contacts">
                    <ul class="divide-y divide-line text-sm">
                        <li v-for="(c, i) in otherContacts" :key="i" class="py-2 first:pt-0 last:pb-0">
                            <span class="chip mr-2">{{ c.role }}</span>
                            <span>{{ c.name || c.org }}</span>
                            <span v-if="c.email" class="ml-2 inline-flex items-center gap-1 font-mono text-xs text-muted">{{ c.email }}<CopyButton :text="c.email" icon-only size="sm" /></span>
                        </li>
                    </ul>
                </Panel>
            </div>

            <Panel flush>
                <template #title>
                    <button type="button" class="inline-flex items-center gap-1" @click="showRaw = !showRaw">
                        <component :is="showRaw ? ChevronDown : ChevronRight" class="size-4" /> Raw JSON
                    </button>
                </template>
                <template #actions><CopyButton :text="raw" label="Copy" size="sm" /></template>
                <CodeArea v-if="showRaw" :model-value="raw" readonly height="22rem" :wrap="false" />
            </Panel>
        </template>

        <Notice type="info">Data comes from public RDAP servers (via rdap.org). Classic port-43 WHOIS is not reachable from a browser, and registrant details are often redacted for privacy.</Notice>
    </ToolPage>
</template>
