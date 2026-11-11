<script setup lang="ts">
import { computed, ref } from "vue";
import { Sparkles, Trash2 } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Panel, ToolPage } from "@/components/ui";

const input = ref("");

function splitWords(s: string): string[] {
    return s
        .replace(/([a-z\d])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .replace(/([A-Za-z])(\d)/g, "$1 $2")
        .replace(/(\d)([A-Za-z])/g, "$1 $2")
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean);
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

const formats: { id: string; label: string; fn: (w: string[]) => string }[] = [
    { id: "camel", label: "camelCase", fn: (w) => w.map((x, i) => (i ? cap(x) : x.toLowerCase())).join("") },
    { id: "pascal", label: "PascalCase", fn: (w) => w.map(cap).join("") },
    { id: "snake", label: "snake_case", fn: (w) => w.map((x) => x.toLowerCase()).join("_") },
    { id: "constant", label: "CONSTANT_CASE", fn: (w) => w.map((x) => x.toUpperCase()).join("_") },
    { id: "kebab", label: "kebab-case", fn: (w) => w.map((x) => x.toLowerCase()).join("-") },
    { id: "cobol", label: "COBOL-CASE", fn: (w) => w.map((x) => x.toUpperCase()).join("-") },
    { id: "train", label: "Train-Case", fn: (w) => w.map(cap).join("-") },
    { id: "dot", label: "dot.case", fn: (w) => w.map((x) => x.toLowerCase()).join(".") },
    { id: "path", label: "path/case", fn: (w) => w.map((x) => x.toLowerCase()).join("/") },
    { id: "title", label: "Title Case", fn: (w) => w.map(cap).join(" ") },
    { id: "sentence", label: "Sentence case", fn: (w) => cap(w[0] ?? "") + (w.length > 1 ? " " + w.slice(1).map((x) => x.toLowerCase()).join(" ") : "") },
    { id: "lower", label: "lowercase", fn: (w) => w.join(" ").toLowerCase() },
    { id: "upper", label: "UPPERCASE", fn: (w) => w.join(" ").toUpperCase() },
];

function slugify(s: string) {
    return s
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

const lines = computed(() => input.value.split(/\r?\n/));

const results = computed(() => {
    const out = formats.map((f) => ({
        id: f.id,
        label: f.label,
        text: lines.value.map((l) => (l.trim() ? f.fn(splitWords(l)) : "")).join("\n"),
    }));
    out.push({ id: "slug", label: "slug", text: lines.value.map((l) => slugify(l)).join("\n") });
    return out;
});

const sample = "userProfileURL\nHTTPServer2Config\nhello world-example_name\nXMLHttpRequest";
</script>

<template>
    <ToolPage>
        <Panel title="Input" flush>
            <template #actions>
                <Btn size="sm" variant="ghost" @click="input = sample"><Sparkles /> Sample</Btn>
                <Btn size="sm" variant="ghost" :disabled="!input" @click="input = ''"><Trash2 /> Clear</Btn>
            </template>
            <CodeArea v-model="input" height="8rem" placeholder="One name per line, e.g. userProfileURL" />
        </Panel>

        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div v-for="r in results" :key="r.id" class="flex min-w-0 items-start gap-2 rounded-xl border border-line bg-surface p-3 shadow-xs">
                <div class="min-w-0 flex-1">
                    <div class="mb-1 text-xs font-medium text-muted">{{ r.label }}</div>
                    <pre class="min-h-5 font-mono text-[13px] break-all whitespace-pre-wrap">{{ r.text.trim() ? r.text : "—" }}</pre>
                </div>
                <CopyButton :text="r.text" icon-only />
            </div>
        </div>
    </ToolPage>
</template>
