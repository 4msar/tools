import { createRouter, createWebHistory } from "vue-router";
import type { RouteComponent, RouteRecordRaw } from "vue-router";
import Home from "./pages/Home.vue";
import About from "./pages/About.vue";
import { tools } from "./tools/registry";
import { componentNames } from "./composables/tabs";
import type { PageMeta } from "./composables/seo";

const routes: RouteRecordRaw[] = [
    { path: "/", name: "home", component: Home },
    {
        path: "/about",
        name: "about",
        component: About,
        meta: {
            page: {
                title: "About · DevTools",
                description: "About DevTools: free developer tools that run entirely in your browser. No sign-up, no servers, no tracking.",
                path: "/about",
            } satisfies PageMeta,
        },
    },
    ...tools.map(
        (t): RouteRecordRaw => ({
            path: `/${t.id}`,
            name: t.id,
            component: t.component as () => Promise<RouteComponent>,
            meta: { toolId: t.id },
        }),
    ),
    { path: "/:pathMatch(.*)*", redirect: "/" },
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
    scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
});

// Record each lazy tool's component name once it resolves, so KeepAlive can cache it per tab.
router.afterEach((to) => {
    const id = to.meta.toolId as string | undefined;
    const comp = to.matched[0]?.components?.default as { name?: string; __name?: string } | undefined;
    const name = comp && typeof comp === "object" ? (comp.name ?? comp.__name) : undefined;
    if (id && name) componentNames.set(id, name);
});

export default router;
