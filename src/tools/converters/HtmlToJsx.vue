<script setup lang="ts">
import { computed, ref } from "vue";
import { ClipboardPaste, Sparkles, Trash2 } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Notice, Panel, ToolPage } from "@/components/ui";
import { readClipboard } from "@/composables/useClipboard";

const SAMPLE = `<!-- Contact card -->
<div class="card" style="background-color: #fff; border: 1px solid #ddd; padding: 16px; --accent: tomato">
  <img src="avatar.png" alt="Avatar" width="48" height="48">
  <label for="email" tabindex="0">Email</label>
  <input type="email" id="email" maxlength="80" readonly disabled autocomplete="off">
  <button class="btn btn-primary" onclick="save(event)">Save</button>
  <br>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <path d="M5 12h14"></path>
  </svg>
</div>`;

const input = ref(SAMPLE);
const wrap = ref(false);
const componentName = ref("Component");
const indent = ref<"2" | "4" | "tab">("2");

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const BOOLEAN = new Set([
    "allowfullscreen", "async", "autofocus", "autoplay", "checked", "controls", "default", "defer", "disabled", "formnovalidate", "hidden", "inert",
    "ismap", "itemscope", "loop", "multiple", "muted", "nomodule", "novalidate", "open", "playsinline", "readonly", "required", "reversed", "selected",
]);
const ATTR_MAP: Record<string, string> = {
    class: "className", for: "htmlFor", tabindex: "tabIndex", readonly: "readOnly", maxlength: "maxLength", minlength: "minLength",
    colspan: "colSpan", rowspan: "rowSpan", cellpadding: "cellPadding", cellspacing: "cellSpacing", contenteditable: "contentEditable",
    crossorigin: "crossOrigin", autocomplete: "autoComplete", autofocus: "autoFocus", autoplay: "autoPlay", enctype: "encType",
    formaction: "formAction", formenctype: "formEncType", formmethod: "formMethod", formnovalidate: "formNoValidate", formtarget: "formTarget",
    srcset: "srcSet", srcdoc: "srcDoc", srclang: "srcLang", usemap: "useMap", accesskey: "accessKey", datetime: "dateTime", hreflang: "hrefLang",
    "http-equiv": "httpEquiv", "accept-charset": "acceptCharset", charset: "charSet", frameborder: "frameBorder", allowfullscreen: "allowFullScreen",
    novalidate: "noValidate", spellcheck: "spellCheck", itemprop: "itemProp", itemscope: "itemScope", itemtype: "itemType", itemid: "itemID",
    itemref: "itemRef", marginheight: "marginHeight", marginwidth: "marginWidth", playsinline: "playsInline", radiogroup: "radioGroup",
    inputmode: "inputMode", enterkeyhint: "enterKeyHint", mediagroup: "mediaGroup", autocapitalize: "autoCapitalize", referrerpolicy: "referrerPolicy",
    nomodule: "noModule", checked: "defaultChecked", selected: "defaultSelected", ismap: "isMap", contextmenu: "contextMenu", controlslist: "controlsList",
    fetchpriority: "fetchPriority", imagesizes: "imageSizes", imagesrcset: "imageSrcSet", bgcolor: "bgColor", valign: "vAlign",
    "xlink:href": "xlinkHref", "xml:lang": "xmlLang", "xml:space": "xmlSpace", "xmlns:xlink": "xmlnsXlink",
};

function camel(s: string) {
    return s.replace(/[-:]+([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase());
}

function attrName(name: string): string {
    const lower = name.toLowerCase();
    if (lower.startsWith("data-") || lower.startsWith("aria-")) return lower;
    if (ATTR_MAP[lower]) return ATTR_MAP[lower];
    if (/^on[a-z]+$/.test(lower)) return "on" + lower[2].toUpperCase() + lower.slice(3);
    if (name.includes("-") || name.includes(":")) return camel(name);
    return name;
}

function splitDeclarations(s: string): string[] {
    const parts: string[] = [];
    let cur = "", depth = 0, quote = "";
    for (const ch of s) {
        if (quote) {
            if (ch === quote) quote = "";
        } else if (ch === '"' || ch === "'") quote = ch;
        else if (ch === "(") depth++;
        else if (ch === ")") depth = Math.max(0, depth - 1);
        else if (ch === ";" && depth === 0) {
            parts.push(cur);
            cur = "";
            continue;
        }
        cur += ch;
    }
    parts.push(cur);
    return parts.map((p) => p.trim()).filter(Boolean);
}

function styleToObject(style: string): string {
    const entries: string[] = [];
    for (const decl of splitDeclarations(style)) {
        const i = decl.indexOf(":");
        if (i < 0) continue;
        const prop = decl.slice(0, i).trim();
        const rawVal = decl.slice(i + 1).trim().replace(/\s*!important$/i, "");
        let key: string;
        if (prop.startsWith("--")) key = JSON.stringify(prop);
        else {
            let p = prop.toLowerCase();
            if (p.startsWith("-ms-")) p = p.slice(1);
            key = p.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
            if (!/^[A-Za-z_$][\w$]*$/.test(key)) key = JSON.stringify(key);
        }
        const val = /^-?(\d+\.?\d*|\.\d+)$/.test(rawVal) ? rawVal.replace(/^(-?)\./, "$10.") : JSON.stringify(rawVal);
        entries.push(`${key}: ${val}`);
    }
    return `{{ ${entries.join(", ")} }}`;
}

function jsxText(text: string): string {
    return text.replace(/[&<>{}]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "{": "{'{'}", "}": "{'}'}" })[c] ?? c);
}

const unit = computed(() => (indent.value === "tab" ? "\t" : " ".repeat(Number(indent.value))));

function renderAttrs(el: Element): string {
    const out: string[] = [];
    for (const a of Array.from(el.attributes)) {
        const lower = a.name.toLowerCase();
        const name = attrName(a.name);
        const val = a.value;
        if (lower === "style") {
            out.push(`style=${styleToObject(val)}`);
        } else if (/^on[a-z]+$/.test(lower)) {
            out.push(`${name}={() => { ${val.replace(/\s*\n\s*/g, " ").trim()} }}`);
        } else if (BOOLEAN.has(lower) && (val === "" || val.toLowerCase() === lower)) {
            out.push(name);
        } else if (el.localName === "textarea" && lower === "value") {
            out.push(`defaultValue=${quoteAttr(val)}`);
        } else if (el.localName === "input" && lower === "value") {
            out.push(`defaultValue=${quoteAttr(val)}`);
        } else {
            out.push(`${name}=${quoteAttr(val)}`);
        }
    }
    return out.length ? " " + out.join(" ") : "";
}

function quoteAttr(v: string): string {
    if (!/["{}\n\\&<>]/.test(v)) return `"${v}"`;
    return `{${JSON.stringify(v)}}`;
}

function templateLiteral(s: string) {
    return "`" + s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${") + "`";
}

function render(node: Node, depth: number, inPre: boolean): string[] {
    const pad = unit.value.repeat(depth);
    if (node.nodeType === Node.COMMENT_NODE) {
        return [`${pad}{/* ${(node.nodeValue ?? "").trim().replace(/\*\//g, "* /")} */}`];
    }
    if (node.nodeType === Node.TEXT_NODE) {
        const raw = node.nodeValue ?? "";
        if (inPre) return raw ? [`${pad}{${JSON.stringify(raw)}}`] : [];
        if (!raw.trim() && /\n/.test(raw)) return [];
        const t = raw.replace(/\s*\n\s*/g, " ").trim();
        return t ? [pad + jsxText(t)] : raw ? [`${pad}{" "}`] : [];
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return [];
    const el = node as Element;
    const tag = el.localName;
    const attrs = renderAttrs(el);
    if (VOID.has(tag)) return [`${pad}<${tag}${attrs} />`];

    if (tag === "style" || tag === "script") {
        const code = el.textContent ?? "";
        return code.trim() ? [`${pad}<${tag}${attrs}>{${templateLiteral(code)}}</${tag}>`] : [`${pad}<${tag}${attrs} />`];
    }
    if (tag === "textarea") {
        const v = el.textContent ?? "";
        return [`${pad}<textarea${attrs}${v ? ` defaultValue=${quoteAttr(v)}` : ""} />`];
    }

    const kids = Array.from(el.childNodes).flatMap((c) => render(c, depth + 1, inPre || tag === "pre"));
    if (!kids.length) return el.namespaceURI === "http://www.w3.org/2000/svg" ? [`${pad}<${tag}${attrs} />`] : [`${pad}<${tag}${attrs}></${tag}>`];
    if (kids.length === 1 && !/^\s*[<{]/.test(kids[0]) && kids[0].trim().length < 60) {
        return [`${pad}<${tag}${attrs}>${kids[0].trim()}</${tag}>`];
    }
    return [`${pad}<${tag}${attrs}>`, ...kids, `${pad}</${tag}>`];
}

const result = computed<{ out: string; error?: string }>(() => {
    const src = input.value.trim();
    if (!src) return { out: "" };
    try {
        const tpl = document.createElement("template");
        tpl.innerHTML = src;
        const nodes = Array.from(tpl.content.childNodes);
        const base = wrap.value ? 2 : 0;
        const lines = nodes.flatMap((n) => render(n, 0, false));
        if (!lines.length) return { out: "" };
        const significant = nodes.filter((n) => n.nodeType !== Node.TEXT_NODE || n.nodeValue?.trim());
        const useFragment = significant.length > 1;
        let body = lines;
        if (useFragment) body = ["<>", ...lines.map((l) => unit.value + l), "</>"];
        if (!wrap.value) return { out: body.join("\n") };
        const name = /^[A-Za-z_$][\w$]*$/.test(componentName.value) ? componentName.value : "Component";
        const u = unit.value;
        const inner = body.map((l) => u.repeat(base) + l);
        return {
            out: [`export default function ${name[0].toUpperCase() + name.slice(1)}() {`, `${u}return (`, ...inner, `${u});`, "}"].join("\n"),
        };
    } catch (e) {
        return { out: "", error: e instanceof Error ? e.message : "Could not parse the HTML." };
    }
});

async function paste() {
    input.value = await readClipboard();
}
</script>

<template>
    <ToolPage>
        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <label class="flex items-center gap-2"><input v-model="wrap" type="checkbox" class="checkbox" /> Wrap in function component</label>
            <label v-if="wrap" class="flex items-center gap-2">Name
                <input v-model="componentName" class="input !h-8 !w-40 font-mono" spellcheck="false" />
            </label>
            <label class="flex items-center gap-2">Indent
                <select v-model="indent" class="select !h-8 !w-auto">
                    <option value="2">2 spaces</option>
                    <option value="4">4 spaces</option>
                    <option value="tab">Tab</option>
                </select>
            </label>
            <Btn class="ml-auto" size="sm" variant="secondary" @click="input = SAMPLE"><Sparkles /> Sample</Btn>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="HTML" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="paste"><ClipboardPaste /> Paste</Btn>
                    <Btn size="sm" variant="ghost" :disabled="!input" @click="input = ''"><Trash2 /> Clear</Btn>
                </template>
                <CodeArea v-model="input" :wrap="false" height="26rem" placeholder="<div class=&quot;box&quot;>…</div>" />
            </Panel>
            <Panel title="JSX" flush>
                <template #actions><CopyButton :text="result.out" /></template>
                <div v-if="result.error" class="p-4"><Notice type="error">{{ result.error }}</Notice></div>
                <CodeArea v-else :model-value="result.out" readonly :wrap="false" height="26rem" placeholder="JSX appears here" />
            </Panel>
        </div>
        <p class="text-xs text-muted">Event handlers become arrow functions, <code class="code">style</code> strings become objects, and <code class="code">checked</code>/<code class="code">selected</code> map to their uncontrolled <code class="code">default*</code> props.</p>
    </ToolPage>
</template>
