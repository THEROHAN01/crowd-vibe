import { auth } from "@crowd-vibe/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Dashboard from "./dashboard";

export default async function DashboardPage() {
  // Layout already guards auth, but we need session data for props
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // This shouldn't happen (layout redirects), but TypeScript needs it
  if (!session?.user) {
    redirect("/login");
  }

  return <Dashboard userId={session.user.id} userName={session.user.name} />;
}
