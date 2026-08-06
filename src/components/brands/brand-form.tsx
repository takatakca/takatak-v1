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
  BRAND_STATUSES,
  type BrandStatusValue,
} from "@/lib/brands/brand-validation";

export interface BrandFormValues {
  name: string;
  legalName: string;
  category: string;
  website: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  timezone: string;
  status: BrandStatusValue;
}

type CreatedBrand = {
  id: string;
  name: string;
};

type ApiResponse = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<
    string,
    string
  >;
  brand?: {
    id?: string;
    name?: string;
  };
};

export function BrandForm({
  mode,
  brandId,
  initialValues,
}: {
  mode: "create" | "edit";
  brandId?: string;
  initialValues: BrandFormValues;
}) {
  const router = useRouter();

  const formRef =
    useRef<HTMLFormElement | null>(
      null,
    );

  const nameInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState(false);

  const [
    createdBrand,
    setCreatedBrand,
  ] =
    useState<CreatedBrand | null>(
      null,
    );

  const [
    fieldErrors,
    setFieldErrors,
  ] = useState<
    Record<string, string>
  >({});

  function goToCreatedBrand() {
    if (!createdBrand) {
      return;
    }

    router.push(
      `/dashboard/brands`,
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
    setCreatedBrand(null);
    setFieldErrors({});

    const form = event.currentTarget;

    const formData =
      new FormData(form);

    const payload = {
      name: String(
        formData.get("name") ?? "",
      ),

      legalName: String(
        formData.get("legalName") ??
          "",
      ),

      category: String(
        formData.get("category") ??
          "",
      ),

      website: String(
        formData.get("website") ??
          "",
      ),

      phone: String(
        formData.get("phone") ?? "",
      ),

      addressLine1: String(
        formData.get("addressLine1") ??
          "",
      ),

      addressLine2: String(
        formData.get("addressLine2") ??
          "",
      ),

      city: String(
        formData.get("city") ?? "",
      ),

      region: String(
        formData.get("region") ?? "",
      ),

      postalCode: String(
        formData.get("postalCode") ??
          "",
      ),

      country: String(
        formData.get("country") ??
          "",
      ),

      timezone: String(
        formData.get("timezone") ??
          "",
      ),

      status: String(
        formData.get("status") ?? "",
      ),
    };

    try {
      const response = await fetch(
        mode === "create"
          ? "/api/brands"
          : `/api/brands/${encodeURIComponent(
              brandId ?? "",
            )}`,
        {
          method:
            mode === "create"
              ? "POST"
              : "PATCH",

          credentials: "same-origin",

          headers: {
            Accept:
              "application/json",

            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(
            payload,
          ),
        },
      );

      let result: ApiResponse;

      try {
        result =
          (await response.json()) as ApiResponse;
      } catch {
        setMessage(
          "The brand service returned an invalid response.",
        );

        return;
      }

      if (
        !response.ok ||
        !result.ok
      ) {
        setMessage(
          result.message ??
            "The brand could not be saved.",
        );

        setFieldErrors(
          result.fieldErrors ?? {},
        );

        return;
      }

      if (mode === "create") {
        const createdId =
          result.brand?.id;

        const createdName =
          result.brand?.name ??
          payload.name.trim();

        if (!createdId) {
          setMessage(
            "The brand was created, but its brand page could not be resolved.",
          );

          return;
        }

        form.reset();

        setCreatedBrand({
          id: createdId,
          name: createdName,
        });

        setSuccess(true);

        setMessage(
          `Brand created successfully for ${createdName}.`,
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
          "The brand was saved successfully.",
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
      {createdBrand && success ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-900">
                Brand created successfully
              </p>

              <p className="mt-1 text-sm text-emerald-700">
                The brand for{" "}
                <span className="font-semibold">
                  {createdBrand.name}
                </span>{" "}
                is ready. The form has been cleared.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={
                  goToCreatedBrand
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
              >
                Go to brand

                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      ) : message ? (
        <FormAlert
          tone={
            success
              ? "success"
              : "error"
          }
        >
          {message}
        </FormAlert>
      ) : null}

      <FormSection
        title="Brand identity"
        description="This brand will own future social accounts, campaigns, content, analytics, and reports."
      >
        <FormField
          ref={nameInputRef}
          label="Brand name"
          name="name"
          required
          maxLength={120}
          defaultValue={
            initialValues.name
          }
          error={fieldErrors.name}
        />

        <FormField
          label="Legal name"
          name="legalName"
          maxLength={180}
          defaultValue={
            initialValues.legalName
          }
          error={
            fieldErrors.legalName
          }
        />

        <FormField
          label="Category"
          name="category"
          maxLength={120}
          defaultValue={
            initialValues.category
          }
          error={
            fieldErrors.category
          }
          placeholder="Restaurant, agency, retailer…"
        />

        <SelectField
          label="Brand status"
          name="status"
          required
          defaultValue={
            initialValues.status
          }
          error={fieldErrors.status}
        >
          {BRAND_STATUSES.map(
            (status) => (
              <option
                key={status}
                value={status}
              >
                {status}
              </option>
            ),
          )}
        </SelectField>

        <FormField
          label="Website"
          name="website"
          type="url"
          maxLength={2048}
          defaultValue={
            initialValues.website
          }
          error={fieldErrors.website}
          placeholder="https://example.com"
        />

        <FormField
          label="Phone"
          name="phone"
          type="tel"
          maxLength={40}
          defaultValue={
            initialValues.phone
          }
          error={fieldErrors.phone}
        />
      </FormSection>

      <FormSection
        title="Default business address"
        description="This is the brand-level address. Physical branches will be managed separately as locations."
      >
        <FormField
          label="Address line 1"
          name="addressLine1"
          maxLength={180}
          defaultValue={
            initialValues.addressLine1
          }
          error={
            fieldErrors.addressLine1
          }
          className="sm:col-span-2"
        />

        <FormField
          label="Address line 2"
          name="addressLine2"
          maxLength={180}
          defaultValue={
            initialValues.addressLine2
          }
          error={
            fieldErrors.addressLine2
          }
          className="sm:col-span-2"
        />

        <FormField
          label="City"
          name="city"
          maxLength={100}
          defaultValue={
            initialValues.city
          }
          error={fieldErrors.city}
        />

        <FormField
          label="Province or region"
          name="region"
          maxLength={100}
          defaultValue={
            initialValues.region
          }
          error={fieldErrors.region}
        />

        <FormField
          label="Postal code"
          name="postalCode"
          maxLength={30}
          defaultValue={
            initialValues.postalCode
          }
          error={
            fieldErrors.postalCode
          }
        />

        <FormField
          label="Country"
          name="country"
          required
          maxLength={100}
          defaultValue={
            initialValues.country
          }
          error={fieldErrors.country}
        />

        <FormField
          label="Timezone"
          name="timezone"
          required
          maxLength={100}
          defaultValue={
            initialValues.timezone
          }
          error={
            fieldErrors.timezone
          }
          hint="Used later for scheduling and analytics cutoffs."
          className="sm:col-span-2"
        />
      </FormSection>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={() =>
            router.back()
          }
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
              ? "Create brand"
              : "Save brand"}
        </button>
      </div>
    </form>
  );
}