import type { Component } from "vue";
import {
    Archive, ArrowRightLeft, Atom, Binary, Blend, Bot, Braces, CalendarRange, CaseSensitive,
    CheckCheck, Clock, Coins, Dices, Diff, Eye, EyeOff, FileCode, FileCode2,
    FileText, Fingerprint, GitCompare, Globe, Hash, Image, KeyRound, KeySquare, Layers, Link,
    ListOrdered, Lock, Network, Palette, Play, QrCode, Quote, Ratio, Regex, Ruler, Scaling,
    ScanLine, ScanText, Server, Settings2, ShieldCheck, Shuffle, Sparkles, Square, SquareTerminal,
    Table, Tag, Terminal, Text, Timer, Type, Wand2, Wrench, Code, Clock3, Image as ImageIcon,
} from "lucide-vue-next";

export type CategoryId =
    | "development"
    | "generators"
    | "converters"
    | "network"
    | "time"
    | "media"
    | "text"
    | "ai"
    | "utilities"
    | "css";

export interface Category {
    id: CategoryId;
    name: string;
    icon: Component;
}

export interface ToolDef {
    id: string;
    name: string;
    description: string;
    category: CategoryId;
    icon: Component;
    keywords?: string[];
    isNew?: boolean;
    component: () => Promise<unknown>;
}

export const categories: Category[] = [
    { id: "development", name: "Development", icon: Code },
    { id: "generators", name: "Generators", icon: Sparkles },
    { id: "converters", name: "Converters", icon: ArrowRightLeft },
    { id: "text", name: "Text", icon: Type },
    { id: "time", name: "Time & Date", icon: Clock3 },
    { id: "media", name: "Media & Color", icon: ImageIcon },
    { id: "css", name: "CSS", icon: Layers },
    { id: "network", name: "Network", icon: Network },
    { id: "ai", name: "AI", icon: Bot },
    { id: "utilities", name: "Utilities", icon: Wrench },
];

export const tools: ToolDef[] = [
    // Development
    { id: "json-formatter", name: "JSON Formatter", category: "development", icon: Braces, keywords: ["json", "prettify", "minify", "validate"], description: "Format, minify, sort and validate JSON, and convert it to YAML.", component: () => import("./development/JsonFormatter.vue") },
    { id: "regex-tester", name: "Regex Tester", category: "development", icon: Regex, keywords: ["regexp", "pattern", "match", "replace"], isNew: true, description: "Test a regular expression live with highlighted matches, capture groups and replace.", component: () => import("./development/RegexTester.vue") },
    { id: "json-to-code", name: "JSON to Code", category: "development", icon: FileCode, keywords: ["typescript", "go", "python", "types", "interface", "schema"], isNew: true, description: "Generate TypeScript, Go, Python or JSON Schema types from a JSON sample.", component: () => import("./development/JsonToCode.vue") },
    { id: "json-schema-validator", name: "JSON Schema Validator", category: "development", icon: ShieldCheck, keywords: ["ajv", "schema", "validate"], isNew: true, description: "Validate JSON against a JSON Schema as you type, with paths to each error.", component: () => import("./development/JsonSchemaValidator.vue") },
    { id: "json-diff", name: "JSON Diff", category: "development", icon: GitCompare, keywords: ["compare", "patch", "difference"], isNew: true, description: "Compare two JSON documents by value and list every added, removed and changed path.", component: () => import("./development/JsonDiff.vue") },
    { id: "html-preview", name: "HTML Preview", category: "development", icon: Eye, keywords: ["render", "sandbox", "iframe"], isNew: true, description: "Render HTML in a sandboxed frame that cannot reach the network.", component: () => import("./development/HtmlPreview.vue") },
    { id: "code-playground", name: "Code Playground", category: "development", icon: Play, keywords: ["javascript", "html", "css", "sandbox", "fiddle"], isNew: true, description: "Experiment with HTML, CSS and JavaScript with a live preview and console.", component: () => import("./development/CodePlayground.vue") },
    { id: "code-formatter", name: "Code Formatter", category: "development", icon: Wand2, keywords: ["prettier", "beautify", "sql", "css", "html", "javascript", "minify"], isNew: true, description: "Beautify HTML, CSS, JavaScript, TypeScript, Markdown, YAML and SQL.", component: () => import("./development/CodeFormatter.vue") },
    { id: "semver-calculator", name: "Semver Calculator", category: "development", icon: Tag, keywords: ["version", "range", "npm", "semantic"], isNew: true, description: "Check versions against npm ranges, compare versions and bump them.", component: () => import("./development/SemverCalculator.vue") },
    { id: "xml-inspector", name: "XML Inspector", category: "development", icon: FileCode2, keywords: ["xml", "xpath", "format", "minify"], isNew: true, description: "Format or minify XML and query nodes with XPath.", component: () => import("./development/XmlInspector.vue") },

    // Generators
    { id: "hash-generator", name: "Hash Generator", category: "generators", icon: Hash, keywords: ["md5", "sha1", "sha256", "sha512", "sha3", "hmac", "checksum"], isNew: true, description: "MD5, SHA-1, SHA-2 and SHA-3 hashes and HMAC for text and files.", component: () => import("./generators/HashGenerator.vue") },
    { id: "uuid-generator", name: "UUID Generator", category: "generators", icon: Fingerprint, keywords: ["guid", "ulid", "v4", "v7", "id"], isNew: true, description: "Generate v1, v4 and v7 UUIDs and ULIDs in bulk, and inspect existing IDs.", component: () => import("./generators/UuidGenerator.vue") },
    { id: "password-generator", name: "Password Generator", category: "generators", icon: KeyRound, keywords: ["secure", "random", "passphrase"], description: "Create strong passwords with custom length, character sets and a strength meter.", component: () => import("./generators/PasswordGenerator.vue") },
    { id: "lorem-ipsum", name: "Lorem Ipsum", category: "generators", icon: Text, keywords: ["placeholder", "dummy", "text", "fake"], isNew: true, description: "Generate placeholder paragraphs, sentences, words and fake data.", component: () => import("./generators/LoremIpsum.vue") },
    { id: "qr-code-generator", name: "QR Code Generator", category: "generators", icon: QrCode, keywords: ["qr", "wifi", "barcode"], description: "Make QR codes for text, URLs, Wi-Fi and contacts, and save as PNG or SVG.", component: () => import("./generators/QrGenerator.vue") },
    { id: "bcrypt-generator", name: "Bcrypt Generator", category: "generators", icon: Lock, keywords: ["hash", "password", "verify"], isNew: true, description: "Generate bcrypt hashes and verify a password against a hash.", component: () => import("./generators/BcryptGenerator.vue") },
    { id: "random-string", name: "Random String", category: "generators", icon: Shuffle, keywords: ["nanoid", "token", "hex", "base64url"], isNew: true, description: "Generate Nano IDs, hex and Base64URL tokens, and strings from a custom alphabet.", component: () => import("./generators/RandomString.vue") },

    // Converters
    { id: "base64-encoder", name: "Base64", category: "converters", icon: Binary, keywords: ["encode", "decode", "data uri", "base32"], description: "Encode and decode Base64 text and files, with a URL-safe mode.", component: () => import("./converters/Base64Tool.vue") },
    { id: "case-converter", name: "Case Converter", category: "converters", icon: CaseSensitive, keywords: ["camel", "snake", "kebab", "pascal", "slug"], isNew: true, description: "Convert names to camelCase, snake_case, kebab-case and more, and make slugs.", component: () => import("./converters/CaseConverter.vue") },
    { id: "number-base", name: "Number Base", category: "converters", icon: Binary, keywords: ["binary", "hex", "octal", "decimal", "roman"], isNew: true, description: "Convert numbers between binary, octal, decimal, hex, any base and Roman numerals.", component: () => import("./converters/NumberBase.vue") },
    { id: "markdown-preview", name: "Markdown Preview", category: "converters", icon: FileText, keywords: ["md", "gfm", "html"], isNew: true, description: "Live GitHub-flavored Markdown preview and sanitized HTML output.", component: () => import("./converters/MarkdownPreview.vue") },
    { id: "url-encoder", name: "URL Encoder", category: "converters", icon: Link, keywords: ["uri", "percent", "query", "parse"], isNew: true, description: "Encode and decode URLs, and parse a URL into parts and query parameters.", component: () => import("./converters/UrlEncoder.vue") },
    { id: "csv-json", name: "CSV ↔ JSON", category: "converters", icon: Table, keywords: ["csv", "json", "table", "spreadsheet"], isNew: true, description: "Convert CSV to JSON and back with custom delimiters and a table preview.", component: () => import("./converters/CsvJson.vue") },
    { id: "config-converter", name: "Config Converter", category: "converters", icon: Settings2, keywords: ["yaml", "toml", "env", "json"], isNew: true, description: "Convert between JSON, YAML, TOML and .env files.", component: () => import("./converters/ConfigConverter.vue") },
    { id: "escape-tools", name: "Escape Tools", category: "converters", icon: Quote, keywords: ["html entities", "unicode", "backslash", "punycode"], isNew: true, description: "Escape and unescape HTML entities, JSON strings and Unicode, and convert Punycode.", component: () => import("./converters/EscapeTools.vue") },
    { id: "html-to-jsx", name: "HTML to JSX", category: "converters", icon: Atom, keywords: ["react", "jsx", "classname"], isNew: true, description: "Convert HTML markup into valid React JSX.", component: () => import("./converters/HtmlToJsx.vue") },
    { id: "compression", name: "Compression", category: "converters", icon: Archive, keywords: ["gzip", "zlib", "deflate", "inflate"], isNew: true, description: "Compress and decompress GZIP, zlib and raw deflate data as Base64 or hex.", component: () => import("./converters/Compression.vue") },
    { id: "curl-to-code", name: "cURL to Code", category: "converters", icon: Terminal, keywords: ["curl", "fetch", "axios", "python", "requests", "go"], isNew: true, description: "Convert a cURL command to fetch, Node, Python, Go or PHP code.", component: () => import("./converters/CurlToCode.vue") },

    // Text
    { id: "text-compare", name: "Text Compare", category: "text", icon: Diff, keywords: ["diff", "compare", "changes"], isNew: true, description: "Line, word and character diffs that can ignore whitespace and case.", component: () => import("./text/TextCompare.vue") },
    { id: "jwt-decoder", name: "JWT Decoder", category: "text", icon: KeySquare, keywords: ["jwt", "token", "jose", "verify"], isNew: true, description: "Decode JWTs, check expiry and verify HMAC signatures.", component: () => import("./text/JwtDecoder.vue") },
    { id: "string-inspector", name: "String Inspector", category: "text", icon: ScanText, keywords: ["count", "words", "characters", "bytes", "unicode"], isNew: true, description: "Count characters, words, lines and bytes, and find hidden Unicode characters.", component: () => import("./text/StringInspector.vue") },
    { id: "line-tools", name: "Line Tools", category: "text", icon: ListOrdered, keywords: ["sort", "dedupe", "unique", "shuffle", "reverse"], isNew: true, description: "Sort, dedupe, trim, reverse, shuffle and filter lines.", component: () => import("./text/LineTools.vue") },

    // Time
    { id: "timestamp-converter", name: "Timestamp Converter", category: "time", icon: Clock, keywords: ["unix", "epoch", "date", "iso"], isNew: true, description: "Convert Unix timestamps and date strings in seconds, milliseconds and more.", component: () => import("./time/TimestampConverter.vue") },
    { id: "date-difference", name: "Date Difference", category: "time", icon: CalendarRange, keywords: ["days between", "duration", "add days"], isNew: true, description: "Calculate the time between two dates, or add and subtract durations.", component: () => import("./time/DateDifference.vue") },
    { id: "cron-calculator", name: "Cron Calculator", category: "time", icon: Timer, keywords: ["cron", "schedule", "crontab"], isNew: true, description: "Explain cron expressions in plain English and list the next runs.", component: () => import("./time/CronCalculator.vue") },
    { id: "timezone-converter", name: "Time Zone Converter", category: "time", icon: Globe, keywords: ["utc", "timezone", "dst"], isNew: true, description: "Convert a date and time between time zones, with DST handled.", component: () => import("./time/TimezoneConverter.vue") },
    { id: "stopwatch", name: "Stopwatch", category: "time", icon: Timer, keywords: ["timer", "laps", "split"], isNew: true, description: "Record laps and split times and export them as CSV.", component: () => import("./time/Stopwatch.vue") },

    // Media & color
    { id: "color-palette-generator", name: "Color Palette Generator", category: "media", icon: Palette, keywords: ["harmony", "shades", "contrast"], description: "Generate color palettes with harmony rules, accessibility checks and exports.", component: () => import("./media/ColorPaletteGenerator.vue") },
    { id: "random-color-generator", name: "Random Color Generator", category: "media", icon: Dices, keywords: ["hex", "rgb", "hsl"], description: "Generate random colors in HEX, RGB and HSL with a single click.", component: () => import("./media/RandomColorGenerator.vue") },
    { id: "color-converter", name: "Color Converter", category: "media", icon: Blend, keywords: ["hex", "rgb", "hsl", "oklch", "contrast", "wcag"], isNew: true, description: "Convert any CSS color to HEX, RGB, HSL, HWB and OKLCH, and check WCAG contrast.", component: () => import("./media/ColorConverter.vue") },
    { id: "qr-reader", name: "QR Reader", category: "media", icon: ScanLine, keywords: ["scan", "decode", "qr"], isNew: true, description: "Read a QR code with your camera or from an uploaded, dropped or pasted image.", component: () => import("./media/QrReader.vue") },
    { id: "image-converter", name: "Image Converter", category: "media", icon: Image, keywords: ["resize", "compress", "webp", "png", "jpeg"], isNew: true, description: "Resize, compress and convert images to JPEG, PNG or WebP in your browser.", component: () => import("./media/ImageConverter.vue") },

    // CSS
    { id: "box-shadow", name: "Box Shadow", category: "css", icon: Square, keywords: ["css", "shadow", "elevation"], isNew: true, description: "Design layered CSS box shadows visually and copy the CSS or Tailwind class.", component: () => import("./css/BoxShadow.vue") },
    { id: "gradient-generator", name: "Gradient Generator", category: "css", icon: Blend, keywords: ["css", "linear", "radial", "conic"], isNew: true, description: "Build linear, radial and conic CSS gradients with multiple stops.", component: () => import("./css/GradientGenerator.vue") },
    { id: "px-rem", name: "px ↔ rem", category: "css", icon: Scaling, keywords: ["css", "units", "em", "rem", "px"], isNew: true, description: "Convert between px, rem, em and pt with a custom root font size.", component: () => import("./css/PxRem.vue") },
    { id: "aspect-ratio", name: "Aspect Ratio", category: "css", icon: Ratio, keywords: ["resolution", "16:9", "width", "height"], isNew: true, description: "Calculate aspect ratios and scale dimensions while keeping proportions.", component: () => import("./css/AspectRatio.vue") },

    // Network
    { id: "cidr-calculator", name: "IP / CIDR Calculator", category: "network", icon: Network, keywords: ["subnet", "ipv4", "mask", "network"], isNew: true, description: "Get the network, broadcast, host range and masks for an IPv4 block.", component: () => import("./network/CidrCalculator.vue") },
    { id: "http-status-codes", name: "HTTP Status Codes", category: "network", icon: Server, keywords: ["http", "404", "500", "status"], isNew: true, description: "Searchable reference of HTTP status codes and what they mean.", component: () => import("./network/HttpStatusCodes.vue") },

    // AI
    { id: "pii-redactor", name: "Secret & PII Redactor", category: "ai", icon: EyeOff, keywords: ["redact", "mask", "api key", "email", "privacy"], isNew: true, description: "Mask API keys, tokens, emails and other personal data before pasting into an AI chat.", component: () => import("./ai/PiiRedactor.vue") },
    { id: "token-counter", name: "Token Counter", category: "ai", icon: Coins, keywords: ["gpt", "claude", "tokens", "context", "llm"], isNew: true, description: "Count GPT tokens exactly, estimate others, and check context window usage.", component: () => import("./ai/TokenCounter.vue") },
    { id: "ai-text-cleaner", name: "AI Text Cleaner", category: "ai", icon: Sparkles, keywords: ["clean", "invisible", "quotes", "markdown"], isNew: true, description: "Remove hidden characters, citation markers and Markdown from AI-written text.", component: () => import("./ai/AiTextCleaner.vue") },

    // Utilities
    { id: "unit-converter", name: "Unit Converter", category: "utilities", icon: Ruler, keywords: ["length", "weight", "temperature", "data", "bytes"], isNew: true, description: "Convert length, weight, temperature, area, speed and data units.", component: () => import("./utilities/UnitConverter.vue") },
    { id: "chmod-calculator", name: "chmod Calculator", category: "utilities", icon: SquareTerminal, keywords: ["permissions", "unix", "octal", "rwx"], isNew: true, description: "Set file permissions with checkboxes, octal or rwx text and get the chmod command.", component: () => import("./utilities/ChmodCalculator.vue") },
    { id: "checksum", name: "Checksum", category: "utilities", icon: CheckCheck, keywords: ["crc32", "crc16", "luhn", "adler"], isNew: true, description: "Calculate CRC-32, CRC-16 and Adler-32 checksums and validate Luhn numbers.", component: () => import("./utilities/Checksum.vue") },
];

export const toolById = new Map(tools.map((t) => [t.id, t]));
export const categoryById = new Map(categories.map((c) => [c.id, c]));

export function searchTools(query: string): ToolDef[] {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    const terms = q.split(/\s+/);
    return tools
        .map((t) => {
            const name = t.name.toLowerCase();
            const hay = [name, t.description.toLowerCase(), ...(t.keywords ?? []), t.category].join(" ");
            if (!terms.every((term) => hay.includes(term))) return null;
            const score = name.startsWith(q) ? 0 : name.includes(q) ? 1 : (t.keywords ?? []).some((k) => k.startsWith(q)) ? 2 : 3;
            return { t, score };
        })
        .filter((x): x is { t: ToolDef; score: number } => x !== null)
        .sort((a, b) => a.score - b.score)
        .map((x) => x.t);
}
