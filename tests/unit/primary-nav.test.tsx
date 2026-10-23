import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrimaryNav } from "@/components/navigation/PrimaryNav";

const route = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

describe("primary navigation", () => {
  beforeEach(() => { route.pathname = "/"; });

  it("does not show private destinations to visitors", () => {
    render(<PrimaryNav authenticated={false} />);
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
    expect(screen.queryByRole("link", { name: "New session" })).toBeNull();
  });

  it.each(["/", "/dashboard", "/upload"])("avoids a duplicate session action on %s", (pathname) => {
    route.pathname = pathname;
    render(<PrimaryNav authenticated />);
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.queryByRole("link", { name: "New session" })).toBeNull();
  });

  it.each(["/account", "/quiz/session-1", "/results/session-1"])("offers a new session shortcut on %s", (pathname) => {
    route.pathname = pathname;
    render(<PrimaryNav authenticated />);
    expect(screen.getByRole("link", { name: "New session" }).getAttribute("href")).toBe("/upload");
  });

  it("marks dashboard as the current page", () => {
    route.pathname = "/dashboard";
    render(<PrimaryNav authenticated />);
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBe("page");
  });
});
