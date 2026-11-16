<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { Check, CircleCheck, Download, HardDrive, Plus, Power, Search, Trash2 } from "lucide-vue-next";
import { Btn, Field, Notice, Panel, Tabs } from "@/components/ui";
import { customModels, listModels, type CatalogModel } from "@/chat/models";
import { deleteModel, engineStatus, isCached, loadedModel, storageEstimate, unload } from "@/chat/engine";
import { gcEnsureModel, gcSettings } from "@/chat/general";

const emit = defineEmits<{ picked: [] }>();

const all = ref<CatalogModel[]>([]);
const loading = ref(true);
const query = ref("");
const size = ref<"small" | "all">("small");
const limit = ref(30);
const cached = reactive<Record<string, boolean>>({});
const storage = ref("");

async function refresh() {
    loading.value = true;
    all.value = await listModels();
    loading.value = false;
    const est = await storageEstimate();
    if (est?.usage != null) storage.value = `${(est.usage / 1024 ** 3).toFixed(2)} GB used by this site`;
}
onMounted(refresh);

const filtered = computed(() => {
    const q = query.value.trim().toLowerCase();
    return all.value.filter((m) => (size.value === "all" || m.custom || (m.vramMB ?? 0) <= 2048) && (!q || m.id.toLowerCase().includes(q)));
});
const shown = computed(() => filtered.value.slice(0, limit.value));

// Checking the cache opens browser storage per model, so only check the rows on screen.
watch(
    shown,
    async (rows) => {
        for (const m of rows) if (cached[m.id] === undefined) cached[m.id] = await isCached(m.id).catch(() => false);
    },
    { immediate: true },
);

const busyId = ref("");
async function use(m: CatalogModel) {
    gcSettings.value.modelId = m.id;
    busyId.value = m.id;
    try {
        await gcEnsureModel();
        cached[m.id] = true;
        emit("picked");
    } catch {
        /* the error shows in the chat */
    } finally {
        busyId.value = "";
    }
}
async function remove(m: CatalogModel) {
    if (!confirm(`Delete ${m.id} from this browser? You can download it again later.`)) return;
    await deleteModel(m.id);
    cached[m.id] = false;
    void refresh();
}
function removeCustom(m: CatalogModel) {
    customModels.value = customModels.value.filter((c) => c.model_id !== m.id);
    void refresh();
}

const vram = (mb?: number) => (mb == null ? "?" : mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`);

// ----- custom model form -----
const form = reactive({ id: "", url: "", lib: "", libFrom: "", vram: "", ctx: "" });
const formError = ref("");
const libChoices = computed(() => all.value.filter((m) => !m.custom));
watch(
    () => form.libFrom,
    (id) => {
        const m = all.value.find((x) => x.id === id);
        if (m) form.lib = m.record.model_lib;
    },
);
watch(
    () => form.url,
    (url) => {
        if (!form.id && /huggingface\.co\/[^/]+\/([^/?#]+)/.test(url)) form.id = url.match(/huggingface\.co\/[^/]+\/([^/?#]+)/)![1];
    },
);
function addCustom() {
    formError.value = "";
    const id = form.id.trim();
    if (!id) return (formError.value = "Give the model an ID.");
    if (!/^https:\/\//.test(form.url.trim())) return (formError.value = "The weights URL must start with https://.");
    if (!/^https:\/\/.+\.wasm(\?.*)?$/.test(form.lib.trim())) return (formError.value = "The model library must be an https:// URL to a .wasm file.");
    if (all.value.some((m) => m.id === id && !m.custom)) return (formError.value = "A built-in model already uses that ID.");
    customModels.value = [
        ...customModels.value.filter((c) => c.model_id !== id),
        { model_id: id, model: form.url.trim().replace(/\/$/, ""), model_lib: form.lib.trim(), vram_required_MB: Number(form.vram) || undefined, context_window_size: Number(form.ctx) || undefined },
    ];
    Object.assign(form, { id: "", url: "", lib: "", libFrom: "", vram: "", ctx: "" });
    query.value = id;
    size.value = "all";
    void refresh();
}
</script>

<template>
    <div class="space-y-5">
        <Panel title="Models" flush>
            <template #actions>
                <span v-if="storage" class="mr-1 hidden items-center gap-1 text-xs text-fg-subtle sm:inline-flex"><HardDrive class="size-3.5" /> {{ storage }}</span>
                <Btn v-if="loadedModel" size="sm" variant="ghost" @click="unload"><Power /> Unload</Btn>
            </template>
            <div class="flex flex-wrap items-center gap-2 border-b border-line p-3">
                <label class="relative min-w-48 flex-1">
                    <Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
                    <input v-model="query" class="input !pl-9" placeholder="Search models, e.g. qwen, llama, phi…" aria-label="Search models" />
                </label>
                <Tabs v-model="size" size="sm" :options="[{ value: 'small', label: 'Up to 2 GB' }, { value: 'all', label: 'All' }]" />
            </div>
            <p v-if="loading" class="p-4 text-sm text-muted">Loading the model list…</p>
            <p v-else-if="!filtered.length" class="p-4 text-sm text-muted">No models match.</p>
            <ul v-else class="divide-y divide-line">
                <li v-for="m in shown" :key="m.id" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5" :class="m.id === gcSettings.modelId ? 'bg-accent-soft/40' : ''">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5">
                            <span class="truncate font-mono text-sm text-fg" :title="m.id">{{ m.id }}</span>
                            <CircleCheck v-if="m.id === loadedModel" class="size-3.5 shrink-0 text-accent" aria-label="Loaded" />
                        </div>
                        <div class="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-fg-subtle">
                            <span>VRAM {{ vram(m.vramMB) }}</span>
                            <span v-if="m.contextWindow">· {{ (m.contextWindow / 1024).toFixed(0) }}k context</span>
                            <span v-if="cached[m.id]" class="chip !py-0">Downloaded</span>
                            <span v-if="m.custom" class="chip !py-0">Custom</span>
                            <span v-if="m.lowResource" class="chip !py-0">Low resource</span>
                        </div>
                    </div>
                    <Btn size="sm" :variant="m.id === gcSettings.modelId ? 'primary' : 'secondary'" :disabled="!!busyId || engineStatus === 'downloading' || engineStatus === 'unsupported'" @click="use(m)">
                        <template v-if="busyId === m.id">Loading…</template>
                        <template v-else-if="m.id === loadedModel"><Check /> In use</template>
                        <template v-else-if="cached[m.id]">Use</template>
                        <template v-else><Download /> Download</template>
                    </Btn>
                    <Btn v-if="cached[m.id]" size="sm" variant="ghost" :aria-label="`Delete ${m.id} from this browser`" @click="remove(m)"><Trash2 /></Btn>
                    <Btn v-if="m.custom" size="sm" variant="ghost" @click="removeCustom(m)">Remove</Btn>
                </li>
            </ul>
            <div v-if="filtered.length > shown.length" class="border-t border-line p-3 text-center">
                <Btn size="sm" variant="ghost" @click="limit += 30">Show {{ Math.min(30, filtered.length - shown.length) }} more of {{ filtered.length - shown.length }}</Btn>
            </div>
        </Panel>

        <Panel title="Add a custom model">
            <p class="mb-4 text-sm text-fg-muted">
                Any model converted to MLC format with a WebGPU library works, such as the
                <a class="font-medium text-fg underline underline-offset-4" href="https://huggingface.co/mlc-ai" target="_blank" rel="noopener">mlc-ai models on Hugging Face</a>
                or one you converted with MLC LLM. Fine-tunes of a built-in model can reuse its library.
            </p>
            <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="addCustom">
                <Field label="Weights URL" hint="Hugging Face repo with the MLC weights" class="sm:col-span-2">
                    <input v-model="form.url" class="input font-mono" placeholder="https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC" spellcheck="false" />
                </Field>
                <Field label="Model ID" hint="Unique name, filled from the URL">
                    <input v-model="form.id" class="input font-mono" spellcheck="false" />
                </Field>
                <Field label="Reuse library from" hint="Same architecture and quantization">
                    <select v-model="form.libFrom" class="select">
                        <option value="">Paste a URL instead</option>
                        <option v-for="m in libChoices" :key="m.id" :value="m.id">{{ m.id }}</option>
                    </select>
                </Field>
                <Field label="Model library (.wasm) URL" class="sm:col-span-2">
                    <input v-model="form.lib" class="input font-mono" placeholder="https://…-webgpu.wasm" spellcheck="false" />
                </Field>
                <Field label="VRAM needed (MB)" hint="Optional, for display">
                    <input v-model="form.vram" class="input" inputmode="numeric" />
                </Field>
                <Field label="Context window (tokens)" hint="Optional">
                    <input v-model="form.ctx" class="input" inputmode="numeric" placeholder="4096" />
                </Field>
                <Notice v-if="formError" type="error" class="sm:col-span-2">{{ formError }}</Notice>
                <div class="sm:col-span-2"><Btn type="submit" variant="primary"><Plus /> Add model</Btn></div>
            </form>
        </Panel>
    </div>
</template>
