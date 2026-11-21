import { redirect } from "next/navigation";

// Settings live on the account settings screen (profile, security, language).
// One screen, not two; old links still land in the right place.
export default function SettingsPage() {
  redirect("/dashboard/profile");
}
