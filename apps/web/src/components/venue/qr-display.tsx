"use client";

import { Button } from "@crowd-vibe/ui/components/button";
import { QRCodeCanvas } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";

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
		if (joinUrl) navigator.clipboard.writeText(joinUrl);
	}, [joinUrl]);

	if (!joinUrl) {
		return (
			<div className="flex items-center justify-center rounded-lg border border-primary/20 p-8 shadow-lg shadow-primary/5">
				Loading QR code...
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center gap-4 rounded-lg border border-primary/20 p-4 shadow-lg shadow-primary/5">
			<div ref={canvasRef}>
				<QRCodeCanvas value={joinUrl} size={200} />
			</div>
			<p className="font-bold font-mono text-2xl tracking-widest">{joinCode}</p>
			<p className="break-all text-muted-foreground text-sm">{joinUrl}</p>
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
