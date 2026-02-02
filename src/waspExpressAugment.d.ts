declare module "express-serve-static-core" {
  // Wasp's SDK currently compiles with `moduleResolution: bundler`, which can lead
  // to Node core module resolution quirks in the generated SDK build.
  // These augmentations keep SDK compilation stable without affecting runtime.
  interface Request {
    headers: any;
  }

  interface Response {
    status(code: number): this;
    setHeader(name: string, value: string): this;
    end(data?: any): this;
  }
}

declare module "express" {
  interface Request {
    headers: any;
  }

  interface Response {
    status(code: number): this;
    setHeader(name: string, value: string): this;
    end(data?: any): this;
  }
}

export {};
