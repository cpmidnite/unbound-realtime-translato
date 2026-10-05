import { describe, expect, test } from 'bun:test';

import { createRealtimeController } from '../src/controller';

type EventHandler = (event: any) => void;

function harness(result: { text: string; detectedLanguage: string } | null = {
  text: 'Hello *friend* @everyone',
  detectedLanguage: 'es',
}, options: { loadedMessages?: any[] } = {}) {
  const handlers = new Map<string, EventHandler>();
  const dispatched: any[] = [];
  const messages = new Map<string, any>();
  let translateCalls = 0;
  const unsubscribedTypes = new Set<string>();

  for (const message of options.loadedMessages ?? []) messages.set(message.id, message);

  const dependencies = {
    dispatcher: {
      subscribe(type: string, callback: EventHandler) {
        expect(handlers.has(type)).toBe(false);
        handlers.set(type, callback);
      },
      unsubscribe(type: string, callback: EventHandler) {
        expect(handlers.get(type)).toBeDefined();
        expect(callback).toBe(handlers.get(type)!);
        handlers.delete(type);
        unsubscribedTypes.add(type);
      },
      dispatch(event: any) {
        dispatched.push(event);
        if (event.type === 'MESSAGE_UPDATE') messages.set(event.message.id, event.message);
      },
    },
    users: { getCurrentUser: () => ({ id: 'me' }) },
    getMessage: (_channelId: string, messageId: string) => messages.get(messageId),
    translate: async () => {
      translateCalls += 1;
      return result;
    },
    abortTranslations: () => {},
    onError: (error: unknown) => {
      throw error;
    },
    ...(options.loadedMessages
      ? { getLoadedMessages: () => options.loadedMessages! }
      : {}),
  };

  const controller = createRealtimeController(dependencies);

  return {
    controller,
    dispatched,
    messages,
    emit(message: any) {
      messages.set(message.id, message);
      handlers.get('MESSAGE_CREATE')?.({ type: 'MESSAGE_CREATE', message });
    },
    emitAction(type: string, event: Record<string, any>) {
      for (const message of event.messages ?? []) messages.set(message.id, message);
      handlers.get(type)?.({ ...event, type });
    },
    flush: () => new Promise((resolve) => setTimeout(resolve, 0)),
    get translateCalls() {
      return translateCalls;
    },
    get unsubscribed() {
      return unsubscribedTypes;
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

  test('translates historical messages from every history action', async () => {
    const h = harness({ text: 'Hello', detectedLanguage: 'es' });
    h.controller.start();

    for (const [type, message] of [
      ['LOAD_MESSAGES_SUCCESS', {
        id: 'history-1',
        channel_id: 'c1',
        content: 'Hola',
        author: { id: 'other' },
      }],
      ['LOCAL_MESSAGES_LOADED', {
        id: 'history-2',
        channel_id: 'c1',
        content: 'Buenos días',
        author: { id: 'other' },
      }],
      ['LOAD_MESSAGES_AROUND_SUCCESS', {
        id: 'history-3',
        channel_id: 'c1',
        content: 'Buenas noches',
        author: { id: 'other' },
      }],
    ] as const) {
      h.emitAction(type, { messages: [message] });
    }
    await h.flush();

    expect(h.dispatched.map((event) => ({
      id: event.message.id,
      content: event.message.content,
    }))).toEqual([
      { id: 'history-1', content: 'Hola\n-# ↳ English: Hello' },
      { id: 'history-2', content: 'Buenos días\n-# ↳ English: Hello' },
      { id: 'history-3', content: 'Buenas noches\n-# ↳ English: Hello' },
    ]);
  });

  test('translates messages already loaded when the controller starts', async () => {
    const h = harness(
      { text: 'Hello', detectedLanguage: 'es' },
      {
        loadedMessages: [
          {
            id: 'loaded-1',
            channel_id: 'c1',
            content: 'Hola desde antes',
            author: { id: 'other' },
          },
        ],
      },
    );

    h.controller.start();
    await h.flush();

    expect(h.dispatched.map((event) => ({
      id: event.message.id,
      content: event.message.content,
    }))).toEqual([
      { id: 'loaded-1', content: 'Hola desde antes\n-# ↳ English: Hello' },
    ]);
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
        subscribe(type, callback) {
          if (type === 'MESSAGE_CREATE') (h as any).pendingHandler = callback;
        },
        unsubscribe() {},
        dispatch(event: any) {
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

  test('isolates pending translation work across controller restarts', async () => {
    type TranslationResult = { text: string; detectedLanguage: string };
    const handlers = new Map<string, EventHandler>();
    const dispatched: any[] = [];
    const messages = new Map<string, any>();
    const resolvers: Array<(value: TranslationResult) => void> = [];
    const controller = createRealtimeController({
      dispatcher: {
        subscribe(type, callback) {
          handlers.set(type, callback);
        },
        unsubscribe(type) {
          handlers.delete(type);
        },
        dispatch(event: any) {
          dispatched.push(event);
          if (event.type === 'MESSAGE_UPDATE') messages.set(event.message.id, event.message);
        },
      },
      users: { getCurrentUser: () => ({ id: 'me' }) },
      getMessage: (_channelId, messageId) => messages.get(messageId),
      translate: () => new Promise((resolve) => {
        resolvers.push(resolve);
      }),
      abortTranslations: () => {},
      onError: (error) => { throw error; },
    });
    const message = {
      id: 'm1',
      channel_id: 'c1',
      content: 'Hola',
      author: { id: 'other' },
    };

    controller.start();
    messages.set(message.id, message);
    handlers.get('LOAD_MESSAGES_SUCCESS')?.({
      type: 'LOAD_MESSAGES_SUCCESS',
      messages: [message],
    });
    controller.stop();

    controller.start();
    handlers.get('LOAD_MESSAGES_SUCCESS')?.({
      type: 'LOAD_MESSAGES_SUCCESS',
      messages: [message],
    });
    expect(resolvers).toHaveLength(2);

    resolvers[0]({ text: 'Stale translation', detectedLanguage: 'es' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(dispatched).toHaveLength(0);

    handlers.get('MESSAGE_CREATE')?.({ type: 'MESSAGE_CREATE', message });
    expect(resolvers).toHaveLength(2);

    resolvers[1]({ text: 'Current translation', detectedLanguage: 'es' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].message.content).toBe(
      'Hola\n-# ↳ English: Current translation',
    );
  });

  test('unsubscribes and restores locally modified messages on stop', async () => {
    const h = harness({ text: 'Hello', detectedLanguage: 'es' });
    h.controller.start();
    h.emit({ id: 'm1', channel_id: 'c1', content: 'Hola', author: { id: 'other' } });
    await h.flush();

    h.controller.stop();

    expect(h.unsubscribed).toEqual(new Set([
      'MESSAGE_CREATE',
      'LOAD_MESSAGES_SUCCESS',
      'LOCAL_MESSAGES_LOADED',
      'LOAD_MESSAGES_AROUND_SUCCESS',
      'MESSAGE_SEND_SUCCESS',
      'MESSAGE_UPDATE',
      'MESSAGE_SEND_FAILED',
    ]));
    expect(h.dispatched.at(-1).message.content).toBe('Hola');
  });
});
