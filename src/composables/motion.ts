// Shared Motion (motion-v) presets so the layout actions move with one consistent feel.
import type { Transition } from "motion-v";

export const spring: Transition = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 };
export const softSpring: Transition = { type: "spring", stiffness: 260, damping: 30 };

// Hover/press feedback for round icon buttons. Spread with v-bind.
export const pressable = {
    whileHover: { scale: 1.08 },
    whilePress: { scale: 0.9 },
    transition: spring,
};

// Floating buttons that pop in and out (compact view controls).
export const popIn = {
    initial: { opacity: 0, scale: 0.6 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.6 },
    transition: spring,
};

// Icon swap inside a button (e.g. open ↔ close).
export const iconSwap = {
    initial: { opacity: 0, rotate: -90, scale: 0.5 },
    animate: { opacity: 1, rotate: 0, scale: 1 },
    exit: { opacity: 0, rotate: 90, scale: 0.5 },
    transition: { duration: 0.18 },
};
