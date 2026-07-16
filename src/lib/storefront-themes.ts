export type StorefrontThemeName = "modern" | "luxury" | "wellness" | "barber";

export type StorefrontTheme = {
  name: StorefrontThemeName;
  label: string;
  description: string;
  pageBackground: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  border: string;
  radius: number;
  heroOverlay: string;
  headingFont: string;
  bodyFont: string;
};

export const storefrontThemes: Record<StorefrontThemeName, StorefrontTheme> = {
  modern: {
    name: "modern",
    label: "Modern",
    description: "Bright, minimal and polished with an Apple-like feel.",
    pageBackground: "#f5f7fb",
    surface: "#ffffff",
    text: "#0f172a",
    muted: "#64748b",
    accent: "#2563eb",
    accentText: "#ffffff",
    border: "#e2e8f0",
    radius: 24,
    heroOverlay: "linear-gradient(90deg,rgba(15,23,42,.82),rgba(15,23,42,.28))",
    headingFont: "Inter, ui-sans-serif, system-ui, sans-serif",
    bodyFont: "Inter, ui-sans-serif, system-ui, sans-serif",
  },
  luxury: {
    name: "luxury",
    label: "Luxury",
    description: "Dark, elegant and premium with restrained gold detailing.",
    pageBackground: "#0d0d0f",
    surface: "#17171b",
    text: "#f7f1e3",
    muted: "#b7ad98",
    accent: "#c9a96e",
    accentText: "#111111",
    border: "#343038",
    radius: 8,
    heroOverlay: "linear-gradient(90deg,rgba(0,0,0,.9),rgba(0,0,0,.35))",
    headingFont: "Georgia, 'Times New Roman', serif",
    bodyFont: "Inter, ui-sans-serif, system-ui, sans-serif",
  },
  wellness: {
    name: "wellness",
    label: "Wellness",
    description: "Soft greens, calm spacing and rounded natural surfaces.",
    pageBackground: "#f2f7f1",
    surface: "#ffffff",
    text: "#173b2c",
    muted: "#5f7d70",
    accent: "#4f8065",
    accentText: "#ffffff",
    border: "#d8e7dc",
    radius: 30,
    heroOverlay: "linear-gradient(90deg,rgba(20,61,44,.82),rgba(20,61,44,.24))",
    headingFont: "Georgia, 'Times New Roman', serif",
    bodyFont: "Inter, ui-sans-serif, system-ui, sans-serif",
  },
  barber: {
    name: "barber",
    label: "Barber",
    description: "Industrial, bold and masculine with strong contrast.",
    pageBackground: "#111315",
    surface: "#1c2024",
    text: "#f5f5f4",
    muted: "#a8a29e",
    accent: "#d14a32",
    accentText: "#ffffff",
    border: "#353a40",
    radius: 4,
    heroOverlay: "linear-gradient(90deg,rgba(10,12,14,.92),rgba(10,12,14,.2))",
    headingFont: "Arial Black, Impact, ui-sans-serif, sans-serif",
    bodyFont: "Inter, ui-sans-serif, system-ui, sans-serif",
  },
};

export function resolveStorefrontTheme(value: string | null | undefined): StorefrontTheme {
  if (value === "luxury" || value === "wellness" || value === "barber" || value === "modern") return storefrontThemes[value];
  if (value === "warm") return storefrontThemes.wellness;
  if (value === "bold") return storefrontThemes.barber;
  return storefrontThemes.modern;
}