<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useStorage } from "@vueuse/core";
import { Panel, Field, CopyButton, CodeArea, ToolPage } from "@/components/ui";

interface Form {
    title: string;
    description: string;
    keywords: string;
    author: string;
    canonical: string;
    index: boolean;
    follow: boolean;
    themeColor: string;
    useThemeColor: boolean;
    viewport: string;
    charset: boolean;
    ogOn: boolean;
    ogType: string;
    ogSite: string;
    ogImage: string;
    ogLocale: string;
    twOn: boolean;
    twCard: string;
    twSite: string;
    twCreator: string;
}

const form = useStorage<Form>(
    "tools:meta:form",
    {
        title: "My Awesome Website",
        description:
            "A short, compelling summary of what this page offers, written for people and search engines.",
        keywords: "",
        author: "",
        canonical: "https://msar.me/",
        index: true,
        follow: true,
        themeColor: "#10b981",
        useThemeColor: false,
        viewport: "width=device-width, initial-scale=1",
        charset: true,
        ogOn: true,
        ogType: "website",
        ogSite: "",
        ogImage: "",
        ogLocale: "en_US",
        twOn: true,
        twCard: "summary_large_image",
        twSite: "",
        twCreator: "",
    },
    undefined,
    { mergeDefaults: true },
);

const esc = (s: string) =>
    s
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
const at = (s: string) => {
    const t = s.trim();
    return t && !t.startsWith("@") ? `@${t}` : t;
};

const html = computed(() => {
    const f = form.value;
    const l: string[] = [];
    const meta = (name: string, content: string) =>
        l.push(`<meta name="${name}" content="${esc(content)}">`);
    const prop = (p: string, content: string) =>
        l.push(`<meta property="${p}" content="${esc(content)}">`);
    if (f.charset) l.push('<meta charset="UTF-8">');
    if (f.viewport.trim()) meta("viewport", f.viewport.trim());
    if (f.title.trim()) l.push(`<title>${esc(f.title.trim())}</title>`);
    if (f.description.trim()) meta("description", f.description.trim());
    if (f.keywords.trim())
        meta(
            "keywords",
            f.keywords
                .split(",")
                .map((k) => k.trim())
                .filter(Boolean)
                .join(", "),
        );
    if (f.author.trim()) meta("author", f.author.trim());
    meta(
        "robots",
        `${f.index ? "index" : "noindex"}, ${f.follow ? "follow" : "nofollow"}`,
    );
    if (f.useThemeColor && f.themeColor) meta("theme-color", f.themeColor);
    if (f.canonical.trim())
        l.push(`<link rel="canonical" href="${esc(f.canonical.trim())}">`);
    if (f.ogOn) {
        l.push("");
        l.push("<!-- Open Graph -->");
        prop("og:type", f.ogType);
        if (f.title.trim()) prop("og:title", f.title.trim());
        if (f.description.trim()) prop("og:description", f.description.trim());
        if (f.canonical.trim()) prop("og:url", f.canonical.trim());
        if (f.ogSite.trim()) prop("og:site_name", f.ogSite.trim());
        if (f.ogImage.trim()) prop("og:image", f.ogImage.trim());
        if (f.ogLocale.trim()) prop("og:locale", f.ogLocale.trim());
    }
    if (f.twOn) {
        l.push("");
        l.push("<!-- Twitter Card -->");
        meta("twitter:card", f.twCard);
        if (f.title.trim()) meta("twitter:title", f.title.trim());
        if (f.description.trim())
            meta("twitter:description", f.description.trim());
        if (f.ogImage.trim()) meta("twitter:image", f.ogImage.trim());
        if (f.twSite.trim()) meta("twitter:site", at(f.twSite));
        if (f.twCreator.trim()) meta("twitter:creator", at(f.twCreator));
    }
    return l.join("\n");
});

const trunc = (s: string, n: number) =>
    s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
const urlInfo = computed(() => {
    try {
        const u = new URL(form.value.canonical.trim());
        const segs = u.pathname.split("/").filter(Boolean);
        return {
            host: u.hostname,
            crumb: [u.hostname, ...segs].join(" › "),
            ok: true,
        };
    } catch {
        return { host: "example.com", crumb: "example.com", ok: false };
    }
});

const imgFailed = ref(false);
watch(
    () => form.value.ogImage,
    () => (imgFailed.value = false),
);

const titleLen = computed(() => form.value.title.length);
const descLen = computed(() => form.value.description.length);
const viewports = [
    "width=device-width, initial-scale=1",
    "width=device-width, initial-scale=1, maximum-scale=1",
    "width=1024",
];
</script>

<template>
    <ToolPage>
        <div class="grid gap-4 lg:grid-cols-2">
            <div class="space-y-4">
                <Panel title="Basics">
                    <div class="space-y-3">
                        <Field label="Title">
                            <input
                                v-model="form.title"
                                class="input"
                                placeholder="Page title"
                            />
                        </Field>
                        <div
                            class="-mt-2 text-xs"
                            :class="titleLen > 60 ? 'text-warn' : 'text-muted'"
                        >
                            {{ titleLen }} / 60 recommended
                        </div>
                        <Field label="Description">
                            <textarea
                                v-model="form.description"
                                rows="3"
                                class="input"
                                placeholder="Page description"
                            />
                        </Field>
                        <div
                            class="-mt-2 text-xs"
                            :class="descLen > 160 ? 'text-warn' : 'text-muted'"
                        >
                            {{ descLen }} / 160 recommended
                        </div>
                        <Field label="Keywords" hint="Comma separated."
                            ><input
                                v-model="form.keywords"
                                class="input"
                                placeholder="tools, developer, online"
                        /></Field>
                        <div class="grid gap-3 sm:grid-cols-2">
                            <Field label="Author"
                                ><input
                                    v-model="form.author"
                                    class="input"
                                    placeholder="Jane Doe"
                            /></Field>
                            <Field label="Canonical URL"
                                ><input
                                    v-model="form.canonical"
                                    class="input"
                                    placeholder="https://msar.me/page"
                            /></Field>
                        </div>
                    </div>
                </Panel>

                <Panel title="Technical">
                    <div class="space-y-3">
                        <div class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                            <label
                                class="flex cursor-pointer items-center gap-2"
                                ><input
                                    v-model="form.index"
                                    type="checkbox"
                                    class="checkbox"
                                />
                                Index</label
                            >
                            <label
                                class="flex cursor-pointer items-center gap-2"
                                ><input
                                    v-model="form.follow"
                                    type="checkbox"
                                    class="checkbox"
                                />
                                Follow links</label
                            >
                            <label
                                class="flex cursor-pointer items-center gap-2"
                                ><input
                                    v-model="form.charset"
                                    type="checkbox"
                                    class="checkbox"
                                />
                                UTF-8 charset</label
                            >
                        </div>
                        <Field label="Viewport">
                            <select v-model="form.viewport" class="select">
                                <option
                                    v-for="v in viewports"
                                    :key="v"
                                    :value="v"
                                >
                                    {{ v }}
                                </option>
                                <option value="">(omit)</option>
                            </select>
                        </Field>
                        <div class="flex items-end gap-3">
                            <label
                                class="flex cursor-pointer items-center gap-2 pb-2 text-sm"
                                ><input
                                    v-model="form.useThemeColor"
                                    type="checkbox"
                                    class="checkbox"
                                />
                                Theme color</label
                            >
                            <input
                                v-model="form.themeColor"
                                type="color"
                                class="h-10 w-14 cursor-pointer rounded-md border border-line bg-surface p-1"
                                :disabled="!form.useThemeColor"
                            />
                            <input
                                v-model="form.themeColor"
                                class="input max-w-32 font-mono"
                                :disabled="!form.useThemeColor"
                            />
                        </div>
                    </div>
                </Panel>

                <Panel title="Open Graph">
                    <template #actions>
                        <label
                            class="flex cursor-pointer items-center gap-2 text-xs"
                            ><input
                                v-model="form.ogOn"
                                type="checkbox"
                                class="checkbox"
                            />
                            Include</label
                        >
                    </template>
                    <div
                        class="grid gap-3 sm:grid-cols-2"
                        :class="
                            form.ogOn ? '' : 'pointer-events-none opacity-50'
                        "
                    >
                        <Field label="Type">
                            <select v-model="form.ogType" class="select">
                                <option>website</option>
                                <option>article</option>
                                <option>profile</option>
                                <option>book</option>
                                <option>music.song</option>
                                <option>video.movie</option>
                            </select>
                        </Field>
                        <Field label="Site name"
                            ><input
                                v-model="form.ogSite"
                                class="input"
                                placeholder="Example"
                        /></Field>
                        <Field label="Image URL"
                            ><input
                                v-model="form.ogImage"
                                class="input"
                                placeholder="https://msar.me/og.png"
                        /></Field>
                        <Field label="Locale"
                            ><input
                                v-model="form.ogLocale"
                                class="input"
                                placeholder="en_US"
                        /></Field>
                    </div>
                </Panel>

                <Panel title="Twitter / X card">
                    <template #actions>
                        <label
                            class="flex cursor-pointer items-center gap-2 text-xs"
                            ><input
                                v-model="form.twOn"
                                type="checkbox"
                                class="checkbox"
                            />
                            Include</label
                        >
                    </template>
                    <div
                        class="grid gap-3 sm:grid-cols-3"
                        :class="
                            form.twOn ? '' : 'pointer-events-none opacity-50'
                        "
                    >
                        <Field label="Card type">
                            <select v-model="form.twCard" class="select">
                                <option>summary</option>
                                <option>summary_large_image</option>
                                <option>app</option>
                                <option>player</option>
                            </select>
                        </Field>
                        <Field label="Site"
                            ><input
                                v-model="form.twSite"
                                class="input"
                                placeholder="@site"
                        /></Field>
                        <Field label="Creator"
                            ><input
                                v-model="form.twCreator"
                                class="input"
                                placeholder="@creator"
                        /></Field>
                    </div>
                </Panel>
            </div>

            <div class="space-y-4">
                <Panel title="HTML" flush>
                    <template #actions><CopyButton :text="html" /></template>
                    <CodeArea
                        :model-value="html"
                        readonly
                        height="24rem"
                        :wrap="false"
                    />
                </Panel>

                <Panel title="Google preview">
                    <div class="rounded-lg bg-subtle p-4">
                        <div class="text-xs text-muted">
                            {{ urlInfo.crumb }}
                        </div>
                        <div class="mt-0.5 text-lg leading-snug text-info">
                            {{ trunc(form.title || "Untitled", 60) }}
                        </div>
                        <div class="mt-1 text-sm leading-snug text-muted">
                            {{
                                trunc(
                                    form.description ||
                                        "No description provided.",
                                    160,
                                )
                            }}
                        </div>
                    </div>
                </Panel>

                <Panel title="Social card preview">
                    <div
                        class="max-w-md overflow-hidden rounded-xl border border-line bg-surface"
                    >
                        <div
                            class="grid aspect-[1.91/1] place-items-center bg-subtle text-xs text-muted"
                        >
                            <img
                                v-if="form.ogImage && !imgFailed"
                                :src="form.ogImage"
                                alt=""
                                class="size-full object-cover"
                                @error="imgFailed = true"
                            />
                            <span v-else>{{
                                form.ogImage
                                    ? "Image failed to load"
                                    : "No image"
                            }}</span>
                        </div>
                        <div
                            class="space-y-0.5 border-t border-line px-3 py-2.5"
                        >
                            <div class="text-xs text-muted uppercase">
                                {{ urlInfo.host }}
                            </div>
                            <div class="text-sm font-semibold text-fg">
                                {{ trunc(form.title || "Untitled", 70) }}
                            </div>
                            <div class="text-xs text-muted">
                                {{ trunc(form.description, 120) }}
                            </div>
                        </div>
                    </div>
                </Panel>
            </div>
        </div>
    </ToolPage>
</template>
