/**
 * Guards the source-file archival contract that the assignment-view (and
 * future annotate-step) faithful render depends on:
 *   - when an assignmentId is present, the picked file is uploaded and its
 *     stored path is reported to the parent (so source_file_path persists);
 *   - when archival fails, the failure is surfaced (not silently swallowed),
 *     while extraction still succeeds.
 *
 * Uses a .txt file so extractSource takes the local-read path (no dynamic
 * pdf.js/mammoth import to mock).
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/storage/assignment-sources", () => ({
  uploadAssignmentSource: vi.fn(),
}));

import { uploadAssignmentSource } from "@/lib/storage/assignment-sources";
import { SourceTextUpload } from "@/components/assignments/source-text-upload";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakeSupabase = {} as any;

function txt(content: string) {
  const f = new File([content], "src.txt", { type: "text/plain" });
  // jsdom in this env doesn't implement Blob.text(); provide it so the real
  // extractSource txt path runs.
  Object.defineProperty(f, "text", {
    value: async () => content,
    configurable: true,
  });
  return f;
}

function pickFile(file: File) {
  const input = screen.getByLabelText(/Upload a PDF/i) as HTMLInputElement;
  // jsdom: input.files is read-only; define it before firing change.
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

function pick(content: string) {
  pickFile(txt(content));
}

function png(name = "cartoon.png") {
  return new File([new Uint8Array([137, 80, 78, 71])], name, {
    type: "image/png",
  });
}

describe("SourceTextUpload — archival contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uploads the file and reports the stored path when an assignmentId is present", async () => {
    (uploadAssignmentSource as Mock).mockResolvedValue({
      ok: true,
      path: "school-s/assignment-a1/123-src.txt",
    });
    const onExtracted = vi.fn();
    render(
      <SourceTextUpload
        assignmentId="a1"
        schoolId="s"
        supabase={fakeSupabase}
        onExtracted={onExtracted}
      />
    );

    pick("hello world");

    await waitFor(() => expect(onExtracted).toHaveBeenCalled());
    expect(uploadAssignmentSource).toHaveBeenCalledTimes(1);
    expect(onExtracted.mock.calls[0][0].file).toMatchObject({
      path: expect.stringContaining("assignment-a1"),
      name: "src.txt",
    });
  });

  it("surfaces an error but still extracts when archival fails", async () => {
    (uploadAssignmentSource as Mock).mockResolvedValue({
      ok: false,
      error: "permission denied",
    });
    const onExtracted = vi.fn();
    render(
      <SourceTextUpload
        assignmentId="a1"
        schoolId="s"
        supabase={fakeSupabase}
        onExtracted={onExtracted}
      />
    );

    pick("hello world");

    await waitFor(() => expect(onExtracted).toHaveBeenCalled());
    // Extraction still flows through; the file ref is null (not archived).
    expect(onExtracted.mock.calls[0][0].file).toBeNull();
    // The failure is visible, not swallowed.
    expect(
      await screen.findByText(/archiving the original file failed/i)
    ).toBeInTheDocument();
  });

  it("does not upload when no assignmentId is available", async () => {
    const onExtracted = vi.fn();
    render(
      <SourceTextUpload
        schoolId="s"
        supabase={fakeSupabase}
        onExtracted={onExtracted}
      />
    );

    pick("hello world");

    await waitFor(() => expect(onExtracted).toHaveBeenCalled());
    expect(uploadAssignmentSource).not.toHaveBeenCalled();
    expect(onExtracted.mock.calls[0][0].file).toBeNull();
  });
});

describe("SourceTextUpload — image sources", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves a .png to image mode with no substrate, and archives it", async () => {
    (uploadAssignmentSource as Mock).mockResolvedValue({
      ok: true,
      path: "school-s/assignment-a1/123-cartoon.png",
    });
    const onExtracted = vi.fn();
    render(
      <SourceTextUpload
        assignmentId="a1"
        schoolId="s"
        supabase={fakeSupabase}
        onExtracted={onExtracted}
      />
    );

    pickFile(png());

    await waitFor(() => expect(onExtracted).toHaveBeenCalled());
    const payload = onExtracted.mock.calls[0][0];
    expect(payload.renderMode).toBe("image");
    // No text and no html: nothing may index offsets into a picture.
    expect(payload.text).toBe("");
    expect(payload.html).toBeNull();
    expect(payload.file).toMatchObject({ name: "cartoon.png" });
  });

  it("warns that an image can't be highlighted, without blocking the save", async () => {
    (uploadAssignmentSource as Mock).mockResolvedValue({
      ok: true,
      path: "school-s/assignment-a1/123-cartoon.png",
    });
    const onExtracted = vi.fn();
    render(
      <SourceTextUpload
        assignmentId="a1"
        schoolId="s"
        supabase={fakeSupabase}
        onExtracted={onExtracted}
      />
    );

    pickFile(png());

    expect(await screen.findByText(/can't highlight it/i)).toBeInTheDocument();
    // Warning only — the payload still reaches the parent.
    expect(onExtracted).toHaveBeenCalled();
  });

  it("calls a failed image archive fatal (there is no text to fall back on)", async () => {
    (uploadAssignmentSource as Mock).mockResolvedValue({
      ok: false,
      error: "permission denied",
    });
    render(
      <SourceTextUpload
        assignmentId="a1"
        schoolId="s"
        supabase={fakeSupabase}
        onExtracted={vi.fn()}
      />
    );

    pickFile(png());

    expect(
      await screen.findByText(/no extracted text to fall back on/i)
    ).toBeInTheDocument();
  });

  it("accepts .jpg by extension even when the browser reports no MIME type", async () => {
    (uploadAssignmentSource as Mock).mockResolvedValue({
      ok: true,
      path: "school-s/assignment-a1/123-photo.jpg",
    });
    const onExtracted = vi.fn();
    render(
      <SourceTextUpload
        assignmentId="a1"
        schoolId="s"
        supabase={fakeSupabase}
        onExtracted={onExtracted}
      />
    );

    pickFile(new File([new Uint8Array([255, 216])], "photo.jpg", { type: "" }));

    await waitFor(() => expect(onExtracted).toHaveBeenCalled());
    expect(onExtracted.mock.calls[0][0].renderMode).toBe("image");
  });
});
