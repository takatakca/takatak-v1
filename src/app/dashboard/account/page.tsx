import { redirect } from "next/navigation";

/** Keep older account-verification links functional after route rename. */
export default function LegacyAccountPage() {
  redirect("/dashboard/profile");
}
