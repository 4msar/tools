<template>
    <div class="min-h-screen relative overflow-hidden">
        <!-- Background Color Display -->
        <div
            class="absolute inset-0 transition-all duration-500 ease-in-out"
            :style="{ background: currentGradient }"
        ></div>

        <!-- Control Panel -->
        <div
            class="relative z-10 flex items-center justify-center min-h-screen p-4"
        >
            <div
                class="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 max-w-md w-full"
            >
                <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">
                    Color Palette Generator
                </h1>

                <!-- Base Color Input -->
                <div class="mb-6">
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        Base Color
                    </label>
                    <div class="flex gap-2">
                        <input
                            type="color"
                            v-model="baseColor"
                            class="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                            type="text"
                            v-model="baseColor"
                            class="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="#000000"
                        />
                    </div>
                </div>

                <!-- Palette Type Selection -->
                <div class="mb-6">
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        Palette Type
                    </label>
                    <select
                        v-model="paletteType"
                        class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="monochromatic">Monochromatic</option>
                        <option value="analogous">Analogous</option>
                        <option value="complementary">Complementary</option>
                        <option value="triadic">Triadic</option>
                        <option value="tetradic">Tetradic</option>
                        <option value="splitComplementary">
                            Split Complementary
                        </option>
                    </select>
                </div>

                <!-- Generate Button -->
                <button
                    @click="generatePalette"
                    class="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors mb-6"
                >
                    Generate Palette
                </button>

                <!-- Color Palette Display -->
                <div v-if="palette.length > 0" class="space-y-4">
                    <h3 class="text-lg font-semibold text-gray-800">
                        Generated Palette
                    </h3>
                    <div class="space-y-3">
                        <div
                            v-for="(color, index) in palette"
                            :key="index"
                            class="flex items-center gap-3"
                        >
                            <div
                                class="w-8 h-8 rounded border-2 border-gray-300 cursor-pointer"
                                :style="{ backgroundColor: color.hex }"
                                @click="copyToClipboard(color.hex)"
                            ></div>
                            <div class="flex-1 text-sm">
                                <div class="font-mono">{{ color.hex }}</div>
                                <div class="text-gray-600">{{ color.rgb }}</div>
                            </div>
                            <button
                                @click="copyToClipboard(color.hex)"
                                class="text-blue-600 hover:text-blue-800 text-sm"
                            >
                                Copy
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Export Options -->
                <div
                    v-if="palette.length > 0"
                    class="mt-6 pt-6 border-t border-gray-200"
                >
                    <div class="flex gap-2">
                        <button
                            @click="exportAsCSS"
                            class="flex-1 bg-gray-600 text-white py-2 px-4 rounded font-medium hover:bg-gray-700 transition-colors"
                        >
                            Export CSS
                        </button>
                        <button
                            @click="exportAsJSON"
                            class="flex-1 bg-green-600 text-white py-2 px-4 rounded font-medium hover:bg-green-700 transition-colors"
                        >
                            Export JSON
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { toast } from "vue-sonner";

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

function generatePalette() {
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

    toast.success("Palette generated successfully!");
}

async function copyToClipboard(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(`Copied ${text} to clipboard!`);
    } catch (err) {
        toast.error("Failed to copy to clipboard");
    }
}

function exportAsCSS() {
    const css = `:root {\n${palette.value
        .map((color, index) => `  --color-${index + 1}: ${color.hex};`)
        .join("\n")}\n}`;

    copyToClipboard(css);
    toast.success("CSS variables copied to clipboard!");
}

function exportAsJSON() {
    const json = JSON.stringify(
        {
            baseColor: baseColor.value,
            paletteType: paletteType.value,
            colors: palette.value,
        },
        null,
        2
    );

    copyToClipboard(json);
    toast.success("JSON palette copied to clipboard!");
}

const timer = ref<NodeJS.Timeout>();

// Generate initial palette
watch(
    [baseColor, paletteType],
    () => {
        clearTimeout(timer.value);
        timer.value = setTimeout(() => {
            generatePalette();
        }, 300);
    },
    { immediate: true }
);
</script>
