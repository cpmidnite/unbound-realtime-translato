import { describe, expect, test } from 'bun:test';

import { createChatConfig } from '../src/config';
import { createOutgoingController } from '../src/outgoing';

function memoryStore() {
  const data: Record<string, any> = {};

  return {
    get(key: string, def: any) {
      const value = key.split('.').reduce<any>(
        (node, part) => (node == null ? undefined : node[part]),
        data,
      );
      return value === undefined ? def : value;
    },
    set(key: string, value: any) {
      const parts = key.split('.');
      const last = parts.pop()!;
      let node = data;
      for (const part of parts) {
        if (typeof node[part] !== 'object' || node[part] === null) node[part] = {};
        node = node[part];
      }
      node[last] = value;
    },
  };
}

function harness(options: {
  translate?: (text: string, opts: { source: string; target: string }) => Promise<any>;
} = {}) {
  const sent: any[] = [];
  const errors: unknown[] = [];
  const fallbacks: string[] = [];
  const translateCalls: Array<{ text: string; source: string; target: string }> = [];

  const messages = {
    sendMessage(channelId: string, message: any, ...rest: any[]) {
      sent.push({ channelId, message, rest });
      return { ok: true };
    },
  };

  const config = createChatConfig(memoryStore());
  let patched: ((ctx: any) => any) | undefined;
  let unpatched = false;

  const controller = createOutgoingController({
    messages,
    config,
    translate: async (text, opts) => {
      translateCalls.push({ text, ...opts });
      if (options.translate) return options.translate(text, opts);
      return { text: `[es] ${text}`, detectedLanguage: 'en' };
    },
    patchInstead: (parent, method, callback) => {
      expect(parent).toBe(messages);
      expect(method).toBe('sendMessage');
      patched = callback;
      return () => { unpatched = true; };
    },
    onError: (error) => errors.push(error),
    onFallback: (reason) => fallbacks.push(reason),
  });

  return {
    controller,
    config,
    sent,
    errors,
    fallbacks,
    translateCalls,
    get unpatched() {
      return unpatched;
    },
    send(channelId: string, message: any, ...rest: any[]) {
      const args = [channelId, message, ...rest];
      return patched!({
        args,
        original: (...called: any[]) => messages.sendMessage(
          called[0],
          called[1],
          ...called.slice(2),
        ),
      });
    },
    /** Drives the patch with a caller-supplied `original`, for failure paths. */
    sendWith(args: any[], original: (...called: any[]) => any) {
      return patched!({ args, original });
    },
  };
}

describe('outgoing translation', () => {
  test('does nothing when the chat has outgoing translation off', async () => {
    const h = harness();
    h.controller.start();

    await h.send('c1', { content: 'I will send it tomorrow' });

    expect(h.translateCalls).toHaveLength(0);
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].message.content).toBe('I will send it tomorrow');
  });

  test('sends the translated text and never the English original', async () => {
    const h = harness({
      translate: async () => ({ text: 'Lo enviaré mañana', detectedLanguage: 'en' }),
    });
    h.config.setOutgoing('c1', true);
    h.controller.start();

    await h.send('c1', { content: 'I will send it tomorrow' });

    expect(h.translateCalls[0]).toMatchObject({ source: 'en', target: 'es' });
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].message.content).toBe('Lo enviaré mañana');
    expect(h.sent[0].message.content).not.toContain('I will send it tomorrow');
  });

  test('keeps the English original retrievable once Discord echoes the nonce', async () => {
    const h = harness();
    h.config.setOutgoing('c1', true);
    h.controller.start();

    await h.send('c1', { content: 'see you soon' });

    const nonce = h.sent[0].message.nonce;
    expect(typeof nonce).toBe('string');
    expect(h.controller.pendingNonces()).toBe(1);

    const record = h.controller.resolveNonce(nonce, 'm-100');
    expect(record).toMatchObject({
      channelId: 'c1',
      english: 'see you soon',
      sent: '[es] see you soon',
      language: 'es',
    });
    expect(h.controller.pendingNonces()).toBe(0);
    expect(h.controller.englishFor('m-100')?.english).toBe('see you soon');
  });

  test('honours a per-chat send language', async () => {
    const h = harness();
    h.config.setOutgoing('c1', true);
    h.config.setOutgoingLanguage('c1', 'pt');
    h.controller.start();

    await h.send('c1', { content: 'good morning' });

    expect(h.translateCalls[0]).toMatchObject({ source: 'en', target: 'pt' });
    expect(h.controller.resolveNonce(h.sent[0].message.nonce, 'm1')?.language).toBe('pt');
  });

  test('translates one chat while leaving another untouched', async () => {
    const h = harness();
    h.config.setOutgoing('c1', true);
    h.controller.start();

    await h.send('c1', { content: 'hello there' });
    await h.send('c2', { content: 'hello there' });

    expect(h.sent[0].message.content).toBe('[es] hello there');
    expect(h.sent[1].message.content).toBe('hello there');
  });

  test('sends English unchanged when translation fails', async () => {
    const h = harness({
      translate: async () => {
        throw new Error('endpoint down');
      },
    });
    h.config.setOutgoing('c1', true);
    h.controller.start();

    await h.send('c1', { content: 'ship it today' });

    expect(h.errors).toHaveLength(1);
    expect(h.sent[0].message.content).toBe('ship it today');
    expect(h.fallbacks[0]).toContain('sent English');
  });

  test('sends English unchanged when the translator returns nothing', async () => {
    const h = harness({ translate: async () => null });
    h.config.setOutgoing('c1', true);
    h.controller.start();

    await h.send('c1', { content: 'already spanish enough' });

    expect(h.sent[0].message.content).toBe('already spanish enough');
  });

  test('falls back to English when formatting cannot be restored', async () => {
    const h = harness({
      // Drops every sentinel, simulating a translator that eats placeholders.
      translate: async (text) => ({
        text: text.replace(/\u2063\d+\u2063/g, ''),
        detectedLanguage: 'en',
      }),
    });
    h.config.setOutgoing('c1', true);
    h.controller.start();

    await h.send('c1', { content: 'ping <@123> now' });

    expect(h.sent[0].message.content).toBe('ping <@123> now');
    expect(h.fallbacks[0]).toContain('formatting');
  });

  test('never rewrites slash commands', async () => {
    const h = harness();
    h.config.setOutgoing('c1', true);
    h.controller.start();

    await h.send('c1', { content: '/giphy cat' });

    expect(h.translateCalls).toHaveLength(0);
    expect(h.sent[0].message.content).toBe('/giphy cat');
  });

  test('preserves extra sendMessage arguments', async () => {
    const h = harness();
    h.config.setOutgoing('c1', true);
    h.controller.start();

    await h.send('c1', { content: 'hi there' }, { replyTo: 'm9' }, true);

    expect(h.sent[0].rest).toEqual([{ replyTo: 'm9' }, true]);
  });

  test('drops the pending nonce when the send itself throws', async () => {
    const h = harness();
    h.config.setOutgoing('c1', true);
    h.controller.start();

    await expect(
      h.sendWith(
        ['c1', { content: 'hello again' }],
        () => Promise.reject(new Error('network')),
      ),
    ).rejects.toThrow('network');

    expect(h.controller.pendingNonces()).toBe(0);
  });

  test('unpatches and clears state on stop', async () => {
    const h = harness();
    h.config.setOutgoing('c1', true);
    h.controller.start();

    await h.send('c1', { content: 'bye for now' });
    expect(h.controller.pendingNonces()).toBe(1);

    h.controller.stop();

    expect(h.unpatched).toBe(true);
    expect(h.controller.pendingNonces()).toBe(0);
  });
});
