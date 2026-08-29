import { nodeResolve } from '@rollup/plugin-node-resolve';
import { swc } from 'rollup-plugin-swc3';
import iife from 'rollup-plugin-iife';

const globals = {
  '@unbound-app/api': 'window.unbound',
};

const unboundExpression = {
  name: 'unbound-expression',
  renderChunk(code) {
    const match = code.match(/^var\s+[\w$]+\s*=\s*([\s\S]*);\s*$/);
    if (!match) {
      throw new Error('Expected rollup-plugin-iife to emit one top-level variable.');
    }

    return { code: match[1], map: null };
  },
};

/** @type {import('rollup').RollupOptions} */
export default {
  input: 'src/index.ts',
  external: Object.keys(globals),
  plugins: [nodeResolve(), swc({ tsconfig: false }), iife(), unboundExpression],
  output: {
    dir: 'dist',
    entryFileNames: 'index.js',
    format: 'es',
    compact: true,
    exports: 'named',
    globals,
  },
};
