export function parseNumberInput(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, "");
  if (!s) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  let normalized = s;

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      // 1.234,56 -> 1234.56
      normalized = s.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,234.56 -> 1234.56
      normalized = s.replace(/,/g, "");
    }
  } else if (lastComma !== -1) {
    normalized = s.replace(",", ".");
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return n;
}

