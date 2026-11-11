<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Download } from "lucide-vue-next";
import figlet from "figlet";
import type { FontName } from "figlet";
import { Btn, CopyButton, Field, Notice, Panel, ToolPage } from "@/components/ui";
import { downloadBlob } from "@/composables/useClipboard";

// Each font is its own lazy chunk, so only the fonts you pick are downloaded.
const FONTS: Record<string, () => Promise<{ default: string }>> = {
    "Standard": () => import("figlet/importable-fonts/Standard.js"),
    "Slant": () => import("figlet/importable-fonts/Slant.js"),
    "Small": () => import("figlet/importable-fonts/Small.js"),
    "Small Slant": () => import("figlet/importable-fonts/Small Slant.js"),
    "Big": () => import("figlet/importable-fonts/Big.js"),
    "ANSI Shadow": () => import("figlet/importable-fonts/ANSI Shadow.js"),
    "ANSI Regular": () => import("figlet/importable-fonts/ANSI Regular.js"),
    "Banner": () => import("figlet/importable-fonts/Banner.js"),
    "Block": () => import("figlet/importable-fonts/Block.js"),
    "Bubble": () => import("figlet/importable-fonts/Bubble.js"),
    "Calvin S": () => import("figlet/importable-fonts/Calvin S.js"),
    "Colossal": () => import("figlet/importable-fonts/Colossal.js"),
    "Digital": () => import("figlet/importable-fonts/Digital.js"),
    "Doom": () => import("figlet/importable-fonts/Doom.js"),
    "Epic": () => import("figlet/importable-fonts/Epic.js"),
    "Ghost": () => import("figlet/importable-fonts/Ghost.js"),
    "Graffiti": () => import("figlet/importable-fonts/Graffiti.js"),
    "Isometric1": () => import("figlet/importable-fonts/Isometric1.js"),
    "Larry 3D": () => import("figlet/importable-fonts/Larry 3D.js"),
    "Lean": () => import("figlet/importable-fonts/Lean.js"),
    "Mini": () => import("figlet/importable-fonts/Mini.js"),
    "Ogre": () => import("figlet/importable-fonts/Ogre.js"),
    "Rectangles": () => import("figlet/importable-fonts/Rectangles.js"),
    "Roman": () => import("figlet/importable-fonts/Roman.js"),
    "Script": () => import("figlet/importable-fonts/Script.js"),
    "Shadow": () => import("figlet/importable-fonts/Shadow.js"),
    "Speed": () => import("figlet/importable-fonts/Speed.js"),
    "Star Wars": () => import("figlet/importable-fonts/Star Wars.js"),
    "3D-ASCII": () => import("figlet/importable-fonts/3D-ASCII.js"),
};
const fontNames = Object.keys(FONTS);

const text = ref("DevTools");
const font = ref("Standard");
const layout = ref<"default" | "full" | "fitted" | "controlled smushing">("default");
const width = ref(80);
const wrapAs = ref<"none" | "slash" | "hash" | "block" | "html" | "sql">("none");
const showAll = ref(false);

const loaded = ref<string[]>([]);
const loadError = ref("");
async function load(name: string) {
    if (loaded.value.includes(name)) return;
    const mod = await FONTS[name]();
    figlet.parseFont(name as FontName, mod.default);
    loaded.value = [...loaded.value, name];
}
watch(font, (f) => load(f).catch(() => (loadError.value = `Could not load the ${f} font.`)), { immediate: true });
watch(showAll, async (on) => {
    if (on) await Promise.all(fontNames.map((f) => load(f).catch(() => {})));
});

function render(name: string): string {
    if (!text.value || !loaded.value.includes(name)) return "";
    try {
        return text.value
            .split("\n")
            .map((line) => figlet.textSync(line || " ", { font: name as FontName, horizontalLayout: layout.value, width: width.value || 80, whitespaceBreak: true }))
            .join("\n")
            .split("\n")
            .map((l) => l.trimEnd())
            .join("\n")
            .replace(/^\n+|\n+$/g, "");
    } catch (e) {
        return `Error: ${(e as Error).message}`;
    }
}

function wrap(art: string): string {
    const lines = art.split("\n");
    switch (wrapAs.value) {
        case "slash": return lines.map((l) => `// ${l}`.trimEnd()).join("\n");
        case "hash": return lines.map((l) => `# ${l}`.trimEnd()).join("\n");
        case "sql": return lines.map((l) => `-- ${l}`.trimEnd()).join("\n");
        case "block": return `/*\n${lines.map((l) => ` * ${l}`.trimEnd()).join("\n")}\n */`;
        case "html": return `<!--\n${art}\n-->`;
        default: return art;
    }
}

const output = computed(() => wrap(render(font.value)));
const gallery = computed(() => (showAll.value ? fontNames.map((f) => ({ f, art: render(f) })).filter((x) => x.art) : []));
</script>

<template>
    <ToolPage>
        <Panel>
            <div class="grid gap-3 lg:grid-cols-[1fr_12rem_12rem_7rem_12rem]">
                <Field label="Text">
                    <textarea v-model="text" class="input min-h-[38px] font-mono" rows="1" spellcheck="false" placeholder="Type something…" />
                </Field>
                <Field label="Font">
                    <select v-model="font" class="select"><option v-for="f in fontNames" :key="f">{{ f }}</option></select>
                </Field>
                <Field label="Letter spacing">
                    <select v-model="layout" class="select">
                        <option value="default">Font default</option><option value="full">Full width</option><option value="fitted">Fitted</option><option value="controlled smushing">Smushed</option>
                    </select>
                </Field>
                <Field label="Max width">
                    <input v-model.number="width" type="number" min="20" max="400" class="input" />
                </Field>
                <Field label="Wrap as comment">
                    <select v-model="wrapAs" class="select">
                        <option value="none">No</option><option value="slash">// line</option><option value="hash"># line</option><option value="sql">-- line</option><option value="block">/* block */</option><option value="html">&lt;!-- HTML --&gt;</option>
                    </select>
                </Field>
            </div>
        </Panel>

        <Notice v-if="loadError" type="error">{{ loadError }}</Notice>

        <Panel :title="font" flush>
            <template #actions>
                <Btn size="sm" variant="ghost" :disabled="!output" @click="downloadBlob(output, 'ascii-art.txt')"><Download /> Download</Btn>
                <CopyButton :text="output" />
            </template>
            <pre class="min-h-32 overflow-auto p-4 font-mono text-[13px] leading-[1.15]">{{ output || (text ? "Loading font…" : "Type some text above.") }}</pre>
        </Panel>

        <Panel title="All fonts" flush>
            <template #actions><label class="flex items-center gap-2 text-sm"><input v-model="showAll" type="checkbox" class="checkbox" /> Preview every font</label></template>
            <p v-if="!showAll" class="p-4 text-sm text-muted">Turn this on to compare your text in all {{ fontNames.length }} fonts (downloads every font file).</p>
            <ul v-else class="divide-y divide-line">
                <li v-for="g in gallery" :key="g.f" class="p-4">
                    <div class="mb-2 flex items-center justify-between gap-2">
                        <button type="button" class="cursor-pointer text-sm font-medium hover:text-accent" @click="font = g.f">{{ g.f }}</button>
                        <CopyButton :text="wrap(g.art)" icon-only />
                    </div>
                    <pre class="overflow-auto font-mono text-xs leading-[1.15] text-muted">{{ g.art }}</pre>
                </li>
            </ul>
        </Panel>
    </ToolPage>
</template>
