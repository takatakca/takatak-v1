"use client";

import {
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  Loader2,
  Save,
} from "lucide-react";
import { useRouter } from "next/navigation";

import {
  FormAlert,
  FormField,
  FormSection,
  SelectField,
} from "@/components/forms/form-controls";
import {
  CLIENT_STATUSES,
  type ClientStatusValue,
} from "@/lib/clients/client-validation";

export interface ClientFormValues {
  name: string;
  companyName: string;
  email: string;
  phone: string;
  planName: string;
  timezone: string;
  status: ClientStatusValue;
  ownerEmail: string;
  assignedAdminEmail: string;
}

type CreatedClient = {
  id: string;
  name: string;
};

type ApiResponse = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  client?: {
    id?: string;
    name?: string;
  };
};

export function ClientForm({
  mode,
  clientId,
  initialValues,
}: {
  mode: "create" | "edit";
  clientId?: string;
  initialValues: ClientFormValues;
}) {
  const router = useRouter();

  const formRef =
    useRef<HTMLFormElement | null>(null);

  const nameInputRef =
    useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState(false);

  const [createdClient, setCreatedClient] =
    useState<CreatedClient | null>(null);

  const [fieldErrors, setFieldErrors] =
    useState<Record<string, string>>({});

  function goToCreatedClient() {
    if (!createdClient) {
      return;
    }

    router.push(
      `/dashboard/clients`,
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setMessage(null);
    setSuccess(false);
    setCreatedClient(null);
    setFieldErrors({});

    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = {
      name: String(formData.get("name") ?? ""),
      companyName: String(
        formData.get("companyName") ?? "",
      ),
      email: String(
        formData.get("email") ?? "",
      ),
      phone: String(
        formData.get("phone") ?? "",
      ),
      planName: String(
        formData.get("planName") ?? "",
      ),
      timezone: String(
        formData.get("timezone") ?? "",
      ),
      status: String(
        formData.get("status") ?? "",
      ),
      assignedAdminEmail: String(
        formData.get("assignedAdminEmail") ?? "",
      ),
      ...(mode === "create"
        ? {
            ownerEmail: String(
              formData.get("ownerEmail") ?? "",
            ),
          }
        : {}),
    };

    try {
      const response = await fetch(
        mode === "create"
          ? "/api/admin/clients"
          : `/api/admin/clients/${encodeURIComponent(
              clientId ?? "",
            )}`,
        {
          method:
            mode === "create"
              ? "POST"
              : "PATCH",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      let result: ApiResponse;

      try {
        result =
          (await response.json()) as ApiResponse;
      } catch {
        setMessage(
          "The workspace service returned an invalid response.",
        );

        return;
      }

      if (!response.ok || !result.ok) {
        setMessage(
          result.message ??
            "The workspace could not be saved.",
        );

        setFieldErrors(
          result.fieldErrors ?? {},
        );

        return;
      }

      if (mode === "create") {
        const createdId = result.client?.id;
        const createdName =
          result.client?.name ??
          payload.name.trim();

        if (!createdId) {
          setMessage(
            "The workspace was created, but its client page could not be resolved.",
          );

          return;
        }

        form.reset();

        setCreatedClient({
          id: createdId,
          name: createdName,
        });

        setSuccess(true);

        setMessage(
          `Client workspace created successfully for ${createdName}.`,
        );

        setFieldErrors({});

        router.refresh();

        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });

        return;
      }

      setSuccess(true);

      setMessage(
        result.message ??
          "The workspace was saved successfully.",
      );

      router.refresh();
    } catch {
      setMessage(
        "A network error occurred. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-5"
      noValidate
    >
      {createdClient && success ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-900">
                Client workspace created successfully
              </p>

              <p className="mt-1 text-sm text-emerald-700">
                The workspace for{" "}
                <span className="font-semibold">
                  {createdClient.name}
                </span>{" "}
                is ready.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={goToCreatedClient}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
              >
                Go to client workspaces
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      ) : message ? (
        <FormAlert
          tone={success ? "success" : "error"}
        >
          {message}
        </FormAlert>
      ) : null}

      <FormSection
        title="Workspace identity"
        description="The workspace is the tenant boundary used by memberships, brands, integrations, jobs, and reports."
      >
        <FormField
          ref={nameInputRef}
          label="Workspace name"
          name="name"
          required
          maxLength={120}
          defaultValue={initialValues.name}
          error={fieldErrors.name}
          autoComplete="organization"
        />

        <FormField
          label="Legal or company name"
          name="companyName"
          maxLength={160}
          defaultValue={initialValues.companyName}
          error={fieldErrors.companyName}
          autoComplete="organization"
        />

        <FormField
          label="Workspace email"
          name="email"
          type="email"
          maxLength={254}
          defaultValue={initialValues.email}
          error={fieldErrors.email}
          autoComplete="email"
        />

        <FormField
          label="Workspace phone"
          name="phone"
          type="tel"
          maxLength={40}
          defaultValue={initialValues.phone}
          error={fieldErrors.phone}
          autoComplete="tel"
        />

        <FormField
          label="Plan name"
          name="planName"
          maxLength={100}
          defaultValue={initialValues.planName}
          error={fieldErrors.planName}
          placeholder="Agency Growth"
        />

        <SelectField
          label="Workspace status"
          name="status"
          required
          defaultValue={initialValues.status}
          error={fieldErrors.status}
        >
          {CLIENT_STATUSES.map((status) => (
            <option
              key={status}
              value={status}
            >
              {status.replace(/_/g, " ")}
            </option>
          ))}
        </SelectField>

        <FormField
          label="Timezone"
          name="timezone"
          required
          maxLength={100}
          defaultValue={initialValues.timezone}
          error={fieldErrors.timezone}
          hint="Use an IANA timezone, for example America/Toronto."
          className="sm:col-span-2"
        />
      </FormSection>

      <FormSection
        title="Ownership and administration"
        description={
          mode === "create"
            ? "The initial owner must already have an active TAKATAK account."
            : "Workspace ownership remains controlled through Team & Permissions. This form only changes the assigned platform administrator."
        }
      >
        {mode === "create" ? (
          <FormField
            label="Initial workspace owner email"
            name="ownerEmail"
            type="email"
            required
            maxLength={254}
            defaultValue={initialValues.ownerEmail}
            error={fieldErrors.ownerEmail}
            autoComplete="email"
            className="sm:col-span-2"
          />
        ) : null}

        <FormField
          label="Assigned Platform Admin email"
          name="assignedAdminEmail"
          type="email"
          maxLength={254}
          defaultValue={
            initialValues.assignedAdminEmail
          }
          error={
            fieldErrors.assignedAdminEmail
          }
          autoComplete="email"
          hint="Optional. The account must have Platform Admin or Platform Owner access."
          className="sm:col-span-2"
        />
      </FormSection>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={loading}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}

          {loading
            ? "Saving…"
            : mode === "create"
              ? "Create workspace"
              : "Save workspace"}
        </button>
      </div>
    </form>
  );
}

// "use client";

// import {
//   useState,
//   type FormEvent,
// } from "react";
// import { Loader2, Save } from "lucide-react";
// import { useRouter } from "next/navigation";

// import {
//   FormAlert,
//   FormField,
//   FormSection,
//   SelectField,
// } from "@/components/forms/form-controls";
// import {
//   CLIENT_STATUSES,
//   type ClientStatusValue,
// } from "@/lib/clients/client-validation";

// export interface ClientFormValues {
//   name: string;
//   companyName: string;
//   email: string;
//   phone: string;
//   planName: string;
//   timezone: string;
//   status: ClientStatusValue;
//   ownerEmail: string;
//   assignedAdminEmail: string;
// }

// type ApiResponse = {
//   ok?: boolean;
//   message?: string;
//   fieldErrors?: Record<string, string>;
//   client?: {
//     id?: string;
//   };
// };

// export function ClientForm({
//   mode,
//   clientId,
//   initialValues,
// }: {
//   mode: "create" | "edit";
//   clientId?: string;
//   initialValues: ClientFormValues;
// }) {
//   const router = useRouter();

//   const [loading, setLoading] = useState(false);
//   const [message, setMessage] =
//     useState<string | null>(null);
//   const [success, setSuccess] = useState(false);

//   const [fieldErrors, setFieldErrors] =
//     useState<Record<string, string>>({});

//   async function handleSubmit(
//     event: FormEvent<HTMLFormElement>,
//   ) {
//     event.preventDefault();

//     if (loading) {
//       return;
//     }

//     setLoading(true);
//     setMessage(null);
//     setSuccess(false);
//     setFieldErrors({});

//     const form = event.currentTarget;
//     const formData = new FormData(form);

//     const payload = {
//       name: String(formData.get("name") ?? ""),
//       companyName: String(
//         formData.get("companyName") ?? "",
//       ),
//       email: String(formData.get("email") ?? ""),
//       phone: String(formData.get("phone") ?? ""),
//       planName: String(
//         formData.get("planName") ?? "",
//       ),
//       timezone: String(
//         formData.get("timezone") ?? "",
//       ),
//       status: String(
//         formData.get("status") ?? "",
//       ),
//       assignedAdminEmail: String(
//         formData.get("assignedAdminEmail") ?? "",
//       ),
//       ...(mode === "create"
//         ? {
//             ownerEmail: String(
//               formData.get("ownerEmail") ?? "",
//             ),
//           }
//         : {}),
//     };

//     try {
//       const response = await fetch(
//         mode === "create"
//           ? "/api/admin/clients"
//           : `/api/admin/clients/${encodeURIComponent(
//               clientId ?? "",
//             )}`,
//         {
//           method:
//             mode === "create" ? "POST" : "PATCH",
//           credentials: "same-origin",
//           headers: {
//             Accept: "application/json",
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify(payload),
//         },
//       );

//       let result: ApiResponse;

//       try {
//         result =
//           (await response.json()) as ApiResponse;
//       } catch {
//         setMessage(
//           "The workspace service returned an invalid response.",
//         );

//         return;
//       }

//       if (!response.ok || !result.ok) {
//         setMessage(
//           result.message ??
//             "The workspace could not be saved.",
//         );

//         setFieldErrors(
//           result.fieldErrors ?? {},
//         );

//         return;
//       }

//       if (mode === "create") {
//         const createdId = result.client?.id;

//         if (createdId) {
//           router.push(
//             `/dashboard/clients/${createdId}`,
//           );

//           router.refresh();

//           return;
//         }
//       }

//       setSuccess(true);

//       setMessage(
//         result.message ??
//           "The workspace was saved successfully.",
//       );

//       router.refresh();
//     } catch {
//       setMessage(
//         "A network error occurred. Check your connection and try again.",
//       );
//     } finally {
//       setLoading(false);
//     }
//   }

//   return (
//     <form
//       onSubmit={handleSubmit}
//       className="space-y-5"
//       noValidate
//     >
//       {message ? (
//         <FormAlert
//           tone={success ? "success" : "error"}
//         >
//           {message}
//         </FormAlert>
//       ) : null}

//       <FormSection
//         title="Workspace identity"
//         description="The workspace is the tenant boundary used by memberships, brands, integrations, jobs, and reports."
//       >
//         <FormField
//           label="Workspace name"
//           name="name"
//           required
//           maxLength={120}
//           defaultValue={initialValues.name}
//           error={fieldErrors.name}
//           autoComplete="organization"
//         />

//         <FormField
//           label="Legal or company name"
//           name="companyName"
//           maxLength={160}
//           defaultValue={initialValues.companyName}
//           error={fieldErrors.companyName}
//           autoComplete="organization"
//         />

//         <FormField
//           label="Workspace email"
//           name="email"
//           type="email"
//           maxLength={254}
//           defaultValue={initialValues.email}
//           error={fieldErrors.email}
//           autoComplete="email"
//         />

//         <FormField
//           label="Workspace phone"
//           name="phone"
//           type="tel"
//           maxLength={40}
//           defaultValue={initialValues.phone}
//           error={fieldErrors.phone}
//           autoComplete="tel"
//         />

//         <FormField
//           label="Plan name"
//           name="planName"
//           maxLength={100}
//           defaultValue={initialValues.planName}
//           error={fieldErrors.planName}
//           placeholder="Agency Growth"
//         />

//         <SelectField
//           label="Workspace status"
//           name="status"
//           required
//           defaultValue={initialValues.status}
//           error={fieldErrors.status}
//         >
//           {CLIENT_STATUSES.map((status) => (
//             <option
//               key={status}
//               value={status}
//             >
//               {status.replace(/_/g, " ")}
//             </option>
//           ))}
//         </SelectField>

//         <FormField
//           label="Timezone"
//           name="timezone"
//           required
//           maxLength={100}
//           defaultValue={initialValues.timezone}
//           error={fieldErrors.timezone}
//           hint="Use an IANA timezone, for example America/Toronto."
//           className="sm:col-span-2"
//         />
//       </FormSection>

//       <FormSection
//         title="Ownership and administration"
//         description={
//           mode === "create"
//             ? "The initial owner must already have an active TAKATAK account."
//             : "Workspace ownership remains controlled through Team & Permissions. This form only changes the assigned platform administrator."
//         }
//       >
//         {mode === "create" ? (
//           <FormField
//             label="Initial workspace owner email"
//             name="ownerEmail"
//             type="email"
//             required
//             maxLength={254}
//             defaultValue={initialValues.ownerEmail}
//             error={fieldErrors.ownerEmail}
//             autoComplete="email"
//             className="sm:col-span-2"
//           />
//         ) : null}

//         <FormField
//           label="Assigned Platform Admin email"
//           name="assignedAdminEmail"
//           type="email"
//           maxLength={254}
//           defaultValue={
//             initialValues.assignedAdminEmail
//           }
//           error={fieldErrors.assignedAdminEmail}
//           autoComplete="email"
//           hint="Optional. The account must have Platform Admin or Platform Owner access."
//           className="sm:col-span-2"
//         />
//       </FormSection>

//       <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
//         <button
//           type="button"
//           onClick={() => router.back()}
//           disabled={loading}
//           className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
//         >
//           Cancel
//         </button>

//         <button
//           type="submit"
//           disabled={loading}
//           className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
//         >
//           {loading ? (
//             <Loader2 className="h-4 w-4 animate-spin" />
//           ) : (
//             <Save className="h-4 w-4" />
//           )}

//           {loading
//             ? "Saving…"
//             : mode === "create"
//               ? "Create workspace"
//               : "Save workspace"}
//         </button>
//       </div>
//     </form>
//   );
// }