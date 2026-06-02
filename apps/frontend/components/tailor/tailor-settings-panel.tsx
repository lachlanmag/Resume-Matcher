'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { TailorLengthControls } from './tailor-length-controls';
import {
  type TailorLengthSettings,
  DEFAULT_TAILOR_LENGTH_SETTINGS,
  validateTailorLengthSettings,
} from '@/lib/types/tailor-length';
import {
  applyTailorLength,
  improveResume,
  patchTailorSettings,
} from '@/lib/api/resume';
import type { ResumeData } from '@/components/dashboard/resume-component';
import { useTranslations } from '@/lib/i18n';

export interface TailorSettingsPanelProps {
  resumeId: string;
  masterResumeId: string;
  jobId: string;
  initialSettings?: TailorLengthSettings | null;
  onResumeUpdated: (data: ResumeData) => void;
  onError?: (message: string) => void;
}

export function TailorSettingsPanel({
  resumeId,
  masterResumeId,
  jobId,
  initialSettings,
  onResumeUpdated,
  onError,
}: TailorSettingsPanelProps) {
  const { t } = useTranslations();
  const [settings, setSettings] = useState<TailorLengthSettings>(
    initialSettings ?? DEFAULT_TAILOR_LENGTH_SETTINGS
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isRetailoring, setIsRetailoring] = useState(false);

  const validationError = validateTailorLengthSettings(settings);

  const handleSave = async () => {
    if (validationError) return;
    setIsSaving(true);
    try {
      await patchTailorSettings(resumeId, settings);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : t('builder.tailorLength.errors.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleApply = async () => {
    if (validationError) return;
    setIsApplying(true);
    try {
      await patchTailorSettings(resumeId, settings);
      const result = await applyTailorLength(resumeId, settings);
      onResumeUpdated(result.resume_preview);
      if (result.warnings?.length) {
        onError?.(result.warnings.join(' '));
      }
    } catch (e) {
      onError?.(e instanceof Error ? e.message : t('builder.tailorLength.errors.applyFailed'));
    } finally {
      setIsApplying(false);
    }
  };

  const handleReTailor = async () => {
    if (validationError) return;
    if (!window.confirm(t('builder.tailorLength.reTailorConfirm'))) return;
    setIsRetailoring(true);
    try {
      const result = await improveResume(masterResumeId, jobId, {
        tailorLengthSettings: settings,
        replaceResumeId: resumeId,
      });
      const preview = result.data.resume_preview;
      if (preview && typeof preview === 'object' && !Array.isArray(preview)) {
        onResumeUpdated(preview as ResumeData);
      }
    } catch (e) {
      onError?.(e instanceof Error ? e.message : t('builder.tailorLength.errors.reTailorFailed'));
    } finally {
      setIsRetailoring(false);
    }
  };

  return (
    <div className="border-2 border-black bg-white p-4 space-y-4">
      <h3 className="font-mono text-sm font-bold uppercase tracking-wider">
        {t('builder.tailorLength.title')}
      </h3>
      <TailorLengthControls
        settings={settings}
        onChange={setSettings}
        disabled={isSaving || isApplying || isRetailoring}
        showDescription={false}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={Boolean(validationError) || isSaving || isApplying || isRetailoring}
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.save')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleApply}
          disabled={Boolean(validationError) || isSaving || isApplying || isRetailoring}
        >
          {isApplying ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            t('builder.tailorLength.applyConstraints')
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReTailor}
          disabled={Boolean(validationError) || isSaving || isApplying || isRetailoring}
        >
          {isRetailoring ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            t('builder.tailorLength.reTailor')
          )}
        </Button>
      </div>
    </div>
  );
}
