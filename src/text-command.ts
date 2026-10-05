import type { ChatConfigController } from './config';

/**
 * Text-triggered configuration, handled inside the send patch.
 *
 * Slash commands depend on Discord's command registry resolving, which is not
 * guaranteed across builds. This path only depends on the send interception
 * that outgoing translation already relies on, so if translation works at all,
 * these triggers work too.
 */

export const TRIGGER_PREFIX = '!tr';

export interface TriggerOutcome {
  /** True when the message was a trigger and must not be sent. */
  handled: boolean;
  /** Feedback to show locally, if any. */
  reply?: string;
}

const SUPPORTED_LANGUAGES = [
  'es', 'en', 'pt', 'fr', 'de', 'it', 'nl', 'ru', 'ja', 'ko',
  'zh', 'hi', 'ar', 'tr', 'pl', 'id', 'vi', 'th',
];

const ON_WORDS = ['on', 'yes', 'true', '1', 'enable', 'enabled'];
const OFF_WORDS = ['off', 'no', 'false', '0', 'disable', 'disabled'];

function parseFlag(word: string | undefined): boolean | undefined {
  if (!word) return undefined;
  const value = word.toLocaleLowerCase();
  if (ON_WORDS.includes(value)) return true;
  if (OFF_WORDS.includes(value)) return false;
  return undefined;
}

export function describe(config: ChatConfigController, channelId: string): string {
  const current = config.for(channelId);

  return [
    '**Translation — this chat**',
    `> Receive: ${current.incoming ? 'on (→ English)' : 'off'}`,
    `> Send: ${current.outgoing ? `on (→ ${current.outgoingLanguage.toUpperCase()})` : 'off'}`,
    `> Show my English: ${current.showOwnEnglish ? 'on' : 'off'}`,
  ].join('\n');
}

function help(): string {
  return [
    '**Translation controls** (type in any chat)',
    '`!tr` — show settings for this chat',
    '`!tr on` — translate both directions here',
    '`!tr off` — turn everything off here',
    '`!tr recv on` / `!tr recv off` — messages you receive',
    '`!tr send on` / `!tr send off` — messages you send',
    '`!tr lang es` — language to send in',
    '`!tr eng off` — hide your English under your own messages',
    '`!tr debug` — report what the plugin can and cannot hook',
    '',
    'These commands are never sent to the chat.',
  ].join('\n');
}

/**
 * Interprets a trigger message.
 *
 * @returns `handled: false` for anything that is not a trigger, in which case
 * the message must be sent normally.
 */
export function handleTrigger(
  config: ChatConfigController,
  channelId: string,
  content: string,
  getDiagnostics?: () => string,
): TriggerOutcome {
  const trimmed = content.trim();
  const lower = trimmed.toLocaleLowerCase();

  if (lower !== TRIGGER_PREFIX && !lower.startsWith(`${TRIGGER_PREFIX} `)) {
    return { handled: false };
  }

  const parts = trimmed.slice(TRIGGER_PREFIX.length).trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { handled: true, reply: `${describe(config, channelId)}\n\n\`!tr help\` for options.` };
  }

  const [rawCommand, rawValue] = parts;
  const command = rawCommand!.toLocaleLowerCase();

  if (command === 'debug' || command === 'diag') {
    return {
      handled: true,
      reply: getDiagnostics?.() ?? 'Diagnostics are unavailable.',
    };
  }

  if (command === 'help' || command === '?') {
    return { handled: true, reply: help() };
  }

  if (command === 'status') {
    return { handled: true, reply: describe(config, channelId) };
  }

  // `!tr on` / `!tr off` set both directions at once.
  const bothFlag = parseFlag(command);
  if (bothFlag !== undefined) {
    config.setIncoming(channelId, bothFlag);
    config.setOutgoing(channelId, bothFlag);
    return {
      handled: true,
      reply: `Translation **${bothFlag ? 'on' : 'off'}** for this chat.\n\n`
        + describe(config, channelId),
    };
  }

  if (command === 'recv' || command === 'receive' || command === 'in') {
    const flag = parseFlag(rawValue) ?? !config.for(channelId).incoming;
    config.setIncoming(channelId, flag);
    return {
      handled: true,
      reply: `Receive → **${flag ? 'on' : 'off'}**.\n\n${describe(config, channelId)}`,
    };
  }

  if (command === 'send' || command === 'out') {
    const flag = parseFlag(rawValue) ?? !config.for(channelId).outgoing;
    config.setOutgoing(channelId, flag);
    return {
      handled: true,
      reply: `Send → **${flag ? 'on' : 'off'}**.\n\n${describe(config, channelId)}`,
    };
  }

  if (command === 'eng' || command === 'english') {
    const flag = parseFlag(rawValue) ?? !config.for(channelId).showOwnEnglish;
    config.setShowOwnEnglish(channelId, flag);
    return {
      handled: true,
      reply: `Show my English → **${flag ? 'on' : 'off'}**.\n\n${describe(config, channelId)}`,
    };
  }

  if (command === 'lang' || command === 'language') {
    if (!rawValue) {
      return {
        handled: true,
        reply: `Current send language: **${config.for(channelId).outgoingLanguage.toUpperCase()}**`
          + `\n> Set one with \`!tr lang es\`.`,
      };
    }

    const language = rawValue.toLocaleLowerCase();
    if (!SUPPORTED_LANGUAGES.includes(language.split('-')[0]!)) {
      return {
        handled: true,
        reply: `**${rawValue}** is not a recognised language code.\n`
          + `> Try: ${SUPPORTED_LANGUAGES.slice(0, 8).join(', ')}`,
      };
    }

    config.setOutgoingLanguage(channelId, language);
    return {
      handled: true,
      reply: `Send language → **${language.toUpperCase()}**.\n\n${describe(config, channelId)}`,
    };
  }

  return {
    handled: true,
    reply: `Unknown option \`${rawCommand}\`.\n\n${help()}`,
  };
}
