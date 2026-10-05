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
  const commandReplies: Array<{ channelId: string; content: string }> = [];
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
  const rawSend = messages.sendMessage.bind(messages);

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

      // Mirror the real patcher: replace the prop so isActive() can verify.
      const original = (parent as any)[method];
      (parent as any)[method] = function patchedSend(...args: any[]) {
        return callback({ args, original });
      };

      return () => {
        unpatched = true;
        (parent as any)[method] = original;
      };
    },
    onError: (error) => errors.push(error),
    onFallback: (reason) => fallbacks.push(reason),
    onReply: (channelId, content) => commandReplies.push({ channelId, content }),
  });

  return {
    controller,
    config,
    sent,
    errors,
    fallbacks,
    commandReplies,
    translateCalls,
    get unpatched() {
      return unpatched;
    },
    send(channelId: string, message: any, ...rest: any[]) {
      const args = [channelId, message, ...rest];
      return patched!({
        args,
        // The real original, never the patched prop, to avoid double-routing.
        original: (...called: any[]) => rawSend(
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

    // Argument 3 passes through untouched; argument 4 is the options bag, which
    // gains the nonce. `true` here is a caller-supplied options value, so it is
    // replaced by an object carrying the nonce.
    expect(h.sent[0].rest[0]).toEqual({ replyTo: 'm9' });
    expect(typeof h.sent[0].rest[1].nonce).toBe('string');
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

  test('passes the nonce in the options argument, where Discord honours it', async () => {
    const h = harness({
      translate: async () => ({ text: 'hola', detectedLanguage: 'en' }),
    });
    h.config.setOutgoing('c1', true);
    h.controller.start();

    await h.send('c1', { content: 'hello' });

    // sendMessage(channelId, message, waitForChannelReady, options)
    // A nonce set only on the message object is ignored by Discord.
    const options = h.sent[0].rest[1];
    expect(options).toBeDefined();
    expect(typeof options.nonce).toBe('string');
    expect(options.nonce).toBe(h.sent[0].message.nonce);
  });

  test('preserves an existing options argument while adding the nonce', async () => {
    const h = harness({
      translate: async () => ({ text: 'hola', detectedLanguage: 'en' }),
    });
    h.config.setOutgoing('c1', true);
    h.controller.start();

    await h.send('c1', { content: 'hello' }, undefined, { messageReference: { message_id: 'm9' } });

    const options = h.sent[0].rest[1];
    expect(options.messageReference).toEqual({ message_id: 'm9' });
    expect(typeof options.nonce).toBe('string');
  });

  test('resolves the English by content when Discord replaced the nonce', async () => {
    const h = harness({
      translate: async () => ({ text: 'hola amigo', detectedLanguage: 'en' }),
    });
    h.config.setOutgoing('c1', true);
    h.controller.start();

    await h.send('c1', { content: 'hello friend' });

    // Discord echoes a nonce we never issued.
    expect(h.controller.resolveNonce('some-other-nonce', 'm1')).toBeUndefined();

    const record = h.controller.resolveSent('c1', 'hola amigo', 'm1');
    expect(record).toMatchObject({ english: 'hello friend', sent: 'hola amigo' });
    expect(h.controller.englishFor('m1')?.english).toBe('hello friend');
  });

  test('does not match content from a different chat', async () => {
    const h = harness({
      translate: async () => ({ text: 'hola', detectedLanguage: 'en' }),
    });
    h.config.setOutgoing('c1', true);
    h.controller.start();

    await h.send('c1', { content: 'hello' });

    expect(h.controller.resolveSent('c2', 'hola', 'm1')).toBeUndefined();
    expect(h.controller.resolveSent('c1', 'hola', 'm1')).toBeDefined();
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

describe('text triggers through the send patch', () => {
  test('reports active when the patch verifiably replaced sendMessage', () => {
    const h = harness();
    h.controller.start();

    expect(h.controller.isActive()).toBe(true);

    h.controller.stop();
    expect(h.controller.isActive()).toBe(false);
  });

  test('reports inactive when the patch was silently swallowed', () => {
    const sent: any[] = [];
    const messages = {
      sendMessage(channelId: string, message: any) {
        sent.push({ channelId, message });
        return { ok: true };
      },
    };
    const config = createChatConfig(memoryStore());

    const controller = createOutgoingController({
      messages,
      config,
      translate: async () => null,
      // A no-op patcher stands in for the lazy-proxy case: the callback is
      // registered but sendMessage is never actually replaced.
      patchInstead: () => () => {},
      onError: () => {},
    });

    controller.start();

    expect(controller.isActive()).toBe(false);
  });

  test('a trigger returns a thenable, never null', async () => {
    const h = harness();
    h.controller.start();

    const result = h.send('c1', { content: '!tr on' });

    // The patcher coerces `undefined` to `null`, and Discord chains .then()
    // on the result, so returning nothing crashes the send path.
    expect(result).not.toBeNull();
    expect(result).not.toBeUndefined();
    expect(typeof (result as any)?.then).toBe('function');

    await expect(result).resolves.toMatchObject({ ok: true, cancelled: true });
  });

  test('survives a reply handler that throws', async () => {
    const sent: any[] = [];
    const messages = {
      sendMessage(channelId: string, message: any) {
        sent.push({ channelId, message });
        return Promise.resolve({ ok: true });
      },
    };
    const config = createChatConfig(memoryStore());
    const errors: unknown[] = [];
    let patched: ((ctx: any) => any) | undefined;

    const controller = createOutgoingController({
      messages,
      config,
      translate: async () => null,
      patchInstead: (parent, method, callback) => {
        patched = callback;
        const original = (parent as any)[method];
        (parent as any)[method] = (...args: any[]) => callback({ args, original });
        return () => { (parent as any)[method] = original; };
      },
      onError: (error) => errors.push(error),
      onReply: () => {
        throw new Error('reply blew up');
      },
    });

    controller.start();

    const result = patched!({
      args: ['c1', { content: '!tr on' }],
      original: () => Promise.resolve({ ok: true }),
    });

    // The setting still applies, the throw is captured, nothing is sent.
    await expect(result).resolves.toMatchObject({ cancelled: true });
    expect(config.for('c1').outgoing).toBe(true);
    expect(errors).toHaveLength(1);
    expect(sent).toHaveLength(0);
  });

  test('sends normally when the trigger parser throws', async () => {
    const sent: any[] = [];
    const messages = {
      sendMessage(channelId: string, message: any) {
        sent.push({ channelId, message });
        return Promise.resolve({ ok: true });
      },
    };
    const errors: unknown[] = [];
    let patched: ((ctx: any) => any) | undefined;

    // A config that throws on read forces the parser to fail.
    const hostileConfig = {
      for: () => { throw new Error('store unavailable'); },
      setIncoming: () => {},
      setOutgoing: () => {},
      setOutgoingLanguage: () => {},
      setShowOwnEnglish: () => {},
      enabledChannels: () => [],
      reset: () => {},
    };

    const controller = createOutgoingController({
      messages,
      config: hostileConfig as any,
      translate: async () => null,
      patchInstead: (parent, method, callback) => {
        patched = callback;
        const original = (parent as any)[method];
        (parent as any)[method] = (...args: any[]) => callback({ args, original });
        return () => { (parent as any)[method] = original; };
      },
      onError: (error) => errors.push(error),
    });

    controller.start();

    let delivered = false;
    const result = patched!({
      args: ['c1', { content: 'hello there' }],
      original: () => { delivered = true; return Promise.resolve({ ok: true }); },
    });

    await result;

    expect(delivered).toBe(true);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('a trigger is never sent to the chat', async () => {
    const h = harness();
    h.controller.start();

    await h.send('c1', { content: '!tr on' });

    expect(h.sent).toHaveLength(0);
    expect(h.translateCalls).toHaveLength(0);
    expect(h.config.for('c1')).toMatchObject({ incoming: true, outgoing: true });
    expect(h.commandReplies[0].channelId).toBe('c1');
  });

  test('works in a chat that has translation switched off', async () => {
    const h = harness();
    h.controller.start();

    // The gate must not hide the trigger, or a chat could never be enabled.
    await h.send('c1', { content: '!tr send on' });

    expect(h.sent).toHaveLength(0);
    expect(h.config.for('c1').outgoing).toBe(true);
  });

  test('a trigger is not translated even when sending is on', async () => {
    const h = harness();
    h.config.setOutgoing('c1', true);
    h.controller.start();

    await h.send('c1', { content: '!tr status' });

    expect(h.translateCalls).toHaveLength(0);
    expect(h.sent).toHaveLength(0);
  });

  test('ordinary messages still send normally', async () => {
    const h = harness();
    h.controller.start();

    await h.send('c1', { content: 'not a trigger' });

    expect(h.sent).toHaveLength(1);
    expect(h.commandReplies).toHaveLength(0);
  });

  test('a message merely mentioning the trigger word is sent', async () => {
    const h = harness();
    h.controller.start();

    await h.send('c1', { content: 'use !trick instead' });

    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].message.content).toBe('use !trick instead');
  });

  test('enabling then sending translates the next real message', async () => {
    const h = harness({
      translate: async () => ({ text: 'hola', detectedLanguage: 'en' }),
    });
    h.controller.start();

    await h.send('c1', { content: '!tr send on' });
    await h.send('c1', { content: 'hello' });

    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].message.content).toBe('hola');
  });
});
