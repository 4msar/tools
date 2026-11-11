<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { Download, RefreshCw } from "lucide-vue-next";
import { Btn, CopyButton, Field, Panel, ToolPage } from "@/components/ui";
import { copyText } from "@/composables/useClipboard";

interface Color {
    hex: string;
    rgb: string;
    hsl: string;
}

const baseColor = ref("#3B82F6");
const paletteType = ref("monochromatic");
const palette = ref<Color[]>([]);

const currentGradient = computed(() => {
    if (palette.value.length === 0) {
        return `linear-gradient(135deg, ${baseColor.value}, ${adjustBrightness(
            baseColor.value,
            0.3
        )})`;
    }

    const colors = palette.value.map((color) => color.hex).join(", ");
    return `linear-gradient(135deg, ${colors})`;
});

// Color utility functions
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
          }
        : null;
}

function rgbToHex(r: number, g: number, b: number): string {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
    const rgb = hexToRgb(hex);
    if (!rgb) return { h: 0, s: 0, l: 0 };

    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0,
        s = 0,
        l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
    };
}

function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0,
        g = 0,
        b = 0;

    if (0 <= h && h < 60) {
        r = c;
        g = x;
        b = 0;
    } else if (60 <= h && h < 120) {
        r = x;
        g = c;
        b = 0;
    } else if (120 <= h && h < 180) {
        r = 0;
        g = c;
        b = x;
    } else if (180 <= h && h < 240) {
        r = 0;
        g = x;
        b = c;
    } else if (240 <= h && h < 300) {
        r = x;
        g = 0;
        b = c;
    } else if (300 <= h && h < 360) {
        r = c;
        g = 0;
        b = x;
    }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return rgbToHex(r, g, b);
}

function adjustBrightness(hex: string, factor: number): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;

    const r = Math.min(255, Math.max(0, Math.round(rgb.r * (1 + factor))));
    const g = Math.min(255, Math.max(0, Math.round(rgb.g * (1 + factor))));
    const b = Math.min(255, Math.max(0, Math.round(rgb.b * (1 + factor))));

    return rgbToHex(r, g, b);
}

function createColor(hex: string): Color {
    const rgb = hexToRgb(hex);
    const hsl = hexToHsl(hex);

    return {
        hex,
        rgb: rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : "",
        hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
    };
}

// Palette generation functions
function generateMonochromatic(): Color[] {
    const colors: Color[] = [];
    const hsl = hexToHsl(baseColor.value);

    for (let i = 0; i < 5; i++) {
        const lightness = Math.max(10, Math.min(90, hsl.l + (i - 2) * 20));
        const hex = hslToHex(hsl.h, hsl.s, lightness);
        colors.push(createColor(hex));
    }

    return colors;
}

function generateAnalogous(): Color[] {
    const colors: Color[] = [];
    const hsl = hexToHsl(baseColor.value);

    for (let i = -2; i <= 2; i++) {
        const hue = (hsl.h + i * 30 + 360) % 360;
        const hex = hslToHex(hue, hsl.s, hsl.l);
        colors.push(createColor(hex));
    }

    return colors;
}

function generateComplementary(): Color[] {
    const colors: Color[] = [];
    const hsl = hexToHsl(baseColor.value);

    colors.push(createColor(baseColor.value));

    const complementaryHue = (hsl.h + 180) % 360;
    colors.push(createColor(hslToHex(complementaryHue, hsl.s, hsl.l)));

    // Add variations
    colors.push(createColor(hslToHex(hsl.h, hsl.s, Math.max(10, hsl.l - 20))));
    colors.push(
        createColor(hslToHex(complementaryHue, hsl.s, Math.max(10, hsl.l - 20)))
    );
    colors.push(createColor(hslToHex(hsl.h, Math.max(10, hsl.s - 20), hsl.l)));

    return colors;
}

function generateTriadic(): Color[] {
    const colors: Color[] = [];
    const hsl = hexToHsl(baseColor.value);

    for (let i = 0; i < 3; i++) {
        const hue = (hsl.h + i * 120) % 360;
        colors.push(createColor(hslToHex(hue, hsl.s, hsl.l)));
    }

    // Add lighter variations
    for (let i = 0; i < 2; i++) {
        const hue = (hsl.h + i * 120) % 360;
        colors.push(
            createColor(hslToHex(hue, hsl.s, Math.min(90, hsl.l + 20)))
        );
    }

    return colors;
}

function generateTetradic(): Color[] {
    const colors: Color[] = [];
    const hsl = hexToHsl(baseColor.value);

    for (let i = 0; i < 4; i++) {
        const hue = (hsl.h + i * 90) % 360;
        colors.push(createColor(hslToHex(hue, hsl.s, hsl.l)));
    }

    return colors;
}

function generateSplitComplementary(): Color[] {
    const colors: Color[] = [];
    const hsl = hexToHsl(baseColor.value);

    colors.push(createColor(baseColor.value));

    const complementary = hsl.h + 180;
    colors.push(
        createColor(hslToHex((complementary - 30 + 360) % 360, hsl.s, hsl.l))
    );
    colors.push(
        createColor(hslToHex((complementary + 30) % 360, hsl.s, hsl.l))
    );

    // Add variations
    colors.push(createColor(hslToHex(hsl.h, hsl.s, Math.max(10, hsl.l - 30))));
    colors.push(createColor(hslToHex(hsl.h, Math.max(10, hsl.s - 30), hsl.l)));

    return colors;
}

function generatePalette(notify = true) {
    switch (paletteType.value) {
        case "monochromatic":
            palette.value = generateMonochromatic();
            break;
        case "analogous":
            palette.value = generateAnalogous();
            break;
        case "complementary":
            palette.value = generateComplementary();
            break;
        case "triadic":
            palette.value = generateTriadic();
            break;
        case "tetradic":
            palette.value = generateTetradic();
            break;
        case "splitComplementary":
            palette.value = generateSplitComplementary();
            break;
    }

    if (notify) toast.success("Palette generated");
}


const cssExport = computed(() => `:root {\n${palette.value.map((color, index) => `  --color-${index + 1}: ${color.hex};`).join("\n")}\n}`);
const jsonExport = computed(() => JSON.stringify({ baseColor: baseColor.value, paletteType: paletteType.value, colors: palette.value }, null, 2));

function exportAsCSS() {
    copyText(cssExport.value, "CSS variables copied");
}

function exportAsJSON() {
    copyText(jsonExport.value, "JSON palette copied");
}

let timer: ReturnType<typeof setTimeout> | undefined;
watch(
    [baseColor, paletteType],
    () => {
        clearTimeout(timer);
        timer = setTimeout(() => generatePalette(false), 300);
    },
    { immediate: true },
);
onBeforeUnmount(() => clearTimeout(timer));

const typeOptions = [
    { value: "monochromatic", label: "Monochromatic" },
    { value: "analogous", label: "Analogous" },
    { value: "complementary", label: "Complementary" },
    { value: "triadic", label: "Triadic" },
    { value: "tetradic", label: "Tetradic" },
    { value: "splitComplementary", label: "Split complementary" },
];
</script>

<template>
    <ToolPage>
        <div class="grid gap-4 lg:grid-cols-[20rem_1fr]">
            <Panel title="Settings">
                <div class="space-y-4">
                    <Field label="Base color">
                        <div class="flex gap-2">
                            <input v-model="baseColor" type="color" class="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-transparent p-0.5" />
                            <input v-model="baseColor" type="text" class="input font-mono" placeholder="#000000" />
                        </div>
                    </Field>
                    <Field label="Palette type">
                        <select v-model="paletteType" class="select">
                            <option v-for="o in typeOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
                        </select>
                    </Field>
                    <Btn variant="primary" class="w-full" @click="generatePalette()"><RefreshCw /> Generate palette</Btn>
                </div>
            </Panel>

            <div class="min-w-0 space-y-4">
                <Panel title="Preview" flush>
                    <div class="h-28 w-full transition-all duration-500 ease-in-out" :style="{ background: currentGradient }"></div>
                    <div v-if="palette.length > 0" class="flex h-14">
                        <button
                            v-for="color in palette"
                            :key="color.hex"
                            type="button"
                            class="flex-1 cursor-pointer transition hover:flex-[1.4]"
                            :style="{ backgroundColor: color.hex }"
                            :title="'Copy ' + color.hex"
                            @click="copyText(color.hex, 'Copied ' + color.hex)"
                        ></button>
                    </div>
                </Panel>

                <Panel v-if="palette.length > 0" title="Generated palette">
                    <template #actions>
                        <Btn size="sm" variant="ghost" @click="exportAsCSS"><Download /> Copy CSS</Btn>
                        <Btn size="sm" variant="ghost" @click="exportAsJSON"><Download /> Copy JSON</Btn>
                    </template>
                    <ul class="space-y-3">
                        <li v-for="(color, index) in palette" :key="index" class="flex items-center gap-3">
                            <button type="button" class="size-9 shrink-0 cursor-pointer rounded-lg border border-line" :style="{ backgroundColor: color.hex }" :title="'Copy ' + color.hex" @click="copyText(color.hex, 'Copied ' + color.hex)"></button>
                            <div class="min-w-0 flex-1 text-sm">
                                <div class="font-mono">{{ color.hex }}</div>
                                <div class="truncate text-muted">{{ color.rgb }} · {{ color.hsl }}</div>
                            </div>
                            <CopyButton :text="color.hex" />
                        </li>
                    </ul>
                </Panel>
            </div>
        </div>
    </ToolPage>
</template>
