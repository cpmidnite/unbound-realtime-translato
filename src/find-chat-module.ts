/**
 * Finds every reachable reference to the chat module.
 *
 * A patch can be verifiably installed and still never run, which is exactly
 * what the device reported: module found, patch active, zero calls. That means
 * Discord calls the method on a DIFFERENT object than the one we patched.
 *
 * React Native exposes native modules through several routes — the legacy
 * `NativeModules` map, the `nativeModuleProxy` global, and the TurboModule
 * registry — and they do not always hand back the same object. So rather than
 * pick one route and hope, this collects every distinct object that exposes a
 * row-update method and lets the caller patch all of them.
 */

export interface ChatModuleCandidate {
  /** Where this reference came from, for the diagnostics report. */
  source: string;
  name: string;
  module: any;
  method: string;
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

export function methodsOf(module: any): string[] {
  if (!module || (typeof module !== 'object' && typeof module !== 'function')) return [];

  const names = new Set<string>();

  try {
    for (const key of Object.keys(module)) {
      if (typeof module[key] === 'function') names.add(key);
    }
  } catch {
    // Some native modules throw on enumeration; fall through to probing.
  }

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
  getNativeModule?(...names: string[]): any;
  /** The `nativeModuleProxy` global. */
  nativeModuleProxy?: Record<string, any>;
  /** React Native's legacy NativeModules map. */
  nativeModules?: Record<string, any>;
  /** TurboModuleRegistry, whose `get` may return a separate instance. */
  turboModuleRegistry?: { get?(name: string): any; getEnforcing?(name: string): any };
}

function push(
  out: ChatModuleCandidate[],
  seen: Set<any>,
  source: string,
  name: string,
  module: any,
): void {
  if (!module || seen.has(module)) return;

  const method = firstMethod(module);

  if (method) {
    seen.add(module);
    out.push({ source, name, module, method });
  }

  // A class or constructor: the method lives on the prototype, and instances
  // call through it. Check it independently, since the constructor itself
  // usually exposes nothing.
  if (typeof module === 'function' && module.prototype) {
    push(out, seen, `${source}.prototype`, name, module.prototype);
  }
}

/**
 * Collects every distinct patchable reference.
 *
 * @returns Candidates in priority order; empty when nothing plausible exists.
 */
export function collectChatModules(
  dependencies: FindDependencies,
): ChatModuleCandidate[] {
  const found: ChatModuleCandidate[] = [];
  const seen = new Set<any>();

  for (const name of KNOWN_MODULE_NAMES) {
    // Each route is tried separately, because they can disagree about which
    // object is "the" module.
    try {
      push(found, seen, 'getNativeModule', name, dependencies.getNativeModule?.(name));
    } catch { /* ignore */ }

    try {
      push(found, seen, 'nativeModuleProxy', name, dependencies.nativeModuleProxy?.[name]);
    } catch { /* ignore */ }

    try {
      push(found, seen, 'NativeModules', name, dependencies.nativeModules?.[name]);
    } catch { /* ignore */ }

    try {
      push(found, seen, 'TurboModuleRegistry', name, dependencies.turboModuleRegistry?.get?.(name));
    } catch { /* ignore */ }
  }

  // Last resort: scan the maps for anything chat-like exposing a row updater.
  for (const [source, map] of [
    ['nativeModuleProxy', dependencies.nativeModuleProxy],
    ['NativeModules', dependencies.nativeModules],
  ] as const) {
    if (!map || typeof map !== 'object') continue;

    let keys: string[];
    try {
      keys = Object.keys(map);
    } catch {
      continue;
    }

    for (const key of keys) {
      // Only plausibly chat-related modules, to avoid touching unrelated ones.
      if (!/chat|message|row/i.test(key)) continue;

      try {
        push(found, seen, `${source}:scan`, key, (map as any)[key]);
      } catch { /* ignore */ }
    }
  }

  return found;
}
