const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";
const DEFAULT_MODEL = "qwen/qwen3-embedding-8b";
const DEFAULT_DIMENSIONS = 1024;
const DEFAULT_VERSION = "memory-search-v1";
const REQUEST_TIMEOUT_MS = 12_000;
export const EMBEDDING_STORAGE_DIMENSIONS = 1024;

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

export async function embedMemoryText(args: {
  text: string;
  inputType: "search_document" | "search_query";
}): Promise<number[]> {
  const config = getEmbeddingConfig();
  const configurationError = embeddingConfigurationError();
  if (configurationError) throw new EmbeddingError(configurationError);
  const text = args.text.trim().slice(0, 12_000);
  if (!text) throw new EmbeddingError("empty_embedding_input");

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
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
        input_type: args.inputType,
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
