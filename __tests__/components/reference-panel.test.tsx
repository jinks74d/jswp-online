/**
 * ReferencePanel is the read-only source column on every step after Read &
 * Annotate — t-chart, gather-cds, cm-dev, decisions, elaboration and
 * topic-sentence-dev all mount it. It had no tests.
 *
 * The case that matters is viewer SELECTION. Read & Annotate branches
 * image → PdfSourceViewer → SourceTextViewer; this panel used to branch only
 * image → SourceTextViewer, so a student read the real document while
 * annotating and a flat wall of extracted text on every step afterwards. The
 * assertions below pin all four modes against that regression.
 *
 * Both viewers are mocked. PdfSourceViewer pulls in pdfjs-dist and paints to a
 * canvas, which jsdom has no answer for — and the question here is which
 * component gets chosen, not how either one renders.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ReferencePanel, type ReferenceSource } from "@/components/student/writing/reference-panel";

vi.mock("@/components/student/writing/pdf-source-viewer", () => ({
  PdfSourceViewer: ({ fileUrl }: { fileUrl: string }) => (
    <div data-testid="pdf-viewer">{fileUrl}</div>
  ),
}));

vi.mock("@/components/student/writing/source-text-viewer", () => ({
  SourceTextViewer: ({ sourceText }: { sourceText: string }) => (
    <div data-testid="text-viewer">{sourceText}</div>
  ),
}));

vi.mock("@/components/student/writing/open-original-button", () => ({
  OpenOriginalButton: () => <button type="button">Open original</button>,
}));

const getUrl = vi.fn();
vi.mock("@/lib/actions/source-files", () => ({
  getWritingSourceUrlByPath: (...args: unknown[]) => getUrl(...args),
}));

const BASE: ReferenceSource = {
  sourceId: "src-1",
  kind: "primary",
  sourceText: "Every year, eight million metric tons of plastic enter the ocean.",
  sourceTitle: "The Cost of Convenience",
  sourceAuthor: null,
  sourceFilePath: null,
  sourceFileName: null,
  sourceHtml: null,
  sourceRenderMode: "plain",
};

const renderPanel = (source: Partial<ReferenceSource>) =>
  render(
    <ReferencePanel
      writingId="w-1"
      sources={[{ ...BASE, ...source }]}
      annotations={[]}
    />
  );

beforeEach(() => {
  getUrl.mockReset();
  getUrl.mockResolvedValue({ ok: true, url: "https://signed.example/doc.pdf" });
});

describe("ReferencePanel — viewer selection", () => {
  it("renders a PDF source in the PDF viewer, the same one Read & Annotate uses", async () => {
    renderPanel({ sourceRenderMode: "pdf", sourceFilePath: "school-1/a.pdf" });

    await waitFor(() =>
      expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument()
    );
    expect(screen.getByTestId("pdf-viewer")).toHaveTextContent(
      "https://signed.example/doc.pdf"
    );
    expect(screen.queryByTestId("text-viewer")).not.toBeInTheDocument();
    expect(getUrl).toHaveBeenCalledWith("w-1", "school-1/a.pdf");
  });

  it("falls back to the text viewer when a PDF source has no stored file", async () => {
    // Not hypothetical: a PDF extracted to text with source_file_path NULL is
    // in the live data. Read & Annotate requires the path too, so both screens
    // must agree and show the extracted text.
    renderPanel({ sourceRenderMode: "pdf", sourceFilePath: null });

    await waitFor(() =>
      expect(screen.getByTestId("text-viewer")).toBeInTheDocument()
    );
    expect(screen.queryByTestId("pdf-viewer")).not.toBeInTheDocument();
    expect(getUrl).not.toHaveBeenCalled();
  });

  it("falls back to the text viewer when the PDF will not load", async () => {
    getUrl.mockResolvedValue({ ok: false });
    renderPanel({ sourceRenderMode: "pdf", sourceFilePath: "school-1/a.pdf" });

    await waitFor(() =>
      expect(screen.getByTestId("text-viewer")).toBeInTheDocument()
    );
    expect(screen.queryByTestId("pdf-viewer")).not.toBeInTheDocument();
  });

  it("renders plain and rich sources in the text viewer", async () => {
    for (const mode of ["plain", "rich"] as const) {
      const { unmount } = renderPanel({ sourceRenderMode: mode });
      await waitFor(() =>
        expect(screen.getByTestId("text-viewer")).toBeInTheDocument()
      );
      expect(screen.queryByTestId("pdf-viewer")).not.toBeInTheDocument();
      unmount();
    }
  });

  it("renders an image source as a picture, not through either viewer", async () => {
    renderPanel({
      sourceRenderMode: "image",
      sourceFilePath: "school-1/a.png",
      sourceFileName: "a.png",
    });

    await waitFor(() =>
      expect(screen.getByRole("img", { name: "a.png" })).toBeInTheDocument()
    );
    expect(screen.queryByTestId("pdf-viewer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("text-viewer")).not.toBeInTheDocument();
  });
});

describe("ReferencePanel — pop out", () => {
  it("opens as a modal dialog and closes again", async () => {
    renderPanel({});

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /pop out/i }));
    const dialog = screen.getByRole("dialog", { name: "Source reference" });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    fireEvent.click(screen.getByRole("button", { name: /exit full screen/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    renderPanel({});

    fireEvent.click(screen.getByRole("button", { name: /pop out/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("locks the page behind it from scrolling while open", async () => {
    renderPanel({});

    fireEvent.click(screen.getByRole("button", { name: /pop out/i }));
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
