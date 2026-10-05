import { describe, expect, test } from 'bun:test';

import { createDecorationStore } from '../src/decorations';
import { contentToText, decorateRow } from '../src/render-patch';

/**
 * Sending a message re-keys it: Discord renders an optimistic copy under a
 * temporary local id, then replaces it with the server's snowflake. A
 * decoration recorded against the first id becomes unreachable at that moment,
 * which is the reported "briefly showed up and disappeared after sending".
 */
function messageRow(id: string, nodes: any[]) {
  return { type: 1, message: { id, authorId: 'me', channelId: 'c1', content: nodes } };
}

function text(content: string) {
  return { type: 'text', content };
}

describe('message re-key on send', () => {
  test('the content fallback keeps the line after the id changes', () => {
    const store = createDecorationStore();
    store.set('local-123', { content: 'hola', line: 'English: hello' });

    // Optimistic render, under the local id.
    const optimistic = messageRow('local-123', [text('hola')]);
    expect(decorateRow(
      optimistic,
      (id) => store.get(id),
      (content) => store.getByContent(content),
    )).toBe(true);

    // Server copy arrives under a snowflake: the id lookup now misses.
    const confirmed = messageRow('1234567890123456789', [text('hola')]);
    expect(store.get('1234567890123456789')).toBeUndefined();

    expect(decorateRow(
      confirmed,
      (id) => store.get(id),
      (content) => store.getByContent(content),
    )).toBe(true);
    expect(contentToText(confirmed.message.content)).toContain('hello');
  });

  test('without the fallback the line is lost, reproducing the bug', () => {
    const store = createDecorationStore();
    store.set('local-123', { content: 'hola', line: 'English: hello' });

    const confirmed = messageRow('1234567890123456789', [text('hola')]);

    // No getByContent: this is the old behaviour.
    expect(decorateRow(confirmed, (id) => store.get(id))).toBe(false);
  });

  test('re-keying moves the decoration to the new id', () => {
    const store = createDecorationStore();
    store.set('local-123', { content: 'hola', line: 'English: hello' });

    const carried = store.get('local-123')!;
    store.set('999', carried);
    store.delete('local-123');

    expect(store.get('999')).toEqual(carried);
    expect(store.get('local-123')).toBeUndefined();
    // Deleting the old id must not break the content index.
    expect(store.getByContent('hola')).toEqual(carried);
  });

  test('content matching normalises whitespace', () => {
    const store = createDecorationStore();
    store.set('m1', { content: 'hola   mundo', line: 'English: hello world' });

    expect(store.getByContent('hola mundo')).toBeDefined();
    expect(store.getByContent('  hola   mundo  ')).toBeDefined();
  });

  test('a different message with the same text reuses the translation', () => {
    // Identical text has an identical translation, so this is correct and keeps
    // repeated short messages working.
    const store = createDecorationStore();
    store.set('m1', { content: 'hola', line: 'English: hello' });

    const other = messageRow('m2', [text('hola')]);
    expect(decorateRow(
      other,
      (id) => store.get(id),
      (content) => store.getByContent(content),
    )).toBe(true);
  });

  test('the fallback never labels a message with different text', () => {
    const store = createDecorationStore();
    store.set('m1', { content: 'hola', line: 'English: hello' });

    const different = messageRow('m2', [text('buenas tardes')]);
    expect(decorateRow(
      different,
      (id) => store.get(id),
      (content) => store.getByContent(content),
    )).toBe(false);
  });

  test('deleting one entry leaves a newer identical-text entry reachable', () => {
    const store = createDecorationStore();
    const first = { content: 'hola', line: 'English: hello' };
    const second = { content: 'hola', line: 'English: hi there' };

    store.set('m1', first);
    store.set('m2', second);

    store.delete('m1');

    expect(store.getByContent('hola')).toEqual(second);
  });

  test('eviction keeps the content index consistent', () => {
    const store = createDecorationStore(2);

    store.set('m1', { content: 'uno', line: 'one' });
    store.set('m2', { content: 'dos', line: 'two' });
    store.set('m3', { content: 'tres', line: 'three' });

    expect(store.size()).toBe(2);
    expect(store.getByContent('uno')).toBeUndefined();
    expect(store.getByContent('tres')).toBeDefined();
  });
});
