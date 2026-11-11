<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useDebounceFn, useStorage } from "@vueuse/core";
import { Play, RotateCcw, Trash2 } from "lucide-vue-next";
import { Btn, CodeArea, Panel, Tabs, ToolPage } from "@/components/ui";

const DEFAULTS = {
    html: `<div class="card">
  <h1>Counter</h1>
  <p id="count">0</p>
  <button id="inc">Increment</button>
</div>`,
    css: `body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #f5f3ff; color: #1e1b4b; }
.card { background: #fff; padding: 1.5rem 2rem; border-radius: 1rem; text-align: center; box-shadow: 0 10px 30px #4f46e533; }
#count { font-size: 3rem; margin: .5rem 0; }
button { background: #4f46e5; color: #fff; border: 0; padding: .6rem 1rem; border-radius: .6rem; cursor: pointer; }`,
    js: `let n = 0;
const el = document.getElementById("count");
document.getElementById("inc").addEventListener("click", () => {
  el.textContent = ++n;
  console.log("count is", n);
  if (n === 5) console.warn("getting high!");
});
console.log("ready", { ok: true });`,
};

const code = useStorage("tools:code-playground", { ...DEFAULTS });
const tab = ref<"html" | "css" | "js">("html");

const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:">`;

// Forwards console output and uncaught errors to the parent via postMessage.
const BRIDGE = `<script>(function(){
function fmt(a){try{if(typeof a==="string")return a;if(a instanceof Error)return a.stack||a.message;return JSON.stringify(a,function(k,v){return typeof v==="function"?"[Function]":v===undefined?"[undefined]":v},2)}catch(e){return String(a)}}
function send(t,args){try{parent.postMessage({__pg:true,type:t,text:Array.prototype.map.call(args,fmt).join(" ")},"*")}catch(e){}}
["log","info","warn","error","debug"].forEach(function(m){var o=console[m];console[m]=function(){send(m,arguments);o.apply(console,arguments)}});
window.addEventListener("error",function(e){send("error",[e.message+(e.lineno?" (line "+e.lineno+")":"")])});
window.addEventListener("unhandledrejection",function(e){send("error",["Unhandled rejection: "+fmt(e.reason)])});
})();<\/script>`;

const srcdoc = ref("");
function build() {
    const js = code.value.js.replace(/<\/script/gi, "<\\/script");
    srcdoc.value =
        `<!doctype html><html><head><meta charset="utf-8">${CSP}<meta name="viewport" content="width=device-width, initial-scale=1">` +
        `<style>${code.value.css.replace(/<\/style/gi, "<\\/style")}</style></head><body>${code.value.html}${BRIDGE}<script>${js}<\/script></body></html>`;
}

interface Line {
    type: string;
    text: string;
    id: number;
}
const logs = ref<Line[]>([]);
let seq = 0;

function run() {
    logs.value = [];
    build();
}
const debounced = useDebounceFn(run, 500);
watch(code, debounced, { deep: true });

const frame = ref<HTMLIFrameElement>();
function onMessage(e: MessageEvent) {
    if (e.source !== frame.value?.contentWindow) return;
    const d = e.data as { __pg?: boolean; type?: string; text?: string } | null;
    if (!d || d.__pg !== true) return;
    if (logs.value.length < 500) logs.value.push({ type: d.type ?? "log", text: d.text ?? "", id: seq++ });
}
onMounted(() => {
    window.addEventListener("message", onMessage);
    run();
});
onBeforeUnmount(() => window.removeEventListener("message", onMessage));

function reset() {
    code.value = { ...DEFAULTS };
    run();
}

const labels = { html: "HTML", css: "CSS", js: "JavaScript" };
const current = computed({
    get: () => code.value[tab.value],
    set: (v: string) => {
        code.value = { ...code.value, [tab.value]: v };
    },
});

const color: Record<string, string> = {
    error: "text-danger",
    warn: "text-warning",
    info: "text-accent",
    debug: "text-muted",
    log: "text-fg",
};
</script>

<template>
    <ToolPage>
        <template #actions>
            <Btn variant="primary" size="sm" @click="run"><Play /> Run</Btn>
            <Btn size="sm" @click="reset"><RotateCcw /> Reset</Btn>
        </template>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel flush>
                <template #title>
                    <Tabs v-model="tab" size="sm" :options="(['html', 'css', 'js'] as const).map((v) => ({ value: v, label: labels[v] }))" />
                </template>
                <CodeArea v-model="current" :wrap="false" height="24rem" :placeholder="`${labels[tab]} code…`" />
            </Panel>

            <div class="flex min-w-0 flex-col gap-4">
                <Panel title="Preview" flush>
                    <iframe
                        ref="frame"
                        :srcdoc="srcdoc"
                        sandbox="allow-scripts"
                        title="Code playground preview"
                        class="block h-72 w-full bg-white"
                    />
                </Panel>
                <Panel title="Console" flush>
                    <template #actions>
                        <Btn size="sm" variant="ghost" :disabled="!logs.length" @click="logs = []"><Trash2 /> Clear</Btn>
                    </template>
                    <div class="max-h-48 min-h-24 overflow-auto font-mono text-xs">
                        <p v-if="!logs.length" class="p-3 text-muted">No output yet.</p>
                        <div v-for="l in logs" :key="l.id" class="flex gap-2 border-b border-line px-3 py-1 last:border-0" :class="color[l.type] ?? 'text-fg'">
                            <span class="w-9 shrink-0 text-muted">{{ l.type }}</span>
                            <span class="break-all whitespace-pre-wrap">{{ l.text }}</span>
                        </div>
                    </div>
                </Panel>
            </div>
        </div>
    </ToolPage>
</template>
