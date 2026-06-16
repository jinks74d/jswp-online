/**
 * Maps a RichNode tree (from buildRichTree) to React elements for the
 * formatted Reading & Annotation view. Element nodes render as their tag with
 * the render-safe attributes the tree carried; text runs render as plain text,
 * except marked runs which are delegated to renderMark so the caller
 * (SourceTextViewer) owns the <mark> styling, click handler, and
 * data-annotation-id — keeping the highlight contract identical to the flat
 * path.
 *
 * Presentational only — no hooks, no browser APIs. The text-preservation /
 * offset-alignment guarantees live in rich-source-tree; this component just
 * renders the tree faithfully.
 */

import { createElement, Fragment, type ReactNode } from "react";
import type { RichNode } from "./rich-source-tree";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";

export interface RichSourceBodyProps {
  readonly nodes: readonly RichNode[];
  readonly renderMark: (
    annotation: TextAnnotationRow,
    text: string,
    key: string
  ) => ReactNode;
}

export function RichSourceBody({ nodes, renderMark }: RichSourceBodyProps) {
  return <>{renderNodes(nodes, renderMark, "n")}</>;
}

function renderNodes(
  nodes: readonly RichNode[],
  renderMark: RichSourceBodyProps["renderMark"],
  prefix: string
): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${prefix}-${i}`;

    if (node.type === "text") {
      return (
        <Fragment key={key}>
          {node.runs.map((run, j) => {
            const runKey = `${key}-${j}`;
            return run.marked ? (
              renderMark(run.annotation, run.text, runKey)
            ) : (
              <Fragment key={runKey}>{run.text}</Fragment>
            );
          })}
        </Fragment>
      );
    }

    const children = renderNodes(node.children, renderMark, key);
    const props = { key, ...node.attrs };
    // Void elements (img, br) must not be given a children argument.
    return children.length > 0
      ? createElement(node.tag, props, children)
      : createElement(node.tag, props);
  });
}
