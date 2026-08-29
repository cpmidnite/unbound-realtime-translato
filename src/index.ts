import { metro } from '@unbound-app/api';

import { createRealtimeController, type RealtimeController } from './controller';
import { createTranslationClient } from './translation';

let controller: RealtimeController | undefined;

export default {
  start(): void {
    if (controller) return;

    const translator = createTranslationClient();
    const messageStore = metro.findStore('Message');

    controller = createRealtimeController({
      dispatcher: metro.common.Dispatcher,
      users: metro.stores.Users,
      getMessage: (channelId, messageId) => messageStore?.getMessage?.(channelId, messageId),
      translate: translator.translate,
      abortTranslations: translator.abort,
      onError: (error) => console.warn('[Realtime Translator] Translation failed:', error),
    });

    controller.start();
  },

  stop(): void {
    controller?.stop();
    controller = undefined;
  },
};
