# DevTools Upgrade Plan

This repo stays **Vue 3 + Vite + Tailwind 4**, a static site on GitHub Pages. Every tool runs in the browser and makes no network calls.

## 1. Platform upgrade
- Upgrade all dependencies to their latest versions (Vue, Vite, vue-router, TypeScript, vue-tsc, Tailwind).
- Pin Yarn 4 (`packageManager`, `.yarnrc.yml` with `nodeLinker: node-modules`). The lockfile is already in Yarn 4 format, but CI still runs Yarn 1 with `--frozen-lockfile`.
- CI: Node 22, `corepack enable`, `yarn install --immutable`.

## 2. New UI shell
- App layout: a sidebar with categories and a filter, plus a top bar with breadcrumb, a ⌘K command palette, and a light/dark/system theme toggle.
- Home: compact hero, favorites, recent tools, and a category grid with search.
- Favorites and recents are stored in localStorage.
- One tool registry (`src/tools/registry.ts`) drives the router (lazy-loaded routes), the sidebar, search, and home.
- Shared UI kit: `ToolPage`, `Panel`, `CodeArea`, `CopyButton`, `Btn`, `Tabs`, `Field`.
- Inter for the UI and JetBrains Mono for code, using semantic color tokens with dark mode.
- Existing tools are restyled onto the new kit.

## 3. Tools: Phase 1 (this update)
| Category | Tools |
|---|---|
| Development | JSON Formatter*, Regex Tester, JSON to Code, JSON Schema Validator, JSON Diff, HTML Preview, Code Playground, Code Formatter, Semver Calculator, XML Inspector |
| Generators | Hash, UUID/ULID, Password*, Lorem Ipsum, QR Generator, Bcrypt, Random String |
| Converters | Base64, Case Converter, Number Base, Markdown Preview, URL Encoder/Parser, CSV ↔ JSON, Config Converter (JSON/YAML/TOML/.env), Escape Tools, HTML to JSX, Compression (gzip/deflate), cURL to Code |
| Network | IP / CIDR Calculator |
| Time & Date | Timestamp, Date Difference, Cron Calculator, Time Zone Converter, Stopwatch |
| Media | Color Palette*, Random Color*, Color Converter + WCAG contrast, QR Reader, Image Converter (canvas) |
| Text | Text Compare, JWT Decoder, String Inspector, Line Tools |
| AI | Secret & PII Redactor, Token Counter, AI Text Cleaner |
| Utilities | Unit Converter, chmod Calculator, Checksum (CRC / Luhn) |
| **Extras** | CSS Box Shadow, CSS Gradient, px ↔ rem, Aspect Ratio, HTTP Status Codes |

\* = existing tool, restyled

## 4. Tools: Phase 2 (later)
These need heavy libraries or a lot of custom parsing: Mermaid Renderer, DB Diagram, X.509 Certificate Decoder, ASN.1 Inspector, Key Pair Generator, HAR Viewer, Email Reader (.eml/.msg), Email Header Analyzer, PHP serialize Tools, SVG to CSS (SVGO), Date Format Translator, Image/Video Metadata Cleaner, API Formatter.

## 5. Verification
`yarn build` (vue-tsc + vite), then click through the dev server: every route renders, search and palette work, dark mode works, and the layout holds at mobile width.
