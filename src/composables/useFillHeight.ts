import { nextTick, onMounted, ref, watch, type Ref } from "vue";
import { useEventListener, useResizeObserver } from "@vueuse/core";
import { compactMode } from "@/composables/prefs";

/**
 * Height (px) that lets `el` reach from its position on the page down to the
 * bottom of the viewport, minus `bottomGap`. Uses offsetTop (not
 * getBoundingClientRect) so route transitions and scrolling don't skew it.
 */
export function useFillHeight(el: Ref<HTMLElement | null | undefined>, bottomGap = 32, min = 320) {
    const height = ref(min);

    function measure() {
        let top = 0;
        for (let node = el.value as HTMLElement | null; node; node = node.offsetParent as HTMLElement | null) top += node.offsetTop;
        height.value = Math.max(min, window.innerHeight - top - bottomGap);
    }

    onMounted(() => nextTick(measure));
    useEventListener(window, "resize", measure);
    // Content above the element can change height (wrapping controls, header).
    useResizeObserver(document.body, measure);
    watch(compactMode, () => nextTick(measure));

    return height;
}
