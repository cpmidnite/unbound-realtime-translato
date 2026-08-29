interface SelectedChannelStore {
  getChannelId?(): unknown;
}

interface MessageStore {
  getMessages?(channelId: string): unknown;
}

function toMessageArray(messages: unknown): any[] {
  if (Array.isArray(messages)) return messages;
  if (Array.isArray((messages as any)?._array)) return (messages as any)._array;

  const converted = typeof (messages as any)?.toArray === 'function'
    ? (messages as any).toArray()
    : undefined;
  if (Array.isArray(converted)) return converted;
  if (Array.isArray((messages as any)?.array)) return (messages as any).array;
  if (messages && typeof (messages as any)[Symbol.iterator] === 'function') {
    return Array.from(messages as Iterable<any>);
  }

  return [];
}

export function getSelectedChannelMessages(
  selectedChannelStore: SelectedChannelStore | null | undefined,
  messageStore: MessageStore | null | undefined,
): any[] {
  const selectedChannelId = selectedChannelStore?.getChannelId?.();
  if (typeof selectedChannelId !== 'string') return [];

  return toMessageArray(messageStore?.getMessages?.(selectedChannelId));
}
