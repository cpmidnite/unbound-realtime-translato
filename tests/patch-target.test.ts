import { describe, expect, test } from 'bun:test';

import { isPatchable, resolvePatchTarget } from '../src/patch-target';

/**
 * Replica of Unbound's `lazy()` proxy.
 *
 * Reproduced exactly, including the missing `defineProperty` trap that makes
 * `Object.defineProperty` land on the empty backing object instead of the real
 * module — the reason a patch can silently do nothing.
 */
function unboundLazy<T extends object>(initializer: () => T): T {
  let initialized = false;
  let value: T;

  const resolve = (): T => {
    if (!initialized) {
      value = initializer();
      initialized = true;
    }
    return value;
  };

  return new Proxy({} as T, {
    get: (_, prop) => resolve()[prop as keyof T],
    has: (_, prop) => prop in (resolve() as object),
    set: (_, prop, v) => ((resolve()[prop as keyof T] = v), true),
    deleteProperty: (_, prop) => delete resolve()[prop as keyof T],
    ownKeys: () => Reflect.ownKeys(resolve() as object),
    getPrototypeOf: () => Reflect.getPrototypeOf(resolve() as object),
    getOwnPropertyDescriptor: (_, prop) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(resolve() as object, prop);
      if (descriptor) descriptor.configurable = true;
      return descriptor;
    },
  });
}

describe('lazy-proxy detection', () => {
  test('a plain module is patchable', () => {
    const module = { sendMessage() {}, receiveMessage() {} };
    expect(isPatchable(module, 'sendMessage')).toBe(true);
  });

  test('an Unbound lazy proxy is NOT patchable', () => {
    const real = { sendMessage() {}, receiveMessage() {} };
    const proxy = unboundLazy(() => real);

    // The proxy reads correctly, which is why this failure is invisible.
    expect(typeof (proxy as any).sendMessage).toBe('function');
    expect(isPatchable(proxy, 'sendMessage')).toBe(false);
  });

  test('restores the original function after probing', () => {
    const original = function send() {};
    const module = { sendMessage: original };

    isPatchable(module, 'sendMessage');

    expect(module.sendMessage).toBe(original);
  });

  test('reports a missing function as unpatchable', () => {
    expect(isPatchable({}, 'sendMessage')).toBe(false);
    expect(isPatchable({ sendMessage: 42 }, 'sendMessage')).toBe(false);
    expect(isPatchable(null, 'sendMessage')).toBe(false);
  });
});

describe('patch target resolution', () => {
  test('prefers the directly resolved module over a lazy proxy', () => {
    const real = { sendMessage() {}, receiveMessage() {} };
    const proxy = unboundLazy(() => real);

    const target = resolvePatchTarget(proxy, ['sendMessage', 'receiveMessage'], {
      findByProps: () => real,
    });

    expect(target).toBe(real);
    expect(isPatchable(target, 'sendMessage')).toBe(true);
  });

  test('a patch applied to the resolved target actually intercepts', () => {
    const real = {
      sendMessage: (_channelId: string, message: any) => `sent:${message.content}`,
      receiveMessage() {},
    };
    const proxy = unboundLazy(() => real);

    const target = resolvePatchTarget(proxy, ['sendMessage', 'receiveMessage'], {
      findByProps: () => real,
    });

    const original = target.sendMessage;
    Object.defineProperty(target, 'sendMessage', {
      value: () => 'intercepted',
      configurable: true,
      enumerable: true,
      writable: true,
    });

    // Reading through the proxy must now see the patched function.
    expect((proxy as any).sendMessage('c1', { content: 'hi' })).toBe('intercepted');

    Object.defineProperty(target, 'sendMessage', {
      value: original,
      configurable: true,
      enumerable: true,
      writable: true,
    });
  });

  test('falls back to the candidate when metro cannot resolve', () => {
    const module = { sendMessage() {}, receiveMessage() {} };

    const target = resolvePatchTarget(module, ['sendMessage', 'receiveMessage'], {
      findByProps: () => null,
    });

    expect(target).toBe(module);
  });

  test('survives a throwing metro lookup', () => {
    const module = { sendMessage() {}, receiveMessage() {} };

    const target = resolvePatchTarget(module, ['sendMessage', 'receiveMessage'], {
      findByProps: () => {
        throw new Error('metro not ready');
      },
    });

    expect(target).toBe(module);
  });

  test('throws when nothing usable can be found', () => {
    expect(() => resolvePatchTarget(null, ['sendMessage'], {
      findByProps: () => null,
    })).toThrow('Could not resolve a patchable module');
  });
});
