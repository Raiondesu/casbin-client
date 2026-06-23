/// <reference lib="dom" />
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

// Scope the DOM to THIS file only — a global preload would give every test a real
// sessionStorage and break the async-authorizer test via a stale cache.
beforeAll(() => GlobalRegistrator.register());
afterAll(() => GlobalRegistrator.unregister());

import { render, renderHook } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement as h, type ReactNode } from 'react';

import {
  Can, byPattern, createAuthorizerContext, globMatch, useAuthorizer,
} from '../src/react';
import type { AuthorizerOptions, Permissions } from '../src/react';

// Pattern-based permissions: objects are concrete paths (string), checked against stored patterns.
type P = Permissions<'read' | 'write' | 'delete', string>;
const perms: P = { read: ['/data/*'], write: ['/billing'], delete: [] };
const opts: AuthorizerOptions<P> = { matchObject: byPattern(globMatch) };

describe('useAuthorizer (headless hook)', () => {
  test('exposes can in both forms, with pattern matching', () => {
    const { result } = renderHook(() => useAuthorizer(perms, opts));
    const { can, isLoading, isReady, permissions } = result.current;

    expect(isLoading).toBeFalse(); // hydrated in a client render
    expect(isReady).toBeTrue();
    expect(permissions).toEqual(perms);
    expect(can('read', '/data/123')).toBeTrue(); // /data/* matches via byPattern(globMatch)
    expect(can.read('/data/123')).toBeTrue();    // curried form survives
    expect(can('read', '/other')).toBeFalse();
    expect(can('write', '/billing')).toBeTrue();
  });

  test('isLoading is true while loading, and a null policy denies', () => {
    const { result } = renderHook(() => useAuthorizer(null, { isLoading: true }));

    expect(result.current.isLoading).toBeTrue();
    expect(result.current.permissions).toBeNull();
    expect(result.current.can('read', '/data/1')).toBeFalse();
  });

  test('the authorizer is referentially stable across renders with the same policy', () => {
    const { result, rerender } = renderHook((props: { p: P }) => useAuthorizer(props.p, opts), {
      initialProps: { p: perms },
    });
    const can1 = result.current.can;

    rerender({ p: perms });         // same reference -> stable
    expect(result.current.can).toBe(can1);

    rerender({ p: { ...perms } });  // new reference -> rebuilt
    expect(result.current.can).not.toBe(can1);
  });

  test('the default store never touches global Storage', () => {
    sessionStorage.clear();
    const { result } = renderHook(() => useAuthorizer(perms, opts));
    result.current.can('read', '/data/1');

    // the hook injects a noop store, so the real sessionStorage is never written/read
    expect(sessionStorage.getItem('auth')).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});

describe('createAuthorizerContext (typed factory)', () => {
  const factory = createAuthorizerContext<P>();
  const { AuthorizerProvider, useCan } = factory;
  const CtxCan = factory.Can as unknown as (props: Record<string, unknown>) => ReactNode;
  const wrap = (node: ReactNode) => h(AuthorizerProvider, { permissions: perms, options: opts }, node);
  const wrapper = ({ children }: { children: ReactNode }) => wrap(children);

  test('provides can through context', () => {
    const { result } = renderHook(() => useCan(), { wrapper });
    expect(result.current('read', '/data/9')).toBeTrue();
    expect(result.current.write('/billing')).toBeTrue();
  });

  test('useAuthorizer (context) exposes the full state', () => {
    const { result } = renderHook(() => factory.useAuthorizer(), { wrapper });
    expect(result.current.isReady).toBeTrue();
    expect(result.current.permissions).toEqual(perms);
  });

  test('the context-bound <Can> reads the Provider', () => {
    expect(render(wrap(h(CtxCan, { action: 'read', object: '/data/8' }, 'OK'))).container.textContent).toBe('OK');
  });

  test('a context hook throws outside its Provider', () => {
    expect(() => renderHook(() => useCan())).toThrow(/AuthorizerProvider/);
  });
});

describe('<Can> gate', () => {
  const C = Can as unknown as (props: Record<string, unknown>) => ReactNode;

  test('renders the allowed / denied / loading slots', () => {
    expect(render(h(C, { permissions: perms, options: opts, action: 'read', object: '/data/5' }, 'YES'))
      .container.textContent).toBe('YES');

    expect(render(h(C, { permissions: perms, options: opts, action: 'read', object: '/nope', fallback: 'NO' }, 'YES'))
      .container.textContent).toBe('NO');

    expect(render(h(C, { permissions: null, isLoading: true, action: 'read', object: '/data/5', loading: 'WAIT', fallback: 'NO' }, 'YES'))
      .container.textContent).toBe('WAIT');
  });

  test('`not` inverts the decision', () => {
    expect(render(h(C, { permissions: perms, options: opts, action: 'read', object: '/nope', not: true }, 'INV'))
      .container.textContent).toBe('INV');
  });

  test('the render-prop child receives the decision', () => {
    const r = render(h(C, {
      permissions: perms, options: opts, action: 'read', object: '/data/5',
      children: ({ allowed }: { allowed: boolean }) => (allowed ? 'A' : 'B'),
    }));
    expect(r.container.textContent).toBe('A');
  });
});

describe('SSR', () => {
  const C = Can as unknown as (props: Record<string, unknown>) => ReactNode;

  test('server render shows the loading branch (no can() decision in server markup)', () => {
    const html = renderToStaticMarkup(h(C, {
      permissions: perms, options: opts, action: 'read', object: '/data/5',
      loading: 'LOADING', fallback: 'DENIED',
    }, 'ALLOWED'));

    expect(html).toContain('LOADING');
    expect(html).not.toContain('ALLOWED');
    expect(html).not.toContain('DENIED');
  });
});
