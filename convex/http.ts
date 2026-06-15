import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// Dev-only test data seeder — not available in production.
http.route({
  path: "/test/setup",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (process.env.CONVEX_ENV === "production") {
      return new Response("Forbidden", { status: 403 });
    }

    const body = (await request.json()) as { email?: string; secret?: string };
    const expectedSecret = process.env.TEST_SETUP_SECRET ?? "test-local-secret";
    if (body.secret !== expectedSecret) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (!body.email) {
      return new Response("Missing email", { status: 400 });
    }

    const result = await ctx.runMutation(internal.testHelpers.setupTestUser, {
      email: body.email,
    });

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// Dev-only: seed a disposable operator (Convex-only) for the delete-account
// E2E test. Not available in production.
http.route({
  path: "/test/seed-operator",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (process.env.CONVEX_ENV === "production") {
      return new Response("Forbidden", { status: 403 });
    }

    const body = (await request.json()) as {
      ownerEmail?: string;
      secret?: string;
    };
    const expectedSecret = process.env.TEST_SETUP_SECRET ?? "test-local-secret";
    if (body.secret !== expectedSecret) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (!body.ownerEmail) {
      return new Response("Missing ownerEmail", { status: 400 });
    }

    const result = await ctx.runMutation(
      internal.testHelpers.seedDisposableOperator,
      { ownerEmail: body.ownerEmail }
    );

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
