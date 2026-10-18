'use client';

import React from 'react';
import type { Experience } from '@/components/dashboard/resume-component';
import { formatDateRange } from '@/lib/utils';
import { DescriptionList } from './description-list';
import { resumeItem } from './page-break-attrs';
import baseStyles from '@/components/resume/styles/_base.module.css';

export interface WorkExperienceBlockProps {
  job: Experience;
  /** Company name heading */
  titleClassName?: string;
  /** Role title line */
  roleTitleClassName?: string;
  /** Company row (location) — unused when location is inline */
  subtitleClassName?: string;
  dateClassName?: string;
  listClassName?: string;
  textClassName?: string;
}

export function WorkExperienceBlock({
  job,
  titleClassName = baseStyles['resume-item-title'],
  roleTitleClassName = baseStyles['resume-item-subtitle'],
  dateClassName = baseStyles['resume-date'],
  textClassName = baseStyles['resume-text-sm'],
}: WorkExperienceBlockProps) {
  const roles =
    job.roles?.length && job.roles.length > 0 ? job.roles : [{ id: 1, title: '', years: '' }];

  return (
    <div {...resumeItem(job.description)} className={baseStyles['resume-item']}>
      <div className={`flex justify-between items-baseline ${baseStyles['resume-row-tight']}`}>
        <h4 className={titleClassName}>{job.company}</h4>
        {job.location ? <span className={roleTitleClassName}>{job.location}</span> : null}
      </div>

      {roles.map((role) => (
        <div
          key={`${job.id}-${role.id}`}
          className={`flex justify-between items-baseline ${baseStyles['resume-row-tight']}`}
        >
          <span className={roleTitleClassName}>{role.title}</span>
          {role.years ? (
            <span className={`${dateClassName} ml-4`}>{formatDateRange(role.years)}</span>
          ) : null}
        </div>
      ))}

      <DescriptionList
        items={job.description}
        styles={job.descriptionStyles}
        textClassName={textClassName}
      />
    </div>
  );
}
