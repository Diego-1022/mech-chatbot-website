// Set at build time. Never select an authentication method from request headers.
export const standalone = import.meta.env.VITE_DEPLOYMENT_TARGET === "cloudflare";
