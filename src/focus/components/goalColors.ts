function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgba({ r, g, b }: { r: number; g: number; b: number }, a: number): string {
  return `rgba(${r},${g},${b},${a})`;
}

function srgbToLinear(x: number): number {
  const v = x / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminance(rgb: { r: number; g: number; b: number }): number {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function goalLineColors(accentHex?: string): { stroke: string; label: string } {
  const fallback = { stroke: "rgba(0,0,0,0.25)", label: "rgba(0,0,0,0.55)" };
  if (!accentHex) return fallback;
  const rgb = parseHex(accentHex);
  if (!rgb) return fallback;

  // If the accent is very light, use neutral colors for readability.
  if (luminance(rgb) > 0.82) return fallback;

  return {
    stroke: rgba(rgb, 0.35),
    label: rgba(rgb, 0.65),
  };
}

