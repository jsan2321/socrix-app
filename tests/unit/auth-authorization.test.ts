import { afterEach, describe, expect, it, vi } from "vitest";

const getUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser } }),
}));

import { isTestAuthBypassEnabled, requireAuthenticatedUser } from "@/lib/auth/require-user";
import { UnauthorizedError } from "@/lib/errors";

describe("authenticated API boundary", () => {
  afterEach(() => {
    process.env.AUTH_TEST_BYPASS = "true";
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns the verified Supabase user", async () => {
    process.env.AUTH_TEST_BYPASS = "false";
    const user = { id: "550e8400-e29b-41d4-a716-446655440000", email: "learner@example.com" };
    getUser.mockResolvedValue({ data: { user }, error: null });
    await expect(requireAuthenticatedUser()).resolves.toEqual(user);
  });

  it("normalizes a missing user to 401", async () => {
    process.env.AUTH_TEST_BYPASS = "false";
    getUser.mockResolvedValue({ data: { user: null }, error: new Error("JWT expired") });
    await expect(requireAuthenticatedUser()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("never allows AUTH_TEST_BYPASS when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_TEST_BYPASS", "true");
    expect(isTestAuthBypassEnabled()).toBe(false);

    getUser.mockResolvedValue({ data: { user: null }, error: new Error("Unauthorized") });
    await expect(requireAuthenticatedUser()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
