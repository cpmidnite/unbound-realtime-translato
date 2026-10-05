import { isTranslatableOutgoing, maskTokens, restoreTokens } from './tokens';
import { handleTrigger } from './text-command';
import type { ChatConfigController } from './config';
import type { Translation } from './translation';

export interface OutgoingRecord {
  channelId: string;
  english: string;
  sent: string;
  language: string;
}

interface MessagesModule {
  sendMessage(channelId: string, message: any, ...rest: any[]): any;
}

interface OutgoingDependencies {
  messages: MessagesModule;
  config: ChatConfigController;
  translate(text: string, options: { source: string; target: string }): Promise<Translation | null>;
  patchInstead(
    parent: any,
    method: string,
    callback: (ctx: { args: any[]; original: (...args: any[]) => any }) => any,
  ): () => void;
  /** Called when outgoing translation fails; the English text is sent unchanged. */
  onError(error: unknown): void;
  /** Surfaces a short warning to the user when a send falls back to English. */
  onFallback?(reason: string): void;
  /** Shows local-only feedback for a configuration trigger. */
  onReply?(channelId: string, content: string): void;
}

export interface OutgoingController {
  start(): void;
  stop(): void;
  /** English text for one of your own sent messages, if it was translated. */
  englishFor(messageId: string): OutgoingRecord | undefined;
  /** Binds a pending nonce to the server-assigned message id. */
  resolveNonce(nonce: string, messageId: string): OutgoingRecord | undefined;
  pendingNonces(): number;
}

const MAX_TRACKED_MESSAGES = 500;

function contentOf(message: any): string {
  return typeof message?.content === 'string' ? message.content : '';
}

function nonceOf(message: any): string | null {
  const nonce = message?.nonce;
  if (typeof nonce === 'string' && nonce) return nonce;
  if (typeof nonce === 'number') return String(nonce);
  return null;
}

function generateNonce(): string {
  const random = Math.floor(Math.random() * 1e9).toString(36);
  return `rt-${Date.now().toString(36)}-${random}`;
}

/**
 * Translates messages you send, before they leave the device.
 *
 * The wire content becomes the target language, so the recipient reads only
 * that. Your English original is kept locally and re-attached to the message
 * once Discord echoes it back with the same nonce.
 */
export function createOutgoingController(
  dependencies: OutgoingDependencies,
): OutgoingController {
  const pendingByNonce = new Map<string, OutgoingRecord>();
  const byMessageId = new Map<string, OutgoingRecord>();
  let unpatch: (() => void) | undefined;
  let active = false;

  function remember(messageId: string, record: OutgoingRecord): void {
    byMessageId.set(messageId, record);

    while (byMessageId.size > MAX_TRACKED_MESSAGES) {
      const oldest = byMessageId.keys().next().value;
      if (oldest === undefined) break;
      byMessageId.delete(oldest);
    }
  }

  async function translateOutgoing(
    channelId: string,
    english: string,
    language: string,
  ): Promise<string | null> {
    const { text, tokens } = maskTokens(english);

    const translation = await dependencies.translate(text, {
      source: 'en',
      target: language,
    });
    if (!translation) return null;

    const restored = restoreTokens(translation.text, tokens);
    if (!restored) {
      dependencies.onFallback?.('Translation mangled Discord formatting; sent English.');
      return null;
    }

    const trimmed = restored.trim();
    return trimmed ? trimmed : null;
  }

  return {
    start(): void {
      if (active) return;
      active = true;

      unpatch = dependencies.patchInstead(
        dependencies.messages,
        'sendMessage',
        (ctx) => {
          const args = ctx.args;
          const channelId = typeof args[0] === 'string' ? args[0] : null;
          const message = args[1];

          if (!channelId || !message) return ctx.original(...args);

          const english = contentOf(message);

          // Configuration triggers are swallowed: never sent, never translated.
          // Checked before the per-chat gate so a chat can be switched on from
          // inside itself.
          const trigger = handleTrigger(dependencies.config, channelId, english);
          if (trigger.handled) {
            if (trigger.reply) dependencies.onReply?.(channelId, trigger.reply);
            return undefined;
          }

          const config = dependencies.config.for(channelId);
          if (!config.outgoing) return ctx.original(...args);

          if (!isTranslatableOutgoing(english)) return ctx.original(...args);

          const language = config.outgoingLanguage;

          // The send becomes asynchronous: translate first, then hand the
          // rewritten message to Discord's original implementation.
          return (async () => {
            let sent = english;

            try {
              const translated = await translateOutgoing(channelId, english, language);
              if (translated) sent = translated;
            } catch (error) {
              dependencies.onError(error);
              dependencies.onFallback?.('Translation failed; sent English.');
            }

            if (sent === english) return ctx.original(...args);

            const nonce = nonceOf(message) ?? generateNonce();
            const outgoing = { ...message, content: sent, nonce };
            const record: OutgoingRecord = { channelId, english, sent, language };

            pendingByNonce.set(nonce, record);

            const nextArgs = [...args];
            nextArgs[1] = outgoing;

            try {
              return await ctx.original(...nextArgs);
            } catch (error) {
              pendingByNonce.delete(nonce);
              throw error;
            }
          })();
        },
      );
    },

    stop(): void {
      if (!active) return;
      active = false;
      unpatch?.();
      unpatch = undefined;
      pendingByNonce.clear();
      byMessageId.clear();
    },

    englishFor(messageId: string): OutgoingRecord | undefined {
      return byMessageId.get(messageId);
    },

    resolveNonce(nonce: string, messageId: string): OutgoingRecord | undefined {
      const record = pendingByNonce.get(nonce);
      if (!record) return byMessageId.get(messageId);

      pendingByNonce.delete(nonce);
      remember(messageId, record);
      return record;
    },

    pendingNonces(): number {
      return pendingByNonce.size;
    },
  };
}
