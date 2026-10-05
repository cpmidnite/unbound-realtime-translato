/**
 * Render-path decoration, the approach BetterDiscord's Translator uses.
 *
 * Writing a translation into Discord's message store does not last: the server
 * copy replaces it after a send and whenever a channel is re-fetched, so the
 * added line appears and then vanishes. BetterDiscord never touches the store.
 * It keeps translations in a plain map and patches the render path, so the text
 * is re-applied on every render and there is nothing for the server to
 * overwrite.
 *
 * Mobile Discord renders messages through `RowManager.generate`, which turns a
 * message record into the row the list draws. Appending to the content there is
 * the mobile equivalent of BetterDiscord's `processMessageContent`.
 */

export interface Decoration {
  /** Content the translation belongs to; a mismatch means it is stale. */
  content: string;
  /** Line appended beneath the content, already escaped. */
  line: string;
}

interface RenderDependencies {
  /** RowManager class, whose prototype carries `generate`. */
  rowManager: any;
  patchAfter(
    parent: any,
    method: string,
    callback: (args: any[], result: any) => any,
  ): () => void;
  /** Resolves the decoration for a message, or undefined. */
  getDecoration(messageId: string): Decoration | undefined;
  onError(error: unknown): void;
}

export interface RenderController {
  start(): boolean;
  stop(): void;
  isActive(): boolean;
}

export const TRANSLATION_MARKER = '\n-# ↳ ';

/**
 * Appends the decoration to a generated row.
 *
 * Exported for testing: it is the whole behaviour, independent of how the
 * patch is installed.
 */
export function decorateRow(
  row: any,
  getDecoration: (messageId: string) => Decoration | undefined,
): void {
  const message = row?.message;
  const messageId = typeof message?.id === 'string' ? message.id : null;
  if (!messageId) return;

  const content = typeof message.content === 'string' ? message.content : '';
  if (!content || content.includes(TRANSLATION_MARKER)) return;

  const decoration = getDecoration(messageId);
  if (!decoration || !decoration.line) return;

  // The stored translation describes different text: leave the row alone rather
  // than label an edited message with a stale translation.
  if (decoration.content !== content) return;

  message.content = `${content}${TRANSLATION_MARKER}${decoration.line}`;
}

export function createRenderController(
  dependencies: RenderDependencies,
): RenderController {
  let unpatch: (() => void) | undefined;

  return {
    start(): boolean {
      if (unpatch) return true;

      const prototype = dependencies.rowManager?.prototype;
      if (!prototype || typeof prototype.generate !== 'function') return false;

      const before = prototype.generate;

      unpatch = dependencies.patchAfter(prototype, 'generate', (_args, result) => {
        try {
          decorateRow(result, dependencies.getDecoration);
        } catch (error) {
          // A throw here would break the message list; never let that happen.
          dependencies.onError(error);
        }

        return result;
      });

      // Confirm the patch took: a lazy proxy swallows defineProperty silently.
      if (prototype.generate === before) {
        unpatch();
        unpatch = undefined;
        return false;
      }

      return true;
    },

    stop(): void {
      unpatch?.();
      unpatch = undefined;
    },

    isActive(): boolean {
      return Boolean(unpatch);
    },
  };
}
