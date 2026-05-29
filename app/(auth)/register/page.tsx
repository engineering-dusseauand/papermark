import { redirect } from "next/navigation";

// Sign-ups are disabled. Redirect any visits to /register over to /login.
export default function RegisterPage() {
  redirect("/login");
}
