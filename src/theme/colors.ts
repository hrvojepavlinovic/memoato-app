function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
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

export function resolveAccentForTheme(accentHex: string | undefined, isDark: boolean): string | undefined {
  if (!accentHex) return undefined;
  const rgb = parseHex(accentHex);
  if (!rgb) return accentHex;
  const lum = luminance(rgb);

  // Avoid invisible accents: black-on-black in dark mode, or white-on-white in light mode.
  if (isDark && lum < 0.18) return "#FAFAFA";
  if (!isDark && lum > 0.9) return "#0A0A0A";
  return accentHex;
}

