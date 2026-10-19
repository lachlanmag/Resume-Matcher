import type { ParseCheck } from '@/lib/api/ats';

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Section-kind params (found/missing) carry ids that need their own labels. */
const SECTION_KIND_PARAMS = new Set(['found', 'missing']);

/** A parse-check's params as the builder.atsCheck.checks.* messages expect them. */
export function atsCheckParams(check: ParseCheck, t: Translate): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(check.params)) {
    if (Array.isArray(value)) {
      params[key] = SECTION_KIND_PARAMS.has(key)
        ? value.map((kind) => t(`builder.atsCheck.sectionKinds.${kind}`)).join(', ')
        : value.join(', ');
    } else if (typeof value === 'number' || typeof value === 'string') {
      params[key] = value;
    }
  }
  return params;
}

/** "Title: message" for one parse-check, in the UI language. */
export function describeAtsCheck(check: ParseCheck, t: Translate): string {
  const title = t(`builder.atsCheck.checks.${check.id}.title`);
  const message = t(
    `builder.atsCheck.checks.${check.id}.${check.status}`,
    atsCheckParams(check, t)
  );
  const hint =
    check.id === 'multi_column' && check.params.expected_by_template === true
      ? ` ${t('builder.atsCheck.checks.multi_column.templateHint')}`
      : '';
  return `${title}: ${message}${hint}`;
}
