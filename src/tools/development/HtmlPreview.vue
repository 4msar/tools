<script setup lang="ts">
import { computed, ref } from "vue";
import { useStorage } from "@vueuse/core";
import { Monitor, RotateCcw, Smartphone, Tablet } from "lucide-vue-next";
import { Btn, CodeArea, Notice, Panel, Tabs, ToolPage } from "@/components/ui";

const SAMPLE = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; background: #f5f3ff; color: #1e1b4b; }
    .card { max-width: 28rem; margin: auto; background: #fff; padding: 1.5rem; border-radius: 1rem; box-shadow: 0 10px 30px #4f46e533; }
    button { background: #4f46e5; color: #fff; border: 0; padding: .6rem 1rem; border-radius: .6rem; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Hello, preview</h1>
    <p>This frame is sandboxed and has no network access.</p>
    <button onclick="this.textContent = 'Clicked ' + (++window.n || (window.n = 1))">Click me</button>
  </div>
</body>
</html>`;

const html = useStorage("tools:html-preview:code", SAMPLE);
const width = ref<"mobile" | "tablet" | "full">("full");

const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:">`;

const srcdoc = computed(() => CSP + html.value);

const frameWidth = computed(() => ({ mobile: "375px", tablet: "768px", full: "100%" })[width.value]);
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs
                v-model="width"
                size="sm"
                :options="[
                    { value: 'mobile', label: 'Mobile' },
                    { value: 'tablet', label: 'Tablet' },
                    { value: 'full', label: 'Full' },
                ]"
            />
        </template>

        <Notice type="info">Rendered in a sandboxed frame with scripts allowed but no network access, no cookies and no storage.</Notice>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="HTML" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="html = SAMPLE"><RotateCcw /> Reset</Btn>
                </template>
                <CodeArea v-model="html" :wrap="false" height="28rem" placeholder="Write HTML…" />
            </Panel>
            <Panel flush>
                <template #title>
                    <span class="inline-flex items-center gap-1.5">
                        <Smartphone v-if="width === 'mobile'" class="size-4" />
                        <Tablet v-else-if="width === 'tablet'" class="size-4" />
                        <Monitor v-else class="size-4" />
                        Preview
                    </span>
                </template>
                <div class="min-h-[28rem] flex-1 overflow-auto bg-subtle p-3">
                    <iframe
                        :srcdoc="srcdoc"
                        sandbox="allow-scripts"
                        title="HTML preview"
                        class="mx-auto block h-[27rem] max-w-full rounded-md border border-line bg-white"
                        :style="{ width: frameWidth }"
                    />
                </div>
            </Panel>
        </div>
    </ToolPage>
</template>
