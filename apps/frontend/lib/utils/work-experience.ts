import type { Experience, ExperienceRole } from '@/components/dashboard/resume-component';

/** Template filler text from Word/PDF forms — treat as empty so placeholders show instead.
 * Normalization contract is shared with the backend (`app/schemas/work_experience.py`).
 * Keep both in sync; golden cases live in `tests/fixtures/work_experience_normalization.json`.
 */
const TEMPLATE_PLACEHOLDER_VALUES = new Set(
  [
    'your position title',
    'your job title',
    'position title',
    'job title',
    'your company name',
    'company name',
    'your company',
    'dates employed',
    'date range',
    'your location',
    'location',
  ].map((s) => s.toLowerCase())
);

function coerceStr(value: unknown): string {
  if (value == null) return '';
  const text = String(value);
  if (TEMPLATE_PLACEHOLDER_VALUES.has(text.trim().toLowerCase())) {
    return '';
  }
  return text;
}

function normalizeRole(role: unknown, index: number): ExperienceRole {
  if (!role || typeof role !== 'object') {
    return { id: index + 1, title: '', years: '' };
  }
  const r = role as Record<string, unknown>;
  const roleId = typeof r.id === 'number' ? r.id : index + 1;
  return {
    id: roleId,
    title: coerceStr(r.title),
    years: coerceStr(r.years),
  };
}

/** Wrap legacy flat experience rows; never merge separate entries. */
export function normalizeExperienceEntry(data: unknown): Experience {
  if (!data || typeof data !== 'object') {
    return {
      id: 0,
      company: '',
      location: '',
      roles: [{ id: 1, title: '', years: '' }],
      description: [],
    };
  }

  const entry = data as Record<string, unknown>;
  const rolesRaw = entry.roles;

  let roles: ExperienceRole[];
  if (Array.isArray(rolesRaw) && rolesRaw.length > 0) {
    roles = rolesRaw.map((role, index) => normalizeRole(role, index));
    const legacyTitle = coerceStr(entry.title);
    const legacyYears = coerceStr(entry.years);
    if (legacyTitle && !roles.some((role) => role.title)) {
      roles[0] = { ...roles[0], title: legacyTitle };
    }
    if (legacyYears && !roles.some((role) => role.years)) {
      roles[0] = { ...roles[0], years: legacyYears };
    }
  } else {
    roles = [
      {
        id: 1,
        title: coerceStr(entry.title),
        years: coerceStr(entry.years),
      },
    ];
  }

  const description = Array.isArray(entry.description)
    ? entry.description.map((d) => (typeof d === 'string' ? d : String(d ?? '')))
    : [];

  return {
    id: typeof entry.id === 'number' ? entry.id : 0,
    company: coerceStr(entry.company),
    location: coerceStr(entry.location) || undefined,
    roles,
    description,
  };
}

export function normalizeWorkExperience(entries: unknown): Experience[] {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => normalizeExperienceEntry(entry));
}

/** Ensure each job has a roles array without stripping user input (for live editing). */
export function ensureExperienceRoles(entries: Experience[]): Experience[] {
  return entries.map((entry) => {
    if (entry.roles?.length) {
      return entry;
    }
    const legacy = entry as Experience & { title?: string; years?: string };
    return {
      ...entry,
      roles: [{ id: 1, title: legacy.title ?? '', years: legacy.years ?? '' }],
    };
  });
}

export function withNormalizedWorkExperience<T extends { workExperience?: unknown }>(
  data: T
): T & { workExperience: Experience[] } {
  return {
    ...data,
    workExperience: normalizeWorkExperience(data.workExperience),
  };
}

/** Primary role title for labels (first role). */
export function getExperiencePrimaryTitle(job: Experience): string {
  return job.roles?.[0]?.title ?? '';
}

/** All role titles joined for display. */
export function getExperienceRoleTitles(job: Experience): string {
  return (job.roles ?? [])
    .map((r) => r.title?.trim())
    .filter(Boolean)
    .join('; ');
}

/** Combined years line across roles (for compact single-line templates). */
export function getExperienceYearsLine(job: Experience): string {
  return (job.roles ?? [])
    .map((r) => r.years?.trim())
    .filter(Boolean)
    .join(' · ');
}
