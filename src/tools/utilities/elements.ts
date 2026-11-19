export type Category =
    | "alkali metal"
    | "alkaline earth"
    | "transition metal"
    | "post-transition metal"
    | "metalloid"
    | "nonmetal"
    | "halogen"
    | "noble gas"
    | "lanthanide"
    | "actinide";

export type State = "solid" | "liquid" | "gas";

export interface Element {
    number: number;
    symbol: string;
    name: string;
    mass: number;
    category: Category;
    group: number | null; // null for lanthanides / actinides (f-block)
    period: number;
    config: string; // short form
    en: number | null; // Pauling electronegativity
    melt: number | null; // K
    boil: number | null; // K
    density: number | null; // g/cm3 (g/L for gases at STP)
    state: State; // at STP (predicted for the heaviest elements)
    year: number | null; // null = known since antiquity
}

const C: Record<string, Category> = {
    ak: "alkali metal",
    ae: "alkaline earth",
    tm: "transition metal",
    pt: "post-transition metal",
    md: "metalloid",
    nm: "nonmetal",
    hl: "halogen",
    ng: "noble gas",
    ln: "lanthanide",
    ac: "actinide",
};
const S: Record<string, State> = { s: "solid", l: "liquid", g: "gas" };

type Row = [number, string, string, number, string, number | null, number, string, number | null, number | null, number | null, number | null, string, number | null];

// [number, symbol, name, mass, cat, group, period, config, EN, melt K, boil K, density, state, year]
const rows: Row[] = [
    [1, "H", "Hydrogen", 1.008, "nm", 1, 1, "1s1", 2.2, 13.99, 20.271, 0.08988, "g", 1766],
    [2, "He", "Helium", 4.0026, "ng", 18, 1, "1s2", null, null, 4.222, 0.1786, "g", 1895],
    [3, "Li", "Lithium", 6.94, "ak", 1, 2, "[He] 2s1", 0.98, 453.65, 1603, 0.534, "s", 1817],
    [4, "Be", "Beryllium", 9.0122, "ae", 2, 2, "[He] 2s2", 1.57, 1560, 2742, 1.85, "s", 1798],
    [5, "B", "Boron", 10.81, "md", 13, 2, "[He] 2s2 2p1", 2.04, 2349, 4200, 2.34, "s", 1808],
    [6, "C", "Carbon", 12.011, "nm", 14, 2, "[He] 2s2 2p2", 2.55, 3823, 4098, 2.267, "s", null],
    [7, "N", "Nitrogen", 14.007, "nm", 15, 2, "[He] 2s2 2p3", 3.04, 63.15, 77.36, 1.2506, "g", 1772],
    [8, "O", "Oxygen", 15.999, "nm", 16, 2, "[He] 2s2 2p4", 3.44, 54.36, 90.2, 1.429, "g", 1774],
    [9, "F", "Fluorine", 18.998, "hl", 17, 2, "[He] 2s2 2p5", 3.98, 53.53, 85.03, 1.696, "g", 1886],
    [10, "Ne", "Neon", 20.18, "ng", 18, 2, "[He] 2s2 2p6", null, 24.56, 27.07, 0.9002, "g", 1898],
    [11, "Na", "Sodium", 22.99, "ak", 1, 3, "[Ne] 3s1", 0.93, 370.87, 1156, 0.971, "s", 1807],
    [12, "Mg", "Magnesium", 24.305, "ae", 2, 3, "[Ne] 3s2", 1.31, 923, 1363, 1.738, "s", 1755],
    [13, "Al", "Aluminium", 26.982, "pt", 13, 3, "[Ne] 3s2 3p1", 1.61, 933.47, 2792, 2.7, "s", 1825],
    [14, "Si", "Silicon", 28.085, "md", 14, 3, "[Ne] 3s2 3p2", 1.9, 1687, 3538, 2.329, "s", 1824],
    [15, "P", "Phosphorus", 30.974, "nm", 15, 3, "[Ne] 3s2 3p3", 2.19, 317.3, 553.65, 1.82, "s", 1669],
    [16, "S", "Sulfur", 32.06, "nm", 16, 3, "[Ne] 3s2 3p4", 2.58, 388.36, 717.87, 2.067, "s", null],
    [17, "Cl", "Chlorine", 35.45, "hl", 17, 3, "[Ne] 3s2 3p5", 3.16, 171.6, 239.11, 3.214, "g", 1774],
    [18, "Ar", "Argon", 39.948, "ng", 18, 3, "[Ne] 3s2 3p6", null, 83.8, 87.3, 1.784, "g", 1894],
    [19, "K", "Potassium", 39.098, "ak", 1, 4, "[Ar] 4s1", 0.82, 336.53, 1032, 0.862, "s", 1807],
    [20, "Ca", "Calcium", 40.078, "ae", 2, 4, "[Ar] 4s2", 1.0, 1115, 1757, 1.54, "s", 1808],
    [21, "Sc", "Scandium", 44.956, "tm", 3, 4, "[Ar] 3d1 4s2", 1.36, 1814, 3109, 2.989, "s", 1879],
    [22, "Ti", "Titanium", 47.867, "tm", 4, 4, "[Ar] 3d2 4s2", 1.54, 1941, 3560, 4.54, "s", 1791],
    [23, "V", "Vanadium", 50.942, "tm", 5, 4, "[Ar] 3d3 4s2", 1.63, 2183, 3680, 6.11, "s", 1801],
    [24, "Cr", "Chromium", 51.996, "tm", 6, 4, "[Ar] 3d5 4s1", 1.66, 2180, 2944, 7.15, "s", 1797],
    [25, "Mn", "Manganese", 54.938, "tm", 7, 4, "[Ar] 3d5 4s2", 1.55, 1519, 2334, 7.44, "s", 1774],
    [26, "Fe", "Iron", 55.845, "tm", 8, 4, "[Ar] 3d6 4s2", 1.83, 1811, 3134, 7.874, "s", null],
    [27, "Co", "Cobalt", 58.933, "tm", 9, 4, "[Ar] 3d7 4s2", 1.88, 1768, 3200, 8.86, "s", 1735],
    [28, "Ni", "Nickel", 58.693, "tm", 10, 4, "[Ar] 3d8 4s2", 1.91, 1728, 3186, 8.912, "s", 1751],
    [29, "Cu", "Copper", 63.546, "tm", 11, 4, "[Ar] 3d10 4s1", 1.9, 1357.77, 2835, 8.96, "s", null],
    [30, "Zn", "Zinc", 65.38, "tm", 12, 4, "[Ar] 3d10 4s2", 1.65, 692.68, 1180, 7.134, "s", null],
    [31, "Ga", "Gallium", 69.723, "pt", 13, 4, "[Ar] 3d10 4s2 4p1", 1.81, 302.91, 2477, 5.907, "s", 1875],
    [32, "Ge", "Germanium", 72.63, "md", 14, 4, "[Ar] 3d10 4s2 4p2", 2.01, 1211.4, 3106, 5.323, "s", 1886],
    [33, "As", "Arsenic", 74.922, "md", 15, 4, "[Ar] 3d10 4s2 4p3", 2.18, 1090, 887, 5.727, "s", null],
    [34, "Se", "Selenium", 78.971, "nm", 16, 4, "[Ar] 3d10 4s2 4p4", 2.55, 494, 958, 4.81, "s", 1817],
    [35, "Br", "Bromine", 79.904, "hl", 17, 4, "[Ar] 3d10 4s2 4p5", 2.96, 265.8, 332, 3.122, "l", 1826],
    [36, "Kr", "Krypton", 83.798, "ng", 18, 4, "[Ar] 3d10 4s2 4p6", 3.0, 115.79, 119.93, 3.749, "g", 1898],
    [37, "Rb", "Rubidium", 85.468, "ak", 1, 5, "[Kr] 5s1", 0.82, 312.46, 961, 1.532, "s", 1861],
    [38, "Sr", "Strontium", 87.62, "ae", 2, 5, "[Kr] 5s2", 0.95, 1050, 1655, 2.64, "s", 1790],
    [39, "Y", "Yttrium", 88.906, "tm", 3, 5, "[Kr] 4d1 5s2", 1.22, 1799, 3609, 4.469, "s", 1794],
    [40, "Zr", "Zirconium", 91.224, "tm", 4, 5, "[Kr] 4d2 5s2", 1.33, 2128, 4682, 6.506, "s", 1789],
    [41, "Nb", "Niobium", 92.906, "tm", 5, 5, "[Kr] 4d4 5s1", 1.6, 2750, 5017, 8.57, "s", 1801],
    [42, "Mo", "Molybdenum", 95.95, "tm", 6, 5, "[Kr] 4d5 5s1", 2.16, 2896, 4912, 10.22, "s", 1778],
    [43, "Tc", "Technetium", 98, "tm", 7, 5, "[Kr] 4d5 5s2", 1.9, 2430, 4538, 11.5, "s", 1937],
    [44, "Ru", "Ruthenium", 101.07, "tm", 8, 5, "[Kr] 4d7 5s1", 2.2, 2607, 4423, 12.37, "s", 1844],
    [45, "Rh", "Rhodium", 102.91, "tm", 9, 5, "[Kr] 4d8 5s1", 2.28, 2237, 3968, 12.41, "s", 1803],
    [46, "Pd", "Palladium", 106.42, "tm", 10, 5, "[Kr] 4d10", 2.2, 1828.05, 3236, 12.02, "s", 1803],
    [47, "Ag", "Silver", 107.87, "tm", 11, 5, "[Kr] 4d10 5s1", 1.93, 1234.93, 2435, 10.501, "s", null],
    [48, "Cd", "Cadmium", 112.41, "tm", 12, 5, "[Kr] 4d10 5s2", 1.69, 594.22, 1040, 8.69, "s", 1817],
    [49, "In", "Indium", 114.82, "pt", 13, 5, "[Kr] 4d10 5s2 5p1", 1.78, 429.75, 2345, 7.31, "s", 1863],
    [50, "Sn", "Tin", 118.71, "pt", 14, 5, "[Kr] 4d10 5s2 5p2", 1.96, 505.08, 2875, 7.287, "s", null],
    [51, "Sb", "Antimony", 121.76, "md", 15, 5, "[Kr] 4d10 5s2 5p3", 2.05, 903.78, 1860, 6.685, "s", null],
    [52, "Te", "Tellurium", 127.6, "md", 16, 5, "[Kr] 4d10 5s2 5p4", 2.1, 722.66, 1261, 6.232, "s", 1782],
    [53, "I", "Iodine", 126.9, "hl", 17, 5, "[Kr] 4d10 5s2 5p5", 2.66, 386.85, 457.4, 4.93, "s", 1811],
    [54, "Xe", "Xenon", 131.29, "ng", 18, 5, "[Kr] 4d10 5s2 5p6", 2.6, 161.4, 165.05, 5.894, "g", 1898],
    [55, "Cs", "Caesium", 132.91, "ak", 1, 6, "[Xe] 6s1", 0.79, 301.59, 944, 1.873, "s", 1860],
    [56, "Ba", "Barium", 137.33, "ae", 2, 6, "[Xe] 6s2", 0.89, 1000, 2170, 3.594, "s", 1808],
    [57, "La", "Lanthanum", 138.91, "ln", null, 6, "[Xe] 5d1 6s2", 1.1, 1193, 3737, 6.145, "s", 1839],
    [58, "Ce", "Cerium", 140.12, "ln", null, 6, "[Xe] 4f1 5d1 6s2", 1.12, 1068, 3716, 6.77, "s", 1803],
    [59, "Pr", "Praseodymium", 140.91, "ln", null, 6, "[Xe] 4f3 6s2", 1.13, 1208, 3793, 6.773, "s", 1885],
    [60, "Nd", "Neodymium", 144.24, "ln", null, 6, "[Xe] 4f4 6s2", 1.14, 1297, 3347, 7.007, "s", 1885],
    [61, "Pm", "Promethium", 145, "ln", null, 6, "[Xe] 4f5 6s2", 1.13, 1315, 3273, 7.26, "s", 1945],
    [62, "Sm", "Samarium", 150.36, "ln", null, 6, "[Xe] 4f6 6s2", 1.17, 1345, 2067, 7.52, "s", 1879],
    [63, "Eu", "Europium", 151.96, "ln", null, 6, "[Xe] 4f7 6s2", 1.2, 1099, 1802, 5.243, "s", 1901],
    [64, "Gd", "Gadolinium", 157.25, "ln", null, 6, "[Xe] 4f7 5d1 6s2", 1.2, 1585, 3546, 7.895, "s", 1880],
    [65, "Tb", "Terbium", 158.93, "ln", null, 6, "[Xe] 4f9 6s2", 1.1, 1629, 3503, 8.229, "s", 1843],
    [66, "Dy", "Dysprosium", 162.5, "ln", null, 6, "[Xe] 4f10 6s2", 1.22, 1680, 2840, 8.55, "s", 1886],
    [67, "Ho", "Holmium", 164.93, "ln", null, 6, "[Xe] 4f11 6s2", 1.23, 1734, 2993, 8.795, "s", 1878],
    [68, "Er", "Erbium", 167.26, "ln", null, 6, "[Xe] 4f12 6s2", 1.24, 1802, 3141, 9.066, "s", 1842],
    [69, "Tm", "Thulium", 168.93, "ln", null, 6, "[Xe] 4f13 6s2", 1.25, 1818, 2223, 9.321, "s", 1879],
    [70, "Yb", "Ytterbium", 173.05, "ln", null, 6, "[Xe] 4f14 6s2", 1.1, 1097, 1469, 6.965, "s", 1878],
    [71, "Lu", "Lutetium", 174.97, "ln", null, 6, "[Xe] 4f14 5d1 6s2", 1.27, 1925, 3675, 9.84, "s", 1907],
    [72, "Hf", "Hafnium", 178.49, "tm", 4, 6, "[Xe] 4f14 5d2 6s2", 1.3, 2506, 4876, 13.31, "s", 1923],
    [73, "Ta", "Tantalum", 180.95, "tm", 5, 6, "[Xe] 4f14 5d3 6s2", 1.5, 3290, 5731, 16.654, "s", 1802],
    [74, "W", "Tungsten", 183.84, "tm", 6, 6, "[Xe] 4f14 5d4 6s2", 2.36, 3695, 5828, 19.25, "s", 1783],
    [75, "Re", "Rhenium", 186.21, "tm", 7, 6, "[Xe] 4f14 5d5 6s2", 1.9, 3459, 5869, 21.02, "s", 1925],
    [76, "Os", "Osmium", 190.23, "tm", 8, 6, "[Xe] 4f14 5d6 6s2", 2.2, 3306, 5285, 22.59, "s", 1803],
    [77, "Ir", "Iridium", 192.22, "tm", 9, 6, "[Xe] 4f14 5d7 6s2", 2.2, 2719, 4701, 22.56, "s", 1803],
    [78, "Pt", "Platinum", 195.08, "tm", 10, 6, "[Xe] 4f14 5d9 6s1", 2.28, 2041.4, 4098, 21.45, "s", 1735],
    [79, "Au", "Gold", 196.97, "tm", 11, 6, "[Xe] 4f14 5d10 6s1", 2.54, 1337.33, 3129, 19.282, "s", null],
    [80, "Hg", "Mercury", 200.59, "tm", 12, 6, "[Xe] 4f14 5d10 6s2", 2.0, 234.32, 629.88, 13.534, "l", null],
    [81, "Tl", "Thallium", 204.38, "pt", 13, 6, "[Xe] 4f14 5d10 6s2 6p1", 1.62, 577, 1746, 11.85, "s", 1861],
    [82, "Pb", "Lead", 207.2, "pt", 14, 6, "[Xe] 4f14 5d10 6s2 6p2", 2.33, 600.61, 2022, 11.342, "s", null],
    [83, "Bi", "Bismuth", 208.98, "pt", 15, 6, "[Xe] 4f14 5d10 6s2 6p3", 2.02, 544.7, 1837, 9.807, "s", null],
    [84, "Po", "Polonium", 209, "pt", 16, 6, "[Xe] 4f14 5d10 6s2 6p4", 2.0, 527, 1235, 9.32, "s", 1898],
    [85, "At", "Astatine", 210, "hl", 17, 6, "[Xe] 4f14 5d10 6s2 6p5", 2.2, 575, null, null, "s", 1940],
    [86, "Rn", "Radon", 222, "ng", 18, 6, "[Xe] 4f14 5d10 6s2 6p6", 2.2, 202, 211.3, 9.73, "g", 1900],
    [87, "Fr", "Francium", 223, "ak", 1, 7, "[Rn] 7s1", 0.79, 300, null, null, "s", 1939],
    [88, "Ra", "Radium", 226, "ae", 2, 7, "[Rn] 7s2", 0.9, 973, 2010, 5.5, "s", 1898],
    [89, "Ac", "Actinium", 227, "ac", null, 7, "[Rn] 6d1 7s2", 1.1, 1323, 3471, 10.07, "s", 1899],
    [90, "Th", "Thorium", 232.04, "ac", null, 7, "[Rn] 6d2 7s2", 1.3, 2115, 5061, 11.72, "s", 1829],
    [91, "Pa", "Protactinium", 231.04, "ac", null, 7, "[Rn] 5f2 6d1 7s2", 1.5, 1841, 4300, 15.37, "s", 1913],
    [92, "U", "Uranium", 238.03, "ac", null, 7, "[Rn] 5f3 6d1 7s2", 1.38, 1405.3, 4404, 19.1, "s", 1789],
    [93, "Np", "Neptunium", 237, "ac", null, 7, "[Rn] 5f4 6d1 7s2", 1.36, 917, 4273, 20.45, "s", 1940],
    [94, "Pu", "Plutonium", 244, "ac", null, 7, "[Rn] 5f6 7s2", 1.28, 912.5, 3501, 19.84, "s", 1940],
    [95, "Am", "Americium", 243, "ac", null, 7, "[Rn] 5f7 7s2", 1.13, 1449, 2880, 13.69, "s", 1944],
    [96, "Cm", "Curium", 247, "ac", null, 7, "[Rn] 5f7 6d1 7s2", 1.28, 1613, 3383, 13.51, "s", 1944],
    [97, "Bk", "Berkelium", 247, "ac", null, 7, "[Rn] 5f9 7s2", 1.3, 1259, 2900, 14.78, "s", 1949],
    [98, "Cf", "Californium", 251, "ac", null, 7, "[Rn] 5f10 7s2", 1.3, 1173, 1743, 15.1, "s", 1950],
    [99, "Es", "Einsteinium", 252, "ac", null, 7, "[Rn] 5f11 7s2", 1.3, 1133, null, 8.84, "s", 1952],
    [100, "Fm", "Fermium", 257, "ac", null, 7, "[Rn] 5f12 7s2", 1.3, 1800, null, null, "s", 1952],
    [101, "Md", "Mendelevium", 258, "ac", null, 7, "[Rn] 5f13 7s2", 1.3, 1100, null, null, "s", 1955],
    [102, "No", "Nobelium", 259, "ac", null, 7, "[Rn] 5f14 7s2", 1.3, 1100, null, null, "s", 1957],
    [103, "Lr", "Lawrencium", 266, "ac", null, 7, "[Rn] 5f14 7s2 7p1", 1.3, 1900, null, null, "s", 1961],
    [104, "Rf", "Rutherfordium", 267, "tm", 4, 7, "[Rn] 5f14 6d2 7s2", null, null, null, null, "s", 1964],
    [105, "Db", "Dubnium", 268, "tm", 5, 7, "[Rn] 5f14 6d3 7s2", null, null, null, null, "s", 1967],
    [106, "Sg", "Seaborgium", 269, "tm", 6, 7, "[Rn] 5f14 6d4 7s2", null, null, null, null, "s", 1974],
    [107, "Bh", "Bohrium", 270, "tm", 7, 7, "[Rn] 5f14 6d5 7s2", null, null, null, null, "s", 1981],
    [108, "Hs", "Hassium", 277, "tm", 8, 7, "[Rn] 5f14 6d6 7s2", null, null, null, null, "s", 1984],
    [109, "Mt", "Meitnerium", 278, "tm", 9, 7, "[Rn] 5f14 6d7 7s2", null, null, null, null, "s", 1982],
    [110, "Ds", "Darmstadtium", 281, "tm", 10, 7, "[Rn] 5f14 6d8 7s2", null, null, null, null, "s", 1994],
    [111, "Rg", "Roentgenium", 282, "tm", 11, 7, "[Rn] 5f14 6d9 7s2", null, null, null, null, "s", 1994],
    [112, "Cn", "Copernicium", 285, "tm", 12, 7, "[Rn] 5f14 6d10 7s2", null, null, null, null, "g", 1996],
    [113, "Nh", "Nihonium", 286, "pt", 13, 7, "[Rn] 5f14 6d10 7s2 7p1", null, null, null, null, "s", 2003],
    [114, "Fl", "Flerovium", 289, "pt", 14, 7, "[Rn] 5f14 6d10 7s2 7p2", null, null, null, null, "g", 1998],
    [115, "Mc", "Moscovium", 290, "pt", 15, 7, "[Rn] 5f14 6d10 7s2 7p3", null, null, null, null, "s", 2003],
    [116, "Lv", "Livermorium", 293, "pt", 16, 7, "[Rn] 5f14 6d10 7s2 7p4", null, null, null, null, "s", 2000],
    [117, "Ts", "Tennessine", 294, "hl", 17, 7, "[Rn] 5f14 6d10 7s2 7p5", null, null, null, null, "s", 2010],
    [118, "Og", "Oganesson", 294, "ng", 18, 7, "[Rn] 5f14 6d10 7s2 7p6", null, null, null, null, "g", 2002],
];

export const elements: Element[] = rows.map((r) => ({
    number: r[0],
    symbol: r[1],
    name: r[2],
    mass: r[3],
    category: C[r[4]],
    group: r[5],
    period: r[6],
    config: r[7],
    en: r[8],
    melt: r[9],
    boil: r[10],
    density: r[11],
    state: S[r[12]],
    year: r[13],
}));

export const categories: Category[] = [
    "alkali metal",
    "alkaline earth",
    "transition metal",
    "post-transition metal",
    "metalloid",
    "nonmetal",
    "halogen",
    "noble gas",
    "lanthanide",
    "actinide",
];

/** State of an element at temperature T (kelvin), using melting / boiling points when known. */
export function stateAt(e: Element, t: number): State | null {
    if (e.melt == null && e.boil == null) return null;
    const melt = e.melt ?? 0;
    if (e.boil == null) return t < melt ? "solid" : "liquid";
    if (melt >= e.boil) return t < e.boil ? "solid" : "gas"; // sublimates at ordinary pressure
    return t < melt ? "solid" : t < e.boil ? "liquid" : "gas";
}

/** Electrons per shell (1 = K, 2 = L, ...), using the Aufbau-based short config with the standard shell filling. */
export function shells(e: Element): number[] {
    const noble: Record<string, number[]> = {
        He: [2],
        Ne: [2, 8],
        Ar: [2, 8, 8],
        Kr: [2, 8, 18, 8],
        Xe: [2, 8, 18, 18, 8],
        Rn: [2, 8, 18, 32, 18, 8],
    };
    const m = e.config.match(/^\[(\w+)\]\s*(.*)$/);
    const out = m ? [...noble[m[1]]] : [];
    const rest = m ? m[2] : e.config;
    const add = (n: number, c: number) => {
        while (out.length < n) out.push(0);
        out[n - 1] += c;
    };
    for (const part of rest.split(/\s+/).filter(Boolean)) {
        const p = part.match(/^(\d)([spdf])(\d+)$/);
        if (p) add(Number(p[1]), Number(p[3]));
    }
    return out;
}
