"use server";

import { revalidatePath } from "next/cache";

import { getPrisma } from "@/lib/db/prisma";
import { QMAPS_BUSINESS_ID, linkMessage, linkStateFor, qmapsLinkMetadata } from "@/lib/qmaps/bridge";
import { postQmaps } from "@/lib/qmaps/remote";
import { requireAdminAccess } from "@/lib/security/guard";

const PATH = "/dashboard/admin/qmaps";

export type QmapsLinkFormState =
  | { ok: null }
  | { ok: true; message: string; confirmed: boolean }
  | { ok: false; error: string };

function text(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

export async function linkQmapsWorkspaceAction(
  _prev: QmapsLinkFormState,
  formData: FormData,
): Promise<QmapsLinkFormState> {
  await requireAdminAccess();
  const prisma = getPrisma();
  if (!prisma) return { ok: false, error: "La base TAKATAK n'est pas configurée." };

  const clientId = text(formData.get("clientId"), 80);
  const businessId = text(formData.get("businessId"), 80);
  const name = text(formData.get("name"), 160);
  const city = text(formData.get("city"), 80);
  if (!QMAPS_BUSINESS_ID.test(clientId)) return { ok: false, error: "Choisissez un espace client." };
  if (!QMAPS_BUSINESS_ID.test(businessId)) return { ok: false, error: "L'identifiant QMAPS doit être un UUID." };
  if (!name) return { ok: false, error: "Indiquez le nom de la fiche." };

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return { ok: false, error: "Cet espace client n'existe pas." };

  const remote = await postQmaps("takatak-link-business", { businessId, clientId });
  const linkState = linkStateFor(remote);
  const metadata = qmapsLinkMetadata(businessId, linkState);
  const existing = await prisma.localListing.findFirst({
    where: {
      clientId,
      provider: "qmaps",
      metadata: { path: ["qmapsBusinessId"], equals: businessId },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.localListing.update({
      where: { id: existing.id },
      data: { name, city: city || null, metadata },
    });
  } else {
    await prisma.localListing.create({
      data: {
        clientId,
        provider: "qmaps",
        name,
        platformName: "QMAPS",
        city: city || null,
        status: "planned",
        metadata,
      },
    });
  }

  revalidatePath(PATH);
  revalidatePath("/dashboard/local-listings/listings");
  return { ok: true, confirmed: remote.ok, message: linkMessage(remote) };
}
