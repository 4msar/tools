import type { Component } from "vue";
import {
    Archive, ArrowRightLeft, Atom, Binary, Blend, Bot, Braces, CalendarRange, CaseSensitive,
    CheckCheck, Clock, Coins, Dices, Diff, Eye, EyeOff, FileCode, FileCode2,
    FileText, Fingerprint, GitCompare, Globe, Hash, Image, KeyRound, KeySquare, Layers, Link,
    ListOrdered, Lock, Network, Palette, Play, QrCode, Quote, Ratio, Regex, Ruler, Scaling,
    ScanLine, ScanText, Server, Settings2, ShieldCheck, Shuffle, Sparkles, Square, SquareTerminal,
    Table, Tag, Terminal, Text, Timer, Type, Wand2, Wrench, Code, Clock3, Image as ImageIcon,
    ALargeSmall, AppWindow, Brush, Calculator, Container, Database, FileBadge, GitBranch, Glasses, LayoutGrid, ListChecks,
    LockKeyhole, MessageSquareText, MonitorSmartphone, PenTool, Pipette, Route, Scissors, Send, Shield, Smartphone, Spline,
    ServerCog, Squircle, SwatchBook, UserCheck, AlarmClock, Coffee, ListTodo, Zap, MessagesSquare,
    CreditCard, Scale, CodeXml, FileLock, Radar, GlobeLock, Keyboard, AudioWaveform, FlaskConical, FerrisWheel, Hourglass,
    SearchCode, BotOff, Earth, Workflow, Presentation, ImagePlay, SearchCheck,
} from "lucide-vue-next";

export type CategoryId =
    | "development"
    | "generators"
    | "security"
    | "converters"
    | "network"
    | "time"
    | "media"
    | "text"
    | "ai"
    | "utilities"
    | "css"
    | "productivity";

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
    { id: "security", name: "Security", icon: Shield },
    { id: "converters", name: "Converters", icon: ArrowRightLeft },
    { id: "text", name: "Text", icon: Type },
    { id: "time", name: "Time & Date", icon: Clock3 },
    { id: "media", name: "Media & Color", icon: ImageIcon },
    { id: "css", name: "CSS", icon: Layers },
    { id: "network", name: "Network", icon: Network },
    { id: "ai", name: "AI", icon: Bot },
    { id: "productivity", name: "Productivity", icon: Zap },
    { id: "utilities", name: "Utilities", icon: Wrench },
];

export const tools: ToolDef[] = [
    // Development
    { id: "json-formatter", name: "JSON Formatter", category: "development", icon: Braces, keywords: ["json", "prettify", "minify", "validate"], description: "Format, minify, sort and validate JSON, and convert it to YAML.", component: () => import("./development/JsonFormatter.vue") },
    { id: "regex-tester", name: "Regex Tester", category: "development", icon: Regex, keywords: ["regexp", "pattern", "match", "replace"], description: "Test a regular expression live with highlighted matches, capture groups and replace.", component: () => import("./development/RegexTester.vue") },
    { id: "json-to-code", name: "JSON to Code", category: "development", icon: FileCode, keywords: ["typescript", "go", "python", "types", "interface", "schema"], description: "Generate TypeScript, Go, Python or JSON Schema types from a JSON sample.", component: () => import("./development/JsonToCode.vue") },
    { id: "json-schema-validator", name: "JSON Schema Validator", category: "development", icon: ShieldCheck, keywords: ["ajv", "schema", "validate"], description: "Validate JSON against a JSON Schema as you type, with paths to each error.", component: () => import("./development/JsonSchemaValidator.vue") },
    { id: "json-diff", name: "JSON Diff", category: "development", icon: GitCompare, keywords: ["compare", "patch", "difference"], description: "Compare two JSON documents by value and list every added, removed and changed path.", component: () => import("./development/JsonDiff.vue") },
    { id: "html-preview", name: "HTML Preview", category: "development", icon: Eye, keywords: ["render", "sandbox", "iframe"], description: "Render HTML in a sandboxed frame that cannot reach the network.", component: () => import("./development/HtmlPreview.vue") },
    { id: "code-playground", name: "Code Playground", category: "development", icon: Play, keywords: ["javascript", "html", "css", "sandbox", "fiddle"], description: "Experiment with HTML, CSS and JavaScript with a live preview and console.", component: () => import("./development/CodePlayground.vue") },
    { id: "code-formatter", name: "Code Formatter", category: "development", icon: Wand2, keywords: ["prettier", "beautify", "sql", "css", "html", "javascript", "minify"], description: "Beautify HTML, CSS, JavaScript, TypeScript, Markdown, YAML and SQL.", component: () => import("./development/CodeFormatter.vue") },
    { id: "code-to-image", name: "Code to Image", category: "development", icon: ImagePlay, keywords: ["carbon", "code screenshot", "snippet", "share code", "code image", "png", "svg", "syntax highlight", "pretty code"], isNew: true, description: "Turn a code snippet into a polished image with themes, backgrounds and window chrome, then export PNG or SVG.", component: () => import("./development/CodeToImage.vue") },
    { id: "semver-calculator", name: "Semver Calculator", category: "development", icon: Tag, keywords: ["version", "range", "npm", "semantic"], description: "Check versions against npm ranges, compare versions and bump them.", component: () => import("./development/SemverCalculator.vue") },
    { id: "xml-inspector", name: "XML Inspector", category: "development", icon: FileCode2, keywords: ["xml", "xpath", "format", "minify", "validate", "xml to json", "json to xml"], description: "Format, minify and validate XML, convert XML to and from JSON, and query with XPath.", component: () => import("./development/XmlInspector.vue") },
    { id: "json-path", name: "JSONPath Evaluator", category: "development", icon: Route, keywords: ["jsonpath", "query", "json", "filter", "jq"], description: "Query JSON with JSONPath expressions and see matching values and paths live.", component: () => import("./development/JsonPath.vue") },
    { id: "sql-formatter", name: "SQL Formatter", category: "development", icon: Database, keywords: ["sql", "format", "minify", "insert", "postgres", "mysql", "sql to json", "sql to csv"], description: "Format or minify SQL for any dialect, and turn INSERT statements into JSON or CSV.", component: () => import("./development/SqlTools.vue") },
    { id: "mermaid-editor", name: "Mermaid Diagram Editor", category: "development", icon: Workflow, keywords: ["mermaid", "diagram", "flowchart", "sequence diagram", "er diagram", "gantt", "uml", "chart"], isNew: true, description: "Write Mermaid flowcharts, sequence, ER and Gantt diagrams with a live preview, and export SVG or PNG.", component: () => import("./development/MermaidEditor.vue") },

    // Generators
    { id: "hash-generator", name: "Hash Generator", category: "generators", icon: Hash, keywords: ["md5", "sha1", "sha256", "sha512", "sha3", "hmac", "checksum"], description: "MD5, SHA-1, SHA-2 and SHA-3 hashes and HMAC for text and files.", component: () => import("./generators/HashGenerator.vue") },
    { id: "uuid-generator", name: "UUID Generator", category: "generators", icon: Fingerprint, keywords: ["guid", "ulid", "v4", "v7", "id"], description: "Generate v1, v4 and v7 UUIDs and ULIDs in bulk, and inspect existing IDs.", component: () => import("./generators/UuidGenerator.vue") },
    { id: "password-generator", name: "Password Generator", category: "generators", icon: KeyRound, keywords: ["secure", "random", "passphrase"], description: "Create strong passwords with custom length, character sets and a strength meter.", component: () => import("./generators/PasswordGenerator.vue") },
    { id: "lorem-ipsum", name: "Lorem Ipsum", category: "generators", icon: Text, keywords: ["placeholder", "dummy", "text", "fake"], description: "Generate placeholder paragraphs, sentences, words and fake data.", component: () => import("./generators/LoremIpsum.vue") },
    { id: "qr-code-generator", name: "QR Code Generator", category: "generators", icon: QrCode, keywords: ["qr", "wifi", "barcode", "visual", "art", "image", "photo"], description: "Make QR codes for text, URLs, Wi-Fi and contacts — classic, or visual with your photo showing through — and save as PNG or SVG.", component: () => import("./generators/QrGenerator.vue") },
    { id: "bcrypt-generator", name: "Bcrypt Generator", category: "generators", icon: Lock, keywords: ["hash", "password", "verify"], description: "Generate bcrypt hashes and verify a password against a hash.", component: () => import("./generators/BcryptGenerator.vue") },
    { id: "random-string", name: "Random String", category: "generators", icon: Shuffle, keywords: ["nanoid", "token", "hex", "base64url"], description: "Generate Nano IDs, hex and Base64URL tokens, and strings from a custom alphabet.", component: () => import("./generators/RandomString.vue") },
    { id: "gitignore-generator", name: "Gitignore Generator", category: "generators", icon: GitBranch, keywords: ["git", "gitignore", "ignore", "node", "python", "macos"], description: "Build a .gitignore from templates for languages, frameworks, editors and operating systems.", component: () => import("./generators/GitignoreGenerator.vue") },
    { id: "card-number-generator", name: "Card Number Generator", category: "generators", icon: CreditCard, keywords: ["credit card", "test card", "luhn", "visa", "mastercard", "amex", "fake", "payment testing"], isNew: true, description: "Generate Luhn-valid test card numbers for Visa, Mastercard, Amex and more, with expiry and CVV.", component: () => import("./generators/CardNumberGenerator.vue") },
    { id: "license-generator", name: "License Generator", category: "generators", icon: Scale, keywords: ["license", "mit", "gpl", "apache", "bsd", "spdx", "open source", "copyright"], isNew: true, description: "Generate an open-source LICENSE file (MIT, GPL, Apache, BSD and more) with your name and year.", component: () => import("./generators/LicenseGenerator.vue") },
    { id: "meta-tag-generator", name: "Meta Tag Generator", category: "generators", icon: CodeXml, keywords: ["seo", "meta", "open graph", "og", "twitter card", "html head", "social preview"], isNew: true, description: "Build SEO, Open Graph and Twitter meta tags with live search and social previews.", component: () => import("./generators/MetaTagGenerator.vue") },
    { id: "robots-sitemap-generator", name: "Robots.txt & Sitemap Generator", category: "generators", icon: BotOff, keywords: ["robots.txt", "sitemap", "sitemap.xml", "seo", "crawler", "ai crawlers", "gptbot", "disallow"], isNew: true, description: "Build robots.txt rules (including AI crawler blocking), test URLs against them, and generate sitemap.xml.", component: () => import("./generators/RobotsSitemapGenerator.vue") },

    // Security
    { id: "totp-generator", name: "TOTP / 2FA Generator", category: "security", icon: Smartphone, keywords: ["totp", "2fa", "otp", "authenticator", "otpauth", "mfa"], description: "Generate time-based one-time codes from a secret, with an authenticator QR code.", component: () => import("./security/TotpGenerator.vue") },
    { id: "aes-encryption", name: "AES Encryption", category: "security", icon: LockKeyhole, keywords: ["aes", "gcm", "encrypt", "decrypt", "password", "pbkdf2", "cipher"], description: "Encrypt and decrypt text with AES-256-GCM and a password-derived key.", component: () => import("./security/AesEncrypt.vue") },
    { id: "key-pair-generator", name: "SSH / RSA Key Generator", category: "security", icon: KeyRound, keywords: ["ssh", "rsa", "ed25519", "ecdsa", "pem", "public key", "private key", "keygen"], description: "Generate Ed25519, RSA and ECDSA key pairs as PEM, OpenSSH and JWK.", component: () => import("./security/KeyPairGenerator.vue") },
    { id: "certificate-decoder", name: "Certificate Decoder", category: "security", icon: FileBadge, keywords: ["x509", "pem", "csr", "ssl", "tls", "certificate", "crt"], description: "Decode X.509 certificates and CSRs: subject, validity, SANs, key usage and fingerprints.", component: () => import("./security/CertDecoder.vue") },
    { id: "basic-auth", name: "Basic Auth Generator", category: "security", icon: UserCheck, keywords: ["authorization", "header", "basic", "http auth", "base64"], description: "Build or decode an HTTP Basic Authorization header, with ready-to-use snippets.", component: () => import("./security/BasicAuth.vue") },
    { id: "js-obfuscator", name: "JavaScript Obfuscator", category: "security", icon: FileLock, keywords: ["obfuscate", "javascript", "js", "minify", "uglify", "protect code"], isNew: true, description: "Minify and obfuscate JavaScript by encoding strings and packing the source, then compare output.", component: () => import("./security/JsObfuscator.vue") },

    // Converters
    { id: "base64-encoder", name: "Base64", category: "converters", icon: Binary, keywords: ["encode", "decode", "data uri", "base32"], description: "Encode and decode Base64 text and files, with a URL-safe mode.", component: () => import("./converters/Base64Tool.vue") },
    { id: "case-converter", name: "Case Converter", category: "converters", icon: CaseSensitive, keywords: ["camel", "snake", "kebab", "pascal", "slug"], description: "Convert names to camelCase, snake_case, kebab-case and more, and make slugs.", component: () => import("./converters/CaseConverter.vue") },
    { id: "number-base", name: "Number Base", category: "converters", icon: Binary, keywords: ["binary", "hex", "octal", "decimal", "roman"], description: "Convert numbers between binary, octal, decimal, hex, any base and Roman numerals.", component: () => import("./converters/NumberBase.vue") },
    { id: "markdown-preview", name: "Markdown Preview", category: "converters", icon: FileText, keywords: ["md", "gfm", "html", "html to markdown", "plain text", "turndown"], description: "Preview Markdown, export HTML or plain text, and convert HTML to Markdown.", component: () => import("./converters/MarkdownPreview.vue") },
    { id: "url-encoder", name: "URL Encoder", category: "converters", icon: Link, keywords: ["uri", "percent", "query", "parse"], description: "Encode and decode URLs, and parse a URL into parts and query parameters.", component: () => import("./converters/UrlEncoder.vue") },
    { id: "csv-json", name: "CSV ↔ JSON", category: "converters", icon: Table, keywords: ["csv", "json", "table", "spreadsheet", "sql", "insert", "markdown table"], description: "Convert CSV to JSON, SQL inserts or a Markdown table, and JSON back to CSV.", component: () => import("./converters/CsvJson.vue") },
    { id: "config-converter", name: "Config Converter", category: "converters", icon: Settings2, keywords: ["yaml", "toml", "env", "json", "json5", "validate", "validator", "lint"], description: "Convert and validate JSON, JSON5, YAML, TOML and .env files, with error line numbers.", component: () => import("./converters/ConfigConverter.vue") },
    { id: "escape-tools", name: "Escape Tools", category: "converters", icon: Quote, keywords: ["html entities", "unicode", "backslash", "punycode"], description: "Escape and unescape HTML entities, JSON strings and Unicode, and convert Punycode.", component: () => import("./converters/EscapeTools.vue") },
    { id: "html-to-jsx", name: "HTML to JSX", category: "converters", icon: Atom, keywords: ["react", "jsx", "classname"], description: "Convert HTML markup into valid React JSX.", component: () => import("./converters/HtmlToJsx.vue") },
    { id: "compression", name: "Compression", category: "converters", icon: Archive, keywords: ["gzip", "zlib", "deflate", "inflate"], description: "Compress and decompress GZIP, zlib and raw deflate data as Base64 or hex.", component: () => import("./converters/Compression.vue") },
    { id: "curl-to-code", name: "cURL to Code", category: "converters", icon: Terminal, keywords: ["curl", "fetch", "axios", "python", "requests", "go"], description: "Convert a cURL command to fetch, Node, Python, Go or PHP code.", component: () => import("./converters/CurlToCode.vue") },
    { id: "docker-run-to-compose", name: "Docker Run to Compose", category: "converters", icon: Container, keywords: ["docker", "compose", "container", "yaml", "docker-compose"], description: "Convert docker run commands into a Docker Compose file.", component: () => import("./converters/DockerRunToCompose.vue") },

    // Text
    { id: "text-compare", name: "Text Compare", category: "text", icon: Diff, keywords: ["diff", "compare", "changes"], description: "Line, word and character diffs that can ignore whitespace and case.", component: () => import("./text/TextCompare.vue") },
    { id: "jwt-decoder", name: "JWT Decoder", category: "text", icon: KeySquare, keywords: ["jwt", "token", "jose", "verify", "sign", "encode", "signer"], description: "Decode JWTs, check expiry, verify signatures and sign new tokens.", component: () => import("./text/JwtDecoder.vue") },
    { id: "string-inspector", name: "String Inspector", category: "text", icon: ScanText, keywords: ["count", "words", "characters", "bytes", "unicode"], description: "Count characters, words, lines and bytes, and find hidden Unicode characters.", component: () => import("./text/StringInspector.vue") },
    { id: "line-tools", name: "Line Tools", category: "text", icon: ListOrdered, keywords: ["sort", "dedupe", "unique", "shuffle", "reverse"], description: "Sort, dedupe, trim, reverse, shuffle and filter lines.", component: () => import("./text/LineTools.vue") },
    { id: "ascii-art", name: "ASCII Art Generator", category: "text", icon: ALargeSmall, keywords: ["figlet", "banner", "text art", "ascii", "font"], description: "Turn text into ASCII art banners in 29 FIGlet fonts, ready to paste as a code comment.", component: () => import("./text/AsciiArt.vue") },

    // Time
    { id: "timestamp-converter", name: "Timestamp Converter", category: "time", icon: Clock, keywords: ["unix", "epoch", "date", "iso"], description: "Convert Unix timestamps and date strings in seconds, milliseconds and more.", component: () => import("./time/TimestampConverter.vue") },
    { id: "date-difference", name: "Date Difference", category: "time", icon: CalendarRange, keywords: ["days between", "duration", "add days"], description: "Calculate the time between two dates, or add and subtract durations.", component: () => import("./time/DateDifference.vue") },
    { id: "cron-calculator", name: "Cron Calculator", category: "time", icon: Timer, keywords: ["cron", "schedule", "crontab"], description: "Explain cron expressions in plain English and list the next runs.", component: () => import("./time/CronCalculator.vue") },
    { id: "timezone-converter", name: "Time Zone Converter", category: "time", icon: Globe, keywords: ["utc", "timezone", "dst"], description: "Convert a date and time between time zones, with DST handled.", component: () => import("./time/TimezoneConverter.vue") },
    { id: "stopwatch", name: "Stopwatch", category: "time", icon: Timer, keywords: ["timer", "laps", "split"], description: "Record laps and split times and export them as CSV.", component: () => import("./time/Stopwatch.vue") },
    { id: "countdown-timer", name: "Countdown Timer", category: "time", icon: Hourglass, keywords: ["countdown", "timer", "event", "days until", "new year", "deadline"], isNew: true, description: "Count down to events and dates, or run a timer with a progress ring and alert.", component: () => import("./time/CountdownTimer.vue") },
    { id: "world-clock", name: "World Clock & Meeting Planner", category: "time", icon: Earth, keywords: ["world clock", "time zones", "meeting planner", "team", "remote", "working hours", "utc"], isNew: true, description: "See the time in cities around the world and find meeting slots that fit everyone's working hours.", component: () => import("./time/WorldClock.vue") },

    // Media & color
    { id: "color-palette-generator", name: "Color Palette Generator", category: "media", icon: Palette, keywords: ["harmony", "shades", "contrast"], description: "Generate color palettes with harmony rules, accessibility checks and exports.", component: () => import("./media/ColorPaletteGenerator.vue") },
    { id: "random-color-generator", name: "Random Color Generator", category: "media", icon: Dices, keywords: ["hex", "rgb", "hsl"], description: "Generate random colors in HEX, RGB and HSL with a single click.", component: () => import("./media/RandomColorGenerator.vue") },
    { id: "color-converter", name: "Color Converter", category: "media", icon: Blend, keywords: ["hex", "rgb", "hsl", "oklch", "contrast", "wcag"], description: "Convert any CSS color to HEX, RGB, HSL, HWB and OKLCH, and check WCAG contrast.", component: () => import("./media/ColorConverter.vue") },
    { id: "qr-reader", name: "QR Reader", category: "media", icon: ScanLine, keywords: ["scan", "decode", "qr"], description: "Read a QR code with your camera or from an uploaded, dropped or pasted image.", component: () => import("./media/QrReader.vue") },
    { id: "image-converter", name: "Image Converter", category: "media", icon: Image, keywords: ["resize", "compress", "webp", "png", "jpeg"], description: "Resize, compress and convert images to JPEG, PNG or WebP in your browser.", component: () => import("./media/ImageConverter.vue") },
    { id: "svg-tools", name: "SVG Optimizer", category: "media", icon: PenTool, keywords: ["svg", "svgo", "optimize", "svg to png", "data uri", "minify", "viewer", "jsx"], description: "Preview and optimize SVG, export PNG, and get a data URI, CSS or JSX.", component: () => import("./media/SvgTools.vue") },
    { id: "favicon-generator", name: "Favicon Generator", category: "media", icon: AppWindow, keywords: ["favicon", "ico", "icon", "apple touch", "manifest", "pwa"], description: "Make favicon.ico, PNG icons and a web manifest from an image, letter or emoji.", component: () => import("./media/FaviconGenerator.vue") },
    { id: "color-blindness-simulator", name: "Color Blindness Simulator", category: "media", icon: Glasses, keywords: ["accessibility", "protanopia", "deuteranopia", "tritanopia", "a11y", "color vision"], description: "See how a palette or image looks with protanopia, deuteranopia, tritanopia and achromatopsia.", component: () => import("./media/ColorBlindness.vue") },
    { id: "palette-extractor", name: "Image Palette Extractor", category: "media", icon: Pipette, keywords: ["palette", "colors", "image", "dominant", "extract"], description: "Extract the dominant colors from an image and export them as CSS, Tailwind or JSON.", component: () => import("./media/PaletteExtractor.vue") },
    { id: "pixel-art-studio", name: "Pixel Art Sprite Studio", category: "media", icon: Brush, keywords: ["pixel art", "sprite", "sprite sheet", "animation", "draw", "editor"], description: "Draw pixel art, animate frames and export PNGs or a sprite sheet.", component: () => import("./media/PixelArtStudio.vue") },
    { id: "sound-tool", name: "Sound Tool", category: "media", icon: AudioWaveform, keywords: ["tone generator", "frequency", "noise", "white noise", "metronome", "microphone", "pitch", "tuner", "audio"], isNew: true, description: "Generate tones and noise, keep time with a metronome and measure your mic level and pitch.", component: () => import("./media/SoundTool.vue") },
    { id: "whiteboard", name: "Whiteboard", category: "media", icon: Presentation, keywords: ["whiteboard", "sketch", "draw", "diagram", "excalidraw", "hand-drawn", "canvas", "wireframe"], isNew: true, description: "Sketch hand-drawn diagrams and wireframes on an infinite canvas, and export PNG or SVG.", component: () => import("./media/Whiteboard.vue") },

    // CSS
    { id: "box-shadow", name: "Box Shadow", category: "css", icon: Square, keywords: ["css", "shadow", "elevation"], description: "Design layered CSS box shadows visually and copy the CSS or Tailwind class.", component: () => import("./css/BoxShadow.vue") },
    { id: "gradient-generator", name: "Gradient Generator", category: "css", icon: Blend, keywords: ["css", "linear", "radial", "conic"], description: "Build linear, radial and conic CSS gradients with multiple stops.", component: () => import("./css/GradientGenerator.vue") },
    { id: "px-rem", name: "px ↔ rem", category: "css", icon: Scaling, keywords: ["css", "units", "em", "rem", "px"], description: "Convert between px, rem, em and pt with a custom root font size.", component: () => import("./css/PxRem.vue") },
    { id: "aspect-ratio", name: "Aspect Ratio", category: "css", icon: Ratio, keywords: ["resolution", "16:9", "width", "height"], description: "Calculate aspect ratios and scale dimensions while keeping proportions.", component: () => import("./css/AspectRatio.vue") },
    { id: "cubic-bezier", name: "Cubic Bezier Editor", category: "css", icon: Spline, keywords: ["easing", "bezier", "transition", "animation", "timing function"], description: "Drag a cubic-bezier easing curve, preview the motion and copy the CSS.", component: () => import("./css/CubicBezier.vue") },
    { id: "layout-playground", name: "Flexbox & Grid Playground", category: "css", icon: LayoutGrid, keywords: ["flex", "flexbox", "grid", "layout", "justify", "align"], description: "Experiment with flexbox and CSS grid properties visually and copy the CSS.", component: () => import("./css/LayoutPlayground.vue") },
    { id: "border-radius", name: "Border Radius Generator", category: "css", icon: Squircle, keywords: ["rounded", "corners", "blob", "shape", "radius"], description: "Shape corners or organic blobs with border-radius and copy the CSS or Tailwind class.", component: () => import("./css/BorderRadius.vue") },
    { id: "theme-generator", name: "Tailwind & shadcn Theme Generator", category: "css", icon: SwatchBook, keywords: ["tailwind", "shadcn", "theme", "oklch", "color scale", "design tokens", "dark mode"], description: "Generate a Tailwind color scale and shadcn/ui light and dark theme from one brand color.", component: () => import("./css/ThemeGenerator.vue") },

    // Network
    { id: "cidr-calculator", name: "IP / CIDR Calculator", category: "network", icon: Network, keywords: ["subnet", "ipv4", "mask", "network"], description: "Get the network, broadcast, host range and masks for an IPv4 block.", component: () => import("./network/CidrCalculator.vue") },
    { id: "http-status-codes", name: "HTTP Status Codes", category: "network", icon: Server, keywords: ["http", "404", "500", "status"], description: "Searchable reference of HTTP status codes and what they mean.", component: () => import("./network/HttpStatusCodes.vue") },
    { id: "user-agent-parser", name: "User Agent Parser", category: "network", icon: MonitorSmartphone, keywords: ["ua", "browser", "os", "device", "bot", "user-agent"], description: "Parse a User-Agent string into browser, engine, OS and device, and spot bots.", component: () => import("./network/UserAgentParser.vue") },
    { id: "http-request", name: "HTTP Request Builder", category: "network", icon: Send, keywords: ["api", "rest", "fetch", "postman", "request", "client", "curl"], description: "Send HTTP requests from your browser and inspect status, headers and body.", component: () => import("./network/HttpRequest.vue") },
    { id: "server-block-generator", name: "Server Block Generator", category: "network", icon: ServerCog, keywords: ["nginx", "apache", "caddy", "vhost", "virtual host", "server block", "reverse proxy", "caddyfile", "ssl", "config"], description: "Generate Nginx server blocks, Apache virtual hosts and Caddyfiles for static sites, PHP apps and reverse proxies.", component: () => import("./network/ServerBlockGenerator.vue") },
    { id: "whois-lookup", name: "WHOIS Lookup", category: "network", icon: GlobeLock, keywords: ["whois", "rdap", "domain", "registrar", "expiry", "ip", "asn", "nameservers"], isNew: true, description: "Look up a domain, IP or ASN via RDAP: registrar, dates, status and nameservers.", component: () => import("./network/WhoisLookup.vue") },
    { id: "subdomain-explorer", name: "Subdomain Explorer", category: "network", icon: Radar, keywords: ["subdomain", "enumeration", "certificate transparency", "crt.sh", "recon", "dns"], isNew: true, description: "Find a domain's subdomains from Certificate Transparency logs and check which resolve.", component: () => import("./network/SubdomainExplorer.vue") },
    { id: "domain-finder", name: "Domain Name Finder", category: "network", icon: SearchCheck, keywords: ["domain", "domain name", "availability", "available", "register", "registrar", "tld", "name ideas", "brand", "whois", "rdap"], isNew: true, description: "Find a domain name: check availability across TLDs, get prefix and suffix ideas, and see who holds taken names.", component: () => import("./network/DomainFinder.vue") },
    { id: "dns-lookup", name: "DNS Lookup", category: "network", icon: SearchCode, keywords: ["dns", "nslookup", "dig", "mx", "txt", "spf", "dmarc", "ptr", "reverse dns", "doh"], isNew: true, description: "Query A, MX, TXT, NS and other DNS records over HTTPS, with reverse lookup and SPF/DMARC checks.", component: () => import("./network/DnsLookup.vue") },

    // AI
    { id: "general-chat", name: "General Chat", category: "ai", icon: MessagesSquare, keywords: ["chat", "llm", "ai", "assistant", "webllm", "local model", "offline", "qwen", "llama", "phi", "gemma"], description: "Chat privately with an open-source model that runs in your browser. Download any WebLLM model or add your own.", component: () => import("./ai/GeneralChat.vue") },
    { id: "pii-redactor", name: "Secret & PII Redactor", category: "ai", icon: EyeOff, keywords: ["redact", "mask", "api key", "email", "privacy"], description: "Mask API keys, tokens, emails and other personal data before pasting into an AI chat.", component: () => import("./ai/PiiRedactor.vue") },
    { id: "token-counter", name: "Token Counter", category: "ai", icon: Coins, keywords: ["gpt", "claude", "tokens", "context", "llm", "cost", "price", "pricing"], description: "Count GPT tokens exactly, estimate others, check context usage and estimate API cost.", component: () => import("./ai/TokenCounter.vue") },
    { id: "ai-text-cleaner", name: "AI Text Cleaner", category: "ai", icon: Sparkles, keywords: ["clean", "invisible", "quotes", "markdown"], description: "Remove hidden characters, citation markers and Markdown from AI-written text.", component: () => import("./ai/AiTextCleaner.vue") },
    { id: "prompt-template", name: "Prompt Template Builder", category: "ai", icon: MessageSquareText, keywords: ["prompt", "template", "variables", "placeholders", "llm"], description: "Write prompts with {{variables}}, fill them in and export as text or code.", component: () => import("./ai/PromptTemplate.vue") },
    { id: "text-chunker", name: "RAG Text Chunker", category: "ai", icon: Scissors, keywords: ["rag", "chunk", "overlap", "split", "embedding", "tokens"], description: "Split text into chunks by tokens, words or characters with overlap, and see every boundary.", component: () => import("./ai/TextChunker.vue") },
    { id: "jsonl-validator", name: "JSONL Validator", category: "ai", icon: ListChecks, keywords: ["jsonl", "ndjson", "fine-tune", "fine tuning", "batch", "dataset"], description: "Validate JSONL line by line for fine-tuning datasets and batch request files.", component: () => import("./ai/JsonlValidator.vue") },

    // Productivity
    { id: "pomodoro-timer", name: "Pomodoro Timer", category: "productivity", icon: Timer, keywords: ["pomodoro", "focus", "timer", "break", "tomato", "deep work"], description: "Work in focused sessions with short and long breaks, alerts and a daily tally.", component: () => import("./productivity/Pomodoro.vue") },
    { id: "reminders", name: "Alarms & Reminders", category: "productivity", icon: AlarmClock, keywords: ["alarm", "alert", "reminder", "countdown", "timer", "notification"], description: "Set countdown timers and alarms that alert you with a sound and a desktop notification.", component: () => import("./productivity/Reminders.vue") },
    { id: "break-reminder", name: "Break Reminder", category: "productivity", icon: Coffee, keywords: ["20-20-20", "eye strain", "water", "hydrate", "stretch", "posture", "health"], description: "Get nudged to rest your eyes, drink water and stretch at intervals you choose.", component: () => import("./productivity/BreakReminder.vue") },
    { id: "todo-list", name: "To-Do List", category: "productivity", icon: ListTodo, keywords: ["todo", "tasks", "checklist", "list", "priority"], description: "Keep a quick task list with priorities and due dates, saved in your browser.", component: () => import("./productivity/TodoList.vue") },
    { id: "typing-speed-test", name: "Typing Speed Test", category: "productivity", icon: Keyboard, keywords: ["typing", "wpm", "speed", "accuracy", "keyboard", "practice"], isNew: true, description: "Measure your typing speed and accuracy in WPM with words, quotes or code.", component: () => import("./productivity/TypingTest.vue") },

    // Utilities
    { id: "unit-converter", name: "Unit Converter", category: "utilities", icon: Ruler, keywords: ["length", "weight", "temperature", "data", "bytes"], description: "Convert length, weight, temperature, area, speed and data units.", component: () => import("./utilities/UnitConverter.vue") },
    { id: "chmod-calculator", name: "chmod Calculator", category: "utilities", icon: SquareTerminal, keywords: ["permissions", "unix", "octal", "rwx"], description: "Set file permissions with checkboxes, octal or rwx text and get the chmod command.", component: () => import("./utilities/ChmodCalculator.vue") },
    { id: "checksum", name: "Checksum", category: "utilities", icon: CheckCheck, keywords: ["crc32", "crc16", "luhn", "adler"], description: "Calculate CRC-32, CRC-16 and Adler-32 checksums and validate Luhn numbers.", component: () => import("./utilities/Checksum.vue") },
    { id: "programmer-calculator", name: "Programmer Calculator", category: "utilities", icon: Calculator, keywords: ["bitwise", "binary", "hex", "shift", "two's complement", "and", "or", "xor"], description: "Bitwise operations, shifts and two's complement on 8 to 64-bit integers, with a clickable bit grid.", component: () => import("./utilities/ProgrammerCalculator.vue") },
    { id: "periodic-table", name: "Interactive Periodic Table", category: "utilities", icon: FlaskConical, keywords: ["periodic table", "elements", "chemistry", "atomic mass", "electron configuration", "science"], isNew: true, description: "Explore all 118 elements by category, state and properties, with electron shells.", component: () => import("./utilities/PeriodicTable.vue") },
    { id: "decision-wheel", name: "Decision Wheel & Picker", category: "utilities", icon: FerrisWheel, keywords: ["wheel", "spin", "random picker", "raffle", "coin flip", "dice", "teams", "decide"], isNew: true, description: "Spin a wheel, pick random items, flip coins, roll dice or split a list into teams.", component: () => import("./utilities/DecisionWheel.vue") },
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
