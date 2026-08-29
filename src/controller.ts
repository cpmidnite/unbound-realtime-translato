import type { Translation } from './translation';

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
  translate(text: string): Promise<Translation | null>;
  abortTranslations(): void;
  onError(error: unknown): void;
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
  const modified = new Map<string, ModifiedMessage>();
  const pending = new Set<string>();
  let active = false;

  async function translateMessage(message: any): Promise<void> {
    const messageId = typeof message?.id === 'string' ? message.id : null;
    const channelId = channelIdOf(message);
    const content = typeof message?.content === 'string' ? message.content : '';

    if (
      !active
      || !messageId
      || !channelId
      || !content.trim()
      || content.includes(TRANSLATION_MARKER)
      || pending.has(messageId)
    ) return;

    const currentUserId = dependencies.users.getCurrentUser()?.id;
    if (currentUserId && authorIdOf(message) === currentUserId) return;

    pending.add(messageId);

    try {
      const translation = await dependencies.translate(content);
      if (!active || !translation) return;

      const current = dependencies.getMessage(channelId, messageId) ?? message;
      if (current?.content !== content) return;

      const safeTranslation = escapeTranslation(translation.text);
      if (!safeTranslation) return;

      const decoratedContent = `${content}${TRANSLATION_MARKER}${safeTranslation}`;
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
        originalContent: content,
        decoratedContent,
        fallback: updated,
      });
    } finally {
      pending.delete(messageId);
    }
  }

  const onMessageCreate = (event: any): void => {
    void translateMessage(event?.message).catch((error) => {
      if (active && !isAbortError(error)) dependencies.onError(error);
    });
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
      active = true;
      dependencies.dispatcher.subscribe('MESSAGE_CREATE', onMessageCreate);
    },

    stop(): void {
      if (!active) return;
      active = false;
      dependencies.dispatcher.unsubscribe('MESSAGE_CREATE', onMessageCreate);
      dependencies.abortTranslations();
      pending.clear();
      restoreMessages();
    },
  };
}
