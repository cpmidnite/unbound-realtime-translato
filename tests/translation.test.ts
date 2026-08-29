import { describe, expect, test } from 'bun:test';

import {
  createTranslationClient,
  parseGoogleTranslation,
} from '../src/translation';

const response = (translated: string, original: string, language: string) => [
  [[translated, original, null, null, 1]],
  null,
  language,
];

describe('Google-compatible translation client', () => {
  test('parses the compact dictionary endpoint response', () => {
    expect(parseGoogleTranslation([['Hello friends', 'es']])).toEqual({
      text: 'Hello friends',
      detectedLanguage: 'es',
    });
  });

  test('joins translated segments and exposes the detected language', () => {
    expect(
      parseGoogleTranslation([
        [
          ['Hello ', 'Hola ', null, null, 1],
          ['friends', 'amigos', null, null, 1],
        ],
        null,
        'es',
      ]),
    ).toEqual({ text: 'Hello friends', detectedLanguage: 'es' });
  });

  test('does not return a translation for English source text', async () => {
    const client = createTranslationClient({
      fetchImpl: async () => new Response(JSON.stringify(response('Hello there', 'Hello there', 'en'))),
    });

    await expect(client.translate('Hello there')).resolves.toBeNull();
  });

  test('filters empty and non-text messages before making a request', async () => {
    let calls = 0;
    const client = createTranslationClient({
      fetchImpl: async () => {
        calls += 1;
        return new Response('[]');
      },
    });

    await expect(
      client.translate(
        'https://example.com 😀 <a:dance:123> <@123> <@&456> <#789> <t:123:R>',
      ),
    ).resolves.toBeNull();
    expect(calls).toBe(0);
  });

  test('recognizes non-Latin message text', async () => {
    let calls = 0;
    const client = createTranslationClient({
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify(response('Hello', '你好', 'zh-CN')));
      },
    });

    await expect(client.translate('你好')).resolves.toEqual({
      text: 'Hello',
      detectedLanguage: 'zh-CN',
    });
    expect(calls).toBe(1);
  });

  test('caches completed translations and deduplicates in-flight requests', async () => {
    let calls = 0;
    const client = createTranslationClient({
      fetchImpl: async () => {
        calls += 1;
        await Promise.resolve();
        return new Response(JSON.stringify(response('Hello friends', 'Hola amigos', 'es')));
      },
    });

    const first = client.translate('Hola amigos');
    const second = client.translate('Hola amigos');

    await expect(Promise.all([first, second])).resolves.toEqual([
      { text: 'Hello friends', detectedLanguage: 'es' },
      { text: 'Hello friends', detectedLanguage: 'es' },
    ]);
    await expect(client.translate('Hola amigos')).resolves.toEqual({
      text: 'Hello friends',
      detectedLanguage: 'es',
    });
    expect(calls).toBe(1);
  });

  test('rejects unsuccessful endpoint responses', async () => {
    const client = createTranslationClient({
      fetchImpl: async () => new Response('rate limited', { status: 429 }),
    });

    await expect(client.translate('Hola')).rejects.toThrow('429');
  });
});
