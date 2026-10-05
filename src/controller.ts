import type { Translation } from './translation';
import type { ChatConfigController } from './config';
import type { OutgoingController } from './outgoing';

const TRANSLATION_MARKER = '\n-# ↳ English: ';

interface Dispatcher {
  subscribe(type: string, handler: (event: unknown) => void): void;
  unsubscribe(type: string, handler: (event: unknown) => void): void;
  dispatch(event: unknown): void;
}

interface UsersStore {
  getCurrentUser(): { id?: string } | null | undefined;
}

interface ControllerDependencies {
  dispatcher: Dispatcher;
  users: UsersStore;
  getMessage(channelId: string, messageId: string): any;
  getLoadedMessages?(): any[];
  translate(text: string): Promise<Translation | null>;
  abortTranslations(): void;
  onError(error: unknown): void;
  /** Per-channel enable/disable. Omit to treat every channel as inbound-enabled. */
  config?: ChatConfigController;
  /** Supplies the English original for your own outgoing-translated messages. */
  outgoing?: OutgoingController;
}

export interface RealtimeController {
  start(): void;
  stop(): void;
}

interface ModifiedMessage {
  channelId: string;
  messageId: string;
  originalContent: string;
  decoratedContent: string;
  fallback: Record<string, any>;
}

function toPlainMessage(message: any): Record<string, any> {
  if (typeof message?.toJS === 'function') return message.toJS();
  return { ...message };
}

function channelIdOf(message: any): string | null {
  const channelId = message?.channel_id ?? message?.channelId;
  return typeof channelId === 'string' ? channelId : null;
}

function authorIdOf(message: any): string | null {
  const authorId = message?.author?.id ?? message?.author_id ?? message?.authorId;
  return typeof authorId === 'string' ? authorId : null;
}

export function escapeTranslation(text: string): string {
  return text
    .replace(/\s*\r?\n+\s*/g, ' ')
    .trim()
    .replace(/\\/g, '\\\\')
    .replace(/([*_~`|<>\[\]()])/g, '\\$1')
    .replace(/@/g, '@\u200B');
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function createRealtimeController(
  dependencies: ControllerDependencies,
): RealtimeController {
  const historyActionTypes = [
    'LOAD_MESSAGES_SUCCESS',
    'LOCAL_MESSAGES_LOADED',
    'LOAD_MESSAGES_AROUND_SUCCESS',
  ] as const;
  const modified = new Map<string, ModifiedMessage>();
  const pending = new Map<string, number>();
  const historyQueue: any[] = [];
  let active = false;
  let generation = 0;
  let processingHistoryGeneration: number | undefined;

  async function translateMessage(message: any, workGeneration: number): Promise<void> {
    const messageId = typeof message?.id === 'string' ? message.id : null;
    const channelId = channelIdOf(message);
    const content = typeof message?.content === 'string' ? message.content : '';

    if (
      !active
      || !messageId
      || !channelId
      || !content.trim()
      || content.includes(TRANSLATION_MARKER)
      || pending.get(messageId) === workGeneration
    ) return;

    // Locally injected Clyde/bot replies are ours, not conversation.
    if (message?.author?.bot === true) return;

    const config = dependencies.config?.for(channelId);
    const currentUserId = dependencies.users.getCurrentUser()?.id;
    const isOwnMessage = Boolean(currentUserId) && authorIdOf(message) === currentUserId;

    if (isOwnMessage) {
      // Your own message is never sent to the translator: its English original
      // is already held locally by the outgoing controller.
      if (config && !config.showOwnEnglish) return;
      decorateOwnMessage(message, messageId, channelId, content);
      return;
    }

    if (config && !config.incoming) return;

    pending.set(messageId, workGeneration);

    try {
      const translation = await dependencies.translate(content);
      if (!active || workGeneration !== generation || !translation) return;

      const current = dependencies.getMessage(channelId, messageId) ?? message;
      if (current?.content !== content) return;

      const safeTranslation = escapeTranslation(translation.text);
      if (!safeTranslation) return;

      applyTranslation(current, messageId, channelId, content, safeTranslation);
    } finally {
      if (pending.get(messageId) === workGeneration) pending.delete(messageId);
    }
  }

  /** Re-attaches your English original beneath a message you sent translated. */
  function decorateOwnMessage(
    message: any,
    messageId: string,
    channelId: string,
    content: string,
  ): void {
    const outgoing = dependencies.outgoing;
    if (!outgoing) return;

    const nonce = typeof message?.nonce === 'string' || typeof message?.nonce === 'number'
      ? String(message.nonce)
      : null;

    const record = nonce
      ? outgoing.resolveNonce(nonce, messageId)
      : outgoing.englishFor(messageId);

    if (!record || record.sent !== content) return;

    const safeEnglish = escapeTranslation(record.english);
    if (!safeEnglish) return;

    const current = dependencies.getMessage(channelId, messageId) ?? message;
    if (current?.content !== content) return;

    applyTranslation(current, messageId, channelId, content, safeEnglish);
  }

  function applyTranslation(
    current: any,
    messageId: string,
    channelId: string,
    originalContent: string,
    line: string,
  ): void {
    const decoratedContent = `${originalContent}${TRANSLATION_MARKER}${line}`;
    const plain = toPlainMessage(current);
    const updated = {
      ...plain,
      id: messageId,
      channel_id: plain.channel_id ?? channelId,
      content: decoratedContent,
    };

    dependencies.dispatcher.dispatch({
      type: 'MESSAGE_UPDATE',
      message: updated,
      log_edit: false,
    });

    modified.set(messageId, {
      channelId,
      messageId,
      originalContent,
      decoratedContent,
      fallback: updated,
    });
  }

  const onMessageCreate = (event: any): void => {
    const workGeneration = generation;
    void translateMessage(event?.message, workGeneration).catch((error) => {
      if (
        active
        && workGeneration === generation
        && !isAbortError(error)
      ) dependencies.onError(error);
    });
  };

  async function processHistoryQueue(workGeneration: number): Promise<void> {
    if (processingHistoryGeneration === workGeneration) return;
    processingHistoryGeneration = workGeneration;

    try {
      while (
        active
        && workGeneration === generation
        && historyQueue.length > 0
      ) {
        const message = historyQueue.shift();

        try {
          await translateMessage(message, workGeneration);
        } catch (error) {
          if (
            active
            && workGeneration === generation
            && !isAbortError(error)
          ) dependencies.onError(error);
        }
      }
    } finally {
      if (processingHistoryGeneration === workGeneration) {
        processingHistoryGeneration = undefined;
      }
    }
  }

  function enqueueHistory(messages: any[] | undefined): void {
    if (!active || !Array.isArray(messages) || messages.length === 0) return;
    const workGeneration = generation;
    historyQueue.push(...messages);
    void processHistoryQueue(workGeneration);
  }

  const onHistoryLoaded = (event: any): void => {
    enqueueHistory(event?.messages);
  };

  function restoreMessages(): void {
    for (const entry of modified.values()) {
      const current = dependencies.getMessage(entry.channelId, entry.messageId) ?? entry.fallback;
      if (current?.content !== entry.decoratedContent) continue;

      dependencies.dispatcher.dispatch({
        type: 'MESSAGE_UPDATE',
        message: {
          ...toPlainMessage(current),
          id: entry.messageId,
          channel_id: current.channel_id ?? entry.channelId,
          content: entry.originalContent,
        },
        log_edit: false,
      });
    }

    modified.clear();
  }

  return {
    start(): void {
      if (active) return;
      generation += 1;
      active = true;
      dependencies.dispatcher.subscribe('MESSAGE_CREATE', onMessageCreate);
      for (const type of historyActionTypes) {
        dependencies.dispatcher.subscribe(type, onHistoryLoaded);
      }
      enqueueHistory(dependencies.getLoadedMessages?.());
    },

    stop(): void {
      if (!active) return;
      active = false;
      dependencies.dispatcher.unsubscribe('MESSAGE_CREATE', onMessageCreate);
      for (const type of historyActionTypes) {
        dependencies.dispatcher.unsubscribe(type, onHistoryLoaded);
      }
      historyQueue.length = 0;
      dependencies.abortTranslations();
      pending.clear();
      restoreMessages();
    },
  };
}
