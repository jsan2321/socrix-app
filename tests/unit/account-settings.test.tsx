import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSettings } from "@/components/auth/AccountSettings";

const updateUser = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/supabase/browser", () => ({ createBrowserSupabaseClient: () => ({ auth: { updateUser } }) }));

describe("account settings", () => {
  beforeEach(() => { vi.clearAllMocks(); updateUser.mockResolvedValue({ error: null }); });

  it("updates the display name and refreshes the header", async () => {
    render(<AccountSettings email="learner@example.com" displayName="Learner" />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ data: { display_name: "New name" } }));
    expect(refresh).toHaveBeenCalled();
  });

  it("rejects mismatched passwords without sending an update", async () => {
    render(<AccountSettings email="learner@example.com" displayName="Learner" />);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "somethingelse" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("do not match"));
    expect(updateUser).not.toHaveBeenCalled();
  });
});
