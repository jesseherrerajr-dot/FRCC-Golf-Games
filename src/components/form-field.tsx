"use client";

import { useState, useCallback } from "react";

// ─── Validation helpers ─────────────────────────────────────────
type Validator = (value: string) => string | null; // returns error message or null

export const validators = {
  required: (label: string): Validator => (v) =>
    v.trim() ? null : `${label} is required`,

  email: (): Validator => (v) => {
    if (!v.trim()) return null; // let `required` handle empty
    // Simple but effective email regex
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "Enter a valid email address";
  },

  phone: (): Validator => (v) => {
    if (!v.trim()) return null; // phone is optional
    const digits = v.replace(/\D/g, "");
    return digits.length === 10 ? null : "Enter a valid 10-digit US phone number";
  },
};

// ─── Hook: useFieldValidation ───────────────────────────────────
// Manages per-field touched state and error messages.
export function useFieldValidation(
  fields: Record<string, Validator[]>
) {
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = useCallback(
    (name: string, value: string) => {
      const fieldValidators = fields[name];
      if (!fieldValidators) return null;
      for (const validate of fieldValidators) {
        const err = validate(value);
        if (err) {
          setErrors((prev) => ({ ...prev, [name]: err }));
          return err;
        }
      }
      setErrors((prev) => ({ ...prev, [name]: null }));
      return null;
    },
    [fields]
  );

  const handleBlur = useCallback(
    (name: string, value: string) => {
      setTouched((prev) => ({ ...prev, [name]: true }));
      validateField(name, value);
    },
    [validateField]
  );

  // Validate all fields at once (for submit). Returns true if all valid.
  const validateAll = useCallback(
    (formData: FormData): boolean => {
      let allValid = true;
      const newErrors: Record<string, string | null> = {};
      const newTouched: Record<string, boolean> = {};

      for (const name of Object.keys(fields)) {
        newTouched[name] = true;
        const value = (formData.get(name) as string) || "";
        const fieldValidators = fields[name];
        let fieldError: string | null = null;
        for (const validate of fieldValidators) {
          const err = validate(value);
          if (err) {
            fieldError = err;
            allValid = false;
            break;
          }
        }
        newErrors[name] = fieldError;
      }

      setTouched((prev) => ({ ...prev, ...newTouched }));
      setErrors((prev) => ({ ...prev, ...newErrors }));
      return allValid;
    },
    [fields]
  );

  return { errors, touched, handleBlur, validateField, validateAll };
}

// ─── FieldError component ───────────────────────────────────────
export function FieldError({
  error,
  touched,
}: {
  error: string | null | undefined;
  touched: boolean | undefined;
}) {
  if (!touched || !error) return null;
  return (
    <p className="mt-1 text-xs text-red-600" role="alert">
      {error}
    </p>
  );
}

// Helper: returns border class based on field state
export function fieldBorderClass(
  error: string | null | undefined,
  touched: boolean | undefined,
  base = "border-gray-300"
): string {
  if (touched && error) return "border-red-400 focus:border-red-500 focus:ring-red-500/20";
  return `${base} focus:border-teal-600 focus:ring-teal-600/20`;
}
