import {
    forwardRef,
    type InputHTMLAttributes,
    type ReactNode,
    type SelectHTMLAttributes,
  } from "react";
  
  const CONTROL_CLASS =
    "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
  
  export function FormSection({
    title,
    description,
    children,
  }: {
    title: string;
    description?: string;
    children: ReactNode;
  }) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            {title}
          </h2>
  
          {description ? (
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {description}
            </p>
          ) : null}
        </header>
  
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          {children}
        </div>
      </section>
    );
  }
  
  export const FormField = forwardRef<
    HTMLInputElement,
    InputHTMLAttributes<HTMLInputElement> & {
      label: string;
      error?: string;
      hint?: string;
      className?: string;
    }
  >(function FormField(
    {
      label,
      error,
      hint,
      className = "",
      ...inputProps
    },
    ref,
  ) {
    const fieldId =
      inputProps.id ?? inputProps.name;
  
    return (
      <label
        htmlFor={fieldId}
        className={`block ${className}`}
      >
        <span className="text-xs font-medium text-slate-700">
          {label}
  
          {inputProps.required ? (
            <span className="ml-1 text-rose-500">
              *
            </span>
          ) : null}
        </span>
  
        <input
          {...inputProps}
          ref={ref}
          id={fieldId}
          className={`${CONTROL_CLASS} ${
            error
              ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
              : ""
          }`}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error
              ? `${fieldId}-error`
              : hint
                ? `${fieldId}-hint`
                : undefined
          }
        />
  
        {error ? (
          <span
            id={`${fieldId}-error`}
            className="mt-1 block text-xs font-medium text-rose-600"
          >
            {error}
          </span>
        ) : hint ? (
          <span
            id={`${fieldId}-hint`}
            className="mt-1 block text-xs text-slate-400"
          >
            {hint}
          </span>
        ) : null}
      </label>
    );
  });
  
  export function SelectField({
    label,
    error,
    hint,
    className = "",
    children,
    ...selectProps
  }: SelectHTMLAttributes<HTMLSelectElement> & {
    label: string;
    error?: string;
    hint?: string;
    className?: string;
    children: ReactNode;
  }) {
    const fieldId =
      selectProps.id ?? selectProps.name;
  
    return (
      <label
        htmlFor={fieldId}
        className={`block ${className}`}
      >
        <span className="text-xs font-medium text-slate-700">
          {label}
  
          {selectProps.required ? (
            <span className="ml-1 text-rose-500">
              *
            </span>
          ) : null}
        </span>
  
        <select
          {...selectProps}
          id={fieldId}
          className={`${CONTROL_CLASS} ${
            error
              ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
              : ""
          }`}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error
              ? `${fieldId}-error`
              : hint
                ? `${fieldId}-hint`
                : undefined
          }
        >
          {children}
        </select>
  
        {error ? (
          <span
            id={`${fieldId}-error`}
            className="mt-1 block text-xs font-medium text-rose-600"
          >
            {error}
          </span>
        ) : hint ? (
          <span
            id={`${fieldId}-hint`}
            className="mt-1 block text-xs text-slate-400"
          >
            {hint}
          </span>
        ) : null}
      </label>
    );
  }
  
  export function CheckboxField({
    name,
    label,
    description,
    defaultChecked,
  }: {
    name: string;
    label: string;
    description?: string;
    defaultChecked?: boolean;
  }) {
    return (
      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 sm:col-span-2">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
  
        <span>
          <span className="block text-sm font-medium text-slate-800">
            {label}
          </span>
  
          {description ? (
            <span className="mt-0.5 block text-xs leading-5 text-slate-500">
              {description}
            </span>
          ) : null}
        </span>
      </label>
    );
  }
  
  export function FormAlert({
    tone,
    children,
  }: {
    tone: "error" | "success" | "info";
    children: ReactNode;
  }) {
    const classes =
      tone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-indigo-200 bg-indigo-50 text-indigo-700";
  
    return (
      <div
        role={
          tone === "error"
            ? "alert"
            : "status"
        }
        className={`rounded-xl border px-4 py-3 text-sm ${classes}`}
      >
        {children}
      </div>
    );
  }