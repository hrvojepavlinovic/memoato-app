'use strict';

// Local mitigation for GHSA-vfj7-8cjw-p6xm. Keep all recursive walkers
// bounded, including callers that supply an AST rather than a pattern.
const MAX_DEPTH = 100;

const assertDepth = depth => {
  if (depth > MAX_DEPTH) {
    throw new SyntaxError(`Brace nesting exceeds maximum depth (${MAX_DEPTH})`);
  }
};

const assertTreeDepth = ast => {
  const pending = [{ node: ast, depth: 0 }];
  let visited = 0;
  while (pending.length) {
    const { node, depth } = pending.pop();
    // A parsed tree can have a leaf one level below its deepest container.
    assertDepth(Math.max(0, depth - 1));
    if (++visited > 10000) {
      throw new SyntaxError('Brace AST exceeds maximum node count (10000)');
    }
    if (node && node.nodes) {
      for (const child of node.nodes) {
        pending.push({ node: child, depth: depth + 1 });
      }
    }
  }
};

module.exports = { assertDepth, assertTreeDepth };
