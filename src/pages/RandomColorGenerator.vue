<template>
    <div
        class="min-h-screen w-full relative transition-colors duration-500 ease-in-out cursor-pointer"
        :style="{ backgroundColor: currentColor }"
        @dblclick="randomizeColor"
    >
        <template v-if="showDetails">
            <!-- Color info display -->
            <div class="absolute top-8 left-1/2 transform -translate-x-1/2">
                <div
                    class="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-3 shadow-lg"
                >
                    <p
                        :class="textColorClass"
                        class="font-mono text-lg font-medium"
                    >
                        {{ currentColor.toUpperCase() }}
                    </p>
                </div>
            </div>

            <!-- Instructions -->
            <div
                class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center"
            >
                <div
                    class="bg-white/10 backdrop-blur-sm rounded-lg px-8 py-6 shadow-lg"
                >
                    <h1 :class="textColorClass" class="text-2xl font-bold mb-2">
                        Random Color Generator
                    </h1>
                    <p :class="textColorSecondaryClass" class="text-sm">
                        Double-click anywhere to randomize color
                    </p>
                    <p :class="textColorSecondaryClass" class="text-sm">
                        Use the color picker below to choose a specific color
                    </p>
                </div>
            </div>

            <!-- Bottom controls -->
            <div class="absolute bottom-8 left-1/2 transform -translate-x-1/2">
                <div
                    class="flex items-center gap-4 bg-white/20 backdrop-blur-sm rounded-lg px-6 py-4 shadow-lg"
                >
                    <!-- Color picker -->
                    <div class="flex items-center gap-3">
                        <label
                            for="colorPicker"
                            :class="textColorClass"
                            class="text-sm font-medium"
                            >Pick Color:</label
                        >
                        <input
                            id="colorPicker"
                            type="color"
                            :value="currentColor"
                            @input="updateColor"
                            class="w-12 h-12 rounded-lg border-2 border-white/30 cursor-pointer"
                        />
                    </div>

                    <!-- Copy button -->
                    <button
                        @click="copyColor"
                        :class="buttonClass"
                        class="px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
                    >
                        <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            ></path>
                        </svg>
                        Copy
                    </button>

                    <!-- Random button -->
                    <button
                        @click="randomizeColor"
                        :class="buttonClass"
                        class="px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
                    >
                        <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            ></path>
                        </svg>
                        Random
                    </button>
                </div>
            </div>
        </template>

        <button
            @click="showDetails = !showDetails"
            class="cursor-pointer fixed bottom-4 right-4 size-5 p-1"
        >
            <svg
                v-if="showDetails"
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 11-4.243-4.243m4.242 4.242L9.88 9.88"
                ></path>
            </svg>
            <svg
                v-else
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                ></path>
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                ></path>
            </svg>
        </button>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { toast } from "vue-sonner";

const currentColor = ref("#3b82f6");
const showDetails = ref(true);

// Tailwind color palette - comprehensive list of colors
const tailwindColors = [
    // Blue
    "#eff6ff",
    "#dbeafe",
    "#bfdbfe",
    "#93c5fd",
    "#60a5fa",
    "#3b82f6",
    "#2563eb",
    "#1d4ed8",
    "#1e40af",
    "#1e3a8a",
    // Red
    "#fef2f2",
    "#fecaca",
    "#fca5a5",
    "#f87171",
    "#ef4444",
    "#dc2626",
    "#b91c1c",
    "#991b1b",
    "#7f1d1d",
    "#450a0a",
    // Green
    "#f0fdf4",
    "#dcfce7",
    "#bbf7d0",
    "#86efac",
    "#4ade80",
    "#22c55e",
    "#16a34a",
    "#15803d",
    "#166534",
    "#14532d",
    // Yellow
    "#fefce8",
    "#fef3c7",
    "#fde68a",
    "#fcd34d",
    "#facc15",
    "#eab308",
    "#ca8a04",
    "#a16207",
    "#854d0e",
    "#713f12",
    // Purple
    "#faf5ff",
    "#f3e8ff",
    "#e9d5ff",
    "#d8b4fe",
    "#c084fc",
    "#a855f7",
    "#9333ea",
    "#7c3aed",
    "#6d28d9",
    "#5b21b6",
    // Pink
    "#fdf2f8",
    "#fce7f3",
    "#fbcfe8",
    "#f9a8d4",
    "#f472b6",
    "#ec4899",
    "#db2777",
    "#be185d",
    "#9d174d",
    "#831843",
    // Indigo
    "#f0f9ff",
    "#e0f2fe",
    "#bae6fd",
    "#7dd3fc",
    "#38bdf8",
    "#0ea5e9",
    "#0284c7",
    "#0369a1",
    "#075985",
    "#0c4a6e",
    // Orange
    "#fff7ed",
    "#ffedd5",
    "#fed7aa",
    "#fdba74",
    "#fb923c",
    "#f97316",
    "#ea580c",
    "#c2410c",
    "#9a3412",
    "#7c2d12",
    // Teal
    "#f0fdfa",
    "#ccfbf1",
    "#99f6e4",
    "#5eead4",
    "#2dd4bf",
    "#14b8a6",
    "#0d9488",
    "#0f766e",
    "#115e59",
    "#134e4a",
    // Cyan
    "#ecfeff",
    "#cffafe",
    "#a5f3fc",
    "#67e8f9",
    "#22d3ee",
    "#06b6d4",
    "#0891b2",
    "#0e7490",
    "#155e75",
    "#164e63",
    // Gray
    "#f9fafb",
    "#f3f4f6",
    "#e5e7eb",
    "#d1d5db",
    "#9ca3af",
    "#6b7280",
    "#4b5563",
    "#374151",
    "#1f2937",
    "#111827",
    // Emerald
    "#ecfdf5",
    "#d1fae5",
    "#a7f3d0",
    "#6ee7b7",
    "#34d399",
    "#10b981",
    "#059669",
    "#047857",
    "#065f46",
    "#064e3b",
    // Rose
    "#fff1f2",
    "#ffe4e6",
    "#fecdd3",
    "#fda4af",
    "#fb7185",
    "#f43f5e",
    "#e11d48",
    "#be123c",
    "#9f1239",
    "#881337",
    // Violet
    "#f5f3ff",
    "#ede9fe",
    "#ddd6fe",
    "#c4b5fd",
    "#a78bfa",
    "#8b5cf6",
    "#7c3aed",
    "#6d28d9",
    "#5b21b6",
    "#4c1d95",
    // Amber
    "#fffbeb",
    "#fef3c7",
    "#fde68a",
    "#fcd34d",
    "#facc15",
    "#f59e0b",
    "#d97706",
    "#b45309",
    "#92400e",
    "#78350f",
    // Lime
    "#f7fee7",
    "#ecfccb",
    "#d9f99d",
    "#bef264",
    "#a3e635",
    "#84cc16",
    "#65a30d",
    "#4d7c0f",
    "#365314",
    "#1a2e05",
    // Sky
    "#f0f9ff",
    "#e0f2fe",
    "#bae6fd",
    "#7dd3fc",
    "#38bdf8",
    "#0ea5e9",
    "#0284c7",
    "#0369a1",
    "#075985",
    "#0c4a6e",
    // Neutral
    "#fafafa",
    "#f5f5f5",
    "#e5e5e5",
    "#d4d4d4",
    "#a3a3a3",
    "#737373",
    "#525252",
    "#404040",
    "#262626",
    "#171717",
    // Stone
    "#fafaf9",
    "#f5f5f4",
    "#e7e5e4",
    "#d6d3d1",
    "#a8a29e",
    "#78716c",
    "#57534e",
    "#44403c",
    "#292524",
    "#1c1917",
    // Zinc
    "#fafafa",
    "#f4f4f5",
    "#e4e4e7",
    "#d4d4d8",
    "#a1a1aa",
    "#71717a",
    "#52525b",
    "#3f3f46",
    "#27272a",
    "#18181b",
    // Slate
    "#f8fafc",
    "#f1f5f9",
    "#e2e8f0",
    "#cbd5e1",
    "#94a3b8",
    "#64748b",
    "#475569",
    "#334155",
    "#1e293b",
    "#0f172a",
];

// Function to calculate luminance of a color
const getLuminance = (hex: string) => {
    // Remove # if present
    const color = hex.replace("#", "");

    // Convert hex to RGB
    const r = parseInt(color.substring(0, 2), 16) / 255;
    const g = parseInt(color.substring(2, 4), 16) / 255;
    const b = parseInt(color.substring(4, 6), 16) / 255;

    // Calculate relative luminance
    const srgb = [r, g, b].map((c) => {
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
};

// Computed properties for dynamic text colors
const isLightBackground = computed(() => {
    return getLuminance(currentColor.value) > 0.5;
});

const textColorClass = computed(() => {
    return isLightBackground.value ? "text-black" : "text-white";
});

const textColorSecondaryClass = computed(() => {
    return isLightBackground.value ? "text-black/80" : "text-white/80";
});

const buttonClass = computed(() => {
    if (isLightBackground.value) {
        return "bg-black/20 hover:bg-black/30 text-black";
    } else {
        return "bg-white/20 hover:bg-white/30 text-white";
    }
});

const randomizeColor = () => {
    const randomIndex = Math.floor(Math.random() * tailwindColors.length);
    currentColor.value = tailwindColors[randomIndex];
};

const updateColor = (event: Event) => {
    const target = event.target as HTMLInputElement;
    currentColor.value = target.value;
};

const copyColor = async () => {
    try {
        await navigator.clipboard.writeText(currentColor.value);
        toast.success("Color copied to clipboard!", {
            description: currentColor.value.toUpperCase(),
        });
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = currentColor.value;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);

        toast.success("Color copied to clipboard!", {
            description: currentColor.value.toUpperCase(),
        });
    }
};

// Initialize with a random color on mount
onMounted(() => {
    randomizeColor();
});
</script>

<style scoped>
/* Custom styles for color picker */
input[type="color"] {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background-color: transparent;
    border: none;
    cursor: pointer;
}

input[type="color"]::-webkit-color-swatch {
    border-radius: 8px;
    border: 2px solid rgba(255, 255, 255, 0.3);
}

input[type="color"]::-moz-color-swatch {
    border-radius: 8px;
    border: 2px solid rgba(255, 255, 255, 0.3);
}
</style>
