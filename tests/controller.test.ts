import { describe, expect, test } from 'bun:test';

import { createRealtimeController } from '../src/controller';

type EventHandler = (event: any) => void;

function harness(result: { text: string; detectedLanguage: string } | null = {
  text: 'Hello *friend* @everyone',
  detectedLanguage: 'es',
}) {
  let handler: EventHandler | undefined;
  const dispatched: any[] = [];
  const messages = new Map<string, any>();
  let translateCalls = 0;
  let unsubscribed = false;

  const controller = createRealtimeController({
    dispatcher: {
      subscribe(type, callback) {
        expect(type).toBe('MESSAGE_CREATE');
        handler = callback;
      },
      unsubscribe(type, callback) {
        expect(type).toBe('MESSAGE_CREATE');
        expect(handler).toBeDefined();
        expect(callback).toBe(handler!);
        unsubscribed = true;
      },
      dispatch(event: any) {
        dispatched.push(event);
        if (event.type === 'MESSAGE_UPDATE') messages.set(event.message.id, event.message);
      },
    },
    users: { getCurrentUser: () => ({ id: 'me' }) },
    getMessage: (_channelId, messageId) => messages.get(messageId),
    translate: async () => {
      translateCalls += 1;
      return result;
    },
    abortTranslations: () => {},
    onError: (error) => {
      throw error;
    },
  });

  return {
    controller,
    dispatched,
    messages,
    emit(message: any) {
      messages.set(message.id, message);
      handler?.({ type: 'MESSAGE_CREATE', message });
    },
    flush: () => new Promise((resolve) => setTimeout(resolve, 0)),
    get translateCalls() {
      return translateCalls;
    },
    get unsubscribed() {
      return unsubscribed;
    },
  };
}

describe('realtime message controller', () => {
  test('adds a safe English subtext line to an incoming message', async () => {
    const h = harness();
    h.controller.start();
    h.emit({
      id: 'm1',
      channel_id: 'c1',
      guild_id: 'g1',
      content: 'Hola amigo',
      author: { id: 'someone-else' },
    });
    await h.flush();

    expect(h.dispatched).toHaveLength(1);
    expect(h.dispatched[0].message.content).toBe(
      'Hola amigo\n-# ↳ English: Hello \\*friend\\* @\u200Beveryone',
    );
    expect(h.dispatched[0].log_edit).toBe(false);
  });

  test('ignores the current user and detected-English messages', async () => {
    const own = harness();
    own.controller.start();
    own.emit({ id: 'm1', channel_id: 'c1', content: 'Hola', author: { id: 'me' } });
    await own.flush();
    expect(own.translateCalls).toBe(0);

    const english = harness(null);
    english.controller.start();
    english.emit({ id: 'm2', channel_id: 'c1', content: 'Hello', author: { id: 'other' } });
    await english.flush();
    expect(english.dispatched).toHaveLength(0);
  });

  test('does not overwrite a message edited while translation is pending', async () => {
    let resolveTranslation!: (value: { text: string; detectedLanguage: string }) => void;
    const h = harness();
    h.controller = createRealtimeController({
      dispatcher: {
        subscribe(_type, callback) {
          (h as any).pendingHandler = callback;
        },
        unsubscribe() {},
        dispatch(event) {
          h.dispatched.push(event);
        },
      },
      users: { getCurrentUser: () => ({ id: 'me' }) },
      getMessage: (_channelId, messageId) => h.messages.get(messageId),
      translate: () => new Promise((resolve) => { resolveTranslation = resolve; }),
      abortTranslations: () => {},
      onError: (error) => { throw error; },
    });
    h.controller.start();

    const message = { id: 'm1', channel_id: 'c1', content: 'Hola', author: { id: 'other' } };
    h.messages.set('m1', message);
    (h as any).pendingHandler({ type: 'MESSAGE_CREATE', message });
    h.messages.set('m1', { ...message, content: 'Hola (edited)' });
    resolveTranslation({ text: 'Hello', detectedLanguage: 'es' });
    await h.flush();

    expect(h.dispatched).toHaveLength(0);
  });

  test('unsubscribes and restores locally modified messages on stop', async () => {
    const h = harness({ text: 'Hello', detectedLanguage: 'es' });
    h.controller.start();
    h.emit({ id: 'm1', channel_id: 'c1', content: 'Hola', author: { id: 'other' } });
    await h.flush();

    h.controller.stop();

    expect(h.unsubscribed).toBe(true);
    expect(h.dispatched.at(-1).message.content).toBe('Hola');
  });
});
