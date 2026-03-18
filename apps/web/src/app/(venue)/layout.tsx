import { auth } from "@crowd-vibe/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function VenueLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user) {
		redirect("/login");
	}

	return <>{children}</>;
}
