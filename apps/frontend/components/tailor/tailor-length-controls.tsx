'use client';

import React from 'react';
import {
  type TailorLengthSettings,
  MIN_TARGET_PAGES,
  MAX_TARGET_PAGES,
  MIN_BULLETS_PER_JOB,
  MAX_BULLETS_PER_JOB,
  validateTailorLengthSettings,
} from '@/lib/types/tailor-length';
import { useTranslations } from '@/lib/i18n';

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
        <label className="font-mono text-xs font-bold uppercase tracking-wider text-ink-soft">
          {t('settings.tailorLength.targetPages')}
        </label>
        <div className="flex gap-2">
          {pageOptions.map((n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...settings, target_pages: n })}
              className={`px-4 py-2 text-sm font-mono border-2 border-black transition-colors ${
                settings.target_pages === n
                  ? 'bg-blue-700 text-white'
                  : 'bg-background hover:bg-paper-tint'
              } disabled:opacity-50`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label
            htmlFor="bullets-min"
            className="font-mono text-xs font-bold uppercase tracking-wider text-ink-soft"
          >
            {t('settings.tailorLength.bulletsMin')}
          </label>
          <input
            id="bullets-min"
            type="number"
            min={MIN_BULLETS_PER_JOB}
            max={MAX_BULLETS_PER_JOB}
            disabled={disabled}
            value={settings.bullets_per_job_min}
            onChange={(e) =>
              onChange({
                ...settings,
                bullets_per_job_min: Number(e.target.value),
              })
            }
            className="w-full border-2 border-black px-3 py-2 font-mono text-sm bg-background disabled:opacity-50"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="bullets-max"
            className="font-mono text-xs font-bold uppercase tracking-wider text-ink-soft"
          >
            {t('settings.tailorLength.bulletsMax')}
          </label>
          <input
            id="bullets-max"
            type="number"
            min={MIN_BULLETS_PER_JOB}
            max={MAX_BULLETS_PER_JOB}
            disabled={disabled}
            value={settings.bullets_per_job_max}
            onChange={(e) =>
              onChange({
                ...settings,
                bullets_per_job_max: Number(e.target.value),
              })
            }
            className="w-full border-2 border-black px-3 py-2 font-mono text-sm bg-background disabled:opacity-50"
          />
        </div>
      </div>

      {validationError && (
        <p className="text-sm text-red-600 font-mono">{validationError}</p>
      )}
    </div>
  );
}
