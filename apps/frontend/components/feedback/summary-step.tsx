'use client';

import { MarkdownContent } from '@/components/common/markdown-content';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';

interface SummaryStepProps {
  reportMarkdown: string;
  questionCount: number;
  onContinue: () => void;
  onDone: () => void;
}

export function SummaryStep({
  reportMarkdown,
  questionCount,
  onContinue,
  onDone,
}: SummaryStepProps) {
  const { t } = useTranslations();
  const hasQuestions = questionCount > 0;

  return (
    <div className="flex h-full min-h-[500px] flex-col">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-steel-grey">
            {t('feedback.summary.kicker')}
          </p>
          <h2 className="font-serif text-2xl font-bold uppercase tracking-tight">
            {t('feedback.summary.title')}
          </h2>
        </div>
        <p className="font-mono text-xs text-steel-grey">
          {t('feedback.summary.questionsCount', { count: questionCount })}
        </p>
      </div>

      <div className="flex-1 overflow-hidden border-2 border-black bg-white p-4 shadow-sw-sm">
        <div className="h-full overflow-auto">
          {reportMarkdown ? (
            <MarkdownContent markdown={reportMarkdown} />
          ) : (
            <p className="text-sm italic text-steel-grey">{t('feedback.summary.empty')}</p>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end border-t-2 border-black pt-6">
        {hasQuestions ? (
          <Button onClick={onContinue}>{t('common.continue')}</Button>
        ) : (
          <Button variant="success" onClick={onDone}>
            {t('feedback.summary.done')}
          </Button>
        )}
      </div>
    </div>
  );
}
