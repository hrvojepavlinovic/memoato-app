export async function GET() {
  const site = "https://memoato.com";

  const staticPaths = [
    "/",
    "/about",
    "/help",
    "/adhd",
    "/changelog",
    "/blog",
    "/open-source",
    "/privacy",
    "/terms",
    "/contact",
  ];

  const postModules = import.meta.glob("./blog/*.md", { eager: true }) as Record<
    string,
    { frontmatter?: { date?: string } }
  >;

  const postEntries = Object.entries(postModules)
    .map(([modulePath, mod]) => {
      const m = /^\.\/blog\/(.+)\.md$/.exec(modulePath);
      if (!m) return null;
      const path = `/blog/${m[1]}`;
      const date = mod.frontmatter?.date ? new Date(mod.frontmatter.date) : null;
      const lastmod =
        date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : undefined;
      return { path, lastmod };
    })
    .filter((e): e is { path: string; lastmod?: string } => !!e);

  const entries: Array<{ path: string; lastmod?: string }> = [
    ...staticPaths.map((path) => ({ path })),
    ...postEntries,
  ];

  const urlEntries = entries
    .map(({ path, lastmod }) => {
      const loc = `${site}${path === "/" ? "" : path}`;
      return `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urlEntries +
    `</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
