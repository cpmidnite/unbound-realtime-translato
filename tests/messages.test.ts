import { describe, expect, test } from 'bun:test';

import { getSelectedChannelMessages } from '../src/messages';

function readMessages(
  messages: unknown,
  selectedChannelId: unknown = 'selected-channel',
): { result: any[]; requestedChannelIds: string[] } {
  const requestedChannelIds: string[] = [];
  const result = getSelectedChannelMessages(
    { getChannelId: () => selectedChannelId },
    {
      getMessages(channelId: string) {
        requestedChannelIds.push(channelId);
        return messages;
      },
    },
  );

  return { result, requestedChannelIds };
}

describe('selected-channel messages adapter', () => {
  test('converts Discord collections backed by _array', () => {
    const messages = [{ id: 'm1' }];

    expect(readMessages({ _array: messages }).result).toEqual(messages);
  });

  test('converts collections exposing toArray()', () => {
    const messages = [{ id: 'm1' }];

    expect(readMessages({ toArray: () => messages }).result).toEqual(messages);
  });

  test('accepts plain arrays', () => {
    const messages = [{ id: 'm1' }];

    expect(readMessages(messages).result).toEqual(messages);
  });

  test('converts collections backed by an array property', () => {
    const messages = [{ id: 'm1' }];

    expect(readMessages({ array: messages }).result).toEqual(messages);
  });

  test('converts iterable collections', () => {
    const messages = [{ id: 'm1' }, { id: 'm2' }];

    expect(readMessages(new Set(messages)).result).toEqual(messages);
  });

  test('returns an empty list for unsupported collection shapes', () => {
    expect(readMessages({ messages: [{ id: 'm1' }] }).result).toEqual([]);
  });

  test('does not read messages when the selected channel is missing', () => {
    let getMessagesCalls = 0;

    const result = getSelectedChannelMessages(
      { getChannelId: () => undefined },
      {
        getMessages() {
          getMessagesCalls += 1;
          return [{ id: 'm1' }];
        },
      },
    );

    expect(result).toEqual([]);
    expect(getMessagesCalls).toBe(0);
  });

  test('passes the selected channel id to MessageStore.getMessages', () => {
    const { requestedChannelIds } = readMessages([]);

    expect(requestedChannelIds).toEqual(['selected-channel']);
  });
});
