import "@crowd-vibe/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	images: {
		remotePatterns: [
			{ protocol: "https", hostname: "i.ytimg.com" },
			{ protocol: "https", hostname: "img.youtube.com" },
		],
	},
};

export default nextConfig;
