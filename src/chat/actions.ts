import { rankTools } from "./retrieval";
import { VERB, b64decode, b64encode, cases, fmtMs, hhmm, parseClock, parseDuration, payloadOf, words } from "./parse";
import { earlyActions, lateActions } from "./actions-more";

/**
 * Commands the chat assistant can run directly, e.g. "base64 encode hello" or "start a pomodoro".
 * Parsing is rule-based so it works without the on-device model. Each action returns a result for the
 * chat and, optionally, a payload that pre-fills the tool page it opens.
 */
export interface ActionResult {
    toolId: string;
    /** One-line summary shown in the chat. */
    summary: string;
    /** Copyable output, if the action produced one. */
    output?: string;
    error?: boolean;
    /** Input for the tool page (see composables/handoff.ts). */
    handoff?: Record<string, unknown>;
    /** The user asked to open the tool ("open the JSON formatter"), so open it whatever the setting. */
    open?: boolean;
}

export type Action = (text: string, lower: string) => ActionResult | null | Promise<ActionResult | null>;

// ---------- actions (first match wins; order matters) ----------

const actions: Action[] = [
    // Commands that must win over the general ones below (e.g. bcrypt before hash).
    ...earlyActions,

    // Pomodoro
    async (_t, l) => {
        if (!/\bpomodoro\b|\bfocus (session|timer)\b/.test(l)) return null;
        const p = await import("@/tools/productivity/pomodoro");
        if (/\b(pause|hold)\b/.test(l)) {
            p.pause();
            return { toolId: "pomodoro-timer", summary: "Paused the Pomodoro timer." };
        }
        if (/\b(stop|reset|cancel|end)\b/.test(l)) {
            p.setPhase(p.st.phase);
            return { toolId: "pomodoro-timer", summary: "Stopped and reset the Pomodoro timer." };
        }
        const mins = parseDuration(l);
        if (mins >= 60_000) p.settings.value.focus = Math.round(mins / 60_000);
        if (!p.st.running) {
            if (p.st.phase !== "focus" && !/\bbreak\b/.test(l)) p.setPhase("focus");
            p.start();
        }
        return { toolId: "pomodoro-timer", summary: `Started a ${p.settings.value.focus}-minute focus session. I'll alert you when it's time for a break.` };
    },

    // Break reminders
    async (_t, l) => {
        if (!/\bbreak reminders?\b|\b20-20-20\b/.test(l)) return null;
        const b = await import("@/tools/productivity/breaks");
        const on = !/\b(stop|off|disable|pause)\b/.test(l);
        b.setBreaksRunning(on);
        const names = b.habits.value.filter((h) => h.enabled).map((h) => `${h.name.toLowerCase()} every ${h.every} min`);
        return { toolId: "break-reminder", summary: on ? `Break reminders are on: ${names.join(", ")}.` : "Break reminders are off." };
    },

    // Timers, alarms and reminders
    async (text, l) => {
        if (!/\b(timer|alarm|remind me|reminder|countdown|wake me)\b/.test(l)) return null;
        const r = await import("@/tools/productivity/reminders");
        const at = parseClock(l);
        const dur = parseDuration(l.replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?/i, ""));
        const label = (text.match(/\b(?:to|for|about)\s+(?!\d)(.+?)(?:\s+(?:in|at|after)\s+\d.*)?$/i)?.[1] ?? "").trim().replace(/[.!]$/, "");
        const sound = "bell" as const;
        if (at) {
            r.reminders.value.push({ id: crypto.randomUUID(), kind: "alarm", label, at, daily: /\b(every ?day|daily)\b/.test(l), sound, active: true });
            return { toolId: "reminders", summary: `Alarm set for ${hhmm(at)}${label ? `: ${label}` : ""}.` };
        }
        if (dur > 0) {
            r.reminders.value.push({ id: crypto.randomUUID(), kind: "timer", label, at: Date.now() + dur, duration: dur, sound, active: true });
            return { toolId: "reminders", summary: `${fmtMs(dur)} timer started${label ? ` for "${label}"` : ""}. It ends at ${hhmm(Date.now() + dur)}.` };
        }
        return { toolId: "reminders", summary: 'Tell me when, e.g. "set a timer for 10 minutes" or "remind me at 3pm to call Sam".', error: true };
    },

    // To-do
    async (text) => {
        const m = text.match(/^(?:please\s+)?(?:add|create|new|put)\s+(?:an?\s+)?(?:todo|to-do|task)s?\s*(?:item)?\s*[:-]?\s*(?:to\s+)?(.+)$/i)
            ?? text.match(/^(?:please\s+)?add\s+(.+?)\s+to\s+(?:my\s+)?(?:todo|to-do|task)s?(?:\s+list)?$/i)
            ?? text.match(/^todo\s*:\s*(.+)$/i);
        if (!m) return null;
        let item = m[1].trim();
        const priority = /\b(urgent|high priority|important)\b/i.test(item) ? "high" : /\blow priority\b/i.test(item) ? "low" : "medium";
        const day = /\btomorrow\b/i.test(item) ? 1 : /\btoday\b/i.test(item) ? 0 : null;
        item = item.replace(/[,(]?\s*\b(urgent|high priority|low priority|important|due today|due tomorrow|today|tomorrow)\b\)?/gi, "").replace(/^["']|["']$/g, "").trim();
        if (!item) return null;
        const due = day == null ? undefined : new Date(Date.now() + day * 86_400_000).toLocaleDateString("en-CA");
        const t = await import("@/tools/productivity/todos");
        t.addTodo(item, priority, due);
        return { toolId: "todo-list", summary: `Added "${item}" to your to-do list${priority === "high" ? " as high priority" : ""}${due ? `, due ${day ? "tomorrow" : "today"}` : ""}.` };
    },

    // Base64
    (text, l) => {
        if (!/\bbase[\s-]?64\b|\bb64\b/.test(l)) return null;
        const decode = /\bdecode|from base[\s-]?64\b/.test(l);
        const input = payloadOf(
            text,
            /^.*?\b(?:base[\s-]?64|b64)\b\s*(?:(?:en|de)code)?\s*(?:this|the text|text|string)?\s*:?\s*/i,
            new RegExp(String.raw`${VERB}\s+(.+?)\s+(?:to|from|in|into|as|with|using)\s+(?:base[\s-]?64|b64)\b`, "i"),
        );
        if (!input) return { toolId: "base64-encoder", summary: `Opened Base64 in ${decode ? "decode" : "encode"} mode.`, handoff: { mode: decode ? "decode" : "encode" } };
        try {
            const output = decode ? b64decode(input) : b64encode(input);
            return { toolId: "base64-encoder", summary: decode ? "Decoded from Base64:" : "Encoded to Base64:", output, handoff: { mode: decode ? "decode" : "encode", input } };
        } catch {
            return { toolId: "base64-encoder", summary: "That isn't valid Base64.", error: true, handoff: { mode: "decode", input } };
        }
    },

    // URL encode / decode
    (text, l) => {
        if (!/\b(url|uri|percent)[\s-]?(en|de)cod|\b(en|de)code\b.*\b(url|uri)\b/.test(l)) return null;
        const decode = /\bdecod/.test(l);
        const input = payloadOf(
            text,
            /^.*?\b(?:url|uri|percent)[\s-]?(?:en|de)code\s*:?\s*|^.*?\b(?:en|de)code\s+(?:this\s+|the\s+)?(?:url|uri)\s*:?\s*/i,
            /(?:en|de)code\s+(.+?)\s+(?:for|as|in)\s+(?:a\s+)?(?:url|uri)\b/i,
        );
        if (!input) return { toolId: "url-encoder", summary: "Opened the URL encoder.", handoff: { tab: decode ? "decode" : "encode" } };
        try {
            const output = decode ? decodeURIComponent(input.replace(/\+/g, " ")) : encodeURIComponent(input);
            return { toolId: "url-encoder", summary: decode ? "URL-decoded:" : "URL-encoded:", output, handoff: { tab: decode ? "decode" : "encode", input } };
        } catch {
            return { toolId: "url-encoder", summary: "That text has an invalid percent-encoding.", error: true };
        }
    },

    // Hashes
    async (text, l) => {
        const m = l.match(/\b(md5|sha-?1|sha-?256|sha-?384|sha-?512)\b/) ?? (/\bhash\b/.test(l) ? ["sha256", "sha256"] : null);
        if (!m) return null;
        const input = payloadOf(
            text,
            /^.*?\b(?:md5|sha-?\d+|hash)\b\s*(?:hash)?\s*(?:of|for)?\s*(?:this|the text|text|string)?\s*:?\s*/i,
            /hash\s+(.+?)\s+(?:with|using|in|as|to)\s+(?:md5|sha-?\d+)\b/i,
        );
        const algo = m[1].replace("-", "");
        const name = algo === "md5" ? "MD5" : `SHA-${algo.slice(3)}`;
        if (!input) return { toolId: "hash-generator", summary: "Opened the hash generator." };
        const { md5, sha1 } = await import("@noble/hashes/legacy.js");
        const { sha256, sha384, sha512 } = await import("@noble/hashes/sha2.js");
        const fn = { md5, sha1, sha256, sha384, sha512 }[algo as "md5"];
        const output = Array.from(fn(new TextEncoder().encode(input)), (b) => b.toString(16).padStart(2, "0")).join("");
        return { toolId: "hash-generator", summary: `${name} of "${input.length > 40 ? input.slice(0, 40) + "…" : input}":`, output, handoff: { text: input } };
    },

    // UUIDs
    async (_t, l) => {
        if (!/\b(uuid|guid|ulid)s?\b/.test(l)) return null;
        const count = Math.min(50, Number(l.match(/\b(\d{1,3})\b/)?.[1] ?? 1)) || 1;
        const version = /\bulid\b/.test(l) ? "ulid" : /\bv?7\b/.test(l) ? "v7" : "v4";
        const ids: string[] = [];
        if (version === "ulid") {
            const { ulid } = await import("ulid");
            for (let i = 0; i < count; i++) ids.push(ulid());
        } else {
            const { v4, v7 } = await import("uuid");
            for (let i = 0; i < count; i++) ids.push(version === "v7" ? v7() : v4());
        }
        return { toolId: "uuid-generator", summary: `Generated ${count} ${version === "ulid" ? "ULID" : `UUID ${version}`}${count > 1 ? "s" : ""}:`, output: ids.join("\n"), handoff: { version, count } };
    },

    // Passwords
    (_t, l) => {
        if (!/\b(password|passphrase)\b/.test(l) || !/\b(generate|create|make|new|give|random|strong)\b/.test(l)) return null;
        const len = Math.min(128, Math.max(8, Number(l.match(/\b(\d{1,3})\b/)?.[1] ?? 20)));
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+";
        const rnd = crypto.getRandomValues(new Uint32Array(len));
        const output = Array.from(rnd, (n) => chars[n % chars.length]).join("");
        return { toolId: "password-generator", summary: `Here's a ${len}-character password, generated in your browser:`, output };
    },

    // Case conversion
    (text, l) => {
        const m = l.match(/\b(camel|pascal|snake|constant|kebab|title|upper|lower)\s*[-_ ]?case\b/);
        if (!m) return null;
        const input = payloadOf(
            text,
            /^.*?\b(?:camel|pascal|snake|constant|kebab|title|upper|lower)\s*[-_ ]?case\b\s*(?:of|for)?\s*:?\s*/i,
            new RegExp(String.raw`${VERB}\s+(.+?)\s+(?:to|in|into|as)\s+\w+\s*[-_ ]?case\b`, "i"),
        );
        if (!input) return { toolId: "case-converter", summary: "Opened the case converter." };
        const output = input.split(/\r?\n/).map((line) => cases[m[1]](words(line))).join("\n");
        return { toolId: "case-converter", summary: `In ${m[1]} case:`, output, handoff: { input } };
    },

    // JSON format / minify
    (text, l) => {
        const raw = text.match(/[[{][\s\S]*[\]}]/)?.[0] ?? payloadOf(text);
        const wantsJson = /\bjson\b/.test(l) && /\b(format|prettify|pretty|beautify|minify|validate|indent)\b/.test(l);
        let parsed: unknown;
        try {
            parsed = raw ? JSON.parse(raw) : undefined;
        } catch {
            if (wantsJson) return { toolId: "json-formatter", summary: "That JSON doesn't parse. I opened it in the formatter so you can see the error.", error: true, handoff: { input: raw } };
            return null;
        }
        if (!wantsJson && !(parsed && typeof parsed === "object" && raw.length > 2 && raw === text.trim())) return null;
        if (!raw) return { toolId: "json-formatter", summary: "Opened the JSON formatter." };
        const minify = /\bminify\b/.test(l);
        return { toolId: "json-formatter", summary: minify ? "Minified JSON:" : "Formatted JSON:", output: JSON.stringify(parsed, null, minify ? 0 : 2), handoff: { input: raw } };
    },

    // Number bases: "255 to hex", "0xff in binary"
    (_t, l) => {
        const m = l.match(/\b(0x[0-9a-f]+|0b[01]+|0o[0-7]+|\d+)\s+(?:to|in|into|as)\s+(hex(?:adecimal)?|bin(?:ary)?|oct(?:al)?|dec(?:imal)?)\b/);
        if (!m) return null;
        const n = BigInt(m[1]);
        const base = m[2].startsWith("hex") ? 16 : m[2].startsWith("bin") ? 2 : m[2].startsWith("oct") ? 8 : 10;
        const prefix = base === 16 ? "0x" : base === 2 ? "0b" : base === 8 ? "0o" : "";
        return { toolId: "number-base", summary: `${m[1]} in ${m[2]}:`, output: prefix + n.toString(base).toUpperCase(), handoff: { value: n.toString() } };
    },

    // Timestamps
    (text, l) => {
        const num = l.match(/\b(\d{10}|\d{13})\b/);
        if (!/\b(timestamp|epoch|unix)\b/.test(l) && !(num && /\b(date|time|convert|when)\b/.test(l))) return null;
        if (num) {
            const ms = num[1].length === 10 ? Number(num[1]) * 1000 : Number(num[1]);
            return { toolId: "timestamp-converter", summary: `${num[1]} is:`, output: `${new Date(ms).toISOString()}\n${new Date(ms).toString()}`, handoff: { input: num[1] } };
        }
        const date = payloadOf(text);
        const parsed = date ? Date.parse(date) : NaN;
        const ms = Number.isNaN(parsed) ? Date.now() : parsed;
        return { toolId: "timestamp-converter", summary: Number.isNaN(parsed) ? "The current Unix timestamp:" : `Unix timestamp for ${date}:`, output: String(Math.floor(ms / 1000)), handoff: { input: Number.isNaN(parsed) ? "now" : date } };
    },

    // Word / character count
    (text, l) => {
        if (!/\b(count|how many)\b/.test(l) || !/\b(words?|characters?|chars|letters|lines|bytes)\b/.test(l)) return null;
        const input = payloadOf(text, /^.*?\b(?:words?|characters?|chars|letters|lines|bytes)\b\s*(?:are\s+)?(?:in|of)?\s*(?:this|the text|text)?\s*:?\s*/i);
        if (!input) return { toolId: "string-inspector", summary: "Opened the String Inspector. Paste your text there." };
        const wordsN = input.trim() ? input.trim().split(/\s+/).length : 0;
        const output = `${wordsN} words · ${[...input].length} characters · ${input.split(/\r?\n/).length} lines · ${new TextEncoder().encode(input).length} bytes`;
        return { toolId: "string-inspector", summary: "Counts:", output, handoff: { text: input } };
    },

    // Commands for the rest of the tools, then the generic fallbacks.
    ...lateActions,

    // "open X" / "go to X" / "launch X"
    (text) => {
        const m = text.match(/^(?:please\s+)?(?:open|go to|show me|launch|start|run|use)\s+(?:the\s+)?(.+?)(?:\s+tool)?[.!]?$/i);
        if (!m) return null;
        const tool = rankTools(m[1], 1)[0];
        return tool ? { toolId: tool.id, summary: `Opened ${tool.name}.`, open: true } : null;
    },
];

export async function runAction(text: string): Promise<ActionResult | null> {
    const lower = text.toLowerCase();
    for (const action of actions) {
        try {
            const result = await action(text, lower);
            if (result) return result;
        } catch {
            /* a broken parser should never break the chat; try the next one */
        }
    }
    return null;
}

/** Examples shown in the empty chat. */
export const actionExamples = [
    "Start a pomodoro",
    "Base64 encode: hello world",
    "Set a timer for 10 minutes",
    "Add todo review PR tomorrow",
    "SHA-256 of password123",
    "255 to hex",
];
