"use client";

import { useActionState, useMemo } from "react";
import { addGolfer, type AddGolferFormState } from "./actions";
import Link from "next/link";
import {
  useFieldValidation,
  FieldError,
  fieldBorderClass,
  validators,
} from "@/components/form-field";

type Event = {
  id: string;
  name: string;
};

export function AddGolferForm({ events }: { events: Event[] }) {
  const [state, formAction, isPending] = useActionState<AddGolferFormState, FormData>(
    addGolfer,
    {}
  );

  const fieldDefs = useMemo(() => ({
    firstName: [validators.required("First name")],
    lastName: [validators.required("Last name")],
    email: [validators.required("Email"), validators.email()],
    phone: [validators.phone()],
  }), []);
  const { errors, touched, handleBlur, validateAll } = useFieldValidation(fieldDefs);

  if (state.success) {
    return (
      <div className="rounded-lg border border-teal-200 bg-teal-50 p-6">
        <h2 className="font-serif text-lg font-semibold text-teal-800">
          Golfer Added
        </h2>
        <p className="mt-2 text-sm text-teal-700">
          <strong>{state.memberName}</strong> has been added and subscribed
          to the selected event(s). They&apos;ll receive weekly invites going
          forward.
        </p>
        <p className="mt-2 text-sm text-teal-600">
          They can log in anytime using the magic link sent to their email.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/admin/members"
            className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500"
          >
            Back to Members
          </Link>
          <Link
            href="/admin/members/add"
            className="rounded-md border border-teal-300 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100"
          >
            Add Another
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      action={(formData) => {
        if (!validateAll(formData)) return;
        formAction(formData);
      }}
      className="space-y-4"
    >
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="firstName"
            className="block text-sm font-medium text-gray-700"
          >
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            onBlur={(e) => handleBlur("firstName", e.target.value)}
            className={`mt-1 block w-full rounded-lg border px-4 py-2.5 text-gray-900 shadow-sm focus:outline-none focus:ring-2 ${fieldBorderClass(errors.firstName, touched.firstName)}`}
          />
          <FieldError error={errors.firstName} touched={touched.firstName} />
        </div>
        <div>
          <label
            htmlFor="lastName"
            className="block text-sm font-medium text-gray-700"
          >
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            onBlur={(e) => handleBlur("lastName", e.target.value)}
            className={`mt-1 block w-full rounded-lg border px-4 py-2.5 text-gray-900 shadow-sm focus:outline-none focus:ring-2 ${fieldBorderClass(errors.lastName, touched.lastName)}`}
          />
          <FieldError error={errors.lastName} touched={touched.lastName} />
        </div>
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700"
        >
          Email <span className="text-red-500">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          onBlur={(e) => handleBlur("email", e.target.value)}
          className={`mt-1 block w-full rounded-lg border px-4 py-2.5 text-gray-900 shadow-sm focus:outline-none focus:ring-2 ${fieldBorderClass(errors.email, touched.email)}`}
        />
        <FieldError error={errors.email} touched={touched.email} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-gray-700"
          >
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            placeholder="(555) 555-5555"
            onBlur={(e) => handleBlur("phone", e.target.value)}
            className={`mt-1 block w-full rounded-lg border px-4 py-2.5 text-gray-900 shadow-sm focus:outline-none focus:ring-2 ${fieldBorderClass(errors.phone, touched.phone)}`}
          />
          <FieldError error={errors.phone} touched={touched.phone} />
        </div>
        <div>
          <label
            htmlFor="ghin"
            className="block text-sm font-medium text-gray-700"
          >
            GHIN Number
          </label>
          <input
            id="ghin"
            name="ghin"
            type="text"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-teal-500 focus:ring-teal-500"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="eventId"
          className="block text-sm font-medium text-gray-700"
        >
          Subscribe to Event
        </label>
        <select
          id="eventId"
          name="eventId"
          defaultValue="all"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-teal-500 focus:ring-teal-500"
        >
          <option value="all">All Active Events</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 disabled:opacity-50"
      >
        {isPending ? "Adding Golfer..." : "Add Golfer"}
      </button>
    </form>
  );
}
