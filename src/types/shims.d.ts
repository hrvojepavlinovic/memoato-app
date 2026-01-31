declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}

declare module "*.svg" {
  const src: string;
  export default src;
}

interface ImportMeta {
  env: Record<string, any>;
}

declare module "express-serve-static-core" {
  export type ParamsDictionary = Record<string, string>;
  export type Query = Record<string, any>;
}

