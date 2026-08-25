import { redirect } from "next/navigation";

export default function OtpRedirectPage() {
  redirect("/register/verify");
}
