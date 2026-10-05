import { metro, storage } from '@unbound-app/api';

import { createChatConfig, DEFAULT_OUTGOING_LANGUAGE, STORE_NAME } from './config';

/**
 * Settings panel scoped to the chat you currently have open.
 *
 * Unbound renders this from the plugin card, so the panel reads the selected
 * channel at render time: open a DM, open the plugin settings, and the toggles
 * apply to that conversation only.
 */
export function buildSettingsPanel(): unknown {
  const React = metro.common.React;
  const components = metro.components as any;
  const { TableRowGroup, TableSwitchRow, TableRow, Text } = components;

  return React.createElement(function TranslatorSettings() {
    const store = storage.useSettingsStore(STORE_NAME);
    const config = createChatConfig(store);
    const selectedChannelStore = metro.findStore('SelectedChannel');
    const channelStore = metro.findStore('Channel');

    const channelId = selectedChannelStore?.getChannelId?.();
    const channel = typeof channelId === 'string'
      ? channelStore?.getChannel?.(channelId)
      : null;

    if (typeof channelId !== 'string' || !channelId) {
      return React.createElement(
        TableRowGroup,
        { title: 'Realtime Translator' },
        React.createElement(TableRow, {
          label: 'No chat open',
          subLabel: 'Open a DM or group chat, then reopen this panel to configure it.',
        }),
      );
    }

    const label = channel?.name
      || channel?.rawRecipients?.map((user: any) => user.username).join(', ')
      || `Channel ${channelId}`;
    const current = config.for(channelId);

    return React.createElement(
      TableRowGroup,
      { title: `Translation — ${label}` },

      React.createElement(TableSwitchRow, {
        label: 'Translate messages I receive',
        subLabel: 'Shows an English line beneath incoming non-English messages.',
        value: current.incoming,
        onValueChange: (value: boolean) => config.setIncoming(channelId, value),
      }),

      React.createElement(TableSwitchRow, {
        label: 'Translate messages I send',
        subLabel: `Sends ${current.outgoingLanguage.toUpperCase()} to this chat `
          + 'instead of your English.',
        value: current.outgoing,
        onValueChange: (value: boolean) => config.setOutgoing(channelId, value),
      }),

      React.createElement(TableSwitchRow, {
        label: 'Show my English underneath',
        subLabel: 'Keeps your original English visible on your own messages.',
        value: current.showOwnEnglish,
        disabled: !current.outgoing,
        onValueChange: (value: boolean) => config.setShowOwnEnglish(channelId, value),
      }),

      React.createElement(TableRow, {
        label: 'Send language',
        subLabel: `Currently ${current.outgoingLanguage}. `
          + `Default ${DEFAULT_OUTGOING_LANGUAGE} (Spanish).`,
        trailing: React.createElement(Text, {
          variant: 'text-md/medium',
        }, current.outgoingLanguage.toUpperCase()),
        onPress: () => {
          // Cycles the common targets; edit settings.json for anything else.
          const cycle = ['es', 'en', 'pt', 'fr', 'de'];
          const next = cycle[(cycle.indexOf(current.outgoingLanguage) + 1) % cycle.length];
          config.setOutgoingLanguage(channelId, next!);
        },
      }),
    );
  });
}
