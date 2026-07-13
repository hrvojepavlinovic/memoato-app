const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "i",
  "me",
  "my",
  "did",
  "do",
  "was",
  "were",
  "what",
  "when",
  "where",
  "how",
  "last",
  "latest",
  "play",
  "played",
  "happen",
  "happened",
  "je",
  "sam",
  "mi",
  "moj",
  "moja",
  "moje",
  "sto",
  "sta",
  "kada",
  "kad",
  "gdje",
  "di",
  "koliko",
  "zadnji",
  "zadnja",
  "put",
  "igrao",
  "igrala",
  "odradio",
  "odradila",
  "radio",
  "radila",
  "imao",
  "imala",
]);

const TERM_ALIASES: Record<string, string> = {
  kila: "weight",
  kilaza: "weight",
  tezina: "weight",
  vaga: "weight",
  zgib: "pull",
  zgibovi: "pull",
  zgibove: "pull",
  zgibova: "pull",
  sklek: "push",
  sklekovi: "push",
  sklekove: "push",
  sklekova: "push",
};

export function searchMemoryTerms(query: string): string[] {
  return Array.from(
    new Set(
      query
        .trim()
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length >= 2 && !STOP_WORDS.has(term))
        .map((term) => TERM_ALIASES[term] ?? term),
    ),
  ).slice(0, 8);
}
