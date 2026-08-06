"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Loader2,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  ALL_PERMISSIONS,
  type Permission,
} from "@/lib/security/roles";

type PermissionState = "inherit" | "grant" | "deny";

type PermissionUpdateResponse = {
  ok: boolean;
  message?: string;
};

type MemberPermissionsFormProps = {
  membershipId: string;
  customPermissions: Permission[];
  deniedPermissions: Permission[];
  assignablePermissions: Permission[];
};

function permissionLabel(
  permission: Permission,
): string {
  return permission
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");
}

function getInitialStates(
  customPermissions: Permission[],
  deniedPermissions: Permission[],
): Record<Permission, PermissionState> {
  return Object.fromEntries(
    ALL_PERMISSIONS.map((permission) => {
      if (customPermissions.includes(permission)) {
        return [permission, "grant"];
      }

      if (deniedPermissions.includes(permission)) {
        return [permission, "deny"];
      }

      return [permission, "inherit"];
    }),
  ) as Record<Permission, PermissionState>;
}

export function MemberPermissionsForm({
  membershipId,
  customPermissions,
  deniedPermissions,
  assignablePermissions,
}: MemberPermissionsFormProps) {
  const router = useRouter();
  const submissionInProgress = useRef(false);

  const [open, setOpen] = useState(false);

  const [permissionStates, setPermissionStates] =
    useState<Record<Permission, PermissionState>>(
      getInitialStates(
        customPermissions,
        deniedPermissions,
      ),
    );

  const [loading, setLoading] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [open, loading]);

  function openEditor() {
    setPermissionStates(
      getInitialStates(
        customPermissions,
        deniedPermissions,
      ),
    );

    setErrorMessage(null);
    setSuccessMessage(null);
    setOpen(true);
  }

  function closeEditor() {
    if (loading) {
      return;
    }

    setOpen(false);
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function updatePermission(
    permission: Permission,
    state: PermissionState,
  ) {
    setPermissionStates((currentStates) => ({
      ...currentStates,
      [permission]: state,
    }));

    setErrorMessage(null);
    setSuccessMessage(null);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      loading ||
      submissionInProgress.current
    ) {
      return;
    }

    const grantedPermissions =
      ALL_PERMISSIONS.filter(
        (permission) =>
          permissionStates[permission] === "grant",
      );

    const unauthorizedGrant =
      grantedPermissions.find(
        (permission) =>
          !assignablePermissions.includes(permission),
      );

    if (unauthorizedGrant) {
      setErrorMessage(
        "You cannot grant a permission that you do not have.",
      );
      return;
    }

    const rejectedPermissions =
      ALL_PERMISSIONS.filter(
        (permission) =>
          permissionStates[permission] === "deny",
      );

    submissionInProgress.current = true;
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/team/members/${encodeURIComponent(
          membershipId,
        )}/permissions`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customPermissions: grantedPermissions,
            deniedPermissions: rejectedPermissions,
          }),
        },
      );

      let result: PermissionUpdateResponse;

      try {
        result =
          (await response.json()) as PermissionUpdateResponse;
      } catch {
        setErrorMessage(
          "The permission service returned an invalid response.",
        );
        return;
      }

      if (!response.ok || !result.ok) {
        setErrorMessage(
          result.message ??
            "The permissions could not be updated.",
        );
        return;
      }

      setSuccessMessage(
        result.message ??
          "The permissions were updated successfully.",
      );

      router.refresh();
    } catch {
      setErrorMessage(
        "A network error occurred. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
      submissionInProgress.current = false;
    }
  }

  const grantedCount = ALL_PERMISSIONS.filter(
    (permission) =>
      permissionStates[permission] === "grant",
  ).length;

  const deniedCount = ALL_PERMISSIONS.filter(
    (permission) =>
      permissionStates[permission] === "deny",
  ).length;

  return (
    <>
      <button
        type="button"
        onClick={openEditor}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        <ShieldCheck
          aria-hidden="true"
          className="h-4 w-4"
        />

        Edit permissions
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditor();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`permission-title-${membershipId}`}
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h2
                  id={`permission-title-${membershipId}`}
                  className="text-lg font-semibold text-slate-950"
                >
                  Custom permissions
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Choose whether each permission is inherited,
                  specifically granted, or denied.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditor}
                disabled={loading}
                aria-label="Close permission editor"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X
                  aria-hidden="true"
                  className="h-5 w-5"
                />
              </button>
            </header>

            <div className="border-b border-slate-200 bg-slate-50 px-6 py-3">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                  {grantedCount} specifically granted
                </span>

                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                  {deniedCount} specifically denied
                </span>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              aria-busy={loading}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div className="grid gap-3 md:grid-cols-2">
                  {ALL_PERMISSIONS.map((permission) => {
                    const canGrant =
                      assignablePermissions.includes(
                        permission,
                      );

                    return (
                      <div
                        key={permission}
                        className="rounded-xl border border-slate-200 bg-white p-4"
                      >
                        <label
                          htmlFor={`${membershipId}-${permission}`}
                          className="block text-sm font-semibold text-slate-800"
                        >
                          {permissionLabel(permission)}
                        </label>

                        <select
                          id={`${membershipId}-${permission}`}
                          value={
                            permissionStates[permission]
                          }
                          disabled={loading}
                          onChange={(event) =>
                            updatePermission(
                              permission,
                              event.target
                                .value as PermissionState,
                            )
                          }
                          className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                        >
                          <option value="inherit">
                            Inherit from role
                          </option>

                          <option
                            value="grant"
                            disabled={!canGrant}
                          >
                            Grant permission
                          </option>

                          <option value="deny">
                            Deny permission
                          </option>
                        </select>

                        {!canGrant ? (
                          <p className="mt-2 text-xs text-slate-400">
                            You cannot grant this permission.
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <footer className="border-t border-slate-200 bg-white px-6 py-4">
                {errorMessage ? (
                  <p
                    role="alert"
                    className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
                  >
                    {errorMessage}
                  </p>
                ) : null}

                {successMessage ? (
                  <p
                    role="status"
                    className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
                  >
                    {successMessage}
                  </p>
                ) : null}

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeEditor}
                    disabled={loading}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin"
                      />
                    ) : (
                      <Save
                        aria-hidden="true"
                        className="h-4 w-4"
                      />
                    )}

                    {loading
                      ? "Saving…"
                      : "Save permissions"}
                  </button>
                </div>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}