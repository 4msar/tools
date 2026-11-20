<script setup lang="ts">
import { computed, ref } from "vue";
import { useStorage } from "@vueuse/core";
import { Download, Plus, Trash2, Upload } from "lucide-vue-next";
import {
    Btn,
    CodeArea,
    CopyButton,
    Field,
    Notice,
    Panel,
    Tabs,
    ToolPage,
} from "@/components/ui";

const mode = useStorage<"robots" | "sitemap">("tools:robots:mode", "robots");

// ================= robots.txt =================
interface RRule {
    type: "Allow" | "Disallow";
    path: string;
}
interface Group {
    id: number;
    agents: string;
    rules: RRule[];
    crawlDelay: string;
}

const AI_BOTS = [
    "GPTBot",
    "ChatGPT-User",
    "OAI-SearchBot",
    "ClaudeBot",
    "anthropic-ai",
    "Claude-Web",
    "Google-Extended",
    "CCBot",
    "PerplexityBot",
    "Bytespider",
    "Applebot-Extended",
    "meta-externalagent",
    "Amazonbot",
];

let uid = 1;
const mk = (agents: string, rules: RRule[] = [], crawlDelay = ""): Group => ({
    id: uid++,
    agents,
    rules,
    crawlDelay,
});

const groups = ref<Group[]>([mk("*", [{ type: "Disallow", path: "" }])]);
const sitemaps = ref<string[]>([""]);
const host = ref("");

function presetAllow() {
    groups.value = [mk("*", [{ type: "Disallow", path: "" }])];
}
function presetBlock() {
    groups.value = [mk("*", [{ type: "Disallow", path: "/" }])];
}
function presetAi() {
    groups.value = [
        ...groups.value.filter((g) => g.agents.trim() !== AI_BOTS.join(", ")),
        mk(AI_BOTS.join(", "), [{ type: "Disallow", path: "/" }]),
    ];
}
function presetCms() {
    const star = groups.value.find((g) =>
        g.agents
            .split(",")
            .map((a) => a.trim())
            .includes("*"),
    );
    const rules: RRule[] = [
        { type: "Disallow", path: "/wp-admin/" },
        { type: "Allow", path: "/wp-admin/admin-ajax.php" },
    ];
    if (star) {
        star.rules = star.rules.filter((r) => r.path !== "");
        for (const r of rules)
            if (!star.rules.some((x) => x.type === r.type && x.path === r.path))
                star.rules.push(r);
    } else groups.value.push(mk("*", rules));
}
function addGroup() {
    groups.value.push(mk("*", [{ type: "Disallow", path: "" }]));
}
function removeGroup(id: number) {
    groups.value = groups.value.filter((g) => g.id !== id);
}

const agentList = (g: Group) =>
    g.agents
        .split(/[,\n]/)
        .map((a) => a.trim())
        .filter(Boolean);

const robotsOut = computed(() => {
    const blocks: string[] = [];
    for (const g of groups.value) {
        const agents = agentList(g);
        if (!agents.length) continue;
        const lines = agents.map((a) => `User-agent: ${a}`);
        for (const r of g.rules)
            lines.push(`${r.type}: ${r.path.trim()}`.trimEnd());
        if (g.crawlDelay.trim())
            lines.push(`Crawl-delay: ${g.crawlDelay.trim()}`);
        blocks.push(lines.join("\n"));
    }
    const tail: string[] = [];
    if (host.value.trim()) tail.push(`Host: ${host.value.trim()}`);
    for (const s of sitemaps.value)
        if (s.trim()) tail.push(`Sitemap: ${s.trim()}`);
    if (tail.length) blocks.push(tail.join("\n"));
    return blocks.join("\n\n") + (blocks.length ? "\n" : "");
});

function download(name: string, text: string, type = "text/plain") {
    const url = URL.createObjectURL(
        new Blob([text], { type: `${type};charset=utf-8` }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Import
const importText = ref("");
const importMsg = ref("");
function runImport() {
    const gs: Group[] = [];
    const sm: string[] = [];
    let h = "";
    let cur: Group | null = null;
    let lastWasAgent = false;
    for (const rawLine of importText.value.split(/\r?\n/)) {
        const line = rawLine.replace(/#.*$/, "").trim();
        if (!line) continue;
        const i = line.indexOf(":");
        if (i < 0) continue;
        const key = line.slice(0, i).trim().toLowerCase();
        const val = line.slice(i + 1).trim();
        if (key === "user-agent") {
            if (cur && lastWasAgent) cur.agents += `, ${val}`;
            else {
                cur = mk(val);
                gs.push(cur);
            }
            lastWasAgent = true;
            continue;
        }
        lastWasAgent = false;
        if (key === "sitemap") sm.push(val);
        else if (key === "host") h = val;
        else if (cur && (key === "allow" || key === "disallow"))
            cur.rules.push({
                type: key === "allow" ? "Allow" : "Disallow",
                path: val,
            });
        else if (cur && key === "crawl-delay") cur.crawlDelay = val;
    }
    if (!gs.length && !sm.length && !h) {
        importMsg.value = "No robots.txt directives found.";
        return;
    }
    groups.value = gs;
    sitemaps.value = sm.length ? sm : [""];
    host.value = h;
    importMsg.value = `Imported ${gs.length} group${gs.length === 1 ? "" : "s"} and ${sm.length} sitemap${sm.length === 1 ? "" : "s"}.`;
}

// Tester
const testPath = ref("/wp-admin/admin-ajax.php");
const testAgent = ref("Googlebot");

function patternToRegex(p: string): RegExp {
    const anchored = p.endsWith("$");
    const body = (anchored ? p.slice(0, -1) : p)
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*");
    return new RegExp(`^${body}${anchored ? "$" : ""}`);
}
const testResult = computed(() => {
    let path = testPath.value.trim();
    if (!path) return null;
    try {
        if (/^https?:\/\//i.test(path)) {
            const u = new URL(path);
            path = u.pathname + u.search;
        }
    } catch {
        /* keep as is */
    }
    if (!path.startsWith("/")) path = "/" + path;
    const ua = testAgent.value.trim().toLowerCase() || "*";
    // pick most specific matching agent token
    let bestLen = -1;
    let bestToken = "";
    for (const g of groups.value) {
        for (const a of agentList(g)) {
            const t = a.toLowerCase();
            if (t === "*") continue;
            if (ua.includes(t) && t.length > bestLen) {
                bestLen = t.length;
                bestToken = t;
            }
        }
    }
    const token = bestLen >= 0 ? bestToken : "*";
    const matched = groups.value.filter((g) =>
        agentList(g).some((a) => a.toLowerCase() === token),
    );
    if (!matched.length)
        return {
            allowed: true,
            rule: null as RRule | null,
            group: "",
            note: "No group applies to this user-agent: everything is allowed.",
        };
    let best: RRule | null = null;
    for (const g of matched) {
        for (const r of g.rules) {
            const pat = r.path.trim();
            if (!pat) continue;
            if (!patternToRegex(pat).test(path)) continue;
            if (
                !best ||
                pat.length > best.path.trim().length ||
                (pat.length === best.path.trim().length &&
                    r.type === "Allow" &&
                    best.type !== "Allow")
            )
                best = r;
        }
    }
    const groupLabel = token === "*" ? "*" : token;
    if (!best)
        return {
            allowed: true,
            rule: null as RRule | null,
            group: groupLabel,
            note: `No rule in the "${groupLabel}" group matches: allowed.`,
        };
    return {
        allowed: best.type === "Allow",
        rule: best,
        group: groupLabel,
        note: "",
    };
});

// ================= Sitemap =================
const CHANGEFREQ = [
    "always",
    "hourly",
    "daily",
    "weekly",
    "monthly",
    "yearly",
    "never",
];
const PRIORITIES = [
    "1.0",
    "0.9",
    "0.8",
    "0.7",
    "0.6",
    "0.5",
    "0.4",
    "0.3",
    "0.2",
    "0.1",
    "0.0",
];
const MAX_URLS = 50000;
const today = new Date().toISOString().slice(0, 10);

const baseUrl = useStorage("tools:sitemap:base", "https://msar.me");
const urlsText = useStorage(
    "tools:sitemap:urls",
    "/\n/about\n/blog\nhttps://msar.me/contact",
);
const lastmodMode = useStorage<"today" | "none" | "custom">(
    "tools:sitemap:lastmod",
    "today",
);
const customDate = ref(today);
const defFreq = useStorage("tools:sitemap:freq", "weekly");
const defPriority = useStorage("tools:sitemap:priority", "0.5");
const forceIndex = ref(false);
const overrides = ref<
    Record<string, { lastmod?: string; changefreq?: string; priority?: string }>
>({});
const fileSel = ref(0);

const parsed = computed(() => {
    let base: URL | null = null;
    try {
        base = baseUrl.value.trim() ? new URL(baseUrl.value.trim()) : null;
        if (base && !/^https?:$/.test(base.protocol)) base = null;
    } catch {
        base = null;
    }
    const urls: string[] = [];
    const seen = new Set<string>();
    const warnings: string[] = [];
    let dupes = 0;
    urlsText.value.split(/\r?\n/).forEach((raw, idx) => {
        const line = raw.trim();
        if (!line) return;
        let full = "";
        try {
            const u = /^[a-z][a-z0-9+.-]*:/i.test(line)
                ? new URL(line)
                : base
                  ? new URL(line, base)
                  : null;
            if (!u) throw new Error("no base");
            if (!/^https?:$/.test(u.protocol)) throw new Error("scheme");
            u.hash = "";
            full = u.toString();
        } catch {
            warnings.push(
                `Line ${idx + 1}: "${line.length > 60 ? line.slice(0, 60) + "…" : line}" is not a valid http(s) URL${base ? "" : " (set a valid base URL for relative paths)"}.`,
            );
            return;
        }
        if (seen.has(full)) {
            dupes++;
            return;
        }
        seen.add(full);
        urls.push(full);
    });
    if (dupes)
        warnings.push(
            `${dupes} duplicate URL${dupes === 1 ? "" : "s"} removed.`,
        );
    return { urls, warnings, base };
});

const useIndex = computed(
    () => forceIndex.value || parsed.value.urls.length > MAX_URLS,
);
const chunks = computed(() => {
    const out: string[][] = [];
    for (let i = 0; i < parsed.value.urls.length; i += MAX_URLS)
        out.push(parsed.value.urls.slice(i, i + MAX_URLS));
    return out;
});

const esc = (s: string) =>
    s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
const defaultLastmod = computed(() =>
    lastmodMode.value === "today"
        ? today
        : lastmodMode.value === "custom"
          ? customDate.value
          : "",
);

function urlset(urls: string[]): string {
    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ];
    for (const u of urls) {
        const o = overrides.value[u] ?? {};
        const lm = o.lastmod ?? defaultLastmod.value;
        const cf = o.changefreq ?? defFreq.value;
        const pr = o.priority ?? defPriority.value;
        lines.push("  <url>", `    <loc>${esc(u)}</loc>`);
        if (lm) lines.push(`    <lastmod>${esc(lm)}</lastmod>`);
        if (cf) lines.push(`    <changefreq>${esc(cf)}</changefreq>`);
        if (pr) lines.push(`    <priority>${esc(pr)}</priority>`);
        lines.push("  </url>");
    }
    lines.push("</urlset>");
    return lines.join("\n") + "\n";
}

const origin = computed(() => {
    if (parsed.value.base) return parsed.value.base.origin;
    try {
        return parsed.value.urls[0]
            ? new URL(parsed.value.urls[0]).origin
            : "https://msar.me";
    } catch {
        return "https://msar.me";
    }
});
const files = computed<{ name: string; content: string }[]>(() => {
    if (!parsed.value.urls.length) return [];
    if (!useIndex.value)
        return [{ name: "sitemap.xml", content: urlset(parsed.value.urls) }];
    const lm = defaultLastmod.value;
    const idx = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ];
    chunks.value.forEach((_, i) => {
        idx.push(
            "  <sitemap>",
            `    <loc>${esc(`${origin.value}/sitemap-${i + 1}.xml`)}</loc>`,
        );
        if (lm) idx.push(`    <lastmod>${esc(lm)}</lastmod>`);
        idx.push("  </sitemap>");
    });
    idx.push("</sitemapindex>");
    return [
        { name: "sitemap.xml", content: idx.join("\n") + "\n" },
        ...chunks.value.map((c, i) => ({
            name: `sitemap-${i + 1}.xml`,
            content: urlset(c),
        })),
    ];
});
const fileOptions = computed(() =>
    files.value.map((f, i) => ({
        value: i,
        label: i === 0 && useIndex.value ? "index" : f.name,
    })),
);
const currentFile = computed(
    () => files.value[Math.min(fileSel.value, files.value.length - 1)],
);

const TABLE_LIMIT = 200;
const tableUrls = computed(() => parsed.value.urls.slice(0, TABLE_LIMIT));
function setOverride(
    u: string,
    key: "lastmod" | "changefreq" | "priority",
    val: string,
) {
    const cur = { ...(overrides.value[u] ?? {}) };
    if (val === "__default") delete cur[key];
    else cur[key] = val;
    overrides.value = { ...overrides.value, [u]: cur };
}
function downloadAll() {
    files.value.forEach((f, i) =>
        setTimeout(
            () => download(f.name, f.content, "application/xml"),
            i * 250,
        ),
    );
}
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs
                v-model="mode"
                :options="[
                    { value: 'robots', label: 'robots.txt' },
                    { value: 'sitemap', label: 'Sitemap' },
                ]"
            />
        </template>

        <!-- robots.txt -->
        <template v-if="mode === 'robots'">
            <div class="grid gap-4 lg:grid-cols-2">
                <div class="min-w-0 space-y-4">
                    <Panel title="Presets">
                        <div class="flex flex-wrap gap-2">
                            <Btn size="sm" @click="presetAllow">Allow all</Btn>
                            <Btn size="sm" @click="presetBlock">Block all</Btn>
                            <Btn size="sm" @click="presetAi"
                                >Block AI crawlers</Btn
                            >
                            <Btn size="sm" @click="presetCms"
                                >Common CMS (WordPress)</Btn
                            >
                        </div>
                    </Panel>

                    <Panel
                        v-for="(g, gi) in groups"
                        :key="g.id"
                        :title="`Group ${gi + 1}`"
                    >
                        <template #actions>
                            <Btn
                                size="sm"
                                variant="ghost"
                                title="Remove group"
                                @click="removeGroup(g.id)"
                                ><Trash2
                            /></Btn>
                        </template>
                        <div class="space-y-3">
                            <Field
                                label="User-agent(s)"
                                hint="Comma-separated; one User-agent line each."
                            >
                                <input
                                    v-model="g.agents"
                                    class="input font-mono"
                                    spellcheck="false"
                                    placeholder="*"
                                />
                            </Field>
                            <div class="space-y-2">
                                <div
                                    v-for="(r, ri) in g.rules"
                                    :key="ri"
                                    class="flex gap-2"
                                >
                                    <select
                                        v-model="r.type"
                                        class="select !w-32 shrink-0"
                                        aria-label="Rule type"
                                    >
                                        <option>Allow</option>
                                        <option>Disallow</option>
                                    </select>
                                    <input
                                        v-model="r.path"
                                        class="input min-w-0 font-mono"
                                        spellcheck="false"
                                        placeholder="/path/ (empty Disallow = allow all)"
                                    />
                                    <Btn
                                        variant="ghost"
                                        title="Remove rule"
                                        @click="g.rules.splice(ri, 1)"
                                        ><Trash2
                                    /></Btn>
                                </div>
                                <Btn
                                    size="sm"
                                    @click="
                                        g.rules.push({
                                            type: 'Disallow',
                                            path: '',
                                        })
                                    "
                                    ><Plus />Add rule</Btn
                                >
                            </div>
                            <Field label="Crawl-delay (seconds, optional)">
                                <input
                                    v-model="g.crawlDelay"
                                    class="input font-mono sm:w-40"
                                    inputmode="numeric"
                                    placeholder="e.g. 10"
                                />
                            </Field>
                        </div>
                    </Panel>
                    <Btn @click="addGroup"><Plus />Add group</Btn>

                    <Panel title="Sitemaps and host">
                        <div class="space-y-3">
                            <div class="space-y-2">
                                <span class="label">Sitemap URLs</span>
                                <div
                                    v-for="(_, si) in sitemaps"
                                    :key="si"
                                    class="flex gap-2"
                                >
                                    <input
                                        v-model="sitemaps[si]"
                                        class="input min-w-0 font-mono"
                                        spellcheck="false"
                                        placeholder="https://msar.me/sitemap.xml"
                                    />
                                    <Btn
                                        variant="ghost"
                                        title="Remove"
                                        @click="
                                            sitemaps.length > 1
                                                ? sitemaps.splice(si, 1)
                                                : (sitemaps[0] = '')
                                        "
                                        ><Trash2
                                    /></Btn>
                                </div>
                                <Btn size="sm" @click="sitemaps.push('')"
                                    ><Plus />Add sitemap</Btn
                                >
                            </div>
                            <Field label="Host (optional, Yandex only)">
                                <input
                                    v-model="host"
                                    class="input font-mono"
                                    spellcheck="false"
                                    placeholder="example.com"
                                />
                            </Field>
                        </div>
                    </Panel>
                </div>

                <div class="min-w-0 space-y-4">
                    <Panel title="robots.txt" flush>
                        <template #actions>
                            <CopyButton :text="robotsOut" label="Copy" />
                            <Btn
                                size="sm"
                                variant="ghost"
                                :disabled="!robotsOut"
                                @click="download('robots.txt', robotsOut)"
                                ><Download />Download</Btn
                            >
                        </template>
                        <CodeArea
                            :model-value="robotsOut"
                            readonly
                            height="18rem"
                            :wrap="false"
                        />
                    </Panel>

                    <Panel title="Test a URL">
                        <div class="space-y-3">
                            <div class="grid gap-2 sm:grid-cols-2">
                                <Field label="Path or URL"
                                    ><input
                                        v-model="testPath"
                                        class="input font-mono"
                                        spellcheck="false"
                                        placeholder="/private/page.html"
                                /></Field>
                                <Field label="User-agent"
                                    ><input
                                        v-model="testAgent"
                                        class="input font-mono"
                                        spellcheck="false"
                                        placeholder="Googlebot"
                                /></Field>
                            </div>
                            <template v-if="testResult">
                                <div
                                    class="flex flex-wrap items-center gap-2 text-sm"
                                >
                                    <span
                                        class="rounded px-2 py-0.5 text-xs font-semibold"
                                        :class="
                                            testResult.allowed
                                                ? 'bg-accent-soft text-accent-strong dark:text-accent'
                                                : 'bg-danger-soft text-danger'
                                        "
                                        >{{
                                            testResult.allowed
                                                ? "ALLOWED"
                                                : "BLOCKED"
                                        }}</span
                                    >
                                    <span
                                        v-if="testResult.group"
                                        class="text-muted"
                                        >group
                                        <code class="code">{{
                                            testResult.group
                                        }}</code></span
                                    >
                                </div>
                                <p v-if="testResult.rule" class="text-sm">
                                    Matched rule:
                                    <code class="code"
                                        >{{ testResult.rule.type }}:
                                        {{ testResult.rule.path }}</code
                                    >
                                </p>
                                <p
                                    v-if="testResult.note"
                                    class="text-sm text-muted"
                                >
                                    {{ testResult.note }}
                                </p>
                            </template>
                            <p class="text-xs text-muted">
                                Google rules: the longest matching path wins,
                                Allow wins ties, <code class="code">*</code> is
                                a wildcard and
                                <code class="code">$</code> anchors the end.
                            </p>
                        </div>
                    </Panel>

                    <Panel title="Import existing robots.txt">
                        <div class="space-y-3">
                            <textarea
                                v-model="importText"
                                class="input min-h-32 font-mono text-[13px]"
                                spellcheck="false"
                                placeholder="Paste a robots.txt here…"
                            />
                            <div class="flex flex-wrap items-center gap-3">
                                <Btn
                                    size="sm"
                                    :disabled="!importText.trim()"
                                    @click="runImport"
                                    ><Upload />Import</Btn
                                >
                                <span
                                    v-if="importMsg"
                                    class="text-sm text-muted"
                                    >{{ importMsg }}</span
                                >
                            </div>
                        </div>
                    </Panel>
                </div>
            </div>
        </template>

        <!-- Sitemap -->
        <template v-else>
            <div class="grid gap-4 lg:grid-cols-2">
                <Panel title="URLs">
                    <div class="space-y-3">
                        <Field
                            label="Base URL"
                            hint="Used to resolve relative paths."
                        >
                            <input
                                v-model="baseUrl"
                                class="input font-mono"
                                spellcheck="false"
                                placeholder="https://msar.me"
                            />
                        </Field>
                        <Field label="URLs or paths (one per line)">
                            <textarea
                                v-model="urlsText"
                                class="input min-h-40 font-mono text-[13px]"
                                spellcheck="false"
                                placeholder="/about&#10;/blog/post-1&#10;https://msar.me/contact"
                            />
                        </Field>
                        <div class="grid gap-3 sm:grid-cols-2">
                            <Field label="Default lastmod">
                                <select v-model="lastmodMode" class="select">
                                    <option value="today">Today</option>
                                    <option value="none">None</option>
                                    <option value="custom">Custom date</option>
                                </select>
                            </Field>
                            <Field v-if="lastmodMode === 'custom'" label="Date"
                                ><input
                                    v-model="customDate"
                                    type="date"
                                    class="input"
                            /></Field>
                            <Field label="Default changefreq">
                                <select v-model="defFreq" class="select">
                                    <option value="">None</option>
                                    <option
                                        v-for="c in CHANGEFREQ"
                                        :key="c"
                                        :value="c"
                                    >
                                        {{ c }}
                                    </option>
                                </select>
                            </Field>
                            <Field label="Default priority">
                                <select v-model="defPriority" class="select">
                                    <option value="">None</option>
                                    <option
                                        v-for="p in PRIORITIES"
                                        :key="p"
                                        :value="p"
                                    >
                                        {{ p }}
                                    </option>
                                </select>
                            </Field>
                        </div>
                        <label
                            class="flex cursor-pointer items-center gap-2 text-sm"
                            ><input
                                v-model="forceIndex"
                                type="checkbox"
                                class="checkbox"
                            />
                            Generate a sitemap index (split files)</label
                        >
                    </div>
                </Panel>

                <div class="min-w-0 space-y-4">
                    <Panel title="Output" flush>
                        <template #actions>
                            <span class="mr-1 text-xs text-muted"
                                >{{ parsed.urls.length.toLocaleString() }} URL{{
                                    parsed.urls.length === 1 ? "" : "s"
                                }}</span
                            >
                            <CopyButton
                                :text="currentFile?.content ?? ''"
                                label="Copy"
                            />
                            <Btn
                                size="sm"
                                variant="ghost"
                                :disabled="!currentFile"
                                @click="
                                    currentFile &&
                                    download(
                                        currentFile.name,
                                        currentFile.content,
                                        'application/xml',
                                    )
                                "
                                ><Download />Download</Btn
                            >
                            <Btn
                                v-if="files.length > 1"
                                size="sm"
                                variant="ghost"
                                @click="downloadAll"
                                ><Download />All ({{ files.length }})</Btn
                            >
                        </template>
                        <div
                            v-if="files.length > 1"
                            class="border-b border-line p-3"
                        >
                            <Tabs
                                v-model="fileSel"
                                :options="fileOptions"
                                size="sm"
                            />
                        </div>
                        <CodeArea
                            :model-value="currentFile?.content ?? ''"
                            readonly
                            height="20rem"
                            :wrap="false"
                        />
                    </Panel>
                    <Notice
                        v-if="useIndex && parsed.urls.length > MAX_URLS"
                        type="info"
                        >More than {{ MAX_URLS.toLocaleString() }} URLs: split
                        into {{ chunks.length }} sitemap files plus an index.
                        Upload each file to {{ origin }}/.</Notice
                    >
                    <Notice
                        v-for="(w, i) in parsed.warnings.slice(0, 8)"
                        :key="i"
                        type="warning"
                        >{{ w }}</Notice
                    >
                    <Notice v-if="parsed.warnings.length > 8" type="warning"
                        >…and {{ parsed.warnings.length - 8 }} more
                        warnings.</Notice
                    >
                </div>
            </div>

            <Panel v-if="tableUrls.length" title="Per-URL overrides">
                <div class="overflow-x-auto rounded-md border border-line">
                    <table class="w-full min-w-[40rem] text-left text-sm">
                        <thead class="bg-subtle text-xs text-muted">
                            <tr>
                                <th class="px-3 py-1.5 font-medium">URL</th>
                                <th class="px-3 py-1.5 font-medium">lastmod</th>
                                <th class="px-3 py-1.5 font-medium">
                                    changefreq
                                </th>
                                <th class="px-3 py-1.5 font-medium">
                                    priority
                                </th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-line">
                            <tr v-for="u in tableUrls" :key="u">
                                <td
                                    class="max-w-72 px-3 py-1.5 font-mono text-[13px] break-all"
                                >
                                    {{ u }}
                                </td>
                                <td class="px-3 py-1.5">
                                    <input
                                        type="date"
                                        class="input !py-1 text-xs"
                                        :value="
                                            overrides[u]?.lastmod ??
                                            defaultLastmod
                                        "
                                        @change="
                                            setOverride(
                                                u,
                                                'lastmod',
                                                (
                                                    $event.target as HTMLInputElement
                                                ).value || '__default',
                                            )
                                        "
                                    />
                                </td>
                                <td class="px-3 py-1.5">
                                    <select
                                        class="select !py-1 text-xs"
                                        :value="
                                            overrides[u]?.changefreq ??
                                            '__default'
                                        "
                                        @change="
                                            setOverride(
                                                u,
                                                'changefreq',
                                                (
                                                    $event.target as HTMLSelectElement
                                                ).value,
                                            )
                                        "
                                    >
                                        <option value="__default">
                                            Default{{
                                                defFreq ? ` (${defFreq})` : ""
                                            }}
                                        </option>
                                        <option
                                            v-for="c in CHANGEFREQ"
                                            :key="c"
                                            :value="c"
                                        >
                                            {{ c }}
                                        </option>
                                    </select>
                                </td>
                                <td class="px-3 py-1.5">
                                    <select
                                        class="select !py-1 text-xs"
                                        :value="
                                            overrides[u]?.priority ??
                                            '__default'
                                        "
                                        @change="
                                            setOverride(
                                                u,
                                                'priority',
                                                (
                                                    $event.target as HTMLSelectElement
                                                ).value,
                                            )
                                        "
                                    >
                                        <option value="__default">
                                            Default{{
                                                defPriority
                                                    ? ` (${defPriority})`
                                                    : ""
                                            }}
                                        </option>
                                        <option
                                            v-for="p in PRIORITIES"
                                            :key="p"
                                            :value="p"
                                        >
                                            {{ p }}
                                        </option>
                                    </select>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p
                    v-if="parsed.urls.length > TABLE_LIMIT"
                    class="mt-2 text-xs text-muted"
                >
                    Showing the first {{ TABLE_LIMIT }} of
                    {{ parsed.urls.length.toLocaleString() }} URLs; the rest use
                    the defaults.
                </p>
            </Panel>
        </template>
    </ToolPage>
</template>
