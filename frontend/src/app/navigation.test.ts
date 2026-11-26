import { describe, expect, it } from "vitest";

import { NAV_BY_ROLE } from "./navigation";
import { paths } from "./paths";

describe("NAV_BY_ROLE", () => {
  it("shows the FAQ to patients only", () => {
    for (const [role, items] of Object.entries(NAV_BY_ROLE)) {
      const hasFaq = items.some((item) => item.to === paths.faq);
      expect(hasFaq, role).toBe(role === "patient");
    }
  });

  it("keeps the FAQ editor in the admin menu", () => {
    expect(NAV_BY_ROLE.admin.some((item) => item.to === paths.admin.faq)).toBe(true);
  });

  it("gives reception and care staff the task board", () => {
    for (const role of ["secretary", "professional", "coordinator"] as const) {
      expect(
        NAV_BY_ROLE[role].some((item) => item.to === paths.tasks),
        role,
      ).toBe(true);
    }
  });
});
