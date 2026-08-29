import { describe, expect, test } from 'bun:test';

import manifest from '../manifest.json';

describe('Unbound manifest', () => {
  test('contains every field required by the current addon manager', () => {
    for (const field of ['id', 'name', 'description', 'authors', 'version', 'main'] as const) {
      expect(manifest[field]).toBeDefined();
    }

    expect(manifest.type).toBe('plugin');
    expect(manifest.authors.length).toBeGreaterThan(0);
    expect(manifest.main).toBe('index.js');
    expect(new URL(manifest.main, 'https://example.com/manifest.json').href).toBe(
      'https://example.com/index.js',
    );
  });
});
