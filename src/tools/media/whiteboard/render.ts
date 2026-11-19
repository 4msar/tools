import rough from "roughjs";
import type { Drawable, Options } from "roughjs/bin/core";
import type { RoughCanvas } from "roughjs/bin/canvas";
import { DEFAULT_STROKE, isShape, type Arrowhead, type El, type FontFamily, type Pt } from "./types";
import { unionBounds } from "./geometry";

const gen = rough.generator();
export { rough };

export const FONT_STACKS: Record<FontFamily, string> = {
    hand: "'Segoe Print','Bradley Hand','Marker Felt','Chalkboard SE','Comic Sans MS',cursive",
    normal: "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
    code: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
};
const LINE_H = 1.25;
const BASE = 0.98;

export const fontString = (el: Pick<El, "fontSize" | "fontFamily">) => `${el.fontSize}px ${FONT_STACKS[el.fontFamily]}`;

/** Only the stored default stroke is inverted in dark mode; user colors are untouched. */
export const resolveColor = (c: string, dark: boolean) => (dark && c.toLowerCase() === DEFAULT_STROKE ? "#e8e8e8" : c);

let measureCtx: CanvasRenderingContext2D | null = null;
export function measureText(text: string, el: Pick<El, "fontSize" | "fontFamily">) {
    measureCtx ??= document.createElement("canvas").getContext("2d")!;
    measureCtx.font = fontString(el);
    const lines = text.split("\n");
    const w = Math.max(...lines.map((l) => measureCtx!.measureText(l).width), 4);
    return { w, h: lines.length * el.fontSize * LINE_H, lineH: el.fontSize * LINE_H };
}

export function fitText(el: El) {
    const m = measureText(el.text ?? "", el);
    el.w = m.w;
    el.h = m.h;
}

// ---- drawables (cached per element + style) -------------------------------

function baseOptions(el: El, dark: boolean): Options {
    const stroke = resolveColor(el.strokeColor, dark);
    const filled = el.backgroundColor !== "transparent" && el.fillStyle !== "none";
    const sw = el.strokeWidth;
    const o: Options = {
        seed: el.seed,
        roughness: el.roughness,
        stroke,
        strokeWidth: sw,
        bowing: 1,
        disableMultiStroke: el.roughness === 0,
        disableMultiStrokeFill: el.roughness === 0,
    };
    if (el.strokeStyle === "dashed") o.strokeLineDash = [sw * 4 + 4, sw * 3 + 4];
    if (el.strokeStyle === "dotted") o.strokeLineDash = [1, sw * 2 + 4];
    if (filled && isShape(el)) {
        o.fill = resolveColor(el.backgroundColor, dark);
        o.fillStyle = el.fillStyle;
        o.fillWeight = Math.max(1, sw / 2);
        o.hachureGap = Math.max(8, sw * 4);
        o.hachureAngle = -41;
    }
    return o;
}

function arrowHead(tip: Pt, from: Pt, kind: Arrowhead, el: El, o: Options): Drawable[] {
    if (kind === "none") return [];
    const ho: Options = { ...o, roughness: Math.min(el.roughness, 1), strokeLineDash: undefined, disableMultiStroke: true };
    const ang = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
    const len = 10 + el.strokeWidth * 3;
    const a1: Pt = [tip[0] - len * Math.cos(ang - 0.45), tip[1] - len * Math.sin(ang - 0.45)];
    const a2: Pt = [tip[0] - len * Math.cos(ang + 0.45), tip[1] - len * Math.sin(ang + 0.45)];
    if (kind === "arrow") return [gen.linearPath([a1, tip, a2], ho)];
    if (kind === "triangle") return [gen.polygon([tip, a1, a2], { ...ho, fill: o.stroke, fillStyle: "solid" })];
    return [gen.circle(tip[0], tip[1], 4 + el.strokeWidth * 2, { ...ho, fill: o.stroke, fillStyle: "solid" })];
}

function build(el: El, dark: boolean): Drawable[] {
    const o = baseOptions(el, dark);
    const w = Math.max(el.w, 1);
    const h = Math.max(el.h, 1);
    switch (el.type) {
        case "rectangle": return [gen.rectangle(0, 0, w, h, o)];
        case "ellipse": return [gen.ellipse(w / 2, h / 2, w, h, o)];
        case "diamond": return [gen.polygon([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]], o)];
        case "line":
        case "arrow": {
            const pts = el.points ?? [[0, 0], [w, h]];
            if (pts.length < 2) return [];
            const out = [gen.linearPath(pts, o)];
            if (el.type === "arrow") {
                out.push(...arrowHead(pts[pts.length - 1], pts[pts.length - 2], el.endHead, el, o));
                out.push(...arrowHead(pts[0], pts[1], el.startHead, el, o));
            }
            return out;
        }
        default: return [];
    }
}

const cache = new Map<string, { key: string; list: Drawable[] }>();
export function drawablesFor(el: El, dark: boolean): Drawable[] {
    const key = [
        el.type, Math.round(el.w * 100), Math.round(el.h * 100), el.seed, el.roughness, el.strokeWidth, el.strokeStyle, el.fillStyle,
        resolveColor(el.strokeColor, dark), resolveColor(el.backgroundColor, dark), el.startHead, el.endHead,
        el.points ? el.points.map((p) => `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`).join(";") : "",
    ].join("|");
    const hit = cache.get(el.id);
    if (hit && hit.key === key) return hit.list;
    const list = build(el, dark);
    cache.set(el.id, { key, list });
    return list;
}
export const forgetDrawables = (ids: Iterable<string>) => { for (const id of ids) cache.delete(id); };

// ---- pen paths --------------------------------------------------------------

export function penPathD(pts: Pt[]): string {
    if (!pts.length) return "";
    if (pts.length < 3) return pts.length === 1 ? `M${pts[0][0]} ${pts[0][1]}l0.01 0` : `M${pts[0][0]} ${pts[0][1]}L${pts[1][0]} ${pts[1][1]}`;
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2;
        const my = (pts[i][1] + pts[i + 1][1]) / 2;
        d += `Q${pts[i][0]} ${pts[i][1]} ${mx} ${my}`;
    }
    const last = pts[pts.length - 1];
    return d + `L${last[0]} ${last[1]}`;
}

// ---- canvas drawing ---------------------------------------------------------

export type ImageCache = Map<string, HTMLImageElement>;
export interface DrawEnv {
    dark: boolean;
    images: ImageCache;
    hideTextId?: string | null;
    fade?: Set<string>;
}

function drawLines(ctx: CanvasRenderingContext2D, el: El, color: string, centered: boolean) {
    const lines = (el.text ?? "").split("\n");
    const lh = el.fontSize * LINE_H;
    ctx.font = fontString(el);
    ctx.fillStyle = color;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = centered ? "center" : "left";
    const top = centered ? el.h / 2 - (lines.length * lh) / 2 : 0;
    const x = centered ? el.w / 2 : 0;
    lines.forEach((l, i) => ctx.fillText(l, x, top + i * lh + el.fontSize * BASE));
}

export function drawElement(ctx: CanvasRenderingContext2D, rc: RoughCanvas, el: El, env: DrawEnv) {
    ctx.save();
    ctx.globalAlpha = (el.opacity / 100) * (env.fade?.has(el.id) ? 0.25 : 1);
    ctx.translate(el.x, el.y);
    const color = resolveColor(el.strokeColor, env.dark);
    if (el.type === "text") {
        if (env.hideTextId !== el.id) drawLines(ctx, el, color, false);
    } else if (el.type === "image") {
        const img = env.images.get(el.id);
        if (img && img.complete && img.naturalWidth) ctx.drawImage(img, 0, 0, el.w, el.h);
        else {
            ctx.strokeStyle = "#888";
            ctx.strokeRect(0, 0, el.w, el.h);
        }
    } else if (el.type === "pen") {
        ctx.strokeStyle = color;
        ctx.lineWidth = el.strokeWidth * 1.2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (el.strokeStyle !== "solid") ctx.setLineDash(el.strokeStyle === "dashed" ? [el.strokeWidth * 4 + 4, el.strokeWidth * 3 + 4] : [1, el.strokeWidth * 2 + 4]);
        ctx.stroke(new Path2D(penPathD(el.points ?? [])));
    } else {
        for (const d of drawablesFor(el, env.dark)) rc.draw(d);
        if (el.text && env.hideTextId !== el.id) drawLines(ctx, el, color, true);
    }
    ctx.restore();
}

export function isVisible(el: El, vx1: number, vy1: number, vx2: number, vy2: number) {
    const p = el.strokeWidth + 12;
    return el.x + el.w + p >= vx1 && el.x - p <= vx2 && el.y + el.h + p >= vy1 && el.y - p <= vy2;
}

export function loadImage(el: El, cacheMap: ImageCache, onLoad?: () => void): Promise<void> {
    if (el.type !== "image" || !el.dataUrl) return Promise.resolve();
    const have = cacheMap.get(el.id);
    if (have) return have.complete ? Promise.resolve() : new Promise((r) => have.addEventListener("load", () => r(), { once: true }));
    const img = new Image();
    cacheMap.set(el.id, img);
    return new Promise((res) => {
        img.onload = () => { onLoad?.(); res(); };
        img.onerror = () => res();
        img.src = el.dataUrl!;
    });
}

// ---- export -----------------------------------------------------------------

export interface ExportOpts {
    padding: number;
    /** null = transparent */
    background: string | null;
    dark: boolean;
    scale?: number;
}

export async function renderToCanvas(els: El[], images: ImageCache, o: ExportOpts): Promise<HTMLCanvasElement | null> {
    const b = unionBounds(els);
    if (!b) return null;
    await Promise.all(els.map((e) => loadImage(e, images)));
    const scale = o.scale ?? 1;
    const w = Math.ceil(b.w + o.padding * 2);
    const h = Math.ceil(b.h + o.padding * 2);
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(Math.ceil(w * scale), 16000);
    canvas.height = Math.min(Math.ceil(h * scale), 16000);
    const ctx = canvas.getContext("2d")!;
    if (o.background) {
        ctx.fillStyle = o.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.setTransform(scale, 0, 0, scale, (o.padding - b.x) * scale, (o.padding - b.y) * scale);
    const rc = rough.canvas(canvas);
    for (const el of els) drawElement(ctx, rc, el, { dark: o.dark, images });
    return canvas;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (n: number) => Math.round(n * 100) / 100;

function drawableSvg(d: Drawable): string {
    const o = d.options;
    return d.sets
        .map((set) => {
            const path = gen.opsToPath(set);
            if (set.type === "path") {
                const dash = o.strokeLineDash?.length ? ` stroke-dasharray="${o.strokeLineDash.join(" ")}"` : "";
                return `<path d="${path}" fill="none" stroke="${esc(String(o.stroke))}" stroke-width="${o.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${dash}/>`;
            }
            if (set.type === "fillPath") return `<path d="${path}" fill="${esc(String(o.fill))}" stroke="none"/>`;
            return `<path d="${path}" fill="none" stroke="${esc(String(o.fill))}" stroke-width="${o.fillWeight ?? o.strokeWidth / 2}"/>`;
        })
        .join("");
}

function textSvg(el: El, color: string, centered: boolean): string {
    const lines = (el.text ?? "").split("\n");
    const lh = el.fontSize * LINE_H;
    const top = centered ? el.h / 2 - (lines.length * lh) / 2 : 0;
    const x = centered ? el.w / 2 : 0;
    const spans = lines
        .map((l, i) => `<tspan x="${num(x)}" y="${num(top + i * lh + el.fontSize * BASE)}" xml:space="preserve">${esc(l) || " "}</tspan>`)
        .join("");
    return `<text font-family="${esc(FONT_STACKS[el.fontFamily])}" font-size="${el.fontSize}" fill="${esc(color)}"${centered ? ' text-anchor="middle"' : ""}>${spans}</text>`;
}

export function renderToSvg(els: El[], o: ExportOpts): string | null {
    const b = unionBounds(els);
    if (!b) return null;
    const w = Math.ceil(b.w + o.padding * 2);
    const h = Math.ceil(b.h + o.padding * 2);
    const parts: string[] = [];
    for (const el of els) {
        const color = resolveColor(el.strokeColor, o.dark);
        let inner = "";
        if (el.type === "text") inner = textSvg(el, color, false);
        else if (el.type === "image") inner = `<image href="${esc(el.dataUrl ?? "")}" width="${num(el.w)}" height="${num(el.h)}" preserveAspectRatio="none"/>`;
        else if (el.type === "pen") {
            const dash = el.strokeStyle === "solid" ? "" : ` stroke-dasharray="${el.strokeStyle === "dashed" ? `${el.strokeWidth * 4 + 4} ${el.strokeWidth * 3 + 4}` : `1 ${el.strokeWidth * 2 + 4}`}"`;
            inner = `<path d="${penPathD(el.points ?? [])}" fill="none" stroke="${esc(color)}" stroke-width="${el.strokeWidth * 1.2}" stroke-linecap="round" stroke-linejoin="round"${dash}/>`;
        } else {
            inner = drawablesFor(el, o.dark).map(drawableSvg).join("");
            if (el.text) inner += textSvg(el, color, true);
        }
        parts.push(`<g transform="translate(${num(el.x)} ${num(el.y)})" opacity="${el.opacity / 100}">${inner}</g>`);
    }
    const bg = o.background ? `<rect x="${num(b.x - o.padding)}" y="${num(b.y - o.padding)}" width="${w}" height="${h}" fill="${esc(o.background)}"/>` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${num(b.x - o.padding)} ${num(b.y - o.padding)} ${w} ${h}" width="${w}" height="${h}">${bg}${parts.join("")}</svg>`;
}

