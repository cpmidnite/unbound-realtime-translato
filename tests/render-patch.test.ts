import { describe, expect, test } from 'bun:test';

import { createDecorationStore } from '../src/decorations';
import { createRenderController, decorateRow } from '../src/render-patch';

const MARKER = '\n-# ↳ ';

function row(id: string, content: string) {
  return { message: { id, content } };
}

describe('render-path decoration', () => {
  test('appends the line to a generated row', () => {
    const store = createDecorationStore();
    store.set('m1', { content: 'lo enviaré mañana', line: 'English: I will send it tomorrow' });

    const generated = row('m1', 'lo enviaré mañana');
    decorateRow(generated, (id) => store.get(id));

    expect(generated.message.content).toBe(
      `lo enviaré mañana${MARKER}English: I will send it tomorrow`,
    );
  });

  test('survives repeated renders, the whole point of this approach', () => {
    const store = createDecorationStore();
    store.set('m1', { content: 'hola', line: 'English: hello' });

    // Each render starts from Discord's own untouched message record.
    for (let i = 0; i < 5; i += 1) {
      const generated = row('m1', 'hola');
      decorateRow(generated, (id) => store.get(id));
      expect(generated.message.content).toBe(`hola${MARKER}English: hello`);
    }
  });

  test('does not decorate a row twice', () => {
    const store = createDecorationStore();
    store.set('m1', { content: 'hola', line: 'English: hello' });

    const generated = row('m1', 'hola');
    decorateRow(generated, (id) => store.get(id));
    decorateRow(generated, (id) => store.get(id));

    expect(generated.message.content.match(/English:/g)).toHaveLength(1);
  });

  test('leaves undecorated messages alone', () => {
    const store = createDecorationStore();

    const generated = row('m1', 'hola');
    decorateRow(generated, (id) => store.get(id));

    expect(generated.message.content).toBe('hola');
  });

  test('skips a stale translation after the message was edited', () => {
    const store = createDecorationStore();
    store.set('m1', { content: 'hola', line: 'English: hello' });

    // The row now carries different text than what was translated.
    const generated = row('m1', 'algo distinto');
    decorateRow(generated, (id) => store.get(id));

    expect(generated.message.content).toBe('algo distinto');
  });

  test('tolerates rows with no message or no id', () => {
    const store = createDecorationStore();
    store.set('m1', { content: 'hola', line: 'English: hello' });

    expect(() => decorateRow({}, (id) => store.get(id))).not.toThrow();
    expect(() => decorateRow({ message: {} }, (id) => store.get(id))).not.toThrow();
    expect(() => decorateRow(null, (id) => store.get(id))).not.toThrow();
  });
});

describe('render controller', () => {
  function fakeRowManager() {
    return class RowManager {
      generate(data: any) {
        return { message: { ...data } };
      }
    };
  }

  test('patches generate and decorates what it returns', () => {
    const RowManager = fakeRowManager();
    const store = createDecorationStore();
    store.set('m1', { content: 'hola', line: 'English: hello' });

    const controller = createRenderController({
      rowManager: RowManager,
      patchAfter: (parent, method, callback) => {
        const original = (parent as any)[method];
        (parent as any)[method] = function patched(...args: any[]) {
          return callback(args, original.apply(this, args));
        };
        return () => { (parent as any)[method] = original; };
      },
      getDecoration: (id) => store.get(id),
      onError: (error) => { throw error; },
    });

    expect(controller.start()).toBe(true);
    expect(controller.isActive()).toBe(true);

    const instance = new RowManager();
    const generated = instance.generate({ id: 'm1', content: 'hola' });

    expect(generated.message.content).toBe(`hola${MARKER}English: hello`);

    controller.stop();
    expect(controller.isActive()).toBe(false);

    const afterStop = new RowManager().generate({ id: 'm1', content: 'hola' });
    expect(afterStop.message.content).toBe('hola');
  });

  test('reports failure when the row renderer is missing', () => {
    const controller = createRenderController({
      rowManager: undefined,
      patchAfter: () => () => {},
      getDecoration: () => undefined,
      onError: () => {},
    });

    expect(controller.start()).toBe(false);
    expect(controller.isActive()).toBe(false);
  });

  test('reports failure when the patch is silently swallowed', () => {
    const RowManager = fakeRowManager();

    const controller = createRenderController({
      rowManager: RowManager,
      // A no-op patcher: the callback is registered but generate never changes.
      patchAfter: () => () => {},
      getDecoration: () => undefined,
      onError: () => {},
    });

    expect(controller.start()).toBe(false);
  });

  test('a throwing decoration never breaks the row', () => {
    const RowManager = fakeRowManager();
    const errors: unknown[] = [];

    const controller = createRenderController({
      rowManager: RowManager,
      patchAfter: (parent, method, callback) => {
        const original = (parent as any)[method];
        (parent as any)[method] = function patched(...args: any[]) {
          return callback(args, original.apply(this, args));
        };
        return () => { (parent as any)[method] = original; };
      },
      getDecoration: () => {
        throw new Error('store exploded');
      },
      onError: (error) => errors.push(error),
    });

    controller.start();

    const generated = new RowManager().generate({ id: 'm1', content: 'hola' });

    // The row is still returned intact, and the failure is reported.
    expect(generated.message.content).toBe('hola');
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
