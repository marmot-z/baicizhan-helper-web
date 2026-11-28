import { describe, expect, it } from 'vitest';
import { createStudyInitializationScope } from './useStudyStrategy';

describe('learning initialization lifecycle', () => {
  it('invalidates an older pending initializer and its checkpoint callbacks', () => {
    const scope = createStudyInitializationScope();
    const first = scope.begin()!;
    const next = scope.begin()!;
    expect(scope.isPending(first)).toBe(false);
    expect(scope.canWrite(first)).toBe(false);
    expect(scope.activate(first)).toBe(false);
    expect(scope.isPending(next)).toBe(true);
    expect(scope.activate(next)).toBe(true);
    expect(scope.canWrite(next)).toBe(true);
  });

  it('cancels outstanding initialization but preserves an installed flow on effect cleanup', () => {
    const scope = createStudyInitializationScope();
    const pending = scope.begin()!;
    expect(scope.cancelPending()).toBe(true);
    expect(scope.canWrite(pending)).toBe(false);
    const installed = scope.begin()!;
    expect(scope.activate(installed)).toBe(true);
    expect(scope.cancelPending()).toBe(false);
    expect(scope.canWrite(installed)).toBe(true);
  });

  it('rejects old callbacks across unmount and StrictMode remount', () => {
    const scope = createStudyInitializationScope();
    const first = scope.begin()!;
    scope.activate(first);
    scope.dispose();
    expect(scope.canWrite(first)).toBe(false);
    expect(scope.begin()).toBeNull();
    scope.mount();
    const next = scope.begin()!;
    expect(scope.canWrite(first)).toBe(false);
    expect(scope.isPending(next)).toBe(true);
  });
});
