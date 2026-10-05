import { describe, expect, test } from 'bun:test';

import { createChatConfig, DISABLED } from '../src/config';

function memoryStore() {
  const data: Record<string, any> = {};

  function read(key: string): any {
    return key.split('.').reduce<any>(
      (node, part) => (node == null ? undefined : node[part]),
      data,
    );
  }

  return {
    data,
    get(key: string, def: any) {
      const value = read(key);
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

describe('per-chat configuration', () => {
  test('defaults every chat to fully disabled', () => {
    const config = createChatConfig(memoryStore());

    expect(config.for('c1')).toEqual(DISABLED);
    expect(config.for(undefined)).toEqual(DISABLED);
    expect(config.for('')).toEqual(DISABLED);
  });

  test('enabling one chat never affects another', () => {
    const config = createChatConfig(memoryStore());

    config.setOutgoing('c1', true);
    config.setIncoming('c1', true);

    expect(config.for('c1').outgoing).toBe(true);
    expect(config.for('c1').incoming).toBe(true);
    expect(config.for('c2').outgoing).toBe(false);
    expect(config.for('c2').incoming).toBe(false);
  });

  test('incoming and outgoing toggle independently', () => {
    const config = createChatConfig(memoryStore());

    config.setIncoming('c1', true);
    expect(config.for('c1')).toMatchObject({ incoming: true, outgoing: false });

    config.setOutgoing('c1', true);
    config.setIncoming('c1', false);
    expect(config.for('c1')).toMatchObject({ incoming: false, outgoing: true });
  });

  test('defaults the send language to Spanish and rejects junk', () => {
    const config = createChatConfig(memoryStore());

    expect(config.for('c1').outgoingLanguage).toBe('es');

    config.setOutgoingLanguage('c1', 'PT-br');
    expect(config.for('c1').outgoingLanguage).toBe('pt-br');

    config.setOutgoingLanguage('c1', 'not a language');
    expect(config.for('c1').outgoingLanguage).toBe('es');
  });

  test('lists only chats with translation switched on', () => {
    const config = createChatConfig(memoryStore());

    config.setIncoming('c1', true);
    config.setOutgoing('c2', true);
    config.setShowOwnEnglish('c3', true);

    expect(config.enabledChannels().sort()).toEqual(['c1', 'c2']);
  });

  test('reset clears both directions for one chat', () => {
    const config = createChatConfig(memoryStore());

    config.setIncoming('c1', true);
    config.setOutgoing('c1', true);
    config.reset('c1');

    expect(config.for('c1')).toMatchObject({ incoming: false, outgoing: false });
  });
});
