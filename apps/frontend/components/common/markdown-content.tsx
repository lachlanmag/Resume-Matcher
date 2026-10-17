'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { cn } from '@/lib/utils';

interface MarkdownContentProps {
  markdown: string;
  className?: string;
}

const markdownComponents: Components = {
  h2: ({ children }) => (
    <h2 className="mb-3 mt-6 border-b-2 border-black pb-2 font-serif text-lg font-bold uppercase tracking-tight first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 font-serif text-base font-semibold leading-tight">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-3 text-ink-soft last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 text-ink-soft">{children}</ul>,
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 text-ink-soft">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-bold text-ink">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-4 border-t border-black" />,
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto border-2 border-black shadow-sw-xs">
      <table className="w-full min-w-[32rem] border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-paper-tint">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-black last:border-b-0">{children}</tr>,
  th: ({ children }) => (
    <th className="border-r border-black px-3 py-2 text-left align-top font-mono text-xs font-bold uppercase tracking-wide text-ink last:border-r-0">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-r border-black px-3 py-2 align-top leading-relaxed text-ink-soft last:border-r-0">
      {children}
    </td>
  ),
};

/**
 * Renders markdown as formatted HTML with Swiss-style typography.
 * Used for read-only LLM-generated reports (e.g. feedback summary).
 */
export function MarkdownContent({ markdown, className }: MarkdownContentProps) {
  if (!markdown.trim()) {
    return null;
  }

  return (
    <div className={cn('text-sm leading-relaxed', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
