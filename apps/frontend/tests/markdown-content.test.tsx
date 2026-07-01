import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownContent } from '@/components/common/markdown-content';

describe('MarkdownContent', () => {
  it('renders GFM tables with accessible structure', () => {
    const markdown = `## Keyword coverage

| Term | Status | Location |
| --- | --- | --- |
| Python | Present | workExperience |
| Kubernetes | Missing | — |`;

    const { container } = render(<MarkdownContent markdown={markdown} />);

    expect(screen.getByRole('heading', { name: 'Keyword coverage' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Term' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Python' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Missing' })).toBeInTheDocument();

    const tableWrapper = container.querySelector('.overflow-x-auto');
    expect(tableWrapper).not.toBeNull();
    expect(tableWrapper?.querySelector('table')).not.toBeNull();
  });
});
