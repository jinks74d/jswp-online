"use client";

/**
 * One body paragraph's elaboration pane. Per CD:
 *   - CD text (read-only red header)
 *   - Best words pill list (the words flagged is_best_word_for_chunk).
 *     Empty state with back-link if zero.
 *   - List of kind='phrase' rows. Each editable via AutoSaveInput +
 *     delete. [+ Add phrase] at bottom. No starter pre-population.
 *
 * Phrases attach to the CD via parent_cd_id only — no per-best-word
 * link (Phase 7 backlog: parent_cm_id FK migration). UI presents
 * phrases as a flat list scoped to the CD.
 */

import Link from "next/link";
import { useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { AutoSaveInput } from "../t-chart/auto-save-input";
import {
  createPhraseCm,
  updateCmText,
  deleteCm,
} from "@/lib/actions/commentary";
import type {
  CommentaryBpData,
  CommentaryItemData,
} from "@/lib/queries/commentary";

export function ElaborationBpPane({
  writingId,
  bp,
}: {
  writingId: string;
  bp: CommentaryBpData;
}) {
  if (bp.chunks.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-900">
        Body paragraph {bp.position} has no chunks yet.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-600">
        For each best word, write a synonym and 2+ phrases of 3+ words
        explaining what you mean. These &quot;cloud&quot; phrases will
        become your CM sentences.
      </p>
      {bp.chunks.map((chunk) => (
        <section
          key={chunk.id}
          className="bg-white border border-gray-200 rounded-lg p-4 space-y-4"
        >
          {chunk.cds.length === 0 ? (
            <p className="text-sm text-gray-600 italic">
              No concrete details in chunk {chunk.position}.
            </p>
          ) : (
            chunk.cds.map((cd) => (
              <CdSection
                key={cd.id}
                writingId={writingId}
                chunkId={chunk.id}
                cdId={cd.id}
                cdText={cd.text}
                bestWords={cd.words.filter((w) => w.is_best_word_for_chunk)}
                phrases={cd.phrases}
              />
            ))
          )}
        </section>
      ))}
    </div>
  );
}

function CdSection({
  writingId,
  chunkId,
  cdId,
  cdText,
  bestWords,
  phrases,
}: {
  writingId: string;
  chunkId: string;
  cdId: string;
  cdText: string;
  bestWords: readonly CommentaryItemData[];
  phrases: readonly CommentaryItemData[];
}) {
  return (
    <div className="space-y-3">
      <header className="border-l-4 border-red-300 pl-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-red-700">
          Concrete Detail
        </div>
        <p className="text-sm text-gray-900 whitespace-pre-wrap mt-0.5">
          {cdText.trim() || (
            <span className="italic text-gray-400">
              (empty CD — fill it in on gather-cds)
            </span>
          )}
        </p>
      </header>

      {bestWords.length === 0 ? (
        <NoBestWordsState writingId={writingId} />
      ) : (
        <>
          <BestWordsPills words={bestWords} />
          <PhraseList
            writingId={writingId}
            chunkId={chunkId}
            cdId={cdId}
            phrases={phrases}
          />
        </>
      )}
    </div>
  );
}

function NoBestWordsState({ writingId }: { writingId: string }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm">
      <p className="text-amber-900">
        No best words selected yet for this concrete detail.
      </p>
      <Link
        href={`/student/writings/${writingId}/making-decisions`}
        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-300 bg-white text-xs text-amber-900 hover:bg-amber-50"
      >
        ← Back to Making Decisions
      </Link>
    </div>
  );
}

function BestWordsPills({
  words,
}: {
  words: readonly CommentaryItemData[];
}) {
  return (
    <div className="flex items-baseline flex-wrap gap-2">
      <span className="text-xs uppercase tracking-wide text-gray-500">
        Best words:
      </span>
      {words.map((w) => (
        <span
          key={w.id}
          className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-xs font-medium"
        >
          {w.text.trim() || "(empty)"}
        </span>
      ))}
    </div>
  );
}

function PhraseList({
  writingId,
  chunkId,
  cdId,
  phrases,
}: {
  writingId: string;
  chunkId: string;
  cdId: string;
  phrases: readonly CommentaryItemData[];
}) {
  return (
    <div className="ml-4 space-y-2">
      {phrases.length === 0 && (
        <p className="text-xs text-gray-500 italic">
          No phrases yet. Click [Add phrase] to start elaborating.
        </p>
      )}
      {phrases.map((phrase) => (
        <PhraseRow key={phrase.id} writingId={writingId} phrase={phrase} />
      ))}
      <AddPhraseButton
        writingId={writingId}
        chunkId={chunkId}
        cdId={cdId}
      />
    </div>
  );
}

function PhraseRow({
  writingId,
  phrase,
}: {
  writingId: string;
  phrase: CommentaryItemData;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <AutoSaveInput
          multiline
          rows={2}
          initialValue={phrase.text}
          placeholder="A synonym, or a 3+ word phrase that explains what you mean…"
          onSave={async (text) => {
            await updateCmText(writingId, phrase.id, text);
          }}
        />
      </div>
      <button
        type="button"
        onClick={() =>
          start(async () => {
            await deleteCm(writingId, phrase.id);
          })
        }
        disabled={pending}
        title="Remove phrase"
        className="mt-1 text-gray-400 hover:text-red-700 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}

function AddPhraseButton({
  writingId,
  chunkId,
  cdId,
}: {
  writingId: string;
  chunkId: string;
  cdId: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await createPhraseCm(writingId, chunkId, cdId);
        })
      }
      disabled={pending}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-sky-700 hover:bg-sky-50 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Plus className="w-3.5 h-3.5" />
      )}
      Add phrase
    </button>
  );
}
