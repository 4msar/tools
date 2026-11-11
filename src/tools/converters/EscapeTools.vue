<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowDownUp, ClipboardPaste, Sparkles, Trash2 } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { readClipboard } from "@/composables/useClipboard";

type Kind = "html" | "json" | "unicode" | "hex" | "url" | "punycode";
type Dir = "escape" | "unescape";

const kind = ref<Kind>("html");
const dir = ref<Dir>("escape");
const input = ref("");

// options
const htmlNonAscii = ref(false);
const htmlHex = ref(false);
const htmlQuotes = ref(true);
const jsonAscii = ref(false);
const jsonQuote = ref<"double" | "single">("double");
const uniAll = ref(false);
const uniBraces = ref(true);
const hexAll = ref(false);
const urlFull = ref(true);
const urlAll = ref(false);
const urlPlus = ref(false);

const kinds: { value: Kind; label: string }[] = [
    { value: "html", label: "HTML entities" },
    { value: "json", label: "JSON / JS string" },
    { value: "unicode", label: "Unicode" },
    { value: "hex", label: "Hex \\xNN" },
    { value: "url", label: "URL" },
    { value: "punycode", label: "Punycode" },
];

const samples: Record<Kind, [string, string]> = {
    html: [`<a href="/search?q=cats&dogs">Café "naïve" & 'quoted' → ©</a>`, `&lt;a href=&quot;/search?q=cats&amp;dogs&quot;&gt;Caf&eacute; &quot;na&iuml;ve&quot; &amp; &#39;quoted&#39; &rarr; &copy;&lt;/a&gt;`],
    json: [`Line one\n\t"Quoted" \\ path\nEmoji: 😀 é`, `Line one\\n\\t\\"Quoted\\" \\\\ path\\nEmoji: \\u{1F600} \\xE9`],
    unicode: [`Héllo wörld 😀 日本語`, `H\\u00E9llo w\\u00F6rld \\u{1F600} \\u65E5\\u672C\\u8A9E`],
    hex: [`café ✓`, `caf\\xC3\\xA9 \\xE2\\x9C\\x93`],
    url: [`https://example.com/search?q=héllo wörld&tag=a/b`, `https%3A%2F%2Fexample.com%2Fsearch%3Fq%3Dh%C3%A9llo%20w%C3%B6rld%26tag%3Da%2Fb`],
    punycode: [`münchen.de\n日本語.jp\nbücher.example`, `xn--mnchen-3ya.de\nxn--wgv71a119e.jp\nxn--bcher-kva.example`],
};

// ---------- helpers ----------
const NAMED: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const NAMED_NON_ASCII: Record<number, string> = {
    160: "nbsp", 161: "iexcl", 162: "cent", 163: "pound", 164: "curren", 165: "yen", 166: "brvbar", 167: "sect", 168: "uml", 169: "copy",
    170: "ordf", 171: "laquo", 172: "not", 173: "shy", 174: "reg", 175: "macr", 176: "deg", 177: "plusmn", 178: "sup2", 179: "sup3",
    180: "acute", 181: "micro", 182: "para", 183: "middot", 184: "cedil", 185: "sup1", 186: "ordm", 187: "raquo", 188: "frac14",
    189: "frac12", 190: "frac34", 191: "iquest", 192: "Agrave", 193: "Aacute", 194: "Acirc", 195: "Atilde", 196: "Auml", 197: "Aring",
    198: "AElig", 199: "Ccedil", 200: "Egrave", 201: "Eacute", 202: "Ecirc", 203: "Euml", 204: "Igrave", 205: "Iacute", 206: "Icirc",
    207: "Iuml", 208: "ETH", 209: "Ntilde", 210: "Ograve", 211: "Oacute", 212: "Ocirc", 213: "Otilde", 214: "Ouml", 215: "times",
    216: "Oslash", 217: "Ugrave", 218: "Uacute", 219: "Ucirc", 220: "Uuml", 221: "Yacute", 222: "THORN", 223: "szlig", 224: "agrave",
    225: "aacute", 226: "acirc", 227: "atilde", 228: "auml", 229: "aring", 230: "aelig", 231: "ccedil", 232: "egrave", 233: "eacute",
    234: "ecirc", 235: "euml", 236: "igrave", 237: "iacute", 238: "icirc", 239: "iuml", 240: "eth", 241: "ntilde", 242: "ograve",
    243: "oacute", 244: "ocirc", 245: "otilde", 246: "ouml", 247: "divide", 248: "oslash", 249: "ugrave", 250: "uacute", 251: "ucirc",
    252: "uuml", 253: "yacute", 254: "thorn", 255: "yuml", 8211: "ndash", 8212: "mdash", 8216: "lsquo", 8217: "rsquo", 8220: "ldquo",
    8221: "rdquo", 8226: "bull", 8230: "hellip", 8364: "euro", 8482: "trade", 8592: "larr", 8594: "rarr", 8593: "uarr", 8595: "darr",
};

function htmlEscape(s: string): string {
    let out = "";
    for (const ch of s) {
        const cp = ch.codePointAt(0) ?? 0;
        if (ch === "&" || ch === "<" || ch === ">") out += NAMED[ch];
        else if (ch === '"' || ch === "'") out += htmlQuotes.value ? NAMED[ch] : ch;
        else if (cp > 126 && htmlNonAscii.value) {
            const name = NAMED_NON_ASCII[cp];
            out += htmlHex.value ? `&#x${cp.toString(16).toUpperCase()};` : name ? `&${name};` : `&#${cp};`;
        } else out += ch;
    }
    return out;
}

function htmlUnescape(s: string): string {
    const t = document.createElement("textarea");
    t.innerHTML = s;
    return t.value;
}

function hex(n: number, pad = 4) {
    return n.toString(16).toUpperCase().padStart(pad, "0");
}

function jsEscape(s: string): string {
    const q = jsonQuote.value === "double" ? '"' : "'";
    let out = "";
    for (const ch of s) {
        const cp = ch.codePointAt(0) ?? 0;
        if (ch === "\\") out += "\\\\";
        else if (ch === q) out += "\\" + q;
        else if (ch === "\n") out += "\\n";
        else if (ch === "\r") out += "\\r";
        else if (ch === "\t") out += "\\t";
        else if (ch === "\b") out += "\\b";
        else if (ch === "\f") out += "\\f";
        else if (cp < 0x20 || cp === 0x7f || cp === 0x2028 || cp === 0x2029) out += "\\u" + hex(cp);
        else if (cp > 126 && jsonAscii.value) {
            if (cp > 0xffff) out += `\\u${hex(0xd800 + ((cp - 0x10000) >> 10))}\\u${hex(0xdc00 + ((cp - 0x10000) & 0x3ff))}`;
            else out += "\\u" + hex(cp);
        } else out += ch;
    }
    return out;
}

function jsUnescape(s: string): string {
    return s.replace(/\\(?:u\{([0-9a-fA-F]{1,6})\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([0-7]{1,3})|([\s\S]))/g, (m, cpBrace, u4, x2, oct, other) => {
        if (cpBrace) {
            const n = parseInt(cpBrace, 16);
            return n > 0x10ffff ? m : String.fromCodePoint(n);
        }
        if (u4) return String.fromCharCode(parseInt(u4, 16));
        if (x2) return String.fromCharCode(parseInt(x2, 16));
        if (oct) return String.fromCharCode(parseInt(oct, 8));
        switch (other) {
            case "n": return "\n";
            case "r": return "\r";
            case "t": return "\t";
            case "b": return "\b";
            case "f": return "\f";
            case "v": return "\v";
            case "\n": return "";
            default: return other;
        }
    });
}

function unicodeEscape(s: string): string {
    let out = "";
    for (const ch of s) {
        const cp = ch.codePointAt(0) ?? 0;
        if (cp < 128 && !uniAll.value) out += ch;
        else if (cp > 0xffff) {
            out += uniBraces.value
                ? `\\u{${cp.toString(16).toUpperCase()}}`
                : `\\u${hex(0xd800 + ((cp - 0x10000) >> 10))}\\u${hex(0xdc00 + ((cp - 0x10000) & 0x3ff))}`;
        } else out += "\\u" + hex(cp);
    }
    return out;
}

function unicodeUnescape(s: string): string {
    return s.replace(/\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})|\\U([0-9a-fA-F]{8})|U\+([0-9a-fA-F]{4,6})/g, (m, a, b, c, d) => {
        const n = parseInt(a ?? b ?? c ?? d, 16);
        if (b) return String.fromCharCode(n);
        return n > 0x10ffff ? m : String.fromCodePoint(n);
    });
}

function hexEscape(s: string): string {
    let out = "";
    for (const ch of s) {
        if (ch.charCodeAt(0) < 128 && !hexAll.value) {
            out += ch;
            continue;
        }
        for (const b of new TextEncoder().encode(ch)) out += "\\x" + hex(b, 2);
    }
    return out;
}

function hexUnescape(s: string): string {
    return s.replace(/(?:\\x[0-9a-fA-F]{2})+/g, (run) => {
        const bytes = Uint8Array.from(run.match(/[0-9a-fA-F]{2}/g) ?? [], (h) => parseInt(h, 16));
        return new TextDecoder("utf-8").decode(bytes);
    });
}

function urlEscape(s: string): string {
    if (urlAll.value) return Array.from(new TextEncoder().encode(s), (b) => "%" + hex(b, 2)).join("");
    let out = urlFull.value ? encodeURIComponent(s) : encodeURI(s);
    // encodeURIComponent leaves !'()* alone; keep the standard output but make form style optional
    if (urlPlus.value) out = out.replace(/%20/g, "+");
    return out;
}

function urlUnescape(s: string): string {
    return decodeURIComponent(urlPlus.value ? s.replace(/\+/g, " ") : s);
}

// ---------- punycode (RFC 3492) ----------
const PB = 36, TMIN = 1, TMAX = 26, SKEW = 38, DAMP = 700;

function adapt(delta: number, numPoints: number, first: boolean) {
    delta = first ? Math.floor(delta / DAMP) : delta >> 1;
    delta += Math.floor(delta / numPoints);
    let k = 0;
    while (delta > (((PB - TMIN) * TMAX) >> 1)) {
        delta = Math.floor(delta / (PB - TMIN));
        k += PB;
    }
    return Math.floor(k + ((PB - TMIN + 1) * delta) / (delta + SKEW));
}

function digitOf(c: number) {
    if (c >= 0x30 && c <= 0x39) return c - 22;
    if (c >= 0x41 && c <= 0x5a) return c - 65;
    if (c >= 0x61 && c <= 0x7a) return c - 97;
    return PB;
}

function punyDecode(input: string): string {
    const out: number[] = [];
    let basic = input.lastIndexOf("-");
    if (basic < 0) basic = 0;
    for (let j = 0; j < basic; j++) {
        if (input.charCodeAt(j) >= 0x80) throw new Error("Invalid Punycode: non-basic code point before delimiter.");
        out.push(input.charCodeAt(j));
    }
    let n = 128, i = 0, bias = 72;
    for (let idx = basic > 0 ? basic + 1 : 0; idx < input.length; ) {
        const oldi = i;
        let w = 1;
        for (let k = PB; ; k += PB) {
            if (idx >= input.length) throw new Error("Invalid Punycode: unexpected end of input.");
            const digit = digitOf(input.charCodeAt(idx++));
            if (digit >= PB) throw new Error("Invalid Punycode: bad digit.");
            i += digit * w;
            const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
            if (digit < t) break;
            w *= PB - t;
        }
        const len = out.length + 1;
        bias = adapt(i - oldi, len, oldi === 0);
        n += Math.floor(i / len);
        i %= len;
        if (n > 0x10ffff) throw new Error("Invalid Punycode: code point out of range.");
        out.splice(i++, 0, n);
    }
    return String.fromCodePoint(...out);
}

function punyConvert(text: string, d: Dir): string {
    return text
        .split("\n")
        .map((line) => {
            const v = line.trim();
            if (!v) return "";
            if (d === "escape") {
                const host = new URL("http://" + v).hostname;
                return host;
            }
            return v
                .split(".")
                .map((label) => (/^xn--/i.test(label) ? punyDecode(label.slice(4)) : label))
                .join(".");
        })
        .join("\n");
}

const result = computed<{ out: string; error?: string }>(() => {
    const s = input.value;
    if (!s) return { out: "" };
    try {
        const esc = dir.value === "escape";
        switch (kind.value) {
            case "html": return { out: esc ? htmlEscape(s) : htmlUnescape(s) };
            case "json": return { out: esc ? jsEscape(s) : jsUnescape(s) };
            case "unicode": return { out: esc ? unicodeEscape(s) : unicodeUnescape(s) };
            case "hex": return { out: esc ? hexEscape(s) : hexUnescape(s) };
            case "url": return { out: esc ? urlEscape(s) : urlUnescape(s) };
            case "punycode": return { out: punyConvert(s, dir.value) };
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { out: "", error: kind.value === "punycode" && dir.value === "escape" ? "Not a valid domain name: " + msg : msg === "URI malformed" ? "Malformed percent-encoding in the input." : msg };
    }
    return { out: "" };
});

const labels = computed(() => {
    const esc = dir.value === "escape";
    if (kind.value === "punycode") return esc ? ["Unicode domain", "Punycode (ASCII)"] : ["Punycode (ASCII)", "Unicode domain"];
    return esc ? ["Plain text", "Escaped"] : ["Escaped", "Plain text"];
});

function swap() {
    if (result.value.error) return;
    input.value = result.value.out;
    dir.value = dir.value === "escape" ? "unescape" : "escape";
}

function loadSample() {
    const [plain, escaped] = samples[kind.value];
    input.value = dir.value === "escape" ? plain : escaped;
}

async function paste() {
    input.value = await readClipboard();
}
</script>

<template>
    <ToolPage>
        <template #actions>
            <Tabs v-model="dir" :options="[{ value: 'escape', label: 'Escape' }, { value: 'unescape', label: 'Unescape' }]" />
        </template>

        <div class="flex flex-wrap items-center gap-3">
            <Tabs v-model="kind" size="sm" :options="kinds" />
        </div>

        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <template v-if="kind === 'html' && dir === 'escape'">
                <label class="flex items-center gap-2"><input v-model="htmlQuotes" type="checkbox" class="checkbox" /> Escape quotes</label>
                <label class="flex items-center gap-2"><input v-model="htmlNonAscii" type="checkbox" class="checkbox" /> Escape non-ASCII</label>
                <label class="flex items-center gap-2"><input v-model="htmlHex" type="checkbox" class="checkbox" :disabled="!htmlNonAscii" /> Numeric hex (&amp;#x…;)</label>
            </template>
            <template v-else-if="kind === 'json' && dir === 'escape'">
                <label class="flex items-center gap-2"><input v-model="jsonAscii" type="checkbox" class="checkbox" /> ASCII only</label>
                <span class="flex items-center gap-2">Quote
                    <Tabs v-model="jsonQuote" size="sm" :options="[{ value: 'double', label: 'Double' }, { value: 'single', label: 'Single' }]" />
                </span>
            </template>
            <template v-else-if="kind === 'unicode' && dir === 'escape'">
                <label class="flex items-center gap-2"><input v-model="uniAll" type="checkbox" class="checkbox" /> Escape every character</label>
                <label class="flex items-center gap-2"><input v-model="uniBraces" type="checkbox" class="checkbox" /> Use \u{…} for astral</label>
            </template>
            <template v-else-if="kind === 'hex' && dir === 'escape'">
                <label class="flex items-center gap-2"><input v-model="hexAll" type="checkbox" class="checkbox" /> Escape every character</label>
                <span class="text-xs text-muted">Non-ASCII characters are written as UTF-8 bytes.</span>
            </template>
            <template v-else-if="kind === 'url'">
                <template v-if="dir === 'escape'">
                    <label class="flex items-center gap-2"><input v-model="urlFull" type="checkbox" class="checkbox" :disabled="urlAll" /> Component mode (encode / ? &amp; = #)</label>
                    <label class="flex items-center gap-2"><input v-model="urlAll" type="checkbox" class="checkbox" /> Encode every byte</label>
                </template>
                <label class="flex items-center gap-2"><input v-model="urlPlus" type="checkbox" class="checkbox" /> Space as +</label>
            </template>
            <template v-else-if="kind === 'punycode'">
                <span class="text-xs text-muted">One domain per line. Encoding uses the browser's IDN (UTS #46) rules; decoding is RFC 3492.</span>
            </template>
            <Btn class="ml-auto" size="sm" variant="secondary" @click="loadSample"><Sparkles /> Sample</Btn>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel :title="labels[0]" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="paste"><ClipboardPaste /> Paste</Btn>
                    <Btn size="sm" variant="ghost" :disabled="!input" @click="input = ''"><Trash2 /> Clear</Btn>
                </template>
                <CodeArea v-model="input" :wrap="kind !== 'punycode'" height="16rem" placeholder="Type or paste here…" />
                <div class="border-t border-line px-4 py-2 text-xs text-muted">{{ input.length }} chars</div>
            </Panel>
            <Panel :title="labels[1]" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" :disabled="!result.out" title="Use output as input" @click="swap"><ArrowDownUp /> Swap</Btn>
                    <CopyButton :text="result.out" />
                </template>
                <div v-if="result.error" class="p-4"><Notice type="error">{{ result.error }}</Notice></div>
                <CodeArea v-else :model-value="result.out" readonly height="16rem" placeholder="Output appears here" />
                <div class="border-t border-line px-4 py-2 text-xs text-muted">{{ result.out.length }} chars</div>
            </Panel>
        </div>
    </ToolPage>
</template>
