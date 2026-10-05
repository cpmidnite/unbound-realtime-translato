import type { ChatConfigController } from './config';

/** Discord's own enum values; BUILT_IN keeps the command client-side. */
export const APPLICATION_COMMAND_TYPE_CHAT = 1;
export const APPLICATION_COMMAND_INPUT_TYPE_BUILT_IN = 0;
export const OPTION_TYPE_BOOLEAN = 5;
export const OPTION_TYPE_STRING = 3;

export interface CommandArgument {
  name: string;
  value: unknown;
}

export interface CommandContext {
  channel?: { id?: string; name?: string };
}

export interface CommandDefinition {
  id?: string;
  name: string;
  description: string;
  displayName?: string;
  displayDescription?: string;
  untranslatedName?: string;
  untranslatedDescription?: string;
  applicationId?: string;
  type?: number;
  inputType?: number;
  options: Array<{
    name: string;
    description: string;
    type: number;
    displayName?: string;
    displayDescription?: string;
  }>;
  execute(args: CommandArgument[], ctx: CommandContext): void;
}

interface CommandsModule {
  getBuiltInCommands(type: unknown, ...rest: any[]): CommandDefinition[];
}

interface CommandDependencies {
  commands: CommandsModule;
  config: ChatConfigController;
  patchAfter(
    parent: any,
    method: string,
    callback: (args: any[], result: any) => any,
  ): () => void;
  /** Shows an ephemeral, local-only reply in the channel. */
  reply(channelId: string, content: string): void;
}

export interface CommandController {
  start(): void;
  stop(): void;
  /** Exposed for tests: the command objects injected into Discord's list. */
  definitions(): CommandDefinition[];
}

const SUPPORTED_LANGUAGES = [
  'es', 'en', 'pt', 'fr', 'de', 'it', 'nl', 'ru', 'ja', 'ko',
  'zh', 'hi', 'ar', 'tr', 'pl', 'id', 'vi', 'th',
];

function booleanArg(args: CommandArgument[], name: string): boolean | undefined {
  const arg = args.find((entry) => entry?.name === name);
  if (!arg) return undefined;
  if (typeof arg.value === 'boolean') return arg.value;
  if (arg.value === 'true') return true;
  if (arg.value === 'false') return false;
  return undefined;
}

function stringArg(args: CommandArgument[], name: string): string | undefined {
  const arg = args.find((entry) => entry?.name === name);
  if (!arg || typeof arg.value !== 'string') return undefined;
  const trimmed = arg.value.trim();
  return trimmed ? trimmed : undefined;
}

export function formatStatus(
  config: ChatConfigController,
  channelId: string,
): string {
  const current = config.for(channelId);
  const language = current.outgoingLanguage.toUpperCase();

  return [
    '**Translation — this chat**',
    `> Receive: ${current.incoming ? `on (→ English)` : 'off'}`,
    `> Send: ${current.outgoing ? `on (→ ${language})` : 'off'}`,
    `> Show my English: ${current.showOwnEnglish ? 'on' : 'off'}`,
    '',
    '`/translate receive:True send:True` to enable both here.',
  ].join('\n');
}

/**
 * Registers chat-input commands so a chat can be configured without leaving it.
 *
 * Discord builds its command list through `getBuiltInCommands`, so appending to
 * that result is the stable way to add one: no Discord component is patched and
 * nothing in the message list is touched.
 */
export function createCommandController(
  dependencies: CommandDependencies,
): CommandController {
  const { config } = dependencies;
  let unpatch: (() => void) | undefined;
  let registered: CommandDefinition[] = [];
  let idBase = '-1000';

  function channelIdFrom(ctx: CommandContext): string | null {
    const id = ctx?.channel?.id;
    return typeof id === 'string' && id ? id : null;
  }

  function nextCommandId(): string {
    try {
      const builtIn = dependencies.commands.getBuiltInCommands(
        APPLICATION_COMMAND_TYPE_CHAT,
        true,
        false,
      );
      const ids = builtIn
        .map((command) => parseInt(String(command?.id ?? '0'), 10))
        .filter((value) => Number.isFinite(value));
      const lowest = ids.length ? Math.min(...ids) : 0;

      // Stay strictly negative so we can never shadow a Discord command id.
      return String(Math.min(lowest, 0) - 1);
    } catch {
      return '-1000';
    }
  }

  function decorate(command: CommandDefinition, offset: number): CommandDefinition {
    // One base id per registration, then a unique negative id per command.
    command.id ??= String(parseInt(idBase, 10) - offset);
    command.applicationId ??= '-1';
    command.type ??= APPLICATION_COMMAND_TYPE_CHAT;
    command.inputType = APPLICATION_COMMAND_INPUT_TYPE_BUILT_IN;
    command.displayName ??= command.name;
    command.untranslatedName ??= command.name;
    command.displayDescription ??= command.description;
    command.untranslatedDescription ??= command.description;

    for (const option of command.options ?? []) {
      option.displayName ??= option.name;
      option.displayDescription ??= option.description;
    }

    return command;
  }

  function buildCommands(): CommandDefinition[] {
    const translate: CommandDefinition = {
      name: 'translate',
      description: 'Turn translation on or off for this chat.',
      options: [
        {
          name: 'receive',
          description: 'Show English beneath messages you receive here.',
          type: OPTION_TYPE_BOOLEAN,
        },
        {
          name: 'send',
          description: 'Send your messages in another language in this chat.',
          type: OPTION_TYPE_BOOLEAN,
        },
        {
          name: 'language',
          description: 'Language to send in, for example es. Default es.',
          type: OPTION_TYPE_STRING,
        },
        {
          name: 'show_english',
          description: 'Keep your English visible under your own messages.',
          type: OPTION_TYPE_BOOLEAN,
        },
      ],
      execute(args, ctx) {
        const channelId = channelIdFrom(ctx);
        if (!channelId) return;

        const receive = booleanArg(args, 'receive');
        const send = booleanArg(args, 'send');
        const showEnglish = booleanArg(args, 'show_english');
        const language = stringArg(args, 'language');

        // No arguments: report the current state instead of changing it.
        if (
          receive === undefined
          && send === undefined
          && showEnglish === undefined
          && language === undefined
        ) {
          dependencies.reply(channelId, formatStatus(config, channelId));
          return;
        }

        const changes: string[] = [];

        if (language !== undefined) {
          const normalized = language.toLocaleLowerCase();

          if (!SUPPORTED_LANGUAGES.includes(normalized.split('-')[0]!)) {
            dependencies.reply(
              channelId,
              `**${language}** is not a recognised language code.\n`
              + `> Try one of: ${SUPPORTED_LANGUAGES.slice(0, 8).join(', ')}`,
            );
            return;
          }

          config.setOutgoingLanguage(channelId, normalized);
          changes.push(`send language → **${normalized.toUpperCase()}**`);
        }

        if (receive !== undefined) {
          config.setIncoming(channelId, receive);
          changes.push(`receive → **${receive ? 'on' : 'off'}**`);
        }

        if (send !== undefined) {
          config.setOutgoing(channelId, send);
          changes.push(`send → **${send ? 'on' : 'off'}**`);
        }

        if (showEnglish !== undefined) {
          config.setShowOwnEnglish(channelId, showEnglish);
          changes.push(`show my English → **${showEnglish ? 'on' : 'off'}**`);
        }

        dependencies.reply(
          channelId,
          `Updated ${changes.join(', ')}.\n\n${formatStatus(config, channelId)}`,
        );
      },
    };

    const translateOff: CommandDefinition = {
      name: 'translate-off',
      description: 'Turn all translation off for this chat.',
      options: [],
      execute(_args, ctx) {
        const channelId = channelIdFrom(ctx);
        if (!channelId) return;

        config.reset(channelId);
        dependencies.reply(
          channelId,
          `Translation is now **off** in this chat, both directions.`,
        );
      },
    };

    const translateStatus: CommandDefinition = {
      name: 'translate-status',
      description: 'Show translation settings for this chat.',
      options: [],
      execute(_args, ctx) {
        const channelId = channelIdFrom(ctx);
        if (!channelId) return;
        dependencies.reply(channelId, formatStatus(config, channelId));
      },
    };

    return [translate, translateOff, translateStatus].map(decorate);
  }

  return {
    start(): void {
      if (unpatch) return;

      idBase = nextCommandId();
      registered = buildCommands();

      unpatch = dependencies.patchAfter(
        dependencies.commands,
        'getBuiltInCommands',
        (args, result) => {
          if (!Array.isArray(result)) return result;

          const requestedType = args[0];
          const matches = (command: CommandDefinition) => (
            Array.isArray(requestedType)
              ? requestedType.includes(command.type!)
              : requestedType === command.type
          );

          return [...result, ...registered.filter(matches)];
        },
      );
    },

    stop(): void {
      unpatch?.();
      unpatch = undefined;
      registered = [];
    },

    definitions(): CommandDefinition[] {
      return registered;
    },
  };
}
