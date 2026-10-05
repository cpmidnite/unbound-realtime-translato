import { describe, expect, test } from 'bun:test';

import { createDecorationStore } from '../src/decorations';
import {
  buildDecorationNodes,
  contentToText,
  createRenderController,
  decorateRow,
  decorateRows,
} from '../src/render-patch';

/**
 * Rows in the real payload are already-parsed markdown, matching the shape used
 * by working Vendetta/Revenge plugins: `type: 1` for a message row, and
 * `message.content` an array of nodes.
 */
function messageRow(id: string, nodes: any[]) {
  return { type: 1, message: { id, authorId: 'u1', channelId: 'c1', content: nodes } };
}

function text(content: string) {
  return { type: 'text', content };
}

describe('parsed content to plain text', () => {
  test('joins text nodes', () => {
    expect(contentToText([text('Lo enviaré '), text('mañana')])).toBe('Lo enviaré mañana');
  });

  test('handles emoji, links, and nesting', () => {
    expect(contentToText([
      text('hi '),
      { type: 'emoji', content: ':wave:', surrogate: '👋' },
      text(' see '),
      { type: 'link', target: 'https://x.com', content: [text('https://x.com')] },
      { type: 'strong', content: [text(' bold')] },
    ])).toBe('hi 👋 see https://x.com bold');
  });

  test('tolerates odd input', () => {
    expect(contentToText(undefined)).toBe('');
    expect(contentToText('already a string')).toBe('already a string');
    expect(contentToText([null, 42, {}])).toBe('');
  });
});

describe('row decoration', () => {
  test('appends nodes rather than replacing content with a string', () => {
    const store = createDecorationStore();
    store.set('m1', { content: 'Lo enviaré mañana', line: 'English: I will send it tomorrow' });

    const row = messageRow('m1', [text('Lo enviaré mañana')]);
    expect(decorateRow(row, (id) => store.get(id))).toBe(true);

    // Content must remain an ARRAY: assigning a string renders nothing.
    expect(Array.isArray(row.message.content)).toBe(true);
    expect(row.message.content.length).toBe(3);
    expect(contentToText(row.message.content)).toContain('I will send it tomorrow');
  });

  test('survives repeated renders, the whole point of this approach', () => {
    const store = createDecorationStore();
    store.set('m1', { content: 'hola', line: 'English: hello' });

    // Each render starts from Discord's own pristine, undecorated row.
    for (let i = 0; i < 5; i += 1) {
      const row = messageRow('m1', [text('hola')]);
      expect(decorateRow(row, (id) => store.get(id))).toBe(true);
      expect(contentToText(row.message.content)).toBe('hola\n↳ English: hello');
    }
  });

  test('never decorates the same row twice', () => {
    const store = createDecorationStore();
    store.set('m1', { content: 'hola', line: 'English: hello' });

    const row = messageRow('m1', [text('hola')]);
    expect(decorateRow(row, (id) => store.get(id))).toBe(true);
    expect(decorateRow(row, (id) => store.get(id))).toBe(false);

    expect(row.message.content.length).toBe(3);
  });

  test('ignores rows with no stored translation', () => {
    const store = createDecorationStore();
    const row = messageRow('m1', [text('hola')]);

    expect(decorateRow(row, (id) => store.get(id))).toBe(false);
    expect(row.message.content.length).toBe(1);
  });

  test('ignores non-message rows', () => {
    const store = createDecorationStore();
    store.set('m1', { content: 'hola', line: 'English: hello' });

    const divider = { type: 2, message: { id: 'm1', content: [text('hola')] } };
    expect(decorateRow(divider, (id) => store.get(id))).toBe(false);
  });

  test('skips a stale translation after the message was edited', () => {
    const store = createDecorationStore();
    store.set('m1', { content: 'hola', line: 'English: hello' });

    const row = messageRow('m1', [text('algo completamente distinto')]);
    expect(decorateRow(row, (id) => store.get(id))).toBe(false);
  });

  test('matches content containing emoji and links', () => {
    const store = createDecorationStore();
    store.set('m1', { content: 'mira esto https://example.com', line: 'English: look at this' });

    const row = messageRow('m1', [
      text('mira esto '),
      { type: 'link', target: 'https://example.com', content: [text('https://example.com')] },
    ]);

    expect(decorateRow(row, (id) => store.get(id))).toBe(true);
  });

  test('tolerates malformed rows', () => {
    const get = () => ({ content: 'x', line: 'y' });

    expect(decorateRow(null, get)).toBe(false);
    expect(decorateRow({}, get)).toBe(false);
    expect(decorateRow({ type: 1 }, get)).toBe(false);
    expect(decorateRow({ type: 1, message: {} }, get)).toBe(false);
    expect(decorateRow({ type: 1, message: { id: 'm1', content: [] } }, get)).toBe(false);
  });

  test('decorates every matching row in a payload', () => {
    const store = createDecorationStore();
    store.set('m1', { content: 'uno', line: 'English: one' });
    store.set('m3', { content: 'tres', line: 'English: three' });

    const rows = [
      messageRow('m1', [text('uno')]),
      messageRow('m2', [text('dos')]),
      messageRow('m3', [text('tres')]),
    ];

    expect(decorateRows(rows, (id) => store.get(id))).toBe(2);
    expect(contentToText(rows[0]!.message.content)).toContain('one');
    expect(contentToText(rows[1]!.message.content)).toBe('dos');
    expect(contentToText(rows[2]!.message.content)).toContain('three');
  });

  test('reports no change when nothing matched', () => {
    const store = createDecorationStore();
    const rows = [messageRow('m1', [text('hola')])];

    expect(decorateRows(rows, (id) => store.get(id))).toBe(0);
    expect(decorateRows('not an array', (id) => store.get(id))).toBe(0);
  });

  test('injected nodes are flagged so they can be recognised', () => {
    const nodes = buildDecorationNodes('English: hello');
    expect(nodes.every((node) => node.__realtimeTranslator === true)).toBe(true);
  });
});

describe('render controller', () => {
  function fakeChatModule() {
    const calls: string[] = [];
    return {
      calls,
      module: {
        updateRows(_id: string, json: string) {
          calls.push(json);
        },
      },
    };
  }

  function installer() {
    return (parent: any, method: string, callback: (args: any[]) => void) => {
      const original = parent[method];
      parent[method] = function patched(...args: any[]) {
        callback(args);
        return original.apply(this, args);
      };
      return () => { parent[method] = original; };
    };
  }

  test('parses the JSON payload, decorates it, and re-serialises', () => {
    const { calls, module } = fakeChatModule();
    const store = createDecorationStore();
    store.set('m1', { content: 'hola', line: 'English: hello' });

    const controller = createRenderController({
      chatModule: module,
      patchBefore: installer(),
      getDecoration: (id) => store.get(id),
      onError: (error) => { throw error; },
    });

    expect(controller.start()).toBe(true);

    module.updateRows('chan', JSON.stringify([messageRow('m1', [text('hola')])]));

    const delivered = JSON.parse(calls[0]!);
    expect(contentToText(delivered[0].message.content)).toBe('hola\n↳ English: hello');

    controller.stop();
    expect(controller.isActive()).toBe(false);
  });

  test('leaves the payload byte-identical when nothing is decorated', () => {
    const { calls, module } = fakeChatModule();
    const store = createDecorationStore();

    const controller = createRenderController({
      chatModule: module,
      patchBefore: installer(),
      getDecoration: (id) => store.get(id),
      onError: (error) => { throw error; },
    });
    controller.start();

    const payload = JSON.stringify([messageRow('m1', [text('hola')])]);
    module.updateRows('chan', payload);

    expect(calls[0]).toBe(payload);
  });

  test('reports failure when the chat module is missing', () => {
    const controller = createRenderController({
      chatModule: undefined,
      patchBefore: () => () => {},
      getDecoration: () => undefined,
      onError: () => {},
    });

    expect(controller.start()).toBe(false);
  });

  test('reports failure when the patch is silently swallowed', () => {
    const { module } = fakeChatModule();

    const controller = createRenderController({
      chatModule: module,
      patchBefore: () => () => {},
      getDecoration: () => undefined,
      onError: () => {},
    });

    expect(controller.start()).toBe(false);
  });

  test('malformed JSON never breaks the message list', () => {
    const { calls, module } = fakeChatModule();
    const errors: unknown[] = [];

    const controller = createRenderController({
      chatModule: module,
      patchBefore: installer(),
      getDecoration: () => ({ content: 'x', line: 'y' }),
      onError: (error) => errors.push(error),
    });
    controller.start();

    module.updateRows('chan', 'definitely not json');

    expect(calls[0]).toBe('definitely not json');
    expect(errors).toHaveLength(1);
  });

  test('a throwing decoration lookup never breaks the message list', () => {
    const { calls, module } = fakeChatModule();
    const errors: unknown[] = [];

    const controller = createRenderController({
      chatModule: module,
      patchBefore: installer(),
      getDecoration: () => {
        throw new Error('store exploded');
      },
      onError: (error) => errors.push(error),
    });
    controller.start();

    const payload = JSON.stringify([messageRow('m1', [text('hola')])]);
    module.updateRows('chan', payload);

    expect(calls[0]).toBe(payload);
    expect(errors).toHaveLength(1);
  });
});

describe('decoration store', () => {
  test('stores, reads, and forgets entries', () => {
    const store = createDecorationStore();

    store.set('m1', { content: 'a', line: 'b' });
    expect(store.has('m1')).toBe(true);
    expect(store.get('m1')).toEqual({ content: 'a', line: 'b' });

    store.delete('m1');
    expect(store.has('m1')).toBe(false);
  });

  test('evicts the oldest entries past its cap', () => {
    const store = createDecorationStore(3);

    for (const id of ['m1', 'm2', 'm3', 'm4']) {
      store.set(id, { content: id, line: id });
    }

    expect(store.size()).toBe(3);
    expect(store.has('m1')).toBe(false);
    expect(store.has('m4')).toBe(true);
  });

  test('clear empties everything', () => {
    const store = createDecorationStore();
    store.set('m1', { content: 'a', line: 'b' });
    store.clear();

    expect(store.size()).toBe(0);
  });
});
