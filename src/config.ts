export const STORE_NAME = 'realtime-translator-en';

export const DEFAULT_OUTGOING_LANGUAGE = 'es';

export interface ChatConfig {
  /** Translate messages received from other people into English. */
  incoming: boolean;
  /** Translate messages you send out of English into `outgoingLanguage`. */
  outgoing: boolean;
  /** Target language sent on the wire when `outgoing` is enabled. */
  outgoingLanguage: string;
  /** Show the English original beneath your own translated messages. */
  showOwnEnglish: boolean;
}

export interface ConfigStore {
  get(key: string, def: any): any;
  set(key: string, value: any): void;
}

export interface ChatConfigController {
  for(channelId: string | null | undefined): ChatConfig;
  setIncoming(channelId: string, value: boolean): void;
  setOutgoing(channelId: string, value: boolean): void;
  setOutgoingLanguage(channelId: string, value: string): void;
  setShowOwnEnglish(channelId: string, value: boolean): void;
  enabledChannels(): string[];
  reset(channelId: string): void;
}

export const DISABLED: ChatConfig = Object.freeze({
  incoming: false,
  outgoing: false,
  outgoingLanguage: DEFAULT_OUTGOING_LANGUAGE,
  showOwnEnglish: true,
});

function normalizeLanguage(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_OUTGOING_LANGUAGE;

  const trimmed = value.trim().toLocaleLowerCase();
  if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(trimmed)) return DEFAULT_OUTGOING_LANGUAGE;

  return trimmed;
}

/**
 * Per-channel configuration persisted through Unbound's settings store.
 *
 * Every chat is independent and defaults to fully disabled, so enabling
 * translation in one DM never affects another conversation.
 */
export function createChatConfig(store: ConfigStore): ChatConfigController {
  function readChats(): Record<string, Partial<ChatConfig>> {
    const chats = store.get('chats', {});
    return chats && typeof chats === 'object' ? chats as Record<string, Partial<ChatConfig>> : {};
  }

  function patch(channelId: string, changes: Partial<ChatConfig>): void {
    if (!channelId) return;

    const chats = readChats();
    const existing = chats[channelId] ?? {};
    store.set(`chats.${channelId}`, { ...existing, ...changes });
  }

  return {
    for(channelId: string | null | undefined): ChatConfig {
      if (typeof channelId !== 'string' || !channelId) return DISABLED;

      const entry = readChats()[channelId];
      if (!entry || typeof entry !== 'object') return DISABLED;

      return {
        incoming: entry.incoming === true,
        outgoing: entry.outgoing === true,
        outgoingLanguage: normalizeLanguage(entry.outgoingLanguage),
        showOwnEnglish: entry.showOwnEnglish !== false,
      };
    },

    setIncoming(channelId: string, value: boolean): void {
      patch(channelId, { incoming: value === true });
    },

    setOutgoing(channelId: string, value: boolean): void {
      patch(channelId, { outgoing: value === true });
    },

    setOutgoingLanguage(channelId: string, value: string): void {
      patch(channelId, { outgoingLanguage: normalizeLanguage(value) });
    },

    setShowOwnEnglish(channelId: string, value: boolean): void {
      patch(channelId, { showOwnEnglish: value === true });
    },

    enabledChannels(): string[] {
      const chats = readChats();

      return Object.keys(chats).filter((channelId) => {
        const entry = chats[channelId];
        return entry?.incoming === true || entry?.outgoing === true;
      });
    },

    reset(channelId: string): void {
      if (!channelId) return;
      store.set(`chats.${channelId}`, {
        incoming: false,
        outgoing: false,
        outgoingLanguage: DEFAULT_OUTGOING_LANGUAGE,
        showOwnEnglish: true,
      });
    },
  };
}
