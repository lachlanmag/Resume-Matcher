'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import type { FeedbackQuestion } from '@/lib/api/feedback';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/lib/i18n';

interface FeedbackQuestionStepProps {
  question: FeedbackQuestion;
  answer: string;
  questionNumber: number;
  totalQuestions: number;
  returnToReview: boolean;
  onAnswer: (answer: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

function resolveCategoryLabel(
  category: FeedbackQuestion['category'],
  t: (key: string) => string
): string {
  const key = `feedback.category.${category}`;
  const translated = t(key);
  return translated === key ? category.toUpperCase() : translated;
}

export function FeedbackQuestionStep({
  question,
  answer,
  questionNumber,
  totalQuestions,
  returnToReview,
  onAnswer,
  onBack,
  onContinue,
}: FeedbackQuestionStepProps) {
  const { t } = useTranslations();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localAnswer, setLocalAnswer] = useState(answer);

  useEffect(() => {
    setLocalAnswer(answer);
  }, [answer, question.question_id]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [question.question_id]);

  const handleContinue = useCallback(() => {
    onContinue();
  }, [onContinue]);

  const handleSkip = useCallback(() => {
    setLocalAnswer('');
    onAnswer('');
    onContinue();
  }, [onAnswer, onContinue]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleContinue();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleContinue]);

  return (
    <div className="flex h-full min-h-[500px] flex-col">
      <div className="mb-8 flex items-center justify-between">
        <span className="font-mono text-sm text-steel">
          {t('feedback.question.progress', { current: questionNumber, total: totalQuestions })}
        </span>
        <div className="flex gap-1">
          {Array.from({ length: totalQuestions }).map((_, index) => (
            <div
              key={index}
              className={`h-1.5 w-6 ${
                index <= questionNumber - 1 ? 'bg-ink' : 'bg-panel'
              } transition-colors`}
            />
          ))}
        </div>
      </div>

      <div className="mb-4">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-steel">
          {resolveCategoryLabel(question.category, t)}
        </p>
      </div>

      <div className="flex-1">
        <h2 className="mb-3 font-serif text-2xl font-bold leading-tight">{question.prompt}</h2>
        <p className="mb-6 font-mono text-xs text-steel">{question.context}</p>

        <Textarea
          ref={textareaRef}
          value={localAnswer}
          onChange={(event) => {
            const value = event.target.value;
            setLocalAnswer(value);
            onAnswer(value);
          }}
          onKeyDown={(event) => {
            // Let the Cmd/Ctrl+Enter shortcut reach the window listener; only
            // swallow a plain Enter so it inserts a newline instead of bubbling.
            if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
              event.stopPropagation();
            }
          }}
          placeholder={t('feedback.question.placeholder')}
          className="min-h-[180px] resize-none font-mono text-base"
        />

        <p className="mt-2 font-mono text-xs text-steel">{t('feedback.question.shortcutHint')}</p>
      </div>

      <div className="mt-6 flex items-center justify-between border-t-2 border-black pt-6">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <CaretLeft aria-hidden="true" className="size-4" />
          {t('common.back')}
        </Button>

        <div className="flex gap-3">
          {!returnToReview && (
            <Button variant="outline" onClick={handleSkip}>
              {t('feedback.question.skip')}
            </Button>
          )}
          <Button onClick={handleContinue} className="gap-2">
            {returnToReview ? t('feedback.saveAndReturnToReview') : t('common.continue')}
            <CaretRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
