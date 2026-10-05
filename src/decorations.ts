/**
 * The translation map, modelled on BetterDiscord's `translatedMessages`.
 *
 * Translations live here and nowhere else. Discord's message store is never
 * modified, so nothing the server sends can erase them; the render patch reads
 * this map on every row it builds.
 *
 * Lookups are by message id AND by content, because a message id is not stable.
 * When you send a message Discord renders an optimistic copy under a temporary
 * local id, then replaces it with the server's snowflake. A decoration recorded
 * against the first id becomes unreachable the moment that swap happens, which
 * is exactly the reported "shows up then disappears after sending". The content
 * index survives the swap, since the text is identical either way.
 */

import type { Decoration } from './render-patch';

export interface DecorationStore {
  set(messageId: string, decoration: Decoration): void;
  get(messageId: string): Decoration | undefined;
  /** Falls back to matching on the message text, for a re-keyed message. */
  getByContent(content: string): Decoration | undefined;
  has(messageId: string): boolean;
  delete(messageId: string): void;
  clear(): void;
  size(): number;
}

const MAX_ENTRIES = 1000;

/** Normalises text so the same message matches across a re-key. */
function contentKey(content: string): string {
  return content.replace(/\s+/g, ' ').trim();
}

export function createDecorationStore(maxEntries = MAX_ENTRIES): DecorationStore {
  const entries = new Map<string, Decoration>();
  /** Secondary index: normalised content to decoration. */
  const byContent = new Map<string, Decoration>();

  function evict(): void {
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;

      const stale = entries.get(oldest);
      entries.delete(oldest);

      // Only drop the content entry when it still points at the evicted
      // decoration; a newer message with identical text must survive.
      if (stale) {
        const key = contentKey(stale.content);
        if (byContent.get(key) === stale) byContent.delete(key);
      }
    }

    while (byContent.size > maxEntries) {
      const oldest = byContent.keys().next().value;
      if (oldest === undefined) break;
      byContent.delete(oldest);
    }
  }

  return {
    set(messageId: string, decoration: Decoration): void {
      entries.delete(messageId);
      entries.set(messageId, decoration);

      if (decoration.content) {
        byContent.set(contentKey(decoration.content), decoration);
      }

      evict();
    },

    get(messageId: string): Decoration | undefined {
      return entries.get(messageId);
    },

    getByContent(content: string): Decoration | undefined {
      return byContent.get(contentKey(content));
    },

    has(messageId: string): boolean {
      return entries.has(messageId);
    },

    delete(messageId: string): void {
      const stale = entries.get(messageId);
      entries.delete(messageId);
      if (!stale) return;

      const key = contentKey(stale.content);
      if (byContent.get(key) !== stale) return;

      // Another id may still hold this same decoration — re-keying a sent
      // message sets the new id before deleting the old one, and both point at
      // one object. Only drop the index when nothing references it.
      for (const remaining of entries.values()) {
        if (remaining === stale) return;
      }

      // A different decoration with identical text keeps the index usable.
      for (const remaining of entries.values()) {
        if (contentKey(remaining.content) === key) {
          byContent.set(key, remaining);
          return;
        }
      }

      byContent.delete(key);
    },

    clear(): void {
      entries.clear();
      byContent.clear();
    },

    size(): number {
      return entries.size;
    },
  };
}
