export type Pt = [number, number];
export interface Bounds { x: number; y: number; w: number; h: number }

export type ElType = "rectangle" | "diamond" | "ellipse" | "arrow" | "line" | "pen" | "text" | "image";
export type FillStyle = "hachure" | "cross-hatch" | "solid" | "none";
export type StrokeStyle = "solid" | "dashed" | "dotted";
export type FontFamily = "hand" | "normal" | "code";
export type Arrowhead = "none" | "arrow" | "triangle" | "dot";
export type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export interface Style {
    strokeColor: string;
    backgroundColor: string;
    fillStyle: FillStyle;
    strokeWidth: number;
    strokeStyle: StrokeStyle;
    roughness: number;
    opacity: number;
    fontSize: number;
    fontFamily: FontFamily;
    startHead: Arrowhead;
    endHead: Arrowhead;
}

export interface El extends Style {
    id: string;
    type: ElType;
    x: number;
    y: number;
    w: number;
    h: number;
    /** line / arrow / pen: points relative to (x, y) */
    points?: Pt[];
    seed: number;
    text?: string;
    dataUrl?: string;
}

export const DEFAULT_STROKE = "#1e1e1e";
export const DEFAULT_STYLE: Style = {
    strokeColor: DEFAULT_STROKE,
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    fontSize: 20,
    fontFamily: "hand",
    startHead: "none",
    endHead: "arrow",
};

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export function cloneEl(el: El): El {
    return { ...el, points: el.points?.map((p) => [p[0], p[1]] as Pt) };
}

export const isLinear = (el: El) => el.type === "line" || el.type === "arrow" || el.type === "pen";
export const isShape = (el: El) => el.type === "rectangle" || el.type === "diamond" || el.type === "ellipse";
export const isFilled = (el: El) => el.backgroundColor !== "transparent" && el.fillStyle !== "none";
