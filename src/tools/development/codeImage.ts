// Renders highlighted code as a "window on a background" picture on a canvas (PNG) or as SVG.
// Drawing it ourselves keeps the preview and the export pixel-identical and needs no DOM-to-image library.

export type TokenKind = "fg" | "keyword" | "string" | "number" | "title" | "attr" | "tag" | "comment" | "meta" | "deletion";

export interface CodeTheme {
    id: string;
    name: string;
    dark: boolean;
    bg: string;
    chrome: string;
    border: string;
    lineNumber: string;
    colors: Record<TokenKind, string>;
}

export const themes: CodeTheme[] = [
    {
        id: "midnight", name: "Midnight", dark: true, bg: "#14161c", chrome: "#14161c", border: "rgba(255,255,255,0.08)", lineNumber: "#4b5263",
        colors: { fg: "#e3e6ed", keyword: "#c792ea", string: "#a5d6a7", number: "#f78c6c", title: "#82aaff", attr: "#ffcb6b", tag: "#f07178", comment: "#6a7385", meta: "#89ddff", deletion: "#ff6b6b" },
    },
    {
        id: "ocean", name: "Ocean", dark: true, bg: "#0b1d2e", chrome: "#0b1d2e", border: "rgba(255,255,255,0.08)", lineNumber: "#3d5a73",
        colors: { fg: "#d6e7f5", keyword: "#5ccfe6", string: "#bae67e", number: "#ffae57", title: "#73d0ff", attr: "#ffd580", tag: "#5ccfe6", comment: "#5c7a94", meta: "#d4bfff", deletion: "#f28779" },
    },
    {
        id: "forest", name: "Forest", dark: true, bg: "#1b2420", chrome: "#1b2420", border: "rgba(255,255,255,0.07)", lineNumber: "#4a5d53",
        colors: { fg: "#dfe8e1", keyword: "#e69875", string: "#a7c080", number: "#d699b6", title: "#83c092", attr: "#dbbc7f", tag: "#e67e80", comment: "#7a8b80", meta: "#7fbbb3", deletion: "#e67e80" },
    },
    {
        id: "ember", name: "Ember", dark: true, bg: "#1f1a24", chrome: "#1f1a24", border: "rgba(255,255,255,0.08)", lineNumber: "#5a4f63",
        colors: { fg: "#f2e9ef", keyword: "#ff7ab2", string: "#ffd479", number: "#bd93f9", title: "#7ee0c3", attr: "#ffb86c", tag: "#ff7ab2", comment: "#7c6f86", meta: "#8be9fd", deletion: "#ff5c57" },
    },
    {
        id: "mono", name: "Mono", dark: true, bg: "#111111", chrome: "#111111", border: "rgba(255,255,255,0.1)", lineNumber: "#555555",
        colors: { fg: "#e8e8e8", keyword: "#ffffff", string: "#b8b8b8", number: "#d0d0d0", title: "#ffffff", attr: "#c8c8c8", tag: "#ffffff", comment: "#6e6e6e", meta: "#a0a0a0", deletion: "#ff7b7b" },
    },
    {
        id: "paper", name: "Paper", dark: false, bg: "#fbfaf7", chrome: "#fbfaf7", border: "rgba(0,0,0,0.08)", lineNumber: "#b4b0a8",
        colors: { fg: "#2b2b2b", keyword: "#a626a4", string: "#50a14f", number: "#c2700a", title: "#4078f2", attr: "#986801", tag: "#e45649", comment: "#a0a1a7", meta: "#0184bc", deletion: "#e45649" },
    },
];

export interface Backdrop {
    id: string;
    name: string;
    /** Two or more colour stops for a 135° gradient. */
    stops: string[];
}

export const backdrops: Backdrop[] = [
    { id: "aurora", name: "Aurora", stops: ["#7f5af0", "#2cb67d"] },
    { id: "sunset", name: "Sunset", stops: ["#ff7e5f", "#feb47b"] },
    { id: "ocean", name: "Ocean", stops: ["#2193b0", "#6dd5ed"] },
    { id: "candy", name: "Candy", stops: ["#f857a6", "#ff5858"] },
    { id: "dusk", name: "Dusk", stops: ["#5f2c82", "#49a09d"] },
    { id: "lime", name: "Lime", stops: ["#a8e063", "#56ab2f"] },
    { id: "slate", name: "Slate", stops: ["#475569", "#0f172a"] },
    { id: "peach", name: "Peach", stops: ["#ffecd2", "#fcb69f"] },
];

export interface ImageOptions {
    theme: CodeTheme;
    /** A backdrop id, "solid" (uses `solid`) or "none" (transparent). */
    background: string;
    solid: string;
    padding: number;
    fontSize: number;
    lineNumbers: boolean;
    window: "mac" | "plain" | "none";
    title: string;
    shadow: boolean;
    radius: number;
}

export interface Token {
    text: string;
    kind: TokenKind;
    italic?: boolean;
}

const FONT_STACK = `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
const TITLE_STACK = `Sora, ui-sans-serif, system-ui, sans-serif`;

// Same grouping as the hljs colours in style.css, innermost class first.
const classKinds: [RegExp, TokenKind][] = [
    [/^hljs-(comment|quote)$/, "comment"],
    [/^hljs-deletion$/, "deletion"],
    [/^hljs-number$/, "number"],
    [/^hljs-(string|regexp|addition|template-string|symbol|bullet)$/, "string"],
    [/^hljs-(keyword|selector-tag|built_in|literal|type|doctag)$/, "keyword"],
    [/^hljs-(title|section|selector-id)$/, "title"],
    [/^hljs-(tag|name)$/, "tag"],
    [/^hljs-(attr|attribute|property|selector-class|selector-attr|selector-pseudo|variable|template-variable|params)$/, "attr"],
    [/^hljs-(meta|link|subst)$/, "meta"],
];

function kindOf(el: Element): TokenKind | null {
    const list = [...el.classList];
    if (list.includes("hljs-variable") && list.includes("constant_")) return "number";
    for (const cls of list) for (const [re, kind] of classKinds) if (re.test(cls)) return kind;
    return null;
}

/** Splits highlight.js HTML into lines of coloured tokens. */
export function tokenize(html: string, tabSize = 4): Token[][] {
    const root = document.createElement("div");
    root.innerHTML = html;
    const lines: Token[][] = [[]];
    const walk = (node: Node, kind: TokenKind, italic: boolean) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const parts = (node.textContent ?? "").replace(/\t/g, " ".repeat(tabSize)).split("\n");
            parts.forEach((text, i) => {
                if (i) lines.push([]);
                if (text) lines[lines.length - 1].push({ text, kind, italic });
            });
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const own = kindOf(node as Element);
        const next = own ?? kind;
        node.childNodes.forEach((child) => walk(child, next, italic || own === "comment"));
    };
    root.childNodes.forEach((child) => walk(child, "fg", false));
    return lines;
}

interface Layout {
    width: number;
    height: number;
    win: { x: number; y: number; w: number; h: number };
    chromeH: number;
    gutter: number;
    codeX: number;
    codeY: number;
    lineH: number;
    font: string;
}

function measure(lines: Token[][], o: ImageOptions): Layout {
    const ctx = document.createElement("canvas").getContext("2d")!;
    const font = `${o.fontSize}px ${FONT_STACK}`;
    ctx.font = font;
    const lineW = (line: Token[]) => line.reduce((w, t) => w + ctx.measureText(t.text).width, 0);
    const codeW = Math.max(0, ...lines.map(lineW));
    const gutter = o.lineNumbers ? Math.ceil(ctx.measureText(String(lines.length)).width) + 20 : 0;
    const chromeH = o.window === "none" ? 0 : 40;
    const padX = 22;
    const padY = o.window === "none" ? 20 : 6;
    const lineH = Math.round(o.fontSize * 1.6);
    ctx.font = `500 13px ${TITLE_STACK}`;
    const titleW = o.window !== "none" && o.title ? ctx.measureText(o.title).width + 160 : 0;
    const w = Math.ceil(Math.max(padX * 2 + gutter + codeW, titleW, 240));
    const h = Math.ceil(chromeH + padY + 20 + lines.length * lineH);
    const p = o.padding;
    return {
        width: w + p * 2,
        height: h + p * 2,
        win: { x: p, y: p, w, h },
        chromeH,
        gutter,
        codeX: p + padX,
        codeY: p + chromeH + padY,
        lineH,
        font,
    };
}

const dots = ["#ff5f57", "#febc2e", "#28c840"];

/** Draws the picture onto `canvas` at `scale` × its logical size; returns the logical size. */
export function draw(canvas: HTMLCanvasElement, lines: Token[][], o: ImageOptions, scale = 1) {
    const L = measure(lines, o);
    // Browsers cap canvas sides around 16k px; shrink the scale rather than fail.
    const s = Math.min(scale, 16000 / L.width, 16000 / L.height);
    canvas.width = Math.round(L.width * s);
    canvas.height = Math.round(L.height * s);
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.clearRect(0, 0, L.width, L.height);

    // Backdrop
    const backdrop = backdrops.find((b) => b.id === o.background);
    if (backdrop) {
        const g = ctx.createLinearGradient(0, 0, L.width, L.height);
        backdrop.stops.forEach((c, i) => g.addColorStop(i / (backdrop.stops.length - 1), c));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, L.width, L.height);
    } else if (o.background === "solid") {
        ctx.fillStyle = o.solid;
        ctx.fillRect(0, 0, L.width, L.height);
    }

    // Window
    const { x, y, w, h } = L.win;
    const t = o.theme;
    ctx.save();
    if (o.shadow && o.padding >= 16) {
        ctx.shadowColor = "rgba(0,0,0,0.45)";
        ctx.shadowBlur = Math.min(60, o.padding);
        ctx.shadowOffsetY = Math.min(20, o.padding / 3);
    }
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, o.radius);
    ctx.fillStyle = t.bg;
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, o.radius);
    ctx.strokeStyle = t.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    if (o.window !== "none") {
        const cy = y + L.chromeH / 2;
        if (o.window === "mac")
            dots.forEach((c, i) => {
                ctx.beginPath();
                ctx.arc(x + 20 + i * 20, cy, 6, 0, Math.PI * 2);
                ctx.fillStyle = c;
                ctx.fill();
            });
        if (o.title) {
            ctx.font = `500 13px ${TITLE_STACK}`;
            ctx.fillStyle = t.lineNumber;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(o.title, x + w / 2, cy);
        }
    }

    // Code
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    lines.forEach((line, i) => {
        const ly = L.codeY + i * L.lineH + L.lineH / 2;
        if (o.lineNumbers) {
            ctx.font = L.font;
            ctx.fillStyle = t.lineNumber;
            ctx.textAlign = "right";
            ctx.fillText(String(i + 1), L.codeX + L.gutter - 20, ly);
            ctx.textAlign = "left";
        }
        let lx = L.codeX + L.gutter;
        for (const tok of line) {
            ctx.font = (tok.italic ? "italic " : "") + L.font;
            ctx.fillStyle = t.colors[tok.kind];
            ctx.fillText(tok.text, lx, ly);
            lx += ctx.measureText(tok.text).width;
        }
    });
    return { width: L.width, height: L.height };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The same picture as a standalone SVG (text stays selectable; the viewer needs the font or falls back to monospace). */
export function toSvg(lines: Token[][], o: ImageOptions): string {
    const L = measure(lines, o);
    const t = o.theme;
    const { x, y, w, h } = L.win;
    const parts: string[] = [];
    const defs: string[] = [];
    const backdrop = backdrops.find((b) => b.id === o.background);
    if (backdrop) {
        defs.push(
            `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">${backdrop.stops
                .map((c, i) => `<stop offset="${i / (backdrop.stops.length - 1)}" stop-color="${c}"/>`)
                .join("")}</linearGradient>`,
        );
        parts.push(`<rect width="100%" height="100%" fill="url(#bg)"/>`);
    } else if (o.background === "solid") parts.push(`<rect width="100%" height="100%" fill="${esc(o.solid)}"/>`);
    if (o.shadow && o.padding >= 16)
        defs.push(`<filter id="sh" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="${Math.min(20, o.padding / 3)}" stdDeviation="${Math.min(60, o.padding) / 2}" flood-color="#000" flood-opacity="0.45"/></filter>`);
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.radius}" fill="${t.bg}"${o.shadow && o.padding >= 16 ? ' filter="url(#sh)"' : ""}/>`);
    parts.push(`<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="${o.radius}" fill="none" stroke="${t.border}"/>`);
    if (o.window !== "none") {
        const cy = y + L.chromeH / 2;
        if (o.window === "mac") dots.forEach((c, i) => parts.push(`<circle cx="${x + 20 + i * 20}" cy="${cy}" r="6" fill="${c}"/>`));
        if (o.title)
            parts.push(`<text x="${x + w / 2}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family='${TITLE_STACK}' font-size="13" font-weight="500" fill="${t.lineNumber}">${esc(o.title)}</text>`);
    }
    lines.forEach((line, i) => {
        const ly = L.codeY + i * L.lineH + L.lineH / 2;
        if (o.lineNumbers)
            parts.push(`<text x="${L.codeX + L.gutter - 20}" y="${ly}" text-anchor="end" dominant-baseline="central" fill="${t.lineNumber}">${i + 1}</text>`);
        if (!line.length) return;
        const spans = line
            .map((tok) => `<tspan fill="${t.colors[tok.kind]}"${tok.italic ? ' font-style="italic"' : ""}>${esc(tok.text)}</tspan>`)
            .join("");
        parts.push(`<text x="${L.codeX + L.gutter}" y="${ly}" dominant-baseline="central" xml:space="preserve">${spans}</text>`);
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${L.width}" height="${L.height}" viewBox="0 0 ${L.width} ${L.height}" font-family='${FONT_STACK}' font-size="${o.fontSize}">${
        defs.length ? `<defs>${defs.join("")}</defs>` : ""
    }${parts.join("")}</svg>`;
}

export const FONT_LOAD = [`400 16px "JetBrains Mono"`, `italic 400 16px "JetBrains Mono"`, `500 13px Sora`];
