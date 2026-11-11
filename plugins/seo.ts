import { readFileSync } from "node:fs";
import sharp from "sharp";
import type { Plugin } from "vite";
import {
    OG_IMAGE,
    SITE_DESCRIPTION,
    SITE_NAME,
    SITE_TITLE,
    SITE_URL,
    toolOgImage,
    toolTitle,
    toolUrl,
} from "../src/site.ts";

interface ToolMeta {
    id: string;
    name: string;
    category: string;
    description: string;
    keywords: string[];
}

const esc = (s: string) =>
    s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

/** Reads tool metadata from registry.ts without importing it (it pulls in Vue components). */
function readRegistry(file: string) {
    const src = readFileSync(file, "utf8");
    const categories = new Map<string, string>();
    for (const m of src.matchAll(/\{ id: "([\w-]+)", name: "([^"]+)", icon:/g))
        categories.set(m[1], m[2]);
    const tools: ToolMeta[] = [];
    for (const line of src.split("\n")) {
        const m = line.match(
            /\{ id: "([^"]+)", name: "([^"]+)", category: "(\w+)".*description: "([^"]+)"/,
        );
        if (!m) continue;
        const kw = line.match(/keywords: \[([^\]]*)\]/)?.[1] ?? "";
        tools.push({
            id: m[1],
            name: m[2],
            category: categories.get(m[3]) ?? m[3],
            description: m[4],
            keywords: [...kw.matchAll(/"([^"]+)"/g)].map((k) => k[1]),
        });
    }
    return { tools, categories: [...categories.values()] };
}

interface PageMeta {
    title: string;
    description: string;
    url: string;
    keywords: string;
    image: string;
    jsonLd: object;
    body: string;
    noindex?: boolean;
}

function applyMeta(html: string, p: PageMeta) {
    const set = (re: RegExp, value: string) => {
        if (!re.test(html))
            throw new Error(`[seo] index.html is missing ${re}`);
        html = html.replace(
            re,
            (_m, pre: string, post: string) => `${pre}${esc(value)}${post}`,
        );
    };
    set(/(<title>)[^<]*(<\/title>)/, p.title);
    set(/(<meta name="description" content=")[^"]*(")/, p.description);
    set(/(<meta name="keywords" content=")[^"]*(")/, p.keywords);
    set(/(<link rel="canonical" href=")[^"]*(")/, p.url);
    set(/(<meta property="og:title" content=")[^"]*(")/, p.title);
    set(/(<meta property="og:description" content=")[^"]*(")/, p.description);
    set(/(<meta property="og:url" content=")[^"]*(")/, p.url);
    set(/(<meta name="twitter:title" content=")[^"]*(")/, p.title);
    set(/(<meta name="twitter:description" content=")[^"]*(")/, p.description);
    set(/(<meta property="og:image" content=")[^"]*(")/, p.image);
    set(/(<meta name="twitter:image" content=")[^"]*(")/, p.image);
    if (p.noindex)
        set(/(<meta name="robots" content=")[^"]*(")/, "noindex, follow");
    html = html.replace(
        /(<script type="application\/ld\+json" id="ld-json">)[\s\S]*?(<\/script>)/,
        (_m, a: string, b: string) =>
            `${a}${JSON.stringify(p.jsonLd).replace(/</g, "\\u003c")}${b}`,
    );
    // Static, screen-reader-only content for crawlers that don't run JS; Vue replaces it on mount.
    return html.replace(
        "<!--app-html-->",
        `<div style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">${p.body}</div>`,
    );
}

/** Greedy word wrap for SVG text (no text layout in SVG). */
function wrap(text: string, maxChars: number, maxLines: number) {
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
        if ((line + " " + word).trim().length > maxChars) {
            lines.push(line);
            line = word;
        } else line = (line + " " + word).trim();
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
        lines.length = maxLines;
        lines[maxLines - 1] = lines[maxLines - 1].replace(/\W*\w*$/, "") + "…";
    }
    return lines;
}

/** 1200×630 share image for one tool, in the msar.me dark palette (flat, no gradients). */
function toolOgSvg(t: ToolMeta, total: number) {
    const titleSize = t.name.length > 20 ? 64 : 76;
    const desc = wrap(t.description, 58, 3)
        .map(
            (l, i) =>
                `<text x="80" y="${388 + i * 44}" font-family="Sora, Helvetica, Arial, sans-serif" font-size="28" fill="#b3b8be">${esc(l)}</text>`,
        )
        .join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><pattern id="d" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#ffffff26"/></pattern></defs>
  <rect width="1200" height="630" fill="#07080b"/><rect width="1200" height="630" fill="url(#d)"/>
  <rect x="40" y="40" width="1120" height="550" rx="16" fill="#0e1114" stroke="#25292f"/>
  <text x="80" y="128" font-family="Sora, Helvetica, Arial, sans-serif" font-size="24" fill="#8b9097">${esc(t.category)}</text>
  <text x="80" y="${titleSize > 70 ? 300 : 290}" font-family="Fraunces, Georgia, serif" font-size="${titleSize}" font-weight="600" fill="#34d4bf">${esc(t.name)}</text>
  ${desc}
  <line x1="80" y1="512" x2="1120" y2="512" stroke="#25292f"/>
  <text x="80" y="556" font-family="Fraunces, Georgia, serif" font-size="30" font-weight="600" fill="#f1f4f6">DevTools</text>
  <text x="1120" y="556" text-anchor="end" font-family="Sora, Helvetica, Arial, sans-serif" font-size="22" fill="#8b9097">${total} free browser tools · tools.msar.me</text>
</svg>`;
}

/**
 * Build-time SEO:
 * - writes /<tool-id>.html for every tool (served at /<tool-id> by GitHub Pages) with its own title, description, canonical and social tags
 *   (also means deep links return 200 on GitHub Pages instead of falling back to 404.html)
 * - renders an Open Graph image per tool (og/<tool-id>.png)
 * - writes sitemap.xml (with image entries), robots.txt, opensearch.xml, llms.txt and a noindex 404.html
 */
export function seo({ registry }: { registry: string }): Plugin {
    return {
        name: "devtools-seo",
        apply: "build",
        enforce: "post",
        async generateBundle(_opts, bundle) {
            const index = bundle["index.html"];
            if (!index || index.type !== "asset") return;
            const template = String(index.source);
            const { tools, categories } = readRegistry(registry);
            const today = new Date().toISOString().slice(0, 10);

            const homeBody =
                `<h1>${esc(SITE_TITLE)}</h1><p>${esc(SITE_DESCRIPTION)}</p>` +
                categories
                    .map((c) => {
                        const items = tools.filter((t) => t.category === c);
                        return `<h2>${esc(c)}</h2><ul>${items.map((t) => `<li><a href="/${t.id}">${esc(t.name)}</a>: ${esc(t.description)}</li>`).join("")}</ul>`;
                    })
                    .join("");

            index.source = applyMeta(template, {
                title: SITE_TITLE,
                description: SITE_DESCRIPTION,
                url: `${SITE_URL}/`,
                keywords:
                    "developer tools, online tools, json formatter, regex tester, uuid generator, hash generator, jwt decoder, base64, cron, color converter",
                jsonLd: {
                    "@context": "https://schema.org",
                    "@type": "WebSite",
                    name: SITE_NAME,
                    url: `${SITE_URL}/`,
                    description: SITE_DESCRIPTION,
                    potentialAction: {
                        "@type": "SearchAction",
                        target: {
                            "@type": "EntryPoint",
                            urlTemplate: `${SITE_URL}/?q={search_term_string}`,
                        },
                        "query-input": "required name=search_term_string",
                    },
                },
                image: OG_IMAGE,
                body: homeBody,
            });

            this.emitFile({
                type: "asset",
                fileName: "404.html",
                source: applyMeta(template, {
                    title: `Page not found · ${SITE_NAME}`,
                    description: SITE_DESCRIPTION,
                    url: `${SITE_URL}/`,
                    keywords: "",
                    image: OG_IMAGE,
                    noindex: true,
                    jsonLd: {
                        "@context": "https://schema.org",
                        "@type": "WebPage",
                        name: "Page not found",
                    },
                    body: `<h1>Page not found</h1><p><a href="/">See all ${tools.length} developer tools</a></p>`,
                }),
            });

            const images = await Promise.all(
                tools.map((t) =>
                    sharp(Buffer.from(toolOgSvg(t, tools.length)))
                        .png({ compressionLevel: 9 })
                        .toBuffer(),
                ),
            );
            tools.forEach((t, i) =>
                this.emitFile({
                    type: "asset",
                    fileName: `og/${t.id}.png`,
                    source: images[i],
                }),
            );

            for (const t of tools) {
                const title = toolTitle(t.name);
                const url = toolUrl(t.id);
                this.emitFile({
                    type: "asset",
                    fileName: `${t.id}.html`,
                    source: applyMeta(template, {
                        title,
                        description: `${t.description} Free, private and runs entirely in your browser.`,
                        url,
                        keywords: [
                            t.name.toLowerCase(),
                            ...t.keywords,
                            "online",
                            "free",
                        ].join(", "),
                        image: toolOgImage(t.id),
                        jsonLd: {
                            "@context": "https://schema.org",
                            "@graph": [
                                {
                                    "@type": "WebApplication",
                                    name: t.name,
                                    url,
                                    description: t.description,
                                    applicationCategory: "DeveloperApplication",
                                    operatingSystem: "Any",
                                    browserRequirements: "Requires JavaScript",
                                    isAccessibleForFree: true,
                                    offers: {
                                        "@type": "Offer",
                                        price: "0",
                                        priceCurrency: "USD",
                                    },
                                    image: toolOgImage(t.id),
                                },
                                {
                                    "@type": "BreadcrumbList",
                                    itemListElement: [
                                        {
                                            "@type": "ListItem",
                                            position: 1,
                                            name: SITE_NAME,
                                            item: `${SITE_URL}/`,
                                        },
                                        {
                                            "@type": "ListItem",
                                            position: 2,
                                            name: t.name,
                                            item: url,
                                        },
                                    ],
                                },
                            ],
                        },
                        body: `<h1>${esc(t.name)}</h1><p>${esc(t.description)}</p><p><a href="/">All ${tools.length} developer tools</a></p>`,
                    }),
                });
            }

            const entries = [
                {
                    loc: `${SITE_URL}/`,
                    image: OG_IMAGE,
                    title: SITE_TITLE,
                    priority: "1.0",
                },
                ...tools.map((t) => ({
                    loc: toolUrl(t.id),
                    image: toolOgImage(t.id),
                    title: t.name,
                    priority: "0.8",
                })),
            ];
            this.emitFile({
                type: "asset",
                fileName: "sitemap.xml",
                source:
                    `<?xml version="1.0" encoding="UTF-8"?>\n` +
                    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
                    entries
                        .map(
                            (e) =>
                                `  <url>\n    <loc>${e.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${e.priority}</priority>\n` +
                                `    <image:image><image:loc>${e.image}</image:loc><image:title>${esc(e.title)}</image:title></image:image>\n  </url>`,
                        )
                        .join("\n") +
                    `\n</urlset>\n`,
            });
            this.emitFile({
                type: "asset",
                fileName: "opensearch.xml",
                source: `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/" xmlns:moz="http://www.mozilla.org/2006/browser/search/">
  <ShortName>${SITE_NAME}</ShortName>
  <Description>Search ${tools.length} free developer tools</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image width="32" height="32" type="image/png">${SITE_URL}/favicon-32x32.png</Image>
  <Url type="text/html" method="get" template="${SITE_URL}/?q={searchTerms}"/>
  <moz:SearchForm>${SITE_URL}/</moz:SearchForm>
</OpenSearchDescription>
`,
            });
            this.emitFile({
                type: "asset",
                fileName: "llms.txt",
                source:
                    `# ${SITE_NAME}\n\n> ${SITE_DESCRIPTION}\n\nAll tools run client-side in the browser; no data is sent to a server.\n\n` +
                    categories
                        .map(
                            (c) =>
                                `## ${c}\n\n` +
                                tools
                                    .filter((t) => t.category === c)
                                    .map(
                                        (t) =>
                                            `- [${t.name}](${toolUrl(t.id)}): ${t.description}`,
                                    )
                                    .join("\n"),
                        )
                        .join("\n\n") +
                    "\n",
            });
            this.emitFile({
                type: "asset",
                fileName: "robots.txt",
                source: `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
            });
        },
    };
}
