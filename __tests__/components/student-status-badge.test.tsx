/**
 * Locks the student-facing status vocabulary. The `returned` status is what a
 * student sees after a teacher sends their writing back with comments; the
 * label reads "Feedback" (not "Needs Revision") so the cue is what they
 * received, not a verdict. See components/student/status-badge.tsx.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  StatusBadge,
  statusLabel,
} from "@/components/student/status-badge";

describe("student StatusBadge — returned reads as 'Feedback'", () => {
  it("statusLabel('returned') is 'Feedback'", () => {
    expect(statusLabel("returned")).toBe("Feedback");
  });

  it("renders 'Feedback' (not 'Needs Revision') for a returned writing", () => {
    render(<StatusBadge status="returned" />);
    expect(screen.getByText("Feedback")).toBeInTheDocument();
    expect(screen.queryByText(/Needs Revision/i)).not.toBeInTheDocument();
  });

  it("leaves the other statuses unchanged", () => {
    expect(statusLabel("not_started")).toBe("Not Started");
    expect(statusLabel("in_progress")).toBe("In Progress");
    expect(statusLabel("submitted")).toBe("Submitted");
    expect(statusLabel("graded")).toBe("Graded");
  });
});
