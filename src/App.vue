<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import { Toaster } from "vue-sonner";
import { onKeyStroke, useElementSize, useMediaQuery } from "@vueuse/core";
import {
    Download,
    Menu,
    Monitor,
    Moon,
    Search,
    Star,
    Sun,
    X,
} from "lucide-vue-next";
import AppSidebar from "@/components/AppSidebar.vue";
import CommandPalette from "@/components/CommandPalette.vue";
import TabBar from "@/components/TabBar.vue";
import { categoryById, toolById } from "@/tools/registry";
import {
    cycleTheme,
    isDark,
    isFavorite,
    pushRecent,
    themeMode,
    toggleFavorite,
} from "@/composables/prefs";
import { applyPageMeta, type PageMeta } from "@/composables/seo";
import { canInstall, installApp } from "@/composables/pwa";
import {
    closeTabAndNavigate,
    keepAliveInclude,
    neighbourTab,
    openTab,
    openTabs,
} from "@/composables/tabs";

const ChatWidget = defineAsyncComponent(
    () => import("@/components/chat/ChatWidget.vue"),
);

const route = useRoute();
const router = useRouter();
const paletteOpen = ref(false);
const drawerOpen = ref(false);
// Matches the sidebar breakpoint (lg). Below it the tabs get their own row under the header.
const isDesktop = useMediaQuery("(min-width: 1024px)");
// Both side columns are at least as wide as the action buttons, so the tabs column stays centred.
const actionsEl = ref<HTMLElement>();
const { width: actionsWidth } = useElementSize(actionsEl, undefined, {
    box: "border-box",
});
const sideWidth = computed(() => Math.ceil(actionsWidth.value));
const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform);

const tool = computed(() => toolById.get(route.meta.toolId as string));
const category = computed(() =>
    tool.value ? categoryById.get(tool.value.category) : undefined,
);

watch(
    tool,
    (t, prev) => {
        applyPageMeta(t, route.meta.page as PageMeta | undefined);
        if (t) {
            pushRecent(t.id);
            openTab(t.id, prev?.id);
        }
    },
    { immediate: true },
);
// Non-tool pages (home, about) have no tool to drive the meta above, so they update it here.
watch(
    () => route.fullPath,
    () => {
        drawerOpen.value = false;
        if (!tool.value)
            applyPageMeta(undefined, route.meta.page as PageMeta | undefined);
    },
);

// Tab shortcuts. Alt+W closes; Alt+Shift+←/→ switches. Uses e.code so macOS Option characters don't interfere.
onKeyStroke((e) => {
    if (!e.altKey || e.metaKey || e.ctrlKey) return;
    const id = tool.value?.id;
    if (e.code === "KeyW" && !e.shiftKey && id) {
        e.preventDefault();
        closeTabAndNavigate(id, id, (p) => router.push(p));
    } else if (
        e.shiftKey &&
        (e.code === "ArrowLeft" || e.code === "ArrowRight") &&
        id
    ) {
        e.preventDefault();
        const next = neighbourTab(id, e.code === "ArrowRight" ? 1 : -1);
        if (next && next !== id) router.push(`/${next}`);
    }
});
</script>

<template>
    <div class="min-h-dvh">
        <!-- Desktop sidebar -->
        <div class="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
            <AppSidebar />
        </div>

        <!-- Mobile drawer -->
        <Transition
            enter-active-class="transition-opacity duration-200"
            enter-from-class="opacity-0"
            leave-active-class="transition-opacity duration-150"
            leave-to-class="opacity-0"
        >
            <div
                v-if="drawerOpen"
                class="fixed inset-0 z-40 bg-inverse/30 lg:hidden"
                @click="drawerOpen = false"
            />
        </Transition>
        <Transition
            enter-active-class="transition-transform duration-300 ease-(--ease-out)"
            enter-from-class="-translate-x-full"
            leave-active-class="transition-transform duration-150 ease-in"
            leave-to-class="-translate-x-full"
        >
            <div
                v-if="drawerOpen"
                class="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] lg:hidden"
            >
                <AppSidebar @navigate="drawerOpen = false" />
                <button
                    type="button"
                    class="absolute top-3 -right-12 grid size-10 cursor-pointer place-items-center rounded-full bg-surface text-fg-subtle shadow-float ring-1 ring-line hover:text-accent"
                    aria-label="Close menu"
                    @click="drawerOpen = false"
                >
                    <X class="size-4" />
                </button>
            </div>
        </Transition>

        <div class="lg:pl-64">
            <div class="sticky top-0 z-20 bg-bg/85 backdrop-blur-md">
                <header
                    class="h-14 items-center px-3 sm:px-6"
                    :class="
                        isDesktop
                            ? 'grid gap-4 border-b border-line'
                            : 'flex gap-2'
                    "
                    :style="
                        isDesktop
                            ? {
                                  gridTemplateColumns: `minmax(${sideWidth}px, 1fr) minmax(0, auto) minmax(${sideWidth}px, 1fr)`,
                              }
                            : undefined
                    "
                >
                    <button
                        type="button"
                        class="grid size-10 cursor-pointer place-items-center rounded-full text-fg-subtle hover:bg-subtle hover:text-accent lg:hidden"
                        aria-label="Open menu"
                        @click="drawerOpen = true"
                    >
                        <Menu class="size-5" stroke-width="1.5" />
                    </button>

                    <nav
                        class="flex min-w-0 items-center gap-1.5 text-sm"
                        aria-label="Breadcrumb"
                    >
                        <RouterLink
                            to="/"
                            class="font-medium text-fg-subtle transition-colors hover:text-accent"
                            >Tools</RouterLink
                        >
                        <template v-if="tool">
                            <span class="text-line">/</span>
                            <span
                                class="hidden text-fg-subtle sm:inline lg:hidden 2xl:inline"
                                >{{ category?.name }}</span
                            >
                            <span
                                class="hidden text-line sm:inline lg:hidden 2xl:inline"
                                >/</span
                            >
                            <span class="truncate font-medium text-fg">{{
                                tool.name
                            }}</span>
                        </template>
                    </nav>

                    <!-- Desktop: open tabs sit between the breadcrumb and the actions, centred. -->
                    <TabBar
                        v-if="isDesktop"
                        inline
                        :active-id="tool?.id"
                        class="max-w-full justify-self-center"
                    />

                    <div
                        ref="actionsEl"
                        class="ml-auto flex w-max items-center justify-end gap-1.5 justify-self-end"
                    >
                        <button
                            type="button"
                            class="flex h-10 cursor-pointer items-center gap-2 rounded-full bg-surface px-3.5 text-sm text-fg-subtle shadow-float ring-1 ring-line transition-colors hover:text-fg sm:w-60 lg:w-10 lg:justify-center lg:px-0 xl:w-56 xl:justify-start xl:px-3.5"
                            @click="paletteOpen = true"
                        >
                            <Search class="size-4" stroke-width="1.75" />
                            <span class="hidden sm:inline lg:hidden xl:inline"
                                >Search tools…</span
                            >
                            <span
                                class="ml-auto hidden gap-0.5 sm:flex lg:hidden xl:flex"
                                ><span class="kbd">{{
                                    isMac ? "⌘" : "Ctrl"
                                }}</span
                                ><span class="kbd">K</span></span
                            >
                        </button>
                        <button
                            v-if="canInstall"
                            type="button"
                            class="flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium text-fg-subtle transition-colors hover:bg-subtle hover:text-accent"
                            title="Install DevTools as an app"
                            @click="installApp"
                        >
                            <Download class="size-4" stroke-width="1.75" /><span
                                class="hidden md:inline lg:hidden 2xl:inline"
                                >Install</span
                            >
                        </button>
                        <button
                            v-if="tool"
                            type="button"
                            class="grid size-10 cursor-pointer place-items-center rounded-full bg-surface shadow-float ring-1 ring-line transition-colors"
                            :class="
                                isFavorite(tool.id)
                                    ? 'text-accent'
                                    : 'text-fg-subtle hover:text-accent'
                            "
                            :aria-label="
                                isFavorite(tool.id)
                                    ? 'Remove from favorites'
                                    : 'Add to favorites'
                            "
                            :title="
                                isFavorite(tool.id)
                                    ? 'Remove from favorites'
                                    : 'Add to favorites'
                            "
                            @click="toggleFavorite(tool.id)"
                        >
                            <Star
                                class="size-4"
                                stroke-width="1.75"
                                :fill="
                                    isFavorite(tool.id)
                                        ? 'currentColor'
                                        : 'none'
                                "
                            />
                        </button>
                        <button
                            type="button"
                            class="grid size-10 cursor-pointer place-items-center rounded-full bg-surface text-fg-subtle shadow-float ring-1 ring-line transition-colors hover:text-accent"
                            :title="`Theme: ${themeMode}`"
                            aria-label="Toggle theme"
                            @click="cycleTheme"
                        >
                            <Monitor
                                v-if="themeMode === 'system'"
                                class="size-4"
                                stroke-width="1.75"
                            />
                            <Moon
                                v-else-if="isDark"
                                class="size-4"
                                stroke-width="1.75"
                            />
                            <Sun v-else class="size-4" stroke-width="1.75" />
                        </button>
                    </div>
                </header>
                <TabBar
                    v-if="!isDesktop && openTabs.length"
                    :active-id="tool?.id"
                />
            </div>

            <main
                class="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8"
            >
                <RouterView v-slot="{ Component }">
                    <KeepAlive :include="keepAliveInclude" :max="15">
                        <component
                            :is="Component"
                            :key="route.path"
                            class="page-enter"
                        />
                    </KeepAlive>
                </RouterView>
            </main>
        </div>

        <CommandPalette v-model:open="paletteOpen" />
        <ChatWidget />
        <Toaster
            position="bottom-right"
            :theme="isDark ? 'dark' : 'light'"
            :offset="72"
        />
    </div>
</template>
