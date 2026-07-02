/**
 * Filter + count logic for the super-admin cross-district Users view.
 * Locks the search / role-filter / district-filter behavior and the stat-card
 * counts, since those are the only real logic in an otherwise presentational
 * read-only table.
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { AllUsersView } from "@/app/admin/users/all-users-view";
import type { AllUserRow } from "@/lib/queries/all-users";

const USERS: AllUserRow[] = [
  { id: "1", firstName: "Sam", lastName: "Super", email: "sam@x.test", role: "super_admin", districtName: null, schoolName: null, createdAt: "2026-01-01" },
  { id: "2", firstName: "Dana", lastName: "Dist", email: "dana@a.test", role: "district_admin", districtName: "Alpha ISD", schoolName: null, createdAt: "2026-01-02" },
  { id: "3", firstName: "Tara", lastName: "Teach", email: "tara@a.test", role: "teacher", districtName: "Alpha ISD", schoolName: "Alpha High", createdAt: "2026-01-03" },
  { id: "4", firstName: "Ben", lastName: "Beta", email: "ben@b.test", role: "student", districtName: "Beta USD", schoolName: "Beta Middle", createdAt: "2026-01-04" },
];
const DISTRICTS = ["Alpha ISD", "Beta USD"];

const rowCount = () =>
  within(screen.getByRole("table")).getAllByRole("row").length - 1; // minus header

function renderView() {
  return render(<AllUsersView users={USERS} districts={DISTRICTS} />);
}

describe("AllUsersView — cross-district filtering", () => {
  it("shows every user by default and counts admins across all admin roles", () => {
    renderView();
    expect(rowCount()).toBe(4);
    // Admins card = super_admin + district_admin (2 here). Scope to the stat
    // label <p> ("Districts" also appears in the header prose as a <span>).
    expect(
      screen.getByText("Admins", { selector: "p" }).closest("div")?.textContent
    ).toContain("2");
    // Districts card = distinct district count (2).
    expect(
      screen.getByText("Districts", { selector: "p" }).closest("div")?.textContent
    ).toContain("2");
  });

  it("filters by name/email search", () => {
    renderView();
    fireEvent.change(screen.getByLabelText("Search users"), {
      target: { value: "tara" },
    });
    expect(rowCount()).toBe(1);
    expect(screen.getByText("Tara Teach")).toBeTruthy();
  });

  it("filters by role", () => {
    renderView();
    fireEvent.change(screen.getByLabelText("Filter by role"), {
      target: { value: "super_admin" },
    });
    expect(rowCount()).toBe(1);
    expect(screen.getByText("Sam Super")).toBeTruthy();
  });

  it("filters by district", () => {
    renderView();
    fireEvent.change(screen.getByLabelText("Filter by district"), {
      target: { value: "Alpha ISD" },
    });
    expect(rowCount()).toBe(2); // Dana + Tara
  });

  it("'No district' isolates districtless super admins", () => {
    renderView();
    fireEvent.change(screen.getByLabelText("Filter by district"), {
      target: { value: "__none__" },
    });
    expect(rowCount()).toBe(1);
    expect(screen.getByText("Sam Super")).toBeTruthy();
  });
});
