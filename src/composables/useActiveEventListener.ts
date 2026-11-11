import { onActivated, onBeforeUnmount, onDeactivated, onMounted } from "vue";

/**
 * Adds a window listener only while the component is visible. Tools stay alive in background tabs
 * (KeepAlive), so global listeners such as paste or keydown must pause when the tab is hidden.
 */
export function useActiveEventListener<K extends keyof WindowEventMap>(
    event: K,
    handler: (e: WindowEventMap[K]) => void,
) {
    let attached = false;
    const on = () => {
        if (!attached) window.addEventListener(event, handler);
        attached = true;
    };
    const off = () => {
        if (attached) window.removeEventListener(event, handler);
        attached = false;
    };
    onMounted(on);
    onActivated(on);
    onDeactivated(off);
    onBeforeUnmount(off);
}
