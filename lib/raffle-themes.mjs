export const DEFAULT_RAFFLE_THEME = "purple";
export const DEFAULT_RAFFLE_SPEED = 3;

export const RAFFLE_THEMES = [
  { key: "purple", background: "#6f3faa", surface: "#5d3294", accent: "#f7dd4c", text: "#ffffff" },
  { key: "violet", background: "#7c3aed", surface: "#6429c7", accent: "#facc15", text: "#ffffff" },
  { key: "indigo", background: "#4338ca", surface: "#3730a3", accent: "#f9a8d4", text: "#ffffff" },
  { key: "blue", background: "#0369a1", surface: "#075985", accent: "#fde047", text: "#ffffff" },
  { key: "teal", background: "#0f766e", surface: "#115e59", accent: "#fef08a", text: "#ffffff" },
  { key: "green", background: "#15803d", surface: "#166534", accent: "#fde68a", text: "#ffffff" },
  { key: "amber", background: "#b45309", surface: "#92400e", accent: "#fef3c7", text: "#ffffff" },
  { key: "orange", background: "#c2410c", surface: "#9a3412", accent: "#ffedd5", text: "#ffffff" },
  { key: "rose", background: "#be123c", surface: "#9f1239", accent: "#fef08a", text: "#ffffff" },
  { key: "pink", background: "#be185d", surface: "#9d174d", accent: "#fdf2f8", text: "#ffffff" },
];

export function getRaffleTheme(key) {
  return RAFFLE_THEMES.find((theme) => theme.key === key) || RAFFLE_THEMES[0];
}

export function getSpinDuration(speed) {
  return ({ 1: 7000, 2: 5600, 3: 4200, 4: 3000, 5: 1800 })[Math.min(5, Math.max(1, Number(speed) || DEFAULT_RAFFLE_SPEED))];
}
