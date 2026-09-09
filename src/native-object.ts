import { RuntimeFunction, RuntimeNativeObject, RuntimeValue, SesiRuntimeError } from './types';

const BLOCKED_PROPERTIES = new Set([
  '__proto__',
  'prototype',
  'constructor',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
]);

let nextNativeId = 1;

export interface NativeObjectSpec {
  type: string;
  id?: string;
  get(property: string): RuntimeValue;
  set(property: string, value: RuntimeValue): void;
  keys(): string[];
  describe?(): string;
  disposed?(): boolean;
}

export function assertSafeNativeProperty(property: string): void {
  if (BLOCKED_PROPERTIES.has(property)) {
    throw new SesiRuntimeError(
      'NativePropertyError',
      `Access to protected property "${property}" is not allowed.`,
      { property },
    );
  }
}

export function createNativeObject(spec: NativeObjectSpec): RuntimeNativeObject {
  const nativeId = spec.id ?? `${spec.type}:${nextNativeId++}`;
  return Object.freeze({
    type: 'native_object' as const,
    nativeType: spec.type,
    nativeId,
    getProperty(property: string): RuntimeValue {
      assertSafeNativeProperty(property);
      if (spec.disposed?.()) {
        throw new SesiRuntimeError('DisposedObjectError', `${spec.type} "${nativeId}" has been disposed.`, {
          native_type: spec.type,
          native_id: nativeId,
        });
      }
      return spec.get(property);
    },
    setProperty(property: string, value: RuntimeValue): void {
      assertSafeNativeProperty(property);
      if (spec.disposed?.()) {
        throw new SesiRuntimeError('DisposedObjectError', `${spec.type} "${nativeId}" has been disposed.`, {
          native_type: spec.type,
          native_id: nativeId,
        });
      }
      spec.set(property, value);
    },
    listProperties(): string[] {
      return spec.keys().filter(key => !BLOCKED_PROPERTIES.has(key));
    },
    describe(): string {
      return spec.describe?.() ?? `<${spec.type} ${nativeId}>`;
    },
    isDisposed(): boolean {
      return spec.disposed?.() ?? false;
    },
  });
}

export function isNativeObject(value: RuntimeValue): value is RuntimeNativeObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && value.type === 'native_object';
}

export function getRuntimeProperty(value: RuntimeValue, property: string): RuntimeValue {
  assertSafeNativeProperty(property);
  if (isNativeObject(value)) return value.getProperty(property);
  if (typeof value === 'object' && value !== null) return (value as Record<string, RuntimeValue>)[property] ?? null;
  return null;
}

export function setRuntimeProperty(value: RuntimeValue, property: string, next: RuntimeValue): void {
  assertSafeNativeProperty(property);
  if (isNativeObject(value)) {
    value.setProperty(property, next);
    return;
  }
  if (typeof value === 'object' && value !== null) {
    (value as Record<string, RuntimeValue>)[property] = next;
  }
}

export function runtimeKeys(value: RuntimeValue): string[] | null {
  if (isNativeObject(value)) return value.listProperties();
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.keys(value);
}

export function bindNativeMethod(
  name: string,
  params: string[],
  method: (...args: RuntimeValue[]) => RuntimeValue | Promise<RuntimeValue>,
): RuntimeFunction {
  return {
    type: 'function',
    name,
    params: params.map(param => ({ name: param })),
    body: {} as any,
    closure: {} as any,
    isBuiltin: true,
    builtin: method,
  };
}
