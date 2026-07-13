import { createHash } from "node:crypto";

const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";
const DEFAULT_MODEL = "openai/text-embedding-3-small";
const DEFAULT_DIMENSIONS = 1024;
const DEFAULT_VERSION = "memory-search-v2-openai-small";
const QUERY_TIMEOUT_MS = 2_000;
const DOCUMENT_TIMEOUT_MS = 30_000;
const QUERY_CACHE_TTL_MS = 24 * 60 * 60_000;
const QUERY_CACHE_MAX_ENTRIES = 250;
export const EMBEDDING_STORAGE_DIMENSIONS = 1024;

type QueryCacheEntry = { expiresAt: number; vector: number[] };
const queryEmbeddingCache = new Map<string, QueryCacheEntry>();
const pendingQueryEmbeddings = new Map<string, Promise<number[]>>();

function env(name: string): string {
  return String(process.env[name] ?? "").trim();
}

export type EmbeddingConfig = {
  apiKey: string;
  model: string;
  dimensions: number;
  version: string;
};

export class EmbeddingError extends Error {
  constructor(
    public readonly code: string,
    message = code,
  ) {
    super(message);
    this.name = "EmbeddingError";
  }
}

export function getEmbeddingConfig(): EmbeddingConfig {
  const parsedDimensions = Number(env("MEMOATO_EMBEDDING_DIMENSIONS"));
  return {
    apiKey: env("OPENROUTER_API_KEY"),
    model: env("MEMOATO_EMBEDDING_MODEL") || DEFAULT_MODEL,
    dimensions:
      Number.isInteger(parsedDimensions) && parsedDimensions > 0
        ? parsedDimensions
        : DEFAULT_DIMENSIONS,
    version: env("MEMOATO_EMBEDDING_VERSION") || DEFAULT_VERSION,
  };
}

export function isEmbeddingConfigured(): boolean {
  return embeddingConfigurationError() == null;
}

export function embeddingRequestTimeoutMs(
  inputType: "search_document" | "search_query",
): number {
  return inputType === "search_document"
    ? DOCUMENT_TIMEOUT_MS
    : QUERY_TIMEOUT_MS;
}

export function embeddingConfigurationError(): string | null {
  const config = getEmbeddingConfig();
  if (!config.apiKey) return "embedding_not_configured";
  if (config.dimensions !== EMBEDDING_STORAGE_DIMENSIONS) {
    return "embedding_dimension_configuration_mismatch";
  }
  return null;
}

export function normalizeEmbeddingResponse(
  payload: unknown,
  expectedDimensions: number,
): number[] {
  const embedding = (payload as any)?.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) {
    throw new EmbeddingError("invalid_embedding_response");
  }
  if (embedding.length !== expectedDimensions) {
    throw new EmbeddingError("embedding_dimension_mismatch");
  }
  const vector = embedding.map((value: unknown) => Number(value));
  if (vector.some((value) => !Number.isFinite(value))) {
    throw new EmbeddingError("invalid_embedding_values");
  }
  return vector;
}

export function toPgVector(vector: number[], expectedDimensions?: number) {
  if (
    vector.length === 0 ||
    (expectedDimensions != null && vector.length !== expectedDimensions) ||
    vector.some((value) => !Number.isFinite(value))
  ) {
    throw new EmbeddingError("invalid_embedding_values");
  }
  return `[${vector.map((value) => String(value)).join(",")}]`;
}

function queryCacheKey(config: EmbeddingConfig, text: string): string {
  return createHash("sha256")
    .update(`${config.model}\n${config.version}\n${config.dimensions}\n${text}`)
    .digest("hex");
}

function cachedQueryEmbedding(key: string): number[] | null {
  const cached = queryEmbeddingCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    queryEmbeddingCache.delete(key);
    return null;
  }
  // Refresh insertion order so frequently used questions stay warm.
  queryEmbeddingCache.delete(key);
  queryEmbeddingCache.set(key, cached);
  return cached.vector;
}

function cacheQueryEmbedding(key: string, vector: number[]) {
  queryEmbeddingCache.set(key, {
    expiresAt: Date.now() + QUERY_CACHE_TTL_MS,
    vector,
  });
  while (queryEmbeddingCache.size > QUERY_CACHE_MAX_ENTRIES) {
    const oldest = queryEmbeddingCache.keys().next().value;
    if (typeof oldest !== "string") break;
    queryEmbeddingCache.delete(oldest);
  }
}

export async function embedMemoryText(args: {
  text: string;
  inputType: "search_document" | "search_query";
}): Promise<number[]> {
  const config = getEmbeddingConfig();
  const configurationError = embeddingConfigurationError();
  if (configurationError) throw new EmbeddingError(configurationError);
  const text = args.text.trim().slice(0, 12_000);
  if (!text) throw new EmbeddingError("empty_embedding_input");

  const cacheKey =
    args.inputType === "search_query"
      ? queryCacheKey(config, text.toLocaleLowerCase())
      : null;
  if (cacheKey) {
    const cached = cachedQueryEmbedding(cacheKey);
    if (cached) return cached;
    const pending = pendingQueryEmbeddings.get(cacheKey);
    if (pending) return pending;
  }

  const request = requestEmbedding({ config, text, inputType: args.inputType });
  if (cacheKey) pendingQueryEmbeddings.set(cacheKey, request);
  try {
    const vector = await request;
    if (cacheKey) cacheQueryEmbedding(cacheKey, vector);
    return vector;
  } finally {
    if (cacheKey) pendingQueryEmbeddings.delete(cacheKey);
  }
}

async function requestEmbedding(args: {
  config: EmbeddingConfig;
  text: string;
  inputType: "search_document" | "search_query";
}): Promise<number[]> {
  const { config, text, inputType } = args;

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    embeddingRequestTimeoutMs(inputType),
  );
  try {
    const response = await fetch(OPENROUTER_EMBEDDINGS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": env("WASP_WEB_CLIENT_URL") || "https://app.memoato.com",
        "X-Title": "memoato",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        input: [text],
        dimensions: config.dimensions,
        input_type: inputType,
        encoding_format: "float",
      }),
    });
    if (!response.ok) {
      throw new EmbeddingError(
        `embedding_http_${response.status}`,
        `Embedding request failed (${response.status})`,
      );
    }
    return normalizeEmbeddingResponse(await response.json(), config.dimensions);
  } catch (error) {
    if (error instanceof EmbeddingError) throw error;
    if ((error as any)?.name === "AbortError") {
      throw new EmbeddingError("embedding_timeout");
    }
    throw new EmbeddingError("embedding_request_failed");
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
