"use client";

/**
 * One body paragraph's elaboration pane. Per CD → per best word:
 *   - Best word shown as a sky pill header.
 *   - Single-line synonym AutoSaveInput (WOW box #2).
 *   - Phrase list: each phrase linked to this word via parent_cm_id.
 *     Each phrase editable (multiline AutoSaveInput) + deletable.
 *   - [+ Add phrase] appends a new phrase linked to this word.
 *
 * If a CD has no best-word CMs (is_best_word_for_chunk=false for all),
 * NoBestWordsState renders with a back-link to Making Decisions.
 */

import Link from "next/link";
import { useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { AutoSaveInput } from "../t-chart/auto-save-input";
import {
  createPhraseCm,
  updateCmText,
  updateCmSynonym,
  deleteCm,
} from "@/lib/actions/commentary";
import { useWritingMode } from "../use-writing-mode";
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
        For each best word: write a synonym, then 2+ phrases answering — what
        does it mean to the character to be that?
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
                allPhrases={cd.phrases}
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
  allPhrases,
}: {
  writingId: string;
  chunkId: string;
  cdId: string;
  cdText: string;
  bestWords: readonly CommentaryItemData[];
  allPhrases: readonly CommentaryItemData[];
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
        <div className="space-y-4">
          {bestWords.map((word) => (
            <BestWordBlock
              key={word.id}
              writingId={writingId}
              chunkId={chunkId}
              cdId={cdId}
              word={word}
              phrases={allPhrases.filter((p) => p.parent_cm_id === word.id)}
            />
          ))}
        </div>
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

function BestWordBlock({
  writingId,
  chunkId,
  cdId,
  word,
  phrases,
}: {
  writingId: string;
  chunkId: string;
  cdId: string;
  word: CommentaryItemData;
  phrases: readonly CommentaryItemData[];
}) {
  const { isReadOnly } = useWritingMode();

  return (
    <div className="border border-sky-200 rounded-lg p-3 space-y-2">
      {/* Best word pill header */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-700 text-xs font-medium">
          {word.text.trim() || "(empty)"}
        </span>
        <span className="text-xs uppercase tracking-wide text-gray-500">
          best word
        </span>
      </div>

      {/* Synonym field */}
      <AutoSaveInput
        initialValue={word.synonym ?? ""}
        placeholder="A synonym for this word (optional)"
        disabled={isReadOnly}
        onSave={async (v) => {
          await updateCmSynonym(writingId, word.id, v);
        }}
      />

      {/* Phrases for this word */}
      <PhraseList
        writingId={writingId}
        chunkId={chunkId}
        cdId={cdId}
        wordId={word.id}
        phrases={phrases}
      />
    </div>
  );
}

function PhraseList({
  writingId,
  chunkId,
  cdId,
  wordId,
  phrases,
}: {
  writingId: string;
  chunkId: string;
  cdId: string;
  wordId: string;
  phrases: readonly CommentaryItemData[];
}) {
  const { isReadOnly } = useWritingMode();
  return (
    <div className="ml-2 space-y-2">
      {phrases.length === 0 && (
        <p className="text-xs text-gray-500 italic">
          No phrases yet. Click [Add phrase] to start elaborating.
        </p>
      )}
      {phrases.map((phrase) => (
        <PhraseRow key={phrase.id} writingId={writingId} phrase={phrase} />
      ))}
      {!isReadOnly && (
        <AddPhraseButton
          writingId={writingId}
          chunkId={chunkId}
          cdId={cdId}
          wordId={wordId}
        />
      )}
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
  const { isReadOnly } = useWritingMode();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <AutoSaveInput
          multiline
          rows={2}
          initialValue={phrase.text}
          placeholder="A 3+ word phrase — what does it mean to the character?"
          disabled={isReadOnly}
          onSave={async (text) => {
            await updateCmText(writingId, phrase.id, text);
          }}
        />
      </div>
      {!isReadOnly && (
        <button
          type="button"
          onClick={() =>
            start(async () => {
              await deleteCm(writingId, phrase.id);
            })
          }
          disabled={pending}
          title="Remove phrase"
          aria-label="Remove phrase"
          className="mt-1 text-gray-400 hover:text-red-700 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}

function AddPhraseButton({
  writingId,
  chunkId,
  cdId,
  wordId,
}: {
  writingId: string;
  chunkId: string;
  cdId: string;
  wordId: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await createPhraseCm(writingId, chunkId, cdId, wordId);
        })
      }
      disabled={pending}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-sky-700 hover:bg-sky-50 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
      )}
      Add phrase
    </button>
  );
}
