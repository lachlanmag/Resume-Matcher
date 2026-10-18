'use client';

import React, { useId } from 'react';
import {
  type TailorLengthSettings,
  MIN_TARGET_PAGES,
  MAX_TARGET_PAGES,
  MIN_BULLETS_PER_JOB,
  MAX_BULLETS_PER_JOB,
  validateTailorLengthSettings,
} from '@/lib/types/tailor-length';
import { useTranslations } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SegmentedControl } from '@/components/ui/segmented-control';

export interface TailorLengthControlsProps {
  settings: TailorLengthSettings;
  onChange: (settings: TailorLengthSettings) => void;
  disabled?: boolean;
  showDescription?: boolean;
}

export function TailorLengthControls({
  settings,
  onChange,
  disabled = false,
  showDescription = true,
}: TailorLengthControlsProps) {
  const { t } = useTranslations();
  const id = useId();
  const validationError = validateTailorLengthSettings(settings);

  const pageOptions = Array.from(
    { length: MAX_TARGET_PAGES - MIN_TARGET_PAGES + 1 },
    (_, i) => MIN_TARGET_PAGES + i
  );

  return (
    <div className="space-y-4">
      {showDescription && (
        <p className="text-sm text-ink-soft leading-relaxed">
          {t('settings.tailorLength.description')}
        </p>
      )}

      <div className="space-y-2">
        <Label id={`${id}-pages`}>{t('settings.tailorLength.targetPages')}</Label>
        <SegmentedControl
          aria-labelledby={`${id}-pages`}
          size="sm"
          items={pageOptions.map((n) => ({ value: String(n), label: String(n), disabled }))}
          value={String(settings.target_pages)}
          onChange={(value) => onChange({ ...settings, target_pages: Number(value) })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${id}-bullets-min`}>{t('settings.tailorLength.bulletsMin')}</Label>
          <Input
            id={`${id}-bullets-min`}
            type="number"
            min={MIN_BULLETS_PER_JOB}
            max={MAX_BULLETS_PER_JOB}
            disabled={disabled}
            value={settings.bullets_per_job_min}
            onChange={(e) =>
              onChange({ ...settings, bullets_per_job_min: Number(e.target.value) })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-bullets-max`}>{t('settings.tailorLength.bulletsMax')}</Label>
          <Input
            id={`${id}-bullets-max`}
            type="number"
            min={MIN_BULLETS_PER_JOB}
            max={MAX_BULLETS_PER_JOB}
            disabled={disabled}
            value={settings.bullets_per_job_max}
            onChange={(e) =>
              onChange({ ...settings, bullets_per_job_max: Number(e.target.value) })
            }
          />
        </div>
      </div>

      {validationError && (
        <p role="alert" className="text-sm text-destructive font-mono">
          {validationError}
        </p>
      )}
    </div>
  );
}
