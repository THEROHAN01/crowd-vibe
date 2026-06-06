"use client";

import { Component, type ReactNode } from "react";

interface Props {
	fallback?: ReactNode;
	children: ReactNode;
}

interface State {
	hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
	state: State = { hasError: false };

	static getDerivedStateFromError(): State {
		return { hasError: true };
	}

	render() {
		if (this.state.hasError) {
			return (
				this.props.fallback ?? (
					<div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
						<p className="text-muted-foreground text-sm">
							Something went wrong. Pull down to refresh.
						</p>
						<button
							type="button"
							className="text-primary text-sm underline underline-offset-2"
							onClick={() => this.setState({ hasError: false })}
						>
							Try again
						</button>
					</div>
				)
			);
		}
		return this.props.children;
	}
}
