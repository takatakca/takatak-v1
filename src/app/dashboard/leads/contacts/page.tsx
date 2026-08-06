// Alias route: the Phase 12 module built the lead inbox at
// /dashboard/leads/inbox; /contacts is kept as a safe permanent alias.
import { redirect } from "next/navigation";

export default function LeadContactsAliasPage() {
  redirect("/dashboard/leads/inbox");
}
