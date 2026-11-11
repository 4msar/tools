<script setup lang="ts">
import { computed, ref } from "vue";
import { FileCode2, Search } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Notice, Panel, Tabs, ToolPage } from "@/components/ui";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<catalog xmlns="http://example.com/catalog" xmlns:meta="http://example.com/meta">
  <book id="b1" meta:lang="en"><title>XML Basics</title><price>29.99</price></book>
  <book id="b2" meta:lang="fr"><title>Les Bases</title><price>19.50</price></book>
</catalog>`;

const input = ref(SAMPLE);
const mode = ref<"format" | "minify">("format");
const indentSize = ref(2);
const xpath = ref("//c:book[@id='b2']/c:title");

const parsed = computed<{ doc?: Document; error?: string }>(() => {
    if (!input.value.trim()) return {};
    const doc = new DOMParser().parseFromString(input.value, "application/xml");
    const err = doc.getElementsByTagName("parsererror")[0];
    if (err) return { error: (err.textContent ?? "Invalid XML").trim().replace(/\n{2,}/g, "\n") };
    return { doc };
});

function escText(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escAttr(s: string) {
    return escText(s).replace(/"/g, "&quot;");
}

function ser(node: Node, depth: number, pretty: boolean, unit: string): string {
    const pad = pretty ? unit.repeat(depth) : "";
    const nl = pretty ? "\n" : "";
    switch (node.nodeType) {
        case Node.ELEMENT_NODE: {
            const el = node as Element;
            const attrs = Array.from(el.attributes).map((a) => ` ${a.name}="${escAttr(a.value)}"`).join("");
            const kids = Array.from(el.childNodes).filter((n) => !(n.nodeType === Node.TEXT_NODE && !n.nodeValue?.trim()));
            if (!kids.length) return `${pad}<${el.tagName}${attrs}/>${nl}`;
            if (kids.every((k) => k.nodeType === Node.TEXT_NODE || k.nodeType === Node.CDATA_SECTION_NODE)) {
                const inner = kids.map((k) => (k.nodeType === Node.CDATA_SECTION_NODE ? `<![CDATA[${k.nodeValue}]]>` : escText((k.nodeValue ?? "").trim()))).join("");
                return `${pad}<${el.tagName}${attrs}>${inner}</${el.tagName}>${nl}`;
            }
            return `${pad}<${el.tagName}${attrs}>${nl}${kids.map((k) => ser(k, depth + 1, pretty, unit)).join("")}${pad}</${el.tagName}>${nl}`;
        }
        case Node.TEXT_NODE:
            return `${pad}${escText((node.nodeValue ?? "").trim())}${nl}`;
        case Node.CDATA_SECTION_NODE:
            return `${pad}<![CDATA[${node.nodeValue}]]>${nl}`;
        case Node.COMMENT_NODE:
            return `${pad}<!--${node.nodeValue}-->${nl}`;
        case Node.PROCESSING_INSTRUCTION_NODE:
            return `${pad}<?${(node as ProcessingInstruction).target} ${node.nodeValue}?>${nl}`;
        default:
            return "";
    }
}

const output = computed(() => {
    const doc = parsed.value.doc;
    if (!doc) return "";
    const pretty = mode.value === "format";
    const unit = " ".repeat(indentSize.value);
    const decl = /^\s*<\?xml[^?]*\?>/.exec(input.value)?.[0];
    const body = Array.from(doc.childNodes).map((n) => ser(n, 0, pretty, unit)).join("");
    const out = (decl && !doc.firstChild?.nodeName.startsWith("xml") ? decl + (pretty ? "\n" : "") : "") + body;
    return out.trim();
});

// XPath with namespace resolver built from root's xmlns declarations.
// The default namespace (xmlns="...") is bound to the prefix "c" so it can be queried.
const nsMap = computed(() => {
    const root = parsed.value.doc?.documentElement;
    const map: Record<string, string> = {};
    if (!root) return map;
    for (const a of Array.from(root.attributes)) {
        if (a.name === "xmlns") map["c"] = a.value;
        else if (a.name.startsWith("xmlns:")) map[a.name.slice(6)] = a.value;
    }
    return map;
});

interface Hit {
    kind: string;
    path: string;
    text: string;
}

function pathOf(n: Node): string {
    const parts: string[] = [];
    let cur: Node | null = n;
    while (cur && cur.nodeType !== Node.DOCUMENT_NODE) {
        if (cur.nodeType === Node.ELEMENT_NODE) {
            const el = cur as Element;
            let idx = 1;
            for (let s = el.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === el.tagName) idx++;
            parts.unshift(`${el.tagName}[${idx}]`);
        } else if (cur.nodeType === Node.ATTRIBUTE_NODE) {
            parts.unshift(`@${(cur as Attr).name}`);
            cur = (cur as Attr).ownerElement;
            continue;
        } else if (cur.nodeType === Node.TEXT_NODE) parts.unshift("text()");
        cur = cur.parentNode;
    }
    return "/" + parts.join("/");
}

const xp = computed<{ hits: Hit[]; scalar?: string; error?: string }>(() => {
    const doc = parsed.value.doc;
    const expr = xpath.value.trim();
    if (!doc || !expr) return { hits: [] };
    try {
        const resolver = (p: string | null) => (p ? nsMap.value[p] ?? null : nsMap.value["c"] ?? null);
        const res = doc.evaluate(expr, doc, resolver, XPathResult.ANY_TYPE, null);
        switch (res.resultType) {
            case XPathResult.NUMBER_TYPE: return { hits: [], scalar: String(res.numberValue) };
            case XPathResult.STRING_TYPE: return { hits: [], scalar: res.stringValue };
            case XPathResult.BOOLEAN_TYPE: return { hits: [], scalar: String(res.booleanValue) };
        }
        const hits: Hit[] = [];
        for (let n = res.iterateNext(); n && hits.length < 500; n = res.iterateNext()) {
            const kind = n.nodeType === Node.ELEMENT_NODE ? "element" : n.nodeType === Node.ATTRIBUTE_NODE ? "attribute" : n.nodeType === Node.TEXT_NODE ? "text" : "node";
            const text = n.nodeType === Node.ELEMENT_NODE ? ser(n, 0, true, "  ").trim() : (n.nodeValue ?? n.textContent ?? "");
            hits.push({ kind, path: pathOf(n), text });
        }
        return { hits };
    } catch (e) {
        return { hits: [], error: (e as Error).message };
    }
});
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="mode" :options="[{ value: 'format', label: 'Format' }, { value: 'minify', label: 'Minify' }]" />
        </template>

        <div v-if="mode === 'format'" class="w-32">
            <label class="label" for="xi-ind">Indent</label>
            <select id="xi-ind" v-model.number="indentSize" class="select">
                <option :value="2">2 spaces</option>
                <option :value="4">4 spaces</option>
            </select>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="XML" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="input = SAMPLE"><FileCode2 /> Sample</Btn>
                </template>
                <CodeArea v-model="input" :wrap="false" placeholder="Paste XML…" :invalid="!!parsed.error" />
            </Panel>
            <Panel :title="mode === 'format' ? 'Formatted' : 'Minified'" flush>
                <template #actions><CopyButton :text="output" /></template>
                <div v-if="parsed.error" class="p-4"><Notice type="error"><pre class="font-mono text-xs break-words whitespace-pre-wrap">{{ parsed.error }}</pre></Notice></div>
                <CodeArea v-else :model-value="output" readonly :wrap="false" placeholder="Output appears here" />
            </Panel>
        </div>

        <Panel title="XPath">
            <div class="flex items-center gap-2">
                <Search class="size-4 shrink-0 text-muted" />
                <input v-model="xpath" class="input font-mono" spellcheck="false" placeholder="//book[@id='b1']/title" aria-label="XPath expression" />
            </div>
            <p v-if="Object.keys(nsMap).length" class="mt-2 text-xs text-muted">
                Namespaces from root:
                <span v-for="(uri, p) in nsMap" :key="p" class="mr-2"><code class="code">{{ p }}</code> = {{ uri }}</span>
                (the default namespace is bound to <code class="code">c</code>)
            </p>
            <Notice v-if="xp.error" type="error" class="mt-3">{{ xp.error }}</Notice>
            <p v-else-if="xp.scalar !== undefined" class="mt-3 text-sm">Result: <code class="code">{{ xp.scalar }}</code></p>
            <p v-else-if="xpath.trim() && parsed.doc" class="mt-3 text-sm text-muted">{{ xp.hits.length }} result{{ xp.hits.length === 1 ? "" : "s" }}</p>
            <ul v-if="xp.hits.length" class="mt-2 max-h-72 divide-y divide-line overflow-auto rounded-lg border border-line">
                <li v-for="(h, i) in xp.hits" :key="i" class="space-y-1 px-3 py-2 text-sm">
                    <div class="flex flex-wrap items-center gap-2"><span class="chip">{{ h.kind }}</span><code class="code break-all text-xs">{{ h.path }}</code></div>
                    <pre class="font-mono text-xs break-words whitespace-pre-wrap">{{ h.text }}</pre>
                </li>
            </ul>
        </Panel>
    </ToolPage>
</template>
