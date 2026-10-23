import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthNav } from "@/components/auth/AuthNav";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
const signOut = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/supabase/browser", () => ({ createBrowserSupabaseClient: () => ({ auth: { signOut } }) }));

describe("account navigation", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("shows sign in and registration to visitors", () => {
    render(<AuthNav />);
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/auth/login");
    expect(screen.getByRole("link", { name: "Create account" }).getAttribute("href")).toBe("/auth/register");
  });

  it("opens account actions and signs out", async () => {
    signOut.mockResolvedValue({ error: null });
    render(<AuthNav email="learner@example.com" displayName="Learner" />);
    fireEvent.click(screen.getByText("Learner"));
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
    expect(screen.getByRole("link", { name: "Profile & security" }).getAttribute("href")).toBe("/account");
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(router.refresh).toHaveBeenCalled();
  });

  it("keeps the menu available if sign out fails", async () => {
    signOut.mockResolvedValue({ error: new Error("Network unavailable") });
    render(<AuthNav email="learner@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Network unavailable"));
    expect(router.replace).not.toHaveBeenCalled();
  });
});
