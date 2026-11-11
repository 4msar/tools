import { computed, watchEffect } from "vue";
import { useStorage, usePreferredDark } from "@vueuse/core";
import { toolById, type ToolDef } from "@/tools/registry";

export type ThemeMode = "light" | "dark" | "system";

export const themeMode = useStorage<ThemeMode>("devtools:theme", "system");
const prefersDark = usePreferredDark();
export const isDark = computed(
    () => themeMode.value === "dark" || (themeMode.value === "system" && prefersDark.value),
);

watchEffect(() => {
    document.documentElement.classList.toggle("dark", isDark.value);
});

export function cycleTheme() {
    const order: ThemeMode[] = ["system", "light", "dark"];
    themeMode.value = order[(order.indexOf(themeMode.value) + 1) % order.length];
}

const favoriteIds = useStorage<string[]>("devtools:favorites", []);
const recentIds = useStorage<string[]>("devtools:recents", []);

export const favorites = computed<ToolDef[]>(() =>
    favoriteIds.value.map((id) => toolById.get(id)).filter((t): t is ToolDef => !!t),
);
export const recents = computed<ToolDef[]>(() =>
    recentIds.value.map((id) => toolById.get(id)).filter((t): t is ToolDef => !!t),
);

export const isFavorite = (id: string) => favoriteIds.value.includes(id);

export function toggleFavorite(id: string) {
    favoriteIds.value = isFavorite(id)
        ? favoriteIds.value.filter((x) => x !== id)
        : [...favoriteIds.value, id];
}

export function pushRecent(id: string) {
    recentIds.value = [id, ...recentIds.value.filter((x) => x !== id)].slice(0, 8);
}
