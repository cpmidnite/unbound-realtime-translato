import { describe, expect, test } from 'bun:test';

import { createChatConfig } from '../src/config';
import { createCommandController, type CommandDefinition } from '../src/commands';

function memoryStore() {
  const data: Record<string, any> = {};

  return {
    get(key: string, def: any) {
      const value = key.split('.').reduce<any>(
        (node, part) => (node == null ? undefined : node[part]),
        data,
      );
      return value === undefined ? def : value;
    },
    set(key: string, value: any) {
      const parts = key.split('.');
      const last = parts.pop()!;
      let node = data;
      for (const part of parts) {
        if (typeof node[part] !== 'object' || node[part] === null) node[part] = {};
        node = node[part];
      }
      node[last] = value;
    },
  };
}

function harness() {
  const replies: Array<{ channelId: string; content: string }> = [];
  const builtIn: CommandDefinition[] = [
    { id: '1', name: 'giphy', description: 'gif', type: 1, options: [], execute() {} },
    { id: '2', name: 'shrug', description: 'shrug', type: 1, options: [], execute() {} },
  ];

  const commandsModule = {
    getBuiltInCommands: (_type: unknown) => builtIn,
  };

  const config = createChatConfig(memoryStore());
  let patchedCallback: ((args: any[], result: any) => any) | undefined;
  let unpatched = false;

  const controller = createCommandController({
    commands: commandsModule,
    config,
    patchAfter: (parent, method, callback) => {
      expect(parent).toBe(commandsModule);
      expect(method).toBe('getBuiltInCommands');
      patchedCallback = callback;
      return () => { unpatched = true; };
    },
    reply: (channelId, content) => replies.push({ channelId, content }),
  });

  return {
    controller,
    config,
    replies,
    get unpatched() {
      return unpatched;
    },
    /** Simulates Discord asking for its command list. */
    listCommands(type: unknown = 1): CommandDefinition[] {
      return patchedCallback!([type], [...builtIn]);
    },
    run(name: string, args: Array<{ name: string; value: unknown }>, channelId = 'c1') {
      const command = controller.definitions().find((entry) => entry.name === name);
      if (!command) throw new Error(`command ${name} not registered`);
      command.execute(args, { channel: { id: channelId, name: 'friend' } });
    },
  };
}

describe('chat-input commands', () => {
  test('appends its commands to Discord\'s own list', () => {
    const h = harness();
    h.controller.start();

    const names = h.listCommands().map((command) => command.name);

    expect(names).toContain('giphy');
    expect(names).toContain('translate');
    expect(names).toContain('translate-off');
    expect(names).toContain('translate-status');
  });

  test('uses negative ids that cannot collide with Discord commands', () => {
    const h = harness();
    h.controller.start();

    for (const command of h.controller.definitions()) {
      expect(parseInt(command.id!, 10)).toBeLessThan(0);
      expect(command.inputType).toBe(0);
      expect(command.type).toBe(1);
    }
  });

  test('respects the requested command type, including array form', () => {
    const h = harness();
    h.controller.start();

    expect(h.listCommands(1).some((c) => c.name === 'translate')).toBe(true);
    expect(h.listCommands([1]).some((c) => c.name === 'translate')).toBe(true);
    expect(h.listCommands(2).some((c) => c.name === 'translate')).toBe(false);
  });

  test('enables both directions for the chat it was run in', () => {
    const h = harness();
    h.controller.start();

    h.run('translate', [
      { name: 'receive', value: true },
      { name: 'send', value: true },
    ], 'c1');

    expect(h.config.for('c1')).toMatchObject({ incoming: true, outgoing: true });
    expect(h.config.for('c2')).toMatchObject({ incoming: false, outgoing: false });
    expect(h.replies[0].channelId).toBe('c1');
    expect(h.replies[0].content).toContain('receive');
  });

  test('toggles one direction without disturbing the other', () => {
    const h = harness();
    h.controller.start();

    h.run('translate', [{ name: 'send', value: true }], 'c1');
    h.run('translate', [{ name: 'receive', value: true }], 'c1');
    h.run('translate', [{ name: 'send', value: false }], 'c1');

    expect(h.config.for('c1')).toMatchObject({ incoming: true, outgoing: false });
  });

  test('sets the send language and rejects nonsense', () => {
    const h = harness();
    h.controller.start();

    h.run('translate', [{ name: 'language', value: 'PT' }], 'c1');
    expect(h.config.for('c1').outgoingLanguage).toBe('pt');

    h.run('translate', [{ name: 'language', value: 'klingon' }], 'c1');
    expect(h.config.for('c1').outgoingLanguage).toBe('pt');
    expect(h.replies.at(-1)!.content).toContain('not a recognised language');
  });

  test('reports status when run with no arguments', () => {
    const h = harness();
    h.controller.start();
    h.config.setOutgoing('c1', true);

    h.run('translate', [], 'c1');

    expect(h.replies).toHaveLength(1);
    expect(h.replies[0].content).toContain('Send: on');
    expect(h.replies[0].content).toContain('Receive: off');
  });

  test('translate-status never changes settings', () => {
    const h = harness();
    h.controller.start();
    h.config.setIncoming('c1', true);

    h.run('translate-status', [], 'c1');

    expect(h.config.for('c1').incoming).toBe(true);
    expect(h.replies[0].content).toContain('Receive: on');
  });

  test('translate-off clears the chat', () => {
    const h = harness();
    h.controller.start();
    h.config.setIncoming('c1', true);
    h.config.setOutgoing('c1', true);

    h.run('translate-off', [], 'c1');

    expect(h.config.for('c1')).toMatchObject({ incoming: false, outgoing: false });
    expect(h.replies[0].content).toContain('off');
  });

  test('ignores a command invoked without a channel', () => {
    const h = harness();
    h.controller.start();

    const command = h.controller.definitions().find((c) => c.name === 'translate')!;
    command.execute([{ name: 'send', value: true }], {});

    expect(h.replies).toHaveLength(0);
  });

  test('accepts string booleans from the command parser', () => {
    const h = harness();
    h.controller.start();

    h.run('translate', [{ name: 'send', value: 'true' }], 'c1');
    expect(h.config.for('c1').outgoing).toBe(true);

    h.run('translate', [{ name: 'send', value: 'false' }], 'c1');
    expect(h.config.for('c1').outgoing).toBe(false);
  });

  test('unregisters cleanly on stop', () => {
    const h = harness();
    h.controller.start();
    h.controller.stop();

    expect(h.unpatched).toBe(true);
    expect(h.controller.definitions()).toHaveLength(0);
  });

  test('survives a failure to read Discord\'s built-in commands', () => {
    const replies: any[] = [];
    const config = createChatConfig(memoryStore());
    const controller = createCommandController({
      commands: {
        getBuiltInCommands: () => {
          throw new Error('not ready');
        },
      },
      config,
      patchAfter: () => () => {},
      reply: (channelId, content) => replies.push({ channelId, content }),
    });

    expect(() => controller.start()).not.toThrow();
    expect(controller.definitions().length).toBeGreaterThan(0);
    expect(parseInt(controller.definitions()[0]!.id!, 10)).toBeLessThan(0);
  });
});
