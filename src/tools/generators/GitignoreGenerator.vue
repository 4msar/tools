<script setup lang="ts">
import { T } from "./gitignoreTemplates";
import { useHandoff } from "@/composables/handoff";
import { computed, ref } from "vue";
import { Download, Search, X } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Panel, ToolPage } from "@/components/ui";
import { downloadBlob } from "@/composables/useClipboard";


const groups = ["Languages", "Frameworks", "Tools", "Editors", "OS"] as const;
const selected = ref<string[]>(["node", "env", "vscode", "macos"]);
const query = ref("");
const dedupe = ref(true);
const custom = ref("");

const visible = computed(() => {
    const q = query.value.trim().toLowerCase();
    return groups.map((g) => ({ g, items: T.filter((t) => t.group === g && (!q || t.name.toLowerCase().includes(q) || t.id.includes(q))) })).filter((x) => x.items.length);
});

function toggle(id: string) {
    const i = selected.value.indexOf(id);
    if (i < 0) selected.value.push(id);
    else selected.value.splice(i, 1);
}

const output = computed(() => {
    const seen = new Set<string>();
    const blocks: string[] = [];
    const add = (title: string, rules: string) => {
        const lines = rules.split("\n").map((l) => l.trimEnd()).filter((l) => {
            if (!l || l.startsWith("#") || !dedupe.value) return !!l;
            if (seen.has(l)) return false;
            seen.add(l);
            return true;
        });
        if (lines.some((l) => !l.startsWith("#"))) blocks.push(`# ${title}\n${lines.join("\n")}`);
    };
    for (const t of T) if (selected.value.includes(t.id)) add(t.name, t.rules);
    if (custom.value.trim()) add("Custom", custom.value);
    return blocks.length ? blocks.join("\n\n") + "\n" : "";
});

const ruleCount = computed(() => output.value.split("\n").filter((l) => l && !l.startsWith("#")).length);

// Input sent from the chat assistant.
useHandoff<{ input?: string; selected?: string[] }>("gitignore-generator", (p) => {
    if (p.selected?.length) selected.value = p.selected.filter((id) => T.some((t) => t.id === id));
    else if (p.input) query.value = p.input;
});
</script>

<template>
    <ToolPage>
        <div class="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <div class="flex min-w-0 flex-col gap-4">
                <Panel title="Templates">
                    <template #actions><Btn size="sm" variant="ghost" :disabled="!selected.length" @click="selected = []"><X /> Clear</Btn></template>
                    <div class="relative mb-3">
                        <Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
                        <input v-model="query" class="input !pl-9" placeholder="Search languages, frameworks, editors…" aria-label="Search templates" />
                    </div>
                    <div class="flex flex-col gap-3">
                        <div v-for="grp in visible" :key="grp.g">
                            <div class="mb-1.5 text-xs font-medium text-muted uppercase">{{ grp.g }}</div>
                            <div class="flex flex-wrap gap-1.5">
                                <button
                                    v-for="t in grp.items" :key="t.id" type="button" :aria-pressed="selected.includes(t.id)"
                                    class="cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors"
                                    :class="selected.includes(t.id) ? 'border-accent bg-accent/10 font-medium text-fg' : 'border-line text-muted hover:text-fg'"
                                    @click="toggle(t.id)"
                                >{{ t.name }}</button>
                            </div>
                        </div>
                        <p v-if="!visible.length" class="text-sm text-muted">No template matches "{{ query }}".</p>
                    </div>
                </Panel>
                <Panel title="Custom rules" flush>
                    <CodeArea v-model="custom" height="7rem" placeholder="One pattern per line, e.g.&#10;/uploads&#10;*.local.json" />
                </Panel>
            </div>

            <Panel title=".gitignore" flush>
                <template #actions>
                    <label class="mr-1 flex items-center gap-2 text-xs"><input v-model="dedupe" type="checkbox" class="checkbox" /> Remove duplicates</label>
                    <Btn size="sm" variant="ghost" :disabled="!output" @click="downloadBlob(output, '.gitignore')"><Download /> Download</Btn>
                    <CopyButton :text="output" />
                </template>
                <CodeArea language="bash" :model-value="output" readonly :wrap="false" height="34rem" placeholder="Pick templates to build your .gitignore" />
                <div class="border-t border-line px-4 py-2 text-xs text-muted">{{ selected.length }} template{{ selected.length === 1 ? "" : "s" }} · {{ ruleCount }} rules</div>
            </Panel>
        </div>
    </ToolPage>
</template>
