/**
 * Reports what row-rendering surfaces actually exist on this device.
 *
 * Three releases guessed at the seam and each produced an installed patch that
 * was never invoked. Guessing from here is unjustified: the next step needs a
 * list of what the running client really exposes.
 *
 * This only reads names and shapes — never message content — so the output is
 * safe to share.
 */

export interface SurveyEntry {
  /** Where it was found. */
  source: string;
  /** Module or component name. */
  name: string;
  /** Function-valued keys, truncated. */
  methods: string[];
  /** The object itself, so a discovered surface can also be patched. */
  module?: any;
}

export interface SurveyDependencies {
  nativeModuleProxy?: Record<string, any>;
  nativeModules?: Record<string, any>;
  /** metro.findByProps, for locating JS-side row builders. */
  findByProps?(...props: string[]): any;
  /** metro.findByName, for named classes such as RowManager. */
  findByName?(name: string, defaultExport?: boolean): any;
}

/** Keys that indicate a module deals in chat rows. */
const INTERESTING_METHODS = [
  'updateRows',
  'updateRowsSync',
  'setRows',
  'insertRows',
  'generate',
  'generateRow',
];

function functionKeys(value: any): string[] {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return [];

  const keys = new Set<string>();

  try {
    for (const key of Object.keys(value)) {
      try {
        if (typeof value[key] === 'function') keys.add(key);
      } catch { /* getter threw */ }
    }
  } catch { /* enumeration refused */ }

  // Own non-enumerable properties: class methods live here, so Object.keys
  // alone would miss a prototype's own methods entirely.
  try {
    for (const key of Object.getOwnPropertyNames(value)) {
      if (key === 'constructor' || key === 'prototype' || key === 'caller' || key === 'arguments') {
        continue;
      }

      try {
        if (typeof value[key] === 'function') keys.add(key);
      } catch { /* getter threw */ }
    }
  } catch { /* refused */ }

  // Inherited methods, for instances.
  try {
    const proto = Object.getPrototypeOf(value);
    if (proto && proto !== Object.prototype && proto !== Function.prototype) {
      for (const key of Object.getOwnPropertyNames(proto)) {
        if (key === 'constructor') continue;
        try {
          if (typeof proto[key] === 'function') keys.add(key);
        } catch { /* getter threw */ }
      }
    }
  } catch { /* no prototype */ }

  return [...keys].slice(0, 24);
}

/**
 * Lists every plausible row-rendering surface.
 *
 * @returns Entries describing what exists, for the diagnostics report.
 */
export function surveyRenderSurfaces(
  dependencies: SurveyDependencies,
): SurveyEntry[] {
  const entries: SurveyEntry[] = [];
  const seen = new Set<any>();

  const consider = (source: string, name: string, value: any): void => {
    if (!value || seen.has(value)) return;

    const methods = functionKeys(value);
    if (!methods.some((method) => INTERESTING_METHODS.includes(method))) return;

    seen.add(value);
    entries.push({ source, name, methods, module: value });
  };

  // Every native module whose name OR shape suggests chat rows. Unlike the
  // patching path, this does not filter by name, so a differently-named module
  // still shows up.
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

    for (const key of keys.slice(0, 400)) {
      try {
        consider(source, key, (map as any)[key]);
      } catch { /* getter threw */ }
    }
  }

  // JS-side row builders, which is how desktop BetterDiscord hooks rendering.
  for (const props of [
    ['updateRows'],
    ['generate', 'rowData'],
    ['generate'],
  ]) {
    try {
      const found = dependencies.findByProps?.(...props);
      if (found) consider(`findByProps(${props.join(',')})`, props.join('+'), found);
    } catch { /* lookup threw */ }
  }

  for (const name of ['RowManager', 'ChatManager', 'MessageRow']) {
    try {
      const found = dependencies.findByName?.(name, false);
      const target = found?.default ?? found;
      if (target) {
        consider(`findByName(${name})`, name, target);
        if (typeof target === 'function' && target.prototype) {
          consider(`findByName(${name}).prototype`, name, target.prototype);
        }
      }
    } catch { /* lookup threw */ }
  }

  return entries;
}
