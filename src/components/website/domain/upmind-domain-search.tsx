"use client";

import { UpmindDac } from "@/components/website/domain/upmind-dac";

export function UpmindDomainSearch({
  clientId,
}: {
  clientId?: string | null;
}) {
  return (
    <UpmindDac
      clientId={clientId ?? null}
    />
  );
}