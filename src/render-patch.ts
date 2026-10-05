/**
 * Render-path decoration, the approach BetterDiscord's Translator uses.
 *
 * Writing a translation into Discord's message store does not last: the server
 * copy replaces it after a send and whenever a channel is re-fetched, so the
 * added line appears and then vanishes. BetterDiscord never touches the store.
 * It keeps translations in a plain map and patches the render path, so the text
 * is re-applied on every render and there is nothing to overwrite.
 *
 * On mobile the equivalent seam is the native chat module's `updateRows`, the
 * call that hands rendered rows to the native list. Two things make it unlike a
 * normal patch, and both were got wrong before:
 *
 *  1. The rows arrive as a JSON STRING in argument 2. They must be parsed,
 *     mutated, and re-serialised in a `before` patch.
 *  2. Message content is already PARSED MARKDOWN — an array of nodes such as
 *     `{ type: 'text', content: 'hi' }` — not a string. Assigning a string to
 *     `message.content` renders nothing at all.
 *
 * Verified against the row shape used by working Vendetta/Revenge plugins
 * (`clean-urls`, `use-system-emoji`), which patch this same call.
 */

export interface Decoration {
  /** Plain text the translation belongs to; a mismatch means it is stale. */
  content: string;
  /** Line appended beneath the content. */
  line: string;
}

/** A node in Discord's parsed-markdown content array. */
type ContentNode = Record<string, any>;

interface RenderDependencies {
  /** Every reachable reference to patch. */
  candidates?: Array<{ source: string; name: string; module: any; method: string }>;
  patchBefore(
    parent: any,
    method: string,
    callback: (args: any[]) => void,
  ): () => void;
  getDecoration(messageId: string): Decoration | undefined;
  onError(error: unknown): void;
  /** Optional observer, used by the diagnostics report. */
  observe?: {
    patched(where: string): void;
    call(args: any[], where: string): void;
    parsed(): void;
    decorated(count: number): void;
  };
}

export interface RenderController {
  start(): boolean;
  stop(): void;
  isActive(): boolean;
}

/** Marks our injected nodes so a row is never decorated twice. */
const INJECTED_FLAG = '__realtimeTranslator';

/**
 * Flattens parsed content back to plain text, to compare against what was
 * translated.
 */
export function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((node: ContentNode) => {
      if (typeof node === 'string') return node;
      if (!node || typeof node !== 'object') return '';

      if (node.type === 'text' && typeof node.content === 'string') return node.content;
      if (node.type === 'emoji' && typeof node.surrogate === 'string') return node.surrogate;
      if (node.type === 'customEmoji' && typeof node.alt === 'string') return node.alt;
      if (node.type === 'link' && typeof node.target === 'string') {
        const inner = contentToText(node.content);
        return inner || node.target;
      }

      if (Array.isArray(node.content)) return contentToText(node.content);
      if (typeof node.content === 'string') return node.content;
      if (Array.isArray(node.items)) return contentToText(node.items);

      return '';
    })
    .join('');
}

/**
 * Builds the nodes appended beneath a message.
 *
 * `subtext` renders in Discord's small muted style, matching how the desktop
 * plugin marks a translation as secondary.
 */
export function buildDecorationNodes(line: string): ContentNode[] {
  return [
    { type: 'text', content: '\n', [INJECTED_FLAG]: true },
    {
      type: 'subtext',
      [INJECTED_FLAG]: true,
      content: [{ type: 'text', content: `↳ ${line}` }],
    },
  ];
}

function alreadyDecorated(content: ContentNode[]): boolean {
  return content.some((node) => node && typeof node === 'object' && node[INJECTED_FLAG]);
}

/**
 * Appends the decoration to one parsed row.
 *
 * @returns true when the row was changed.
 */
export function decorateRow(
  row: any,
  getDecoration: (messageId: string) => Decoration | undefined,
): boolean {
  // type 1 is a message row; anything else has no content to decorate.
  if (!row || row.type !== 1) return false;

  const message = row.message;
  const messageId = typeof message?.id === 'string' ? message.id : null;
  if (!messageId) return false;

  const content = message.content;
  if (!Array.isArray(content) || content.length === 0) return false;
  if (alreadyDecorated(content)) return false;

  const decoration = getDecoration(messageId);
  if (!decoration?.line) return false;

  // The row carries different text than what was translated: leave it alone
  // rather than label an edited message with a stale translation.
  if (contentToText(content).trim() !== decoration.content.trim()) return false;

  message.content = [...content, ...buildDecorationNodes(decoration.line)];
  return true;
}

/** Mutates every message row in a parsed `updateRows` payload. */
export function decorateRows(
  rows: unknown,
  getDecoration: (messageId: string) => Decoration | undefined,
): number {
  if (!Array.isArray(rows)) return 0;

  let changed = 0;
  for (const row of rows) {
    if (decorateRow(row, getDecoration)) changed += 1;
  }

  return changed;
}

export function createRenderController(
  dependencies: RenderDependencies,
): RenderController {
  const unpatches: Array<() => void> = [];

  return {
    start(): boolean {
      if (unpatches.length) return true;

      // Patch EVERY reachable reference. One of them is the object Discord
      // actually calls; patching only the first produced an installed patch
      // that never fired.
      for (const candidate of dependencies.candidates ?? []) {
        const { module, method, source, name } = candidate;

        try {
          if (typeof module?.[method] !== 'function') continue;

          const before = module[method];

          const unpatch = dependencies.patchBefore(module, method, (args) => {
            // Never throw: this call renders the message list.
            try {
              dependencies.observe?.call(args, `${source}/${name}.${method}`);

              const raw = args[1];
              if (typeof raw !== 'string') return;

              const rows = JSON.parse(raw);
              dependencies.observe?.parsed();

              const changed = decorateRows(rows, dependencies.getDecoration);
              dependencies.observe?.decorated(changed);

              if (changed > 0) args[1] = JSON.stringify(rows);
            } catch (error) {
              dependencies.onError(error);
            }
          });

          // A lazy proxy swallows defineProperty silently; confirm the swap.
          if (module[method] === before) {
            unpatch();
            continue;
          }

          unpatches.push(unpatch);
          dependencies.observe?.patched(`${source}/${name}.${method}`);
        } catch (error) {
          dependencies.onError(error);
        }
      }

      return unpatches.length > 0;
    },

    stop(): void {
      for (const unpatch of unpatches) {
        try {
          unpatch();
        } catch {
          // ignore
        }
      }

      unpatches.length = 0;
    },

    isActive(): boolean {
      return unpatches.length > 0;
    },
  };
}
