<script setup lang="ts">
import { computed, ref } from "vue";
import { Image as ImageIcon, Sparkles, Trash2 } from "lucide-vue-next";
import { marked } from "marked";
import DOMPurify from "dompurify";
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
const view = ref<"preview" | "html">("preview");
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

const stats = computed(() => {
    const words = src.value.trim() ? src.value.trim().split(/\s+/).length : 0;
    return `${words} words · ${src.value.length} chars`;
});
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="view" :options="[{ value: 'preview', label: 'Preview' }, { value: 'html', label: 'HTML' }]" />
        </template>

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

            <Panel :title="view === 'preview' ? 'Preview' : 'HTML'" flush>
                <template #actions><CopyButton :text="html" label="Copy HTML" /></template>
                <div v-if="view === 'preview'" class="prose-tool min-h-[28rem] overflow-auto p-4" v-html="html" />
                <CodeArea v-else :model-value="html" readonly height="28rem" />
            </Panel>
        </div>
    </ToolPage>
</template>
