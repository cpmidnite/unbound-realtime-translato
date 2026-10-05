import { metro, patcher, storage, toasts } from '@unbound-app/api';

import { createChatConfig, STORE_NAME } from './config';
import { createRealtimeController, type RealtimeController } from './controller';
import { createOutgoingController, type OutgoingController } from './outgoing';
import { createCommandController, type CommandController } from './commands';
import { resolvePatchTarget } from './patch-target';
import { getSelectedChannelMessages } from './messages';
import { createTranslationClient } from './translation';
import { buildSettingsPanel } from './settings-panel';

let controller: RealtimeController | undefined;
let outgoing: OutgoingController | undefined;
let commands: CommandController | undefined;

function warn(message: string): void {
  try {
    toasts.showToast({ content: message });
  } catch {
    // Toasts are cosmetic; never let one break a send.
  }
}

/**
 * Posts a local-only reply in the channel.
 *
 * Clyde messages are never sent to Discord, so command feedback stays private
 * to this device.
 */
function reply(channelId: string, content: string): void {
  try {
    const message = metro.common.Clyde.createBotMessage({ channelId, content });
    metro.common.Dispatcher.dispatch({ type: 'MESSAGE_CREATE', message });
  } catch (error) {
    console.warn('[Realtime Translator] Could not post command reply:', error);
    warn('Translation settings updated.');
  }
}

export default {
  start(): void {
    if (controller) return;

    const translator = createTranslationClient();
    const config = createChatConfig(storage.getStore(STORE_NAME));
    const messageStore = metro.findStore('Message');
    const selectedChannelStore = metro.findStore('SelectedChannel');

    outgoing = createOutgoingController({
      messages: resolvePatchTarget(
        metro.api.Messages,
        ['sendMessage', 'receiveMessage'],
        { findByProps: (...props: string[]) => metro.findByProps(...props) },
      ),
      config,
      translate: (text, options) => translator.translate(text, options),
      patchInstead: (parent, method, callback) => patcher.instead(
        parent,
        method as never,
        callback as never,
        { caller: STORE_NAME },
      ),
      onError: (error) => console.warn('[Realtime Translator] Outgoing failed:', error),
      onFallback: warn,
      onReply: reply,
    });

    controller = createRealtimeController({
      dispatcher: metro.common.Dispatcher,
      users: metro.stores.Users,
      config,
      outgoing,
      getMessage: (channelId, messageId) => messageStore?.getMessage?.(channelId, messageId),
      getLoadedMessages: () => getSelectedChannelMessages(
        selectedChannelStore,
        messageStore,
      ),
      translate: (text) => translator.translate(text, { source: 'auto', target: 'en' }),
      abortTranslations: translator.abort,
      onError: (error) => console.warn('[Realtime Translator] Translation failed:', error),
    });

    commands = createCommandController({
      commands: resolvePatchTarget(
        metro.common.Commands,
        ['getBuiltInCommands'],
        { findByProps: (...props: string[]) => metro.findByProps(...props) },
      ),
      config,
      patchAfter: (parent, method, callback) => patcher.after(
        parent,
        method as never,
        ((ctx: any) => callback(ctx.args, ctx.result)) as never,
        { caller: STORE_NAME },
      ),
      reply,
    });

    outgoing.start();
    controller.start();

    // Prove the send patch actually took. A lazy proxy silently swallows
    // Object.defineProperty, so "no error" is not evidence of success.
    if (!outgoing.isActive()) {
      warn('Translator: could not hook sending. Nothing will translate.');
      console.warn(
        '[Realtime Translator] sendMessage patch did not apply.'
        + ' Outgoing translation and !tr are both inactive.',
      );
    }

    // Slash commands are a convenience: Discord's command registry does not
    // resolve on every build, and the patcher throws when the target is not a
    // function. Never let that take translation down with it.
    try {
      commands.start();
    } catch (error) {
      commands = undefined;
      console.warn(
        '[Realtime Translator] Slash commands unavailable; use !tr instead.',
        error,
      );
    }
  },

  stop(): void {
    controller?.stop();
    outgoing?.stop();
    commands?.stop();
    controller = undefined;
    outgoing = undefined;
    commands = undefined;
  },

  getSettingsPanel(): unknown {
    return buildSettingsPanel();
  },
};
