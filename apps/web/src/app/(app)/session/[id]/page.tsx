import SessionView from "./session-view";

export default async function SessionPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	return <SessionView sessionId={id} />;
}
