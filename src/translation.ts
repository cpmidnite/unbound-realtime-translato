export const DEFAULT_TRANSLATION_ENDPOINT =
  'https://clients5.google.com/translate_a/t';

export interface Translation {
  text: string;
  detectedLanguage: string;
}

export interface TranslateOptions {
  /** Source language, or `auto` to let the endpoint detect it. */
  source?: string;
  /** Target language. Defaults to English. */
  target?: string;
}

interface FetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<FetchResponse>;

export interface TranslationClientOptions {
  endpoint?: string;
  fetchImpl?: FetchLike;
  maxCacheEntries?: number;
  timeoutMs?: number;
}

export interface TranslationClient {
  translate(text: string, options?: TranslateOptions): Promise<Translation | null>;
  abort(): void;
}

function normalized(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function comparable(text: string): string {
  return normalized(text).toLocaleLowerCase();
}

function baseLanguage(value: string): string {
  return value.toLocaleLowerCase().split('-')[0] ?? '';
}

export function hasTranslatableText(text: string): boolean {
  const withoutDiscordSyntax = text
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/<a?:\w+:\d+>/g, '')
    .replace(/<(?:@!?|@&|#)\d+>/g, '')
    .replace(/<t:\d+(?::[tTdDfFR])?>/g, '')
    .replace(/<\/[\w-]+:\d+>/g, '');

  return /[A-Za-z0-9\u00C0-\u02FF\u0370-\u1FFF\u2C00-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]/
    .test(withoutDiscordSyntax);
}

export function parseGoogleTranslation(payload: unknown): Translation {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
    throw new Error('Translation endpoint returned an unexpected response.');
  }

  if (typeof payload[0][0] === 'string') {
    const text = payload[0][0].trim();
    const detectedLanguage = typeof payload[0][1] === 'string' ? payload[0][1] : '';

    if (!text) throw new Error('Translation endpoint returned no translated text.');
    return { text, detectedLanguage };
  }

  const text = payload[0]
    .map((segment: unknown) => (Array.isArray(segment) && typeof segment[0] === 'string'
      ? segment[0]
      : ''))
    .join('')
    .trim();
  const detectedLanguage = typeof payload[2] === 'string' ? payload[2] : '';

  if (!text) {
    throw new Error('Translation endpoint returned no translated text.');
  }

  return { text, detectedLanguage };
}

export function createTranslationClient(
  options: TranslationClientOptions = {},
): TranslationClient {
  const endpoint = options.endpoint ?? DEFAULT_TRANSLATION_ENDPOINT;
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike);
  const maxCacheEntries = options.maxCacheEntries ?? 250;
  const timeoutMs = options.timeoutMs ?? 12_000;
  const cache = new Map<string, Translation | null>();
  const inFlight = new Map<string, Promise<Translation | null>>();
  const controllers = new Set<AbortController>();
  let aborted = false;

  function readCache(key: string): { hit: boolean; value: Translation | null } {
    if (!cache.has(key)) return { hit: false, value: null };

    const value = cache.get(key) ?? null;
    cache.delete(key);
    cache.set(key, value);
    return { hit: true, value };
  }

  function writeCache(key: string, value: Translation | null): void {
    cache.delete(key);
    cache.set(key, value);

    while (cache.size > maxCacheEntries) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }

  async function request(
    text: string,
    source: string,
    target: string,
  ): Promise<Translation | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    controllers.add(controller);

    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${endpoint}${separator}client=dict-chrome-ex`
      + `&sl=${encodeURIComponent(source)}`
      + `&tl=${encodeURIComponent(target)}`;

    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: `q=${encodeURIComponent(text)}`,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Translation endpoint failed with HTTP ${response.status}.`);
      }

      const translation = parseGoogleTranslation(await response.json());
      const detected = baseLanguage(translation.detectedLanguage);

      // Nothing was gained: the text already reads as the target language.
      if (detected && detected === baseLanguage(target)) return null;
      if (comparable(translation.text) === comparable(text)) return null;

      return translation;
    } finally {
      clearTimeout(timeout);
      controllers.delete(controller);
    }
  }

  return {
    translate(text: string, options: TranslateOptions = {}): Promise<Translation | null> {
      const input = text.trim();
      if (aborted || !input || !hasTranslatableText(input)) return Promise.resolve(null);

      const source = options.source?.trim().toLocaleLowerCase() || 'auto';
      const target = options.target?.trim().toLocaleLowerCase() || 'en';
      const key = `${source}>${target}:${normalized(input)}`;
      const cached = readCache(key);
      if (cached.hit) return Promise.resolve(cached.value);

      const pending = inFlight.get(key);
      if (pending) return pending;

      const promise = request(input, source, target)
        .then((result) => {
          writeCache(key, result);
          return result;
        })
        .finally(() => {
          inFlight.delete(key);
        });

      inFlight.set(key, promise);
      return promise;
    },

    abort(): void {
      aborted = true;
      for (const controller of controllers) controller.abort();
      controllers.clear();
      inFlight.clear();
    },
  };
}
