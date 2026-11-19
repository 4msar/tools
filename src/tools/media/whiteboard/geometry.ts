import { isFilled, isLinear, type Bounds, type El, type HandleId, type Pt } from "./types";

export const HANDLE_IDS: HandleId[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export function linearAbs(el: El): Pt[] {
    return (el.points ?? []).map((p) => [p[0] + el.x, p[1] + el.y] as Pt);
}

/** Store absolute points relative to their own bounding box. */
export function setLinearPoints(el: El, abs: Pt[]) {
    const xs = abs.map((p) => p[0]);
    const ys = abs.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    el.x = minX;
    el.y = minY;
    el.w = Math.max(...xs) - minX;
    el.h = Math.max(...ys) - minY;
    el.points = abs.map((p) => [p[0] - minX, p[1] - minY] as Pt);
}

export const elBounds = (el: El): Bounds => ({ x: el.x, y: el.y, w: el.w, h: el.h });

export function unionBounds(els: El[]): Bounds | null {
    if (!els.length) return null;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const e of els) {
        const pad = isLinear(e) ? e.strokeWidth : 0;
        x1 = Math.min(x1, e.x - pad);
        y1 = Math.min(y1, e.y - pad);
        x2 = Math.max(x2, e.x + e.w + pad);
        y2 = Math.max(y2, e.y + e.h + pad);
    }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export const rectsIntersect = (a: Bounds, b: Bounds) =>
    a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;

export const rectContains = (outer: Bounds, inner: Bounds) =>
    inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

export const pointInRect = (px: number, py: number, b: Bounds, tol = 0) =>
    px >= b.x - tol && px <= b.x + b.w + tol && py >= b.y - tol && py <= b.y + b.h + tol;

export function distToSeg(px: number, py: number, a: Pt, b: Pt): number {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

function pointInPoly(px: number, py: number, poly: Pt[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

function nearPoly(px: number, py: number, poly: Pt[], tol: number, closed = true): boolean {
    const n = closed ? poly.length : poly.length - 1;
    for (let i = 0; i < n; i++) if (distToSeg(px, py, poly[i], poly[(i + 1) % poly.length]) <= tol) return true;
    return false;
}

export function diamondPoly(el: El): Pt[] {
    return [[el.x + el.w / 2, el.y], [el.x + el.w, el.y + el.h / 2], [el.x + el.w / 2, el.y + el.h], [el.x, el.y + el.h / 2]];
}

export function hitElement(el: El, px: number, py: number, tol: number): boolean {
    const t = tol + el.strokeWidth / 2;
    switch (el.type) {
        case "text":
        case "image":
            return pointInRect(px, py, elBounds(el), tol);
        case "rectangle": {
            const b = elBounds(el);
            if (isFilled(el)) return pointInRect(px, py, b, t);
            const poly: Pt[] = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
            return nearPoly(px, py, poly, t);
        }
        case "diamond": {
            const poly = diamondPoly(el);
            return isFilled(el) ? pointInPoly(px, py, poly) || nearPoly(px, py, poly, t) : nearPoly(px, py, poly, t);
        }
        case "ellipse": {
            const a = Math.max(el.w / 2, 0.5);
            const b = Math.max(el.h / 2, 0.5);
            const dx = px - (el.x + el.w / 2);
            const dy = py - (el.y + el.h / 2);
            const r = Math.hypot(dx / a, dy / b);
            if (isFilled(el)) return r <= 1 + t / Math.min(a, b);
            return Math.abs(r - 1) * Math.min(a, b) <= t;
        }
        default:
            return nearPoly(px, py, linearAbs(el), t, false);
    }
}

export function handlePoints(b: Bounds): Record<HandleId, Pt> {
    const { x, y, w, h } = b;
    return {
        nw: [x, y], n: [x + w / 2, y], ne: [x + w, y], e: [x + w, y + h / 2],
        se: [x + w, y + h], s: [x + w / 2, y + h], sw: [x, y + h], w: [x, y + h / 2],
    };
}

/** New box when dragging `handle` of `orig` to point `p`. */
export function resizeBox(orig: Bounds, handle: HandleId, p: Pt, keepRatio: boolean): Bounds {
    let x1 = orig.x, y1 = orig.y, x2 = orig.x + orig.w, y2 = orig.y + orig.h;
    if (handle.includes("w")) x1 = p[0];
    if (handle.includes("e")) x2 = p[0];
    if (handle.includes("n")) y1 = p[1];
    if (handle.includes("s")) y2 = p[1];
    const corner = handle.length === 2;
    if (keepRatio && corner && orig.w > 0 && orig.h > 0) {
        const ax = handle.includes("w") ? orig.x + orig.w : orig.x;
        const ay = handle.includes("n") ? orig.y + orig.h : orig.y;
        const sx = handle.includes("w") ? -1 : 1;
        const sy = handle.includes("n") ? -1 : 1;
        const s = Math.max(Math.abs(p[0] - ax) / orig.w, Math.abs(p[1] - ay) / orig.h, 0.02);
        x1 = ax; x2 = ax + sx * orig.w * s;
        y1 = ay; y2 = ay + sy * orig.h * s;
    }
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    return { x, y, w: Math.max(Math.abs(x2 - x1), 1), h: Math.max(Math.abs(y2 - y1), 1) };
}

/** Snap `to` so the segment from `from` is a multiple of 45 degrees. */
export function constrainAngle(from: Pt, to: Pt): Pt {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.hypot(dx, dy);
    const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    return [from[0] + Math.cos(ang) * len, from[1] + Math.sin(ang) * len];
}

/** Square/circle constraint: equalise the drag extents. */
export function constrainSquare(from: Pt, to: Pt): Pt {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const s = Math.max(Math.abs(dx), Math.abs(dy));
    return [from[0] + Math.sign(dx || 1) * s, from[1] + Math.sign(dy || 1) * s];
}
