<script setup lang="ts">
import { computed, ref } from "vue";
import { useStorage } from "@vueuse/core";
import { Download, Play, RefreshCw } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Field, Notice, Panel, ToolPage } from "@/components/ui";

type TokType = "ws" | "cm" | "str" | "tpl" | "re" | "word" | "p";
interface Tok { t: TokType; v: string }

const REGEX_KW = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"]);
const OP = /(?:>>>=|\.\.\.|===|!==|\*\*=|<<=|>>=|>>>|&&=|\|\|=|\?\?=|=>|==|!=|<=|>=|&&|\|\||\?\?|\?\.(?!\d)|\+\+|--|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<|>>|\*\*|[\s\S])/y;
const isId = (c: string | undefined) => !!c && /[\w$\u0080-￿]/.test(c);
const isNl = (c: string | undefined) => c === "\n" || c === "\r" || c === "\u2028" || c === "\u2029";

function tokenize(src: string): Tok[] {
    const out: Tok[] = [];
    const n = src.length;
    let i = 0;
    let last: Tok | null = null;

    const skipString = (s: number) => {
        const q = src[s];
        let j = s + 1;
        while (j < n && src[j] !== q) {
            if (src[j] === "\\") j += 2;
            else if (isNl(src[j])) return j;
            else j++;
        }
        return Math.min(j + 1, n);
    };
    const skipBraces = (s: number): number => {
        let depth = 1;
        let j = s;
        while (j < n) {
            const ch = src[j];
            if (ch === "'" || ch === '"') {
                j = skipString(j);
                continue;
            }
            if (ch === "`") {
                j = scanTemplate(j);
                continue;
            }
            if (ch === "/" && src[j + 1] === "/") {
                while (j < n && !isNl(src[j])) j++;
                continue;
            }
            if (ch === "/" && src[j + 1] === "*") {
                const e = src.indexOf("*/", j + 2);
                j = e < 0 ? n : e + 2;
                continue;
            }
            if (ch === "{") depth++;
            else if (ch === "}" && --depth === 0) return j + 1;
            j++;
        }
        return n;
    };
    function scanTemplate(s: number): number {
        let j = s + 1;
        while (j < n) {
            const ch = src[j];
            if (ch === "\\") j += 2;
            else if (ch === "`") return j + 1;
            else if (ch === "$" && src[j + 1] === "{") j = skipBraces(j + 2);
            else j++;
        }
        return n;
    }
    const regexAllowed = () => {
        if (!last) return true;
        if (last.t === "p") return ![")", "]", "}", "++", "--"].includes(last.v);
        if (last.t === "word") return REGEX_KW.has(last.v);
        return false;
    };
    const push = (t: TokType, v: string) => {
        const tok = { t, v };
        out.push(tok);
        if (t !== "ws" && t !== "cm") last = tok;
    };

    while (i < n) {
        const c = src[i] as string;
        if (/\s/.test(c)) {
            let j = i + 1;
            while (j < n && /\s/.test(src[j] as string)) j++;
            push("ws", src.slice(i, j));
            i = j;
        } else if (c === "/" && src[i + 1] === "/") {
            let j = i;
            while (j < n && !isNl(src[j])) j++;
            push("cm", src.slice(i, j));
            i = j;
        } else if (c === "/" && src[i + 1] === "*") {
            const e = src.indexOf("*/", i + 2);
            const j = e < 0 ? n : e + 2;
            push("cm", src.slice(i, j));
            i = j;
        } else if (c === "'" || c === '"') {
            const j = skipString(i);
            push("str", src.slice(i, j));
            i = j;
        } else if (c === "`") {
            const j = scanTemplate(i);
            push("tpl", src.slice(i, j));
            i = j;
        } else if (c === "/" && regexAllowed()) {
            let j = i + 1;
            let cls = false;
            let ok = false;
            while (j < n) {
                const ch = src[j];
                if (ch === "\\") {
                    j += 2;
                    continue;
                }
                if (isNl(ch)) break;
                if (ch === "[") cls = true;
                else if (ch === "]") cls = false;
                else if (ch === "/" && !cls) {
                    ok = true;
                    break;
                }
                j++;
            }
            if (ok) {
                j++;
                while (j < n && /[a-z]/i.test(src[j] as string)) j++;
                push("re", src.slice(i, j));
                i = j;
            } else {
                push("p", c);
                i++;
            }
        } else if (isId(c)) {
            let j = i + 1;
            while (j < n && isId(src[j])) j++;
            push("word", src.slice(i, j));
            i = j;
        } else {
            OP.lastIndex = i;
            const m = OP.exec(src);
            const v = m ? m[0] : c;
            push("p", v);
            i += v.length;
        }
    }
    return out;
}

const NO_END_PREV = new Set(["{", "(", "[", ",", ";", ":", "=", "+", "-", "*", "/", "%", "&", "|", "^", "<", ">", "?", "!", "~", ".", "=>", "==", "===", "!=", "!==", "&&", "||", "??", "+=", "-=", "*=", "/=", "<=", ">=", "<<", ">>", ">>>", "**"]);
const CONT_NEXT = new Set([")", "]", "}", ",", ";", ".", "?", ":", "=", "*", "/", "%", "&", "|", "^", "<", ">", "(", "[", "+", "-", "=>", "==", "===", "!=", "!==", "&&", "||", "??", "?.", "<=", ">=", "+=", "-=", "*=", "/=", "**"]);

function minify(toks: Tok[]): string {
    let out = "";
    let prev: Tok | null = null;
    let sawSpace = false;
    let sawNl = false;
    for (const tok of toks) {
        if (tok.t === "ws") {
            sawSpace = true;
            if (/[\n\r\u2028\u2029]/.test(tok.v)) sawNl = true;
            continue;
        }
        if (tok.t === "cm") {
            sawSpace = true;
            if (tok.v.startsWith("//") || tok.v.includes("\n")) sawNl = true;
            continue;
        }
        if (prev && sawSpace) {
            let sep = "";
            if (sawNl) {
                const dropOk = (prev.t === "p" && NO_END_PREV.has(prev.v)) || (tok.t === "p" && CONT_NEXT.has(tok.v));
                if (!dropOk) sep = "\n";
            }
            if (!sep) {
                const a = prev.v[prev.v.length - 1];
                const b = tok.v[0];
                if ((isId(a) && isId(b)) || (a === "+" && b === "+") || (a === "-" && b === "-") || (a === "/" && b === "/")) sep = " ";
            }
            out += sep;
        }
        out += tok.v;
        prev = tok;
        sawSpace = false;
        sawNl = false;
    }
    return out;
}

function strValue(lit: string): string | null {
    try {
        const v = new Function(`return ${lit}`)();
        return typeof v === "string" ? v : null;
    } catch {
        return null;
    }
}
const escAll = (s: string) => {
    let r = "";
    for (let k = 0; k < s.length; k++) {
        const c = s.charCodeAt(k);
        r += c < 256 ? `\\x${c.toString(16).padStart(2, "0")}` : `\\u${c.toString(16).padStart(4, "0")}`;
    }
    return `"${r}"`;
};
const DIRECTIVES = new Set(["use strict", "use asm"]);
const hexName = () => `_0x${Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0")}`;

function b64(s: string) {
    const bytes = new TextEncoder().encode(s);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return { b64: btoa(bin), ascii: bytes.length === s.length };
}

type StrMode = "none" | "hex" | "array";
interface Opts { minify: boolean; strings: StrMode; iife: boolean; pack: boolean }

function obfuscate(src: string, o: Opts): string {
    const toks = tokenize(src);
    let prelude = "";
    if (o.strings !== "none") {
        const sigIdx: number[] = [];
        toks.forEach((t, k) => {
            if (t.t !== "ws" && t.t !== "cm") sigIdx.push(k);
        });
        if (o.strings === "hex") {
            for (const k of sigIdx) {
                const t = toks[k] as Tok;
                if (t.t !== "str") continue;
                const v = strValue(t.v);
                if (v !== null && !DIRECTIVES.has(v)) t.v = escAll(v);
            }
        } else {
            const pool: string[] = [];
            const index = new Map<string, number>();
            const dec = hexName();
            const arr = hexName();
            const edits: [Tok, string][] = [];
            sigIdx.forEach((k, p) => {
                const t = toks[k] as Tok;
                if (t.t !== "str") return;
                const prev = p > 0 ? (toks[sigIdx[p - 1] as number] as Tok) : null;
                const next = p < sigIdx.length - 1 ? (toks[sigIdx[p + 1] as number] as Tok) : null;
                if (prev && prev.t === "word" && ["from", "import", "export", "as"].includes(prev.v)) return;
                const keyPos = !prev || (prev.t === "p" && ["{", ",", ";", "}"].includes(prev.v));
                if (keyPos && next && next.t === "p" && (next.v === ":" || next.v === "(")) return;
                const v = strValue(t.v);
                if (v === null || DIRECTIVES.has(v)) return;
                let idx = index.get(v);
                if (idx === undefined) {
                    idx = pool.length;
                    pool.push(v);
                    index.set(v, idx);
                }
                edits.push([t, `${dec}(0x${idx.toString(16)})`]);
            });
            if (pool.length) {
                const n = pool.length;
                const rot = 1 + Math.floor(Math.random() * n);
                const stored: string[] = new Array(n);
                pool.forEach((s, i) => (stored[(i + rot) % n] = s));
                for (const [t, v] of edits) t.v = v;
                prelude = `var ${arr}=[${stored.map(escAll).join(",")}];(function(a,k){while(k--)a.push(a.shift())})(${arr},${rot});function ${dec}(i){return ${arr}[i]}`;
            }
        }
    }
    let code = o.minify ? minify(toks) : toks.map((t) => t.v).join("");
    const nl = o.minify ? "" : "\n";
    if (prelude) code = prelude + nl + code;
    if (o.iife) code = `(function(){${nl}${code}${nl}})();`;
    if (o.pack) {
        const { b64: enc, ascii } = b64(code);
        code = ascii ? `new Function(atob("${enc}"))();` : `new Function(new TextDecoder().decode(Uint8Array.from(atob("${enc}"),function(c){return c.charCodeAt(0)})))();`;
    }
    return code;
}

const sample = `// Greeting demo
const names = ['Ada', "Grace", 'Linus'];
function greet(name) {
    /* build message */
    return \`Hello, \${name}! Length: \${name.length}\`;
}
for (const n of names) {
    console.log(greet(n));
}
console.log('sum =', [1, 2, 3].reduce((a, b) => a + b, 0), /ab+c/i.test('xABBCx'));
`;

const input = useStorage("tools:js-obfuscator:input", sample);
const optMinify = useStorage("tools:js-obfuscator:minify", true);
const optStrings = useStorage<StrMode>("tools:js-obfuscator:strings", "array");
const optIife = useStorage("tools:js-obfuscator:iife", true);
const optPack = useStorage("tools:js-obfuscator:pack", false);
const seed = ref(0);

const result = computed(() => {
    void seed.value;
    try {
        return { code: obfuscate(input.value, { minify: optMinify.value, strings: optStrings.value, iife: optIife.value, pack: optPack.value }), error: "" };
    } catch (e) {
        return { code: "", error: e instanceof Error ? e.message : String(e) };
    }
});
const output = computed(() => result.value.code);

const syntaxWarning = computed(() => {
    try {
        new Function(input.value);
        return "";
    } catch (e) {
        return e instanceof Error ? e.message : String(e);
    }
});

const bytes = (s: string) => new Blob([s]).size;
const inSize = computed(() => bytes(input.value));
const outSize = computed(() => bytes(output.value));
const ratio = computed(() => (inSize.value ? Math.round((outSize.value / inSize.value) * 100) : 0));

function download() {
    const url = URL.createObjectURL(new Blob([output.value], { type: "text/javascript" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "obfuscated.js";
    a.click();
    URL.revokeObjectURL(url);
}

// Run both in sandboxed iframes
const closeScript = "<" + "/script>";
function runInSandbox(code: string): Promise<{ logs: string[]; timedOut: boolean }> {
    return new Promise((resolve) => {
        const id = Math.random().toString(36).slice(2);
        const prelude = `var __id=${JSON.stringify(id)},__logs=[];function __f(a){try{return typeof a==="string"?a:JSON.stringify(a)===undefined?String(a):JSON.stringify(a)}catch(e){return String(a)}}["log","info","warn","error","debug"].forEach(function(m){console[m]=function(){__logs.push(Array.prototype.map.call(arguments,__f).join(" "))}});window.onerror=function(m){__logs.push("Uncaught: "+m)};window.addEventListener("unhandledrejection",function(e){__logs.push("Unhandled rejection: "+e.reason)});`;
        const post = `setTimeout(function(){parent.postMessage({__id:__id,logs:__logs},"*")},700);`;
        const safe = code.replace(/<\/script/gi, "<\\/script");
        const frame = document.createElement("iframe");
        frame.setAttribute("sandbox", "allow-scripts");
        frame.style.display = "none";
        let done = false;
        const finish = (logs: string[], timedOut: boolean) => {
            if (done) return;
            done = true;
            window.removeEventListener("message", onMsg);
            frame.remove();
            resolve({ logs, timedOut });
        };
        const onMsg = (e: MessageEvent) => {
            if (e.source === frame.contentWindow && e.data && e.data.__id === id) finish(e.data.logs as string[], false);
        };
        window.addEventListener("message", onMsg);
        frame.srcdoc = `<!doctype html><html><body><script>${prelude}${closeScript}<script>${safe}${closeScript}<script>${post}${closeScript}</body></html>`;
        document.body.appendChild(frame);
        setTimeout(() => finish([], true), 4000);
    });
}

const running = ref(false);
const run = ref<{ a: string[]; b: string[]; match: boolean; timedOut: boolean } | null>(null);
async function runBoth() {
    running.value = true;
    try {
        const [a, b] = await Promise.all([runInSandbox(input.value), runInSandbox(output.value)]);
        run.value = { a: a.logs, b: b.logs, match: !a.timedOut && !b.timedOut && a.logs.join("\n") === b.logs.join("\n"), timedOut: a.timedOut || b.timedOut };
    } finally {
        running.value = false;
    }
}
</script>

<template>
    <ToolPage>
        <Notice type="warning">Obfuscation is not security. Anyone can still read, deobfuscate or run this code. Never put secrets, keys or licensing logic in client-side JavaScript.</Notice>

        <Panel title="Options">
            <div class="flex flex-wrap items-end gap-x-6 gap-y-3 text-sm">
                <label class="flex cursor-pointer items-center gap-2"><input v-model="optMinify" type="checkbox" class="checkbox" /> Minify whitespace and comments</label>
                <label class="flex cursor-pointer items-center gap-2"><input v-model="optIife" type="checkbox" class="checkbox" /> Wrap in IIFE</label>
                <label class="flex cursor-pointer items-center gap-2"><input v-model="optPack" type="checkbox" class="checkbox" /> Eval-pack (base64 + <code class="code">new Function</code>)</label>
                <Field label="Encode strings">
                    <select v-model="optStrings" class="select min-w-56">
                        <option value="none">Off</option>
                        <option value="hex">Hex escapes (\x41)</option>
                        <option value="array">Rotated string array + decoder</option>
                    </select>
                </Field>
                <Btn @click="seed++"><RefreshCw /> Re-roll</Btn>
            </div>
            <p class="mt-3 text-xs text-muted">Template literals are left untouched. Strings used as property keys, import/export specifiers and directives are never moved into the array. Wrapping in an IIFE or eval-packing breaks ES module syntax (import/export).</p>
        </Panel>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="Input" flush>
                <template #actions>
                    <span class="text-xs text-muted">{{ inSize.toLocaleString() }} bytes</span>
                    <Btn size="sm" variant="ghost" @click="input = ''">Clear</Btn>
                </template>
                <CodeArea language="javascript" v-model="input" placeholder="Paste JavaScript here…" height="20rem" :wrap="false" />
            </Panel>
            <Panel title="Output" flush>
                <template #actions>
                    <span class="text-xs text-muted">{{ outSize.toLocaleString() }} bytes ({{ ratio }}%)</span>
                    <CopyButton :text="output" />
                    <Btn size="sm" variant="ghost" :disabled="!output" @click="download"><Download /> .js</Btn>
                </template>
                <CodeArea language="javascript" :model-value="output" readonly height="20rem" :wrap="false" />
            </Panel>
        </div>

        <Notice v-if="result.error" type="error">{{ result.error }}</Notice>
        <Notice v-else-if="syntaxWarning" type="warning">The input does not parse as a plain script ({{ syntaxWarning }}). It may be an ES module or contain a syntax error, so the output may not run.</Notice>

        <Panel title="Run both">
            <template #actions>
                <Btn size="sm" variant="primary" :disabled="running || !input" @click="runBoth"><Play /> {{ running ? "Running…" : "Run both" }}</Btn>
            </template>
            <p class="text-sm text-muted">Executes the input and the output in separate sandboxed iframes (<code class="code">sandbox="allow-scripts"</code>, no same-origin access) and compares captured <code class="code">console</code> output. Asynchronous work is observed for about 0.7 seconds.</p>
            <div v-if="run" class="mt-3 space-y-3">
                <Notice v-if="run.timedOut" type="error">A run timed out or did not respond.</Notice>
                <Notice v-else :type="run.match ? 'success' : 'error'">{{ run.match ? "Outputs match." : "Outputs differ." }}</Notice>
                <div class="grid gap-3 lg:grid-cols-2">
                    <div>
                        <div class="label">Input console</div>
                        <pre class="max-h-60 min-h-12 overflow-auto rounded-md bg-subtle p-3 font-mono text-xs whitespace-pre-wrap">{{ run.a.join("\n") || "(no output)" }}</pre>
                    </div>
                    <div>
                        <div class="label">Output console</div>
                        <pre class="max-h-60 min-h-12 overflow-auto rounded-md bg-subtle p-3 font-mono text-xs whitespace-pre-wrap">{{ run.b.join("\n") || "(no output)" }}</pre>
                    </div>
                </div>
            </div>
        </Panel>
    </ToolPage>
</template>
