import { redirect } from "next/navigation";

type SearchParams = Promise<{ email?: string; next?: string }>;

export default async function VerifyRegistrationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const otpUrl = new URL("/otp", "http://takatak.local");

  if (params.email) {
    otpUrl.searchParams.set("email", params.email);
  }

  if (params.next) {
    otpUrl.searchParams.set("next", params.next);
  }

  redirect(`${otpUrl.pathname}${otpUrl.search}`);
}
