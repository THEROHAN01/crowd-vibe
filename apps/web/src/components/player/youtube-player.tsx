"use client";

import { useCallback } from "react";
import YouTube from "react-youtube";

interface YouTubePlayerProps {
  videoId: string;
  onEnded: () => void;
}

export default function YouTubePlayer({ videoId, onEnded }: YouTubePlayerProps) {
  const handleEnd = useCallback(() => {
    onEnded();
  }, [onEnded]);

  return (
    <div className="w-full aspect-video rounded-lg overflow-hidden bg-black">
      <YouTube
        videoId={videoId}
        opts={{
          width: "100%",
          height: "100%",
          playerVars: { autoplay: 1, controls: 1 },
        }}
        onEnd={handleEnd}
        className="w-full h-full"
        iframeClassName="w-full h-full"
      />
    </div>
  );
}
