<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Download, RefreshCw } from "lucide-vue-next";
import { v1, v4, v7 } from "uuid";
import { decodeTime, ulid } from "ulid";
import { Btn, CodeArea, CopyButton, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { downloadBlob } from "@/composables/useClipboard";

type Ver = "v4" | "v7" | "v1" | "ulid";
const version = ref<Ver>("v4");
const count = ref(5);
const upper = ref(false);
const noHyphens = ref(false);
const braces = ref(false);
const nonce = ref(0);

const safeCount = computed(() => Math.min(1000, Math.max(1, Math.floor(Number(count.value)) || 1)));

function gen(): string {
    switch (version.value) {
        case "v1": return v1();
        case "v7": return v7();
        case "ulid": return ulid();
        default: return v4();
    }
}

const ids = computed(() => {
    void nonce.value;
    return Array.from({ length: safeCount.value }, () => {
        let s = gen();
        if (version.value !== "ulid") {
            if (noHyphens.value) s = s.replace(/-/g, "");
            if (braces.value) s = `{${s}}`;
        }
        return upper.value || version.value === "ulid" ? s.toUpperCase() : s.toLowerCase();
    });
});
const output = computed(() => ids.value.join("\n"));
const regenerate = () => nonce.value++;
watch(version, regenerate);

// Inspector
const probe = ref("");
const info = computed(() => {
    let s = probe.value.trim();
    if (!s) return null;
    s = s.replace(/^urn:uuid:/i, "").replace(/^\{(.*)\}$/, "$1");
    let u = s;
    if (/^[0-9a-f]{32}$/i.test(u)) u = u.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u)) {
        const hex = u.replace(/-/g, "").toLowerCase();
        const ver = parseInt(hex[12], 16);
        const vb = parseInt(hex[16], 16);
        let variant = "Reserved (future)";
        if (u === "00000000-0000-0000-0000-000000000000") variant = "Nil UUID";
        else if (hex === "f".repeat(32)) variant = "Max UUID";
        else if ((vb & 0x8) === 0) variant = "NCS (reserved)";
        else if ((vb & 0xc) === 0x8) variant = "RFC 4122 / RFC 9562";
        else if ((vb & 0xe) === 0xc) variant = "Microsoft (reserved)";
        let date: Date | null = null;
        if (ver === 7) date = new Date(parseInt(hex.slice(0, 12), 16));
        else if (ver === 1) {
            const timeLow = BigInt("0x" + hex.slice(0, 8));
            const timeMid = BigInt("0x" + hex.slice(8, 12));
            const timeHi = BigInt("0x" + hex.slice(13, 16));
            const t = (timeHi << 48n) | (timeMid << 32n) | timeLow;
            date = new Date(Number((t - 122192928000000000n) / 10000n));
        }
        return { kind: "UUID", canonical: u.toLowerCase(), version: ver, variant, date };
    }
    if (/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i.test(s)) {
        let date: Date | null = null;
        try { date = new Date(decodeTime(s.toUpperCase())); } catch { /* ignore */ }
        return { kind: "ULID", canonical: s.toUpperCase(), version: null, variant: "Crockford Base32", date };
    }
    return { kind: "invalid" as const };
});
function validDate(d: Date | null) {
    return d && !Number.isNaN(d.getTime()) ? d : null;
}
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="version" :options="[{ value: 'v4', label: 'UUID v4' }, { value: 'v7', label: 'UUID v7' }, { value: 'v1', label: 'UUID v1' }, { value: 'ulid', label: 'ULID' }]" />
        </template>

        <div class="flex flex-wrap items-end gap-x-5 gap-y-3 text-sm">
            <Field label="Count (1–1000)">
                <input v-model.number="count" type="number" min="1" max="1000" class="input w-28" />
            </Field>
            <label class="flex items-center gap-2 pb-2"><input v-model="upper" type="checkbox" class="checkbox" :disabled="version === 'ulid'" /> Uppercase</label>
            <label class="flex items-center gap-2 pb-2"><input v-model="noHyphens" type="checkbox" class="checkbox" :disabled="version === 'ulid'" /> No hyphens</label>
            <label class="flex items-center gap-2 pb-2"><input v-model="braces" type="checkbox" class="checkbox" :disabled="version === 'ulid'" /> Braces</label>
        </div>

        <Panel :title="`Generated (${ids.length})`" flush>
            <template #actions>
                <Btn size="sm" variant="ghost" @click="regenerate"><RefreshCw /> Regenerate</Btn>
                <Btn size="sm" variant="ghost" @click="downloadBlob(output + '\n', `${version}-ids.txt`)"><Download /> Download</Btn>
                <CopyButton :text="output" label="Copy all" />
            </template>
            <CodeArea :model-value="output" readonly :wrap="false" height="14rem" />
        </Panel>

        <Panel title="Inspector">
            <Field label="Paste a UUID or ULID">
                <input v-model="probe" class="input font-mono" placeholder="e.g. 018f3c1e-5b7a-7c3e-8a52-6f1d0e9b2c4a" spellcheck="false" />
            </Field>
            <div v-if="info" class="mt-4">
                <Notice v-if="info.kind === 'invalid'" type="error">Not a valid UUID or ULID.</Notice>
                <dl v-else class="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                    <dt class="text-muted">Type</dt><dd>{{ info.kind }}</dd>
                    <dt class="text-muted">Canonical</dt><dd class="font-mono break-all">{{ info.canonical }}</dd>
                    <template v-if="info.version !== null"><dt class="text-muted">Version</dt><dd>{{ info.version }}</dd></template>
                    <dt class="text-muted">Variant</dt><dd>{{ info.variant }}</dd>
                    <template v-if="validDate(info.date ?? null)">
                        <dt class="text-muted">Timestamp</dt>
                        <dd>{{ validDate(info.date ?? null)!.toISOString() }} <span class="text-muted">({{ validDate(info.date ?? null)!.toLocaleString() }})</span></dd>
                    </template>
                </dl>
            </div>
        </Panel>
    </ToolPage>
</template>
