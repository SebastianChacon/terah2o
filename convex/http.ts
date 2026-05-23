import { httpRouter } from "convex/server";

// Con Clerk, no se necesitan rutas HTTP de auth.
// @convex-dev/auth usaba auth.addHttpRoutes(http) para callbacks OAuth y email.
// Clerk maneja todo esto externamente (sus propios endpoints).
const http = httpRouter();

export default http;
