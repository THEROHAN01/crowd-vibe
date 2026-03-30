"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";

const YouTube = dynamic(
	() => import("react-youtube").then((mod) => mod.default),
	{
		ssr: false,
		loading: () => (
			<div className="aspect-video w-full animate-pulse rounded-lg bg-background" />
		),
	},
);

interface YouTubePlayerProps {
	videoId: string;
	onEnded: () => void;
}

export default function YouTubePlayer({
	videoId,
	onEnded,
}: YouTubePlayerProps) {
	const handleEnd = useCallback(() => {
		onEnded();
	}, [onEnded]);

	return (
		<div className="aspect-video w-full overflow-hidden rounded-lg bg-background">
			<YouTube
				videoId={videoId}
				opts={{
					width: "100%",
					height: "100%",
					playerVars: { autoplay: 1, controls: 1 },
				}}
				onEnd={handleEnd}
				className="h-full w-full"
				iframeClassName="w-full h-full"
			/>
		</div>
	);
}
