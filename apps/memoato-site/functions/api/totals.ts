const DEFAULT_API_ORIGIN = "https://api.memoato.com";

export async function onRequest({ env }: { env: Record<string, string | undefined> }) {
  const apiOrigin = env.MEMOATO_API_ORIGIN?.trim() || DEFAULT_API_ORIGIN;

  const upstream = await fetch(`${apiOrigin}/operations/get-public-totals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });

  const body = await upstream.text();
  let normalizedBody = body;
  try {
    const parsed = JSON.parse(body);
    // Wasp operations respond as { json: <payload> }.
    normalizedBody = JSON.stringify(parsed?.json ?? parsed ?? {});
  } catch {
    // fall through with original body
  }
  const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
  headers.set("cache-control", "public, max-age=300");

  return new Response(normalizedBody, { status: upstream.status, headers });
}
