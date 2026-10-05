/**
 * Discord syntax must survive a round trip through a machine translator.
 *
 * Mentions, custom emoji, code, links, and spoilers are replaced with
 * invisible sentinels before translation and restored afterwards. If any
 * sentinel does not survive, the caller must treat the translation as
 * unusable rather than send corrupted text.
 */

const SENTINEL = '\u2063';

const PRESERVED_PATTERNS: RegExp[] = [
  /```[\s\S]*?```/g,
  /`[^`\n]+`/g,
  /\|\|[\s\S]*?\|\|/g,
  /<a?:\w+:\d+>/g,
  /<(?:@!?|@&|#)\d+>/g,
  /<t:\d+(?::[tTdDfFR])?>/g,
  /<\/[\w-]+:\d+>/g,
  /https?:\/\/\S+/gi,
  /@(?:everyone|here)\b/g,
];

export interface MaskedText {
  text: string;
  tokens: string[];
}

function sentinelFor(index: number): string {
  return `${SENTINEL}${index}${SENTINEL}`;
}

export function maskTokens(input: string): MaskedText {
  const tokens: string[] = [];
  let text = input;

  for (const pattern of PRESERVED_PATTERNS) {
    text = text.replace(new RegExp(pattern.source, pattern.flags), (match) => {
      const index = tokens.push(match) - 1;
      return sentinelFor(index);
    });
  }

  return { text, tokens };
}

/**
 * Restores every masked token.
 *
 * @returns The rebuilt string, or `null` when the translator dropped,
 * duplicated, or mangled a sentinel.
 */
export function restoreTokens(text: string, tokens: string[]): string | null {
  let restored = text;

  for (let index = 0; index < tokens.length; index += 1) {
    const sentinel = sentinelFor(index);
    const occurrences = restored.split(sentinel).length - 1;

    if (occurrences !== 1) return null;

    restored = restored.replace(sentinel, () => tokens[index]!);
  }

  if (restored.includes(SENTINEL)) return null;

  return restored;
}

/** True when the text carries nothing a translator could meaningfully change. */
export function isTranslatableOutgoing(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;

  // Slash commands and Discord's own invocation syntax must never be rewritten.
  if (trimmed.startsWith('/')) return false;

  const { text } = maskTokens(trimmed);
  const withoutSentinels = text.replace(
    new RegExp(`${SENTINEL}\\d+${SENTINEL}`, 'g'),
    '',
  );

  return /[A-Za-z\u00C0-\u02FF\u0370-\u1FFF]/.test(withoutSentinels);
}
