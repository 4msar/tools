<script setup lang="ts">
import { computed, defineComponent, h, ref, type Component, type PropType, type VNode } from "vue";
import { dump } from "js-yaml";
import { ClipboardPaste, Download, FileText, Trash2 } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { downloadBlob, readClipboard } from "@/composables/useClipboard";

// Recursive tree view node
const JsonTreeNode: Component = defineComponent({
    name: "JsonTreeNode",
    props: {
        data: { type: null as unknown as PropType<unknown>, default: null },
        keyName: { type: String, default: "" },
        level: { type: Number, default: 0 },
    },
    setup(props) {
        const expanded = ref(props.level < 2);
        const isArray = () => Array.isArray(props.data);
        const isObject = () => typeof props.data === "object" && props.data !== null;
        const valueClass = () => {
            switch (typeof props.data) {
                case "string": return "text-success";
                case "number": return "text-warning";
                case "boolean": return "text-danger";
                default: return "text-muted";
            }
        };
        return (): VNode => {
            const data = props.data;
            if (isObject()) {
                const entries = Object.entries(data as unknown as Record<string, unknown>);
                return h("div", { style: { marginLeft: props.level ? "1.25rem" : "0" }, class: "leading-relaxed" }, [
                    h("div", { class: "flex cursor-pointer items-center gap-1.5", onClick: () => (expanded.value = !expanded.value) }, [
                        h("span", { class: "w-3 text-xs text-muted" }, expanded.value ? "▼" : "▶"),
                        h("span", { class: "font-semibold text-accent" }, props.keyName),
                        h("span", { class: "text-muted" }, isArray() ? `[${entries.length}]` : `{${entries.length}}`),
                    ]),
                    expanded.value
                        ? h("div", { class: "mt-0.5" }, entries.map(([k, v]) => h(JsonTreeNode, { key: k, data: v, keyName: k, level: props.level + 1 })))
                        : null,
                ]);
            }
            return h("div", { style: { marginLeft: props.level ? "1.25rem" : "0" }, class: "flex gap-2 pl-4.5 leading-relaxed" }, [
                h("span", { class: "font-semibold text-accent" }, `${props.keyName}:`),
                h("span", { class: [valueClass(), "break-all"] }, typeof data === "string" ? `"${data}"` : String(data)),
            ]);
        };
    },
});

type OutTab = "format" | "minify" | "yaml";

const inputJson = ref("");
const tab = ref<OutTab>("format");
const indent = ref<"2" | "4" | "tab">("2");
const sortKeys = ref(false);

const SAMPLE = {
    name: "John Doe",
    age: 30,
    city: "New York",
    hobbies: ["reading", "swimming", "coding"],
    address: { street: "123 Main St", zipcode: "10001" },
    active: true,
    balance: 1250.5,
};

const parsed = computed<{ ok: boolean; value?: unknown; error?: string }>(() => {
    if (!inputJson.value.trim()) return { ok: false };
    try {
        return { ok: true, value: JSON.parse(inputJson.value) };
    } catch (e) {
        let msg = e instanceof Error ? e.message : "Invalid JSON";
        const m = /position (\d+)/.exec(msg);
        if (m && !/line \d+/.test(msg)) {
            const before = inputJson.value.slice(0, Number(m[1]));
            const line = before.split("\n").length;
            const col = before.length - before.lastIndexOf("\n");
            msg += ` (line ${line}, column ${col})`;
        }
        return { ok: false, error: msg };
    }
});

function sortDeep(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(sortDeep);
    if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortDeep(o[k])]));
    }
    return v;
}

const prepared = computed(() => (parsed.value.ok ? (sortKeys.value ? sortDeep(parsed.value.value) : parsed.value.value) : undefined));

const outputs = computed(() => {
    if (!parsed.value.ok) return { format: "", minify: "", yaml: "" };
    const v = prepared.value;
    const space = indent.value === "tab" ? "\t" : Number(indent.value);
    let yaml = "";
    try {
        yaml = dump(v, { indent: indent.value === "4" ? 4 : 2, lineWidth: -1 });
    } catch (e) {
        yaml = `# ${e instanceof Error ? e.message : "Could not convert to YAML"}`;
    }
    return { format: JSON.stringify(v, null, space) ?? "", minify: JSON.stringify(v) ?? "", yaml };
});

const currentOutput = computed(() => outputs.value[tab.value]);

function escapeHtml(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function syntaxHighlight(json: string): string {
    return escapeHtml(json).replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
        (match) => {
            let cls = "text-warning";
            if (/^"/.test(match)) cls = /:$/.test(match) ? "text-accent" : "text-success";
            else if (/true|false/.test(match)) cls = "text-danger";
            else if (/null/.test(match)) cls = "text-muted";
            return `<span class="${cls}">${match}</span>`;
        },
    );
}

const highlighted = computed(() => (tab.value === "yaml" ? "" : syntaxHighlight(currentOutput.value)));

const jsonStats = computed(() => {
    const stats = { size: 0, keys: 0, depth: 0, arrays: 0 };
    if (!parsed.value.ok) return stats;
    stats.size = JSON.stringify(parsed.value.value)?.length ?? 0;
    function analyze(obj: unknown, depth = 0): void {
        if (depth > stats.depth) stats.depth = depth;
        if (Array.isArray(obj)) {
            stats.arrays++;
            obj.forEach((item) => analyze(item, depth + 1));
        } else if (typeof obj === "object" && obj !== null) {
            stats.keys += Object.keys(obj).length;
            Object.values(obj).forEach((value) => analyze(value, depth + 1));
        }
    }
    analyze(parsed.value.value);
    return stats;
});

const statItems = computed(() => [
    { label: "Size (chars)", value: jsonStats.value.size },
    { label: "Keys", value: jsonStats.value.keys },
    { label: "Max depth", value: jsonStats.value.depth },
    { label: "Arrays", value: jsonStats.value.arrays },
]);

async function paste() {
    inputJson.value = await readClipboard();
}

function download() {
    if (!currentOutput.value) return;
    const yaml = tab.value === "yaml";
    downloadBlob(currentOutput.value, yaml ? "data.yaml" : tab.value === "minify" ? "minified.json" : "formatted.json", yaml ? "text/yaml" : "application/json");
}
</script>

<template>
    <ToolPage>
        <div class="flex flex-wrap items-end gap-x-5 gap-y-3 text-sm">
            <label class="block">
                <span class="label">Indent</span>
                <select v-model="indent" class="select w-auto">
                    <option value="2">2 spaces</option>
                    <option value="4">4 spaces</option>
                    <option value="tab">Tab</option>
                </select>
            </label>
            <label class="flex h-9 items-center gap-2"><input v-model="sortKeys" type="checkbox" class="checkbox" /> Sort keys</label>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="Input JSON" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="paste"><ClipboardPaste /> Paste</Btn>
                    <Btn size="sm" variant="ghost" @click="inputJson = JSON.stringify(SAMPLE, null, 2)"><FileText /> Sample</Btn>
                    <Btn size="sm" variant="ghost" :disabled="!inputJson" @click="inputJson = ''"><Trash2 /> Clear</Btn>
                </template>
                <CodeArea v-model="inputJson" placeholder="Paste your JSON here…" :wrap="false" :invalid="!!parsed.error" height="24rem" />
                <div class="border-t border-line px-4 py-2 text-xs text-muted">{{ inputJson.length }} characters</div>
            </Panel>

            <Panel flush>
                <template #title>
                    <Tabs v-model="tab" size="sm" :options="[{ value: 'format', label: 'Formatted' }, { value: 'minify', label: 'Minified' }, { value: 'yaml', label: 'YAML' }]" />
                </template>
                <template #actions>
                    <Btn size="sm" variant="ghost" :disabled="!currentOutput" @click="download"><Download /> Download</Btn>
                    <CopyButton :text="currentOutput" />
                </template>
                <div v-if="parsed.error" class="p-4"><Notice type="error">{{ parsed.error }}</Notice></div>
                <pre v-else-if="tab !== 'yaml' && currentOutput" class="min-h-96 flex-1 overflow-auto p-4 font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap" v-html="highlighted"></pre>
                <CodeArea v-else :model-value="currentOutput" readonly placeholder="Output appears here" height="24rem" :wrap="false" />
                <div class="border-t border-line px-4 py-2 text-xs" :class="parsed.ok ? 'text-success' : 'text-muted'">
                    <template v-if="parsed.ok">Valid JSON · {{ currentOutput.length }} characters</template>
                    <template v-else-if="parsed.error">Invalid JSON</template>
                    <template v-else>Waiting for input</template>
                </div>
            </Panel>
        </div>

        <template v-if="parsed.ok">
            <Panel title="Statistics">
                <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div v-for="s in statItems" :key="s.label" class="text-center">
                        <div class="text-2xl font-semibold text-accent">{{ s.value }}</div>
                        <div class="text-sm text-muted">{{ s.label }}</div>
                    </div>
                </div>
            </Panel>

            <Panel title="Tree view">
                <div class="max-h-[28rem] overflow-auto font-mono text-[13px]">
                    <JsonTreeNode :data="prepared" key-name="root" :level="0" />
                </div>
            </Panel>
        </template>
    </ToolPage>
</template>
