// @vitest-environment node
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const braces = require("braces");
const nestingError = /Brace nesting exceeds maximum depth/;

describe("local braces depth mitigation (GHSA-vfj7-8cjw-p6xm)", () => {
  it("is the implementation used by glob consumers", () => {
    expect(require("braces/package.json").name).toBe("@memoato/braces");
    for (const consumer of ["micromatch", "anymatch"]) {
      const consumerRequire = createRequire(require.resolve(consumer));
      expect(consumerRequire.resolve("braces")).toBe(require.resolve("braces"));
    }
  });

  it.each([
    ["src/{pages,layouts}/*.astro", ["src/pages/*.astro", "src/layouts/*.astro"]],
    ["file-{01..03}.txt", ["file-01.txt", "file-02.txt", "file-03.txt"]],
    ["{a,{b,c}}", ["a", "b", "c"]],
    ["{x..z}", ["x", "y", "z"]],
    ["{broken", ["{broken"]],
  ])("preserves normal expansion: %s", (pattern, expected) => {
    expect(braces.expand(pattern)).toEqual(expected);
  });

  it("preserves regex compilation, escaping and shallow AST calls", () => {
    expect(braces.compile("src/{a,b}.ts")).toBe("src/(a|b).ts");
    expect(braces.expand(String.raw`\{a,b\}`)).toEqual(["{a,b}"]);
    const ast = braces.parse("file-{1..3}.txt");
    expect(braces.stringify(ast)).toBe("file-{1..3}.txt");
    expect(braces.compile(ast)).toBe("file-([1-3]).txt");
  });

  it("allows literal braces in quoted text", () => {
    expect(() => braces.parse('"' + "{".repeat(500) + '"')).not.toThrow();
  });

  it.each([
    ["braces", braces],
    ["parse", braces.parse],
    ["compile", braces.compile],
    ["expand", braces.expand],
    ["stringify", braces.stringify],
  ])("rejects the advisory pattern before stack exhaustion: %s", (_, operation) => {
    const pattern = "{".repeat(4000) + "a,b" + "}".repeat(4000);
    expect(() => operation(pattern)).toThrow(nestingError);
    expect(() => operation("(".repeat(4000) + "a" + ")".repeat(4000))).toThrow(nestingError);
    // Raising the character limit must not disable the nesting guard.
    expect(() => operation(pattern, { maxLength: Infinity })).toThrow(nestingError);
  });

  it.each(["compile", "expand", "stringify"])("also bounds supplied ASTs and cycles: %s", (operation) => {
    let ast: any = { type: "text", value: "a" };
    for (let depth = 0; depth < 4000; depth++) {
      ast = { type: "brace", nodes: [ast] };
    }
    expect(() => braces[operation](ast)).toThrow(nestingError);
    const cyclic: any = { type: "root", nodes: [] };
    cyclic.nodes.push(cyclic);
    expect(() => braces[operation](cyclic)).toThrow(nestingError);
    // Internal module imports must use the same guard as the public facade.
    expect(() => require(`braces/lib/${operation}`)(ast)).toThrow(nestingError);
  });
});
