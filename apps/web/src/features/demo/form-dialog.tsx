"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";

export type FieldOption = { value: string; label: string; group?: string };
export type FormField = {
  name: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "number"
    | "date"
    | "datetime-local"
    | "time"
    | "url"
    | "select"
    | "checkbox"
    | "checklist";
  options?: FieldOption[];
  required?: boolean;
  hint?: string;
  min?: number;
  max?: number;
};
export type FormConfig = {
  title: string;
  description?: string;
  submitLabel?: string;
  fields: FormField[];
  values?: Record<string, string | string[] | boolean>;
  /** Throw an Error to show its message in the dialog. */
  onSubmit: (fields: FormData) => void;
};

function grouped(options: FieldOption[]) {
  const groups = new Map<string, FieldOption[]>();
  for (const option of options) {
    const key = option.group ?? "";
    groups.set(key, [...(groups.get(key) ?? []), option]);
  }
  return [...groups];
}

/** A modal form driven by a field list. Pass `config` to open it. */
export function FormDialog({
  config,
  onClose,
}: {
  config?: FormConfig;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [shown, setShown] = useState<{ config?: FormConfig; version: number }>({
    version: 0,
  });
  if (config !== shown.config) {
    setShown({ config, version: shown.version + 1 });
    setError("");
  }

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (config && !element.open) element.showModal();
    if (!config && element.open) element.close();
  }, [config]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config) return;
    try {
      config.onSubmit(new FormData(event.currentTarget));
      onClose();
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  const value = (name: string) => config?.values?.[name];
  return (
    <dialog
      ref={dialog}
      className="search-dialog academic-dialog form-dialog"
      aria-labelledby="form-dialog-title"
      onClose={onClose}
    >
      {config && (
        <form onSubmit={submit} key={shown.version}>
          <div className="dialog-heading">
            <h2 id="form-dialog-title">{config.title}</h2>
            <button
              type="button"
              className="icon-button"
              aria-label="Close"
              onClick={onClose}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {config.description && (
            <p className="muted-copy">{config.description}</p>
          )}
          {config.fields.map((field) => {
            const type = field.type ?? "text";
            const current = value(field.name);
            if (type === "checklist")
              return (
                <fieldset className="checklist" key={field.name}>
                  <legend>{field.label}</legend>
                  {field.hint && <p className="field-hint">{field.hint}</p>}
                  {grouped(field.options ?? []).map(([group, options]) => (
                    <div key={group}>
                      {group && <strong>{group}</strong>}
                      {options.map((option) => (
                        <label key={option.value} className="check-row">
                          <input
                            type="checkbox"
                            name={field.name}
                            value={option.value}
                            defaultChecked={
                              Array.isArray(current) &&
                              current.includes(option.value)
                            }
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  ))}
                  {!field.options?.length && (
                    <p className="field-hint">Nothing to choose yet.</p>
                  )}
                </fieldset>
              );
            if (type === "checkbox")
              return (
                <label className="check-row" key={field.name}>
                  <input
                    type="checkbox"
                    name={field.name}
                    defaultChecked={current === true}
                  />
                  {field.label}
                </label>
              );
            return (
              <label key={field.name}>
                {field.label}
                {type === "select" ? (
                  <select
                    name={field.name}
                    required={field.required !== false}
                    defaultValue={typeof current === "string" ? current : ""}
                  >
                    <option value="" disabled>
                      Select {field.label.toLowerCase()}
                    </option>
                    {grouped(field.options ?? []).map(([group, options]) =>
                      group ? (
                        <optgroup label={group} key={group}>
                          {options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </optgroup>
                      ) : (
                        options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))
                      ),
                    )}
                  </select>
                ) : type === "textarea" ? (
                  <textarea
                    name={field.name}
                    required={field.required !== false}
                    defaultValue={typeof current === "string" ? current : ""}
                  />
                ) : (
                  <input
                    name={field.name}
                    type={type}
                    min={field.min}
                    max={field.max}
                    step={type === "number" ? "any" : undefined}
                    required={field.required !== false}
                    defaultValue={typeof current === "string" ? current : ""}
                  />
                )}
                {field.hint && <span className="field-hint">{field.hint}</span>}
              </label>
            );
          })}
          {error && <p role="alert">{error}</p>}
          <div className="academic-toolbar">
            <button
              type="button"
              className="button button-outline"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="button button-primary">
              {config.submitLabel ?? "Save"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}

/** Asks for confirmation before a destructive action. */
export function confirmAction(message: string) {
  return window.confirm(message);
}
