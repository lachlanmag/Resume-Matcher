'use client';

import React from 'react';
import type { Experience } from '@/components/dashboard/resume-component';
import { formatDateRange } from '@/lib/utils';
import { SafeHtml } from './safe-html';
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
  listClassName = baseStyles['resume-list'],
  textClassName = baseStyles['resume-text-sm'],
}: WorkExperienceBlockProps) {
  const roles =
    job.roles?.length && job.roles.length > 0
      ? job.roles
      : [{ id: 1, title: '', years: '' }];

  return (
    <div className={baseStyles['resume-item']}>
      <div
        className={`flex justify-between items-baseline ${baseStyles['resume-row-tight']}`}
      >
        <h4 className={titleClassName}>{job.company}</h4>
        {job.location ? <span className={roleTitleClassName}>{job.location}</span> : null}
      </div>

      {roles.map((role) => (
        <div
          key={role.id}
          className={`flex justify-between items-baseline ${baseStyles['resume-row-tight']}`}
        >
          <span className={roleTitleClassName}>{role.title}</span>
          {role.years ? (
            <span className={`${dateClassName} ml-4`}>{formatDateRange(role.years)}</span>
          ) : null}
        </div>
      ))}

      {job.description && job.description.length > 0 ? (
        <ul className={`ml-4 ${listClassName} ${textClassName}`}>
          {job.description.map((desc, index) => (
            <li key={index} className="flex">
              <span className="mr-1.5 flex-shrink-0">•&nbsp;</span>
              <span>
                <SafeHtml html={desc} />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
