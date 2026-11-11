// Generates PWA icons and the Open Graph image from SVG sources.
// Run with: yarn generate:assets  (outputs are committed to public/)
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pub = (f) => fileURLToPath(new URL(`../public/${f}`, import.meta.url));
// msar.me design system: accent (light) / accent-fg, and dark-theme tokens for the share image.
const ACCENT = "#00776e";
const ACCENT_FG = "#f3fcfa";

// Lucide "wrench" (ISC license), a 24×24 stroke icon, the same one the app header uses.
const GLYPH =
    "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z";

/** Icon SVG. `pad` shrinks the glyph for maskable/apple icons; `round` keeps rounded corners. */
export const icon = ({ pad = 0, round = true } = {}) => {
    // Glyph box is 18/32 of the tile by default; padding shrinks it toward the center.
    const box = 18 * (1 - pad * 2);
    const scale = box / 24;
    const offset = (32 - box) / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${round ? 8 : 0}" fill="${ACCENT}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})"><path d="${GLYPH}" fill="none" stroke="${ACCENT_FG}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>
</svg>`;
};

async function png(svg, size, file) {
    await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(pub(file));
    console.log("✓", file);
}

writeFileSync(pub("favicon.svg"), icon() + "\n");
await png(icon(), 32, "favicon-32x32.png");
await png(icon(), 64, "pwa-64x64.png");
await png(icon(), 192, "pwa-192x192.png");
await png(icon(), 512, "pwa-512x512.png");
// Maskable: full-bleed background, glyph inside the 80% safe zone.
await png(icon({ pad: 0.12, round: false }), 512, "maskable-icon-512x512.png");
// Apple applies its own corner mask, so use a square, slightly padded icon.
await png(icon({ pad: 0.08, round: false }), 180, "apple-touch-icon.png");

// Open Graph / Twitter card image (1200×630).
const registry = readFileSync(fileURLToPath(new URL("../src/tools/registry.ts", import.meta.url)), "utf8");
const count = (registry.match(/\{ id: "[^"]+", name: "[^"]+", category: /g) || []).length;
const chips = ["JSON", "Regex", "Hash", "UUID", "JWT", "Cron", "Base64", "Diff", "Colors"];
let x = 80;
const chipSvg = chips
    .map((c) => {
        const w = c.length * 15 + 36;
        const s = `<g transform="translate(${x} 478)"><rect width="${w}" height="44" rx="6" fill="#0e1114" stroke="#25292f"/><text x="${w / 2}" y="29" text-anchor="middle" font-family="JetBrains Mono, Menlo, monospace" font-size="19" fill="#b3b8be">${c}</text></g>`;
        x += w + 12;
        return s;
    })
    .join("");

// No gradients (design-system rule): flat bg with the dot grid, a surface column ringed by `line`.
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#ffffff26"/></pattern>
  </defs>
  <rect width="1200" height="630" fill="#07080b"/>
  <rect width="1200" height="630" fill="url(#dots)"/>
  <rect x="40" y="40" width="1120" height="550" rx="16" fill="#0e1114" stroke="#25292f"/>
  <g transform="translate(80 80) scale(2)"><circle cx="16" cy="16" r="16" fill="${ACCENT}"/>${icon({ round: false }).replace(/<\/?svg[^>]*>/g, "").replace(/<rect[^>]*\/>/, "")}</g>
  <text x="160" y="125" font-family="Fraunces, Georgia, serif" font-size="36" font-weight="600" fill="#f1f4f6">DevTools</text>
  <text x="80" y="275" font-family="Fraunces, Georgia, serif" font-size="66" font-weight="600" fill="#34d4bf">Developer tools.</text>
  <text x="80" y="355" font-family="Fraunces, Georgia, serif" font-size="66" font-weight="600" fill="#f1f4f6">Right in your browser.</text>
  <text x="80" y="428" font-family="Sora, Helvetica, Arial, sans-serif" font-size="26" fill="#b3b8be">${count} free tools · private · works offline · tools.msar.me</text>
  ${chipSvg}
</svg>`;
writeFileSync(pub("og-image.svg"), og);
await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile(pub("og-image.png"));
console.log("✓ og-image.png");
