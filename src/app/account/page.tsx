import { redirect } from "next/navigation";
import { AccountSettings } from "@/components/auth/AccountSettings";
import { getOptionalAuthenticatedUser } from "@/lib/auth/require-user";

export default async function AccountPage() {
  const user = await getOptionalAuthenticatedUser();
  if (!user) redirect("/auth/login?next=/account");

  return (
    <AccountSettings
      email={user.email ?? ""}
      displayName={typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : ""}
    />
  );
}
