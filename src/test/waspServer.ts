export class HttpError extends Error {
  statusCode: number;
  data: unknown;

  constructor(statusCode: number, message?: string, data?: unknown) {
    super(message ?? String(statusCode));
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.data = data;
  }
}

export const prisma = new Proxy(
  {},
  {
    get() {
      throw new Error("The test Wasp server shim does not provide Prisma.");
    },
  },
);
