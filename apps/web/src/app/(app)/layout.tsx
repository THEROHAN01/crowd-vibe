import Header from "@/components/header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="grid h-svh grid-rows-[auto_1fr_auto] overflow-x-hidden">
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
			>
				Skip to main content
			</a>
			<Header />
			<div id="main-content" className="min-h-0 overflow-y-auto">
				{children}
			</div>
			<footer className="border-border border-t px-4 py-3 text-center text-muted-foreground text-xs">
				Made with <span className="text-primary">&#9829;</span> by Rohan
				Salunkhe
			</footer>
		</div>
	);
}
