import { describe, expect, test } from 'bun:test';

import { createDiagnostics, describePayload } from '../src/diagnostics';
import { findChatModule } from '../src/find-chat-module';

describe('chat module discovery', () => {
  test('finds a module by a known name and reports which one matched', () => {
    const module = { updateRows: () => {}, other: () => {} };

    const found = findChatModule({
      getNativeModule: (name: string) => (name === 'DCDChatManager' ? module : undefined),
    });

    expect(found?.name).toBe('DCDChatManager');
    expect(found?.method).toBe('updateRows');
    expect(found?.module).toBe(module);
    expect(found?.methods).toContain('updateRows');
  });

  test('prefers the first known name that matches', () => {
    const first = { updateRows: () => {} };
    const second = { updateRows: () => {} };

    const found = findChatModule({
      getNativeModule: (name: string) => {
        if (name === 'NativeChatModule') return first;
        if (name === 'DCDChatManager') return second;
        return undefined;
      },
    });

    expect(found?.module).toBe(first);
  });

  test('accepts an alternative row-update method name', () => {
    const module = { setRows: () => {} };

    const found = findChatModule({
      getNativeModule: () => module,
    });

    expect(found?.method).toBe('setRows');
  });

  test('falls back to scanning module maps for a chat-like module', () => {
    const module = { updateRows: () => {} };

    const found = findChatModule({
      getNativeModule: () => undefined,
      moduleMaps: [{
        SomeUnrelatedModule: { doThing: () => {} },
        DCDChatManagerExperimental: module,
      }],
    });

    expect(found?.name).toBe('DCDChatManagerExperimental');
    expect(found?.module).toBe(module);
  });

  test('ignores unrelated modules while scanning', () => {
    const found = findChatModule({
      getNativeModule: () => undefined,
      moduleMaps: [{ AudioManager: { updateRows: () => {} } }],
    });

    expect(found).toBeNull();
  });

  test('returns null when nothing plausible exists', () => {
    expect(findChatModule({ getNativeModule: () => undefined })).toBeNull();
    expect(findChatModule({
      getNativeModule: () => ({ unrelated: () => {} }),
    })).toBeNull();
  });

  test('survives a throwing lookup', () => {
    const found = findChatModule({
      getNativeModule: () => {
        throw new Error('bridge not ready');
      },
    });

    expect(found).toBeNull();
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
