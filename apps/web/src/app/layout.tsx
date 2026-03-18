import type { Metadata } from "next";
import { DM_Sans, Geist_Mono, Space_Grotesk } from "next/font/google";

import "../index.css";
import Header from "@/components/header";
import Providers from "@/components/providers";

const dmSans = DM_Sans({
	subsets: ["latin"],
	variable: "--font-sans",
	display: "swap",
});

const spaceGrotesk = Space_Grotesk({
	subsets: ["latin"],
	variable: "--font-heading",
	display: "swap",
});

const geistMono = Geist_Mono({
	subsets: ["latin"],
	variable: "--font-mono",
	display: "swap",
});

export const metadata: Metadata = {
	title: "CrowdVibe — Crowd-Controlled Music",
	description:
		"Let the crowd control the vibe. Vote on songs in real-time at your favorite venues.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body
				className={`${dmSans.variable} ${spaceGrotesk.variable} ${geistMono.variable} antialiased`}
			>
				<Providers>
					<div className="grid h-svh grid-rows-[auto_1fr_auto]">
						<a
							href="#main-content"
							className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
						>
							Skip to main content
						</a>
						<Header />
						<div id="main-content">{children}</div>
						<footer className="border-border border-t px-4 py-3 text-center text-muted-foreground text-xs">
							Made with <span className="text-primary">&#9829;</span> by Rohan Salunkhe
						</footer>
					</div>
				</Providers>
			</body>
		</html>
	);
}
