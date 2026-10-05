import { describe, expect, test } from 'bun:test';

import { createChatConfig } from '../src/config';
import { handleTrigger } from '../src/text-command';

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

function fresh() {
  return createChatConfig(memoryStore());
}

describe('text triggers', () => {
  test('ignores ordinary messages', () => {
    const config = fresh();

    for (const content of [
      'hello there',
      'I will send it tomorrow',
      'what about !trousers',
      'translate this for me',
      '',
      'trick question',
    ]) {
      expect(handleTrigger(config, 'c1', content).handled).toBe(false);
    }
  });

  test('turns both directions on for the chat it was typed in', () => {
    const config = fresh();
    const result = handleTrigger(config, 'c1', '!tr on');

    expect(result.handled).toBe(true);
    expect(config.for('c1')).toMatchObject({ incoming: true, outgoing: true });
    expect(config.for('c2')).toMatchObject({ incoming: false, outgoing: false });
  });

  test('turns everything off', () => {
    const config = fresh();
    handleTrigger(config, 'c1', '!tr on');
    handleTrigger(config, 'c1', '!tr off');

    expect(config.for('c1')).toMatchObject({ incoming: false, outgoing: false });
  });

  test('sets each direction independently', () => {
    const config = fresh();

    handleTrigger(config, 'c1', '!tr send on');
    expect(config.for('c1')).toMatchObject({ incoming: false, outgoing: true });

    handleTrigger(config, 'c1', '!tr recv on');
    expect(config.for('c1')).toMatchObject({ incoming: true, outgoing: true });

    handleTrigger(config, 'c1', '!tr send off');
    expect(config.for('c1')).toMatchObject({ incoming: true, outgoing: false });
  });

  test('toggles when no value is given', () => {
    const config = fresh();

    handleTrigger(config, 'c1', '!tr send');
    expect(config.for('c1').outgoing).toBe(true);

    handleTrigger(config, 'c1', '!tr send');
    expect(config.for('c1').outgoing).toBe(false);
  });

  test('accepts aliases and mixed case', () => {
    const config = fresh();

    handleTrigger(config, 'c1', '!TR RECEIVE TRUE');
    expect(config.for('c1').incoming).toBe(true);

    handleTrigger(config, 'c1', '!tr out yes');
    expect(config.for('c1').outgoing).toBe(true);

    handleTrigger(config, 'c1', '!tr in no');
    expect(config.for('c1').incoming).toBe(false);
  });

  test('sets the send language and rejects junk', () => {
    const config = fresh();

    handleTrigger(config, 'c1', '!tr lang pt');
    expect(config.for('c1').outgoingLanguage).toBe('pt');

    const bad = handleTrigger(config, 'c1', '!tr lang klingon');
    expect(bad.handled).toBe(true);
    expect(config.for('c1').outgoingLanguage).toBe('pt');
    expect(bad.reply).toContain('not a recognised language');
  });

  test('reports the language when asked without a value', () => {
    const config = fresh();
    const result = handleTrigger(config, 'c1', '!tr lang');

    expect(result.reply).toContain('ES');
    expect(config.for('c1').outgoingLanguage).toBe('es');
  });

  test('bare trigger reports status without changing anything', () => {
    const config = fresh();
    config.setOutgoing('c1', true);

    const result = handleTrigger(config, 'c1', '!tr');

    expect(result.handled).toBe(true);
    expect(result.reply).toContain('Send: on');
    expect(config.for('c1')).toMatchObject({ incoming: false, outgoing: true });
  });

  test('help is handled and explains the options', () => {
    const config = fresh();
    const result = handleTrigger(config, 'c1', '!tr help');

    expect(result.handled).toBe(true);
    expect(result.reply).toContain('!tr send on');
    expect(result.reply).toContain('never sent');
  });

  test('an unknown option is still swallowed, never sent', () => {
    const config = fresh();
    const result = handleTrigger(config, 'c1', '!tr wibble');

    expect(result.handled).toBe(true);
    expect(result.reply).toContain('Unknown option');
  });

  test('controls the English line under your own messages', () => {
    const config = fresh();

    handleTrigger(config, 'c1', '!tr eng off');
    expect(config.for('c1').showOwnEnglish).toBe(false);

    handleTrigger(config, 'c1', '!tr english on');
    expect(config.for('c1').showOwnEnglish).toBe(true);
  });
});
