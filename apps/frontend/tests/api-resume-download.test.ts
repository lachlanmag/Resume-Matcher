import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadResumePdf } from '@/lib/api/resume';
import { describeAtsCheck } from '@/lib/utils/ats-check-messages';
import type { ParseCheck } from '@/lib/api/ats';

afterEach(() => vi.unstubAllGlobals());

const MULTI_COLUMN: ParseCheck = {
  id: 'multi_column',
  category: 'layout',
  severity: 'medium',
  status: 'fail',
  params: { pages: [1, 2], expected_by_template: true },
};

function pdfResponse(headers: Record<string, string> = {}) {
  return Promise.resolve(new Response('%PDF', { status: 200, headers }));
}

describe('downloadResumePdf ATS failures', () => {
  it('returns the failed parse-checks the backend reports for the PDF', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => pdfResponse({ 'X-Resume-Pdf-Ats-Failures': JSON.stringify([MULTI_COLUMN]) }))
    );
    const result = await downloadResumePdf('r1');
    expect(result.atsFailures).toEqual([MULTI_COLUMN]);
    expect(result.blob.size).toBe(4);
  });

  it('treats a missing or malformed header as no failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => pdfResponse())
    );
    expect((await downloadResumePdf('r1')).atsFailures).toEqual([]);

    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        pdfResponse({ 'X-Resume-Pdf-Ats-Failures': JSON.stringify(['old string', { id: 1 }]) })
      )
    );
    expect((await downloadResumePdf('r1')).atsFailures).toEqual([]);

    vi.stubGlobal(
      'fetch',
      vi.fn(() => pdfResponse({ 'X-Resume-Pdf-Ats-Failures': '{not json' }))
    );
    expect((await downloadResumePdf('r1')).atsFailures).toEqual([]);
  });
});

describe('describeAtsCheck', () => {
  it('uses the ATS check messages with formatted params and the template hint', () => {
    const t = vi.fn((key: string, params?: Record<string, string | number>) =>
      params ? `${key}(${JSON.stringify(params)})` : key
    );
    expect(describeAtsCheck(MULTI_COLUMN, t)).toBe(
      'builder.atsCheck.checks.multi_column.title: ' +
        'builder.atsCheck.checks.multi_column.fail({"pages":"1, 2"}) ' +
        'builder.atsCheck.checks.multi_column.templateHint'
    );
  });

  it('labels section kinds in section_headings params', () => {
    const t = (key: string, params?: Record<string, string | number>) =>
      params ? `${key}|${params.missing}` : key.replace('builder.atsCheck.sectionKinds.', '');
    const check: ParseCheck = {
      id: 'section_headings',
      category: 'content',
      severity: 'medium',
      status: 'fail',
      params: { found: [], missing: ['experience', 'skills'] },
    };
    expect(describeAtsCheck(check, t)).toContain('|experience, skills');
  });
});
