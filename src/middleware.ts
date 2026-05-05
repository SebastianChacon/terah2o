// Next.js middleware entrypoint — must be in this exact file.
// Auth + subscription guard logic lives in proxy.ts.
export { proxy as default, config } from "./proxy";
