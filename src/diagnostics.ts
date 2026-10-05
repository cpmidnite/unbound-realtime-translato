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
  /** Every reference that was patched, as source/name.method. */
  patchSites: string[];
  /** Which site actually fired, if any. */
  firingSite: string | null;
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
  /** Row-rendering surfaces found on the device. */
  survey: Array<{ source: string; name: string; methods: string[] }>;
}

export interface PayloadShape {
  /** Types of each argument passed to the hook. */
  argTypes: string[];
  /** Whether argument 2 parsed as an array. */
  parsedArray: boolean;
  rowCount: number;
  /** `type` field of each row. */
  rowTypes: unknown[];
  /**
   * Keys of each object argument.
   *
   * The device reported `object, object` where a JSON string was assumed, and
   * nothing identified where the rows actually were. These keys name the shape.
   */
  argKeys: string[][];
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
  /** Records every reference that was successfully patched. */
  addPatchSite(where: string): void;
  /** Records which site actually fired. */
  setFiringSite(where: string): void;
  setRenderPatched(value: boolean): void;
  setSendPatched(value: boolean): void;
  countRenderCall(): void;
  countParsedPayload(): void;
  countDecorated(count: number): void;
  recordPayload(shape: PayloadShape): void;
  setStoredDecorations(count: number): void;
  recordError(error: unknown): void;
  /** Records the device survey of render surfaces. */
  setSurvey(entries: Array<{ source: string; name: string; methods: string[] }>): void;
  snapshot(): Diagnostics;
  /** Human-readable report for `!tr debug`. */
  report(): string;
}

export function describePayload(args: any[]): PayloadShape {
  const argTypes = args.map((arg) => {
    if (arg === null) return 'null';
    if (Array.isArray(arg)) return `array(${arg.length})`;
    return typeof arg;
  });

  const shape: PayloadShape = {
    argTypes,
    parsedArray: false,
    rowCount: 0,
    rowTypes: [],
    argKeys: [],
    firstMessage: null,
  };

  // Name the shape of every object argument. Without this, "object, object"
  // gave no clue where the rows were.
  for (const arg of args) {
    if (!arg || typeof arg !== 'object' || Array.isArray(arg)) {
      shape.argKeys.push([]);
      continue;
    }

    try {
      shape.argKeys.push(Object.keys(arg).slice(0, 14));
    } catch {
      shape.argKeys.push(['<unreadable>']);
    }
  }

  // Rows may arrive as a JSON string, a live array, or nested in an object, and
  // in any argument position. Find the first that looks like rows.
  const candidates: unknown[] = [];

  for (const arg of args) {
    if (typeof arg === 'string') {
      if (!arg.startsWith('[') && !arg.startsWith('{')) continue;

      try {
        candidates.push(JSON.parse(arg));
      } catch {
        // not JSON
      }

      continue;
    }

    if (Array.isArray(arg)) {
      candidates.push(arg);
      continue;
    }

    if (arg && typeof arg === 'object') {
      candidates.push(arg);

      for (const key of ['rows', 'data', 'items', 'messages', 'rowData']) {
        try {
          const nested = (arg as any)[key];
          if (nested) candidates.push(nested);
        } catch {
          // getter threw
        }
      }
    }
  }

  for (const candidate of candidates) {
    const rows = Array.isArray(candidate)
      ? candidate
      // A single row object passed on its own.
      : (candidate && typeof candidate === 'object' && (candidate as any).message
        ? [candidate]
        : null);

    if (!rows) continue;

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

      // A row with a message is the most informative; stop here.
      break;
    }
  }

  return shape;
}

export function createDiagnostics(): DiagnosticsRecorder {
  const state: Diagnostics = {
    chatModule: { resolved: false, name: null, methods: [] },
    renderPatched: false,
    patchSites: [],
    firingSite: null,
    sendPatched: false,
    renderCalls: 0,
    parsedPayloads: 0,
    decorated: 0,
    lastPayload: null,
    storedDecorations: 0,
    lastError: null,
    survey: [],
  };

  return {
    setChatModule(resolved, name, methods) {
      state.chatModule = { resolved, name, methods: methods.slice(0, 20) };
    },
    addPatchSite(where) {
      if (!state.patchSites.includes(where)) state.patchSites.push(where);
    },
    setFiringSite(where) {
      state.firingSite = where;
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
    setSurvey(entries) {
      // Strip the module reference: snapshot() serialises state, and a native
      // object is not safely serialisable.
      state.survey = entries.slice(0, 12).map((entry) => ({
        source: entry.source,
        name: entry.name,
        methods: entry.methods,
      }));
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

      if (state.patchSites.length) {
        lines.push(`> Patched ${state.patchSites.length} reference(s):`);
        for (const site of state.patchSites) lines.push(`> • \`${site}\``);
      }

      lines.push(`> Firing site: ${state.firingSite ? `\`${state.firingSite}\`` : '**none yet**'}`);
      lines.push(`> Send patch: ${state.sendPatched ? 'active' : '**not applied**'}`);
      lines.push(`> Render calls seen: ${state.renderCalls}`);
      lines.push(`> Payloads parsed: ${state.parsedPayloads}`);
      lines.push(`> Rows decorated: ${state.decorated}`);
      lines.push(`> Translations held: ${state.storedDecorations}`);

      const payload = state.lastPayload;
      if (payload) {
        lines.push('', '**Last payload**');
        lines.push(`> Args: \`${payload.argTypes.join(', ')}\``);

        payload.argKeys.forEach((keys, index) => {
          if (keys.length) lines.push(`> Arg ${index} keys: \`${keys.join(', ')}\``);
        });

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

      if (state.survey.length) {
        lines.push('', `**Render surfaces on this device (${state.survey.length})**`);
        for (const entry of state.survey) {
          lines.push(`> \`${entry.source}\` → \`${entry.name}\``);
          lines.push(`>   \`${entry.methods.join(', ')}\``);
        }
      } else {
        lines.push('', '**Render surfaces on this device:** none found.');
      }

      lines.push('', '_No message text is included in this report._');

      return lines.join('\n');
    },
  };
}
