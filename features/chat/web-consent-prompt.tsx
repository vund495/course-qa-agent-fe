'use client';

import * as React from 'react';
import { Globe2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CitationChip } from '@/features/citations/citation-chip';
import { citationKey } from '@/lib/citations';
import type { ChatConsentOffer } from '@/lib/sse';

export function WebConsentPrompt({
  offer,
  busy = false,
  onAccept,
  onDecline,
}: {
  offer: ChatConsentOffer;
  busy?: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const isFull = offer.scopeKind === 'full';

  return (
    <section
      role="region"
      aria-label="Web search consent"
      aria-busy={busy}
      className="rounded-xl border border-[#CFCFCF] bg-[#FBFBFB] p-3 text-left"
    >
      <div className="flex items-start gap-2">
        <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-[#45698B]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[12.5px] font-semibold text-[#111111]">
            {isFull ? 'Course materials are not enough' : 'Some parts need the web'}
          </h3>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[#5A5A5A]">
            {isFull
              ? 'I can search the web for your full question. Nothing is searched unless you explicitly accept.'
              : 'I can search the web only for the parts the course materials do not cover. Nothing is searched unless you explicitly accept.'}
          </p>
          {offer.conflictNote && (
            <div
              role="alert"
              className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11.5px] text-amber-950"
            >
              <p className="font-semibold">Source conflict warning</p>
              <p className="mt-1 whitespace-pre-wrap">
                {offer.conflictNote.replace(/\*\*Source conflict warning:\*\*/i, '').trim()}
              </p>
              <p className="mt-1 font-medium">No winner is selected. Review both sides:</p>
              {offer.conflictCitations.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Conflicting course sources">
                  {offer.conflictCitations.map((citation, position) => (
                    <CitationChip
                      key={`${citationKey(citation)}-${position}`}
                      citation={citation}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          {isFull ? (
            <p className="mt-2 rounded-md bg-white px-2 py-1.5 text-[11.5px] text-[#333333] ring-1 ring-inset ring-[#E5E5E5]">
              {offer.question}
            </p>
          ) : (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[11.5px] text-[#333333]">
              {offer.queryScope.map((segment) => (
                <li key={segment}>{segment}</li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="brand"
              size="sm"
              onClick={onAccept}
              disabled={busy}
              aria-label="Accept web search for the listed scope"
            >
              {busy ? 'Searching the web...' : 'Search the web'}
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onDecline}
              disabled={busy}
            >
              No, thanks
            </Button>
          </div>
          <p className="mt-2 text-[10.5px] text-[#777777]">
            The web answer will appear separately and will not be combined with course citations.
          </p>
        </div>
      </div>
    </section>
  );
}
