import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import Home from "./pages/Home.vue";
import JsonFormatter from "./pages/JsonFormatter.vue";
import ColorPaletteGenerator from "./pages/ColorPaletteGenerator.vue";
import RandomColorGenerator from "./pages/RandomColorGenerator.vue";

const routes: Array<RouteRecordRaw> = [
    {
        path: "/",
        name: "Home",
        component: Home,
    },
    {
        path: "/json-formatter",
        name: "JSON Formatter",
        component: JsonFormatter,
    },
    {
        path: "/color-palette-generator",
        name: "Color Palette Generator",
        component: ColorPaletteGenerator,
    },
    {
        path: "/random-color-generator",
        name: "Random Color Generator",
        component: RandomColorGenerator,
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;
