import { OG_IMAGE, SITE_DESCRIPTION, SITE_TITLE, SITE_URL, toolOgImage, toolTitle, toolUrl } from "@/site";
import type { ToolDef } from "@/tools/registry";

function setAttr(selector: string, attr: string, value: string) {
    document.head.querySelector(selector)?.setAttribute(attr, value);
}

/** Meta for a non-tool route, set in the router's `meta.page`. */
export interface PageMeta {
    title: string;
    description: string;
    path: string;
}

/** Keeps title, description, canonical and social tags in sync during client-side navigation. */
export function applyPageMeta(tool?: ToolDef, page?: PageMeta) {
    const title = tool ? toolTitle(tool.name) : (page?.title ?? SITE_TITLE);
    const description = tool ? `${tool.description} Free, private and runs entirely in your browser.` : (page?.description ?? SITE_DESCRIPTION);
    const url = tool ? toolUrl(tool.id) : `${SITE_URL}${page?.path ?? "/"}`;
    const image = tool ? toolOgImage(tool.id) : OG_IMAGE;

    document.title = title;
    setAttr('meta[name="description"]', "content", description);
    setAttr('link[rel="canonical"]', "href", url);
    setAttr('meta[property="og:title"]', "content", title);
    setAttr('meta[property="og:description"]', "content", description);
    setAttr('meta[property="og:url"]', "content", url);
    setAttr('meta[name="twitter:title"]', "content", title);
    setAttr('meta[name="twitter:description"]', "content", description);
    setAttr('meta[property="og:image"]', "content", image);
    setAttr('meta[name="twitter:image"]', "content", image);
}
