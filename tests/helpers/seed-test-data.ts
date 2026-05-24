/**
 * Calls the Convex dev-only HTTP action to seed org + subscription for a test user.
 * Idempotent — safe to call in beforeAll.
 */
export async function seedTestData(email: string): Promise<void> {
  // HTTP actions are served at convex.site, not convex.cloud
  const convexSiteUrl =
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
    process.env.NEXT_PUBLIC_CONVEX_URL?.replace("convex.cloud", "convex.site") ??
    "https://clear-albatross-368.convex.site";
  const secret = process.env.TEST_SETUP_SECRET ?? "test-local-secret";

  const res = await fetch(`${convexSiteUrl}/test/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, secret }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`seedTestData failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { error?: string; success?: boolean };
  if (data.error) throw new Error(`seedTestData error: ${data.error}`);
}
