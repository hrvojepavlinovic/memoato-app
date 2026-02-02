export type IncomingHttpHeaders = Record<string, string | string[] | undefined>;

export interface IncomingMessage {
  headers: IncomingHttpHeaders;
}

export interface ServerResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(data?: any): void;
}

declare const http: {
  IncomingMessage: IncomingMessage;
  ServerResponse: ServerResponse;
};

export default http;
