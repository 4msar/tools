<script setup lang="ts">
import { computed, ref } from "vue";
import { Moon, Shuffle, Sun } from "lucide-vue-next";
import { Btn, CopyButton, Field, Panel, Tabs, ToolPage } from "@/components/ui";
import { copyText } from "@/composables/useClipboard";

const brand = ref("#6366f1");
const name = ref("brand");
const radius = ref(0.625);
const tint = ref(true);
const dark = ref(false);
const tab = ref<"shadcn" | "tailwind" | "hex">("shadcn");

// ---- OKLCH <-> sRGB ----
type LCH = [number, number, number];
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
function hexToOklch(hex: string): LCH {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return [0.6, 0.2, 277];
    const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(m[1].slice(i, i + 2), 16) / 255));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const s = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const t = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * s - 0.0040720468 * t;
    const A = 1.9779984951 * l - 2.428592205 * s + 0.4505937099 * t;
    const B = 0.0259040371 * l + 0.7827717662 * s - 0.808675766 * t;
    return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}
function oklchToRgb([L, C, H]: LCH): [number, number, number] {
    const a = C * Math.cos((H * Math.PI) / 180);
    const b = C * Math.sin((H * Math.PI) / 180);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const s = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const t = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * s + 0.2309699292 * t, -1.2684380046 * l + 2.6097574011 * s - 0.3413193965 * t, -0.0041960863 * l - 0.7034186147 * s + 1.707614701 * t];
}
const inGamut = (rgb: number[]) => rgb.every((c) => c >= -0.0005 && c <= 1.0005);
// Reduce chroma until the color fits in sRGB, keeping lightness and hue.
function fit(c: LCH): LCH {
    if (inGamut(oklchToRgb(c))) return c;
    let lo = 0, hi = c[1];
    for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        if (inGamut(oklchToRgb([c[0], mid, c[2]]))) lo = mid;
        else hi = mid;
    }
    return [c[0], lo, c[2]];
}
const toHex = (c: LCH) => "#" + oklchToRgb(fit(c)).map((v) => Math.round(Math.min(1, Math.max(0, gam(v))) * 255).toString(16).padStart(2, "0")).join("");
const n = (v: number, d = 3) => Number(v.toFixed(d));
const css = (c: LCH) => {
    const f = fit(c);
    return `oklch(${n(f[0])} ${n(f[1])} ${n(f[1] < 0.002 ? 0 : f[2], 1)})`;
};

// ---- scale ----
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const LIGHT = [0.975, 0.94, 0.885, 0.815, 0.72, 0.63, 0.545, 0.47, 0.395, 0.33, 0.25];
const CHROMA = [0.1, 0.22, 0.42, 0.68, 0.9, 1, 1, 0.9, 0.76, 0.62, 0.48];
const base = computed(() => hexToOklch(brand.value));
const scale = computed(() => {
    const [, C, H] = base.value;
    const peak = Math.max(C, 0.04);
    return STEPS.map((step, i) => {
        const c: LCH = fit([LIGHT[i], peak * CHROMA[i], H]);
        return { step, lch: c, hex: toHex(c), css: css(c) };
    });
});
const s = (step: number) => scale.value[STEPS.indexOf(step)].lch;

// ---- shadcn tokens ----
const neutral = (L: number, C = 0.012): LCH => [L, tint.value ? C : 0, base.value[2]];
const onBrand = (c: LCH): LCH => (c[0] > 0.68 ? neutral(0.2, 0.02) : [0.985, 0, 0]);
const tokens = computed(() => {
    const pL = s(600), pD = s(400);
    const destructive: LCH = [0.577, 0.245, 27.3];
    const light: Record<string, LCH> = {
        background: [1, 0, 0], foreground: neutral(0.145, 0.015),
        card: [1, 0, 0], "card-foreground": neutral(0.145, 0.015),
        popover: [1, 0, 0], "popover-foreground": neutral(0.145, 0.015),
        primary: pL, "primary-foreground": onBrand(pL),
        secondary: neutral(0.965), "secondary-foreground": neutral(0.205, 0.015),
        muted: neutral(0.965), "muted-foreground": neutral(0.55, 0.02),
        accent: s(100), "accent-foreground": s(900),
        destructive, border: neutral(0.92), input: neutral(0.92), ring: s(500),
    };
    const darkT: Record<string, LCH> = {
        background: neutral(0.145, 0.015), foreground: neutral(0.985, 0.003),
        card: neutral(0.2, 0.017), "card-foreground": neutral(0.985, 0.003),
        popover: neutral(0.2, 0.017), "popover-foreground": neutral(0.985, 0.003),
        primary: pD, "primary-foreground": onBrand(pD),
        secondary: neutral(0.27, 0.018), "secondary-foreground": neutral(0.985, 0.003),
        muted: neutral(0.27, 0.018), "muted-foreground": neutral(0.71, 0.02),
        accent: s(900), "accent-foreground": s(100),
        destructive: [0.704, 0.191, 22.2], border: neutral(0.3, 0.018), input: neutral(0.33, 0.018), ring: s(400),
    };
    return { light, dark: darkT };
});

const slug = computed(() => name.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "brand");
const outputs = computed(() => {
    const block = (t: Record<string, LCH>) => Object.entries(t).map(([k, v]) => `  --${k}: ${css(v)};`).join("\n");
    return {
        shadcn: `:root {\n  --radius: ${radius.value}rem;\n${block(tokens.value.light)}\n}\n\n.dark {\n${block(tokens.value.dark)}\n}`,
        tailwind: `@theme {\n${scale.value.map((x) => `  --color-${slug.value}-${x.step}: ${x.css};`).join("\n")}\n}`,
        hex: JSON.stringify({ [slug.value]: Object.fromEntries(scale.value.map((x) => [x.step, x.hex])) }, null, 2),
    };
});

// Inline custom properties for the live preview.
const previewVars = computed(() => {
    const t = dark.value ? tokens.value.dark : tokens.value.light;
    return { ...Object.fromEntries(Object.entries(t).map(([k, v]) => [`--p-${k}`, toHex(v)])), "--p-radius": radius.value + "rem" };
});

function random() {
    brand.value = toHex([0.6, 0.12 + Math.random() * 0.12, Math.random() * 360]);
}
const lumText = (c: LCH) => (c[0] > 0.66 ? "#000" : "#fff");
</script>

<template>
    <ToolPage>
        <Panel>
            <div class="flex flex-wrap items-end gap-4">
                <Field label="Brand color">
                    <div class="flex gap-2">
                        <input v-model="brand" type="color" class="h-[38px] w-12 cursor-pointer rounded-md border border-line bg-surface" aria-label="Pick brand color" />
                        <input v-model="brand" class="input !w-28 font-mono" spellcheck="false" maxlength="7" aria-label="Brand color hex" />
                        <Btn aria-label="Random color" @click="random"><Shuffle /></Btn>
                    </div>
                </Field>
                <Field label="Scale name"><input v-model="name" class="input !w-32 font-mono" spellcheck="false" /></Field>
                <Field :label="`Radius: ${radius}rem`" class="w-44"><input v-model.number="radius" type="range" min="0" max="1.5" step="0.125" class="range" /></Field>
                <label class="flex items-center gap-2 pb-2.5 text-sm"><input v-model="tint" type="checkbox" class="checkbox" /> Tint neutrals with the brand hue</label>
            </div>
        </Panel>

        <Panel :title="`${slug} scale`">
            <div class="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-11">
                <button v-for="x in scale" :key="x.step" type="button" class="flex h-20 cursor-pointer flex-col justify-end rounded-lg p-2 text-left ring-line transition-transform hover:scale-[1.03]" :style="{ background: x.hex, color: lumText(x.lch) }" :title="`Copy ${x.hex}`" @click="copyText(x.hex)">
                    <span class="text-xs font-semibold">{{ x.step }}</span><span class="font-mono text-[10px] opacity-80">{{ x.hex }}</span>
                </button>
            </div>
        </Panel>

        <div class="grid gap-4 lg:grid-cols-2">
            <Panel title="Preview">
                <template #actions><Btn size="sm" variant="ghost" @click="dark = !dark"><component :is="dark ? Sun : Moon" /> {{ dark ? "Light" : "Dark" }}</Btn></template>
                <div :style="previewVars" class="pv rounded-xl p-5">
                    <div class="pv-card">
                        <div class="flex items-center justify-between gap-2">
                            <div><div class="text-base font-semibold">Team plan</div><div class="pv-muted text-sm">Billed monthly, cancel any time.</div></div>
                            <span class="pv-badge">New</span>
                        </div>
                        <div class="mt-4 text-3xl font-semibold">$24 <span class="pv-muted text-sm font-normal">/ seat</span></div>
                        <input class="pv-input mt-4" placeholder="you@company.com" aria-label="Sample input" />
                        <div class="mt-3 flex flex-wrap gap-2">
                            <button type="button" class="pv-btn pv-primary">Upgrade</button>
                            <button type="button" class="pv-btn pv-secondary">Compare</button>
                            <button type="button" class="pv-btn pv-outline">Details</button>
                            <button type="button" class="pv-btn pv-destructive">Cancel</button>
                        </div>
                        <div class="pv-accent mt-4 text-sm">Accent surface for hovered and selected items.</div>
                    </div>
                </div>
            </Panel>

            <Panel title="Code" flush>
                <template #actions>
                    <Tabs v-model="tab" size="sm" :options="[{ value: 'shadcn', label: 'shadcn/ui' }, { value: 'tailwind', label: 'Tailwind v4' }, { value: 'hex', label: 'JSON (hex)' }]" />
                    <CopyButton :text="outputs[tab]" />
                </template>
                <pre class="max-h-[26rem] overflow-auto p-4 font-mono text-xs leading-relaxed">{{ outputs[tab] }}</pre>
            </Panel>
        </div>
        <p class="text-xs text-muted">Colors are generated in OKLCH and chroma is reduced where a shade would fall outside sRGB. Paste the shadcn/ui block into your global CSS, or the Tailwind block to get <code class="code">bg-{{ slug }}-500</code> utilities. Check text contrast before shipping.</p>
    </ToolPage>
</template>

<style scoped>
.pv { background: var(--p-background); color: var(--p-foreground); border: 1px solid var(--p-border); }
.pv-card { background: var(--p-card); color: var(--p-card-foreground); border: 1px solid var(--p-border); border-radius: var(--p-radius); padding: 1.25rem; }
.pv-muted { color: var(--p-muted-foreground); }
.pv-badge { background: var(--p-primary); color: var(--p-primary-foreground); border-radius: 999px; padding: 0.1rem 0.6rem; font-size: 0.75rem; font-weight: 600; }
.pv-input { width: 100%; background: transparent; border: 1px solid var(--p-input); border-radius: calc(var(--p-radius) - 2px); padding: 0.45rem 0.75rem; font-size: 0.875rem; color: inherit; }
.pv-input:focus { outline: 2px solid var(--p-ring); outline-offset: 1px; }
.pv-input::placeholder { color: var(--p-muted-foreground); }
.pv-btn { border-radius: calc(var(--p-radius) - 2px); padding: 0.45rem 0.9rem; font-size: 0.875rem; font-weight: 500; cursor: pointer; border: 1px solid transparent; }
.pv-btn:focus-visible { outline: 2px solid var(--p-ring); outline-offset: 2px; }
.pv-primary { background: var(--p-primary); color: var(--p-primary-foreground); }
.pv-secondary { background: var(--p-secondary); color: var(--p-secondary-foreground); }
.pv-outline { border-color: var(--p-border); color: var(--p-foreground); }
.pv-destructive { background: var(--p-destructive); color: #fff; }
.pv-accent { background: var(--p-accent); color: var(--p-accent-foreground); border-radius: calc(var(--p-radius) - 2px); padding: 0.6rem 0.8rem; }
</style>
