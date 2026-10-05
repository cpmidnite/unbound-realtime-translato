/**
 * The translation map, modelled on BetterDiscord's `translatedMessages`.
 *
 * Translations live here and nowhere else. Discord's message store is never
 * modified, so nothing the server sends can erase them; the render patch reads
 * this map on every row it builds.
 */

import type { Decoration } from './render-patch';

export interface DecorationStore {
  set(messageId: string, decoration: Decoration): void;
  get(messageId: string): Decoration | undefined;
  has(messageId: string): boolean;
  delete(messageId: string): void;
  clear(): void;
  size(): number;
}

const MAX_ENTRIES = 1000;

export function createDecorationStore(maxEntries = MAX_ENTRIES): DecorationStore {
  const entries = new Map<string, Decoration>();

  return {
    set(messageId: string, decoration: Decoration): void {
      entries.delete(messageId);
      entries.set(messageId, decoration);

      while (entries.size > maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },

    get(messageId: string): Decoration | undefined {
      return entries.get(messageId);
    },

    has(messageId: string): boolean {
      return entries.has(messageId);
    },

    delete(messageId: string): void {
      entries.delete(messageId);
    },

    clear(): void {
      entries.clear();
    },

    size(): number {
      return entries.size;
    },
  };
}
