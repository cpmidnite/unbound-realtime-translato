import { describe, expect, test } from 'bun:test';

import { createDiagnostics, describePayload } from '../src/diagnostics';
import { collectChatModules } from '../src/find-chat-module';

describe('chat module discovery', () => {
  test('collects a module found by a known name', () => {
    const module = { updateRows: () => {}, other: () => {} };

    const found = collectChatModules({
      getNativeModule: (name: string) => (name === 'DCDChatManager' ? module : undefined),
    });

    expect(found).toHaveLength(1);
    expect(found[0]!.name).toBe('DCDChatManager');
    expect(found[0]!.method).toBe('updateRows');
    expect(found[0]!.module).toBe(module);
    expect(found[0]!.source).toBe('getNativeModule');
  });

  test('collects the SAME module once, from whichever route reaches it', () => {
    const shared = { updateRows: () => {} };

    const found = collectChatModules({
      getNativeModule: () => shared,
      nativeModuleProxy: { NativeChatModule: shared },
      nativeModules: { NativeChatModule: shared },
    });

    expect(found).toHaveLength(1);
  });

  test('collects DISTINCT objects from different routes', () => {
    // This is the case that mattered: a patch on one object never fires because
    // Discord calls a different one.
    const viaHelper = { updateRows: () => {} };
    const viaProxy = { updateRows: () => {} };
    const viaModules = { updateRows: () => {} };

    const found = collectChatModules({
      getNativeModule: () => viaHelper,
      nativeModuleProxy: { NativeChatModule: viaProxy },
      nativeModules: { NativeChatModule: viaModules },
    });

    expect(found).toHaveLength(3);
    expect(found.map((c) => c.source)).toEqual([
      'getNativeModule',
      'nativeModuleProxy',
      'NativeModules',
    ]);
  });

  test('includes the TurboModuleRegistry instance', () => {
    const turbo = { updateRows: () => {} };

    const found = collectChatModules({
      turboModuleRegistry: { get: () => turbo },
    });

    expect(found).toHaveLength(1);
    expect(found[0]!.source).toBe('TurboModuleRegistry');
  });

  test('also collects a constructor prototype', () => {
    class ChatManagerClass {
      updateRows() {}
    }

    const found = collectChatModules({
      getNativeModule: () => ChatManagerClass,
    });

    expect(found.map((c) => c.source)).toEqual([
      'getNativeModule.prototype',
    ]);
  });

  test('accepts an alternative row-update method name', () => {
    const found = collectChatModules({ getNativeModule: () => ({ setRows: () => {} }) });
    expect(found[0]!.method).toBe('setRows');
  });

  test('falls back to scanning module maps for a chat-like module', () => {
    const module = { updateRows: () => {} };

    const found = collectChatModules({
      nativeModuleProxy: {
        SomeUnrelatedModule: { doThing: () => {} },
        DCDChatManagerExperimental: module,
      },
    });

    expect(found[0]!.name).toBe('DCDChatManagerExperimental');
  });

  test('ignores unrelated modules while scanning', () => {
    expect(collectChatModules({
      nativeModuleProxy: { AudioManager: { updateRows: () => {} } },
    })).toHaveLength(0);
  });

  test('returns nothing when no candidate exists', () => {
    expect(collectChatModules({})).toHaveLength(0);
    expect(collectChatModules({
      getNativeModule: () => ({ unrelated: () => {} }),
    })).toHaveLength(0);
  });

  test('survives throwing lookups', () => {
    const found = collectChatModules({
      getNativeModule: () => { throw new Error('bridge not ready'); },
      turboModuleRegistry: { get: () => { throw new Error('nope'); } },
    });

    expect(found).toHaveLength(0);
  });
});

describe('payload description', () => {
  function row(id: string, content: any) {
    return { type: 1, message: { id, content } };
  }

  test('describes argument types and parsed row shape', () => {
    const payload = JSON.stringify([
      row('m1', [{ type: 'text', content: 'hola' }, { type: 'emoji', surrogate: '👋' }]),
    ]);

    const shape = describePayload(['chan', payload]);

    expect(shape.argTypes).toEqual(['string', 'string']);
    expect(shape.parsedArray).toBe(true);
    expect(shape.rowCount).toBe(1);
    expect(shape.rowTypes).toEqual([1]);
    expect(shape.firstMessage).toEqual({
      hasId: true,
      contentIsArray: true,
      contentType: 'array',
      nodeTypes: ['text', 'emoji'],
    });
  });

  test('records when content is a string rather than nodes', () => {
    const shape = describePayload(['chan', JSON.stringify([row('m1', 'plain string')])]);

    expect(shape.firstMessage?.contentIsArray).toBe(false);
    expect(shape.firstMessage?.contentType).toBe('string');
  });

  test('never includes message text', () => {
    const secret = 'this text must not appear anywhere';
    const payload = JSON.stringify([row('m1', [{ type: 'text', content: secret }])]);

    const serialised = JSON.stringify(describePayload(['chan', payload]));

    expect(serialised).not.toContain(secret);
  });

  test('handles a non-string second argument', () => {
    const shape = describePayload(['chan', { rows: [] }]);

    expect(shape.argTypes).toEqual(['string', 'object']);
    expect(shape.parsedArray).toBe(false);
  });

  test('handles unparseable JSON', () => {
    const shape = describePayload(['chan', 'not json at all']);

    expect(shape.parsedArray).toBe(false);
    expect(shape.rowCount).toBe(0);
  });
});

describe('diagnostics report', () => {
  test('reports a healthy state', () => {
    const d = createDiagnostics();
    d.setChatModule(true, 'DCDChatManager', ['updateRows']);
    d.setRenderPatched(true);
    d.addPatchSite('getNativeModule/DCDChatManager.updateRows');
    d.addPatchSite('nativeModuleProxy/DCDChatManager.updateRows');
    d.setFiringSite('nativeModuleProxy/DCDChatManager.updateRows');
    d.setSendPatched(true);
    d.countRenderCall();
    d.countParsedPayload();
    d.countDecorated(2);
    d.setStoredDecorations(3);
    d.recordPayload(describePayload([
      'chan',
      JSON.stringify([{ type: 1, message: { id: 'm1', content: [{ type: 'text', content: 'x' }] } }]),
    ]));

    const report = d.report();

    expect(report).toContain('found as `DCDChatManager`');
    expect(report).toContain('Render patch: active');
    expect(report).toContain('Patched 2 reference(s)');
    expect(report).toContain('Firing site: `nativeModuleProxy/DCDChatManager.updateRows`');
    expect(report).toContain('Send patch: active');
    expect(report).toContain('Rows decorated: 2');
    expect(report).toContain('Translations held: 3');
    expect(report).toContain('No message text');
  });

  test('makes a missing chat module obvious', () => {
    const d = createDiagnostics();
    d.setChatModule(false, null, []);

    expect(d.report()).toContain('**NOT FOUND**');
  });

  test('makes an unapplied patch obvious', () => {
    const d = createDiagnostics();
    d.setChatModule(true, 'DCDChatManager', ['updateRows']);
    d.setRenderPatched(false);

    expect(d.report()).toContain('Render patch: **not applied**');
  });

  test('says when no payload has been seen', () => {
    const d = createDiagnostics();
    expect(d.report()).toContain('No payload observed yet');
  });

  test('includes the last error', () => {
    const d = createDiagnostics();
    d.recordError(new Error('boom'));

    expect(d.report()).toContain('Error: boom');
  });

  test('snapshot is a plain copy', () => {
    const d = createDiagnostics();
    d.countRenderCall();

    const snapshot = d.snapshot();
    d.countRenderCall();

    expect(snapshot.renderCalls).toBe(1);
  });
});
