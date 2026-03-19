"use client";

import { useCallback } from "react";
import dynamic from "next/dynamic";

const YouTube = dynamic(() => import("react-youtube").then(mod => mod.default), {
	ssr: false,
	loading: () => <div className="aspect-video w-full rounded-lg bg-background animate-pulse" />,
});

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
