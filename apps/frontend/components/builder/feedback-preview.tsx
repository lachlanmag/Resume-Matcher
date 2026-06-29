'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FeedbackPreviewProps {
  content: string;
  className?: string;
}

export function FeedbackPreview({ content, className }: FeedbackPreviewProps) {
  return (
    <div className={cn('p-6', className)}>
      <article className="border-2 border-black bg-white p-6 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink-soft">
        {content}
      </article>
    </div>
  );
}
