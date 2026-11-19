<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, reactive, ref, shallowRef, triggerRef, watch } from "vue";
import type { Component } from "vue";
import { onClickOutside, useDebounceFn } from "@vueuse/core";
import {
    ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, CircleHelp, Copy, CopyPlus, Diamond, Download, Eraser, FilePlus, FolderOpen, Grid3x3, Hand, ImageDown, ImagePlus, Lock, LockOpen,
    Maximize, Minus, MousePointer2, MoveUpRight, Pencil, Circle, Plus, Redo2, Save, Square, Trash2, Type, Undo2, Menu as MenuIcon, Slash,
} from "lucide-vue-next";
import { Btn, Notice, Panel, ToolPage } from "@/components/ui";
import { downloadBlob } from "@/composables/useClipboard";
import { isDark } from "@/composables/prefs";
import {
    cloneEl, DEFAULT_STYLE, isLinear, isShape, newSeed, uid,
    type Arrowhead, type El, type ElType, type FillStyle, type FontFamily, type HandleId, type Pt, type Style, type StrokeStyle,
} from "./whiteboard/types";
import {
    constrainAngle, constrainSquare, elBounds, handlePoints, hitElement, HANDLE_IDS, linearAbs, rectContains, resizeBox, setLinearPoints, unionBounds,
} from "./whiteboard/geometry";
import {
    drawElement, fitText, forgetDrawables, isVisible, loadImage, measureText, renderToCanvas, renderToSvg, resolveColor, rough, FONT_STACKS, type ImageCache,
} from "./whiteboard/render";
import type { RoughCanvas } from "roughjs/bin/canvas";

type Tool = "select" | "hand" | "rectangle" | "diamond" | "ellipse" | "arrow" | "line" | "pen" | "text" | "eraser";
const TOOLS: { id: Tool; label: string; key: string; num: string; icon: Component }[] = [
    { id: "select", label: "Select", key: "V", num: "1", icon: MousePointer2 },
    { id: "hand", label: "Hand (pan)", key: "H", num: "2", icon: Hand },
    { id: "rectangle", label: "Rectangle", key: "R", num: "3", icon: Square },
    { id: "diamond", label: "Diamond", key: "D", num: "4", icon: Diamond },
    { id: "ellipse", label: "Ellipse", key: "O", num: "5", icon: Circle },
    { id: "arrow", label: "Arrow", key: "A", num: "6", icon: MoveUpRight },
    { id: "line", label: "Line", key: "L", num: "7", icon: Slash },
    { id: "pen", label: "Pen", key: "P", num: "8", icon: Pencil },
    { id: "text", label: "Text", key: "T", num: "9", icon: Type },
    { id: "eraser", label: "Eraser", key: "E", num: "0", icon: Eraser },
];
const DRAW_TOOLS: Tool[] = ["rectangle", "diamond", "ellipse", "arrow", "line", "pen", "text"];
const STROKES = ["#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00", "#9c36b5", "#0c8599", "#868e96"];
const BACKGROUNDS = ["transparent", "#ffc9c9", "#b2f2bb", "#a5d8ff", "#ffec99", "#eebefa", "#99e9f2", "#dee2e6"];
const FILLS: { v: FillStyle; label: string }[] = [{ v: "hachure", label: "Hatch" }, { v: "cross-hatch", label: "Cross" }, { v: "solid", label: "Solid" }, { v: "none", label: "None" }];
const WIDTHS = [{ v: 1, label: "Thin" }, { v: 2, label: "Medium" }, { v: 4, label: "Bold" }];
const STROKE_STYLES: { v: StrokeStyle; label: string }[] = [{ v: "solid", label: "Solid" }, { v: "dashed", label: "Dashed" }, { v: "dotted", label: "Dotted" }];
const ROUGHNESS = [{ v: 0, label: "Clean" }, { v: 1, label: "Sketchy" }, { v: 2, label: "Messy" }];
const FONT_SIZES = [{ v: 16, label: "S" }, { v: 20, label: "M" }, { v: 28, label: "L" }, { v: 40, label: "XL" }];
const FONTS: { v: FontFamily; label: string }[] = [{ v: "hand", label: "Hand" }, { v: "normal", label: "Normal" }, { v: "code", label: "Code" }];
const HEADS: { v: Arrowhead; label: string }[] = [{ v: "none", label: "None" }, { v: "arrow", label: "Arrow" }, { v: "triangle", label: "Solid" }, { v: "dot", label: "Dot" }];
const SHORTCUTS: [string, string][] = [
    ["V / 1", "Select"], ["H / 2", "Hand"], ["R / 3", "Rectangle"], ["D / 4", "Diamond"], ["O / 5", "Ellipse"], ["A / 6", "Arrow"], ["L / 7", "Line"], ["P / 8", "Pen"], ["T / 9", "Text"], ["E / 0", "Eraser"],
    ["Space + drag", "Pan"], ["Ctrl/Cmd + wheel", "Zoom"], ["Shift", "Constrain / add to selection"], ["Arrows (+Shift)", "Nudge 1px (10px)"],
    ["Ctrl/Cmd + Z", "Undo"], ["Ctrl/Cmd + Shift + Z / Y", "Redo"], ["Ctrl/Cmd + C / X / V", "Copy / cut / paste"], ["Ctrl/Cmd + D", "Duplicate"], ["Ctrl/Cmd + A", "Select all"],
    ["Delete / Backspace", "Delete"], ["Double-click", "Edit text / label"], ["Enter / Esc", "Commit text (Shift+Enter: new line)"], ["Ctrl/Cmd + + / - / 0", "Zoom in / out / 100%"], ["Shift + 1", "Zoom to fit"], ["Ctrl/Cmd + S", "Save .json"],
];

const SCENE_KEY = "tools:whiteboard:scene";
const BG_LIGHT = "#ffffff";
const BG_DARK = "#14171a";

// ---- state ----------------------------------------------------------------
const tool = ref<Tool>("select");
const locked = ref(false);
const elements = shallowRef<El[]>([]);
const selected = ref<string[]>([]);
const vp = reactive({ x: 0, y: 0, zoom: 1 });
const showGrid = ref(true);
const style = reactive<Style>({ ...DEFAULT_STYLE });
const size = reactive({ w: 0, h: 0 });
const cursor = ref("default");
const popover = ref<null | "file" | "export" | "help">(null);
const status = ref<{ msg: string; kind: "info" | "error" } | null>(null);
const saveWarn = ref("");
const canUndo = ref(false);
const canRedo = ref(false);
const exp = reactive({ scale: 2, background: true, dark: false, padding: 24, onlySel: true });

const root = ref<HTMLElement | null>(null);
const host = ref<HTMLElement | null>(null);
const cv = ref<HTMLCanvasElement | null>(null);
const popEl = ref<HTMLElement | null>(null);
const editEl = ref<HTMLTextAreaElement | null>(null);
const jsonInput = ref<HTMLInputElement | null>(null);
const imageInput = ref<HTMLInputElement | null>(null);

const selSet = computed(() => new Set(selected.value));
const sel = computed(() => elements.value.filter((e) => selSet.value.has(e.id)));
const showStyle = computed(() => sel.value.length > 0 || DRAW_TOOLS.includes(tool.value));
const cur = computed<Style>(() => (sel.value[0] as Style | undefined) ?? style);
const kinds = computed<Set<ElType | Tool>>(() => new Set<ElType | Tool>(sel.value.length ? sel.value.map((e) => e.type) : [tool.value]));
const hasFill = computed(() => ["rectangle", "diamond", "ellipse"].some((k) => kinds.value.has(k as ElType)));
const hasStroke = computed(() => [...kinds.value].some((k) => k !== "text" && k !== "image"));
const hasText = computed(() => kinds.value.has("text") || sel.value.some(isShape) || (!sel.value.length && ["rectangle", "diamond", "ellipse"].includes(tool.value)));
const hasArrow = computed(() => kinds.value.has("arrow"));
const exportEls = computed(() => (exp.onlySel && sel.value.length ? sel.value : elements.value));

// ---- history --------------------------------------------------------------
const undoStack: El[][] = [];
const redoStack: El[][] = [];
const take = () => elements.value.map(cloneEl);
function syncHistory() {
    canUndo.value = undoStack.length > 0;
    canRedo.value = redoStack.length > 0;
}
function pushSnap(snap: El[]) {
    undoStack.push(snap);
    if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0;
    syncHistory();
}
const pushHistory = () => pushSnap(take());
function undo() {
    const s = undoStack.pop();
    if (!s) return;
    redoStack.push(take());
    elements.value = s;
    selected.value = selected.value.filter((id) => s.some((e) => e.id === id));
    syncHistory();
}
function redo() {
    const s = redoStack.pop();
    if (!s) return;
    undoStack.push(take());
    elements.value = s;
    selected.value = selected.value.filter((id) => s.some((e) => e.id === id));
    syncHistory();
}
const commit = () => triggerRef(elements);

let statusTimer = 0;
function flash(msg: string, kind: "info" | "error" = "info") {
    status.value = { msg, kind };
    clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => (status.value = null), 3500);
}

// ---- coordinates ----------------------------------------------------------
const screenPt = (e: { clientX: number; clientY: number }): Pt => {
    const r = cv.value!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
};
const toScene = (s: Pt): Pt => [(s[0] - vp.x) / vp.zoom, (s[1] - vp.y) / vp.zoom];
const clampZoom = (z: number) => Math.min(8, Math.max(0.1, z));
function zoomAt(sx: number, sy: number, nz: number) {
    const z = clampZoom(nz);
    const k = z / vp.zoom;
    vp.x = sx - (sx - vp.x) * k;
    vp.y = sy - (sy - vp.y) * k;
    vp.zoom = z;
}
const zoomBy = (f: number) => zoomAt(size.w / 2, size.h / 2, vp.zoom * f);
const resetZoom = () => zoomAt(size.w / 2, size.h / 2, 1);
function fit() {
    const b = unionBounds(elements.value);
    if (!b) {
        vp.x = 0; vp.y = 0; vp.zoom = 1;
        return;
    }
    const pad = 60;
    const z = clampZoom(Math.min((size.w - pad * 2) / Math.max(b.w, 1), (size.h - pad * 2) / Math.max(b.h, 1), 2));
    vp.zoom = z;
    vp.x = size.w / 2 - (b.x + b.w / 2) * z;
    vp.y = size.h / 2 - (b.y + b.h / 2) * z;
}

// ---- element helpers ------------------------------------------------------
function hitTop(p: Pt): El | null {
    const tol = 6 / vp.zoom;
    const list = elements.value;
    for (let i = list.length - 1; i >= 0; i--) if (hitElement(list[i], p[0], p[1], tol)) return list[i];
    return null;
}
const find = (id: string) => elements.value.find((e) => e.id === id);

function makeEl(type: ElType, x: number, y: number): El {
    const el: El = { ...style, id: uid(), type, x, y, w: 0, h: 0, seed: newSeed() };
    if (type === "line" || type === "arrow") el.points = [[0, 0], [0, 0]];
    if (type === "pen") el.points = [[0, 0]];
    return el;
}

function setStyle(patch: Partial<Style>) {
    Object.assign(style, patch);
    if (!sel.value.length) return;
    if (!styleSession) {
        pushHistory();
        styleSession = true;
        setTimeout(() => (styleSession = false), 700);
    }
    for (const el of sel.value) {
        Object.assign(el, patch);
        if (el.type === "text" && ("fontSize" in patch || "fontFamily" in patch)) fitText(el);
    }
    commit();
}
let styleSession = false;

function deleteSelected() {
    if (!selected.value.length) return;
    pushHistory();
    forgetDrawables(selected.value);
    elements.value = elements.value.filter((e) => !selSet.value.has(e.id));
    selected.value = [];
}

function cloneInto(src: El[], off: number) {
    if (!src.length) return;
    pushHistory();
    const clones = src.map((e) => {
        const c = cloneEl(e);
        c.id = uid();
        c.x += off;
        c.y += off;
        return c;
    });
    elements.value = [...elements.value, ...clones];
    selected.value = clones.map((c) => c.id);
    tool.value = "select";
}
let clipboard: El[] = [];
let pasteCount = 0;
function copySel() {
    if (!sel.value.length) return;
    clipboard = sel.value.map(cloneEl);
    pasteCount = 0;
    flash(`Copied ${clipboard.length} element${clipboard.length > 1 ? "s" : ""}`);
}
function pasteClip() {
    if (!clipboard.length) return;
    pasteCount++;
    cloneInto(clipboard, 16 * pasteCount);
}
const duplicate = () => cloneInto(sel.value, 16);
function selectAll() {
    tool.value = "select";
    selected.value = elements.value.map((e) => e.id);
}

function reorder(mode: "back" | "front" | "backward" | "forward") {
    if (!selected.value.length) return;
    pushHistory();
    const ids = selSet.value;
    let arr = elements.value.slice();
    if (mode === "back") arr = [...arr.filter((e) => ids.has(e.id)), ...arr.filter((e) => !ids.has(e.id))];
    else if (mode === "front") arr = [...arr.filter((e) => !ids.has(e.id)), ...arr.filter((e) => ids.has(e.id))];
    else if (mode === "backward") {
        for (let i = 1; i < arr.length; i++) if (ids.has(arr[i].id) && !ids.has(arr[i - 1].id)) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    } else {
        for (let i = arr.length - 2; i >= 0; i--) if (ids.has(arr[i].id) && !ids.has(arr[i + 1].id)) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
    }
    elements.value = arr;
}

// ---- text editing ---------------------------------------------------------
interface Editing { proto: El; isNew: boolean; label: boolean; value: string; initial: string }
const editing = ref<Editing | null>(null);

function openEditor(proto: El, isNew: boolean, label: boolean) {
    const initial = proto.text ?? "";
    editing.value = { proto, isNew, label, value: initial, initial };
    nextTick(() => {
        editEl.value?.focus();
        editEl.value?.select();
    });
}
function startTextAt(p: Pt) {
    const proto = makeEl("text", p[0], p[1]);
    proto.text = "";
    openEditor(proto, true, false);
}
// Finishing with Enter/Esc returns focus to the board so shortcuts (Delete, arrows, undo) keep working.
function commitEditAndRefocus() {
    commitEdit();
    root.value?.focus({ preventScroll: true });
}
function startEdit(el: El) {
    if (el.type === "text") openEditor(el, false, false);
    else if (isShape(el)) openEditor(el, false, true);
}
function commitEdit() {
    const ed = editing.value;
    if (!ed) return;
    editing.value = null;
    const text = ed.value.replace(/\s+$/, "");
    const p = ed.proto;
    if (ed.isNew) {
        if (!text) return;
        pushHistory();
        p.text = text;
        fitText(p);
        elements.value = [...elements.value, p];
        if (!locked.value) {
            tool.value = "select";
            selected.value = [p.id];
        }
    } else if (ed.label) {
        if ((p.text ?? "") !== text) {
            pushHistory();
            p.text = text || undefined;
            commit();
        }
    } else if (!text) {
        selected.value = [p.id];
        deleteSelected();
    } else if (text !== ed.initial) {
        pushHistory();
        p.text = text;
        fitText(p);
        commit();
    }
    markDirty();
}
const editBox = computed(() => {
    const ed = editing.value;
    if (!ed) return null;
    const p = ed.proto;
    const m = measureText(ed.value || " ", p);
    const w = m.w + p.fontSize * 0.5;
    const z = vp.zoom;
    const x = ed.label ? p.x + p.w / 2 - w / 2 : p.x;
    const y = ed.label ? p.y + p.h / 2 - m.h / 2 : p.y;
    return {
        left: `${x * z + vp.x}px`, top: `${y * z + vp.y}px`, width: `${w * z}px`, height: `${m.h * z}px`,
        font: `${p.fontSize * z}px ${FONT_STACKS[p.fontFamily]}`, lineHeight: "1.25",
        color: resolveColor(p.strokeColor, isDark.value), textAlign: ed.label ? ("center" as const) : ("left" as const),
        opacity: String(p.opacity / 100),
    };
});

// ---- gestures -------------------------------------------------------------
type Gesture =
    | { kind: "pan"; sx: number; sy: number; vx: number; vy: number }
    | { kind: "move"; start: Pt; orig: Map<string, Pt>; moved: boolean; pre: El[] }
    | { kind: "resize"; id: string; handle: HandleId; orig: El; changed: boolean; pre: El[] }
    | { kind: "end"; id: string; idx: number; orig: El; changed: boolean; pre: El[] }
    | { kind: "draw"; id: string; start: Pt; pts: Pt[]; pre: El[] }
    | { kind: "marquee"; start: Pt; cur: Pt; base: string[] }
    | { kind: "erase" }
    | { kind: "pinch"; cx: number; cy: number; dist: number; vx: number; vy: number; zoom: number };
let g: Gesture | null = null;
const ptrs = new Map<number, Pt>();
const erasing = new Set<string>();
let spaceDown = false;

function handleHit(sp: Pt): { box: HandleId } | { end: number } | null {
    if (sel.value.length !== 1) return null;
    const el = sel.value[0];
    const R = 10;
    const near = (p: Pt) => Math.hypot(p[0] * vp.zoom + vp.x - sp[0], p[1] * vp.zoom + vp.y - sp[1]) <= R;
    if (el.type === "line" || el.type === "arrow") {
        const pts = linearAbs(el);
        if (near(pts[0])) return { end: 0 };
        if (near(pts[pts.length - 1])) return { end: pts.length - 1 };
        return null;
    }
    const hp = handlePoints(elBounds(el));
    for (const id of HANDLE_IDS) if (near(hp[id])) return { box: id };
    return null;
}

function updateCursor(sp: Pt | null, p: Pt | null) {
    if (spaceDown || tool.value === "hand") cursor.value = "grab";
    else if (tool.value === "text") cursor.value = "text";
    else if (tool.value !== "select") cursor.value = "crosshair";
    else if (sp && p) {
        const h = handleHit(sp);
        if (h && "box" in h) cursor.value = ({ nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize" } as Record<HandleId, string>)[h.box];
        else if (h) cursor.value = "pointer";
        else cursor.value = hitTop(p) ? "move" : "default";
    } else cursor.value = "default";
}

function cancelGesture() {
    const gs = g;
    g = null;
    if (!gs) return;
    if (gs.kind === "draw") elements.value = elements.value.filter((e) => e.id !== gs.id);
    else if (gs.kind === "move" || gs.kind === "resize" || gs.kind === "end") elements.value = gs.pre;
    else if (gs.kind === "erase") erasing.clear();
    commit();
    markDirty();
}

function eraseAt(p: Pt) {
    const tol = 4 / vp.zoom;
    for (const el of elements.value) if (!erasing.has(el.id) && hitElement(el, p[0], p[1], tol)) erasing.add(el.id);
    markDirty();
}

function onPointerDown(e: PointerEvent) {
    const c = cv.value;
    if (!c) return;
    // Stop the browser's mousedown focus change: it would blur a text box opened by this click
    // (committing it empty). Focus is managed here instead.
    e.preventDefault();
    if (editing.value) commitEdit();
    root.value?.focus({ preventScroll: true });
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    c.setPointerCapture(e.pointerId);
    if (ptrs.size === 2) {
        cancelGesture();
        const [a, b] = [...ptrs.values()];
        const r = c.getBoundingClientRect();
        g = { kind: "pinch", cx: (a[0] + b[0]) / 2 - r.left, cy: (a[1] + b[1]) / 2 - r.top, dist: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, vx: vp.x, vy: vp.y, zoom: vp.zoom };
        return;
    }
    if (ptrs.size > 2 || g) return;
    popover.value = null;
    const sp = screenPt(e);
    const p = toScene(sp);
    if (e.button === 1 || spaceDown || tool.value === "hand") {
        e.preventDefault();
        g = { kind: "pan", sx: e.clientX, sy: e.clientY, vx: vp.x, vy: vp.y };
        cursor.value = "grabbing";
        return;
    }
    if (e.button !== 0) return;
    const t = tool.value;
    if (t === "select") {
        const h = handleHit(sp);
        const only = sel.value[0];
        if (h && "box" in h) {
            g = { kind: "resize", id: only.id, handle: h.box, orig: cloneEl(only), changed: false, pre: take() };
            return;
        }
        if (h && "end" in h) {
            g = { kind: "end", id: only.id, idx: h.end, orig: cloneEl(only), changed: false, pre: take() };
            return;
        }
        const hit = hitTop(p);
        if (hit) {
            if (e.shiftKey) {
                if (selSet.value.has(hit.id)) {
                    selected.value = selected.value.filter((id) => id !== hit.id);
                    return;
                }
                selected.value = [...selected.value, hit.id];
            } else if (!selSet.value.has(hit.id)) selected.value = [hit.id];
            g = { kind: "move", start: p, orig: new Map(sel.value.map((s) => [s.id, [s.x, s.y] as Pt])), moved: false, pre: take() };
            // sel is recomputed lazily; rebuild orig from the fresh selection
            g.orig = new Map(elements.value.filter((s) => selected.value.includes(s.id)).map((s) => [s.id, [s.x, s.y] as Pt]));
        } else {
            const base = e.shiftKey ? selected.value.slice() : [];
            if (!e.shiftKey) selected.value = [];
            g = { kind: "marquee", start: p, cur: p, base };
        }
    } else if (t === "eraser") {
        g = { kind: "erase" };
        eraseAt(p);
    } else if (t === "text") {
        startTextAt(p);
    } else {
        const pre = take();
        const el = makeEl(t as ElType, p[0], p[1]);
        elements.value = [...elements.value, el];
        selected.value = [];
        g = { kind: "draw", id: el.id, start: p, pts: [p], pre };
    }
}

function onPointerMove(e: PointerEvent) {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    const gs = g;
    if (gs?.kind === "pinch") {
        if (ptrs.size < 2) return;
        const [a, b] = [...ptrs.values()];
        const r = cv.value!.getBoundingClientRect();
        const cx = (a[0] + b[0]) / 2 - r.left;
        const cy = (a[1] + b[1]) / 2 - r.top;
        const z = clampZoom((gs.zoom * Math.hypot(a[0] - b[0], a[1] - b[1])) / gs.dist);
        const spx = (gs.cx - gs.vx) / gs.zoom;
        const spy = (gs.cy - gs.vy) / gs.zoom;
        vp.zoom = z;
        vp.x = cx - spx * z;
        vp.y = cy - spy * z;
        return;
    }
    const sp = screenPt(e);
    const p = toScene(sp);
    if (!gs) {
        updateCursor(sp, p);
        return;
    }
    switch (gs.kind) {
        case "pan":
            vp.x = gs.vx + (e.clientX - gs.sx);
            vp.y = gs.vy + (e.clientY - gs.sy);
            break;
        case "move": {
            const dx = p[0] - gs.start[0];
            const dy = p[1] - gs.start[1];
            if (!gs.moved && Math.hypot(dx, dy) * vp.zoom < 3) return;
            gs.moved = true;
            for (const el of elements.value) {
                const o = gs.orig.get(el.id);
                if (o) { el.x = o[0] + dx; el.y = o[1] + dy; }
            }
            commit();
            markDirty();
            break;
        }
        case "resize": {
            const el = find(gs.id);
            if (!el) return;
            const o = gs.orig;
            const nb = resizeBox(elBounds(o), gs.handle, p, e.shiftKey || o.type === "image" || o.type === "text");
            gs.changed = true;
            if (o.type === "text") {
                el.fontSize = Math.max(8, Math.round((o.fontSize * nb.h) / Math.max(o.h, 1)));
                fitText(el);
                el.x = nb.x;
                el.y = nb.y;
            } else {
                el.x = nb.x; el.y = nb.y; el.w = nb.w; el.h = nb.h;
                if (o.type === "pen" && o.points) {
                    const sx = o.w > 0 ? nb.w / o.w : 1;
                    const sy = o.h > 0 ? nb.h / o.h : 1;
                    el.points = o.points.map((q) => [q[0] * sx, q[1] * sy] as Pt);
                }
            }
            commit();
            markDirty();
            break;
        }
        case "end": {
            const el = find(gs.id);
            if (!el) return;
            const abs = linearAbs(gs.orig);
            const other = abs[gs.idx === 0 ? abs.length - 1 : 0];
            abs[gs.idx] = e.shiftKey ? constrainAngle(other, p) : p;
            gs.changed = true;
            setLinearPoints(el, abs);
            commit();
            markDirty();
            break;
        }
        case "draw": {
            const el = find(gs.id);
            if (!el) return;
            if (el.type === "pen") {
                const last = gs.pts[gs.pts.length - 1];
                if (Math.hypot(p[0] - last[0], p[1] - last[1]) * vp.zoom < 1.5) return;
                gs.pts.push(p);
                setLinearPoints(el, gs.pts);
            } else if (el.type === "line" || el.type === "arrow") {
                setLinearPoints(el, [gs.start, e.shiftKey ? constrainAngle(gs.start, p) : p]);
            } else {
                const q = e.shiftKey ? constrainSquare(gs.start, p) : p;
                el.x = Math.min(gs.start[0], q[0]);
                el.y = Math.min(gs.start[1], q[1]);
                el.w = Math.abs(q[0] - gs.start[0]);
                el.h = Math.abs(q[1] - gs.start[1]);
            }
            commit();
            markDirty();
            break;
        }
        case "marquee": {
            gs.cur = p;
            const r = { x: Math.min(gs.start[0], p[0]), y: Math.min(gs.start[1], p[1]), w: Math.abs(p[0] - gs.start[0]), h: Math.abs(p[1] - gs.start[1]) };
            const inside = elements.value.filter((el) => rectContains(r, elBounds(el))).map((el) => el.id);
            selected.value = [...new Set([...gs.base, ...inside])];
            markDirty();
            break;
        }
        case "erase":
            eraseAt(p);
            break;
    }
}

function onPointerUp(e: PointerEvent) {
    ptrs.delete(e.pointerId);
    try { cv.value?.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
    const gs = g;
    if (!gs) return;
    if (gs.kind === "pinch") {
        if (ptrs.size < 2) g = null;
        return;
    }
    g = null;
    switch (gs.kind) {
        case "move":
            if (gs.moved) pushSnap(gs.pre);
            break;
        case "resize":
        case "end":
            if (gs.changed) pushSnap(gs.pre);
            break;
        case "draw": {
            const el = find(gs.id);
            if (!el) break;
            const tiny = el.type === "pen" ? false : isLinear(el) ? Math.hypot(el.w, el.h) < 3 : el.w < 3 && el.h < 3;
            if (tiny) {
                elements.value = elements.value.filter((x) => x.id !== gs.id);
                break;
            }
            if (el.type === "pen" && el.points && el.points.length === 1) setLinearPoints(el, [[el.x, el.y], [el.x + 0.01, el.y]]);
            pushSnap(gs.pre);
            if (!locked.value) {
                tool.value = "select";
                selected.value = [el.id];
            }
            break;
        }
        case "erase":
            if (erasing.size) {
                pushHistory();
                forgetDrawables(erasing);
                elements.value = elements.value.filter((el) => !erasing.has(el.id));
                selected.value = selected.value.filter((id) => !erasing.has(id));
                erasing.clear();
            }
            break;
        default:
            break;
    }
    commit();
    markDirty();
    updateCursor(null, null);
}
function onPointerCancel(e: PointerEvent) {
    ptrs.delete(e.pointerId);
    cancelGesture();
}

function onWheel(e: WheelEvent) {
    const [sx, sy] = screenPt(e);
    if (e.ctrlKey || e.metaKey) zoomAt(sx, sy, vp.zoom * Math.exp(-e.deltaY * 0.0125));
    else if (e.shiftKey && !e.deltaX) vp.x -= e.deltaY;
    else {
        vp.x -= e.deltaX;
        vp.y -= e.deltaY;
    }
}

function onDblClick(e: MouseEvent) {
    if (tool.value === "hand" || tool.value === "eraser") return;
    const p = toScene(screenPt(e));
    // Double-clicking inside a hollow shape edits its label, even though a hollow shape is
    // otherwise only hit on its outline.
    const hit = hitTop(p) ?? shapeContaining(p);
    if (hit) startEdit(hit);
    else startTextAt(p);
}
function shapeContaining(p: Pt): El | null {
    const list = elements.value;
    for (let i = list.length - 1; i >= 0; i--) {
        const el = list[i];
        if (isShape(el) && hitElement({ ...el, backgroundColor: "#000", fillStyle: "solid" }, p[0], p[1], 0)) return el;
    }
    return null;
}

// ---- images ---------------------------------------------------------------
const images: ImageCache = new Map();
const readDataUrl = (f: Blob) => new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
});
const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("decode"));
    i.src = src;
});

async function addImageFile(file: File, at?: Pt) {
    if (!file.type.startsWith("image/")) return;
    try {
        let url = await readDataUrl(file);
        const img = await loadImg(url);
        let w = img.naturalWidth || 300;
        let h = img.naturalHeight || 200;
        const k = Math.min(1, 1600 / Math.max(w, h));
        if (k < 1) {
            const c = document.createElement("canvas");
            c.width = Math.round(w * k);
            c.height = Math.round(h * k);
            c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
            url = c.toDataURL(file.type === "image/jpeg" ? "image/jpeg" : "image/png", 0.92);
            w = c.width;
            h = c.height;
        }
        const s = Math.min(1, (size.w / vp.zoom * 0.6) / w, (size.h / vp.zoom * 0.6) / h);
        const dw = w * s;
        const dh = h * s;
        const center = at ?? toScene([size.w / 2, size.h / 2]);
        const el = makeEl("image", center[0] - dw / 2, center[1] - dh / 2);
        el.w = dw;
        el.h = dh;
        el.dataUrl = url;
        pushHistory();
        elements.value = [...elements.value, el];
        selected.value = [el.id];
        tool.value = "select";
    } catch {
        flash("Could not read that image", "error");
    }
}
function onImagePicked(e: Event) {
    const input = e.target as HTMLInputElement;
    for (const f of Array.from(input.files ?? [])) void addImageFile(f);
    input.value = "";
    popover.value = null;
}
function onDrop(e: DragEvent) {
    const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    e.preventDefault();
    const p = toScene(screenPt(e));
    files.forEach((f, i) => void addImageFile(f, [p[0] + i * 24, p[1] + i * 24]));
}

// ---- keyboard / clipboard (window-level, gated) -----------------------------
let isActive = true;
let hovering = false;
let focused = false;
const isTyping = (t: EventTarget | null) => {
    const el = t as HTMLElement | null;
    return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};
const canAct = (e: Event) => isActive && (hovering || focused) && !isTyping(e.target);
const KEYMAP: Record<string, Tool> = {};
for (const t of TOOLS) {
    KEYMAP[t.key.toLowerCase()] = t.id;
    KEYMAP[t.num] = t.id;
}

function onKeyDown(e: KeyboardEvent) {
    if (!canAct(e)) return;
    const k = e.key;
    const mod = e.ctrlKey || e.metaKey;
    if (k === " ") {
        e.preventDefault();
        if (!spaceDown) { spaceDown = true; updateCursor(null, null); }
        return;
    }
    if (mod) {
        const lk = k.toLowerCase();
        if (lk === "z") e.shiftKey ? redo() : undo();
        else if (lk === "y") redo();
        else if (lk === "a") selectAll();
        else if (lk === "d") duplicate();
        else if (lk === "c") copySel();
        else if (lk === "x") { copySel(); deleteSelected(); }
        else if (lk === "s") saveJson();
        else if (k === "=" || k === "+") zoomBy(1.2);
        else if (k === "-") zoomBy(1 / 1.2);
        else if (k === "0") resetZoom();
        else return;
        e.preventDefault();
        return;
    }
    if (e.altKey) return;
    if (k === "Escape") {
        if (g) cancelGesture();
        else if (selected.value.length || tool.value !== "select") {
            selected.value = [];
            tool.value = "select";
        } else return;
        e.preventDefault();
    } else if (k === "Delete" || k === "Backspace") {
        e.preventDefault();
        deleteSelected();
    } else if (k.startsWith("Arrow") && selected.value.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = k === "ArrowLeft" ? -step : k === "ArrowRight" ? step : 0;
        const dy = k === "ArrowUp" ? -step : k === "ArrowDown" ? step : 0;
        if (!nudging) pushHistory();
        nudging = true;
        clearTimeout(nudgeTimer);
        nudgeTimer = window.setTimeout(() => (nudging = false), 600);
        for (const el of sel.value) { el.x += dx; el.y += dy; }
        commit();
    } else if (k === "!") {
        fit();
    } else if (KEYMAP[k.toLowerCase()] && !e.shiftKey) {
        e.preventDefault();
        tool.value = KEYMAP[k.toLowerCase()];
    }
}
let nudging = false;
let nudgeTimer = 0;
function onKeyUp(e: KeyboardEvent) {
    if (e.key === " " && spaceDown) {
        spaceDown = false;
        updateCursor(null, null);
    }
}
function onPaste(e: ClipboardEvent) {
    if (!canAct(e)) return;
    const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (files.length) {
        e.preventDefault();
        files.forEach((f) => void addImageFile(f));
    } else if (clipboard.length) {
        e.preventDefault();
        pasteClip();
    }
}
const onWinBlur = () => { spaceDown = false; };

// ---- persistence ------------------------------------------------------------
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
function parseScene(raw: unknown): { els: El[]; view?: { x: number; y: number; zoom: number }; grid?: boolean } | null {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    if (!Array.isArray(o.elements)) return null;
    const TYPES = ["rectangle", "diamond", "ellipse", "arrow", "line", "pen", "text", "image"];
    const els: El[] = [];
    for (const it of o.elements as Record<string, unknown>[]) {
        if (!it || typeof it !== "object" || typeof it.type !== "string" || !TYPES.includes(it.type)) continue;
        const el = { ...DEFAULT_STYLE, ...(it as object) } as El;
        el.id = typeof it.id === "string" ? it.id : uid();
        el.x = num(it.x, 0); el.y = num(it.y, 0); el.w = num(it.w, 0); el.h = num(it.h, 0);
        el.seed = num(it.seed, newSeed());
        if (isLinear(el)) {
            const pts = Array.isArray(it.points) ? (it.points as unknown[]).filter((p): p is Pt => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number")) : [];
            if (!pts.length) continue;
            el.points = pts;
        }
        if (el.type === "image" && typeof el.dataUrl !== "string") continue;
        if (el.type === "text") { el.text = String(el.text ?? ""); fitText(el); }
        els.push(el);
    }
    const v = o.view as Record<string, unknown> | undefined;
    return { els, view: v ? { x: num(v.x, 0), y: num(v.y, 0), zoom: clampZoom(num(v.zoom, 1)) } : undefined, grid: typeof o.grid === "boolean" ? o.grid : undefined };
}
const sceneObject = () => ({ type: "hand-drawn-whiteboard", version: 1, elements: elements.value, view: { x: vp.x, y: vp.y, zoom: vp.zoom }, grid: showGrid.value });
const persist = useDebounceFn(() => {
    try {
        localStorage.setItem(SCENE_KEY, JSON.stringify(sceneObject()));
        saveWarn.value = "";
    } catch {
        saveWarn.value = "Autosave failed: browser storage is full or unavailable. Use Save .json to keep your work.";
    }
}, 600);

function saveJson() {
    downloadBlob(JSON.stringify(sceneObject(), null, 2), "whiteboard.json", "application/json");
    popover.value = null;
}
async function openJson(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = "";
    popover.value = null;
    if (!f) return;
    try {
        const parsed = parseScene(JSON.parse(await f.text()));
        if (!parsed) throw new Error("bad");
        pushHistory();
        elements.value = parsed.els;
        selected.value = [];
        if (parsed.grid !== undefined) showGrid.value = parsed.grid;
        fit();
        flash(`Opened ${parsed.els.length} element${parsed.els.length === 1 ? "" : "s"}`);
    } catch {
        flash("That file is not a valid whiteboard .json", "error");
    }
}
function newScene() {
    popover.value = null;
    if (elements.value.length && !window.confirm("Clear the whole canvas? You can still undo this.")) return;
    pushHistory();
    forgetDrawables(elements.value.map((e) => e.id));
    elements.value = [];
    selected.value = [];
}

// ---- export -----------------------------------------------------------------
const exportOpts = () => ({ padding: exp.padding, background: exp.background ? (exp.dark ? BG_DARK : BG_LIGHT) : null, dark: exp.dark, scale: exp.scale });
async function exportPng() {
    const c = await renderToCanvas(exportEls.value, images, exportOpts());
    if (!c) return flash("Nothing to export", "error");
    c.toBlob((b) => b && downloadBlob(b, "whiteboard.png", "image/png"), "image/png");
}
function exportSvg() {
    const svg = renderToSvg(exportEls.value, exportOpts());
    if (!svg) return flash("Nothing to export", "error");
    downloadBlob(svg, "whiteboard.svg", "image/svg+xml");
}
function copyPng() {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return flash("Copying images is not supported in this browser", "error");
    const blob = (async () => {
        const c = await renderToCanvas(exportEls.value, images, exportOpts());
        if (!c) throw new Error("empty");
        return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/png"));
    })();
    navigator.clipboard
        .write([new ClipboardItem({ "image/png": blob })])
        .then(() => flash("PNG copied to clipboard"))
        .catch(() => flash("Could not copy to the clipboard", "error"));
}

// ---- rendering --------------------------------------------------------------
let raf = 0;
let rc: RoughCanvas | null = null;
let rcFor: HTMLCanvasElement | null = null;
function markDirty() {
    if (raf || !isActive) return;
    raf = requestAnimationFrame(() => {
        raf = 0;
        render();
    });
}

function render() {
    const c = cv.value;
    if (!c || !size.w || !size.h) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    if (rcFor !== c) { rc = rough.canvas(c); rcFor = c; }
    const dpr = c.width / size.w;
    const dark = isDark.value;
    const z = vp.zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = dark ? BG_DARK : BG_LIGHT;
    ctx.fillRect(0, 0, c.width, c.height);
    if (showGrid.value) {
        let step = 20;
        while (step * z < 14) step *= 5;
        const sp = step * z;
        const ox = ((vp.x % sp) + sp) % sp;
        const oy = ((vp.y % sp) + sp) % sp;
        ctx.fillStyle = dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.16)";
        for (let x = ox; x < size.w; x += sp) for (let y = oy; y < size.h; y += sp) ctx.fillRect(Math.round(x * dpr), Math.round(y * dpr), Math.max(1, dpr), Math.max(1, dpr));
    }
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * vp.x, dpr * vp.y);
    const vx1 = -vp.x / z, vy1 = -vp.y / z, vx2 = (size.w - vp.x) / z, vy2 = (size.h - vp.y) / z;
    const hideId = editing.value?.proto.id ?? null;
    const env = { dark, images, hideTextId: hideId, fade: erasing };
    for (const el of elements.value) {
        if (!isVisible(el, vx1, vy1, vx2, vy2)) continue;
        if (el.type === "image" && !images.has(el.id)) void loadImage(el, images, markDirty);
        drawElement(ctx, rc!, el, env);
    }
    // overlays
    const accent = dark ? "#34d4bf" : "#00776e";
    const lw = 1 / z;
    const hs = 8 / z;
    const chosen = sel.value;
    ctx.lineWidth = lw;
    ctx.strokeStyle = accent;
    if (chosen.length) {
        if (chosen.length > 1) {
            ctx.globalAlpha = 0.5;
            for (const el of chosen) ctx.strokeRect(el.x, el.y, el.w, el.h);
            ctx.globalAlpha = 1;
        }
        const b = unionBounds(chosen)!;
        const single = chosen.length === 1 ? chosen[0] : null;
        const bx = single ? elBounds(single) : b;
        if (!single || (single.type !== "line" && single.type !== "arrow")) {
            ctx.setLineDash([5 / z, 4 / z]);
            ctx.strokeRect(bx.x, bx.y, bx.w, bx.h);
            ctx.setLineDash([]);
        }
        ctx.fillStyle = dark ? BG_DARK : BG_LIGHT;
        const dot = (p: Pt, round: boolean) => {
            ctx.beginPath();
            if (round) ctx.arc(p[0], p[1], hs / 1.6, 0, Math.PI * 2);
            else ctx.rect(p[0] - hs / 2, p[1] - hs / 2, hs, hs);
            ctx.fill();
            ctx.stroke();
        };
        if (single && (single.type === "line" || single.type === "arrow")) {
            const pts = linearAbs(single);
            dot(pts[0], true);
            dot(pts[pts.length - 1], true);
        } else if (single) {
            const hp = handlePoints(bx);
            for (const id of HANDLE_IDS) dot(hp[id], false);
        }
    }
    const gs = g;
    if (gs?.kind === "marquee") {
        ctx.fillStyle = dark ? "rgba(52,212,191,0.10)" : "rgba(0,119,110,0.08)";
        const x = Math.min(gs.start[0], gs.cur[0]), y = Math.min(gs.start[1], gs.cur[1]);
        const w = Math.abs(gs.cur[0] - gs.start[0]), h = Math.abs(gs.cur[1] - gs.start[1]);
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
    }
}

function resizeCanvas() {
    const c = cv.value;
    const h = host.value;
    if (!c || !h) return;
    const w = h.clientWidth;
    const ht = h.clientHeight;
    if (!w || !ht) return;
    const dpr = window.devicePixelRatio || 1;
    size.w = w;
    size.h = ht;
    c.width = Math.round(w * dpr);
    c.height = Math.round(ht * dpr);
    markDirty();
}

let ro: ResizeObserver | null = null;
function addGlobal() {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("paste", onPaste);
    window.addEventListener("blur", onWinBlur);
}
function removeGlobal() {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("paste", onPaste);
    window.removeEventListener("blur", onWinBlur);
}

onMounted(() => {
    try {
        const raw = localStorage.getItem(SCENE_KEY);
        const parsed = raw ? parseScene(JSON.parse(raw)) : null;
        if (parsed) {
            elements.value = parsed.els;
            if (parsed.view) Object.assign(vp, parsed.view);
            if (parsed.grid !== undefined) showGrid.value = parsed.grid;
        }
    } catch { /* corrupt or unavailable storage: start empty */ }
    ro = new ResizeObserver(resizeCanvas);
    if (host.value) ro.observe(host.value);
    resizeCanvas();
    addGlobal();
    markDirty();
});
onActivated(() => {
    isActive = true;
    addGlobal();
    resizeCanvas();
    markDirty();
});
onDeactivated(() => {
    isActive = false;
    removeGlobal();
    spaceDown = false;
    hovering = false;
    focused = false;
    commitEdit();
    cancelGesture();
    cancelAnimationFrame(raf);
    raf = 0;
});
onBeforeUnmount(() => {
    removeGlobal();
    ro?.disconnect();
    cancelAnimationFrame(raf);
    clearTimeout(statusTimer);
    clearTimeout(nudgeTimer);
});

watch([selected, elements, () => vp.x, () => vp.y, () => vp.zoom, showGrid, isDark, () => size.w, () => size.h, () => editing.value?.proto.id], markDirty);
watch([elements, () => vp.x, () => vp.y, () => vp.zoom, showGrid], () => persist());
watch(tool, (t) => {
    if (editing.value) commitEdit();
    if (t !== "select") selected.value = [];
    updateCursor(null, null);
});
onClickOutside(popEl, () => (popover.value = null), { ignore: ["[data-pop]"] });

const togglePop = (p: "file" | "export" | "help") => (popover.value = popover.value === p ? null : p);
const seg = (on: boolean) => [
    "h-7 flex-1 cursor-pointer rounded-md px-1.5 text-xs transition-colors",
    on ? "bg-accent-soft font-semibold text-accent" : "bg-subtle text-muted hover:text-fg",
];
const checker = "repeating-conic-gradient(#c8c8c8 0% 25%, #fff 0% 50%) 0 0 / 8px 8px";
const zoomPct = computed(() => `${Math.round(vp.zoom * 100)}%`);
const fontCss = (f: FontFamily) => ({ fontFamily: FONT_STACKS[f] });
</script>

<template>
    <ToolPage>
        <div
            ref="root"
            class="outline-none"
            tabindex="-1"
            @mouseenter="hovering = true"
            @mouseleave="hovering = false"
            @focusin="focused = true"
            @focusout="focused = false"
        >
            <Panel flush>
                <template #title>Whiteboard</template>
                <template #actions>
                    <Btn size="sm" variant="ghost" aria-label="Undo" title="Undo (Ctrl+Z)" :disabled="!canUndo" @click="undo"><Undo2 /></Btn>
                    <Btn size="sm" variant="ghost" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" :disabled="!canRedo" @click="redo"><Redo2 /></Btn>
                    <Btn size="sm" variant="ghost" data-pop title="File menu" @click="togglePop('file')"><MenuIcon /> File</Btn>
                    <Btn size="sm" variant="ghost" data-pop title="Export image" @click="togglePop('export')"><ImageDown /> Export</Btn>
                    <Btn size="sm" variant="ghost" data-pop aria-label="Keyboard shortcuts" title="Keyboard shortcuts" @click="togglePop('help')"><CircleHelp /></Btn>
                </template>

                <div
                    ref="host"
                    class="relative w-full overflow-hidden"
                    style="height: max(420px, calc(100dvh - 15rem))"
                    @dragover.prevent
                    @drop="onDrop"
                >
                    <canvas
                        ref="cv"
                        class="absolute inset-0 block size-full touch-none select-none"
                        :style="{ cursor }"
                        aria-label="Whiteboard canvas"
                        @pointerdown="onPointerDown"
                        @pointermove="onPointerMove"
                        @pointerup="onPointerUp"
                        @pointercancel="onPointerCancel"
                        @wheel.prevent="onWheel"
                        @dblclick="onDblClick"
                        @contextmenu.prevent
                    />

                    <!-- toolbar -->
                    <div class="absolute top-3 left-1/2 z-10 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-xl border border-line bg-surface p-1 shadow-float">
                        <button
                            type="button"
                            class="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg transition-colors"
                            :class="locked ? 'bg-accent-soft text-accent' : 'text-muted hover:text-fg'"
                            :aria-pressed="locked"
                            :title="locked ? 'Tool lock on: keeps the tool after drawing' : 'Tool lock off: returns to Select after drawing'"
                            @click="locked = !locked"
                        >
                            <Lock v-if="locked" class="size-4" /><LockOpen v-else class="size-4" />
                        </button>
                        <span class="mx-0.5 h-5 w-px shrink-0 bg-line" />
                        <button
                            v-for="t in TOOLS" :key="t.id" type="button"
                            class="relative grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg transition-colors"
                            :class="tool === t.id ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-subtle hover:text-fg'"
                            :title="`${t.label} (${t.key} / ${t.num})`" :aria-label="t.label" :aria-pressed="tool === t.id"
                            @click="tool = t.id"
                        >
                            <component :is="t.icon" class="size-4" />
                            <span class="absolute right-1 bottom-0.5 text-[8px] leading-none text-muted">{{ t.num }}</span>
                        </button>
                    </div>

                    <!-- style panel -->
                    <div v-if="showStyle" class="absolute top-16 left-3 z-10 max-h-[calc(100%-5.5rem)] w-52 space-y-3 overflow-y-auto rounded-xl border border-line bg-surface p-3 shadow-float">
                        <div v-if="hasStroke || kinds.has('text')">
                            <div class="mb-1.5 text-xs font-medium text-muted">{{ kinds.has('text') && !hasStroke ? 'Text color' : 'Stroke' }}</div>
                            <div class="flex flex-wrap items-center gap-1.5">
                                <button
                                    v-for="c in STROKES" :key="c" type="button" :title="c" :aria-label="`Stroke ${c}`"
                                    class="size-6 cursor-pointer rounded-md ring-1 ring-line"
                                    :class="cur.strokeColor === c ? 'ring-2 ring-accent ring-offset-1 ring-offset-surface' : ''"
                                    :style="{ background: c }" @click="setStyle({ strokeColor: c })"
                                />
                                <input type="color" class="size-6 cursor-pointer rounded-md border border-line bg-surface p-0" aria-label="Custom stroke color" :value="cur.strokeColor" @input="setStyle({ strokeColor: ($event.target as HTMLInputElement).value })" />
                            </div>
                        </div>

                        <template v-if="hasFill">
                            <div>
                                <div class="mb-1.5 text-xs font-medium text-muted">Background</div>
                                <div class="flex flex-wrap items-center gap-1.5">
                                    <button
                                        v-for="c in BACKGROUNDS" :key="c" type="button" :title="c === 'transparent' ? 'Transparent' : c" :aria-label="`Background ${c}`"
                                        class="size-6 cursor-pointer rounded-md ring-1 ring-line"
                                        :class="cur.backgroundColor === c ? 'ring-2 ring-accent ring-offset-1 ring-offset-surface' : ''"
                                        :style="{ background: c === 'transparent' ? checker : c }" @click="setStyle({ backgroundColor: c })"
                                    />
                                    <input type="color" class="size-6 cursor-pointer rounded-md border border-line bg-surface p-0" aria-label="Custom background color" :value="cur.backgroundColor === 'transparent' ? '#ffffff' : cur.backgroundColor" @input="setStyle({ backgroundColor: ($event.target as HTMLInputElement).value })" />
                                </div>
                            </div>
                            <div>
                                <div class="mb-1.5 text-xs font-medium text-muted">Fill</div>
                                <div class="flex gap-1">
                                    <button v-for="f in FILLS" :key="f.v" type="button" :class="seg(cur.fillStyle === f.v)" @click="setStyle({ fillStyle: f.v })">{{ f.label }}</button>
                                </div>
                            </div>
                        </template>

                        <template v-if="hasStroke">
                            <div>
                                <div class="mb-1.5 text-xs font-medium text-muted">Stroke width</div>
                                <div class="flex gap-1">
                                    <button v-for="w in WIDTHS" :key="w.v" type="button" :class="seg(cur.strokeWidth === w.v)" @click="setStyle({ strokeWidth: w.v })">{{ w.label }}</button>
                                </div>
                            </div>
                            <div>
                                <div class="mb-1.5 text-xs font-medium text-muted">Stroke style</div>
                                <div class="flex gap-1">
                                    <button v-for="s in STROKE_STYLES" :key="s.v" type="button" :class="seg(cur.strokeStyle === s.v)" @click="setStyle({ strokeStyle: s.v })">{{ s.label }}</button>
                                </div>
                            </div>
                            <div v-if="!kinds.has('pen')">
                                <div class="mb-1.5 text-xs font-medium text-muted">Sloppiness</div>
                                <div class="flex gap-1">
                                    <button v-for="r in ROUGHNESS" :key="r.v" type="button" :class="seg(cur.roughness === r.v)" @click="setStyle({ roughness: r.v })">{{ r.label }}</button>
                                </div>
                            </div>
                        </template>

                        <template v-if="hasArrow">
                            <div>
                                <div class="mb-1.5 text-xs font-medium text-muted">Start</div>
                                <div class="flex gap-1">
                                    <button v-for="h in HEADS" :key="h.v" type="button" :class="seg(cur.startHead === h.v)" @click="setStyle({ startHead: h.v })">{{ h.label }}</button>
                                </div>
                            </div>
                            <div>
                                <div class="mb-1.5 text-xs font-medium text-muted">End</div>
                                <div class="flex gap-1">
                                    <button v-for="h in HEADS" :key="h.v" type="button" :class="seg(cur.endHead === h.v)" @click="setStyle({ endHead: h.v })">{{ h.label }}</button>
                                </div>
                            </div>
                        </template>

                        <template v-if="hasText">
                            <div>
                                <div class="mb-1.5 text-xs font-medium text-muted">Font</div>
                                <div class="flex gap-1">
                                    <button v-for="f in FONTS" :key="f.v" type="button" :class="seg(cur.fontFamily === f.v)" :style="fontCss(f.v)" @click="setStyle({ fontFamily: f.v })">{{ f.label }}</button>
                                </div>
                            </div>
                            <div>
                                <div class="mb-1.5 text-xs font-medium text-muted">Font size</div>
                                <div class="flex gap-1">
                                    <button v-for="f in FONT_SIZES" :key="f.v" type="button" :class="seg(cur.fontSize === f.v)" @click="setStyle({ fontSize: f.v })">{{ f.label }}</button>
                                </div>
                            </div>
                        </template>

                        <div>
                            <label class="mb-1.5 flex justify-between text-xs font-medium text-muted" for="wb-opacity"><span>Opacity</span><span>{{ cur.opacity }}%</span></label>
                            <input id="wb-opacity" type="range" min="10" max="100" step="5" class="range" :value="cur.opacity" @input="setStyle({ opacity: Number(($event.target as HTMLInputElement).value) })" />
                        </div>

                        <div v-if="sel.length">
                            <div class="mb-1.5 text-xs font-medium text-muted">Layers</div>
                            <div class="flex gap-1">
                                <Btn size="sm" class="flex-1" title="Send to back" aria-label="Send to back" @click="reorder('back')"><ChevronsDown /></Btn>
                                <Btn size="sm" class="flex-1" title="Send backward" aria-label="Send backward" @click="reorder('backward')"><ChevronDown /></Btn>
                                <Btn size="sm" class="flex-1" title="Bring forward" aria-label="Bring forward" @click="reorder('forward')"><ChevronUp /></Btn>
                                <Btn size="sm" class="flex-1" title="Bring to front" aria-label="Bring to front" @click="reorder('front')"><ChevronsUp /></Btn>
                            </div>
                            <div class="mt-1.5 flex gap-1">
                                <Btn size="sm" class="flex-1" title="Duplicate (Ctrl+D)" @click="duplicate"><CopyPlus /> Duplicate</Btn>
                                <Btn size="sm" variant="danger" class="flex-1" title="Delete" @click="deleteSelected"><Trash2 /> Delete</Btn>
                            </div>
                        </div>
                    </div>

                    <!-- zoom controls -->
                    <div class="absolute bottom-3 left-3 z-10 flex items-center gap-0.5 rounded-xl border border-line bg-surface p-1 shadow-float">
                        <Btn size="sm" variant="ghost" aria-label="Zoom out" title="Zoom out (Ctrl+-)" @click="zoomBy(1 / 1.2)"><Minus /></Btn>
                        <button type="button" class="h-7 min-w-12 cursor-pointer rounded-md px-1 text-xs text-fg hover:bg-subtle" title="Reset zoom to 100%" @click="resetZoom">{{ zoomPct }}</button>
                        <Btn size="sm" variant="ghost" aria-label="Zoom in" title="Zoom in (Ctrl++)" @click="zoomBy(1.2)"><Plus /></Btn>
                        <Btn size="sm" variant="ghost" aria-label="Zoom to fit content" title="Zoom to fit content (Shift+1)" @click="fit"><Maximize /></Btn>
                        <Btn size="sm" variant="ghost" aria-label="Toggle grid" title="Toggle dot grid" :class="showGrid ? 'text-accent' : ''" @click="showGrid = !showGrid"><Grid3x3 /></Btn>
                    </div>

                    <!-- text editor overlay -->
                    <textarea
                        v-if="editing && editBox"
                        ref="editEl"
                        v-model="editing.value"
                        class="absolute z-20 m-0 resize-none overflow-hidden border-0 bg-transparent p-0 whitespace-pre outline-1 outline-dashed outline-accent"
                        :style="editBox"
                        spellcheck="false"
                        aria-label="Edit text"
                        @keydown.enter.exact.prevent="commitEditAndRefocus"
                        @keydown.esc.prevent="commitEditAndRefocus"
                        @keydown.stop
                        @blur="commitEdit"
                        @pointerdown.stop
                    />

                    <!-- status toast -->
                    <div v-if="status" class="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full px-3 py-1.5 text-xs shadow-float" :class="status.kind === 'error' ? 'bg-danger-soft text-danger' : 'bg-inverse text-inverse-fg'" role="status">{{ status.msg }}</div>

                    <!-- popovers -->
                    <div v-if="popover" ref="popEl" class="absolute top-3 right-3 z-30 max-h-[calc(100%-1.5rem)] w-72 max-w-[calc(100%-1.5rem)] overflow-y-auto rounded-xl border border-line bg-surface p-2 shadow-float">
                        <template v-if="popover === 'file'">
                            <button type="button" class="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-fg hover:bg-subtle" @click="newScene"><FilePlus class="size-4 text-muted" /> New / clear canvas</button>
                            <button type="button" class="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-fg hover:bg-subtle" @click="jsonInput?.click()"><FolderOpen class="size-4 text-muted" /> Open .json</button>
                            <button type="button" class="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-fg hover:bg-subtle" @click="saveJson"><Save class="size-4 text-muted" /> Save .json</button>
                            <button type="button" class="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-fg hover:bg-subtle" @click="imageInput?.click()"><ImagePlus class="size-4 text-muted" /> Insert image</button>
                            <div class="mt-1 flex flex-wrap gap-1 border-t border-line px-2.5 pt-2 text-xs text-muted">You can also paste or drop images on the canvas.</div>
                        </template>

                        <template v-else-if="popover === 'export'">
                            <div class="space-y-3 p-1.5">
                                <div>
                                    <div class="mb-1.5 text-xs font-medium text-muted">Scale</div>
                                    <div class="flex gap-1"><button v-for="s in [1, 2, 3]" :key="s" type="button" :class="seg(exp.scale === s)" @click="exp.scale = s">{{ s }}x</button></div>
                                </div>
                                <div>
                                    <label class="mb-1.5 flex justify-between text-xs font-medium text-muted" for="wb-pad"><span>Padding</span><span>{{ exp.padding }}px</span></label>
                                    <input id="wb-pad" v-model.number="exp.padding" type="range" min="0" max="100" step="4" class="range" />
                                </div>
                                <label class="flex items-center gap-2 text-sm text-fg"><input v-model="exp.background" type="checkbox" class="checkbox" /> Include background</label>
                                <label class="flex items-center gap-2 text-sm text-fg"><input v-model="exp.dark" type="checkbox" class="checkbox" /> Dark theme</label>
                                <label v-if="sel.length" class="flex items-center gap-2 text-sm text-fg"><input v-model="exp.onlySel" type="checkbox" class="checkbox" /> Only selection ({{ sel.length }})</label>
                                <div class="grid grid-cols-2 gap-1.5">
                                    <Btn variant="primary" size="sm" @click="exportPng"><Download /> PNG</Btn>
                                    <Btn size="sm" @click="exportSvg"><Download /> SVG</Btn>
                                </div>
                                <Btn size="sm" class="w-full" @click="copyPng"><Copy /> Copy PNG to clipboard</Btn>
                            </div>
                        </template>

                        <template v-else>
                            <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 p-1.5 text-xs">
                                <template v-for="[k, d] in SHORTCUTS" :key="k">
                                    <dt><span class="kbd whitespace-nowrap">{{ k }}</span></dt>
                                    <dd class="self-center text-fg">{{ d }}</dd>
                                </template>
                            </dl>
                        </template>
                    </div>
                </div>
            </Panel>

            <input ref="jsonInput" type="file" accept=".json,application/json" class="hidden" @change="openJson" />
            <input ref="imageInput" type="file" accept="image/*" multiple class="hidden" @change="onImagePicked" />
            <Notice v-if="saveWarn" type="warning" class="mt-3">{{ saveWarn }}</Notice>
        </div>
    </ToolPage>
</template>
