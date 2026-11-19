<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useDebounceFn, useStorage } from "@vueuse/core";
import { Download, Maximize, RotateCcw, ZoomIn, ZoomOut } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Notice, Panel, ToolPage } from "@/components/ui";
import { isDark } from "@/composables/prefs";

const TEMPLATES: Record<string, string> = {
    Flowchart: `flowchart TD
    A[Start] --> B{Is it working?}
    B -- Yes --> C[Ship it]
    B -- No --> D[Debug]
    D --> B`,
    Sequence: `sequenceDiagram
    participant U as User
    participant S as Server
    U->>S: Request
    S-->>U: Response
    Note over U,S: Done`,
    Class: `classDiagram
    class Animal {
        +String name
        +eat()
    }
    class Dog {
        +bark()
    }
    Animal <|-- Dog`,
    State: `stateDiagram-v2
    [*] --> Idle
    Idle --> Running: start
    Running --> Idle: stop
    Running --> [*]: finish`,
    ER: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    CUSTOMER {
        string name
        string email
    }`,
    Gantt: `gantt
    title Project plan
    dateFormat YYYY-MM-DD
    section Build
    Design :a1, 2025-01-01, 7d
    Develop :after a1, 10d
    section Launch
    Test :5d`,
    Pie: `pie title Pets
    "Dogs" : 45
    "Cats" : 35
    "Birds" : 20`,
    Mindmap: `mindmap
  root((Project))
    Plan
      Scope
      Budget
    Build
      Frontend
      Backend`,
    Timeline: `timeline
    title History
    2020 : Started
    2022 : Beta release
    2024 : Version 1.0`,
    GitGraph: `gitGraph
    commit
    branch feature
    checkout feature
    commit
    checkout main
    merge feature`,
};

const code = useStorage("tools:mermaid:code", TEMPLATES.Flowchart);
const themeSel = useStorage<"auto" | "default" | "neutral" | "dark" | "forest" | "base">("tools:mermaid:theme", "auto");
const bg = useStorage<"transparent" | "white" | "dark">("tools:mermaid:bg", "transparent");
const template = ref("");
const svg = ref("");
const error = ref("");
const loading = ref(false);
const zoom = ref(1);
const viewport = ref<HTMLElement | null>(null);
const holder = ref<HTMLElement | null>(null);

const effectiveTheme = computed(() => (themeSel.value === "auto" ? (isDark.value ? "dark" : "default") : themeSel.value));
const bgClass = computed(() => ({ transparent: "bg-subtle", white: "bg-white", dark: "bg-neutral-900" })[bg.value]);

let mermaidMod: typeof import("mermaid").default | null = null;
let counter = 0;
let renderToken = 0;

function cleanup(id: string) {
    document.getElementById(id)?.remove();
    document.getElementById("d" + id)?.remove();
}

async function render() {
    const src = code.value;
    const token = ++renderToken;
    if (!src.trim()) {
        svg.value = "";
        error.value = "";
        return;
    }
    try {
        if (!mermaidMod) {
            loading.value = true;
            mermaidMod = (await import("mermaid")).default;
        }
        mermaidMod.initialize({ startOnLoad: false, securityLevel: "strict", theme: effectiveTheme.value });
        const id = `mmd-${Date.now()}-${counter++}`;
        try {
            const res = await mermaidMod.render(id, src);
            if (token !== renderToken) return;
            svg.value = res.svg;
            error.value = "";
        } finally {
            cleanup(id);
        }
    } catch (e) {
        if (token !== renderToken) return;
        error.value = e instanceof Error ? e.message : String(e);
    } finally {
        loading.value = false;
    }
}
const debounced = useDebounceFn(render, 300);
watch(code, () => debounced());
watch(effectiveTheme, () => render());
render();

onBeforeUnmount(() => {
    renderToken++;
    document.querySelectorAll('[id^="dmmd-"]').forEach((n) => n.remove());
});

watch(template, (t) => {
    if (t && TEMPLATES[t]) code.value = TEMPLATES[t];
    template.value = "";
});

function zoomBy(f: number) {
    zoom.value = Math.min(5, Math.max(0.2, +(zoom.value * f).toFixed(3)));
}
function svgSize() {
    const el = holder.value?.querySelector("svg");
    if (!el) return { w: 0, h: 0 };
    const vb = el.viewBox.baseVal;
    if (vb && vb.width) return { w: vb.width, h: vb.height };
    const r = el.getBoundingClientRect();
    return { w: r.width / zoom.value, h: r.height / zoom.value };
}
function fit() {
    const { w, h } = svgSize();
    const vp = viewport.value;
    if (!w || !vp) return;
    zoom.value = Math.min(5, Math.max(0.2, Math.min((vp.clientWidth - 24) / w, (vp.clientHeight - 24) / h)));
}

function sizedSvg() {
    const { w, h } = svgSize();
    const doc = new DOMParser().parseFromString(svg.value, "image/svg+xml");
    const root = doc.documentElement;
    root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    if (w) {
        root.setAttribute("width", String(w));
        root.setAttribute("height", String(h));
    }
    root.removeAttribute("style");
    return { text: new XMLSerializer().serializeToString(root), w, h };
}
function save(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadSvg() {
    if (!svg.value) return;
    save(new Blob([sizedSvg().text], { type: "image/svg+xml" }), "diagram.svg");
}
async function downloadPng() {
    if (!svg.value) return;
    const { text, w, h } = sizedSvg();
    if (!w) return;
    const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml;charset=utf-8" }));
    try {
        const img = new Image();
        img.src = url;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w * 2);
        canvas.height = Math.round(h * 2);
        const ctx = canvas.getContext("2d")!;
        if (bg.value !== "transparent") {
            ctx.fillStyle = bg.value === "dark" ? "#171717" : "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
        if (blob) save(blob, "diagram.png");
    } catch {
        error.value = "PNG export failed in this browser; try SVG export instead.";
    } finally {
        URL.revokeObjectURL(url);
    }
}
</script>

<template>
    <ToolPage>
        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="Mermaid code" flush>
                <template #actions>
                    <select v-model="template" class="select !w-auto !py-1 text-xs" aria-label="Templates">
                        <option value="">Templates…</option>
                        <option v-for="(_, k) in TEMPLATES" :key="k" :value="k">{{ k }}</option>
                    </select>
                    <Btn size="sm" variant="ghost" @click="code = TEMPLATES.Flowchart"><RotateCcw /> Reset</Btn>
                </template>
                <CodeArea v-model="code" :wrap="false" height="32rem" placeholder="Write Mermaid…" :invalid="!!error" />
            </Panel>

            <Panel title="Preview" flush>
                <template #actions>
                    <select v-model="themeSel" class="select !w-auto !py-1 text-xs" aria-label="Theme">
                        <option value="auto">Theme: auto</option>
                        <option v-for="t in ['default', 'neutral', 'dark', 'forest', 'base']" :key="t" :value="t">{{ t }}</option>
                    </select>
                    <select v-model="bg" class="select !w-auto !py-1 text-xs" aria-label="Background">
                        <option value="transparent">Bg: transparent</option>
                        <option value="white">Bg: white</option>
                        <option value="dark">Bg: dark</option>
                    </select>
                </template>
                <div class="flex flex-wrap items-center gap-1 border-b border-line px-3 py-2">
                    <Btn size="sm" variant="ghost" title="Zoom out" @click="zoomBy(1 / 1.2)"><ZoomOut /></Btn>
                    <span class="w-12 text-center font-mono text-xs text-muted">{{ Math.round(zoom * 100) }}%</span>
                    <Btn size="sm" variant="ghost" title="Zoom in" @click="zoomBy(1.2)"><ZoomIn /></Btn>
                    <Btn size="sm" variant="ghost" @click="zoom = 1">100%</Btn>
                    <Btn size="sm" variant="ghost" @click="fit"><Maximize /> Fit</Btn>
                    <span class="flex-1" />
                    <CopyButton :text="svg" label="Copy SVG" />
                    <Btn size="sm" variant="ghost" :disabled="!svg" @click="downloadSvg"><Download /> SVG</Btn>
                    <Btn size="sm" variant="ghost" :disabled="!svg" @click="downloadPng"><Download /> PNG</Btn>
                </div>
                <div ref="viewport" class="h-[28rem] overflow-auto p-3" :class="bgClass">
                    <p v-if="loading && !svg" class="text-sm text-muted">Loading Mermaid…</p>
                    <p v-else-if="!svg && !error" class="text-sm text-muted">Nothing to render.</p>
                    <div ref="holder" class="inline-block origin-top-left" :style="{ transform: `scale(${zoom})` }" v-html="svg" />
                </div>
            </Panel>
        </div>
        <Notice v-if="error" type="error"><pre class="whitespace-pre-wrap font-mono text-xs">{{ error }}</pre></Notice>
    </ToolPage>
</template>
