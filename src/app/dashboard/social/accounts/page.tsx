import { redirect } from "next/navigation";

export default function SocialAccountsPage() {
  redirect(
    "/dashboard/social?connections=open",
  );
}
