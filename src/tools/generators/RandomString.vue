<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RefreshCw } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Field, Panel, Tabs, ToolPage } from "@/components/ui";

type Preset = "nanoid" | "hex" | "base64url" | "alnum" | "custom";
const NANO = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
const alphabets: Record<Exclude<Preset, "custom">, string> = {
    nanoid: NANO,
    hex: "0123456789abcdef",
    base64url: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",
    alnum: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
};
const preset = ref<Preset>("nanoid");
const length = ref(21);
const count = ref(5);
const custom = ref("ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
const nonce = ref(0);

watch(preset, (p) => {
    if (p === "nanoid") length.value = 21;
    else if (p === "hex") length.value = 32;
    else if (p === "base64url") length.value = 43;
    else if (p === "alnum") length.value = 24;
});

const alphabet = computed(() => {
    if (preset.value !== "custom") return alphabets[preset.value];
    return Array.from(new Set(Array.from(custom.value))).join("");
});
const len = computed(() => Math.min(4096, Math.max(1, Math.floor(Number(length.value)) || 1)));
const cnt = computed(() => Math.min(1000, Math.max(1, Math.floor(Number(count.value)) || 1)));

function randomString(alpha: string[], n: number): string {
    const size = alpha.length;
    const mask = (2 << (31 - Math.clz32(Math.max(size - 1, 1)))) - 1;
    const buf = new Uint8Array(Math.ceil((1.6 * mask * n) / size) + 8);
    let out = "";
    while (out.length < n) {
        crypto.getRandomValues(buf);
        for (let i = 0; i < buf.length && out.length < n; i++) {
            const v = buf[i] & mask;
            if (v < size) out += alpha[v]; // rejection sampling: no modulo bias
        }
    }
    return out;
}

const items = computed(() => {
    void nonce.value;
    const alpha = Array.from(alphabet.value);
    if (alpha.length < 2) return [];
    return Array.from({ length: cnt.value }, () => randomString(alpha, len.value));
});
const output = computed(() => items.value.join("\n"));
const entropy = computed(() => {
    const n = Array.from(alphabet.value).length;
    return n < 2 ? 0 : len.value * Math.log2(n);
});
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs
                v-model="preset"
                :options="[
                    { value: 'nanoid', label: 'Nano ID' },
                    { value: 'hex', label: 'Hex' },
                    { value: 'base64url', label: 'Base64URL' },
                    { value: 'alnum', label: 'Alphanumeric' },
                    { value: 'custom', label: 'Custom' },
                ]"
            />
        </template>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Length (1–4096)"><input v-model.number="length" type="number" min="1" max="4096" class="input" /></Field>
            <Field label="Count (1–1000)"><input v-model.number="count" type="number" min="1" max="1000" class="input" /></Field>
            <div class="sm:col-span-2">
                <Field v-if="preset === 'custom'" label="Alphabet" :hint="`${Array.from(alphabet).length} unique characters (need at least 2)`">
                    <input v-model="custom" class="input font-mono" spellcheck="false" />
                </Field>
                <Field v-else label="Alphabet" :hint="`${alphabet.length} characters`">
                    <input :value="alphabet" readonly class="input font-mono" />
                </Field>
            </div>
        </div>

        <Panel title="Output" flush>
            <template #actions>
                <span class="chip">{{ entropy.toFixed(1) }} bits entropy</span>
                <Btn size="sm" variant="ghost" @click="nonce++"><RefreshCw /> Regenerate</Btn>
                <CopyButton :text="output" label="Copy all" />
            </template>
            <CodeArea :model-value="output" readonly :wrap="false" height="14rem" placeholder="Alphabet needs at least 2 unique characters" />
            <div class="border-t border-line px-4 py-2 text-xs text-muted">
                Generated with crypto.getRandomValues and rejection sampling (no modulo bias) · {{ items.length }} string{{ items.length === 1 ? "" : "s" }}
            </div>
        </Panel>
    </ToolPage>
</template>
