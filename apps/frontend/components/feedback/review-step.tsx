'use client';

import type { ResumeFeedback } from '@/lib/api/feedback';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';

interface ReviewStepProps {
  feedback: ResumeFeedback;
  answers: Record<string, string>;
  onBack: () => void;
  onEdit: (index: number) => void;
  onApplyFeedback: () => void;
}

export function ReviewStep({ feedback, answers, onBack, onEdit, onApplyFeedback }: ReviewStepProps) {
  const { t } = useTranslations();

  return (
    <div className="flex h-full min-h-[500px] flex-col">
      <div className="mb-4">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-steel-grey">
          {t('feedback.review.kicker')}
        </p>
        <h2 className="font-serif text-2xl font-bold uppercase tracking-tight">{t('feedback.review.title')}</h2>
      </div>

      <div className="flex-1 overflow-hidden border-2 border-black bg-white shadow-sw-sm">
        <div className="h-full overflow-y-auto p-4">
          <div className="space-y-3">
            {feedback.questions.map((question, index) => {
              const answer = answers[question.question_id]?.trim() ?? '';
              return (
                <div key={question.question_id} className="border-2 border-black bg-background p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="mb-1 font-mono text-xs uppercase tracking-[0.2em] text-steel-grey">
                        {t('feedback.review.questionLabel', { number: index + 1 })}
                      </p>
                      <p className="font-serif text-lg font-semibold leading-tight">{question.prompt}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => onEdit(index)}>
                      {t('common.edit')}
                    </Button>
                  </div>

                  <div className="border border-black bg-white p-3">
                    {answer ? (
                      <p className="whitespace-pre-wrap font-mono text-sm text-ink-soft">{answer}</p>
                    ) : (
                      <p className="font-mono text-sm italic text-steel-grey">
                        {t('feedback.review.skipped')}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t-2 border-black pt-6">
        <Button variant="outline" onClick={onBack}>
          {t('common.back')}
        </Button>
        <Button variant="success" onClick={onApplyFeedback}>
          {t('feedback.review.applyFeedback')}
        </Button>
      </div>
    </div>
  );
}
