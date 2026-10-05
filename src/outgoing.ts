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
  /** True only when the send patch verifiably replaced sendMessage. */
  isActive(): boolean;
  /** English text for one of your own sent messages, if it was translated. */
  englishFor(messageId: string): OutgoingRecord | undefined;
  /** Binds a pending nonce to the server-assigned message id. */
  resolveNonce(nonce: string, messageId: string): OutgoingRecord | undefined;
  /** Fallback match on channel + sent content, when the nonce did not survive. */
  resolveSent(channelId: string, content: string, messageId: string): OutgoingRecord | undefined;
  pendingNonces(): number;
}

const MAX_TRACKED_MESSAGES = 500;

/**
 * Stand-in result for a send we cancelled.
 *
 * Shaped like a successful-but-empty API response so Discord's call site can
 * inspect it without throwing.
 */
export const CANCELLED_SEND = Object.freeze({
  ok: true,
  status: 200,
  body: null,
  cancelled: true,
});

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

/** Key for the content-based fallback index. */
function contentKey(channelId: string, content: string): string {
  return `${channelId}:${content}`;
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
  const pendingByContent = new Map<string, OutgoingRecord>();
  const byMessageId = new Map<string, OutgoingRecord>();
  let unpatch: (() => void) | undefined;
  let active = false;
  let patchedFunction: unknown;

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

      const before = (dependencies.messages as any)?.sendMessage;

      unpatch = dependencies.patchInstead(
        dependencies.messages,
        'sendMessage',
        (ctx) => {
          const args = ctx.args;

          // The entire callback is guarded: this runs inside Discord's send
          // path, so an exception here crashes sending (or the app).
          try {
            const channelId = typeof args[0] === 'string' ? args[0] : null;
            const message = args[1];

            if (!channelId || !message) return ctx.original(...args);

            const english = contentOf(message);

            // Configuration triggers are swallowed: never sent, never
            // translated. Checked before the per-chat gate so a chat can be
            // switched on from inside itself.
            let trigger;
            try {
              trigger = handleTrigger(dependencies.config, channelId, english);
            } catch (error) {
              dependencies.onError(error);
              trigger = { handled: false as const };
            }

            if (trigger.handled) {
              try {
                if (trigger.reply) dependencies.onReply?.(channelId, trigger.reply);
              } catch (error) {
                dependencies.onError(error);
              }

              // Must resolve to a thenable: Discord chains on sendMessage's
              // result, and the patcher turns a bare `undefined` into `null`,
              // which crashes the send path with "null is not an object".
              return Promise.resolve(CANCELLED_SEND);
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
                if (translated) {
                  sent = translated;
                } else {
                  // Reaching here means the translator declined without
                  // throwing. Say so rather than silently sending English.
                  dependencies.onFallback?.(
                    `No ${language.toUpperCase()} translation available; sent English.`,
                  );
                }
              } catch (error) {
                dependencies.onError(error);
                dependencies.onFallback?.('Translation failed; sent English.');
              }

              if (sent === english) return ctx.original(...args);

              const nonce = nonceOf(message) ?? generateNonce();
              const outgoing = { ...message, content: sent, nonce };
              const record: OutgoingRecord = { channelId, english, sent, language };

              pendingByNonce.set(nonce, record);
              // Discord may assign its own nonce, so also index by content:
              // the echo is matched on either key.
              pendingByContent.set(contentKey(channelId, sent), record);

              const nextArgs = [...args];
              nextArgs[1] = outgoing;

              // The nonce is honoured only in the options argument (index 3);
              // `message.nonce` alone is ignored, which leaves the echoed
              // message carrying a different nonce than the one we stored.
              const existingOptions = nextArgs[3];
              nextArgs[3] = existingOptions && typeof existingOptions === 'object'
                ? { ...existingOptions, nonce }
                : { nonce };

              try {
                return await ctx.original(...nextArgs);
              } catch (error) {
                pendingByNonce.delete(nonce);
                pendingByContent.delete(contentKey(channelId, sent));
                throw error;
              }
            })();
          } catch (error) {
            // Anything unexpected: send the message untouched rather than
            // breaking Discord.
            dependencies.onError(error);
            return ctx.original(...args);
          }
        },
      );

      // The patcher swaps the prop; if it still holds the same function, the
      // write was swallowed (lazy proxy) and nothing is intercepted.
      patchedFunction = (dependencies.messages as any)?.sendMessage;
      if (patchedFunction === before) {
        active = false;
        unpatch?.();
        unpatch = undefined;
      }
    },

    stop(): void {
      if (!active) return;
      active = false;
      unpatch?.();
      unpatch = undefined;
      patchedFunction = undefined;
      pendingByNonce.clear();
      pendingByContent.clear();
      byMessageId.clear();
    },

    isActive(): boolean {
      if (!active) return false;
      // Another plugin or a reload may have restored the original since start.
      return (dependencies.messages as any)?.sendMessage === patchedFunction;
    },

    englishFor(messageId: string): OutgoingRecord | undefined {
      return byMessageId.get(messageId);
    },

    resolveNonce(nonce: string, messageId: string): OutgoingRecord | undefined {
      const record = pendingByNonce.get(nonce);
      if (!record) return byMessageId.get(messageId);

      pendingByNonce.delete(nonce);
      pendingByContent.delete(contentKey(record.channelId, record.sent));
      remember(messageId, record);
      return record;
    },

    resolveSent(channelId: string, content: string, messageId: string): OutgoingRecord | undefined {
      const known = byMessageId.get(messageId);
      if (known) return known;

      const key = contentKey(channelId, content);
      const record = pendingByContent.get(key);
      if (!record) return undefined;

      pendingByContent.delete(key);
      remember(messageId, record);
      return record;
    },

    pendingNonces(): number {
      return pendingByNonce.size;
    },
  };
}
