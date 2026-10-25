"use client";
import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  useFormName,
  useFormValidation,
  useGetFieldValue,
  useSetFieldValue,
  useIsStreaming,
  useStateField,
  parseStructuredRules,
} from "@openuidev/react-lang";
import { z } from "zod";
export const defaultsSchema = z
  .record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  )
  .optional();
type Reset = () => void;
type Context = {
  defaults: Record<string, unknown>;
  register: (id: string, reset: Reset) => () => void;
  reset: () => void;
  submit: () => boolean;
  dirty: () => void;
};
export const LocalFormContext = createContext<Context | null>(null);
const EMPTY_DEFAULTS: Record<string, unknown> = {};
export function LocalForm({
  children,
  defaults = EMPTY_DEFAULTS,
  "data-ii-selection": selectionId,
  "data-ii-component": selectionType,
}: {
  children: ReactNode;
  defaults?: Record<string, unknown>;
  "data-ii-selection"?: string;
  "data-ii-component"?: string;
}) {
  const fields = useRef(new Map<string, Reset>()),
    validation = useFormValidation(),
    [valid, setValid] = useState(false);
  const validationRef = useRef(validation);
  useEffect(() => {
    validationRef.current = validation;
  }, [validation]);
  const register = useCallback((id: string, reset: Reset) => {
    fields.current.set(id, reset);
    return () => {
      fields.current.delete(id);
    };
  }, []);
  const dirty = useCallback(() => setValid(false), []);
  const reset = useCallback(() => {
    fields.current.forEach((fn) => fn());
    const v = validationRef.current;
    Object.keys(v?.errors ?? {}).forEach((key) => v?.clearFieldError(key));
    setValid(false);
  }, []);
  const submit = useCallback(() => {
    const ok = validationRef.current?.validateForm() ?? true;
    setValid(ok);
    return ok;
  }, []);
  const context = useMemo<Context>(
    () => ({ defaults, register, dirty, reset, submit }),
    [defaults, register, dirty, reset, submit],
  );
  return (
    <LocalFormContext.Provider value={context}>
      <div
        className="ii-local-form"
        data-ii-selection={selectionId}
        data-ii-component={selectionType}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            event.target instanceof HTMLInputElement &&
            !["checkbox", "radio", "range"].includes(event.target.type)
          ) {
            event.preventDefault();
            submit();
          }
        }}
      >
        {children}
        {valid && (
          <span className="ii-form-valid" role="status">
            All fields look good.
          </span>
        )}
      </div>
    </LocalFormContext.Provider>
  );
}
/** Register reset without storing another copy of the live field value. */
function useResettable(name: string, value: unknown, reset: () => void) {
  const form = useContext(LocalFormContext),
    ref = useRef(reset);
  useEffect(() => {
    ref.current = reset;
  }, [reset]);
  const register = form?.register;
  useEffect(() => register?.(name, () => ref.current()), [register, name]);
  const dirty = form?.dirty;
  useEffect(() => {
    dirty?.();
  }, [value, dirty]);
}
export function useModernField(
  name: string,
  type: string,
  fallback: unknown = "",
) {
  const form = useContext(LocalFormContext),
    formName = useFormName(),
    get = useGetFieldValue(),
    set = useSetFieldValue(),
    streaming = useIsStreaming();
  const initial = form?.defaults[name] ?? fallback,
    value = get(formName, name) ?? initial;
  useEffect(() => {
    if (!streaming && form && get(formName, name) === undefined)
      set(formName, type, name, initial, true);
  }, [streaming, form, formName, name, type, initial, get, set]);
  useResettable(name, value, () => set(formName, type, name, initial, true));
  return value;
}
export function useLocalStateField(name: string, initial: unknown) {
  const field = useStateField(name, initial),
    form = useContext(LocalFormContext);
  const seed =
    initial && typeof initial === "object" && "value" in initial
      ? initial.value
      : initial;
  const starting = useRef(seed),
    streaming = useIsStreaming();
  // Streaming may resolve a literal after the initial mount; freeze its final value.
  useEffect(() => {
    if (streaming) starting.current = seed;
  }, [streaming, seed]);
  useResettable(name, field.value, () =>
    field.setValue(form?.defaults[name] ?? starting.current),
  );
  return field;
}
export function useFieldRules(name: string, value: unknown, rules: unknown) {
  const validation = useFormValidation(),
    streaming = useIsStreaming();
  const parsed = useMemo(
    () =>
      parseStructuredRules(rules as Parameters<typeof parseStructuredRules>[0]),
    [rules],
  );
  const current = useRef(value);
  useEffect(() => {
    current.current = value;
  }, [value]);
  useEffect(() => {
    if (!streaming && validation && parsed.length) {
      validation.registerField(name, parsed, () => current.current);
      return () => validation.unregisterField(name);
    }
  }, [streaming, validation, name, parsed]);
  return {
    error: validation?.errors[name],
    check: () => validation?.validateField(name, current.current, parsed),
  };
}
