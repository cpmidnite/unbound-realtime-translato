import { metro, native, patcher, storage, toasts } from '@unbound-app/api';

import { createChatConfig, STORE_NAME } from './config';
import { createRealtimeController, type RealtimeController } from './controller';
import { createOutgoingController, type OutgoingController } from './outgoing';
import { createCommandController, type CommandController } from './commands';
import { createRenderController, type RenderController } from './render-patch';
import { createDecorationStore } from './decorations';
import { resolvePatchTarget } from './patch-target';
import { getSelectedChannelMessages } from './messages';
import { createTranslationClient } from './translation';
import { buildSettingsPanel } from './settings-panel';

let controller: RealtimeController | undefined;
let outgoing: OutgoingController | undefined;
let commands: CommandController | undefined;
let render: RenderController | undefined;

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
 * Prefers Discord's own `sendBotMessage`, which builds and inserts the message
 * itself. Falls back to constructing a Clyde message, then to a toast. Nothing
 * here may throw: this runs inside the send patch, and an exception would take
 * Discord's send path down with it.
 */
function reply(channelId: string, content: string): void {
  try {
    const messageUtil = metro.findByProps('sendBotMessage');
    if (typeof messageUtil?.sendBotMessage === 'function') {
      messageUtil.sendBotMessage(channelId, content);
      return;
    }
  } catch (error) {
    console.warn('[Realtime Translator] sendBotMessage failed:', error);
  }

  try {
    const message = metro.common.Clyde.createBotMessage({ channelId, content });
    metro.common.Dispatcher.dispatch({ type: 'MESSAGE_CREATE', message });
    return;
  } catch (error) {
    console.warn('[Realtime Translator] Clyde reply failed:', error);
  }

  // Last resort: at least acknowledge that the setting changed.
  warn(content.replace(/[*>`]/g, '').split('\n').slice(0, 2).join(' — '));
}

export default {
  start(): void {
    if (controller) return;

    const translator = createTranslationClient();
    const config = createChatConfig(storage.getStore(STORE_NAME));
    const messageStore = metro.findStore('Message');
    const selectedChannelStore = metro.findStore('SelectedChannel');
    const decorations = createDecorationStore();

    // Patch the render path, as BetterDiscord's Translator does, so Discord's
    // message store is never modified and the server cannot erase the added
    // line. The mobile seam is the native chat module's updateRows, which
    // receives the rendered rows as a JSON string.
    const chatModule = native.getNativeModule('NativeChatModule', 'DCDChatManager');
    render = createRenderController({
      chatModule,
      patchBefore: (parent, method, callback) => patcher.before(
        parent,
        method as never,
        ((ctx: any) => { callback(ctx.args); }) as never,
        { caller: STORE_NAME },
      ),
      getDecoration: (messageId) => decorations.get(messageId),
      onError: (error) => console.warn('[Realtime Translator] Row render failed:', error),
    });

    const renderPatched = (() => {
      try {
        return render.start();
      } catch (error) {
        console.warn('[Realtime Translator] Could not patch the row renderer:', error);
        return false;
      }
    })();

    if (!renderPatched) {
      render = undefined;
      console.warn(
        '[Realtime Translator] Row renderer unavailable;'
        + ' falling back to local message updates, which Discord may overwrite.',
      );
    }

    /** Nudges the row for one message to re-render without editing the store. */
    const requestRerender = (channelId: string, messageId: string): void => {
      try {
        const message = messageStore?.getMessage?.(channelId, messageId);
        if (!message) return;

        metro.common.Dispatcher.dispatch({
          type: 'MESSAGE_UPDATE',
          message: typeof message.toJS === 'function' ? message.toJS() : { ...message },
          log_edit: false,
        });
      } catch (error) {
        console.warn('[Realtime Translator] Re-render request failed:', error);
      }
    };

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
      decorations: renderPatched ? decorations : undefined,
      requestRerender: renderPatched ? requestRerender : undefined,
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
    render?.stop();
    controller = undefined;
    outgoing = undefined;
    commands = undefined;
    render = undefined;
  },

  getSettingsPanel(): unknown {
    return buildSettingsPanel();
  },
};
