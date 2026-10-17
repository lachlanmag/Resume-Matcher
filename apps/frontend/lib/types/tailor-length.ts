export interface TailorLengthSettings {
  target_pages: number;
  bullets_per_job_min: number;
  bullets_per_job_max: number;
}

export const DEFAULT_TAILOR_LENGTH_SETTINGS: TailorLengthSettings = {
  target_pages: 2,
  bullets_per_job_min: 3,
  bullets_per_job_max: 5,
};

export const MIN_TARGET_PAGES = 1;
export const MAX_TARGET_PAGES = 3;
export const MIN_BULLETS_PER_JOB = 1;
export const MAX_BULLETS_PER_JOB = 10;

export function validateTailorLengthSettings(settings: TailorLengthSettings): string | null {
  if (settings.target_pages < MIN_TARGET_PAGES || settings.target_pages > MAX_TARGET_PAGES) {
    return `Pages must be between ${MIN_TARGET_PAGES} and ${MAX_TARGET_PAGES}`;
  }
  if (
    settings.bullets_per_job_min < MIN_BULLETS_PER_JOB ||
    settings.bullets_per_job_min > MAX_BULLETS_PER_JOB
  ) {
    return `Minimum bullets must be between ${MIN_BULLETS_PER_JOB} and ${MAX_BULLETS_PER_JOB}`;
  }
  if (
    settings.bullets_per_job_max < MIN_BULLETS_PER_JOB ||
    settings.bullets_per_job_max > MAX_BULLETS_PER_JOB
  ) {
    return `Maximum bullets must be between ${MIN_BULLETS_PER_JOB} and ${MAX_BULLETS_PER_JOB}`;
  }
  if (settings.bullets_per_job_max < settings.bullets_per_job_min) {
    return 'Maximum bullets must be greater than or equal to minimum';
  }
  return null;
}
