<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useStorage } from "@vueuse/core";
import { toast } from "vue-sonner";
import { Copy, Download, FileCode2, RotateCcw } from "lucide-vue-next";
import { Btn, CodeArea, Field, Panel, Tabs, ToolPage } from "@/components/ui";
import { loadHighlighter } from "@/composables/useHighlighter";
import { downloadBlob } from "@/composables/useClipboard";
import { useHandoff } from "@/composables/handoff";
import { backdrops, draw, FONT_LOAD, themes, tokenize, toSvg, type ImageOptions } from "./codeImage";

const sample = `// Fetch a user and greet them
async function greet(id: number): Promise<string> {
    const res = await fetch(\`/api/users/\${id}\`);
    if (!res.ok) throw new Error("User not found");
    const { name } = await res.json();
    return \`Hello, \${name}!\`;
}`;

const languages = [
    ["auto", "Auto-detect"], ["typescript", "TypeScript"], ["javascript", "JavaScript"], ["python", "Python"],
    ["go", "Go"], ["rust", "Rust"], ["java", "Java"], ["kotlin", "Kotlin"], ["swift", "Swift"], ["csharp", "C#"],
    ["php", "PHP"], ["ruby", "Ruby"], ["bash", "Shell"], ["sql", "SQL"], ["json", "JSON"], ["yaml", "YAML"],
    ["xml", "HTML / XML"], ["css", "CSS"], ["scss", "SCSS"], ["markdown", "Markdown"], ["graphql", "GraphQL"],
    ["dockerfile", "Dockerfile"], ["ini", "INI / TOML"], ["nginx", "Nginx"], ["plaintext", "Plain text"],
] as const;

const defaults = {
    language: "auto",
    theme: "midnight",
    background: "aurora",
    solid: "#1e293b",
    padding: 64,
    fontSize: 15,
    lineNumbers: false,
    window: "mac" as ImageOptions["window"],
    title: "",
    shadow: true,
    radius: 12,
    scale: 2,
};
const code = useStorage("devtools:code-image:code", sample);
const s = useStorage("devtools:code-image:settings", { ...defaults }, undefined, { mergeDefaults: true });

const hl = loadHighlighter();
const canvas = ref<HTMLCanvasElement>();
const size = ref({ width: 0, height: 0 });
const fontsReady = ref(0);

const options = computed<ImageOptions>(() => ({
    theme: themes.find((t) => t.id === s.value.theme) ?? themes[0],
    background: s.value.background,
    solid: s.value.solid,
    padding: s.value.padding,
    fontSize: s.value.fontSize,
    lineNumbers: s.value.lineNumbers,
    window: s.value.window,
    title: s.value.title,
    shadow: s.value.shadow,
    radius: s.value.radius,
}));

const lines = computed(() => {
    void fontsReady.value;
    const h = hl.value;
    const src = code.value.replace(/\s+$/, "") || " ";
    const html = h && s.value.language !== "plaintext" ? h.highlightCode(src, s.value.language) : src.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    return tokenize(html);
});

function render() {
    if (!canvas.value) return;
    size.value = draw(canvas.value, lines.value, options.value, Math.max(2, window.devicePixelRatio || 1));
}
watch([lines, options], render, { deep: true });
onMounted(async () => {
    render();
    // Canvas text uses whatever font is loaded at draw time, so redraw once the web fonts arrive.
    await Promise.allSettled(FONT_LOAD.map((f) => document.fonts.load(f)));
    fontsReady.value++;
});

const fileBase = computed(() => (s.value.title.trim().replace(/[^\w.-]+/g, "-").replace(/\.\w+$/, "") || "code"));

function exportCanvas() {
    const c = document.createElement("canvas");
    draw(c, lines.value, options.value, s.value.scale);
    return c;
}
const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("empty"))), "image/png"));

async function downloadPng() {
    try {
        downloadBlob(await toBlob(exportCanvas()), `${fileBase.value}.png`, "image/png");
    } catch {
        toast.error("Could not create the image");
    }
}

function downloadSvg() {
    downloadBlob(toSvg(lines.value, options.value), `${fileBase.value}.svg`, "image/svg+xml");
}

async function copyImage() {
    try {
        // Safari needs the ClipboardItem built synchronously from a promise.
        await navigator.clipboard.write([new ClipboardItem({ "image/png": toBlob(exportCanvas()) })]);
        toast.success("Image copied to clipboard");
    } catch {
        toast.error("This browser can't copy images. Download the PNG instead.");
    }
}

function reset() {
    s.value = { ...defaults };
}

useHandoff<{ input?: string; language?: string }>("code-to-image", (p) => {
    if (p.input) code.value = p.input;
    if (p.language && languages.some(([id]) => id === p.language)) s.value.language = p.language;
});

const paddings = [0, 16, 32, 64, 96, 128].map((v) => ({ value: v, label: String(v) }));
const scales = [1, 2, 3, 4].map((v) => ({ value: v, label: `${v}x` }));
const windowStyles = [
    { value: "mac" as const, label: "macOS" },
    { value: "plain" as const, label: "Plain" },
    { value: "none" as const, label: "None" },
];
const exportSize = computed(() => `${Math.round(size.value.width * s.value.scale)} × ${Math.round(size.value.height * s.value.scale)} px`);
</script>

<template>
    <ToolPage>
        <div class="grid gap-4 lg:grid-cols-[20rem_1fr]">
            <div class="order-2 space-y-4 lg:order-1">
                <Panel title="Style">
                    <template #actions>
                        <Btn size="sm" variant="ghost" title="Reset style" @click="reset"><RotateCcw class="size-3.5" />Reset</Btn>
                    </template>
                    <div class="space-y-4">
                        <Field label="Language">
                            <select v-model="s.language" class="select">
                                <option v-for="[id, name] in languages" :key="id" :value="id">{{ name }}</option>
                            </select>
                        </Field>
                        <div>
                            <span class="label">Theme</span>
                            <div class="grid grid-cols-3 gap-1.5">
                                <button
                                    v-for="t in themes"
                                    :key="t.id"
                                    type="button"
                                    class="flex cursor-pointer flex-col items-start gap-1 rounded-md border p-2 text-left text-xs transition-colors"
                                    :class="s.theme === t.id ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-fg-subtle'"
                                    :aria-pressed="s.theme === t.id"
                                    @click="s.theme = t.id"
                                >
                                    <span class="flex w-full gap-0.5 rounded px-1.5 py-1" :style="{ background: t.bg }">
                                        <span v-for="k in ['keyword', 'string', 'title', 'number'] as const" :key="k" class="h-1.5 flex-1 rounded-full" :style="{ background: t.colors[k] }" />
                                    </span>
                                    <span class="text-fg">{{ t.name }}</span>
                                </button>
                            </div>
                        </div>
                        <div>
                            <span class="label">Background</span>
                            <div class="flex flex-wrap gap-1.5">
                                <button
                                    v-for="b in backdrops"
                                    :key="b.id"
                                    type="button"
                                    class="size-8 cursor-pointer rounded-md ring-offset-2 ring-offset-surface transition-shadow"
                                    :class="s.background === b.id ? 'ring-2 ring-accent' : 'ring-1 ring-line'"
                                    :style="{ background: `linear-gradient(135deg, ${b.stops.join(', ')})` }"
                                    :title="b.name"
                                    :aria-label="`${b.name} background`"
                                    :aria-pressed="s.background === b.id"
                                    @click="s.background = b.id"
                                />
                                <label
                                    class="relative size-8 cursor-pointer overflow-hidden rounded-md ring-offset-2 ring-offset-surface"
                                    :class="s.background === 'solid' ? 'ring-2 ring-accent' : 'ring-1 ring-line'"
                                    :style="{ background: s.solid }"
                                    title="Solid colour"
                                    @click="s.background = 'solid'"
                                >
                                    <input v-model="s.solid" type="color" class="absolute inset-0 cursor-pointer opacity-0" aria-label="Solid background colour" />
                                </label>
                                <button
                                    type="button"
                                    class="size-8 cursor-pointer rounded-md bg-[repeating-conic-gradient(#cbd5e1_0_25%,#fff_0_50%)] bg-size-[10px_10px] ring-offset-2 ring-offset-surface"
                                    :class="s.background === 'none' ? 'ring-2 ring-accent' : 'ring-1 ring-line'"
                                    title="Transparent"
                                    aria-label="Transparent background"
                                    :aria-pressed="s.background === 'none'"
                                    @click="s.background = 'none'"
                                />
                            </div>
                        </div>
                        <Field label="Padding"><Tabs v-model="s.padding" size="sm" :options="paddings" /></Field>
                        <Field label="Window"><Tabs v-model="s.window" size="sm" :options="windowStyles" /></Field>
                        <Field v-if="s.window !== 'none'" label="Title">
                            <input v-model="s.title" class="input" placeholder="e.g. greet.ts" maxlength="80" />
                        </Field>
                        <Field :label="`Font size: ${s.fontSize}px`">
                            <input v-model.number="s.fontSize" type="range" min="11" max="24" class="range" />
                        </Field>
                        <Field :label="`Corner radius: ${s.radius}px`">
                            <input v-model.number="s.radius" type="range" min="0" max="24" class="range" />
                        </Field>
                        <div class="flex flex-wrap gap-x-5 gap-y-2 text-sm text-fg">
                            <label class="flex items-center gap-2"><input v-model="s.lineNumbers" type="checkbox" class="checkbox" />Line numbers</label>
                            <label class="flex items-center gap-2"><input v-model="s.shadow" type="checkbox" class="checkbox" />Shadow</label>
                        </div>
                    </div>
                </Panel>
            </div>
            <div class="order-1 min-w-0 space-y-4 lg:order-2">
                <Panel>
                    <template #title>Preview</template>
                    <template #actions>
                        <Tabs v-model="s.scale" size="sm" :options="scales" />
                        <span class="hidden px-1 text-xs text-fg-subtle sm:inline">{{ exportSize }}</span>
                    </template>
                    <div
                        class="grid min-h-48 place-items-center overflow-auto rounded-lg bg-[repeating-conic-gradient(var(--subtle)_0_25%,transparent_0_50%)] bg-size-[16px_16px] p-2"
                    >
                        <canvas
                            ref="canvas"
                            class="h-auto max-w-full"
                            :style="{ width: `${size.width}px` }"
                            role="img"
                            :aria-label="`Code image preview, ${lines.length} lines`"
                        />
                    </div>
                    <div class="mt-4 flex flex-wrap gap-2">
                        <Btn variant="primary" @click="downloadPng"><Download class="size-4" />Download PNG</Btn>
                        <Btn @click="copyImage"><Copy class="size-4" />Copy image</Btn>
                        <Btn @click="downloadSvg"><FileCode2 class="size-4" />Download SVG</Btn>
                    </div>
                </Panel>
                <Panel title="Code" flush>
                    <CodeArea v-model="code" :language="s.language === 'plaintext' ? undefined : s.language" height="16rem" :wrap="false" placeholder="Paste your code here" />
                </Panel>
            </div>
        </div>
    </ToolPage>
</template>
