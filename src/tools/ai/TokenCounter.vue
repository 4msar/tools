<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from "vue";
import { ClipboardPaste, Trash2 } from "lucide-vue-next";
import { Btn, CodeArea, Field, Notice, Panel, ToolPage } from "@/components/ui";
import { readClipboard } from "@/composables/useClipboard";

type Tokenizer = typeof import("gpt-tokenizer/encoding/o200k_base");

interface ModelDef {
    id: string;
    name: string;
    family: "gpt" | "claude" | "gemini" | "llama";
    context: number;
    price: number; // default $ per 1M input tokens (editable)
    out: number; // default $ per 1M output tokens (editable)
}

const CHARS_PER_TOKEN = { claude: 3.5, gemini: 4, llama: 3.8 } as const;

const MODELS: ModelDef[] = [
    { id: "gpt-4o", name: "GPT-4o", family: "gpt", context: 128_000, price: 2.5, out: 10 },
    { id: "gpt-4o-mini", name: "GPT-4o mini", family: "gpt", context: 128_000, price: 0.15, out: 0.6 },
    { id: "gpt-4.1", name: "GPT-4.1", family: "gpt", context: 1_000_000, price: 2, out: 8 },
    { id: "o3", name: "OpenAI o3", family: "gpt", context: 200_000, price: 2, out: 8 },
    { id: "o4-mini", name: "OpenAI o4-mini", family: "gpt", context: 200_000, price: 1.1, out: 4.4 },
    { id: "claude-sonnet", name: "Claude Sonnet (estimate)", family: "claude", context: 200_000, price: 3, out: 15 },
    { id: "claude-opus", name: "Claude Opus (estimate)", family: "claude", context: 200_000, price: 15, out: 75 },
    { id: "claude-haiku", name: "Claude Haiku (estimate)", family: "claude", context: 200_000, price: 0.8, out: 4 },
    { id: "gemini-pro", name: "Gemini Pro (estimate)", family: "gemini", context: 1_000_000, price: 1.25, out: 10 },
    { id: "gemini-flash", name: "Gemini Flash (estimate)", family: "gemini", context: 1_000_000, price: 0.3, out: 2.5 },
    { id: "llama-3.1", name: "Llama 3.1 (estimate)", family: "llama", context: 128_000, price: 0.9, out: 0.9 },
];

const text = ref("");
const modelId = ref("gpt-4o");
const contextSize = ref(128_000);
const price = ref(2.5);
const outPrice = ref(10);
const outTokens = ref(500);
const requests = ref(1);
const showViz = ref(false);
const tokenizer = shallowRef<Tokenizer | null>(null);
const loadError = ref("");

const model = computed(() => MODELS.find((m) => m.id === modelId.value) ?? MODELS[0]);

watch(
    model,
    (m) => {
        contextSize.value = m.context;
        price.value = m.price;
        outPrice.value = m.out;
    },
    { immediate: true },
);

onMounted(async () => {
    try {
        tokenizer.value = await import("gpt-tokenizer/encoding/o200k_base");
    } catch {
        loadError.value = "Could not load the GPT tokenizer. GPT counts fall back to estimates.";
    }
});

const chars = computed(() => [...text.value].length);
const words = computed(() => (text.value.trim() ? text.value.trim().split(/\s+/).length : 0));

const gptTokens = computed(() => {
    if (!text.value) return 0;
    if (tokenizer.value) return tokenizer.value.countTokens(text.value, { allowedSpecial: "all" });
    return Math.ceil(text.value.length / 4);
});

function estimate(family: keyof typeof CHARS_PER_TOKEN) {
    return text.value ? Math.ceil(text.value.length / CHARS_PER_TOKEN[family]) : 0;
}

const rows = computed(() => [
    { name: "GPT-4o / o-series (o200k_base)", tokens: gptTokens.value, exact: !!tokenizer.value },
    { name: "Claude", tokens: estimate("claude"), exact: false },
    { name: "Gemini", tokens: estimate("gemini"), exact: false },
    { name: "Llama", tokens: estimate("llama"), exact: false },
]);

const tokens = computed(() => (model.value.family === "gpt" ? gptTokens.value : estimate(model.value.family)));
const isExact = computed(() => model.value.family === "gpt" && !!tokenizer.value);
const usage = computed(() => (contextSize.value > 0 ? (tokens.value / contextSize.value) * 100 : 0));
const cost = computed(() => (tokens.value / 1_000_000) * (Number(price.value) || 0));
const outCost = computed(() => ((Number(outTokens.value) || 0) / 1_000_000) * (Number(outPrice.value) || 0));
const totalCost = computed(() => (cost.value + outCost.value) * Math.max(1, Number(requests.value) || 1));

const barClass = computed(() => (usage.value > 100 ? "bg-danger" : usage.value > 80 ? "bg-warning" : "bg-accent"));

const fmt = (n: number) => n.toLocaleString("en-US");
const fmtCost = (n: number) => (n === 0 ? "$0" : n < 0.0001 ? "< $0.0001" : "$" + n.toFixed(n < 0.01 ? 5 : 4));

const MAX_VIZ = 2000;
const viz = computed(() => {
    if (!showViz.value || !tokenizer.value || !text.value) return { chunks: [] as string[], truncated: false };
    const ids = tokenizer.value.encode(text.value.slice(0, 40_000), { allowedSpecial: "all" });
    const chunks = ids.slice(0, MAX_VIZ).map((id) => tokenizer.value!.decode([id]));
    return { chunks, truncated: ids.length > MAX_VIZ || text.value.length > 40_000 };
});

async function paste() {
    text.value = await readClipboard();
}
</script>

<template>
    <ToolPage>
        <div class="grid gap-4 lg:grid-cols-[1fr_22rem]">
            <Panel title="Text" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="paste"><ClipboardPaste /> Paste</Btn>
                    <Btn size="sm" variant="ghost" :disabled="!text" @click="text = ''"><Trash2 /> Clear</Btn>
                </template>
                <CodeArea v-model="text" placeholder="Paste a prompt, document or code to count tokens…" height="18rem" />
                <div class="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-4 py-2 text-xs text-muted">
                    <span>{{ fmt(chars) }} characters</span>
                    <span>{{ fmt(words) }} words</span>
                    <span class="text-fg">{{ fmt(tokens) }} tokens<template v-if="!isExact"> (estimate)</template></span>
                </div>
            </Panel>

            <div class="space-y-4">
                <Panel title="Token counts">
                    <ul class="divide-y divide-line text-sm">
                        <li v-for="r in rows" :key="r.name" class="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                            <span class="min-w-0">
                                {{ r.name }}
                                <span class="chip ml-1 align-middle" :class="r.exact ? 'text-success' : ''">{{ r.exact ? "exact" : "estimate" }}</span>
                            </span>
                            <span class="font-mono font-medium">{{ fmt(r.tokens) }}</span>
                        </li>
                    </ul>
                    <p class="mt-3 text-xs text-muted">Estimates use rough character-per-token ratios (Claude about 3.5, Gemini about 4, Llama about 3.8) and can be off by 10-25%.</p>
                </Panel>
                <Notice v-if="loadError" type="warning">{{ loadError }}</Notice>
            </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="Context window">
                <div class="space-y-4">
                    <div class="grid gap-3 sm:grid-cols-2">
                        <Field label="Model">
                            <select v-model="modelId" class="select">
                                <option v-for="m in MODELS" :key="m.id" :value="m.id">{{ m.name }}</option>
                            </select>
                        </Field>
                        <Field label="Context size (tokens)">
                            <input v-model.number="contextSize" type="number" min="1" class="input" />
                        </Field>
                    </div>
                    <div>
                        <div class="mb-1.5 flex justify-between text-sm">
                            <span>{{ fmt(tokens) }} / {{ fmt(contextSize) }} tokens<template v-if="!isExact"> (est.)</template></span>
                            <span class="font-medium" :class="usage > 100 ? 'text-danger' : ''">{{ usage < 0.01 && tokens ? "< 0.01" : usage.toFixed(2) }}%</span>
                        </div>
                        <div class="h-3 w-full overflow-hidden rounded-full bg-subtle">
                            <div class="h-3 rounded-full transition-all" :class="barClass" :style="{ width: Math.min(usage, 100) + '%' }"></div>
                        </div>
                    </div>
                    <Notice v-if="usage > 100" type="error">The text exceeds this model's context window by about {{ fmt(Math.round(tokens - contextSize)) }} tokens.</Notice>
                </div>
            </Panel>

            <Panel title="Cost estimate">
                <div class="space-y-4">
                    <div class="grid gap-3 sm:grid-cols-2">
                        <Field label="Input price ($ per 1M tokens)">
                            <input v-model.number="price" type="number" min="0" step="0.01" class="input" />
                        </Field>
                        <Field label="Output price ($ per 1M tokens)">
                            <input v-model.number="outPrice" type="number" min="0" step="0.01" class="input" />
                        </Field>
                        <Field label="Expected output tokens" hint="Length of the reply you expect">
                            <input v-model.number="outTokens" type="number" min="0" step="100" class="input" />
                        </Field>
                        <Field label="Number of requests" hint="For example, calls per day or month">
                            <input v-model.number="requests" type="number" min="1" class="input" />
                        </Field>
                    </div>
                    <div class="rounded-lg bg-subtle px-4 py-3">
                        <div class="text-xs text-muted">Estimated cost{{ requests > 1 ? ` for ${fmt(requests)} requests` : "" }}</div>
                        <div class="font-mono text-2xl font-semibold">{{ fmtCost(totalCost) }}</div>
                        <div class="text-xs text-muted">Input {{ fmtCost(cost) }} ({{ fmt(tokens) }} tokens<template v-if="!isExact">, estimated</template>) + output {{ fmtCost(outCost) }} ({{ fmt(outTokens || 0) }} tokens){{ requests > 1 ? " per request" : "" }}</div>
                    </div>
                    <p class="text-xs text-muted">Default prices are approximate and change often; edit them to match your provider's current price list.</p>
                </div>
            </Panel>
        </div>

        <Panel title="Token visualization">
            <template #actions>
                <label class="flex items-center gap-2 text-sm"><input v-model="showViz" type="checkbox" class="checkbox" /> Show tokens (GPT-4o)</label>
            </template>
            <p v-if="!showViz" class="text-sm text-muted">Enable to see how GPT-4o's tokenizer splits your text. Limited to the first {{ fmt(MAX_VIZ) }} tokens.</p>
            <p v-else-if="!text" class="text-sm text-muted">Enter some text above.</p>
            <template v-else>
                <div class="max-h-96 overflow-auto rounded-lg bg-subtle p-3 font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap">
                    <span v-for="(c, i) in viz.chunks" :key="i" class="rounded-sm" :class="i % 2 ? 'bg-warning/25' : 'bg-accent/25'">{{ c }}</span>
                </div>
                <p v-if="viz.truncated" class="mt-2 text-xs text-muted">Showing only the first {{ fmt(MAX_VIZ) }} tokens.</p>
            </template>
        </Panel>
    </ToolPage>
</template>
