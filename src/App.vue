<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import { Toaster } from "vue-sonner";
import { AnimatePresence, MotionConfig, motion } from "motion-v";
import { onKeyStroke, useElementSize, useMediaQuery } from "@vueuse/core";
import {
    Download,
    Menu,
    Monitor,
    Moon,
    PanelLeftClose,
    PanelLeftOpen,
    Search,
    Star,
    Sun,
    X,
} from "lucide-vue-next";
import AppSidebar from "@/components/AppSidebar.vue";
import { iconSwap, popIn, pressable, softSpring, spring } from "@/composables/motion";
import CommandPalette from "@/components/CommandPalette.vue";
import TabBar from "@/components/TabBar.vue";
import { categoryById, toolById } from "@/tools/registry";
import {
    compactMode,
    cycleTheme,
    isDark,
    isFavorite,
    pushRecent,
    sidebarCollapsed,
    themeMode,
    toggleFavorite,
} from "@/composables/prefs";
import { applyPageMeta, type PageMeta } from "@/composables/seo";
import { canInstall, installApp } from "@/composables/pwa";
import {
    hideWindow,
    isDesktopApp,
    setupDesktop,
} from "@/desktop/bridge";
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
// Desktop-only; `__DESKTOP__` is false in the web build, so this chunk isn't emitted there.
const DesktopSettings = __DESKTOP__
    ? defineAsyncComponent(() => import("@/desktop/DesktopSettings.vue"))
    : null;

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
// Width the content column reserves for the docked sidebar; animated by Motion.
const contentPad = computed(() => (isDesktop.value && showSidebar.value ? 256 : 0));
const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform);

const tool = computed(() => toolById.get(route.meta.toolId as string));
// Compact view only applies on tool pages; home/about always show the full chrome.
const isCompact = computed(() => compactMode.value && !!tool.value);
const showSidebar = computed(() => !isCompact.value && !sidebarCollapsed.value);
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

onKeyStroke("Escape", (e) => {
    if (!isCompact.value || e.defaultPrevented || drawerOpen.value || paletteOpen.value) return;
    compactMode.value = false;
});

// Desktop app: the global launcher shortcut opens the tool search, Spotlight-style.
// Dismissing the search it opened (Esc / click outside) hides the window again.
let openedByLauncher = false;
if (__DESKTOP__) {
    setupDesktop({
        router,
        onQuickOpen: () => {
            openedByLauncher = true;
            paletteOpen.value = true;
        },
    });
    watch(paletteOpen, (v) => {
        if (!v) setTimeout(() => (openedByLauncher = false));
    });
}
function onPaletteDismiss() {
    if (__DESKTOP__ && isDesktopApp && openedByLauncher) hideWindow();
}

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
    <MotionConfig reduced-motion="user">
    <div class="min-h-dvh">
        <!-- Desktop sidebar: slides in/out with the header toggle and compact view. -->
        <AnimatePresence :initial="false">
            <motion.div
                v-if="showSidebar"
                key="sidebar"
                class="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block"
                :initial="{ x: -256, opacity: 0.6 }"
                :animate="{ x: 0, opacity: 1 }"
                :exit="{ x: -256, opacity: 0.6 }"
                :transition="softSpring"
            >
                <AppSidebar />
            </motion.div>
        </AnimatePresence>

        <!-- Mobile drawer -->
        <AnimatePresence>
            <motion.div
                v-if="drawerOpen"
                key="drawer-backdrop"
                class="fixed inset-0 z-40 bg-inverse/30"
                :class="{ 'lg:hidden': !isCompact }"
                :initial="{ opacity: 0 }"
                :animate="{ opacity: 1 }"
                :exit="{ opacity: 0 }"
                :transition="{ duration: 0.2 }"
                @click="drawerOpen = false"
            />
        </AnimatePresence>
        <AnimatePresence>
            <motion.div
                v-if="drawerOpen"
                key="drawer"
                class="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw]"
                :class="{ 'lg:hidden': !isCompact }"
                :initial="{ x: '-100%' }"
                :animate="{ x: 0 }"
                :exit="{ x: '-100%' }"
                :transition="softSpring"
            >
                <AppSidebar @navigate="drawerOpen = false" />
                <motion.button
                    type="button"
                    class="absolute top-3 -right-12 grid size-10 cursor-pointer place-items-center rounded-full bg-surface text-fg-subtle shadow-float ring-1 ring-line hover:text-accent"
                    aria-label="Close menu"
                    :initial="{ opacity: 0, scale: 0.6, rotate: -90 }"
                    :animate="{ opacity: 1, scale: 1, rotate: 0 }"
                    :while-hover="pressable.whileHover"
                    :while-press="pressable.whilePress"
                    :transition="{ ...spring, delay: 0.08 }"
                    @click="drawerOpen = false"
                >
                    <X class="size-4" />
                </motion.button>
            </motion.div>
        </AnimatePresence>

        <!-- Compact view: the only chrome left is a button to open the sidebar drawer. -->
        <AnimatePresence>
            <motion.button
                v-if="isCompact"
                key="compact-drawer-btn"
                type="button"
                class="fixed top-3 left-3 z-30 grid size-10 cursor-pointer place-items-center rounded-full bg-surface text-fg-subtle shadow-float ring-1 ring-line transition-colors hover:text-accent"
                title="Open sidebar"
                aria-label="Open sidebar"
                v-bind="popIn"
                :while-hover="pressable.whileHover"
                :while-press="pressable.whilePress"
                @click="drawerOpen = true"
            >
                <PanelLeftOpen class="size-4" stroke-width="1.75" />
            </motion.button>
        </AnimatePresence>

        <motion.div
            :initial="false"
            :animate="{ paddingLeft: contentPad }"
            :transition="softSpring"
        >
            <AnimatePresence :initial="false">
            <motion.div
                v-if="!isCompact"
                key="topbar"
                class="sticky top-0 z-20 bg-bg/85 backdrop-blur-md"
                :initial="{ opacity: 0, y: -24 }"
                :animate="{ opacity: 1, y: 0 }"
                :exit="{ opacity: 0, y: -24 }"
                :transition="spring"
            >
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
                    <motion.button
                        type="button"
                        v-bind="pressable"
                        class="grid size-10 cursor-pointer place-items-center rounded-full text-fg-subtle hover:bg-subtle hover:text-accent lg:hidden"
                        aria-label="Open menu"
                        @click="drawerOpen = true"
                    >
                        <Menu class="size-5" stroke-width="1.5" />
                    </motion.button>

                    <div class="flex min-w-0 items-center gap-1">
                    <motion.button
                        type="button"
                        class="-ml-2 hidden size-9 shrink-0 cursor-pointer place-items-center rounded-full text-fg-subtle hover:bg-subtle hover:text-accent lg:grid"
                        :aria-label="sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'"
                        :title="sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'"
                        v-bind="pressable"
                        @click="sidebarCollapsed = !sidebarCollapsed"
                    >
                        <AnimatePresence mode="wait" :initial="false">
                            <motion.span
                                :key="sidebarCollapsed ? 'open' : 'close'"
                                class="grid place-items-center"
                                v-bind="iconSwap"
                            >
                                <PanelLeftOpen v-if="sidebarCollapsed" class="size-4.5" stroke-width="1.75" />
                                <PanelLeftClose v-else class="size-4.5" stroke-width="1.75" />
                            </motion.span>
                        </AnimatePresence>
                    </motion.button>
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
                    </div>

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
                        <motion.button
                            type="button"
                            :while-hover="{ scale: 1.02 }"
                            :while-press="{ scale: 0.97 }"
                            :transition="spring"
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
                        </motion.button>
                        <!-- Desktop app only: gear button + settings dialog (not in the web build). -->
                        <component :is="DesktopSettings" v-if="DesktopSettings && isDesktopApp" />
                        <motion.button
                            v-if="canInstall && !isDesktopApp"
                            type="button"
                            v-bind="pressable"
                            class="flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium text-fg-subtle transition-colors hover:bg-subtle hover:text-accent"
                            title="Install DevTools as an app"
                            @click="installApp"
                        >
                            <Download class="size-4" stroke-width="1.75" /><span
                                class="hidden md:inline lg:hidden 2xl:inline"
                                >Install</span
                            >
                        </motion.button>
                        <motion.button
                            v-if="tool"
                            type="button"
                            v-bind="pressable"
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
                            <motion.span
                                :key="isFavorite(tool.id) ? 'fav' : 'unfav'"
                                class="grid place-items-center"
                                :initial="{ scale: 0.4, rotate: -45 }"
                                :animate="{ scale: 1, rotate: 0 }"
                                :transition="{ type: 'spring', stiffness: 500, damping: 14 }"
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
                            </motion.span>
                        </motion.button>
                        <motion.button
                            type="button"
                            v-bind="pressable"
                            class="grid size-10 cursor-pointer place-items-center rounded-full bg-surface text-fg-subtle shadow-float ring-1 ring-line transition-colors hover:text-accent"
                            :title="`Theme: ${themeMode}`"
                            aria-label="Toggle theme"
                            @click="cycleTheme"
                        >
                            <AnimatePresence mode="wait" :initial="false">
                                <motion.span
                                    :key="themeMode"
                                    class="grid place-items-center"
                                    v-bind="iconSwap"
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
                                </motion.span>
                            </AnimatePresence>
                        </motion.button>
                    </div>
                </header>
                <TabBar
                    v-if="!isDesktop && openTabs.length"
                    :active-id="tool?.id"
                />
            </motion.div>
            </AnimatePresence>

            <motion.main
                class="mx-auto w-full"
                :class="
                    isCompact
                        ? 'max-w-none pr-4 pb-6 pl-16 sm:pr-6'
                        : 'max-w-[1400px] px-4 pb-6 sm:px-6 lg:pb-8'
                "
                :initial="false"
                :animate="{ paddingTop: isCompact ? 12 : isDesktop ? 32 : 24 }"
                :transition="softSpring"
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
            </motion.main>
        </motion.div>

        <CommandPalette v-model:open="paletteOpen" @dismiss="onPaletteDismiss" />
        <ChatWidget />
        <Toaster
            position="bottom-right"
            :theme="isDark ? 'dark' : 'light'"
            :offset="72"
        />
    </div>
    </MotionConfig>
</template>
