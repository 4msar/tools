<script setup lang="ts">
import { computed, ref } from "vue";
import { ClipboardPaste, Plus, Sparkles, Trash2, X } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { readClipboard } from "@/composables/useClipboard";

type Tab = "encode" | "decode" | "parse";
const tab = ref<Tab>("encode");
const mode = ref<"component" | "full">("component");
const input = ref("");

const converted = computed<{ out: string; error?: string }>(() => {
    if (!input.value) return { out: "" };
    try {
        if (tab.value === "encode") return { out: mode.value === "component" ? encodeURIComponent(input.value) : encodeURI(input.value) };
        return { out: mode.value === "component" ? decodeURIComponent(input.value) : decodeURI(input.value) };
    } catch {
        return { out: "", error: "Malformed URI sequence." };
    }
});

// Parser
interface Param { id: number; key: string; value: string }
let nextId = 1;
const urlText = ref("");
const protocol = ref("");
const username = ref("");
const password = ref("");
const hostname = ref("");
const port = ref("");
const pathname = ref("");
const hash = ref("");
const params = ref<Param[]>([]);
const parseError = ref("");

function loadUrl(text: string) {
    urlText.value = text;
    if (!text.trim()) {
        parseError.value = "";
        params.value = [];
        protocol.value = username.value = password.value = hostname.value = port.value = pathname.value = hash.value = "";
        return;
    }
    try {
        const u = new URL(text.trim());
        parseError.value = "";
        protocol.value = u.protocol;
        username.value = u.username;
        password.value = u.password;
        hostname.value = u.hostname;
        port.value = u.port;
        pathname.value = u.pathname;
        hash.value = u.hash;
        params.value = [...u.searchParams.entries()].map(([key, value]) => ({ id: nextId++, key, value }));
    } catch {
        parseError.value = "Not a valid absolute URL (include a scheme such as https://).";
    }
}

const rebuilt = computed(() => {
    if (parseError.value || !urlText.value.trim()) return "";
    try {
        const u = new URL(urlText.value.trim());
        u.pathname = pathname.value;
        u.hash = hash.value;
        const sp = new URLSearchParams();
        for (const p of params.value) if (p.key || p.value) sp.append(p.key, p.value);
        u.search = sp.toString();
        return u.toString();
    } catch {
        return urlText.value;
    }
});

function addParam() { params.value.push({ id: nextId++, key: "", value: "" }); }
function removeParam(id: number) { params.value = params.value.filter((p) => p.id !== id); }

const sampleUrl = "https://user:pass@example.com:8080/path/to/page?q=hello%20world&lang=en&tag=a&tag=b#section-2";
async function pasteUrl() { loadUrl(await readClipboard()); }

const fields = computed(() => [
    ["Protocol", protocol.value],
    ["Username", username.value],
    ["Password", password.value],
    ["Host", hostname.value],
    ["Port", port.value],
    ["Path", pathname.value],
    ["Hash", hash.value],
].filter(([, v]) => v !== ""));
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="tab" :options="[{ value: 'encode', label: 'Encode' }, { value: 'decode', label: 'Decode' }, { value: 'parse', label: 'Parser' }]" />
        </template>

        <template v-if="tab !== 'parse'">
            <div class="flex flex-wrap items-center gap-3 text-sm">
                <Tabs v-model="mode" size="sm" :options="[{ value: 'component', label: 'Component' }, { value: 'full', label: 'Full URI' }]" />
                <span class="text-xs text-muted">
                    {{ mode === "component" ? "encodeURIComponent: escapes everything except letters, digits and - _ . ! ~ * ' ( )" : "encodeURI: keeps URL syntax characters such as : / ? # & = intact" }}
                </span>
            </div>
            <div class="grid gap-4 lg:grid-cols-2">
                <Panel title="Input" flush>
                    <template #actions>
                        <Btn size="sm" variant="ghost" @click="async () => (input = await readClipboard())"><ClipboardPaste /> Paste</Btn>
                        <Btn size="sm" variant="ghost" :disabled="!input" @click="input = ''"><Trash2 /> Clear</Btn>
                    </template>
                    <CodeArea v-model="input" height="14rem" :placeholder="tab === 'encode' ? 'Text or URL to encode…' : 'Percent-encoded text to decode…'" />
                </Panel>
                <Panel title="Output" flush>
                    <template #actions>
                        <Btn size="sm" variant="ghost" :disabled="!converted.out" @click="input = converted.out; tab = tab === 'encode' ? 'decode' : 'encode'">Use as input</Btn>
                        <CopyButton :text="converted.out" />
                    </template>
                    <div v-if="converted.error" class="p-4"><Notice type="error">{{ converted.error }}</Notice></div>
                    <CodeArea v-else :model-value="converted.out" readonly height="14rem" placeholder="Output appears here" />
                </Panel>
            </div>
        </template>

        <template v-else>
            <Panel title="URL" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="loadUrl(sampleUrl)"><Sparkles /> Sample</Btn>
                    <Btn size="sm" variant="ghost" @click="pasteUrl"><ClipboardPaste /> Paste</Btn>
                    <Btn size="sm" variant="ghost" :disabled="!urlText" @click="loadUrl('')"><Trash2 /> Clear</Btn>
                </template>
                <CodeArea :model-value="urlText" height="5rem" placeholder="https://example.com/path?x=1#top" @update:model-value="loadUrl" />
            </Panel>
            <Notice v-if="parseError" type="error">{{ parseError }}</Notice>
            <div v-else-if="urlText.trim()" class="grid gap-4 lg:grid-cols-2">
                <Panel title="Parts">
                    <dl class="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-sm">
                        <template v-for="[k, v] in fields" :key="k">
                            <dt class="text-muted">{{ k }}</dt>
                            <dd class="font-mono break-all">{{ v }}</dd>
                        </template>
                    </dl>
                </Panel>
                <Panel title="Query parameters">
                    <template #actions>
                        <Btn size="sm" variant="ghost" @click="addParam"><Plus /> Add</Btn>
                    </template>
                    <p v-if="!params.length" class="text-sm text-muted">No query parameters.</p>
                    <div v-else class="space-y-2">
                        <div v-for="p in params" :key="p.id" class="flex items-center gap-2">
                            <input v-model="p.key" class="input min-w-0 flex-1 font-mono" placeholder="key" aria-label="Parameter key" />
                            <input v-model="p.value" class="input min-w-0 flex-1 font-mono" placeholder="value" aria-label="Parameter value" />
                            <Btn size="sm" variant="ghost" title="Remove" @click="removeParam(p.id)"><X /></Btn>
                        </div>
                    </div>
                </Panel>
                <Panel title="Rebuilt URL" class="lg:col-span-2">
                    <template #actions><CopyButton :text="rebuilt" /></template>
                    <p class="font-mono text-[13px] break-all">{{ rebuilt }}</p>
                </Panel>
            </div>
        </template>
    </ToolPage>
</template>
