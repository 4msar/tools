<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { Plus, Send, Square, X } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Notice, Panel, Tabs, ToolPage } from "@/components/ui";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const method = ref("GET");
const url = ref("https://jsonplaceholder.typicode.com/posts/1");
interface Pair { on: boolean; k: string; v: string }
const headers = reactive<Pair[]>([{ on: true, k: "Accept", v: "application/json" }]);
const params = reactive<Pair[]>([]);
const bodyType = ref<"none" | "json" | "text" | "form">("json");
const body = ref('{\n  "title": "hello",\n  "body": "world",\n  "userId": 1\n}');
const reqTab = ref<"params" | "headers" | "body">("headers");
const resTab = ref<"body" | "headers">("body");

const hasBody = computed(() => !["GET", "HEAD"].includes(method.value) && bodyType.value !== "none");

const finalUrl = computed(() => {
    const raw = url.value.trim();
    if (!raw) return { url: "" };
    try {
        const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : "https://" + raw);
        if (!/^https?:$/.test(u.protocol)) return { url: "", error: "Only http and https URLs can be requested." };
        for (const p of params) if (p.on && p.k) u.searchParams.append(p.k, p.v);
        return { url: u.toString() };
    } catch {
        return { url: "", error: "That is not a valid URL." };
    }
});

const bodyError = computed(() => {
    if (!hasBody.value || bodyType.value !== "json" || !body.value.trim()) return "";
    try {
        JSON.parse(body.value);
        return "";
    } catch (e) {
        return (e as Error).message;
    }
});

const CONTENT_TYPES = { json: "application/json", text: "text/plain", form: "application/x-www-form-urlencoded" } as const;

function buildHeaders(): Record<string, string> {
    const h: Record<string, string> = {};
    for (const p of headers) if (p.on && p.k.trim()) h[p.k.trim()] = p.v;
    if (hasBody.value && bodyType.value !== "none" && !Object.keys(h).some((k) => k.toLowerCase() === "content-type")) h["Content-Type"] = CONTENT_TYPES[bodyType.value];
    return h;
}

const curl = computed(() => {
    if (!finalUrl.value.url) return "";
    const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
    const parts = [`curl -X ${method.value} ${q(finalUrl.value.url)}`];
    for (const [k, v] of Object.entries(buildHeaders())) parts.push(`  -H ${q(`${k}: ${v}`)}`);
    if (hasBody.value && body.value) parts.push(`  --data-raw ${q(body.value)}`);
    return parts.join(" \\\n");
});

interface Res { status: number; statusText: string; ms: number; size: number; headers: [string, string][]; body: string; type: string; isBinary: boolean; redirected: boolean; finalUrl: string }
const res = ref<Res | null>(null);
const error = ref("");
const loading = ref(false);
let controller: AbortController | null = null;

async function send() {
    if (loading.value) return controller?.abort();
    error.value = finalUrl.value.error ?? "";
    if (!finalUrl.value.url) return;
    loading.value = true;
    res.value = null;
    controller = new AbortController();
    const t0 = performance.now();
    try {
        const r = await fetch(finalUrl.value.url, {
            method: method.value,
            headers: buildHeaders(),
            body: hasBody.value ? body.value : undefined,
            signal: controller.signal,
            credentials: "omit",
            cache: "no-store",
            referrerPolicy: "no-referrer",
        });
        const buf = await r.arrayBuffer();
        const ms = Math.round(performance.now() - t0);
        const type = r.headers.get("content-type") ?? "";
        const isBinary = !!type && !/json|text|xml|javascript|html|csv|urlencoded|svg/i.test(type);
        let text = isBinary ? "" : new TextDecoder().decode(buf);
        if (/json/i.test(type) || /^\s*[[{]/.test(text)) {
            try {
                text = JSON.stringify(JSON.parse(text), null, 2);
            } catch {
                /* leave as received */
            }
        }
        res.value = { status: r.status, statusText: r.statusText, ms, size: buf.byteLength, headers: [...r.headers.entries()], body: text, type, isBinary, redirected: r.redirected, finalUrl: r.url };
    } catch (e) {
        const err = e as Error;
        error.value =
            err.name === "AbortError"
                ? "Request cancelled."
                : `The request failed: ${err.message}. In a browser this usually means the server does not allow cross-origin requests (CORS), the host is unreachable, or an http:// URL was blocked on an https:// page. The same request will work from curl.`;
    } finally {
        loading.value = false;
        controller = null;
    }
}

const statusClass = computed(() => {
    const s = res.value?.status ?? 0;
    return s >= 500 ? "text-danger" : s >= 400 ? "text-warning" : "text-success";
});
const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);
const resHeadersText = computed(() => res.value?.headers.map(([k, v]) => `${k}: ${v}`).join("\n") ?? "");

function formatBody() {
    try {
        body.value = JSON.stringify(JSON.parse(body.value), null, 2);
    } catch {
        /* shown by bodyError */
    }
}
</script>

<template>
    <ToolPage>
        <Panel>
            <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="send">
                <select v-model="method" class="select font-mono font-semibold sm:!w-32" aria-label="Method">
                    <option v-for="m in METHODS" :key="m">{{ m }}</option>
                </select>
                <input v-model="url" class="input font-mono" spellcheck="false" placeholder="https://api.example.com/items" aria-label="URL" />
                <Btn type="submit" :variant="loading ? 'danger' : 'primary'" class="shrink-0"><component :is="loading ? Square : Send" /> {{ loading ? "Cancel" : "Send" }}</Btn>
            </form>
            <p v-if="params.some((p) => p.on && p.k) && finalUrl.url" class="mt-2 font-mono text-xs break-all text-muted">{{ finalUrl.url }}</p>
        </Panel>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="Request" flush>
                <template #actions>
                    <Tabs v-model="reqTab" size="sm" :options="[{ value: 'params', label: `Query (${params.filter((p) => p.on && p.k).length})` }, { value: 'headers', label: `Headers (${headers.filter((p) => p.on && p.k).length})` }, { value: 'body', label: 'Body' }]" />
                </template>
                <div v-if="reqTab !== 'body'" class="flex flex-col gap-2 p-4">
                    <div v-for="(p, i) in reqTab === 'params' ? params : headers" :key="i" class="flex items-center gap-2">
                        <input v-model="p.on" type="checkbox" class="checkbox shrink-0" aria-label="Enabled" />
                        <input v-model="p.k" class="input font-mono" spellcheck="false" :placeholder="reqTab === 'params' ? 'name' : 'Header'" />
                        <input v-model="p.v" class="input font-mono" spellcheck="false" placeholder="value" />
                        <Btn size="sm" variant="ghost" aria-label="Remove" @click="(reqTab === 'params' ? params : headers).splice(i, 1)"><X /></Btn>
                    </div>
                    <div><Btn size="sm" @click="(reqTab === 'params' ? params : headers).push({ on: true, k: '', v: '' })"><Plus /> Add {{ reqTab === "params" ? "parameter" : "header" }}</Btn></div>
                    <p v-if="reqTab === 'headers'" class="text-xs text-muted">Browsers set some headers themselves (Host, Origin, Cookie, User-Agent) and ignore your values for them.</p>
                </div>
                <template v-else>
                    <div class="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2 text-sm">
                        <select v-model="bodyType" class="select !w-auto" aria-label="Body type">
                            <option value="none">No body</option><option value="json">JSON</option><option value="text">Plain text</option><option value="form">Form URL-encoded</option>
                        </select>
                        <Btn v-if="bodyType === 'json'" size="sm" variant="ghost" @click="formatBody">Format</Btn>
                        <span v-if="['GET', 'HEAD'].includes(method)" class="text-xs text-muted">{{ method }} requests are sent without a body.</span>
                        <span v-else-if="bodyError" class="text-xs text-danger">{{ bodyError }}</span>
                    </div>
                    <CodeArea v-if="bodyType !== 'none'" v-model="body" :wrap="false" height="14rem" :invalid="!!bodyError" :placeholder="bodyType === 'form' ? 'name=value&other=value' : 'Request body'" />
                </template>
            </Panel>

            <Panel flush>
                <template #title>
                    Response
                    <template v-if="res">
                        <span class="ml-2 font-mono" :class="statusClass">{{ res.status }} {{ res.statusText }}</span>
                        <span class="ml-2 text-xs font-normal text-muted">{{ res.ms }} ms · {{ fmtSize(res.size) }}</span>
                    </template>
                </template>
                <template v-if="res" #actions>
                    <Tabs v-model="resTab" size="sm" :options="[{ value: 'body', label: 'Body' }, { value: 'headers', label: `Headers (${res.headers.length})` }]" />
                    <CopyButton :text="resTab === 'body' ? res.body : resHeadersText" />
                </template>
                <div v-if="error" class="p-4"><Notice type="error">{{ error }}</Notice></div>
                <p v-else-if="loading" class="p-4 text-sm text-muted">Waiting for the response…</p>
                <p v-else-if="!res" class="p-4 text-sm text-muted">Press Send to make the request from your browser.</p>
                <template v-else>
                    <p v-if="res.redirected" class="border-b border-line px-4 py-2 text-xs text-muted">Redirected to <span class="font-mono break-all">{{ res.finalUrl }}</span></p>
                    <template v-if="resTab === 'body'">
                        <p v-if="res.isBinary" class="p-4 text-sm text-muted">Binary response ({{ res.type }}, {{ fmtSize(res.size) }}) is not shown.</p>
                        <p v-else-if="!res.body" class="p-4 text-sm text-muted">The response has no body.</p>
                        <CodeArea v-else :model-value="res.body" readonly :wrap="false" height="18rem" />
                    </template>
                    <dl v-else class="max-h-72 divide-y divide-line overflow-auto text-sm">
                        <div v-for="[k, v] in res.headers" :key="k" class="flex gap-3 px-4 py-2">
                            <dt class="w-40 shrink-0 font-mono text-xs text-muted">{{ k }}</dt><dd class="min-w-0 font-mono text-xs break-all">{{ v }}</dd>
                        </div>
                    </dl>
                </template>
            </Panel>
        </div>

        <Panel title="As cURL" flush>
            <template #actions><CopyButton :text="curl" /></template>
            <pre class="overflow-auto p-4 font-mono text-[13px]">{{ curl || "Enter a URL to build the command." }}</pre>
        </Panel>
        <p class="text-xs text-muted">Requests go straight from your browser to the URL, with no proxy and no cookies. Only APIs that allow cross-origin requests (CORS) can be read, and only the response headers the server exposes are visible.</p>
    </ToolPage>
</template>
