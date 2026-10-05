import { describe, expect, test } from 'bun:test';

import { createDecorationStore } from '../src/decorations';
import { createRealtimeController } from '../src/controller';
import { createChatConfig } from '../src/config';
import { surveyRenderSurfaces } from '../src/survey';

function memoryStore() {
  const data: Record<string, any> = {};
  return {
    get: (key: string, fallback?: any) => {
      const value = key.split('.').reduce<any>(
        (node, part) => (node == null ? undefined : node[part]),
        data,
      );
      return value === undefined ? fallback : value;
    },
    set: (key: string, value: any) => {
      const parts = key.split('.');
      const last = parts.pop()!;
      let node: any = data;
      for (const part of parts) {
        if (typeof node[part] !== 'object' || !node[part]) node[part] = {};
        node = node[part];
      }
      node[last] = value;
    },
  };
}

/**
 * The device reported an installed render patch that was never invoked. In that
 * state recording a decoration shows the user nothing, so the controller has to
 * fall back to updating the message store.
 */
function harness(renderCalls: () => number) {
  const handlers = new Map<string, (action: any) => void>();
  const messages = new Map<string, any>();
  const dispatched: any[] = [];

  const config = createChatConfig(memoryStore());
  const decorations = createDecorationStore();

  const controller = createRealtimeController({
    dispatcher: {
      subscribe: (type: string, handler: any) => handlers.set(type, handler),
      unsubscribe: (type: string) => handlers.delete(type),
      dispatch: (action: any) => dispatched.push(action),
    } as any,
    users: { getCurrentUser: () => ({ id: 'me' }) } as any,
    config,
    decorations,
    renderIsLive: () => renderCalls() > 0,
    requestRerender: () => {},
    getMessage: (_channelId: string, id: string) => messages.get(id),
    translate: async () => ({ text: 'hello', sourceLanguage: 'es' }),
    abortTranslations: () => {},
    onError: () => {},
  } as any);

  controller.start();
  config.setIncoming('c1', true);

  return {
    controller,
    decorations,
    dispatched,
    async receive(id: string, content: string) {
      const message = { id, channel_id: 'c1', content, author: { id: 'them' } };
      messages.set(id, message);
      handlers.get('MESSAGE_CREATE')?.({ type: 'MESSAGE_CREATE', message });
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  };
}

describe('render fallback gate', () => {
  test('falls back to a store update while the render patch is dead', async () => {
    // renderCalls stays 0: the patch is installed but never invoked.
    const h = harness(() => 0);
    await h.receive('m1', 'hola');

    const update = h.dispatched.find((action) => action.type === 'MESSAGE_UPDATE');
    expect(update).toBeDefined();
    expect(update.message.content).toContain('hello');

    // Nothing should be parked in the decoration store, where it would be
    // invisible.
    expect(h.decorations.size()).toBe(0);
  });

  test('uses the decoration path once the render patch has delivered rows', async () => {
    const h = harness(() => 5);
    await h.receive('m1', 'hola');

    expect(h.dispatched.find((action) => action.type === 'MESSAGE_UPDATE')).toBeUndefined();
    expect(h.decorations.size()).toBe(1);
    expect(h.decorations.get('m1')?.line).toContain('hello');
  });

  test('switches to the decoration path as soon as the seam comes alive', async () => {
    let calls = 0;
    const h = harness(() => calls);

    await h.receive('m1', 'hola');
    expect(h.dispatched.some((action) => action.type === 'MESSAGE_UPDATE')).toBe(true);

    calls = 1;
    await h.receive('m2', 'hola');
    expect(h.decorations.has('m2')).toBe(true);
  });
});

describe('render surface survey', () => {
  test('finds a native module by shape even when its name is unexpected', () => {
    const module = { updateRows: () => {}, flashScrollIndicators: () => {} };

    const entries = surveyRenderSurfaces({
      nativeModuleProxy: { SomeUnexpectedName: module },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe('SomeUnexpectedName');
    expect(entries[0]!.methods).toContain('updateRows');
    expect(entries[0]!.module).toBe(module);
  });

  test('ignores modules with no row-related methods', () => {
    expect(surveyRenderSurfaces({
      nativeModuleProxy: { AudioManager: { play: () => {}, stop: () => {} } },
    })).toHaveLength(0);
  });

  test('finds prototype methods on a class', () => {
    class RowManagerLike {
      generate() {}
      unrelated() {}
    }

    const entries = surveyRenderSurfaces({
      findByName: () => RowManagerLike,
    });

    const methods = entries.flatMap((entry) => entry.methods);
    expect(methods).toContain('generate');
  });

  test('finds a JS-side row builder through findByProps', () => {
    const builder = { updateRows: () => {} };

    const entries = surveyRenderSurfaces({
      findByProps: (...props: string[]) => (props.includes('updateRows') ? builder : undefined),
    });

    expect(entries.some((entry) => entry.module === builder)).toBe(true);
  });

  test('reports each object once', () => {
    const shared = { updateRows: () => {} };

    const entries = surveyRenderSurfaces({
      nativeModuleProxy: { ChatA: shared },
      nativeModules: { ChatB: shared },
      findByProps: () => shared,
    });

    expect(entries).toHaveLength(1);
  });

  test('survives getters and enumeration that throw', () => {
    const hostile = new Proxy({}, {
      ownKeys: () => { throw new Error('refused'); },
      get: () => { throw new Error('refused'); },
    });

    expect(() => surveyRenderSurfaces({
      nativeModuleProxy: { Chat: hostile } as any,
      findByProps: () => { throw new Error('lookup failed'); },
      findByName: () => { throw new Error('lookup failed'); },
    })).not.toThrow();
  });

  test('returns nothing when given nothing', () => {
    expect(surveyRenderSurfaces({})).toHaveLength(0);
  });
});
