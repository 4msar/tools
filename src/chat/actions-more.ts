import type { Action, ActionResult } from "./actions";
import { rankTools } from "./retrieval";
import { b64encode, payloadOf } from "./parse";

/**
 * Chat commands for the tools not covered in actions.ts. `earlyActions` run before the general
 * commands (bcrypt must beat "hash", token count must beat word count); `lateActions` run after them,
 * ending with a fallback that opens the best matching tool with the message's text filled in.
 */

// ---------- small helpers ----------

const r = (toolId: string, summary: string, extra: Partial<ActionResult> = {}): ActionResult => ({ toolId, summary, ...extra });
const short = (s: string, n = 40) => (s.length > n ? s.slice(0, n) + "…" : s);
const pad2 = (n: number) => String(n).padStart(2, "0");
/** yyyy-mm-ddThh:mm for <input type="datetime-local"> */
const localInput = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** The text after a command phrase, from quotes/colon/newline/fence, else what follows `after`. */
function arg(text: string, after: RegExp) {
    return payloadOf(text, new RegExp(String.raw`^.*?(?:${after.source})\s*(?:of|for|on|in|to|the|this|text|:)*\s*`, "i"));
}

// ----- colors -----
interface RGB { r: number; g: number; b: number; a: number }
function parseColor(s: string): RGB | null {
    const t = s.trim().toLowerCase();
    let m = t.match(/^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
    if (m) {
        let h = m[1];
        if (h.length <= 4) h = [...h].map((c) => c + c).join("");
        return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
    }
    m = t.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] ? (m[4].endsWith("%") ? parseFloat(m[4]) / 100 : +m[4]) : 1 };
    m = t.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)$/);
    if (m) {
        const h = +m[1] / 360, sat = +m[2] / 100, l = +m[3] / 100;
        const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p = 2 * l - q;
        const f = (t2: number) => {
            t2 = (t2 + 1) % 1;
            return 255 * (t2 < 1 / 6 ? p + (q - p) * 6 * t2 : t2 < 1 / 2 ? q : t2 < 2 / 3 ? p + (q - p) * (2 / 3 - t2) * 6 : p);
        };
        return { r: Math.round(f(h + 1 / 3)), g: Math.round(f(h)), b: Math.round(f(h - 1 / 3)), a: m[4] ? parseFloat(m[4]) / (m[4].endsWith("%") ? 100 : 1) : 1 };
    }
    return null;
}
function colorFormats({ r: R, g, b, a }: RGB) {
    const hex = "#" + [R, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("") + (a < 1 ? Math.round(a * 255).toString(16).padStart(2, "0") : "");
    const r1 = R / 255, g1 = g / 255, b1 = b / 255;
    const max = Math.max(r1, g1, b1), min = Math.min(r1, g1, b1), l = (max + min) / 2, d = max - min;
    let h = 0;
    const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    if (d) h = max === r1 ? ((g1 - b1) / d) % 6 : max === g1 ? (b1 - r1) / d + 2 : (r1 - g1) / d + 4;
    h = Math.round((h * 60 + 360) % 360);
    const al = a < 1 ? ` / ${+a.toFixed(2)}` : "";
    return `${hex}\nrgb(${R} ${g} ${b}${al})\nhsl(${h} ${Math.round(s * 100)}% ${Math.round(l * 100)}%${al})`;
}
const COLOR_RE = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/i;

// ----- time zones -----
const ZONE_ALIASES: Record<string, string> = {
    utc: "UTC", gmt: "UTC", est: "America/New_York", edt: "America/New_York", cst: "America/Chicago", cdt: "America/Chicago",
    mst: "America/Denver", pst: "America/Los_Angeles", pdt: "America/Los_Angeles", bst: "Europe/London", cet: "Europe/Paris",
    cest: "Europe/Paris", ist: "Asia/Kolkata", jst: "Asia/Tokyo", aest: "Australia/Sydney", sgt: "Asia/Singapore",
    "new york": "America/New_York", nyc: "America/New_York", "san francisco": "America/Los_Angeles", sf: "America/Los_Angeles",
    india: "Asia/Kolkata", bangladesh: "Asia/Dhaka", japan: "Asia/Tokyo", china: "Asia/Shanghai", beijing: "Asia/Shanghai",
    uk: "Europe/London", germany: "Europe/Berlin", france: "Europe/Paris", australia: "Australia/Sydney", delhi: "Asia/Kolkata",
    mumbai: "Asia/Kolkata", bangalore: "Asia/Kolkata", "local": Intl.DateTimeFormat().resolvedOptions().timeZone,
};
let zoneList: string[] | null = null;
function findZone(q: string): string | null {
    const k = q.trim().toLowerCase().replace(/[?.!]$/, "").replace(/\s+time$/, "");
    if (!k) return null;
    if (ZONE_ALIASES[k]) return ZONE_ALIASES[k];
    zoneList ??= (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
    const slug = k.replace(/\s+/g, "_");
    return zoneList.find((z) => z.toLowerCase() === slug) ?? zoneList.find((z) => z.toLowerCase().endsWith("/" + slug)) ?? null;
}
/** Wall-clock parts of `date` in `tz`. */
function partsIn(date: Date, tz: string) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(date).map((x) => [x.type, x.value]));
    return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}
/** The instant when the wall clock in `tz` shows the given time today (in that zone). */
function instantAt(tz: string, h: number, mi: number) {
    const now = partsIn(new Date(), tz);
    const guess = Date.UTC(now.y, now.mo - 1, now.d, h, mi);
    const p = partsIn(new Date(guess), tz);
    const offset = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - guess;
    return new Date(guess - offset);
}
const fmtIn = (d: Date, tz: string) => d.toLocaleString([], { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", month: "short", day: "numeric", timeZoneName: "short" });

// ----- misc -----
const LOREM = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum".split(" ");
const pick = () => LOREM[Math.floor(Math.random() * LOREM.length)];
function sentence() {
    const n = 8 + Math.floor(Math.random() * 8);
    const w = Array.from({ length: n }, pick).join(" ");
    return w[0].toUpperCase() + w.slice(1) + ".";
}
function paragraph(first: boolean) {
    const s = Array.from({ length: 4 + Math.floor(Math.random() * 3) }, sentence);
    if (first) s[0] = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
    return s.join(" ");
}

function crc32(bytes: Uint8Array) {
    let c = ~0;
    for (const b of bytes) {
        c ^= b;
        for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return (~c >>> 0).toString(16).padStart(8, "0");
}

function ipToInt(ip: string) {
    const p = ip.split(".").map(Number);
    if (p.length !== 4 || p.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return null;
    return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}
const intToIp = (n: number) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");

function base32Decode(s: string) {
    const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const clean = s.toUpperCase().replace(/[\s=-]/g, "");
    let bits = "";
    for (const ch of clean) {
        const v = alpha.indexOf(ch);
        if (v < 0) return null;
        bits += v.toString(2).padStart(5, "0");
    }
    return Uint8Array.from(bits.match(/.{8}/g) ?? [], (b) => parseInt(b, 2));
}

const PERM = (n: number) => ["r", "w", "x"].map((c, i) => (n & (4 >> i) ? c : "-")).join("");

const CODE_LANGS: Record<string, { lang: string; parser: string; plugins: () => Promise<unknown[]> }> = {};
{
    const estree = () => import("prettier/plugins/estree");
    const babel = () => import("prettier/plugins/babel");
    const add = (names: string[], lang: string, parser: string, ...loaders: (() => Promise<unknown>)[]) =>
        names.forEach((n) => (CODE_LANGS[n] = { lang, parser, plugins: () => Promise.all(loaders.map((l) => l())) }));
    add(["javascript", "js", "jsx"], "javascript", "babel", babel, estree);
    add(["typescript", "ts", "tsx"], "typescript", "typescript", () => import("prettier/plugins/typescript"), estree);
    add(["css"], "css", "css", () => import("prettier/plugins/postcss"));
    add(["scss"], "scss", "scss", () => import("prettier/plugins/postcss"));
    add(["html"], "html", "html", () => import("prettier/plugins/html"), () => import("prettier/plugins/postcss"), babel, estree);
    add(["markdown", "md"], "markdown", "markdown", () => import("prettier/plugins/markdown"));
    add(["yaml", "yml"], "yaml", "yaml", () => import("prettier/plugins/yaml"));
    add(["graphql", "gql"], "graphql", "graphql", () => import("prettier/plugins/graphql"));
}

// ---------- early actions ----------

export const earlyActions: Action[] = [
    // JWT anywhere in the message
    (text) => {
        const tok = text.match(/\beyJ[\w-]+\.[\w-]+\.[\w-]*/)?.[0];
        if (!tok) return null;
        try {
            const dec = (s: string) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0))));
            const [h, p] = tok.split(".");
            const header = dec(h), payload = dec(p);
            const exp = typeof payload.exp === "number" ? `\n\nExpires ${new Date(payload.exp * 1000).toLocaleString()}${payload.exp * 1000 < Date.now() ? " (expired)" : ""}` : "";
            return r("jwt-decoder", `Decoded JWT (${header.alg ?? "no alg"}). The signature is not verified here.`, { output: `${JSON.stringify(header, null, 2)}\n${JSON.stringify(payload, null, 2)}${exp}`, handoff: { input: tok } });
        } catch {
            return r("jwt-decoder", "That doesn't look like a valid JWT.", { error: true, handoff: { input: tok } });
        }
    },

    // bcrypt (before generic "hash")
    async (text, l) => {
        if (!/\bbcrypt\b/.test(l)) return null;
        const pw = arg(text, /bcrypt(?:\s+hash)?/);
        if (!pw) return r("bcrypt-generator", "Opened the bcrypt generator.");
        const bcrypt = (await import("bcryptjs")).default;
        return r("bcrypt-generator", `bcrypt hash (cost 10) of "${short(pw, 20)}":`, { output: await bcrypt.hash(pw, 10), handoff: { input: pw } });
    },

    // Token count (before word count)
    async (text, l) => {
        if (!/\btokens?\b/.test(l) || !/\b(count|how many|number of|tokeni[sz]e)\b/.test(l)) return null;
        const input = arg(text, /tokens?|tokeni[sz]e/);
        if (!input) return r("token-counter", "Opened the Token Counter. Paste your text there.");
        const { countTokens } = await import("gpt-tokenizer/encoding/o200k_base");
        const n = countTokens(input, { allowedSpecial: "all" });
        return r("token-counter", "Token count (GPT-4o / o200k tokenizer):", { output: `${n.toLocaleString()} tokens · ${input.length.toLocaleString()} characters`, handoff: { input } });
    },

    // HMAC / checksum terms that would otherwise look like "hash"
    (text, l) => {
        const m = l.match(/\b(crc-?32|checksum|adler-?32)\b/);
        if (!m) return null;
        const input = arg(text, /crc-?32|checksum|adler-?32/);
        if (!input) return r("checksum", "Opened the Checksum tool.");
        return r("checksum", `CRC-32 of "${short(input)}":`, { output: crc32(new TextEncoder().encode(input)), handoff: { input } });
    },

    // Stopwatch
    async (_t, l) => {
        if (!/\bstopwatch\b/.test(l) && !/^lap\b/.test(l)) return null;
        const s = await import("@/tools/time/stopwatch");
        const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${pad2(Math.floor(ms / 1000) % 60)}.${pad2(Math.floor(ms / 10) % 100)}`;
        if (/\b(reset|clear)\b/.test(l)) {
            s.reset();
            return r("stopwatch", "Stopwatch reset.");
        }
        if (/\b(stop|pause)\b/.test(l)) {
            s.pause();
            return r("stopwatch", `Stopwatch paused at ${fmt(s.elapsedMs())}.`);
        }
        if (/\blap\b/.test(l)) {
            s.lap();
            return r("stopwatch", `Lap ${s.sw.laps.length} at ${fmt(s.elapsedMs())}.`);
        }
        s.start();
        return r("stopwatch", "Stopwatch started.");
    },
];

// ---------- late actions ----------

export const lateActions: Action[] = [
    // Cron expressions
    async (text, l) => {
        const FIELDS = /^[\w*?/,#-]+(\s+[\w*?/,#-]+){4,5}$/;
        const named = /\bcron(tab)?\b/.test(l);
        const candidate = named ? (payloadOf(text) || text.replace(/^.*?\bcron(?:tab)?\b\s*(?:expression|schedule)?\s*(?:for|of)?\s*:?\s*/i, "")).trim() : text.trim();
        const expr = FIELDS.test(candidate) && /[*\d]/.test(candidate) ? candidate : null;
        if (!expr) return named ? r("cron-calculator", "Opened the Cron Calculator.") : null;
        if (!named && !/^[\d*/,-]+\s/.test(expr)) return null;
        const { toString } = await import("cronstrue");
        const { CronExpressionParser } = await import("cron-parser");
        try {
            const desc = toString(expr!);
            const it = CronExpressionParser.parse(expr!, { currentDate: new Date() });
            const next = Array.from({ length: 3 }, () => it.next().toDate().toLocaleString());
            return r("cron-calculator", `${desc}.`, { output: `Next runs:\n${next.join("\n")}`, handoff: { input: expr } });
        } catch (e) {
            return r("cron-calculator", `That cron expression doesn't parse: ${e instanceof Error ? e.message : e}`, { error: true, handoff: { input: expr } });
        }
    },

    // Time zones: "time in Tokyo", "3pm UTC in Tokyo", "15:30 london to new york"
    (text, l) => {
        let m = l.match(/^(?:what(?:'s| is) the )?(?:current )?time (?:is it )?(?:now )?in ([a-z _/]+?)\??$/) ?? l.match(/^what time is it in ([a-z _/]+?)\??$/);
        if (m) {
            const tz = findZone(m[1]);
            if (!tz) return null;
            return r("timezone-converter", `Time in ${tz.split("/").pop()!.replace(/_/g, " ")}:`, { output: fmtIn(new Date(), tz), handoff: { source: tz } });
        }
        m = l.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+([a-z _/]+?)\s+(?:in|to|into|→)\s+([a-z _/]+?)(?:\s+time)?\??$/);
        if (!m) return null;
        const from = findZone(m[4]), to = findZone(m[5]);
        if (!from || !to) return null;
        let h = +m[1];
        if (m[3] === "pm" && h < 12) h += 12;
        if (m[3] === "am" && h === 12) h = 0;
        const at = instantAt(from, h, +(m[2] ?? 0));
        const p = partsIn(at, from);
        return r("timezone-converter", `${text.match(/\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i)![0].trim()} in ${from} is:`, {
            output: fmtIn(at, to),
            handoff: { source: from, input: `${p.y}-${pad2(p.mo)}-${pad2(p.d)}T${pad2(p.h)}:${pad2(p.mi)}:00` },
        });
    },

    // Date maths: "days between A and B", "days until X", "days since X", "30 days from now"
    (_t, l) => {
        const D = String.raw`(\d{4}-\d{2}-\d{2}(?:[t ]\d{2}:\d{2})?|today|now|tomorrow|yesterday)`;
        const toDate = (s: string) => {
            const d = s === "today" || s === "now" ? new Date() : s === "tomorrow" ? new Date(Date.now() + 864e5) : s === "yesterday" ? new Date(Date.now() - 864e5) : new Date(s.replace(" ", "T"));
            return Number.isNaN(d.getTime()) ? null : d;
        };
        const fmt = (ms: number) => {
            const days = ms / 864e5;
            return `${Math.round(days).toLocaleString()} days (${(days / 7).toFixed(1)} weeks, ${Math.floor(ms / 36e5).toLocaleString()} hours)`;
        };
        let m = l.match(new RegExp(String.raw`\b(?:between|from)\s+${D}\s+(?:and|to|until)\s+${D}`));
        if (m) {
            const a = toDate(m[1]), b = toDate(m[2]);
            if (!a || !b) return null;
            return r("date-difference", `Between ${m[1]} and ${m[2]}:`, { output: fmt(Math.abs(b.getTime() - a.getTime())), handoff: { start: localInput(a), end: localInput(b) } });
        }
        m = l.match(new RegExp(String.raw`\b(?:days?|weeks?|time|how long)\s+(until|till|to|since)\s+${D}`));
        if (m) {
            const d = toDate(m[2]);
            if (!d) return null;
            const now = new Date();
            return r("date-difference", `${m[1] === "since" ? "Since" : "Until"} ${m[2]}:`, { output: fmt(Math.abs(d.getTime() - now.getTime())), handoff: { start: localInput(now), end: localInput(d) } });
        }
        m = l.match(new RegExp(String.raw`\b(\d+)\s+(days?|weeks?|months?|years?)\s+(from|after|before|ago)\s*${D}?`));
        if (m && (m[4] || /\b(from now|ago)\b/.test(l))) {
            const base = m[4] ? toDate(m[4]) : new Date();
            if (!base) return null;
            const n = +m[1] * (m[3] === "before" || m[3] === "ago" ? -1 : 1);
            const d = new Date(base);
            if (m[2].startsWith("day")) d.setDate(d.getDate() + n);
            else if (m[2].startsWith("week")) d.setDate(d.getDate() + n * 7);
            else if (m[2].startsWith("month")) d.setMonth(d.getMonth() + n);
            else d.setFullYear(d.getFullYear() + n);
            return r("date-difference", `${m[1]} ${m[2]} ${m[3]} ${m[4] ?? "now"}:`, { output: d.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" }) });
        }
        return null;
    },

    // px / rem / em / pt
    (_t, l) => {
        const m = l.match(/(\d+(?:\.\d+)?)\s*(px|rem|em|pt)\s+(?:to|in|into|as)\s+(px|rem|em|pt)\b/);
        if (!m) return null;
        const root = +(l.match(/\b(?:base|root)(?: font size)?(?: of)?\s*(\d+)/)?.[1] ?? 16);
        const toPx = { px: 1, rem: root, em: root, pt: 4 / 3 } as const;
        const px = +m[1] * toPx[m[2] as "px"];
        const out = px / toPx[m[3] as "px"];
        return r("px-rem", `${m[1]}${m[2]} in ${m[3]} (root ${root}px):`, { output: `${+out.toFixed(4)}${m[3]}` });
    },

    // Aspect ratio: "1920x1080 aspect ratio"
    (_t, l) => {
        const m = l.match(/\b(\d{2,5})\s*[x×*:]\s*(\d{2,5})\b/);
        if (!m || !/\b(aspect|ratio)\b/.test(l)) return null;
        const w = +m[1], h = +m[2];
        const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
        const g = gcd(w, h);
        return r("aspect-ratio", `Aspect ratio of ${w}×${h}:`, { output: `${w / g}:${h / g} (${(w / h).toFixed(4)})`, handoff: { width: w, height: h } });
    },

    // Unit conversion: "5 km to miles", "100 f to c"
    async (_t, l) => {
        const m = l.match(/(-?\d+(?:\.\d+)?)\s*([a-zµ°·/]+(?: [a-z]+)?)\s+(?:to|in|into|as)\s+([a-zµ°·/]+(?: [a-z]+)?)\s*\??$/i);
        if (!m) return null;
        const { findUnit, convertUnit, fmt } = await import("@/tools/utilities/units");
        const a = findUnit(m[2]), b = findUnit(m[3]);
        if (!a || !b || a.cat.id !== b.cat.id) return null;
        const out = convertUnit(+m[1], a.cat, a.unit, b.unit);
        return r("unit-converter", `${m[1]} ${a.unit.id} in ${b.unit.id}:`, { output: `${fmt(out)} ${b.unit.id}`, handoff: { category: a.cat.id, from: a.unit.id, value: m[1] } });
    },

    // Colors
    (text, l) => {
        if (/\brandom colou?r\b/.test(l)) {
            const hex = "#" + Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, "0")).join("");
            return r("random-color-generator", "A random color:", { output: colorFormats(parseColor(hex)!), handoff: { input: hex } });
        }
        const c = text.match(COLOR_RE)?.[0];
        if (/\b(palette|harmony|shades)\b/.test(l)) return r("color-palette-generator", c ? `Opened the palette generator with ${c}.` : "Opened the palette generator.", c ? { handoff: { input: c } } : {});
        if (/\b(tailwind|shadcn)\b.*\b(theme|scale|colou?rs?)\b|\btheme\b.*\bcolou?r\b/.test(l)) return r("theme-generator", c ? `Opened the theme generator with ${c}.` : "Opened the theme generator.", c ? { handoff: { input: c } } : {});
        if (!c || !(/\b(colou?r|to|in|convert|hex|rgb|hsl)\b/.test(l) || text.trim() === c)) return null;
        const rgb = parseColor(c);
        if (!rgb) return null;
        return r("color-converter", `${c} in other formats:`, { output: colorFormats(rgb), handoff: { input: c } });
    },

    // Lorem ipsum
    (_t, l) => {
        if (!/\b(lorem|ipsum|placeholder text|dummy text|filler text)\b/.test(l)) return null;
        const n = Math.min(20, +(l.match(/\b(\d{1,2})\b/)?.[1] ?? 3));
        const unit = /\bsentences?\b/.test(l) ? "sentences" : /\bwords?\b/.test(l) ? "words" : "paragraphs";
        const output = unit === "words" ? Array.from({ length: n }, pick).join(" ") : unit === "sentences" ? Array.from({ length: n }, sentence).join(" ") : Array.from({ length: n }, (_, i) => paragraph(i === 0)).join("\n\n");
        return r("lorem-ipsum", `${n} ${n === 1 ? unit.slice(0, -1) : unit} of lorem ipsum:`, { output, handoff: { count: n, unit } });
    },

    // Random strings / tokens / nanoid
    (_t, l) => {
        if (!/\b(random string|nanoid|nano id|random token|api key|secret key|random hex|token)\b/.test(l) || !/\b(generate|random|new|create|make|give)\b/.test(l)) return null;
        const len = Math.min(256, Math.max(4, +(l.match(/\b(\d{1,3})\b/)?.[1] ?? (/\bhex\b/.test(l) ? 32 : 21))));
        const alpha = /\bhex\b/.test(l) ? "0123456789abcdef" : "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
        const out = Array.from(crypto.getRandomValues(new Uint8Array(len)), (b) => alpha[b % alpha.length]).join("");
        return r("random-string", `A random ${/\bhex\b/.test(l) ? "hex" : "URL-safe"} string, ${len} characters:`, { output: out, handoff: { length: len } });
    },

    // Basic auth header
    (text, l) => {
        if (!/\bbasic auth/.test(l)) return null;
        const pair = text.match(/(?:^|\s)([^\s:"'`]+):([^\s"'`]+)(?:\s|$)/) ?? text.match(/\buser(?:name)?\s+(\S+)\s+(?:and\s+)?pass(?:word)?\s+(\S+)/i);
        if (!pair) return r("basic-auth", "Opened the Basic Auth generator.");
        const header = `Authorization: Basic ${b64encode(`${pair[1]}:${pair[2]}`)}`;
        return r("basic-auth", `Basic auth header for ${pair[1]}:`, { output: header, handoff: { username: pair[1], password: pair[2] } });
    },

    // TOTP / 2FA
    async (text, l) => {
        if (!/\b(totp|2fa|otp|authenticator)\b/.test(l)) return null;
        const secret = text.match(/\b([A-Z2-7]{16,}=*|[A-Z2-7]{4}(?: [A-Z2-7]{4}){3,})\b/)?.[1];
        if (!secret) return r("totp-generator", "Opened the TOTP generator.");
        const key = base32Decode(secret);
        if (!key) return r("totp-generator", "That secret isn't valid Base32.", { error: true });
        const { hmac } = await import("@noble/hashes/hmac.js");
        const { sha1 } = await import("@noble/hashes/legacy.js");
        const step = Math.floor(Date.now() / 30000);
        const msg = new Uint8Array(8);
        new DataView(msg.buffer).setUint32(4, step);
        const h = hmac(sha1, key, msg);
        const o = h[h.length - 1] & 15;
        const code = (((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6;
        return r("totp-generator", `Current code (changes in ${30 - (Math.floor(Date.now() / 1000) % 30)}s):`, { output: String(code).padStart(6, "0"), handoff: { input: secret } });
    },

    // AES encrypt / decrypt (needs a password, so it opens the tool)
    (text, l) => {
        if (!/\b(aes|encrypt|decrypt)\b/.test(l)) return null;
        const mode = /\bdecrypt\b/.test(l) ? "decrypt" : "encrypt";
        const input = arg(text, /aes(?:[\s-]?(?:en|de)crypt)?|(?:en|de)crypt/);
        return r("aes-encryption", `Opened AES ${mode}ion${input ? " with your text" : ""}. Enter a password there; it never leaves your browser.`, { handoff: { mode, ...(input ? { input } : {}) } });
    },

    // Key pairs
    (_t, l) => (/\b(ssh|rsa|ed25519|ecdsa)\b.*\bkeys?\b|\bkey ?pair\b/.test(l) ? r("key-pair-generator", "Opened the key pair generator. Pick a key type and press Generate.") : null),

    // Certificates and CSRs
    (text) => (/-----BEGIN (?:CERTIFICATE|CERTIFICATE REQUEST|NEW CERTIFICATE REQUEST)-----/.test(text) ? r("certificate-decoder", "Opened the certificate in the decoder.", { handoff: { input: text.slice(text.indexOf("-----BEGIN")) } }) : null),

    // CIDR / subnets
    (_t, l) => {
        const m = l.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\s*(?:\/\s*(\d{1,2})|\s+(\d{1,3}(?:\.\d{1,3}){3}))\b/);
        if (!m) return null;
        const ip = ipToInt(m[1]);
        let bits = m[2] != null ? +m[2] : -1;
        if (m[3]) {
            const mask = ipToInt(m[3]);
            if (mask == null) return null;
            bits = mask.toString(2).replace(/0+$/, "").length;
        }
        if (ip == null || bits < 0 || bits > 32) return null;
        const mask = bits ? (0xffffffff << (32 - bits)) >>> 0 : 0;
        const net = (ip & mask) >>> 0, bc = (net | ~mask) >>> 0;
        const hosts = bits >= 31 ? 2 ** (32 - bits) : 2 ** (32 - bits) - 2;
        const first = bits >= 31 ? net : net + 1, last = bits >= 31 ? bc : bc - 1;
        return r("cidr-calculator", `${intToIp(net)}/${bits}:`, {
            output: `Network    ${intToIp(net)}\nBroadcast  ${intToIp(bc)}\nMask       ${intToIp(mask)}\nHosts      ${intToIp(first)} – ${intToIp(last)} (${hosts.toLocaleString()})`,
            handoff: { input: `${m[1]}/${bits}` },
        });
    },

    // HTTP status codes
    async (_t, l) => {
        const m = l.match(/\b([1-5]\d\d)\b/);
        if (!m || !/\b(http|status|code|error|response)\b/.test(l)) return null;
        const { statuses } = await import("@/tools/network/statuses");
        const s = statuses.find((x) => x.code === +m[1]);
        if (!s) return r("http-status-codes", `${m[1]} isn't a standard HTTP status code.`, { error: true, handoff: { input: m[1] } });
        return r("http-status-codes", `${s.code} ${s.name}`, { output: s.desc, handoff: { input: m[1] } });
    },

    // User agents
    async (text, l) => {
        const ua = text.match(/Mozilla\/\d[^\n"`]*|curl\/[\d.]+|python-requests\/[\d.]+/)?.[0] ?? (/\buser[- ]?agent\b/.test(l) ? arg(text, /user[- ]?agent/) : "");
        if (!ua) return /\buser[- ]?agent\b/.test(l) ? r("user-agent-parser", "Opened the User Agent Parser.") : null;
        const Bowser = (await import("bowser")).default;
        const p = Bowser.parse(ua);
        const out = [`Browser  ${p.browser.name ?? "?"} ${p.browser.version ?? ""}`, `Engine   ${p.engine.name ?? "?"}`, `OS       ${p.os.name ?? "?"} ${p.os.versionName ?? p.os.version ?? ""}`, `Device   ${p.platform.type ?? "?"}${p.platform.vendor ? ` (${p.platform.vendor})` : ""}`].join("\n");
        return r("user-agent-parser", "Parsed user agent:", { output: out, handoff: { input: ua } });
    },

    // Programmer calculator: "0xff & 0x0f", "1 << 10"
    (_t, l) => {
        const N = String.raw`(0x[0-9a-f]+|0b[01]+|0o[0-7]+|\d+)`;
        const m = l.match(new RegExp(String.raw`^${N}\s*(&|\||\^|<<|>>|and|or|xor)\s*${N}$`));
        if (!m) return null;
        const a = BigInt(m[1]), b = BigInt(m[3]);
        const op = { and: "&", or: "|", xor: "^" }[m[2]] ?? m[2];
        const v = op === "&" ? a & b : op === "|" ? a | b : op === "^" ? a ^ b : op === "<<" ? a << b : a >> b;
        return r("programmer-calculator", `${m[1]} ${op} ${m[3]} =`, { output: `${v}\n0x${v.toString(16).toUpperCase()}\n0b${v.toString(2)}` });
    },

    // chmod
    (_t, l) => {
        const oct = l.match(/\b(?:chmod|permissions?|mode)\s+([0-7]{3,4})\b/)?.[1] ?? (l.match(/^([0-7]{3,4})$/)?.[1] && /\bchmod\b/.test(l) ? l : undefined);
        const sym = l.match(/\b([r-][w-][xsS-][r-][w-][xsS-][r-][w-][xtT-])\b/)?.[1];
        if (oct) {
            const d = oct.slice(-3).split("").map(Number);
            return r("chmod-calculator", `chmod ${oct}:`, { output: `${d.map(PERM).join("")}\nowner ${PERM(d[0])} · group ${PERM(d[1])} · others ${PERM(d[2])}`, handoff: { input: oct } });
        }
        if (sym && /\b(chmod|octal|permissions?)\b/.test(l)) {
            const o = [0, 3, 6].map((i) => (sym[i] === "r" ? 4 : 0) + (sym[i + 1] === "w" ? 2 : 0) + (/[xs t]/.test(sym[i + 2]) && sym[i + 2] !== "-" ? 1 : 0)).join("");
            return r("chmod-calculator", `${sym} in octal:`, { output: `chmod ${o}`, handoff: { input: o } });
        }
        return /\bchmod\b/.test(l) ? r("chmod-calculator", "Opened the chmod calculator.") : null;
    },

    // Luhn
    (_t, l) => {
        if (!/\bluhn\b|\bcard number\b/.test(l)) return null;
        const num = l.match(/\b(\d[\d -]{6,}\d)\b/)?.[1]?.replace(/\D/g, "");
        if (!num) return r("checksum", "Opened the Checksum tool (it has a Luhn checker).");
        let sum = 0;
        [...num].reverse().forEach((c, i) => {
            let d = +c;
            if (i % 2) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
            sum += d;
        });
        return r("checksum", sum % 10 === 0 ? `${num} passes the Luhn check.` : `${num} fails the Luhn check.`, { error: sum % 10 !== 0 });
    },

    // Regex: "test /\d+/g on abc 123"
    (text, l) => {
        const m = text.match(/\/((?:\\.|[^/\n])+)\/([dgimsuvy]*)/);
        if (!m || !/\b(regex|regexp|pattern|match|test)\b/.test(l)) return null;
        const subject = text.slice((m.index ?? 0) + m[0].length).replace(/^\s*(?:on|in|against|with|for|:)\s*/i, "").replace(/^["'`]|["'`]$/g, "");
        try {
            const re = new RegExp(m[1], m[2].includes("g") ? m[2] : m[2] + "g");
            const hits = subject ? [...subject.matchAll(re)].slice(0, 50) : [];
            const out = hits.map((h, i) => `${i + 1}. "${h[0]}" at ${h.index}${h.length > 1 ? `  groups: ${h.slice(1).map((g) => JSON.stringify(g ?? null)).join(", ")}` : ""}`).join("\n");
            return r("regex-tester", subject ? `${hits.length} match${hits.length === 1 ? "" : "es"}:` : "Opened the pattern in the Regex Tester.", { output: out || undefined, handoff: { pattern: m[1], ...(subject ? { input: subject } : {}) } });
        } catch (e) {
            return r("regex-tester", `Invalid regex: ${e instanceof Error ? e.message : e}`, { error: true, handoff: { pattern: m[1] } });
        }
    },

    // JSONPath: "$.store.book[*].author on {...}"
    async (text) => {
        const path = text.match(/(?:^|\s)(\$[.[][^\s]*)/)?.[1];
        const json = path ? text.slice(text.indexOf(path) + path.length).match(/[[{][\s\S]*[\]}]/)?.[0] : undefined;
        if (!path || !json || !text.includes(path)) return null;
        try {
            const { JSONPath } = await import("jsonpath-plus");
            const res = JSONPath({ path, json: JSON.parse(json) }) as unknown[];
            return r("json-path", `${res.length} result${res.length === 1 ? "" : "s"} for ${path}:`, { output: JSON.stringify(res, null, 2), handoff: { path, input: json } });
        } catch {
            return r("json-path", "Couldn't run that query; I opened it in the JSONPath tool.", { error: true, handoff: { path, input: json } });
        }
    },

    // Semver
    async (_t, l) => {
        const V = String.raw`v?\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?`;
        const semver = (await import("semver")).default;
        let m = l.match(new RegExp(String.raw`(${V})\s+(?:satisf(?:y|ies)|match(?:es)?|in(?: range)?|fits?)\s+(.+?)\??$`));
        if (m) {
            const ok = semver.satisfies(m[1], m[2]);
            return r("semver-calculator", `${m[1]} ${ok ? "satisfies" : "does not satisfy"} ${m[2]}.`, { error: !ok, handoff: { range: m[2], input: m[1] } });
        }
        m = l.match(new RegExp(String.raw`\bbump\s+(${V})\s+(major|minor|patch|premajor|preminor|prepatch|prerelease)\b|\bbump\s+(major|minor|patch|premajor|preminor|prepatch|prerelease)\s+(?:of\s+)?(${V})`));
        if (m) {
            const v = m[1] ?? m[4], kind = (m[2] ?? m[3]) as "major";
            return r("semver-calculator", `${v} after a ${kind} bump:`, { output: semver.inc(v, kind) ?? "invalid version" });
        }
        m = l.match(new RegExp(String.raw`\b(?:compare|is)\s+(${V})\s+(?:and|vs\.?|with|to|greater than|newer than|>|<|less than|older than)\s+(${V})`));
        if (m) {
            const c = semver.compare(m[1], m[2]);
            return r("semver-calculator", c === 0 ? `${m[1]} and ${m[2]} are equal.` : `${c > 0 ? m[1] : m[2]} is newer than ${c > 0 ? m[2] : m[1]}.`);
        }
        return /\bsemver\b/.test(l) ? r("semver-calculator", "Opened the Semver Calculator.") : null;
    },

    // Config formats: "yaml to json", "json to toml"
    async (text, l) => {
        const m = l.match(/\b(json5?|ya?ml|toml|env|\.env)\s+(?:to|→|into|as)\s+(json5?|ya?ml|toml|env|\.env)\b/);
        if (!m) return null;
        const norm = (f: string) => (f === "yml" ? "yaml" : f === ".env" ? "env" : f) as "json" | "json5" | "yaml" | "toml" | "env";
        const from = norm(m[1]), to = norm(m[2]);
        const input = payloadOf(text, /^.*?\b(?:json5?|ya?ml|toml|\.?env)\s+(?:to|→|into|as)\s+(?:json5?|ya?ml|toml|\.?env)\b\s*:?\s*/i);
        if (!input) return r("config-converter", `Opened the config converter (${from} → ${to}).`, { handoff: { from, to } });
        if (from === "env" || to === "env" || to === "json5") return r("config-converter", `Opened your ${from} in the config converter.`, { handoff: { from, to, input } });
        try {
            const yaml = await import("js-yaml");
            const toml = await import("smol-toml");
            const data = from === "json" ? JSON.parse(input) : from === "json5" ? (await import("json5")).default.parse(input) : from === "yaml" ? yaml.load(input) : toml.parse(input);
            const out = to === "json" ? JSON.stringify(data, null, 2) : to === "yaml" ? yaml.dump(data) : toml.stringify(data as Record<string, unknown>);
            return r("config-converter", `${from.toUpperCase()} → ${to.toUpperCase()}:`, { output: out.trimEnd(), handoff: { from, to, input } });
        } catch (e) {
            return r("config-converter", `Couldn't parse that ${from}: ${e instanceof Error ? e.message.split("\n")[0] : e}`, { error: true, handoff: { from, to, input } });
        }
    },

    // CSV ↔ JSON
    async (text, l) => {
        const m = l.match(/\b(csv|json)\s+(?:to|→|into|as)\s+(csv|json)\b/);
        if (!m || m[1] === m[2]) return null;
        const dir = m[1] === "csv" ? "csv2json" : "json2csv";
        const input = payloadOf(text, /^.*?\b(?:csv|json)\s+(?:to|→|into|as)\s+(?:csv|json)\b\s*:?\s*/i);
        if (!input) return r("csv-json", "Opened the CSV ↔ JSON converter.", { handoff: { dir } });
        const Papa = (await import("papaparse")).default;
        try {
            const out = dir === "csv2json" ? JSON.stringify(Papa.parse(input, { header: true, dynamicTyping: true, skipEmptyLines: true }).data, null, 2) : Papa.unparse(JSON.parse(input));
            return r("csv-json", dir === "csv2json" ? "As JSON:" : "As CSV:", { output: out, handoff: { dir, input } });
        } catch {
            return r("csv-json", "Couldn't convert that. I opened it in the converter.", { error: true, handoff: { dir, input } });
        }
    },

    // Markdown → HTML
    async (text, l) => {
        if (!/\b(markdown|md)\b/.test(l)) return null;
        const input = payloadOf(text, /^.*?\b(?:markdown|md)\b(?:\s+to\s+html)?\s*:?\s*/i);
        if (!input) return r("markdown-preview", "Opened the Markdown preview.");
        if (!/\bhtml\b/.test(l)) return r("markdown-preview", "Opened your Markdown in the preview.", { handoff: { input } });
        const { marked } = await import("marked");
        return r("markdown-preview", "As HTML:", { output: (marked.parse(input, { async: false }) as string).trim(), handoff: { input } });
    },

    // Escaping: HTML entities, JSON strings, Unicode
    (text, l) => {
        const m = l.match(/\b(un)?escape\b.*?\b(html|json|unicode)\b|\b(html|json|unicode)\b.*?\b(un)?escape\b|\b(html) (en|de)code\b|\b(en|de)code html( entities)?\b/);
        if (!m) return null;
        const kind = (m[2] ?? m[3] ?? "html") as "html" | "json" | "unicode";
        const un = !!(m[1] ?? m[4]) || m[6] === "de" || m[7] === "de";
        const input = payloadOf(text, /^.*?\b(?:(?:un)?escape|(?:en|de)code)\b\s*(?:html|json|unicode)?\s*(?:entities|string)?\s*:?\s*/i);
        if (!input) return r("escape-tools", "Opened Escape Tools.", { handoff: { kind, dir: un ? "unescape" : "escape" } });
        let out: string;
        try {
            if (kind === "html") {
                if (un) {
                    const ta = document.createElement("textarea");
                    ta.innerHTML = input;
                    out = ta.value;
                } else out = input.replace(/[&<>"']/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot", "'": "#39" }[c]};`);
            } else if (kind === "json") out = un ? JSON.parse(`"${input}"`) : JSON.stringify(input).slice(1, -1);
            else out = un ? input.replace(/\\u\{?([0-9a-f]{4,6})\}?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))) : [...input].map((c) => (c.codePointAt(0)! > 126 ? `\\u${c.codePointAt(0)!.toString(16).padStart(4, "0")}` : c)).join("");
        } catch {
            return r("escape-tools", "Couldn't unescape that.", { error: true, handoff: { kind, dir: "unescape", input } });
        }
        return r("escape-tools", `${un ? "Unescaped" : "Escaped"} ${kind === "html" ? "HTML" : kind === "json" ? "JSON string" : "Unicode"}:`, { output: out, handoff: { kind, dir: un ? "unescape" : "escape", input } });
    },

    // gzip
    async (text, l) => {
        const m = l.match(/\b(gzip|gunzip|deflate|inflate|compress|decompress)\b/);
        if (!m) return null;
        const un = /^(gunzip|inflate|decompress)$/.test(m[1]);
        const input = arg(text, /gzip|gunzip|deflate|inflate|decompress|compress/);
        if (!input) return r("compression", "Opened the compression tool.", { handoff: { mode: un ? "decompress" : "compress" } });
        const { gzipSync, gunzipSync, strToU8, strFromU8 } = await import("fflate");
        try {
            if (un) {
                const bytes = Uint8Array.from(atob(input.replace(/\s+/g, "")), (c) => c.charCodeAt(0));
                return r("compression", "Decompressed:", { output: strFromU8(gunzipSync(bytes)), handoff: { mode: "decompress", input } });
            }
            const gz = gzipSync(strToU8(input));
            let bin = "";
            gz.forEach((b) => (bin += String.fromCharCode(b)));
            return r("compression", `GZIP as Base64 (${input.length} → ${gz.length} bytes):`, { output: btoa(bin), handoff: { mode: "compress", input } });
        } catch {
            return r("compression", "That isn't GZIP data in Base64.", { error: true, handoff: { mode: "decompress", input } });
        }
    },

    // SQL
    async (text, l) => {
        if (!/\bsql\b/.test(l) && !/^\s*(select|insert|update|delete|create|alter|with)\b[\s\S]*\b(from|into|set|table|values)\b/i.test(text)) return null;
        if (/\bsql\b/.test(l) && !/\b(format|prettify|beautify|minify|pretty|indent|clean)\b/.test(l) && !/\b(select|insert|update|delete|create)\b/.test(l)) return null;
        const input = payloadOf(text, /^.*?\bsql\b\s*:?\s*/i) || text;
        if (/\bminify\b/.test(l)) return r("sql-formatter", "Minified SQL:", { output: input.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim(), handoff: { input } });
        try {
            const { format } = await import("sql-formatter");
            return r("sql-formatter", "Formatted SQL:", { output: format(input), handoff: { input } });
        } catch (e) {
            return r("sql-formatter", `Couldn't format that SQL: ${e instanceof Error ? e.message.split("\n")[0] : e}`, { error: true, handoff: { input } });
        }
    },

    // Code formatting with Prettier: "format css: …"
    async (text, l) => {
        const m = l.match(/\b(?:format|prettify|beautify|pretty print)\b.*?\b(javascript|typescript|jsx|tsx|js|ts|css|scss|html|markdown|md|yaml|yml|graphql|gql)\b|\b(javascript|typescript|js|ts|css|scss|html|yaml|graphql)\b.*?\b(?:format|prettify|beautify)\b/);
        if (!m) return null;
        const cfg = CODE_LANGS[m[1] ?? m[2]];
        const input = payloadOf(text, /^.*?\b(?:format|prettify|beautify|pretty print)\b\s*(?:this|my|the)?\s*\w*\s*(?:code)?\s*:?\s*/i);
        if (!input) return r("code-formatter", "Opened the code formatter.", { handoff: { lang: cfg.lang } });
        try {
            const prettier = await import("prettier/standalone");
            const plugins = (await cfg.plugins()).map((p) => ((p as { default?: unknown }).default ?? p)) as never[];
            const output = await prettier.format(input, { parser: cfg.parser, plugins, tabWidth: 2 });
            return r("code-formatter", `Formatted ${cfg.lang}:`, { output: output.trimEnd(), handoff: { lang: cfg.lang, input } });
        } catch (e) {
            return r("code-formatter", `Couldn't format that: ${e instanceof Error ? e.message.split("\n")[0] : e}`, { error: true, handoff: { lang: cfg.lang, input } });
        }
    },

    // Line tools: sort / dedupe / reverse / shuffle lines
    (text, l) => {
        const m = l.match(/\b(sort|dedupe|de-duplicate|deduplicate|unique|uniq|reverse|shuffle|remove duplicates? (?:from|in))\b(?: the)? lines?\b|\b(sort|dedupe|deduplicate|reverse|shuffle)\b.*\b(lines|list)\b/);
        if (!m) return null;
        const op = (m[1] ?? m[2]).replace(/^(de-?duplicate|unique|uniq|remove duplicates?.*)$/, "dedupe");
        const input = payloadOf(text);
        if (!input) return r("line-tools", "Opened Line Tools.");
        let lines = input.split(/\r?\n/);
        if (op === "sort") lines = [...lines].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        else if (op === "dedupe") lines = [...new Set(lines)];
        else if (op === "reverse") lines = [...lines].reverse();
        else lines = [...lines].map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
        const verb = { sort: "Sorted", dedupe: "Deduped", reverse: "Reversed", shuffle: "Shuffled" }[op] ?? "Processed";
        return r("line-tools", `${verb} ${lines.length} lines:`, { output: lines.join("\n"), handoff: { input } });
    },

    // Compare / diff two texts or JSON documents (two fenced blocks, or split by a line of ---)
    (text, l) => {
        if (!/\b(compare|diff|difference)\b/.test(l)) return null;
        const blocks = [...text.matchAll(/```[\w-]*\n?([\s\S]*?)```/g)].map((x) => x[1].trim());
        const parts = blocks.length >= 2 ? blocks : text.includes("\n---\n") ? text.slice(text.indexOf("\n") + 1).split("\n---\n").map((s) => s.trim()) : [];
        if (parts.length < 2) return /\bjson\b/.test(l) ? r("json-diff", "Opened JSON Diff.") : /\btext\b/.test(l) ? r("text-compare", "Opened Text Compare.") : null;
        const isJson = parts.slice(0, 2).every((p) => {
            try {
                JSON.parse(p);
                return true;
            } catch {
                return false;
            }
        });
        return r(isJson ? "json-diff" : "text-compare", `Opened both ${isJson ? "JSON documents" : "texts"} side by side.`, { handoff: { left: parts[0], right: parts[1] } });
    },

    // .gitignore
    async (_t, l) => {
        if (!/\bgit ?ignore\b/.test(l)) return null;
        const { T } = await import("@/tools/generators/gitignoreTemplates");
        const words = l.replace(/\bgit ?ignore\b/g, " ").split(/[^a-z0-9.#+]+/).filter(Boolean);
        const picked = T.filter((t) => words.some((w) => t.id === w || t.name.toLowerCase() === w || t.name.toLowerCase().replace(/\.js$/, "") === w));
        if (!picked.length) return r("gitignore-generator", "Opened the .gitignore generator.");
        const output = picked.map((t) => `# ${t.name}\n${t.rules}`).join("\n\n");
        return r("gitignore-generator", `.gitignore for ${picked.map((t) => t.name).join(", ")}:`, { output, handoff: { selected: picked.map((t) => t.id) } });
    },

    // Hand-off only: tools that do their work on the page
    (text, l) => {
        const handoffOnly: [RegExp, string, string][] = [
            [/\b(code (?:to|as|into) (?:an? )?(?:image|picture|png)|code (?:screenshot|snapshot)|screenshot (?:of )?(?:my |this )?code|carbon)\b/, "code-to-image", "Opened your code in Code to Image."],
            [/\b(domain (?:name )?(?:finder|ideas?|availability|suggestions?)|(?:is|check if) .+\.[a-z]{2,} (?:available|taken|free)|find (?:me )?an? domain)\b/, "domain-finder", "Checking domain availability in Domain Name Finder."],
            [/^\s*curl\s/i, "curl-to-code", "Opened your cURL command. Pick a target language there."],
            [/\bdocker run\b/, "docker-run-to-compose", "Opened your docker run command as a Compose file."],
            [/\b(html|markup)\b.*\bjsx\b|\bjsx\b.*\bhtml\b/, "html-to-jsx", "Opened your HTML in HTML to JSX."],
            [/\bjson\b.*\b(typescript|ts|go|golang|python|types?|interfaces?|struct|schema)\b/, "json-to-code", "Opened your JSON in JSON to Code."],
            [/\bxml\b/, "xml-inspector", "Opened your XML in the XML Inspector."],
            [/\bsvg\b|^\s*<svg\b/, "svg-tools", "Opened your SVG in the optimizer."],
            [/\b(preview|render)\b.*\bhtml\b|^\s*<!doctype html/i, "html-preview", "Opened your HTML in the sandboxed preview."],
            [/\bqr( ?code)?\b/, "qr-code-generator", "Opened your text in the QR code generator."],
            [/\b(ascii art|figlet|text banner|ascii banner)\b/, "ascii-art", "Opened your text in ASCII Art."],
            [/\b(redact|mask|scrub|remove secrets|pii)\b/, "pii-redactor", "Opened your text in the Secret & PII Redactor."],
            [/\bclean\b.*\b(ai|chatgpt|gpt|llm)\b|\b(ai|chatgpt) text\b/, "ai-text-cleaner", "Opened your text in the AI Text Cleaner."],
            [/\bchunk|\bsplit\b.*\bchunks?\b|\brag\b/, "text-chunker", "Opened your text in the RAG Text Chunker."],
            [/\bprompt template\b|\{\{\s*\w+\s*\}\}/, "prompt-template", "Opened your prompt in the template builder."],
            [/\b(jsonl|ndjson|json lines)\b/, "jsonl-validator", "Opened your JSONL in the validator."],
            [/\bjson ?schema\b/, "json-schema-validator", "Opened JSON Schema Validator."],
            [/\b(px|rem)\b.*\bcss\b|\bcss\b.*\b(px|rem)\b/, "px-rem", "Opened your CSS in px ↔ rem."],
            [/\b(http request|api request|send a request|fetch)\b.*https?:\/\/|^(get|post|put|patch|delete|head)\s+https?:\/\//i, "http-request", "Opened the request. Review it and press Send; nothing has been sent yet."],
        ];
        for (const [re, toolId, summary] of handoffOnly) {
            if (!re.test(l) && !re.test(text)) continue;
            let input = payloadOf(text);
            if (toolId === "curl-to-code" && !input) input = text.trim();
            if (toolId === "docker-run-to-compose" && !input) input = text.slice(l.indexOf("docker run")).trim();
            if (toolId === "http-request") input = text.match(/https?:\/\/\S+/)![0];
            if (toolId === "svg-tools" && !input && /^\s*<svg/i.test(text)) input = text.trim();
            if (toolId === "html-preview" && !input && /^\s*<!doctype/i.test(text)) input = text.trim();
            if (toolId === "qr-code-generator" && !input) input = text.replace(/^.*?\bqr(?: ?code)?\b\s*(?:for|of|with|to)?\s*/i, "").trim();
            if (toolId === "domain-finder" && !input) input = text.match(/\b[a-z0-9][a-z0-9-]*\.[a-z]{2,}\b/gi)?.join(", ") ?? "";
            if (toolId === "ascii-art" && !input) input = text.replace(/^.*?\b(?:ascii art|figlet|banner)\b\s*(?:for|of|with)?\s*/i, "").trim();
            return r(toolId, input ? summary : `Opened ${toolId.replace(/-/g, " ")}.`, input ? { handoff: { input } } : {});
        }
        return null;
    },

    // Fallback: the message names a tool and carries text → open that tool with the text filled in
    (text) => {
        const input = payloadOf(text);
        if (!input) return null;
        const command = text.replace(input, " ").replace(/```[\w-]*|["'`“”:]/g, " ");
        const tool = rankTools(command, 1)[0];
        if (!tool) return null;
        return r(tool.id, `Opened ${tool.name} with your text.`, { handoff: { input } });
    },
];
