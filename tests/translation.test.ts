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
  test('parses the flat response an explicit source language returns', () => {
    // Captured live: sl=en&tl=es responds ["lo enviaré mañana"], with no
    // nesting and no detected language. This shape broke every outbound
    // translation before it was handled.
    expect(parseGoogleTranslation(['lo enviaré mañana'])).toEqual({
      text: 'lo enviaré mañana',
      detectedLanguage: '',
    });
  });

  test('parses a flat multi-sentence response', () => {
    expect(parseGoogleTranslation(['Lo enviaré mañana. Nos vemos entonces.'])).toEqual({
      text: 'Lo enviaré mañana. Nos vemos entonces.',
      detectedLanguage: '',
    });
  });

  test('still parses the nested response sl=auto returns', () => {
    expect(parseGoogleTranslation([['I will send it tomorrow', 'es']])).toEqual({
      text: 'I will send it tomorrow',
      detectedLanguage: 'es',
    });
  });

  test('rejects responses carrying no usable text', () => {
    expect(() => parseGoogleTranslation([''])).toThrow('no translated text');
    expect(() => parseGoogleTranslation([])).toThrow('unexpected response');
    expect(() => parseGoogleTranslation(null)).toThrow('unexpected response');
    expect(() => parseGoogleTranslation([42])).toThrow('unexpected response');
  });

  test('returns an en->es translation end to end from the real payload shape', async () => {
    const requested: string[] = [];
    const client = createTranslationClient({
      fetchImpl: async (url: string) => {
        requested.push(url);
        return {
          ok: true,
          status: 200,
          // Exactly what the live endpoint returns for sl=en&tl=es.
          json: async () => ['lo enviaré mañana'],
        };
      },
    });

    const result = await client.translate('I will send it tomorrow', {
      source: 'en',
      target: 'es',
    });

    expect(requested[0]).toContain('sl=en');
    expect(requested[0]).toContain('tl=es');
    expect(result).toEqual({ text: 'lo enviaré mañana', detectedLanguage: '' });
  });

  test('keeps a translation that happens to equal the source across languages', async () => {
    const client = createTranslationClient({
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        // "ok" -> "OK": identical ignoring case, but a real es translation.
        json: async () => ['OK'],
      }),
    });

    const result = await client.translate('ok', { source: 'en', target: 'es' });

    expect(result).not.toBeNull();
    expect(result!.text).toBe('OK');
  });

  test('caches per direction so en->es and auto->en do not collide', async () => {
    let calls = 0;
    const client = createTranslationClient({
      fetchImpl: async (url: string) => {
        calls += 1;
        return {
          ok: true,
          status: 200,
          json: async () => (url.includes('tl=es')
            ? ['hola']
            : [['hello', 'es']]),
        };
      },
    });

    const outbound = await client.translate('hello', { source: 'en', target: 'es' });
    const inbound = await client.translate('hello', { source: 'auto', target: 'en' });

    expect(calls).toBe(2);
    expect(outbound!.text).toBe('hola');
    expect(inbound!.text).toBe('hello');
  });

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
