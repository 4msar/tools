import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import router from "./router";
import { setupPwa } from "./composables/pwa";
import { isDesktopApp } from "./composables/desktop";
import "./tools/productivity/reminders";

const app = createApp(App);
app.use(router);
app.mount("#app");
// The desktop app ships its files locally; no service worker or update checks.
if (!isDesktopApp) setupPwa();
