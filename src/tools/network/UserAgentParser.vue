<script setup lang="ts">
import { computed, ref } from "vue";
import { Monitor, Trash2 } from "lucide-vue-next";
import Bowser from "bowser";
import { Btn, CodeArea, CopyButton, Notice, Panel, ToolPage } from "@/components/ui";

const mine = navigator.userAgent;
const ua = ref(mine);

const samples = [
    { label: "Chrome / Windows", v: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" },
    { label: "Safari / iPhone", v: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1" },
    { label: "Firefox / Linux", v: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0" },
    { label: "Edge / macOS", v: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0" },
    { label: "Chrome / Android", v: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36" },
    { label: "Googlebot", v: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
    { label: "curl", v: "curl/8.7.1" },
];

const BOTS: [RegExp, string][] = [
    [/googlebot/i, "Googlebot"], [/bingbot/i, "Bingbot"], [/duckduckbot/i, "DuckDuckBot"], [/yandex(bot)?/i, "YandexBot"], [/baiduspider/i, "Baiduspider"],
    [/gptbot/i, "GPTBot (OpenAI)"], [/claudebot|anthropic-ai/i, "ClaudeBot (Anthropic)"], [/perplexitybot/i, "PerplexityBot"], [/ccbot/i, "CCBot (Common Crawl)"],
    [/facebookexternalhit/i, "Facebook crawler"], [/twitterbot/i, "Twitterbot"], [/slackbot/i, "Slackbot"], [/linkedinbot/i, "LinkedInBot"],
    [/ahrefsbot/i, "AhrefsBot"], [/semrushbot/i, "SemrushBot"], [/headlesschrome/i, "Headless Chrome"],
    [/^curl\//i, "curl"], [/^wget\//i, "Wget"], [/python-requests/i, "Python requests"], [/^postmanruntime/i, "Postman"], [/axios\//i, "axios"],
    [/go-http-client/i, "Go http client"], [/okhttp/i, "OkHttp"], [/bot\b|crawler|spider/i, "Unknown bot or crawler"],
];

const info = computed(() => {
    const s = ua.value.trim();
    if (!s) return null;
    const r = Bowser.parse(s);
    const bot = BOTS.find(([re]) => re.test(s))?.[1] ?? "";
    const join = (...p: (string | undefined)[]) => p.filter(Boolean).join(" ") || "Unknown";
    const arch = /arm64|aarch64/i.test(s) ? "ARM64" : /x86_64|x64|win64|amd64/i.test(s) ? "x86-64" : /i[3-6]86|x86/i.test(s) ? "x86" : "";
    return {
        bot,
        rows: [
            { k: "Browser", v: join(r.browser.name, r.browser.version) },
            { k: "Rendering engine", v: join(r.engine.name, r.engine.version) },
            { k: "Operating system", v: join(r.os.name, r.os.versionName, r.os.version && r.os.version !== r.os.versionName ? `(${r.os.version})` : "") },
            { k: "Device type", v: bot ? "bot / script" : r.platform.type || "Unknown" },
            { k: "Device", v: join(r.platform.vendor, r.platform.model) },
            { k: "CPU architecture", v: arch || "Unknown" },
        ],
        json: JSON.stringify({ ...r, bot: bot || null, architecture: arch || null }, null, 2),
    };
});

// Split "Product/1.0 (comment) Product/2.0" into its tokens.
const tokens = computed(() => {
    const out: { product: string; comment: string }[] = [];
    const re = /([^\s()]+)(?:\s*\(([^)]*)\))?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(ua.value.trim()))) out.push({ product: m[1], comment: m[2] ?? "" });
    return out;
});
</script>

<template>
    <ToolPage>
        <Panel title="User agent string" flush>
            <template #actions>
                <Btn size="sm" variant="ghost" @click="ua = mine"><Monitor /> Mine</Btn>
                <Btn size="sm" variant="ghost" :disabled="!ua" @click="ua = ''"><Trash2 /> Clear</Btn>
            </template>
            <CodeArea v-model="ua" height="6rem" placeholder="Paste a User-Agent header…" />
            <div class="flex flex-wrap gap-1.5 border-t border-line p-3">
                <button v-for="s in samples" :key="s.label" type="button" class="chip cursor-pointer hover:border-line-strong hover:text-fg" @click="ua = s.v">{{ s.label }}</button>
            </div>
        </Panel>

        <template v-if="info">
            <Notice v-if="info.bot" type="warning">This looks like an automated client: {{ info.bot }}.</Notice>
            <div class="grid gap-4 lg:grid-cols-2">
                <Panel title="Details" flush>
                    <dl class="divide-y divide-line text-sm">
                        <div v-for="r in info.rows" :key="r.k" class="flex gap-3 px-4 py-2.5">
                            <dt class="w-40 shrink-0 text-muted">{{ r.k }}</dt>
                            <dd class="min-w-0 font-medium break-words" :class="r.v === 'Unknown' ? '!font-normal text-muted' : ''">{{ r.v }}</dd>
                        </div>
                    </dl>
                </Panel>
                <Panel title="JSON" flush>
                    <template #actions><CopyButton :text="info.json" /></template>
                    <CodeArea :model-value="info.json" readonly :wrap="false" height="16.5rem" />
                </Panel>
            </div>
            <Panel title="Tokens" flush>
                <ul class="divide-y divide-line text-sm">
                    <li v-for="(t, i) in tokens" :key="i" class="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2">
                        <code class="code">{{ t.product }}</code><span v-if="t.comment" class="min-w-0 font-mono text-xs break-all text-muted">{{ t.comment }}</span>
                    </li>
                </ul>
            </Panel>
        </template>
        <p class="text-xs text-muted">User agents can be spoofed and browsers now freeze parts of them (for example the macOS version), so treat the result as a hint.</p>
    </ToolPage>
</template>
