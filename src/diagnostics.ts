/**
 * Runtime diagnostics.
 *
 * Five fixes in a row were shipped on inference and none of them worked, so the
 * plugin now reports what it actually observes on the device instead. This
 * records only structural facts — module names, patch state, call counts, node
 * types — and never message text, so a report can be shared safely.
 */

export interface Diagnostics {
  /** Native chat module lookup: which name resolved, and what it exposes. */
  chatModule: {
    resolved: boolean;
    name: string | null;
    methods: string[];
  };
  /** Whether the render patch verifiably replaced the method. */
  renderPatched: boolean;
  /** Whether the send patch verifiably replaced sendMessage. */
  sendPatched: boolean;
  /** How many times the render hook has been entered. */
  renderCalls: number;
  /** How many payloads parsed as JSON rows. */
  parsedPayloads: number;
  /** How many rows were decorated. */
  decorated: number;
  /** Shape of the most recent payload, with no message text. */
  lastPayload: PayloadShape | null;
  /** Translations currently held. */
  storedDecorations: number;
  /** Most recent error, if any. */
  lastError: string | null;
}

export interface PayloadShape {
  /** Types of each argument passed to the hook. */
  argTypes: string[];
  /** Whether argument 2 parsed as an array. */
  parsedArray: boolean;
  rowCount: number;
  /** `type` field of each row. */
  rowTypes: unknown[];
  /** For the first message row: whether content is an array, and node types. */
  firstMessage: {
    hasId: boolean;
    contentIsArray: boolean;
    contentType: string;
    nodeTypes: string[];
  } | null;
}

export interface DiagnosticsRecorder {
  setChatModule(resolved: boolean, name: string | null, methods: string[]): void;
  setRenderPatched(value: boolean): void;
  setSendPatched(value: boolean): void;
  countRenderCall(): void;
  countParsedPayload(): void;
  countDecorated(count: number): void;
  recordPayload(shape: PayloadShape): void;
  setStoredDecorations(count: number): void;
  recordError(error: unknown): void;
  snapshot(): Diagnostics;
  /** Human-readable report for `!tr debug`. */
  report(): string;
}

export function describePayload(args: any[]): PayloadShape {
  const argTypes = args.map((arg) => {
    if (arg === null) return 'null';
    if (Array.isArray(arg)) return 'array';
    return typeof arg;
  });

  const shape: PayloadShape = {
    argTypes,
    parsedArray: false,
    rowCount: 0,
    rowTypes: [],
    firstMessage: null,
  };

  const raw = args[1];
  if (typeof raw !== 'string') return shape;

  let rows: unknown;
  try {
    rows = JSON.parse(raw);
  } catch {
    return shape;
  }

  if (!Array.isArray(rows)) return shape;

  shape.parsedArray = true;
  shape.rowCount = rows.length;
  shape.rowTypes = rows.slice(0, 8).map((row: any) => row?.type);

  const messageRow = rows.find((row: any) => row?.message);
  if (messageRow) {
    const message = (messageRow as any).message;
    const content = message?.content;

    shape.firstMessage = {
      hasId: typeof message?.id === 'string',
      contentIsArray: Array.isArray(content),
      contentType: content === undefined
        ? 'undefined'
        : (Array.isArray(content) ? 'array' : typeof content),
      // Node TYPES only. Message text is never recorded.
      nodeTypes: Array.isArray(content)
        ? content.slice(0, 12).map((node: any) => (
          typeof node === 'string' ? 'string' : String(node?.type ?? '?')
        ))
        : [],
    };
  }

  return shape;
}

export function createDiagnostics(): DiagnosticsRecorder {
  const state: Diagnostics = {
    chatModule: { resolved: false, name: null, methods: [] },
    renderPatched: false,
    sendPatched: false,
    renderCalls: 0,
    parsedPayloads: 0,
    decorated: 0,
    lastPayload: null,
    storedDecorations: 0,
    lastError: null,
  };

  return {
    setChatModule(resolved, name, methods) {
      state.chatModule = { resolved, name, methods: methods.slice(0, 20) };
    },
    setRenderPatched(value) {
      state.renderPatched = value;
    },
    setSendPatched(value) {
      state.sendPatched = value;
    },
    countRenderCall() {
      state.renderCalls += 1;
    },
    countParsedPayload() {
      state.parsedPayloads += 1;
    },
    countDecorated(count) {
      state.decorated += count;
    },
    recordPayload(shape) {
      state.lastPayload = shape;
    },
    setStoredDecorations(count) {
      state.storedDecorations = count;
    },
    recordError(error) {
      state.lastError = error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
    },
    snapshot() {
      return JSON.parse(JSON.stringify(state));
    },

    report(): string {
      const lines: string[] = ['**Realtime Translator — diagnostics**'];

      lines.push(
        `> Chat module: ${state.chatModule.resolved
          ? `found as \`${state.chatModule.name}\``
          : '**NOT FOUND**'}`,
      );

      if (state.chatModule.resolved && state.chatModule.methods.length) {
        lines.push(`> Methods: \`${state.chatModule.methods.join(', ')}\``);
      }

      lines.push(`> Render patch: ${state.renderPatched ? 'active' : '**not applied**'}`);
      lines.push(`> Send patch: ${state.sendPatched ? 'active' : '**not applied**'}`);
      lines.push(`> Render calls seen: ${state.renderCalls}`);
      lines.push(`> Payloads parsed: ${state.parsedPayloads}`);
      lines.push(`> Rows decorated: ${state.decorated}`);
      lines.push(`> Translations held: ${state.storedDecorations}`);

      const payload = state.lastPayload;
      if (payload) {
        lines.push('', '**Last payload**');
        lines.push(`> Args: \`${payload.argTypes.join(', ')}\``);
        lines.push(`> Parsed as rows: ${payload.parsedArray} (${payload.rowCount} rows)`);
        lines.push(`> Row types: \`${JSON.stringify(payload.rowTypes)}\``);

        if (payload.firstMessage) {
          const m = payload.firstMessage;
          lines.push(`> Message row: id=${m.hasId}, content=\`${m.contentType}\``);
          lines.push(`> Node types: \`${JSON.stringify(m.nodeTypes)}\``);
        } else {
          lines.push('> No message row found in payload.');
        }
      } else {
        lines.push('', '> No payload observed yet. Scroll the chat and run this again.');
      }

      if (state.lastError) {
        lines.push('', `**Last error:** \`${state.lastError}\``);
      }

      lines.push('', '_No message text is included in this report._');

      return lines.join('\n');
    },
  };
}
