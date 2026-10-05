import { describe, expect, test } from 'bun:test';

import { isTranslatableOutgoing, maskTokens, restoreTokens } from '../src/tokens';

function roundTrip(input: string, translate: (text: string) => string): string | null {
  const { text, tokens } = maskTokens(input);
  return restoreTokens(translate(text), tokens);
}

describe('outgoing token masking', () => {
  test('preserves mentions, emoji, code, links, and spoilers', () => {
    const input = 'hey <@123> see `npm test` and https://example.com <:wave:456> ||secret||';
    const { text, tokens } = maskTokens(input);

    expect(text).not.toContain('<@123>');
    expect(text).not.toContain('https://example.com');
    expect(tokens).toContain('<@123>');
    expect(tokens).toContain('`npm test`');
    expect(tokens).toContain('https://example.com');
    expect(tokens).toContain('<:wave:456>');
    expect(tokens).toContain('||secret||');

    expect(restoreTokens(text, tokens)).toBe(input);
  });

  test('restores tokens after a translator reorders surrounding words', () => {
    const restored = roundTrip(
      'send it to <@99> tomorrow',
      (text) => text.replace('send it to', 'envíaselo a').replace('tomorrow', 'mañana'),
    );

    expect(restored).toBe('envíaselo a <@99> mañana');
  });

  test('fails closed when the translator drops a sentinel', () => {
    const { text, tokens } = maskTokens('ping <@123> now');
    const mangled = text.replace(/\u2063\d+\u2063/, '');

    expect(restoreTokens(mangled, tokens)).toBeNull();
  });

  test('fails closed when the translator duplicates a sentinel', () => {
    const { text, tokens } = maskTokens('ping <@123> now');
    const sentinel = text.match(/\u2063\d+\u2063/)![0];

    expect(restoreTokens(`${text} ${sentinel}`, tokens)).toBeNull();
  });

  test('protects @everyone from being translated into a live mention', () => {
    const { tokens } = maskTokens('tell @everyone now');
    expect(tokens).toContain('@everyone');
  });

  test('never rewrites slash commands', () => {
    expect(isTranslatableOutgoing('/giphy cat')).toBe(false);
    expect(isTranslatableOutgoing('/nick Bob')).toBe(false);
  });

  test('skips messages with no translatable words', () => {
    expect(isTranslatableOutgoing('')).toBe(false);
    expect(isTranslatableOutgoing('   ')).toBe(false);
    expect(isTranslatableOutgoing('https://example.com')).toBe(false);
    expect(isTranslatableOutgoing('<:wave:456>')).toBe(false);
    expect(isTranslatableOutgoing('<@123>')).toBe(false);
    expect(isTranslatableOutgoing('😀😀')).toBe(false);
    expect(isTranslatableOutgoing('```js\nconst a = 1;\n```')).toBe(false);
  });

  test('accepts ordinary prose', () => {
    expect(isTranslatableOutgoing('I will send it tomorrow')).toBe(true);
    expect(isTranslatableOutgoing('ok <@123> done')).toBe(true);
  });
});
