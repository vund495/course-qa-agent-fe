import * as React from 'react';
import { Globe, ExternalLink } from 'lucide-react';
import { normalizeCitationUrl } from '@/lib/citations';
import type { CitationItem } from './types';

interface InternetSourceBadgeProps {
  citation: CitationItem;
}

export function InternetSourceBadge({ citation }: InternetSourceBadgeProps) {
  const handleClick = () => {
    const rawUrl = citation.jump_url || citation.file_url;
    const url = normalizeCitationUrl(rawUrl ? rawUrl.split('#:~:text=')[0] : null);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--brand-line)] bg-[var(--brand-soft)] px-2.5 py-1 text-xs font-medium text-[var(--brand-ink)] transition-colors hover:bg-[var(--brand-soft-strong)]"
      title={`Open web source: ${citation.document_name}`}
    >
      <span className="font-semibold">[{citation.citation_id}]</span>
      <Globe className="h-3.5 w-3.5" />
      <span className="max-w-[130px] truncate">{citation.document_name}</span>
      <span className="rounded border border-[var(--brand-line)] bg-white/80 px-1 py-0.5 text-[10px]">
        Web
      </span>
      <ExternalLink className="h-3 w-3 opacity-80" />
    </button>
  );
}
