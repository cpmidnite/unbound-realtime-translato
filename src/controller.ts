import type { Translation } from './translation';
import type { ChatConfigController } from './config';
import type { OutgoingController } from './outgoing';
import type { DecorationStore } from './decorations';

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
  /**
   * Records a translation for the render patch to apply.
   *
   * When present, translations are kept out of Discord's message store entirely
   * (BetterDiscord's approach) so the server cannot overwrite them. When
   * absent, the controller falls back to dispatching a local MESSAGE_UPDATE.
   */
  decorations?: DecorationStore;
  /** Asks the message list to re-render after a decoration is recorded. */
  requestRerender?(channelId: string, messageId: string): void;
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

/**
 * Collapses whitespace without escaping markdown.
 *
 * The render patch puts the line in its own text node, where backslashes would
 * be shown literally; only the store-update fallback needs escaping. `@` is
 * still neutralised so a translation can never become a live mention.
 */
export function plainLine(text: string): string {
  return text
    .replace(/\s*\r?\n+\s*/g, ' ')
    .trim()
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

  /**
   * Events that replace a message already in the store with a server copy,
   * discarding our local decoration. Each one must trigger re-application.
   */
  const reconcileActionTypes = [
    'MESSAGE_SEND_SUCCESS',
    'MESSAGE_UPDATE',
    'MESSAGE_SEND_FAILED',
  ] as const;

  const modified = new Map<string, ModifiedMessage>();
  const pending = new Map<string, number>();
  const historyQueue: any[] = [];
  let active = false;
  let generation = 0;
  let processingHistoryGeneration: number | undefined;
  let reconciling = false;

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

    // Already recorded for the render patch: do not translate twice.
    if (dependencies.decorations?.has(messageId)) return;

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

      applyTranslation(
        current,
        messageId,
        channelId,
        content,
        safeTranslation,
        plainLine(translation.text),
      );
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

    // Prefer the nonce; fall back to matching the sent content, since Discord
    // may replace the nonce we supplied.
    const record = (nonce ? outgoing.resolveNonce(nonce, messageId) : undefined)
      ?? outgoing.resolveSent(channelId, content, messageId);

    if (!record || record.sent !== content) return;

    const safeEnglish = escapeTranslation(record.english);
    if (!safeEnglish) return;

    const current = dependencies.getMessage(channelId, messageId) ?? message;
    if (current?.content !== content) return;

    applyTranslation(
      current,
      messageId,
      channelId,
      content,
      safeEnglish,
      plainLine(record.english),
    );
  }

  function applyTranslation(
    current: any,
    messageId: string,
    channelId: string,
    originalContent: string,
    line: string,
    rawLine?: string,
  ): void {
    // Preferred path: record the translation and let the render patch apply it.
    // Discord's store is left untouched, so nothing can overwrite the result.
    if (dependencies.decorations) {
      dependencies.decorations.set(messageId, {
        content: originalContent,
        line: `English: ${rawLine ?? line}`,
      });

      modified.set(messageId, {
        channelId,
        messageId,
        originalContent,
        decoratedContent: '',
        fallback: current,
      });

      dependencies.requestRerender?.(channelId, messageId);
      return;
    }

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

  /**
   * Re-applies a decoration that Discord overwrote.
   *
   * After a send completes, Discord replaces the optimistic message with the
   * server's copy, which has none of our added text. The same happens when a
   * message is edited or re-fetched. Without this, the English line appears for
   * a moment and then vanishes.
   */
  function reconcile(messageId: string): void {
    if (!active) return;

    // In decoration mode the store was never modified, so there is nothing to
    // repair: the render patch re-applies the line on every render.
    if (dependencies.decorations) return;

    const entry = modified.get(messageId);
    if (!entry) return;

    const current = dependencies.getMessage(entry.channelId, messageId);
    if (!current) return;

    const content = typeof current.content === 'string' ? current.content : '';

    // Already decorated: nothing to do.
    if (content.includes(TRANSLATION_MARKER)) return;

    // The message was genuinely edited to something else, so the stored
    // translation no longer describes it. Drop it rather than mislabel.
    if (content !== entry.originalContent) {
      modified.delete(messageId);
      return;
    }

    const plain = toPlainMessage(current);
    const updated = {
      ...plain,
      id: messageId,
      channel_id: plain.channel_id ?? entry.channelId,
      content: entry.decoratedContent,
    };

    reconciling = true;
    try {
      dependencies.dispatcher.dispatch({
        type: 'MESSAGE_UPDATE',
        message: updated,
        log_edit: false,
      });
    } finally {
      reconciling = false;
    }

    modified.set(messageId, { ...entry, fallback: updated });
  }

  const onReconcile = (event: any): void => {
    // Our own re-application dispatches MESSAGE_UPDATE; ignore that.
    if (!active || reconciling) return;

    const messageId = typeof event?.message?.id === 'string'
      ? event.message.id
      : (typeof event?.messageId === 'string' ? event.messageId : null);

    if (messageId) {
      // Let Discord's own stores settle before re-reading and re-applying.
      setTimeout(() => reconcile(messageId), 0);
      return;
    }

    // Some payloads omit the id; re-check everything we have decorated.
    for (const id of [...modified.keys()]) {
      setTimeout(() => reconcile(id), 0);
    }
  };

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
    // Decoration mode leaves Discord's store untouched; dropping the map is
    // enough, and the next render shows the original text.
    if (dependencies.decorations) {
      dependencies.decorations.clear();
      modified.clear();
      return;
    }

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
      for (const type of reconcileActionTypes) {
        dependencies.dispatcher.subscribe(type, onReconcile);
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
      for (const type of reconcileActionTypes) {
        dependencies.dispatcher.unsubscribe(type, onReconcile);
      }
      historyQueue.length = 0;
      dependencies.abortTranslations();
      pending.clear();
      restoreMessages();
    },
  };
}
