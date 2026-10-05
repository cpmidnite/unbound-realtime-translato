import { describe, expect, test } from 'bun:test';

import { createRealtimeController } from '../src/controller';
import { createChatConfig } from '../src/config';

type EventHandler = (event: any) => void;

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
  outgoingRecords?: Record<string, any>;
} = {}) {
  const handlers = new Map<string, EventHandler>();
  const dispatched: any[] = [];
  const messages = new Map<string, any>();
  const resolved: Array<{ nonce: string; messageId: string }> = [];
  let translateCalls = 0;

  const config = createChatConfig(memoryStore());
  const records = options.outgoingRecords ?? {};

  const controller = createRealtimeController({
    dispatcher: {
      subscribe(type: string, callback: EventHandler) {
        handlers.set(type, callback);
      },
      unsubscribe(type: string) {
        handlers.delete(type);
      },
      dispatch(event: any) {
        dispatched.push(event);
        if (event.type === 'MESSAGE_UPDATE') messages.set(event.message.id, event.message);
      },
    },
    users: { getCurrentUser: () => ({ id: 'me' }) },
    config,
    outgoing: {
      start() {},
      stop() {},
      isActive: () => true,
      pendingNonces: () => 0,
      englishFor: (messageId: string) => records[messageId],
      resolveSent: (_channelId: string, _content: string, messageId: string) => records[messageId],
      resolveNonce: (nonce: string, messageId: string) => {
        resolved.push({ nonce, messageId });
        return records[nonce] ?? records[messageId];
      },
    },
    getMessage: (_channelId: string, messageId: string) => messages.get(messageId),
    translate: async () => {
      translateCalls += 1;
      return { text: 'Hello', detectedLanguage: 'es' };
    },
    abortTranslations: () => {},
    onError: (error: unknown) => { throw error; },
  });

  return {
    controller,
    config,
    dispatched,
    resolved,
    get translateCalls() {
      return translateCalls;
    },
    emit(message: any) {
      messages.set(message.id, message);
      handlers.get('MESSAGE_CREATE')?.({ type: 'MESSAGE_CREATE', message });
    },
    /** Simulates Discord replacing the stored copy, losing our decoration. */
    replaceStored(messageId: string, message: any) {
      messages.set(messageId, message);
    },
    emitAction(type: string, event: Record<string, any>) {
      handlers.get(type)?.({ ...event, type });
    },
    flush: () => new Promise((resolve) => setTimeout(resolve, 0)),
  };
}

describe('per-chat gating', () => {
  test('does not translate incoming messages in a chat that is switched off', async () => {
    const h = harness();
    h.controller.start();

    h.emit({ id: 'm1', channel_id: 'c1', content: 'Hola', author: { id: 'other' } });
    await h.flush();

    expect(h.translateCalls).toBe(0);
    expect(h.dispatched).toHaveLength(0);
  });

  test('translates incoming messages only in the enabled chat', async () => {
    const h = harness();
    h.config.setIncoming('c1', true);
    h.controller.start();

    h.emit({ id: 'm1', channel_id: 'c1', content: 'Hola', author: { id: 'other' } });
    h.emit({ id: 'm2', channel_id: 'c2', content: 'Hola', author: { id: 'other' } });
    await h.flush();

    expect(h.dispatched).toHaveLength(1);
    expect(h.dispatched[0].message.id).toBe('m1');
    expect(h.dispatched[0].message.content).toBe('Hola\n-# ↳ English: Hello');
  });
});

describe('own-message English', () => {
  test('shows your English beneath a message you sent translated', async () => {
    const h = harness({
      outgoingRecords: {
        'nonce-1': {
          channelId: 'c1',
          english: 'I will send it tomorrow',
          sent: 'Lo enviaré mañana',
          language: 'es',
        },
      },
    });
    h.config.setOutgoing('c1', true);
    h.controller.start();

    h.emit({
      id: 'm1',
      channel_id: 'c1',
      nonce: 'nonce-1',
      content: 'Lo enviaré mañana',
      author: { id: 'me' },
    });
    await h.flush();

    expect(h.resolved).toEqual([{ nonce: 'nonce-1', messageId: 'm1' }]);
    expect(h.dispatched).toHaveLength(1);
    expect(h.dispatched[0].message.content).toBe(
      'Lo enviaré mañana\n-# ↳ English: I will send it tomorrow',
    );
  });

  test('never sends your own message to the translator', async () => {
    const h = harness({
      outgoingRecords: {
        'nonce-1': {
          channelId: 'c1',
          english: 'hello',
          sent: 'hola',
          language: 'es',
        },
      },
    });
    h.config.setOutgoing('c1', true);
    h.controller.start();

    h.emit({
      id: 'm1',
      channel_id: 'c1',
      nonce: 'nonce-1',
      content: 'hola',
      author: { id: 'me' },
    });
    await h.flush();

    expect(h.translateCalls).toBe(0);
  });

  test('leaves your own message alone when the English line is switched off', async () => {
    const h = harness({
      outgoingRecords: {
        'nonce-1': {
          channelId: 'c1',
          english: 'hello',
          sent: 'hola',
          language: 'es',
        },
      },
    });
    h.config.setOutgoing('c1', true);
    h.config.setShowOwnEnglish('c1', false);
    h.controller.start();

    h.emit({
      id: 'm1',
      channel_id: 'c1',
      nonce: 'nonce-1',
      content: 'hola',
      author: { id: 'me' },
    });
    await h.flush();

    expect(h.dispatched).toHaveLength(0);
  });

  test('ignores your own untranslated messages', async () => {
    const h = harness();
    h.config.setOutgoing('c1', true);
    h.controller.start();

    h.emit({
      id: 'm1',
      channel_id: 'c1',
      content: 'plain english message',
      author: { id: 'me' },
    });
    await h.flush();

    expect(h.dispatched).toHaveLength(0);
    expect(h.translateCalls).toBe(0);
  });

  test('restores your message when the plugin stops', async () => {
    const h = harness({
      outgoingRecords: {
        'nonce-1': {
          channelId: 'c1',
          english: 'see you',
          sent: 'hasta luego',
          language: 'es',
        },
      },
    });
    h.config.setOutgoing('c1', true);
    h.controller.start();

    h.emit({
      id: 'm1',
      channel_id: 'c1',
      nonce: 'nonce-1',
      content: 'hasta luego',
      author: { id: 'me' },
    });
    await h.flush();

    h.controller.stop();

    expect(h.dispatched.at(-1).message.content).toBe('hasta luego');
  });
});

describe('surviving Discord overwriting the message', () => {
  function withRecord() {
    return harness({
      outgoingRecords: {
        'nonce-1': {
          channelId: 'c1',
          english: 'I will send it tomorrow',
          sent: 'lo enviaré mañana',
          language: 'es',
        },
      },
    });
  }

  test('re-applies the English line after MESSAGE_SEND_SUCCESS', async () => {
    const h = withRecord();
    h.config.setOutgoing('c1', true);
    h.controller.start();

    h.emit({
      id: 'm1',
      channel_id: 'c1',
      nonce: 'nonce-1',
      content: 'lo enviaré mañana',
      author: { id: 'me' },
    });
    await h.flush();

    expect(h.dispatched.at(-1).message.content).toContain('English: I will send it tomorrow');

    // Discord replaces the optimistic message with the server copy, which has
    // no decoration. This is what made the line vanish.
    h.replaceStored('m1', {
      id: 'm1',
      channel_id: 'c1',
      content: 'lo enviaré mañana',
      author: { id: 'me' },
    });
    h.emitAction('MESSAGE_SEND_SUCCESS', { message: { id: 'm1', channel_id: 'c1' } });
    await h.flush();

    expect(h.dispatched.at(-1).message.content).toBe(
      'lo enviaré mañana\n-# ↳ English: I will send it tomorrow',
    );
  });

  test('re-applies after a bare MESSAGE_UPDATE that strips the line', async () => {
    const h = withRecord();
    h.config.setOutgoing('c1', true);
    h.controller.start();

    h.emit({
      id: 'm1',
      channel_id: 'c1',
      nonce: 'nonce-1',
      content: 'lo enviaré mañana',
      author: { id: 'me' },
    });
    await h.flush();

    h.replaceStored('m1', {
      id: 'm1',
      channel_id: 'c1',
      content: 'lo enviaré mañana',
      author: { id: 'me' },
    });
    h.emitAction('MESSAGE_UPDATE', { message: { id: 'm1', channel_id: 'c1' } });
    await h.flush();

    expect(h.dispatched.at(-1).message.content).toContain('English:');
  });

  test('does not loop: re-applying does not trigger another re-application', async () => {
    const h = withRecord();
    h.config.setOutgoing('c1', true);
    h.controller.start();

    h.emit({
      id: 'm1',
      channel_id: 'c1',
      nonce: 'nonce-1',
      content: 'lo enviaré mañana',
      author: { id: 'me' },
    });
    await h.flush();

    h.replaceStored('m1', {
      id: 'm1',
      channel_id: 'c1',
      content: 'lo enviaré mañana',
      author: { id: 'me' },
    });

    const before = h.dispatched.length;
    h.emitAction('MESSAGE_SEND_SUCCESS', { message: { id: 'm1', channel_id: 'c1' } });
    await h.flush();
    await h.flush();

    // Exactly one re-application, not a cascade.
    expect(h.dispatched.length).toBe(before + 1);
  });

  test('leaves an already-decorated message alone', async () => {
    const h = withRecord();
    h.config.setOutgoing('c1', true);
    h.controller.start();

    h.emit({
      id: 'm1',
      channel_id: 'c1',
      nonce: 'nonce-1',
      content: 'lo enviaré mañana',
      author: { id: 'me' },
    });
    await h.flush();

    const before = h.dispatched.length;

    // Store still holds the decorated copy.
    h.emitAction('MESSAGE_SEND_SUCCESS', { message: { id: 'm1', channel_id: 'c1' } });
    await h.flush();

    expect(h.dispatched.length).toBe(before);
  });

  test('drops the decoration when the message was genuinely edited', async () => {
    const h = withRecord();
    h.config.setOutgoing('c1', true);
    h.controller.start();

    h.emit({
      id: 'm1',
      channel_id: 'c1',
      nonce: 'nonce-1',
      content: 'lo enviaré mañana',
      author: { id: 'me' },
    });
    await h.flush();

    // The user edited it to different text; the old translation no longer fits.
    h.replaceStored('m1', {
      id: 'm1',
      channel_id: 'c1',
      content: 'algo completamente distinto',
      author: { id: 'me' },
    });

    const before = h.dispatched.length;
    h.emitAction('MESSAGE_UPDATE', { message: { id: 'm1', channel_id: 'c1' } });
    await h.flush();

    expect(h.dispatched.length).toBe(before);
  });
});
