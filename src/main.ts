import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import router from "./router";
import { setupPwa } from "./composables/pwa";
import "./tools/productivity/reminders";

const app = createApp(App);
app.use(router);
app.mount("#app");
// The desktop app ships its files locally and updates itself (src-tauri/src/updates.rs).
if (!__DESKTOP__) setupPwa();
