import { describe, expect, it } from 'vitest';
import {
  ensureExperienceRoles,
  normalizeExperienceEntry,
  normalizeWorkExperience,
} from '@/lib/utils/work-experience';

describe('work-experience normalization', () => {
  it('wraps legacy flat row into a single role', () => {
    const job = normalizeExperienceEntry({
      id: 1,
      title: 'Product Manager',
      company: 'Felix',
      years: 'Nov 2023 - Nov 2025',
      description: ['Owned roadmap'],
    });
    expect(job.company).toBe('Felix');
    expect(job.roles).toHaveLength(1);
    expect(job.roles[0].title).toBe('Product Manager');
    expect(job.description).toEqual(['Owned roadmap']);
  });

  it('inherits legacy title when roles exist but are empty', () => {
    const job = normalizeExperienceEntry({
      id: 1,
      title: 'Engineer',
      company: 'Co',
      years: '2020',
      roles: [{ id: 1, title: '', years: '' }],
      description: [],
    });
    expect(job.roles[0].title).toBe('Engineer');
    expect(job.roles[0].years).toBe('2020');
  });

  it('clears template placeholder titles', () => {
    const job = normalizeExperienceEntry({
      id: 1,
      title: 'YOUR POSITION TITLE',
      company: 'Co',
      years: 'Jan 2020 - Present',
      description: [],
    });
    expect(job.roles[0].title).toBe('');
  });

  it('preserves trailing spaces during in-editor normalization', () => {
    const job = normalizeExperienceEntry({
      id: 1,
      title: 'Engineer ',
      company: 'Co ',
      years: '2020 - Present ',
      description: [],
    });
    expect(job.roles[0].title).toBe('Engineer ');
    expect(job.company).toBe('Co ');
    expect(job.roles[0].years).toBe('2020 - Present ');
  });

  it('ensures missing roles are backfilled for editor safety', () => {
    const jobs = ensureExperienceRoles([
      {
        id: 1,
        company: 'Acme',
        location: 'Remote',
        roles: [],
        description: [],
      },
    ]);
    expect(jobs[0].roles).toHaveLength(1);
    expect(jobs[0].roles[0].title).toBe('');
    expect(jobs[0].roles[0].years).toBe('');
  });

  it('does not merge two same-company rows', () => {
    const jobs = normalizeWorkExperience([
      { id: 1, company: 'Felix', title: 'PM', years: '2023', description: ['a'] },
      { id: 2, company: 'Felix', title: 'BA', years: '2020', description: ['b'] },
    ]);
    expect(jobs).toHaveLength(2);
    expect(jobs[0].roles[0].title).toBe('PM');
    expect(jobs[1].roles[0].title).toBe('BA');
  });
});
