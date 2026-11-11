<script setup lang="ts">
import { ref } from "vue";
import { ArrowLeft, Loader2, Wand2 } from "lucide-vue-next";
import type { Plugin } from "prettier";
import { Btn, CodeArea, CopyButton, Notice, Panel, ToolPage } from "@/components/ui";

type Lang = "javascript" | "typescript" | "json" | "css" | "scss" | "html" | "markdown" | "yaml" | "graphql" | "sql";

const langs: { value: Lang; label: string; sample: string }[] = [
    { value: "javascript", label: "JavaScript", sample: `const add=(a,b)=>{return a+b}\nfunction greet(name){if(!name){return 'hi'}else{return \`hello \${name}\`}}\nconsole.log(add(1,2),greet())` },
    { value: "typescript", label: "TypeScript", sample: `interface User{id:number;name:string;tags?:string[]}\nexport function find(users:User[],id:number):User|undefined{return users.find(u=>u.id===id)}` },
    { value: "json", label: "JSON", sample: `{"name":"tools","tags":["a","b"],"nested":{"x":1,"y":[1,2,3]}}` },
    { value: "css", label: "CSS", sample: `.card{display:flex;padding:1rem 2rem;background:#fff}.card:hover{box-shadow:0 2px 8px rgba(0,0,0,.2)}@media(min-width:640px){.card{padding:2rem}}` },
    { value: "scss", label: "SCSS", sample: `$c:#4f46e5;.nav{a{color:$c;&:hover{color:darken($c,10%)}}}@mixin m($p){padding:$p}` },
    { value: "html", label: "HTML", sample: `<!doctype html><html><head><title>Hi</title></head><body><div class="a"><p>Hello <b>world</b></p><ul><li>One</li><li>Two</li></ul></div></body></html>` },
    { value: "markdown", label: "Markdown", sample: `# Title\n*  item one\n*  item two\n\n|a|b|\n|-|-|\n|1|2|\n` },
    { value: "yaml", label: "YAML", sample: `name:   tools\nlist:\n    - a\n    -   b\nobj: {x: 1,   y: 2}` },
    { value: "graphql", label: "GraphQL", sample: `query Q($id:ID!){user(id:$id){id name posts(first:10){edges{node{id title}}}}}` },
    { value: "sql", label: "SQL", sample: `select u.id,u.name,count(o.id) as orders from users u left join orders o on o.user_id=u.id where u.active=1 group by u.id,u.name having count(o.id)>2 order by orders desc limit 10;` },
];

const lang = ref<Lang>("javascript");
const input = ref(langs[0]!.sample);
const output = ref("");
const error = ref("");
const busy = ref(false);
const indent = ref(2);
const printWidth = ref(80);

type PluginLoader = () => Promise<unknown>;
const load = (...fns: PluginLoader[]) => Promise.all(fns.map((f) => f())) as Promise<Plugin[]>;

const parsers: Record<Exclude<Lang, "sql">, { parser: string; plugins: () => Promise<Plugin[]> }> = {
    javascript: { parser: "babel", plugins: () => load(() => import("prettier/plugins/babel"), () => import("prettier/plugins/estree")) },
    typescript: { parser: "typescript", plugins: () => load(() => import("prettier/plugins/typescript"), () => import("prettier/plugins/estree")) },
    json: { parser: "json", plugins: () => load(() => import("prettier/plugins/babel"), () => import("prettier/plugins/estree")) },
    css: { parser: "css", plugins: () => load(() => import("prettier/plugins/postcss")) },
    scss: { parser: "scss", plugins: () => load(() => import("prettier/plugins/postcss")) },
    html: {
        parser: "html",
        plugins: () => load(() => import("prettier/plugins/html"), () => import("prettier/plugins/postcss"), () => import("prettier/plugins/babel"), () => import("prettier/plugins/estree")),
    },
    markdown: { parser: "markdown", plugins: () => load(() => import("prettier/plugins/markdown")) },
    yaml: { parser: "yaml", plugins: () => load(() => import("prettier/plugins/yaml")) },
    graphql: { parser: "graphql", plugins: () => load(() => import("prettier/plugins/graphql")) },
};

async function format() {
    if (busy.value) return;
    busy.value = true;
    error.value = "";
    try {
        if (lang.value === "sql") {
            const { format: fmt } = await import("sql-formatter");
            output.value = fmt(input.value, { language: "sql", tabWidth: indent.value, keywordCase: "upper", expressionWidth: printWidth.value });
        } else {
            const cfg = parsers[lang.value];
            const [prettier, plugins] = await Promise.all([import("prettier/standalone"), cfg.plugins()]);
            output.value = await prettier.format(input.value, {
                parser: cfg.parser,
                plugins,
                tabWidth: indent.value,
                printWidth: printWidth.value,
            });
        }
    } catch (e) {
        output.value = "";
        error.value = (e as Error).message;
    } finally {
        busy.value = false;
    }
}

function onLang() {
    // Swap in the new sample only if the user hasn't changed the previous sample.
    if (langs.some((l) => l.sample === input.value) || !input.value.trim()) {
        input.value = langs.find((l) => l.value === lang.value)!.sample;
    }
    output.value = "";
    error.value = "";
}
</script>

<template>
    <ToolPage>
        <div class="flex flex-wrap items-end gap-x-5 gap-y-3">
            <div class="w-44">
                <label class="label" for="cf-lang">Language</label>
                <select id="cf-lang" v-model="lang" class="select" @change="onLang">
                    <option v-for="l in langs" :key="l.value" :value="l.value">{{ l.label }}</option>
                </select>
            </div>
            <div class="w-28">
                <label class="label" for="cf-indent">Indent</label>
                <select id="cf-indent" v-model.number="indent" class="select">
                    <option :value="2">2 spaces</option>
                    <option :value="4">4 spaces</option>
                    <option :value="8">8 spaces</option>
                </select>
            </div>
            <div class="w-28">
                <label class="label" for="cf-pw">Print width</label>
                <input id="cf-pw" v-model.number="printWidth" type="number" min="20" max="240" class="input" />
            </div>
            <Btn variant="primary" :disabled="busy" @click="format">
                <Loader2 v-if="busy" class="animate-spin" /><Wand2 v-else /> Format
                <span class="kbd ml-1 border-white/30 bg-white/10 text-accent-fg">Ctrl ↵</span>
            </Btn>
        </div>

        <Notice v-if="error" type="error"><pre class="font-mono text-xs break-words whitespace-pre-wrap">{{ error }}</pre></Notice>

        <div class="grid gap-4 lg:grid-cols-2" @keydown.ctrl.enter.prevent="format" @keydown.meta.enter.prevent="format">
            <Panel title="Input" flush>
                <CodeArea v-model="input" :wrap="false" placeholder="Paste code to format…" />
            </Panel>
            <Panel title="Formatted" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" :disabled="!output" title="Use output as input" @click="input = output"><ArrowLeft /> Use as input</Btn>
                    <CopyButton :text="output" />
                </template>
                <CodeArea :model-value="output" readonly :wrap="false" placeholder="Formatted code appears here" />
            </Panel>
        </div>
    </ToolPage>
</template>
