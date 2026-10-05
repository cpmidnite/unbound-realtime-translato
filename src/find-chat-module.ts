/**
 * Finds the native module that renders chat rows.
 *
 * The name differs across Discord builds and platforms, and a wrong guess is
 * indistinguishable from a broken patch. Rather than hardcode one name, this
 * tries the known ones and then searches for any module exposing a plausible
 * row-update method, reporting what it found.
 */

export interface ChatModuleCandidate {
  name: string;
  module: any;
  method: string;
  methods: string[];
}

/** Names used by working mobile client mods, in priority order. */
export const KNOWN_MODULE_NAMES = [
  'NativeChatModule',
  'DCDChatManager',
  'RTNChatModule',
  'ChatManager',
];

/** Method names that deliver rows to the native list. */
export const KNOWN_METHODS = ['updateRows', 'updateRowsSync', 'setRows', 'insertRows'];

function methodsOf(module: any): string[] {
  if (!module || typeof module !== 'object') return [];

  const names = new Set<string>();

  try {
    for (const key of Object.keys(module)) {
      if (typeof module[key] === 'function') names.add(key);
    }
  } catch {
    // Some native modules throw on enumeration; fall through.
  }

  // Probe the known names directly, since a proxy may not enumerate.
  for (const candidate of KNOWN_METHODS) {
    try {
      if (typeof module[candidate] === 'function') names.add(candidate);
    } catch {
      // ignore
    }
  }

  return [...names];
}

function firstMethod(module: any): string | null {
  for (const candidate of KNOWN_METHODS) {
    try {
      if (typeof module?.[candidate] === 'function') return candidate;
    } catch {
      // ignore
    }
  }

  return null;
}

export interface FindDependencies {
  /** native.getNativeModule, which takes candidate names. */
  getNativeModule(...names: string[]): any;
  /** Optional raw React Native module maps, searched as a last resort. */
  moduleMaps?: Array<Record<string, any> | undefined>;
}

/**
 * Resolves the chat module.
 *
 * @returns The candidate, or null when nothing plausible exists.
 */
export function findChatModule(
  dependencies: FindDependencies,
): ChatModuleCandidate | null {
  // Try each known name on its own, so we learn WHICH one matched.
  for (const name of KNOWN_MODULE_NAMES) {
    let module: any;
    try {
      module = dependencies.getNativeModule(name);
    } catch {
      continue;
    }

    const method = firstMethod(module);
    if (method) {
      return { name, module, method, methods: methodsOf(module) };
    }
  }

  // Last resort: scan the module maps for anything exposing a row updater.
  for (const map of dependencies.moduleMaps ?? []) {
    if (!map || typeof map !== 'object') continue;

    let keys: string[];
    try {
      keys = Object.keys(map);
    } catch {
      continue;
    }

    for (const key of keys) {
      // Only consider plausibly chat-related modules, to avoid touching
      // unrelated native modules while probing.
      if (!/chat|message|row/i.test(key)) continue;

      let module: any;
      try {
        module = map[key];
      } catch {
        continue;
      }

      const method = firstMethod(module);
      if (method) {
        return { name: key, module, method, methods: methodsOf(module) };
      }
    }
  }

  return null;
}
