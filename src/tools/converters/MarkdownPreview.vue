<script setup lang="ts">
import { computed, ref } from "vue";
import { Image as ImageIcon, Sparkles, Trash2 } from "lucide-vue-next";
import { marked } from "marked";
import DOMPurify from "dompurify";
import TurndownService from "turndown";
import { gfm } from "@joplin/turndown-plugin-gfm";
import { Btn, CodeArea, CopyButton, Panel, Tabs, ToolPage } from "@/components/ui";

const SAMPLE = `# Markdown Preview

Write **bold**, *italic*, ~~strikethrough~~ and \`inline code\`, then see it rendered live.

## Table

| Tool | Category | Client-side |
| ---- | :------: | ----------: |
| Base64 | Converters | yes |
| Markdown | Converters | yes |

## Task list

- [x] Write the parser
- [x] Sanitize the output
- [ ] Ship it

## Code

\`\`\`ts
function greet(name: string) {
  return \`Hello, \${name}!\`;
}
\`\`\`

> Blockquotes work too. See [the spec](https://github.github.com/gfm/).

![Remote image](https://example.com/picture.png)
`;

const src = ref(SAMPLE);
const view = ref<"preview" | "html" | "text">("preview");
const dir = ref<"md" | "html">("md");

const SAMPLE_HTML = `<h1>HTML to Markdown</h1>
<p>Paste <strong>HTML</strong> and get <em>clean</em> Markdown with <a href="https://example.com">links</a> and <code>code</code>.</p>
<ul><li>Lists</li><li>Tables</li></ul>
<table><thead><tr><th>Tool</th><th>Type</th></tr></thead><tbody><tr><td>Turndown</td><td>Converter</td></tr></tbody></table>
<pre><code class="language-js">console.log("hi");</code></pre>`;
const htmlSrc = ref(SAMPLE_HTML);
const headingStyle = ref<"atx" | "setext">("atx");
const bullet = ref<"-" | "*" | "+">("-");

const markdownOut = computed(() => {
    if (!htmlSrc.value.trim()) return "";
    const td = new TurndownService({ headingStyle: headingStyle.value, bulletListMarker: bullet.value, codeBlockStyle: "fenced", emDelimiter: "*", hr: "---" });
    td.use(gfm);
    td.remove(["script", "style"]);
    // Sanitize first so scripts and event handlers never reach the converter's DOM.
    return td.turndown(DOMPurify.sanitize(htmlSrc.value, { USE_PROFILES: { html: true } })).trim() + "\n";
});
const allowImages = ref(false);

const PLACEHOLDER = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="60"><rect width="100%" height="100%" fill="#8884" rx="6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#888">Remote image blocked</text></svg>',
);

const html = computed(() => {
    const raw = marked.parse(src.value, { gfm: true, async: false });
    const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
    const doc = new DOMParser().parseFromString(clean, "text/html");
    doc.querySelectorAll("a[href]").forEach((a) => {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
    });
    if (!allowImages.value) {
        doc.querySelectorAll("img").forEach((img) => {
            const s = img.getAttribute("src") ?? "";
            if (/^(https?:)?\/\//i.test(s)) {
                img.setAttribute("alt", img.getAttribute("alt") || "Remote image blocked");
                img.setAttribute("title", `Blocked: ${s}`);
                img.setAttribute("src", PLACEHOLDER);
                img.removeAttribute("srcset");
            }
        });
    }
    return doc.body.innerHTML;
});

// Plain text: the rendered document's text, with list bullets and link targets kept readable.
const plain = computed(() => {
    const doc = new DOMParser().parseFromString(html.value, "text/html");
    // Drop the whitespace-only text nodes between table and list tags so they do not become blank lines.
    doc.querySelectorAll("table, thead, tbody, tr, ul, ol").forEach((el) => {
        Array.from(el.childNodes).forEach((n) => n.nodeType === Node.TEXT_NODE && !n.nodeValue?.trim() && n.remove());
    });
    doc.querySelectorAll("li").forEach((li) => {
        const ol = li.parentElement?.tagName === "OL";
        const idx = ol ? Array.from(li.parentElement!.children).indexOf(li) + 1 : 0;
        li.prepend(ol ? `${idx}. ` : "- ");
    });
    doc.querySelectorAll("input[type=checkbox]").forEach((c) => c.replaceWith(c.hasAttribute("checked") ? "[x]" : "[ ]"));
    doc.querySelectorAll("img").forEach((i) => i.replaceWith(i.getAttribute("alt") ?? ""));
    doc.querySelectorAll("br").forEach((b) => b.replaceWith("\n"));
    doc.querySelectorAll("td, th").forEach((c) => c.nextElementSibling && c.append("\t"));
    doc.querySelectorAll("p, h1, h2, h3, h4, h5, h6, pre, blockquote, table, ul, ol, hr").forEach((b) => b.append("\n\n"));
    doc.querySelectorAll("li, tr").forEach((b) => b.append("\n"));
    return (doc.body.textContent ?? "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
});

const stats = computed(() => {
    const words = src.value.trim() ? src.value.trim().split(/\s+/).length : 0;
    return `${words} words · ${src.value.length} chars`;
});
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="dir" :options="[{ value: 'md', label: 'Markdown →' }, { value: 'html', label: 'HTML → Markdown' }]" />
            <Tabs v-if="dir === 'md'" v-model="view" :options="[{ value: 'preview', label: 'Preview' }, { value: 'html', label: 'HTML' }, { value: 'text', label: 'Plain text' }]" />
        </template>

        <template v-if="dir === 'html'">
            <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <label class="flex items-center gap-2"><span class="text-muted">Headings</span>
                    <select v-model="headingStyle" class="select !w-auto"><option value="atx"># ATX</option><option value="setext">Setext (underlined)</option></select>
                </label>
                <label class="flex items-center gap-2"><span class="text-muted">Bullets</span>
                    <select v-model="bullet" class="select !w-auto"><option value="-">-</option><option value="*">*</option><option value="+">+</option></select>
                </label>
            </div>
            <div class="grid gap-4 lg:grid-cols-2">
                <Panel title="HTML" flush>
                    <template #actions>
                        <Btn size="sm" variant="ghost" @click="htmlSrc = SAMPLE_HTML"><Sparkles /> Sample</Btn>
                        <Btn size="sm" variant="ghost" :disabled="!htmlSrc" @click="htmlSrc = ''"><Trash2 /> Clear</Btn>
                    </template>
                    <CodeArea v-model="htmlSrc" height="28rem" placeholder="Paste HTML here…" />
                </Panel>
                <Panel title="Markdown" flush>
                    <template #actions><CopyButton :text="markdownOut" /></template>
                    <CodeArea :model-value="markdownOut" readonly height="28rem" placeholder="Markdown appears here" />
                </Panel>
            </div>
        </template>

        <template v-else>
        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <label class="flex items-center gap-2"><input v-model="allowImages" type="checkbox" class="checkbox" /> <ImageIcon class="size-4 text-muted" /> Allow remote images</label>
            <span class="text-xs text-muted">Remote images are blocked by default so nothing is requested from other servers.</span>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="Markdown" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="src = SAMPLE"><Sparkles /> Sample</Btn>
                    <Btn size="sm" variant="ghost" :disabled="!src" @click="src = ''"><Trash2 /> Clear</Btn>
                </template>
                <CodeArea v-model="src" height="28rem" placeholder="Write Markdown here…" />
                <div class="border-t border-line px-4 py-2 text-xs text-muted">{{ stats }}</div>
            </Panel>

            <Panel :title="view === 'preview' ? 'Preview' : view === 'html' ? 'HTML' : 'Plain text'" flush>
                <template #actions><CopyButton :text="view === 'text' ? plain : html" :label="view === 'text' ? 'Copy text' : 'Copy HTML'" /></template>
                <div v-if="view === 'preview'" class="prose-tool min-h-[28rem] overflow-auto p-4" v-html="html" />
                <CodeArea v-else :model-value="view === 'text' ? plain : html" readonly height="28rem" />
            </Panel>
        </div>
        </template>
    </ToolPage>
</template>
