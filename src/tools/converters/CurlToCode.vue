<script setup lang="ts">
import { computed, ref } from "vue";
import { ClipboardPaste, Sparkles, Trash2 } from "lucide-vue-next";
import { Btn, CodeArea, CopyButton, Notice, Panel, Tabs, ToolPage } from "@/components/ui";
import { readClipboard } from "@/composables/useClipboard";

const SAMPLE = `curl -X POST 'https://api.example.com/v1/users?notify=true' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer YOUR_TOKEN' \\
  -b 'session=abc123' \\
  --compressed -L \\
  -d '{"name": "Ada Lovelace", "email": "ada@example.com", "roles": ["admin", "dev"], "active": true}'`;

type Lang = "fetch" | "axios" | "python" | "go" | "php" | "httpie";
const lang = ref<Lang>("fetch");
const input = ref(SAMPLE);

const langs: { value: Lang; label: string }[] = [
    { value: "fetch", label: "JS fetch" },
    { value: "axios", label: "Node axios" },
    { value: "python", label: "Python requests" },
    { value: "go", label: "Go" },
    { value: "php", label: "PHP cURL" },
    { value: "httpie", label: "HTTPie" },
];

// ---------- tokenizer ----------
function tokenize(src: string): string[] {
    const s = src.replace(/\\\r?\n/g, " ").replace(/\^\r?\n/g, " ");
    const tokens: string[] = [];
    let cur = "", has = false, i = 0;
    while (i < s.length) {
        const c = s[i];
        if (c === "'") {
            const end = s.indexOf("'", i + 1);
            if (end < 0) throw new Error("Unterminated single quote.");
            cur += s.slice(i + 1, end);
            has = true;
            i = end + 1;
        } else if (c === '"') {
            i++;
            has = true;
            let closed = false;
            while (i < s.length) {
                if (s[i] === "\\" && i + 1 < s.length && /["\\$`\n]/.test(s[i + 1])) {
                    if (s[i + 1] !== "\n") cur += s[i + 1];
                    i += 2;
                } else if (s[i] === '"') {
                    closed = true;
                    i++;
                    break;
                } else cur += s[i++];
            }
            if (!closed) throw new Error("Unterminated double quote.");
        } else if (c === "$" && s[i + 1] === "'") {
            i += 2;
            has = true;
            let closed = false;
            while (i < s.length) {
                if (s[i] === "\\" && i + 1 < s.length) {
                    const n = s[i + 1];
                    const map: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\", "'": "'", '"': '"' };
                    if (n === "u" && /^[0-9a-fA-F]{4}/.test(s.slice(i + 2, i + 6))) {
                        cur += String.fromCharCode(parseInt(s.slice(i + 2, i + 6), 16));
                        i += 6;
                    } else if (n === "x" && /^[0-9a-fA-F]{2}/.test(s.slice(i + 2, i + 4))) {
                        cur += String.fromCharCode(parseInt(s.slice(i + 2, i + 4), 16));
                        i += 4;
                    } else {
                        cur += map[n] ?? "\\" + n;
                        i += 2;
                    }
                } else if (s[i] === "'") {
                    closed = true;
                    i++;
                    break;
                } else cur += s[i++];
            }
            if (!closed) throw new Error("Unterminated $'…' string.");
        } else if (c === "\\" && i + 1 < s.length) {
            cur += s[i + 1];
            has = true;
            i += 2;
        } else if (/\s/.test(c)) {
            if (has) tokens.push(cur);
            cur = "";
            has = false;
            i++;
        } else {
            cur += c;
            has = true;
            i++;
        }
    }
    if (has) tokens.push(cur);
    return tokens;
}

// ---------- parser ----------
interface Form { name: string; value: string; file: boolean }
interface Req {
    method: string;
    url: string;
    headers: [string, string][];
    body: string | null;
    forms: Form[];
    user: string | null;
    follow: boolean;
    insecure: boolean;
    compressed: boolean;
    jsonBody: unknown;
    notes: string[];
}

const SHORT_WITH_ARG = new Set(["X", "H", "d", "u", "F", "b", "A", "e", "o", "m", "T", "c", "w", "x", "E", "K", "z", "C", "D", "Q", "r", "y", "Y"]);
const LONG_WITH_ARG = new Set([
    "request", "header", "data", "data-raw", "data-binary", "data-urlencode", "data-ascii", "user", "form", "form-string", "json", "cookie", "user-agent",
    "referer", "output", "max-time", "upload-file", "cookie-jar", "write-out", "proxy", "cert", "key", "cacert", "connect-timeout", "url", "retry",
    "oauth2-bearer", "resolve", "range", "proxy-user", "dump-header", "time-cond", "continue-at", "limit-rate", "config",
]);

function encodeUrlencodeData(v: string): string {
    const eq = v.indexOf("=");
    if (eq === 0) return encodeURIComponent(v.slice(1));
    if (eq > 0) return `${v.slice(0, eq)}=${encodeURIComponent(v.slice(eq + 1))}`;
    return encodeURIComponent(v);
}

function parseCurl(src: string): Req {
    let tokens = tokenize(src.trim());
    if (tokens[0] === "$") tokens = tokens.slice(1);
    if (!tokens.length) throw new Error("Empty command.");
    if (tokens[0] !== "curl") throw new Error('Command must start with "curl".');
    tokens = tokens.slice(1);

    const r: Req = { method: "", url: "", headers: [], body: null, forms: [], user: null, follow: false, insecure: false, compressed: false, jsonBody: undefined, notes: [] };
    const dataParts: string[] = [];
    let getMode = false, head = false, jsonMode = false;
    let cookie = null as string | null, ua = null as string | null, referer = null as string | null;

    const apply = (flag: string, val: string | undefined) => {
        const v = val ?? "";
        switch (flag) {
            case "X": case "request": r.method = v.toUpperCase(); break;
            case "H": case "header": {
                const i = v.indexOf(":");
                if (i > 0) r.headers.push([v.slice(0, i).trim(), v.slice(i + 1).trim()]);
                else if (v.endsWith(";")) break;
                break;
            }
            case "d": case "data": case "data-ascii": case "data-raw": case "data-binary":
                if ((flag === "d" || flag === "data" || flag === "data-ascii") && v.startsWith("@")) {
                    r.notes.push(`Body is read from file "${v.slice(1)}"; replace with your own data.`);
                    dataParts.push(`<contents of ${v.slice(1)}>`);
                } else dataParts.push(v);
                break;
            case "data-urlencode": dataParts.push(encodeUrlencodeData(v)); break;
            case "json": jsonMode = true; dataParts.push(v); break;
            case "u": case "user": r.user = v; break;
            case "F": case "form": case "form-string": {
                const i = v.indexOf("=");
                if (i < 0) break;
                const value = v.slice(i + 1);
                const isFile = flag !== "form-string" && value.startsWith("@");
                r.forms.push({ name: v.slice(0, i), value: isFile ? value.slice(1).split(";")[0] : value, file: isFile });
                break;
            }
            case "b": case "cookie": cookie = v; break;
            case "A": case "user-agent": ua = v; break;
            case "e": case "referer": referer = v; break;
            case "L": case "location": r.follow = true; break;
            case "k": case "insecure": r.insecure = true; break;
            case "compressed": r.compressed = true; break;
            case "G": case "get": getMode = true; break;
            case "I": case "head": head = true; break;
            case "oauth2-bearer": r.headers.push(["Authorization", `Bearer ${v}`]); break;
            case "url": r.url = v; break;
        }
    };

    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.startsWith("--") && t.length > 2) {
            const eq = t.indexOf("=");
            const name = (eq > 0 ? t.slice(2, eq) : t.slice(2)).toLowerCase();
            if (LONG_WITH_ARG.has(name)) apply(name, eq > 0 ? t.slice(eq + 1) : tokens[++i]);
            else apply(name, undefined);
        } else if (t.startsWith("-") && t.length > 1) {
            // possibly combined short flags: -sSL or -XPOST
            for (let j = 1; j < t.length; j++) {
                const f = t[j];
                if (SHORT_WITH_ARG.has(f)) {
                    const rest = t.slice(j + 1);
                    apply(f, rest || tokens[++i]);
                    break;
                }
                apply(f, undefined);
            }
        } else if (!r.url) r.url = t;
    }

    if (!r.url) throw new Error("No URL found in the command.");
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(r.url)) r.url = (/^(localhost|127\.|\[::1\])/i.test(r.url) ? "http://" : "https://") + r.url;

    if (cookie && cookie.includes("=")) r.headers.push(["Cookie", cookie]);
    if (ua) r.headers.push(["User-Agent", ua]);
    if (referer) r.headers.push(["Referer", referer]);

    const hasHeader = (n: string) => r.headers.some(([k]) => k.toLowerCase() === n);
    const isJsonCt = r.headers.some(([k, v]) => k.toLowerCase() === "content-type" && /json/i.test(v));

    if (dataParts.length) r.body = jsonMode ? dataParts.join("") : dataParts.join("&");
    if (r.body !== null && getMode) {
        r.url += (r.url.includes("?") ? "&" : "?") + r.body;
        r.body = null;
    }
    if (jsonMode) {
        if (!hasHeader("content-type")) r.headers.push(["Content-Type", "application/json"]);
        if (!hasHeader("accept")) r.headers.push(["Accept", "application/json"]);
    } else if (r.body !== null && !r.forms.length && !hasHeader("content-type")) {
        r.headers.push(["Content-Type", "application/x-www-form-urlencoded"]);
    }
    if ((jsonMode || isJsonCt || (r.body !== null && /^\s*[{[]/.test(r.body))) && r.body) {
        try {
            r.jsonBody = JSON.parse(r.body);
        } catch {
            r.jsonBody = undefined;
        }
    }
    if (!r.method) r.method = head ? "HEAD" : r.body !== null || r.forms.length ? "POST" : "GET";
    return r;
}

// ---------- generators ----------
const q = (s: string) => JSON.stringify(s);
const isObj = (v: unknown): v is Record<string, unknown> | unknown[] => typeof v === "object" && v !== null;

function jsLiteral(v: unknown, ind = 0): string {
    return JSON.stringify(v, null, 2).replace(/\n/g, "\n" + " ".repeat(ind));
}

function pyLiteral(v: unknown, ind = 0): string {
    const pad = " ".repeat(ind + 4), end = " ".repeat(ind);
    if (v === null) return "None";
    if (v === true) return "True";
    if (v === false) return "False";
    if (typeof v === "number") return String(v);
    if (typeof v === "string") return q(v);
    if (Array.isArray(v)) return v.length ? `[\n${v.map((x) => pad + pyLiteral(x, ind + 4)).join(",\n")},\n${end}]` : "[]";
    const e = Object.entries(v as Record<string, unknown>);
    return e.length ? `{\n${e.map(([k, x]) => `${pad}${q(k)}: ${pyLiteral(x, ind + 4)}`).join(",\n")},\n${end}}` : "{}";
}

function authParts(user: string): [string, string] {
    const i = user.indexOf(":");
    return i < 0 ? [user, ""] : [user.slice(0, i), user.slice(i + 1)];
}

function shellQuote(s: string) {
    return /^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
}

function genFetch(r: Req): string {
    const l: string[] = [];
    const o: string[] = [`  method: ${q(r.method)},`];
    if (r.headers.length || r.user) {
        o.push("  headers: {", ...r.headers.map(([k, v]) => `    ${q(k)}: ${q(v)},`));
        if (r.user) o.push(`    "Authorization": "Basic " + btoa(${q(r.user)}),`);
        o.push("  },");
    }
    if (r.forms.length) {
        l.push("const form = new FormData();");
        for (const f of r.forms) l.push(f.file ? `form.append(${q(f.name)}, fileInput.files[0]); // ${f.value}` : `form.append(${q(f.name)}, ${q(f.value)});`);
        l.push("");
        o.push("  body: form,");
    } else if (r.body !== null) {
        o.push(isObj(r.jsonBody) ? `  body: JSON.stringify(${jsLiteral(r.jsonBody, 2)}),` : `  body: ${q(r.body)},`);
    }
    if (r.follow) o.push('  redirect: "follow",');
    if (r.insecure) l.push("// Note: to skip TLS verification in Node, run with NODE_TLS_REJECT_UNAUTHORIZED=0");
    l.push(`const response = await fetch(${q(r.url)}, {`, ...o, "});", "", "if (!response.ok) throw new Error(`HTTP ${response.status}`);", "const data = await response.text();", "console.log(data);");
    return l.join("\n");
}

function genAxios(r: Req): string {
    const l: string[] = ['import axios from "axios";'];
    if (r.insecure) l.push('import https from "node:https";');
    if (r.forms.length) l.push('import fs from "node:fs";');
    l.push("");
    if (r.forms.length) {
        l.push("const form = new FormData();");
        for (const f of r.forms) l.push(f.file ? `form.append(${q(f.name)}, new Blob([fs.readFileSync(${q(f.value)})]), ${q(f.value.split("/").pop() ?? f.value)});` : `form.append(${q(f.name)}, ${q(f.value)});`);
        l.push("");
    }
    const o: string[] = [`  method: ${q(r.method.toLowerCase())},`, `  url: ${q(r.url)},`];
    if (r.headers.length) {
        o.push("  headers: {", ...r.headers.map(([k, v]) => `    ${q(k)}: ${q(v)},`), "  },");
    }
    if (r.user) {
        const [u, p] = authParts(r.user);
        o.push(`  auth: { username: ${q(u)}, password: ${q(p)} },`);
    }
    if (r.forms.length) o.push("  data: form,");
    else if (r.body !== null) o.push(isObj(r.jsonBody) ? `  data: ${jsLiteral(r.jsonBody, 2)},` : `  data: ${q(r.body)},`);
    if (!r.follow) o.push("  maxRedirects: 0,");
    if (r.insecure) o.push("  httpsAgent: new https.Agent({ rejectUnauthorized: false }),");
    l.push("const response = await axios.request({", ...o, "});", "", "console.log(response.data);");
    return l.join("\n");
}

function genPython(r: Req): string {
    const l: string[] = ["import requests", "", `url = ${q(r.url)}`];
    const args: string[] = [];
    if (r.headers.length) {
        l.push("headers = {", ...r.headers.map(([k, v]) => `    ${q(k)}: ${q(v)},`), "}");
        args.push("headers=headers");
    }
    if (r.forms.length) {
        const fields = r.forms.filter((f) => !f.file);
        const files = r.forms.filter((f) => f.file);
        if (fields.length) {
            l.push("data = {", ...fields.map((f) => `    ${q(f.name)}: ${q(f.value)},`), "}");
            args.push("data=data");
        }
        if (files.length) {
            l.push("files = {", ...files.map((f) => `    ${q(f.name)}: open(${q(f.value)}, "rb"),`), "}");
            args.push("files=files");
        }
    } else if (r.body !== null) {
        if (isObj(r.jsonBody)) {
            l.push(`payload = ${pyLiteral(r.jsonBody)}`);
            args.push("json=payload");
        } else {
            l.push(`payload = ${q(r.body)}`);
            args.push("data=payload");
        }
    }
    if (r.user) {
        const [u, p] = authParts(r.user);
        args.push(`auth=(${q(u)}, ${q(p)})`);
    }
    if (!r.follow) args.push("allow_redirects=False");
    if (r.insecure) args.push("verify=False");
    l.push("", `response = requests.request(${q(r.method)}, url${args.length ? ", " + args.join(", ") : ""})`, "", "print(response.status_code)", "print(response.text)");
    return l.join("\n");
}

function goStr(s: string) {
    return s.includes("`") || /[\r]/.test(s) ? q(s) : /\n|"/.test(s) ? "`" + s + "`" : q(s);
}

function genGo(r: Req): string {
    const imports = new Set(["fmt", "io", "log", "net/http"]);
    const body: string[] = [];
    let bodyVar = "nil";
    if (r.forms.length) {
        imports.add("bytes");
        imports.add("mime/multipart");
        body.push("\tpayload := &bytes.Buffer{}", "\twriter := multipart.NewWriter(payload)");
        for (const f of r.forms) {
            if (f.file) {
                imports.add("os");
                body.push(`\tfile, err := os.Open(${q(f.value)})`, "\tif err != nil {", "\t\tlog.Fatal(err)", "\t}", "\tdefer file.Close()", `\tpart, _ := writer.CreateFormFile(${q(f.name)}, ${q(f.value)})`, "\tio.Copy(part, file)");
            } else body.push(`\twriter.WriteField(${q(f.name)}, ${q(f.value)})`);
        }
        body.push("\twriter.Close()", "");
        bodyVar = "payload";
    } else if (r.body !== null) {
        imports.add("strings");
        body.push(`\tpayload := strings.NewReader(${goStr(r.body)})`, "");
        bodyVar = "payload";
    }
    const hasTls = r.insecure;
    if (hasTls) imports.add("crypto/tls");
    const out: string[] = ["package main", "", "import ("];
    for (const i of Array.from(imports).sort()) out.push(`\t"${i}"`);
    out.push(")", "", "func main() {", ...body);
    if (hasTls || !r.follow) {
        const parts: string[] = [];
        if (hasTls) parts.push("\t\tTransport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}},");
        if (!r.follow) parts.push("\t\tCheckRedirect: func(req *http.Request, via []*http.Request) error { return http.ErrUseLastResponse },");
        out.push("\tclient := &http.Client{", ...parts, "\t}");
    } else out.push("\tclient := &http.Client{}");
    out.push(`\treq, err := http.NewRequest(${q(r.method)}, ${q(r.url)}, ${bodyVar})`, "\tif err != nil {", "\t\tlog.Fatal(err)", "\t}");
    for (const [k, v] of r.headers) out.push(`\treq.Header.Set(${q(k)}, ${q(v)})`);
    if (r.forms.length) out.push('\treq.Header.Set("Content-Type", writer.FormDataContentType())');
    if (r.user) {
        const [u, p] = authParts(r.user);
        out.push(`\treq.SetBasicAuth(${q(u)}, ${q(p)})`);
    }
    out.push("", "\tres, err := client.Do(req)", "\tif err != nil {", "\t\tlog.Fatal(err)", "\t}", "\tdefer res.Body.Close()", "", "\tdata, _ := io.ReadAll(res.Body)", "\tfmt.Println(res.Status)", "\tfmt.Println(string(data))", "}");
    return out.join("\n");
}

function phpStr(s: string) {
    return "'" + s.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
}

function genPhp(r: Req): string {
    const l: string[] = ["<?php", "", "$ch = curl_init();", "", "curl_setopt_array($ch, ["];
    l.push(`    CURLOPT_URL => ${phpStr(r.url)},`, "    CURLOPT_RETURNTRANSFER => true,");
    if (r.method === "HEAD") l.push("    CURLOPT_NOBODY => true,");
    else if (r.method === "POST" && (r.body !== null || r.forms.length)) l.push("    CURLOPT_POST => true,");
    else if (r.method !== "GET") l.push(`    CURLOPT_CUSTOMREQUEST => ${phpStr(r.method)},`);
    if (r.forms.length) {
        l.push("    CURLOPT_POSTFIELDS => [", ...r.forms.map((f) => `        ${phpStr(f.name)} => ${f.file ? `new CURLFile(${phpStr(f.value)})` : phpStr(f.value)},`), "    ],");
    } else if (r.body !== null) l.push(`    CURLOPT_POSTFIELDS => ${phpStr(r.body)},`);
    if (r.headers.length) l.push("    CURLOPT_HTTPHEADER => [", ...r.headers.map(([k, v]) => `        ${phpStr(`${k}: ${v}`)},`), "    ],");
    if (r.user) l.push(`    CURLOPT_USERPWD => ${phpStr(r.user)},`);
    if (r.follow) l.push("    CURLOPT_FOLLOWLOCATION => true,");
    if (r.compressed) l.push('    CURLOPT_ENCODING => "",');
    if (r.insecure) l.push("    CURLOPT_SSL_VERIFYPEER => false,", "    CURLOPT_SSL_VERIFYHOST => 0,");
    l.push("]);", "", "$response = curl_exec($ch);", "", "if ($response === false) {", "    echo 'cURL error: ' . curl_error($ch);", "} else {", "    echo $response;", "}", "", "curl_close($ch);");
    return l.join("\n");
}

function genHttpie(r: Req): string {
    const parts: string[] = ["http"];
    if (r.follow) parts.push("--follow");
    if (r.insecure) parts.push("--verify=no");
    if (r.forms.length) parts.push("--form");
    if (r.user) parts.push("-a", shellQuote(r.user));
    parts.push(r.method, shellQuote(r.url));
    for (const [k, v] of r.headers) {
        if (r.forms.length === 0 && r.body !== null && k.toLowerCase() === "content-type" && /json|x-www-form/i.test(v)) continue;
        parts.push(shellQuote(`${k}:${v}`));
    }
    let tail = "";
    if (r.forms.length) {
        for (const f of r.forms) parts.push(f.file ? shellQuote(`${f.name}@${f.value}`) : shellQuote(`${f.name}=${f.value}`));
    } else if (r.body !== null) {
        const jb = r.jsonBody;
        if (jb && typeof jb === "object" && !Array.isArray(jb)) {
            for (const [k, v] of Object.entries(jb)) parts.push(typeof v === "string" ? shellQuote(`${k}=${v}`) : shellQuote(`${k}:=${JSON.stringify(v)}`));
        } else if (/^[^=&]+=[^&]*(&[^=&]+=[^&]*)*$/.test(r.body) && r.headers.some(([k, v]) => k.toLowerCase() === "content-type" && /x-www-form/i.test(v))) {
            parts.splice(1, 0, "--form");
            for (const pair of r.body.split("&")) {
                const i = pair.indexOf("=");
                parts.push(shellQuote(`${decodeURIComponent(pair.slice(0, i))}=${decodeURIComponent(pair.slice(i + 1))}`));
            }
        } else tail = `--raw ${shellQuote(r.body)}`;
    }
    if (tail) parts.push(tail);
    const [first, ...rest] = parts;
    return rest.length > 3 ? [first + " " + rest.slice(0, 1).join(" "), ...rest.slice(1).map((x) => "  " + x)].join(" \\\n") : parts.join(" ");
}

const parsed = computed<{ req?: Req; error?: string }>(() => {
    if (!input.value.trim()) return {};
    try {
        return { req: parseCurl(input.value) };
    } catch (e) {
        return { error: e instanceof Error ? e.message : "Could not parse the command." };
    }
});

const output = computed(() => {
    const r = parsed.value.req;
    if (!r) return "";
    switch (lang.value) {
        case "fetch": return genFetch(r);
        case "axios": return genAxios(r);
        case "python": return genPython(r);
        case "go": return genGo(r);
        case "php": return genPhp(r);
        case "httpie": return genHttpie(r);
    }
    return "";
});

async function paste() {
    input.value = await readClipboard();
}
</script>

<template>
    <ToolPage>
        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="cURL command" flush>
                <template #actions>
                    <Btn size="sm" variant="ghost" @click="input = SAMPLE"><Sparkles /> Sample</Btn>
                    <Btn size="sm" variant="ghost" @click="paste"><ClipboardPaste /> Paste</Btn>
                    <Btn size="sm" variant="ghost" :disabled="!input" @click="input = ''"><Trash2 /> Clear</Btn>
                </template>
                <CodeArea v-model="input" :wrap="false" height="22rem" :invalid="!!parsed.error" placeholder="curl https://api.example.com -H 'Accept: application/json'" />
                <div v-if="parsed.req" class="flex flex-wrap gap-1.5 border-t border-line px-4 py-2 text-xs">
                    <span class="chip">{{ parsed.req.method }}</span>
                    <span class="chip max-w-full truncate">{{ parsed.req.url }}</span>
                    <span class="chip">{{ parsed.req.headers.length }} header{{ parsed.req.headers.length === 1 ? "" : "s" }}</span>
                    <span v-if="parsed.req.body !== null" class="chip">body</span>
                    <span v-if="parsed.req.forms.length" class="chip">{{ parsed.req.forms.length }} form field{{ parsed.req.forms.length === 1 ? "" : "s" }}</span>
                    <span v-if="parsed.req.user" class="chip">basic auth</span>
                </div>
            </Panel>

            <Panel flush>
                <template #title>
                    <Tabs v-model="lang" size="sm" :options="langs" />
                </template>
                <template #actions><CopyButton :text="output" /></template>
                <div v-if="parsed.error" class="p-4"><Notice type="error">{{ parsed.error }}</Notice></div>
                <template v-else>
                    <div v-if="parsed.req?.notes.length" class="space-y-2 p-4 pb-0">
                        <Notice v-for="n in parsed.req.notes" :key="n" type="warning">{{ n }}</Notice>
                    </div>
                    <CodeArea :model-value="output" readonly :wrap="false" height="22rem" placeholder="Generated code appears here" />
                </template>
            </Panel>
        </div>
        <p class="text-xs text-muted">Supports -X, -H, -d / --data-raw / --data-binary / --data-urlencode, --json, -u, -F, -b, -L, -k, --compressed, -G and -I. Everything is parsed locally.</p>
    </ToolPage>
</template>
