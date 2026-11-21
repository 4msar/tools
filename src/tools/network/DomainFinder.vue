<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useStorage } from "@vueuse/core";
import { ChevronDown, ChevronRight, CircleCheck, CircleDashed, CircleHelp, CircleX, ExternalLink, Loader2, RotateCw, Search, Square, X } from "lucide-vue-next";
import { Btn, CopyButton, Field, Notice, Panel, ToolPage } from "@/components/ui";
import { sendToTool, useHandoff } from "@/composables/handoff";
import { checkDomain, generate, REGISTRARS, toLabel, type Candidate, type CheckResult, type RegistrarId, type Status } from "./domainCheck";

const POPULAR = ["com", "net", "org", "io", "co", "ai", "dev", "app", "xyz", "me", "tech", "info", "sh", "so", "gg", "to"];
const TLD_GROUPS: { name: string; tlds: string[] }[] = [
    { name: "Generic", tlds: ["biz", "online", "site", "website", "space", "live", "world", "one", "pro", "today", "life", "zone", "plus", "top", "fun", "click", "link", "page", "icu", "vip", "wiki"] },
    { name: "Tech & startups", tlds: ["cloud", "digital", "software", "systems", "tools", "codes", "build", "computer", "network", "host", "hosting", "data", "email", "run", "lol", "inc", "ventures", "engineer", "technology", "solutions", "app", "dev", "page"] },
    { name: "Business & finance", tlds: ["company", "agency", "business", "consulting", "services", "group", "partners", "global", "international", "finance", "capital", "fund", "money", "cash", "legal", "law", "tax", "market", "marketing", "management", "llc", "ltd", "biz"] },
    { name: "Shopping", tlds: ["shop", "store", "buy", "sale", "deals", "market", "boutique", "fashion", "clothing", "shoes", "jewelry", "gifts", "toys", "furniture", "auto", "car", "cars", "luxury"] },
    { name: "Creative & media", tlds: ["design", "studio", "art", "gallery", "photo", "photography", "pics", "media", "video", "film", "tv", "fm", "audio", "music", "band", "blog", "news", "press", "ink", "graphics", "ninja", "rocks", "cool", "wtf"] },
    { name: "Food & lifestyle", tlds: ["kitchen", "recipes", "food", "cafe", "coffee", "restaurant", "pizza", "bar", "pub", "wine", "beer", "menu", "health", "fit", "fitness", "yoga", "care", "clinic", "dental", "beauty", "salon", "style", "pet", "dog", "garden", "house", "home", "homes", "family", "baby", "love", "dating"] },
    { name: "Education & community", tlds: ["academy", "education", "school", "college", "university", "courses", "training", "institute", "community", "club", "team", "foundation", "charity", "church", "events", "social", "chat", "forum", "help", "guide", "how"] },
    { name: "Travel & places", tlds: ["travel", "tours", "holiday", "vacations", "flights", "hotel", "city", "town", "land", "earth", "place", "london", "berlin", "paris", "tokyo", "africa", "asia"] },
    { name: "Gaming & fun", tlds: ["games", "game", "gg", "play", "fan", "fans", "party", "bet", "poker", "casino", "racing", "football", "soccer", "golf", "surf", "tennis"] },
    { name: "Country codes", tlds: ["uk", "de", "fr", "nl", "es", "it", "ch", "se", "no", "dk", "fi", "pl", "be", "at", "ie", "pt", "cz", "in", "sg", "jp", "kr", "cn", "hk", "tw", "au", "nz", "mx", "cl", "ae", "tr", "ru", "id", "ph", "my", "vn"] },
    { name: "Short & hacky ccTLDs", tlds: ["ly", "cc", "tv", "ws", "fm", "am", "is", "it", "im", "la", "vc", "ac", "re", "pw", "st", "lu", "li", "nu", "mx", "ms", "md", "rs", "gl", "bz", "ag", "sc", "mu", "vg", "cx", "nf"] },
];
const ALL_GROUPED = [...new Set(TLD_GROUPS.flatMap((g) => g.tlds))];
const PREFIXES = ["get", "try", "use", "my", "the", "go", "hey", "join"];
const SUFFIXES = ["app", "hq", "hub", "labs", "ly", "ify", "now", "io", "co", "studio"];

const query = useStorage("tools:domain-finder:query", "cloud kitchen");
const s = useStorage(
    "tools:domain-finder:settings",
    { tlds: ["com", "net", "org", "io", "dev", "app", "ai", "co"], custom: [] as string[], variations: true, prefixes: PREFIXES.slice(0, 5), suffixes: SUFFIXES.slice(0, 5), hyphenate: true, variationTld: "com", registrar: "namecheap" as RegistrarId },
    undefined,
    { mergeDefaults: true },
);

interface Row extends Candidate, CheckResult {}
const rows = ref<Row[]>([]);
const filter = ref<"all" | "available" | "taken">("all");
const running = ref(false);
const newTld = ref("");
let ctrl: AbortController | null = null;

const allTlds = computed(() => [...new Set([...POPULAR, ...ALL_GROUPED, ...s.value.custom])]);
/** The chip row: popular TLDs, then anything else that is selected or custom, so picks from "More" stay visible. */
const shownTlds = computed(() => [...new Set([...POPULAR, ...s.value.tlds, ...s.value.custom])]);
const showMore = ref(false);
const tldFilter = ref("");
const moreCount = computed(() => ALL_GROUPED.filter((t) => !POPULAR.includes(t)).length);
const filteredGroups = computed(() => {
    const q = tldFilter.value.trim().toLowerCase().replace(/^\./, "");
    return TLD_GROUPS.map((g) => ({ name: g.name, tlds: q ? g.tlds.filter((t) => t.includes(q)) : g.tlds })).filter((g) => g.tlds.length);
});
function toggleGroup(tlds: string[]) {
    const all = tlds.every((t) => s.value.tlds.includes(t));
    s.value.tlds = all ? s.value.tlds.filter((t) => !tlds.includes(t)) : [...new Set([...s.value.tlds, ...tlds])];
}
function toggle(list: string[], v: string) {
    const i = list.indexOf(v);
    if (i >= 0) list.splice(i, 1);
    else list.push(v);
}
function addTld() {
    const t = toLabel(newTld.value.replace(/^\./, ""));
    newTld.value = "";
    if (!t) return;
    if (!allTlds.value.includes(t)) s.value.custom.push(t);
    if (!s.value.tlds.includes(t)) s.value.tlds.push(t);
}
function removeCustom(t: string) {
    s.value.custom = s.value.custom.filter((x) => x !== t);
    s.value.tlds = s.value.tlds.filter((x) => x !== t);
}

const preview = computed(() =>
    generate(query.value, {
        tlds: s.value.tlds,
        prefixes: s.value.variations ? s.value.prefixes : [],
        suffixes: s.value.variations ? s.value.suffixes : [],
        hyphenate: s.value.hyphenate,
        variationTld: s.value.variations ? s.value.variationTld : "",
    }),
);
const MAX = 150;

async function run(list: Row[], signal: AbortSignal) {
    let i = 0;
    const worker = async () => {
        while (i < list.length && !signal.aborted) {
            const row = list[i++];
            row.status = "checking";
            try {
                Object.assign(row, { note: undefined, registrar: undefined, created: undefined, expires: undefined, source: undefined }, await checkDomain(row.domain, signal));
            } catch {
                if (signal.aborted) row.status = "queued";
                else Object.assign(row, { status: "error", note: "Lookup failed." });
            }
        }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
}

async function search() {
    ctrl?.abort();
    ctrl = new AbortController();
    rows.value = preview.value.slice(0, MAX).map((c) => reactive<Row>({ ...c, status: "queued" }));
    filter.value = "all";
    running.value = true;
    const signal = ctrl.signal;
    await run(rows.value, signal);
    if (ctrl?.signal === signal) running.value = false;
}
function stop() {
    ctrl?.abort();
    running.value = false;
    for (const r of rows.value) if (r.status === "checking") r.status = "queued";
}
async function recheck(row: Row) {
    const c = new AbortController();
    await run([row], c.signal);
}
onBeforeUnmount(() => ctrl?.abort());

useHandoff<{ input?: string }>("domain-finder", (p) => {
    if (!p.input) return;
    query.value = p.input;
    search();
});

const router = useRouter();
function whois(domain: string) {
    sendToTool("whois-lookup", { input: domain });
    router.push("/whois-lookup");
}

const counts = computed(() => {
    const c = { available: 0, taken: 0, pending: 0 };
    for (const r of rows.value) {
        if (r.status === "available" || r.status === "likely") c.available++;
        else if (r.status === "taken") c.taken++;
        else if (r.status === "queued" || r.status === "checking") c.pending++;
    }
    return c;
});
const visible = computed(() =>
    rows.value.filter((r) => filter.value === "all" || (filter.value === "available" ? r.status === "available" || r.status === "likely" : r.status === "taken")),
);
const groups = computed(() =>
    [
        { id: "exact", title: "Your names", rows: visible.value.filter((r) => r.group === "exact") },
        { id: "variation", title: `Variations on .${s.value.variationTld}`, rows: visible.value.filter((r) => r.group === "variation") },
    ].filter((g) => g.rows.length),
);
const availableText = computed(() => rows.value.filter((r) => r.status === "available" || r.status === "likely").map((r) => r.domain).join("\n"));

const STATUS: Record<Status, { label: string; cls: string; icon: unknown }> = {
    queued: { label: "Queued", cls: "bg-subtle text-fg-subtle", icon: CircleDashed },
    checking: { label: "Checking", cls: "bg-subtle text-fg-subtle", icon: Loader2 },
    available: { label: "Available", cls: "bg-accent-soft text-accent-strong dark:text-accent", icon: CircleCheck },
    likely: { label: "Likely available", cls: "bg-warn-soft text-warn", icon: CircleCheck },
    taken: { label: "Taken", cls: "bg-danger-soft text-danger", icon: CircleX },
    invalid: { label: "Invalid TLD", cls: "bg-subtle text-fg-subtle", icon: CircleHelp },
    error: { label: "Unknown", cls: "bg-subtle text-fg-subtle", icon: CircleHelp },
};
function fmtDate(d?: string) {
    if (!d) return "";
    const t = new Date(d);
    return isNaN(t.getTime()) ? d : t.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
</script>

<template>
    <ToolPage>
        <Panel title="Find a domain">
            <form class="flex flex-col gap-4" @submit.prevent="search">
                <div class="flex flex-col gap-2 sm:flex-row">
                    <input v-model="query" class="input flex-1" spellcheck="false" autocapitalize="off" placeholder="Keywords or a domain: cloud kitchen, acme.io, brightpath" aria-label="Keywords or domain" />
                    <Btn v-if="running" variant="secondary" @click="stop"><Square class="size-4" />Stop</Btn>
                    <Btn v-else type="submit" variant="primary" :disabled="!preview.length"><Search class="size-4" />Check {{ Math.min(preview.length, MAX) }} domain{{ preview.length === 1 ? "" : "s" }}</Btn>
                </div>
                <p class="-mt-2 text-xs text-muted">Separate several names with commas or new lines. Spaces join words. A name with a TLD (acme.io) is checked exactly, then on the TLDs below.</p>

                <div>
                    <div class="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                        <span class="label mb-0!">TLDs <span class="font-normal text-muted">({{ s.tlds.length }} selected)</span></span>
                        <span class="flex gap-3 text-xs">
                            <button type="button" class="text-fg-subtle hover:text-fg" @click="s.tlds = [...POPULAR.slice(0, 8)]">Reset</button>
                            <button type="button" class="text-fg-subtle hover:text-fg" :disabled="!s.tlds.length" @click="s.tlds = []">Clear</button>
                        </span>
                    </div>
                    <div class="flex flex-wrap items-center gap-1.5">
                        <button
                            v-for="t in shownTlds"
                            :key="t"
                            type="button"
                            class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-xs ring-1 transition-colors"
                            :class="s.tlds.includes(t) ? 'bg-inverse text-inverse-fg ring-transparent' : 'bg-surface text-fg-subtle ring-line hover:text-fg'"
                            :aria-pressed="s.tlds.includes(t)"
                            @click="toggle(s.tlds, t)"
                        >
                            .{{ t }}
                            <X v-if="s.custom.includes(t)" class="size-3 opacity-70 hover:opacity-100" :aria-label="`Remove .${t}`" @click.stop="removeCustom(t)" />
                        </button>
                        <input v-model="newTld" class="input h-7 w-28! px-2! py-0! font-mono text-xs!" placeholder="+ add TLD" aria-label="Add a TLD" @keydown.enter.prevent="addTld" @blur="addTld" />
                    </div>
                    <button type="button" class="mt-2 inline-flex items-center gap-1 text-xs font-medium text-fg-subtle hover:text-fg" :aria-expanded="showMore" @click="showMore = !showMore">
                        <component :is="showMore ? ChevronDown : ChevronRight" class="size-3.5" />{{ showMore ? "Fewer TLDs" : `More TLDs (${moreCount})` }}
                    </button>
                    <div v-if="showMore" class="mt-2 flex flex-col gap-3 rounded-lg bg-subtle/60 p-3 ring-1 ring-line">
                        <input v-model="tldFilter" class="input h-8! py-0! text-xs!" placeholder="Filter TLDs…" aria-label="Filter TLDs" spellcheck="false" />
                        <div v-for="g in filteredGroups" :key="g.name">
                            <span class="mb-1.5 flex items-center justify-between text-xs font-medium text-fg-subtle">
                                {{ g.name }}
                                <button type="button" class="font-normal hover:text-fg" @click="toggleGroup(g.tlds)">{{ g.tlds.every((t) => s.tlds.includes(t)) ? "Deselect all" : "Select all" }}</button>
                            </span>
                            <div class="flex flex-wrap gap-1.5">
                                <button
                                    v-for="t in g.tlds"
                                    :key="t"
                                    type="button"
                                    class="rounded-full px-2.5 py-1 font-mono text-xs ring-1 transition-colors"
                                    :class="s.tlds.includes(t) ? 'bg-inverse text-inverse-fg ring-transparent' : 'bg-surface text-fg-subtle ring-line hover:text-fg'"
                                    :aria-pressed="s.tlds.includes(t)"
                                    @click="toggle(s.tlds, t)"
                                >.{{ t }}</button>
                            </div>
                        </div>
                        <p v-if="!filteredGroups.length" class="text-xs text-muted">No match. Type it in "+ add TLD" to use any TLD.</p>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-fg">
                    <label class="inline-flex items-center gap-2"><input v-model="s.variations" type="checkbox" class="checkbox" />Suggest variations</label>
                    <label class="inline-flex items-center gap-2"><input v-model="s.hyphenate" type="checkbox" class="checkbox" />Hyphenated versions</label>
                </div>

                <div v-if="s.variations" class="grid gap-4 sm:grid-cols-[1fr_1fr_10rem]">
                    <div>
                        <span class="label">Prefixes</span>
                        <div class="flex flex-wrap gap-1.5">
                            <button v-for="p in PREFIXES" :key="p" type="button" class="rounded-full px-2.5 py-0.5 text-xs ring-1" :class="s.prefixes.includes(p) ? 'bg-accent-soft text-fg ring-accent/40' : 'text-fg-subtle ring-line hover:text-fg'" :aria-pressed="s.prefixes.includes(p)" @click="toggle(s.prefixes, p)">{{ p }}…</button>
                        </div>
                    </div>
                    <div>
                        <span class="label">Suffixes</span>
                        <div class="flex flex-wrap gap-1.5">
                            <button v-for="x in SUFFIXES" :key="x" type="button" class="rounded-full px-2.5 py-0.5 text-xs ring-1" :class="s.suffixes.includes(x) ? 'bg-accent-soft text-fg ring-accent/40' : 'text-fg-subtle ring-line hover:text-fg'" :aria-pressed="s.suffixes.includes(x)" @click="toggle(s.suffixes, x)">…{{ x }}</button>
                        </div>
                    </div>
                    <Field label="Variations on">
                        <select v-model="s.variationTld" class="select font-mono">
                            <option v-for="t in allTlds" :key="t" :value="t">.{{ t }}</option>
                        </select>
                    </Field>
                </div>
                <p v-if="preview.length > MAX" class="text-xs text-warn">That makes {{ preview.length }} domains; only the first {{ MAX }} will be checked.</p>
            </form>
        </Panel>

        <Panel v-if="rows.length" flush>
            <template #title>
                <span class="inline-flex flex-wrap items-center gap-2">
                    Results
                    <span class="chip">{{ counts.available }} available</span>
                    <span class="chip">{{ counts.taken }} taken</span>
                    <span v-if="counts.pending" class="chip"><Loader2 class="size-3 animate-spin" />{{ counts.pending }} left</span>
                </span>
            </template>
            <template #actions>
                <div class="flex rounded-md bg-subtle p-0.5 text-xs ring-1 ring-line" role="group" aria-label="Filter results">
                    <button v-for="f in (['all', 'available', 'taken'] as const)" :key="f" type="button" class="rounded px-2 py-1 capitalize" :class="filter === f ? 'bg-surface text-fg shadow-input' : 'text-fg-subtle hover:text-fg'" :aria-pressed="filter === f" @click="filter = f">{{ f }}</button>
                </div>
                <CopyButton :text="availableText" label="Copy available" size="sm" />
            </template>

            <div v-for="g in groups" :key="g.id">
                <h4 class="border-b border-line bg-subtle/60 px-4 py-1.5 text-xs font-medium tracking-wide text-fg-subtle uppercase">{{ g.title }}</h4>
                <ul class="divide-y divide-line">
                    <li v-for="r in g.rows" :key="r.domain" class="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
                        <span class="min-w-0 flex-1 basis-48 font-mono text-sm break-all text-fg">{{ r.domain }}</span>
                        <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" :class="STATUS[r.status].cls" :title="r.note">
                            <component :is="STATUS[r.status].icon" class="size-3.5" :class="r.status === 'checking' && 'animate-spin'" />{{ STATUS[r.status].label }}
                        </span>
                        <span class="w-full text-xs text-muted sm:w-auto sm:min-w-56 sm:flex-none">
                            <template v-if="r.status === 'taken'">
                                <template v-if="r.registrar">{{ r.registrar }}</template><template v-if="r.expires"><template v-if="r.registrar"> · </template>expires {{ fmtDate(r.expires) }}</template>
                                <template v-if="!r.registrar && !r.expires">Registered ({{ r.source }})</template>
                            </template>
                            <template v-else-if="r.status === 'available'">No registry record (RDAP)</template>
                            <template v-else>{{ r.note }}</template>
                        </span>
                        <span class="flex items-center gap-1">
                            <a v-if="r.status === 'available' || r.status === 'likely'" :href="REGISTRARS[s.registrar].url(r.domain)" target="_blank" rel="noopener noreferrer" class="inline-flex h-7 items-center gap-1 rounded-md bg-inverse px-2 text-xs font-semibold text-inverse-fg hover:opacity-90">Register<ExternalLink class="size-3" /></a>
                            <Btn v-else-if="r.status === 'taken'" size="sm" variant="ghost" @click="whois(r.domain)">WHOIS</Btn>
                            <Btn v-else-if="r.status === 'error'" size="sm" variant="ghost" @click="recheck(r)"><RotateCw />Retry</Btn>
                            <CopyButton :text="r.domain" icon-only size="sm" />
                        </span>
                    </li>
                </ul>
            </div>
            <p v-if="!groups.length" class="px-4 py-6 text-center text-sm text-muted">No {{ filter }} domains yet.</p>
            <div class="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-2 text-xs text-muted">
                Register links open
                <select v-model="s.registrar" class="select h-7! w-auto! py-0! text-xs!" aria-label="Registrar">
                    <option v-for="(r, id) in REGISTRARS" :key="id" :value="id">{{ r.name }}</option>
                </select>
            </div>
        </Panel>

        <Notice type="info">
            Checks run from your browser: DNS over HTTPS (Cloudflare) and the TLD registry's RDAP server. "Available" means the registry has no record; "likely available" means the TLD has no public RDAP, so only DNS was checked. Premium and reserved names can still show as available, so the registrar has the final word on price and availability. Nothing you type is sent to a registrar until you click Register.
        </Notice>
    </ToolPage>
</template>
