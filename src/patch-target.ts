/**
 * Unbound exposes Discord modules through `lazy()` proxies.
 *
 * That proxy forwards `get`/`set`/`has`/`ownKeys` to the real module but has no
 * `defineProperty` trap, so `Object.defineProperty` — which is how the patcher
 * installs a patch — lands on the proxy's empty backing object instead of the
 * module. The patch then silently does nothing: no error, no interception.
 *
 * Reading any property forces the proxy to resolve, so re-finding the module
 * through metro yields the real object, which can be patched.
 */

export interface UnwrapDependencies {
  /** metro.findByProps, used to re-resolve the module directly. */
  findByProps(...props: string[]): any;
}

/**
 * Resolves a patchable reference to a Discord module.
 *
 * @param candidate The possibly-proxied module (e.g. `metro.api.Messages`).
 * @param props Properties identifying the module, for re-resolution.
 * @returns A directly patchable object.
 * @throws When no object exposing every prop as a function can be found.
 */
export function resolvePatchTarget(
  candidate: any,
  props: string[],
  dependencies: UnwrapDependencies,
): any {
  // Touch a prop so a lazy proxy resolves and metro's cache is warm.
  const reachable = (value: any): boolean => {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) return false;
    return props.every((prop) => typeof value[prop] === 'function');
  };

  const viaCandidate = (() => {
    try {
      return reachable(candidate) ? candidate : null;
    } catch {
      return null;
    }
  })();

  // A direct metro lookup returns the module itself rather than a proxy.
  let direct: any = null;
  try {
    direct = dependencies.findByProps(...props);
  } catch {
    direct = null;
  }

  if (reachable(direct) && isPatchable(direct, props[0]!)) return direct;
  if (viaCandidate && isPatchable(viaCandidate, props[0]!)) return viaCandidate;
  if (reachable(direct)) return direct;
  if (viaCandidate) return viaCandidate;

  throw new Error(`Could not resolve a patchable module for: ${props.join(', ')}`);
}

/**
 * Checks that `Object.defineProperty` actually takes on this object.
 *
 * A lazy proxy accepts the call and discards it, so the only reliable test is
 * to write a sentinel and read it back.
 */
export function isPatchable(target: any, prop: string): boolean {
  const original = target?.[prop];
  if (typeof original !== 'function') return false;

  const sentinel = function sentinel() {};

  try {
    Object.defineProperty(target, prop, {
      value: sentinel,
      configurable: true,
      enumerable: true,
      writable: true,
    });

    const applied = target[prop] === sentinel;

    // Always restore, whether or not the write took.
    Object.defineProperty(target, prop, {
      value: original,
      configurable: true,
      enumerable: true,
      writable: true,
    });

    return applied;
  } catch {
    try {
      Object.defineProperty(target, prop, {
        value: original,
        configurable: true,
        enumerable: true,
        writable: true,
      });
    } catch {
      // Nothing further can be done; report unpatchable.
    }

    return false;
  }
}
