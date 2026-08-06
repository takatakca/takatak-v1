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
  CheckboxField,
  FormAlert,
  FormField,
  FormSection,
  SelectField,
} from "@/components/forms/form-controls";
import type { BrandOption } from "@/lib/brands/brand-data";
import {
  LOCATION_STATUSES,
  type LocationStatusValue,
} from "@/lib/locations/location-validation";

export interface LocationFormValues {
  businessBrandId: string;
  name: string;
  phone: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  timezone: string;
  latitude: string;
  longitude: string;
  isPrimary: boolean;
  status: LocationStatusValue;
}

type CreatedLocation = {
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
  location?: {
    id?: string;
    name?: string;
  };
};

export function LocationForm({
  mode,
  locationId,
  brands,
  initialValues,
}: {
  mode: "create" | "edit";
  locationId?: string;
  brands: BrandOption[];
  initialValues: LocationFormValues;
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
    createdLocation,
    setCreatedLocation,
  ] =
    useState<CreatedLocation | null>(
      null,
    );

  const [
    fieldErrors,
    setFieldErrors,
  ] = useState<
    Record<string, string>
  >({});

  function goToCreatedLocation() {
    if (!createdLocation) {
      return;
    }

    router.push(
      `/dashboard/locations`,
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
    setCreatedLocation(null);
    setFieldErrors({});

    const form = event.currentTarget;
    const formData =
      new FormData(form);

    const payload = {
      businessBrandId: String(
        formData.get(
          "businessBrandId",
        ) ?? "",
      ),

      name: String(
        formData.get("name") ?? "",
      ),

      phone: String(
        formData.get("phone") ?? "",
      ),

      website: String(
        formData.get("website") ?? "",
      ),

      addressLine1: String(
        formData.get(
          "addressLine1",
        ) ?? "",
      ),

      addressLine2: String(
        formData.get(
          "addressLine2",
        ) ?? "",
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
        formData.get("country") ?? "",
      ),

      timezone: String(
        formData.get("timezone") ?? "",
      ),

      latitude: String(
        formData.get("latitude") ?? "",
      ),

      longitude: String(
        formData.get("longitude") ?? "",
      ),

      isPrimary: Boolean(
        formData.get("isPrimary"),
      ),

      status: String(
        formData.get("status") ?? "",
      ),
    };

    try {
      const response = await fetch(
        mode === "create"
          ? "/api/locations"
          : `/api/locations/${encodeURIComponent(
              locationId ?? "",
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
          "The location service returned an invalid response.",
        );

        return;
      }

      if (
        !response.ok ||
        !result.ok
      ) {
        setMessage(
          result.message ??
            "The location could not be saved.",
        );

        setFieldErrors(
          result.fieldErrors ?? {},
        );

        return;
      }

      if (mode === "create") {
        const createdId =
          result.location?.id;

        const createdName =
          result.location?.name ??
          payload.name.trim();

        if (!createdId) {
          setMessage(
            "The location was created, but its location page could not be resolved.",
          );

          return;
        }

        form.reset();

        setCreatedLocation({
          id: createdId,
          name: createdName,
        });

        setSuccess(true);

        setMessage(
          `Location created successfully for ${createdName}.`,
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
          "The location was saved successfully.",
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
      {createdLocation && success ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-900">
                Location created successfully
              </p>

              <p className="mt-1 text-sm text-emerald-700">
                The location for{" "}
                <span className="font-semibold">
                  {createdLocation.name}
                </span>{" "}
                is ready.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={
                  goToCreatedLocation
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
              >
                Go to location page

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
        title="Location identity"
        description="Each physical location belongs to one brand and stays inside the active client workspace."
      >
        <SelectField
          label="Brand"
          name="businessBrandId"
          required
          defaultValue={
            initialValues.businessBrandId
          }
          error={
            fieldErrors.businessBrandId
          }
          className="sm:col-span-2"
        >
          <option value="">
            Select a brand
          </option>

          {brands.map((brand) => (
            <option
              key={brand.id}
              value={brand.id}
            >
              {brand.name}
              {brand.status !== "active"
                ? ` — ${brand.status}`
                : ""}
            </option>
          ))}
        </SelectField>

        <FormField
          ref={nameInputRef}
          label="Location name"
          name="name"
          required
          maxLength={140}
          defaultValue={
            initialValues.name
          }
          error={fieldErrors.name}
          placeholder="Downtown branch"
        />

        <SelectField
          label="Location status"
          name="status"
          required
          defaultValue={
            initialValues.status
          }
          error={fieldErrors.status}
        >
          {LOCATION_STATUSES.map(
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
          label="Phone"
          name="phone"
          type="tel"
          maxLength={40}
          defaultValue={
            initialValues.phone
          }
          error={fieldErrors.phone}
        />

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

        <CheckboxField
          name="isPrimary"
          label="Primary location"
          description="The primary location becomes the default branch for this brand. If this is the brand’s first location, it will become primary automatically."
          defaultChecked={
            initialValues.isPrimary
          }
        />
      </FormSection>

      <FormSection
        title="Physical address"
        description="This address will later support local listings, Google Business, citations, reviews, and location reports."
      >
        <FormField
          label="Address line 1"
          name="addressLine1"
          required
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
          required
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
          error={fieldErrors.timezone}
          hint="Used for location-specific publishing schedules and analytics."
          className="sm:col-span-2"
        />
      </FormSection>

      <FormSection
        title="Map coordinates"
        description="Coordinates are optional. When used, latitude and longitude must both be entered."
      >
        <FormField
          label="Latitude"
          name="latitude"
          type="number"
          step="any"
          min={-90}
          max={90}
          defaultValue={
            initialValues.latitude
          }
          error={fieldErrors.latitude}
          placeholder="45.5019"
        />

        <FormField
          label="Longitude"
          name="longitude"
          type="number"
          step="any"
          min={-180}
          max={180}
          defaultValue={
            initialValues.longitude
          }
          error={
            fieldErrors.longitude
          }
          placeholder="-73.5674"
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
              ? "Create location"
              : "Save location"}
        </button>
      </div>
    </form>
  );
}