"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@crowd-vibe/ui/components/button";

interface QRDisplayProps {
  joinCode: string;
}

export default function QRDisplay({ joinCode }: QRDisplayProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/join/${joinCode}`);
  }, [joinCode]);

  const downloadQR = useCallback(() => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `crowdvibe-${joinCode}.png`;
    a.click();
  }, [joinCode]);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(joinUrl);
  }, [joinUrl]);

  if (!joinUrl) {
    return <div className="flex items-center justify-center p-8 border rounded-lg">Loading QR code...</div>;
  }

  return (
    <div className="flex flex-col items-center gap-4 p-4 border rounded-lg">
      <div ref={canvasRef}>
        <QRCodeCanvas value={joinUrl} size={200} />
      </div>
      <p className="font-mono text-lg font-bold">{joinCode}</p>
      <p className="text-sm text-muted-foreground break-all">{joinUrl}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={downloadQR}>
          Download QR
        </Button>
        <Button variant="outline" size="sm" onClick={copyLink}>
          Copy Link
        </Button>
      </div>
    </div>
  );
}
