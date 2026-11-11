# DevTools

A collection of 54 free developer tools that run entirely in your browser: JSON, hashes, UUIDs, regex, cron, colors, encoders, AI helpers, and more. No sign-up and no server. Your data never leaves the tab.

**Live:** https://tools.msar.me

## Features

- **54 tools** in 10 categories, each lazy-loaded
- **Command palette**: press `⌘K` / `Ctrl+K` or `/` to search by name or keyword
- **Tabs**: every tool you open stays in a tab and keeps its input while you switch. Drag to reorder, middle-click or `Alt+W` to close, `Alt+Shift+←/→` to switch.
- **Favorites and recent tools** are stored locally
- **Light, dark and system themes** using the [msar.me design system](https://msar.me/ai/design-system.md): teal accent, Fraunces / Sora / JetBrains Mono, dotted page background
- Responsive layout with a collapsible sidebar on mobile
- **Installable PWA** that works fully offline after the first visit (every tool is precached)
- **SEO**: a prerendered page and a generated share image for each tool, with its own title, description, canonical URL, Open Graph/Twitter tags and JSON-LD. The build also writes `sitemap.xml` (with image entries), `robots.txt`, `opensearch.xml` (search tools from the browser address bar), `llms.txt` and a `noindex` 404 page

## Tools

### Development

- **JSON Formatter**: Format, minify, sort and validate JSON, and convert it to YAML.
- **Regex Tester**: Test a regular expression live with highlighted matches, capture groups and replace.
- **JSON to Code**: Generate TypeScript, Go, Python or JSON Schema types from a JSON sample.
- **JSON Schema Validator**: Validate JSON against a JSON Schema as you type, with paths to each error.
- **JSON Diff**: Compare two JSON documents by value and list every added, removed and changed path.
- **HTML Preview**: Render HTML in a sandboxed frame that cannot reach the network.
- **Code Playground**: Experiment with HTML, CSS and JavaScript with a live preview and console.
- **Code Formatter**: Beautify HTML, CSS, JavaScript, TypeScript, Markdown, YAML and SQL.
- **Semver Calculator**: Check versions against npm ranges, compare versions and bump them.
- **XML Inspector**: Format or minify XML and query nodes with XPath.

### Generators

- **Hash Generator**: MD5, SHA-1, SHA-2 and SHA-3 hashes and HMAC for text and files.
- **UUID Generator**: Generate v1, v4 and v7 UUIDs and ULIDs in bulk, and inspect existing IDs.
- **Password Generator**: Create strong passwords with custom length, character sets and a strength meter.
- **Lorem Ipsum**: Generate placeholder paragraphs, sentences, words and fake data.
- **QR Code Generator**: Make QR codes for text, URLs, Wi-Fi and contacts, and save as PNG or SVG.
- **Bcrypt Generator**: Generate bcrypt hashes and verify a password against a hash.
- **Random String**: Generate Nano IDs, hex and Base64URL tokens, and strings from a custom alphabet.

### Converters

- **Base64**: Encode and decode Base64 text and files, with a URL-safe mode.
- **Case Converter**: Convert names to camelCase, snake_case, kebab-case and more, and make slugs.
- **Number Base**: Convert numbers between binary, octal, decimal, hex, any base and Roman numerals.
- **Markdown Preview**: Live GitHub-flavored Markdown preview and sanitized HTML output.
- **URL Encoder**: Encode and decode URLs, and parse a URL into parts and query parameters.
- **CSV ↔ JSON**: Convert CSV to JSON and back with custom delimiters and a table preview.
- **Config Converter**: Convert between JSON, YAML, TOML and .env files.
- **Escape Tools**: Escape and unescape HTML entities, JSON strings and Unicode, and convert Punycode.
- **HTML to JSX**: Convert HTML markup into valid React JSX.
- **Compression**: Compress and decompress GZIP, zlib and raw deflate data as Base64 or hex.
- **cURL to Code**: Convert a cURL command to fetch, Node, Python, Go or PHP code.

### Text

- **Text Compare**: Line, word and character diffs that can ignore whitespace and case.
- **JWT Decoder**: Decode JWTs, check expiry and verify HMAC signatures.
- **String Inspector**: Count characters, words, lines and bytes, and find hidden Unicode characters.
- **Line Tools**: Sort, dedupe, trim, reverse, shuffle and filter lines.

### Time & Date

- **Timestamp Converter**: Convert Unix timestamps and date strings in seconds, milliseconds and more.
- **Date Difference**: Calculate the time between two dates, or add and subtract durations.
- **Cron Calculator**: Explain cron expressions in plain English and list the next runs.
- **Time Zone Converter**: Convert a date and time between time zones, with DST handled.
- **Stopwatch**: Record laps and split times and export them as CSV.

### Media & Color

- **Color Palette Generator**: Generate color palettes with harmony rules, accessibility checks and exports.
- **Random Color Generator**: Generate random colors in HEX, RGB and HSL with a single click.
- **Color Converter**: Convert any CSS color to HEX, RGB, HSL, HWB and OKLCH, and check WCAG contrast.
- **QR Reader**: Read a QR code from an uploaded, dropped or pasted image.
- **Image Converter**: Resize, compress and convert images to JPEG, PNG or WebP in your browser.

### CSS

- **Box Shadow**: Design layered CSS box shadows visually and copy the CSS or Tailwind class.
- **Gradient Generator**: Build linear, radial and conic CSS gradients with multiple stops.
- **px ↔ rem**: Convert between px, rem, em and pt with a custom root font size.
- **Aspect Ratio**: Calculate aspect ratios and scale dimensions while keeping proportions.

### Network

- **IP / CIDR Calculator**: Get the network, broadcast, host range and masks for an IPv4 block.
- **HTTP Status Codes**: Searchable reference of HTTP status codes and what they mean.

### AI

- **Secret & PII Redactor**: Mask API keys, tokens, emails and other personal data before pasting into an AI chat.
- **Token Counter**: Count GPT tokens exactly, estimate others, and check context window usage.
- **AI Text Cleaner**: Remove hidden characters, citation markers and Markdown from AI-written text.

### Utilities

- **Unit Converter**: Convert length, weight, temperature, area, speed and data units.
- **chmod Calculator**: Set file permissions with checkboxes, octal or rwx text and get the chmod command.
- **Checksum**: Calculate CRC-32, CRC-16 and Adler-32 checksums and validate Luhn numbers.

See [PLAN.md](PLAN.md) for the roadmap, including the Phase 2 tools.

## Development

Requires Node 22+ and Yarn 4 (`corepack enable`).

```bash
yarn install
yarn dev
yarn build
```

### Adding a tool

1. Create `src/tools/<category>/<Name>.vue` and wrap it in `<ToolPage>` from `@/components/ui`.
2. Register it in `src/tools/registry.ts`. Routing, the sidebar, search and the home page update automatically.
3. Use only the design-system tokens (`bg-surface`, `text-fg-muted`, `text-fg-subtle`, `border-line`, `text-accent`, `bg-inverse`, …) so both themes work. Use `accent` sparingly; primary buttons are `inverse`, never teal.
4. If the tool adds a global listener (paste, keydown), use `useActiveEventListener` so it pauses while the tool sits in a background tab.

### SEO & PWA files

- `src/site.ts` holds the site URL, title and description, shared by the app and the build.
- `plugins/seo.ts` writes `<tool-id>.html`, `og/<tool-id>.png`, `sitemap.xml`, `robots.txt`, `opensearch.xml`, `llms.txt` and `404.html` from the tool registry.
- `vite.config.ts` holds the PWA manifest and service worker settings (`vite-plugin-pwa`).
- `yarn generate:assets` regenerates the icons and `og-image.png` in `public/`. Run it after changing the logo or the tool count.

### Tech stack

Vue 3 · TypeScript · Vite 8 · Vue Router 5 · Tailwind CSS 4 · VueUse · Lucide icons

## Deployment

Pushes to `main` build and deploy to GitHub Pages through GitHub Actions (`.github/workflows/deploy.yml`). Every tool has its own HTML file, so deep links return 200. Unknown paths get the `noindex` 404 page, which boots the app and redirects home.
