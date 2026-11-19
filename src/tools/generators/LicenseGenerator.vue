<script setup lang="ts">
import { computed } from "vue";
import { useStorage } from "@vueuse/core";
import { Download, ExternalLink } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Field, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { fillTemplate, licenses } from "./licenses";

type Style = "slash" | "block" | "hash" | "html";

const licenseId = useStorage("tools:license:id", "MIT");
const year = useStorage("tools:license:year", String(new Date().getFullYear()));
const holder = useStorage("tools:license:holder", "");
const project = useStorage("tools:license:project", "");
const style = useStorage<Style>("tools:license:style", "slash");

const styleOptions: { value: Style; label: string }[] = [
    { value: "slash", label: "//" },
    { value: "block", label: "/* */" },
    { value: "hash", label: "#" },
    { value: "html", label: "<!-- -->" },
];

const lic = computed(() => licenses.find((l) => l.id === licenseId.value) ?? licenses[0]!);
const vars = computed(() => ({ year: year.value, holder: holder.value, project: project.value }));
const text = computed(() => fillTemplate(lic.value.body, vars.value));

const header = computed(() => {
    const lines = fillTemplate(lic.value.header, vars.value).split("\n");
    switch (style.value) {
        case "block":
            return ["/*", ...lines.map((l) => (l ? ` * ${l}` : " *")), " */"].join("\n");
        case "hash":
            return lines.map((l) => (l ? `# ${l}` : "#")).join("\n");
        case "html":
            return `<!--\n${lines.join("\n")}\n-->`;
        default:
            return lines.map((l) => (l ? `// ${l}` : "//")).join("\n");
    }
});

const groups = computed(() => [
    { title: "Permissions", items: lic.value.permissions, dot: "bg-accent" },
    { title: "Conditions", items: lic.value.conditions, dot: "bg-info" },
    { title: "Limitations", items: lic.value.limitations, dot: "bg-danger" },
]);

function download() {
    const url = URL.createObjectURL(new Blob([text.value], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "LICENSE";
    a.click();
    URL.revokeObjectURL(url);
}
</script>

<template>
    <ToolPage>
        <div class="grid gap-4 lg:grid-cols-[22rem_1fr]">
            <div class="space-y-4">
                <Panel title="License">
                    <div class="space-y-3">
                        <Field label="License">
                            <select v-model="licenseId" class="select">
                                <option v-for="l in licenses" :key="l.id" :value="l.id">{{ l.name }}</option>
                            </select>
                        </Field>
                        <Field label="Year"><input v-model="year" class="input" placeholder="2025" /></Field>
                        <Field label="Copyright holder"><input v-model="holder" class="input" placeholder="Your Name or Company" /></Field>
                        <Field label="Project name (optional)"><input v-model="project" class="input" placeholder="my-project" /></Field>
                    </div>
                </Panel>

                <Panel title="At a glance">
                    <p class="text-sm text-muted">{{ lic.summary }}</p>
                    <div class="mt-3 space-y-3">
                        <div v-for="g in groups" :key="g.title">
                            <div class="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">{{ g.title }}</div>
                            <div v-if="g.items.length" class="flex flex-wrap gap-1.5">
                                <span v-for="i in g.items" :key="i" class="chip"><span class="size-1.5 rounded-full" :class="g.dot" />{{ i }}</span>
                            </div>
                            <span v-else class="text-xs text-muted">None</span>
                        </div>
                    </div>
                    <div class="mt-4 flex items-center justify-between gap-2 text-sm">
                        <span>SPDX: <code class="code">{{ lic.spdx }}</code></span>
                        <a :href="lic.url" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-accent hover:underline">Official text <ExternalLink class="size-3.5" /></a>
                    </div>
                </Panel>
            </div>

            <div class="space-y-4">
                <Notice v-if="!lic.full" type="info">
                    The full {{ lic.name }} text is very long. This file contains the standard notice and a link; download the complete text from the
                    <a :href="lic.url" target="_blank" rel="noopener" class="underline">official source</a> before distributing.
                </Notice>
                <Panel title="LICENSE" flush>
                    <template #actions>
                        <CopyButton :text="text" />
                        <Btn size="sm" variant="ghost" @click="download"><Download /> Download</Btn>
                    </template>
                    <CodeArea :model-value="text" readonly height="22rem" />
                </Panel>
                <Panel title="Source file header" flush>
                    <template #actions>
                        <Tabs v-model="style" size="sm" :options="styleOptions" />
                        <CopyButton :text="header" />
                    </template>
                    <CodeArea :model-value="header" readonly height="9rem" :wrap="false" />
                </Panel>
            </div>
        </div>
    </ToolPage>
</template>
