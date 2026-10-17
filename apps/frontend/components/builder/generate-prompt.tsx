'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
<<<<<<< HEAD
import { EmptyState } from '@/components/ui/empty-state';
import { SpinnerGap } from '@phosphor-icons/react';
=======
import { Sparkles, Loader2, FileText, Mail, ClipboardList, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
>>>>>>> origin/main
import { useTranslations } from '@/lib/i18n';

export interface GeneratePromptProps {
  /** Type of content to generate */
<<<<<<< HEAD
  type: 'cover-letter' | 'outreach' | 'interview-prep';
=======
  type: 'cover-letter' | 'outreach' | 'feedback';
>>>>>>> origin/main
  /** Whether generation is in progress */
  isGenerating: boolean;
  /** Callback to trigger generation */
  onGenerate: () => void;
  /** Whether this is a tailored resume (has job context) */
  isTailoredResume: boolean;
  /** Additional class names */
  className?: string;
}

export function GeneratePrompt({
  type,
  isGenerating,
  onGenerate,
  isTailoredResume,
  className,
}: GeneratePromptProps) {
  const { t } = useTranslations();
  const isOutreach = type === 'outreach';
<<<<<<< HEAD
  const isInterviewPrep = type === 'interview-prep';
  const title = isInterviewPrep
    ? t('interviewPrep.title')
=======
  const isFeedback = type === 'feedback';
  const Icon = isFeedback ? ClipboardList : isOutreach ? Mail : FileText;
  const title = isFeedback
    ? t('feedback.title')
>>>>>>> origin/main
    : isOutreach
      ? t('outreach.title')
      : t('coverLetter.title');

  // Show a different message if resume is not tailored
  if (!isTailoredResume) {
    return (
      <EmptyState
        className={className}
        title={t('builder.generatePrompt.notAvailableTitle', { title })}
        description={t('builder.generatePrompt.notAvailableDescription', { title })}
        action={
          <p className="font-mono text-xs uppercase tracking-wider text-ink-soft">
            {t('builder.generatePrompt.goToDashboard')}
          </p>
        }
      />
    );
  }

  const description = isFeedback
    ? t('builder.generatePrompt.feedbackDescription')
    : isOutreach
      ? t('builder.generatePrompt.outreachDescription')
      : t('builder.generatePrompt.coverLetterDescription');

  const footer = isFeedback
    ? t('builder.generatePrompt.feedbackFooter')
    : isOutreach
      ? t('builder.generatePrompt.outreachFooter')
      : t('builder.generatePrompt.coverLetterFooter');

  return (
<<<<<<< HEAD
    <EmptyState
      className={className}
      title={t('builder.generatePrompt.generateTitle', { title })}
      description={
        isInterviewPrep
          ? t('builder.generatePrompt.interviewPrepDescription')
          : isOutreach
            ? t('builder.generatePrompt.outreachDescription')
            : t('builder.generatePrompt.coverLetterDescription')
      }
      action={
        <div className="flex flex-col items-start gap-3">
          <Button onClick={onGenerate} disabled={isGenerating}>
            {isGenerating && <SpinnerGap aria-hidden="true" className="animate-spin" />}
            {isGenerating
              ? t('common.generating')
              : t('builder.generatePrompt.generateButton', { title })}
          </Button>
          <p className="font-mono text-xs text-steel">
            {isInterviewPrep
              ? t('builder.generatePrompt.interviewPrepFooter')
              : isOutreach
                ? t('builder.generatePrompt.outreachFooter')
                : t('builder.generatePrompt.coverLetterFooter')}
          </p>
        </div>
      }
    />
=======
    <div
      className={cn(
        'flex flex-col items-center justify-center min-h-[400px] p-12 text-center',
        className
      )}
    >
      <div className="w-16 h-16 border-2 border-blue-700 bg-blue-50 flex items-center justify-center mb-6">
        <Icon className="w-8 h-8 text-blue-700" />
      </div>
      <h3 className="font-mono text-sm font-bold uppercase tracking-wider mb-3">
        {t('builder.generatePrompt.generateTitle', { title })}
      </h3>
      <p className="font-mono text-xs text-ink-soft max-w-md mb-6 leading-relaxed">{description}</p>
      <Button onClick={onGenerate} disabled={isGenerating} className="gap-2">
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('common.generating')}
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            {t('builder.generatePrompt.generateButton', { title })}
          </>
        )}
      </Button>
      <p className="font-mono text-xs text-steel-grey mt-4">{footer}</p>
    </div>
>>>>>>> origin/main
  );
}
