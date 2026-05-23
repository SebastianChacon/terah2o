// Clerk JWT issuer domain para verificación de tokens en Convex.
// Convex fetches JWKS de {domain}/.well-known/jwks.json automáticamente.
// Env var en Convex Dashboard: CLERK_JWT_ISSUER_DOMAIN = https://winning-cat-0.clerk.accounts.dev
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
