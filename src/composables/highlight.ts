// Lightweight syntax highlighting: highlight.js core plus only the grammars we use.
import hljs from "highlight.js/lib/core";
import apache from "highlight.js/lib/languages/apache";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import go from "highlight.js/lib/languages/go";
import graphql from "highlight.js/lib/languages/graphql";
import ini from "highlight.js/lib/languages/ini";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import nginx from "highlight.js/lib/languages/nginx";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import scss from "highlight.js/lib/languages/scss";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import csharp from "highlight.js/lib/languages/csharp";
import kotlin from "highlight.js/lib/languages/kotlin";
import swift from "highlight.js/lib/languages/swift";
import ruby from "highlight.js/lib/languages/ruby";

const grammars = {
    apache, bash, css, dockerfile, go, graphql, ini, java, javascript, json, markdown, nginx, php, python,
    rust, scss, sql, typescript, xml, yaml, csharp, kotlin, swift, ruby,
};
for (const [name, grammar] of Object.entries(grammars)) hljs.registerLanguage(name, grammar);
hljs.registerAliases(["html", "svg", "vue"], { languageName: "xml" });
hljs.registerAliases(["toml", "env"], { languageName: "ini" });
hljs.registerAliases(["sh", "shell", "zsh", "curl"], { languageName: "bash" });
hljs.registerAliases(["js", "mjs", "cjs"], { languageName: "javascript" });
hljs.registerAliases(["ts"], { languageName: "typescript" });
hljs.registerAliases(["jsonl", "jsonc", "json5"], { languageName: "json" });
hljs.registerAliases(["md"], { languageName: "markdown" });
hljs.registerAliases(["yml", "compose"], { languageName: "yaml" });

/** Max input size we highlight; beyond this we fall back to plain escaped text to keep typing snappy. */
const MAX_LEN = 200_000;

export function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function supportsLanguage(lang?: string): boolean {
    return !!lang && (lang === "auto" || !!hljs.getLanguage(lang));
}

/** Returns HTML with `hljs-*` token spans. `lang` may be "auto" for detection. */
export function highlightCode(code: string, lang?: string): string {
    if (!code || code.length > MAX_LEN || !supportsLanguage(lang)) return escapeHtml(code);
    try {
        return lang === "auto"
            ? hljs.highlightAuto(code).value
            : hljs.highlight(code, { language: lang!, ignoreIllegals: true }).value;
    } catch {
        return escapeHtml(code);
    }
}
