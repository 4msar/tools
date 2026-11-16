// Text parsing helpers for chat commands.

/**
 * The text to act on, in order of preference: fenced code, text after "label: ", text after a newline,
 * "double" or `backtick` or 'single' quoted text, group 1 of `around` ("encode X to base64"), or the
 * message with the command phrase `strip` removed.
 */
export function payloadOf(text: string, strip?: RegExp, around?: RegExp): string {
    const fenced = text.match(/```[\w-]*\n?([\s\S]*?)```/);
    if (fenced) return fenced[1].trim();
    // "label: payload" wins over quotes, so JSON or HTML after a colon keeps its own quotes.
    const colon = text.match(/^[^:\n]{1,60}:\s+([\s\S]+)$/);
    if (colon) return unquote(colon[1].trim());
    const nl = text.indexOf("\n");
    if (nl > 0) return text.slice(nl + 1).trim();
    const quoted = text.match(/["“`]([\s\S]+?)["”`]/) ?? text.match(/(?:^|\s)'([^']+)'(?=\s|$|[.,!?])/);
    if (quoted) return quoted[1];
    const wrapped = around && text.match(around);
    if (wrapped) return wrapped[1].trim();
    if (strip) return text.replace(strip, "").trim();
    return "";
}

/** Strip one pair of quotes wrapping the whole string ("hi" → hi), but not JSON like "a": "b". */
function unquote(s: string) {
    const q = s[0];
    const close = q === "“" ? "”" : q;
    if (!`"'\`“`.includes(q) || s.length < 2 || s.at(-1) !== close) return s;
    const inner = s.slice(1, -1);
    return inner.includes(close) ? s : inner;
}

/** Verbs that introduce the text in "<verb> X to <format>". */
export const VERB = String.raw`(?:(?:en|de)code|convert|turn|change|make|put|transform)`;

export const b64encode = (s: string) => {
    const bytes = new TextEncoder().encode(s);
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
};
export const b64decode = (s: string) => {
    const clean = s.replace(/^data:[^,]*,/, "").replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(clean + "=".repeat((4 - (clean.length % 4)) % 4));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

export function words(s: string) {
    return s
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean);
}
export const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
export const cases: Record<string, (w: string[]) => string> = {
    camel: (w) => w.map((x, i) => (i ? cap(x) : x.toLowerCase())).join(""),
    pascal: (w) => w.map(cap).join(""),
    snake: (w) => w.map((x) => x.toLowerCase()).join("_"),
    constant: (w) => w.map((x) => x.toUpperCase()).join("_"),
    kebab: (w) => w.map((x) => x.toLowerCase()).join("-"),
    title: (w) => w.map(cap).join(" "),
    upper: (w) => w.join(" ").toUpperCase(),
    lower: (w) => w.join(" ").toLowerCase(),
};

/** "1h 30m", "25 minutes", "90 sec" → ms */
export function parseDuration(s: string): number {
    let ms = 0;
    for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*(h|hrs?|hours?|m|mins?|minutes?|s|secs?|seconds?)\b/gi)) {
        const n = parseFloat(m[1]);
        const u = m[2][0].toLowerCase();
        ms += n * (u === "h" ? 3_600_000 : u === "m" ? 60_000 : 1000);
    }
    return Math.round(ms);
}

/** "at 3pm", "at 14:30", "at 9:15 am" → next epoch ms */
export function parseClock(s: string): number | null {
    const m = s.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (!m) return null;
    let h = Number(m[1]);
    const min = Number(m[2] ?? 0);
    const ap = m[3]?.toLowerCase();
    if (!m[2] && !ap) return null; // "at 5" is too vague
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    if (h > 23 || min > 59) return null;
    const d = new Date();
    d.setHours(h, min, 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    return d.getTime();
}

export function fmtMs(ms: number) {
    const s = Math.round(ms / 1000);
    const parts: [number, string][] = [[Math.floor(s / 3600), "h"], [Math.floor(s / 60) % 60, "m"], [s % 60, "s"]];
    return parts.filter(([n]) => n).map(([n, u]) => `${n}${u}`).join(" ") || "0s";
}

export const hhmm = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

