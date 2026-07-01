'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, RefreshCw, XIcon, Loader2 } from 'lucide-react';
import type { RegeneratedItem } from '@/lib/api/enrichment';
import type { ResumeFeedback, FeedbackApplyPreview } from '@/lib/api/feedback';
import { useFeedbackWizard } from '@/hooks/use-feedback-wizard';
import { useElapsedSeconds } from '@/hooks/use-elapsed-seconds';
import { useTranslations } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { RegenerateDiffPreview } from '@/components/builder/regenerate-diff-preview';
import {
  ApplyingStep,
  CompleteStep,
  ErrorStep,
  FeedbackGeneratingStep,
  GeneratingStep,
} from '@/components/enrichment/loading-steps';
import { SummaryStep } from './summary-step';
import { FeedbackQuestionStep } from './feedback-question-step';
import { ReviewStep } from './review-step';

interface FeedbackModalProps {
  resumeId: string;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  initialFeedback?: ResumeFeedback | null;
  backgroundGenStatus?: 'idle' | 'loading' | 'ready' | 'error';
  backgroundGenError?: string | null;
  onRequestGeneration?: (replace: boolean) => void;
}

function mapPreviewToRegeneratedItems(preview: FeedbackApplyPreview | null): RegeneratedItem[] {
  if (!preview) {
    return [];
  }

  return preview.detailed_changes.map((change, index) => {
    const fieldPath = change.field_path || `change-${index + 1}`;
    return {
      item_id: `${fieldPath}-${index}`,
      item_type:
        change.field_type === 'experience'
          ? 'experience'
          : change.field_type === 'project'
            ? 'project'
            : change.field_type === 'summary'
              ? 'summary'
              : 'skills',
      title: fieldPath,
      original_content: change.original_value ? [change.original_value] : [],
      new_content: change.new_value ? [change.new_value] : [],
      diff_summary: `${change.change_type.toUpperCase()} • ${fieldPath}`,
    };
  });
}

export function FeedbackModal({
  resumeId,
  isOpen,
  onClose,
  onComplete,
  initialFeedback = null,
  backgroundGenStatus = 'idle',
  backgroundGenError = null,
  onRequestGeneration,
}: FeedbackModalProps) {
  const { t } = useTranslations();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const hasInitializedRef = useRef(false);
  const [isRegenerateConfirmOpen, setIsRegenerateConfirmOpen] = useState(false);

  const {
    state,
    currentQuestion,
    isFirstQuestion,
    totalQuestions,
    loadFeedback,
    continueFromSummary,
    setAnswer,
    nextQuestion,
    editFromReview,
    saveAndReturnToReview,
    backFromQuestion,
    backFromReview,
    returnToReview,
    startApplyPreview,
    applyAccepted,
    reset,
    showGeneratingStep,
    showErrorStep,
  } = useFeedbackWizard(resumeId);

  const previewItems = useMemo(() => mapPreviewToRegeneratedItems(state.preview), [state.preview]);

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
      document.body.style.overflow = 'hidden';
    } else {
      dialogRef.current?.close();
      document.body.style.overflow = 'auto';
      hasInitializedRef.current = false;
    }

    const dialog = dialogRef.current;
    return () => {
      document.body.style.overflow = 'auto';
      if (dialog?.open) {
        dialog.close();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;

    if (backgroundGenStatus === 'loading') {
      showGeneratingStep();
      return;
    }

    if (backgroundGenStatus === 'error') {
      showErrorStep(backgroundGenError || t('enrichment.error.unexpected'));
      return;
    }

    if (initialFeedback) {
      loadFeedback(initialFeedback);
      return;
    }

    showGeneratingStep();
  }, [
    isOpen,
    initialFeedback,
    backgroundGenStatus,
    backgroundGenError,
    loadFeedback,
    showGeneratingStep,
    showErrorStep,
    t,
  ]);

  // Sync completed background generation into the wizard when the modal is open.
  useEffect(() => {
    if (!isOpen || !initialFeedback || backgroundGenStatus !== 'ready') {
      return;
    }

    if (state.step !== 'generating' && state.step !== 'idle') {
      return;
    }

    if (state.feedback?.generated_at === initialFeedback.generated_at) {
      return;
    }

    loadFeedback(initialFeedback);
  }, [
    isOpen,
    initialFeedback,
    backgroundGenStatus,
    state.step,
    state.feedback?.generated_at,
    loadFeedback,
  ]);

  useEffect(() => {
    if (!isOpen || backgroundGenStatus !== 'error') {
      return;
    }

    if (state.step === 'generating') {
      showErrorStep(backgroundGenError || t('enrichment.error.unexpected'));
    }
  }, [isOpen, backgroundGenStatus, backgroundGenError, state.step, showErrorStep, t]);

  useEffect(() => {
    if (!isOpen || backgroundGenStatus !== 'loading') {
      return;
    }

    if (state.step === 'generating-apply' || state.step === 'applying' || state.step === 'preview') {
      return;
    }

    showGeneratingStep();
  }, [isOpen, backgroundGenStatus, state.step, showGeneratingStep]);

  const isBackgroundGenerating = backgroundGenStatus === 'loading';
  const isLocked =
    state.step === 'generating-apply' ||
    state.step === 'applying' ||
    (state.step === 'generating' && !isBackgroundGenerating);
  const feedbackGenElapsed = useElapsedSeconds(isBackgroundGenerating);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleDone = () => {
    reset();
    onComplete();
  };

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (isRegenerateConfirmOpen) {
      return;
    }
    if (event.target === dialogRef.current && !isLocked) {
      handleClose();
    }
  };

  const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement, Event>) => {
    if (isRegenerateConfirmOpen) {
      event.preventDefault();
      setIsRegenerateConfirmOpen(false);
      return;
    }
    if (isLocked) {
      event.preventDefault();
      return;
    }
    handleClose();
  };

  const handleQuestionContinue = () => {
    if (state.returnToReview) {
      void saveAndReturnToReview();
      return;
    }
    void nextQuestion();
  };

  const handleRegenerate = () => {
    setIsRegenerateConfirmOpen(false);
    showGeneratingStep();
    onRequestGeneration?.(true);
  };

  const handleGenerationRetry = () => {
    showGeneratingStep();
    onRequestGeneration?.(Boolean(initialFeedback));
  };

  if (!isOpen) {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none border-none bg-transparent p-0"
      onClick={handleBackdropClick}
      onCancel={handleCancel}
    >
      <div className="absolute inset-0 bg-black/40" />

      <div className="absolute inset-0 flex items-center justify-center p-5 sm:p-10">
        <div className="relative flex h-full w-full max-w-[1200px] flex-col overflow-hidden border-2 border-black bg-white shadow-sw-lg">
          {isRegenerateConfirmOpen && (
            <div
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4"
              onClick={() => setIsRegenerateConfirmOpen(false)}
            >
              <div
                className="w-full max-w-md border-2 border-black bg-background shadow-sw-lg"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="feedback-regenerate-title"
                aria-describedby="feedback-regenerate-description"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start gap-4 border-b border-black p-6">
                  <div className="flex h-12 w-12 items-center justify-center border-2 border-orange-500 bg-orange-50">
                    <span className="text-2xl font-bold text-orange-500">!</span>
                  </div>
                  <div className="flex-1">
                    <h2
                      id="feedback-regenerate-title"
                      className="font-serif text-xl font-bold uppercase tracking-tight"
                    >
                      {t('feedback.regenerateDialog.title')}
                    </h2>
                    <p
                      id="feedback-regenerate-description"
                      className="mt-2 font-mono text-xs text-ink-soft"
                    >
                      {t('feedback.regenerateDialog.description')}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-3 border-t border-black bg-secondary p-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-none border-black"
                    onClick={() => setIsRegenerateConfirmOpen(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    type="button"
                    variant="warning"
                    className="rounded-none"
                    onClick={handleRegenerate}
                  >
                    {t('feedback.regenerateDialog.confirm')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-b-2 border-black bg-paper-tint px-6 py-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5" />
                <h1 className="font-serif text-xl font-bold uppercase tracking-tight">
                  {t('feedback.modal.title')}
                </h1>
              </div>

              <div className="flex items-center gap-2">
                {!isLocked && !isRegenerateConfirmOpen && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={isBackgroundGenerating}
                    onClick={() => setIsRegenerateConfirmOpen(true)}
                  >
                    {isBackgroundGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {t('feedback.regenerate')}
                    {isBackgroundGenerating && feedbackGenElapsed > 0 && (
                      <span className="font-mono text-xs opacity-70">{feedbackGenElapsed}s</span>
                    )}
                  </Button>
                )}
                {(!isLocked || isBackgroundGenerating) && !isRegenerateConfirmOpen && (
                  <button type="button" onClick={handleClose} className="p-1 hover:bg-background">
                    <XIcon className="h-5 w-5" />
                    <span className="sr-only">{t('common.close')}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-hidden p-6">{renderStep()}</div>
          </div>
        </div>
      </dialog>
  );

  function renderStep() {
    switch (state.step) {
      case 'idle':
      case 'generating':
        return <FeedbackGeneratingStep elapsedSeconds={feedbackGenElapsed} />;

      case 'summary':
        return (
          <SummaryStep
            reportMarkdown={state.feedback?.report_markdown ?? ''}
            questionCount={state.feedback?.questions.length ?? 0}
            onContinue={continueFromSummary}
            onDone={handleDone}
          />
        );

      case 'questions':
        if (!currentQuestion) {
          return <FeedbackGeneratingStep elapsedSeconds={feedbackGenElapsed} />;
        }
        return (
          <FeedbackQuestionStep
            question={currentQuestion}
            answer={state.answers[currentQuestion.question_id] || ''}
            questionNumber={state.currentQuestionIndex + 1}
            totalQuestions={totalQuestions}
            isFirst={isFirstQuestion}
            returnToReview={state.returnToReview}
            onAnswer={(answer) => setAnswer(currentQuestion.question_id, answer)}
            onBack={backFromQuestion}
            onContinue={handleQuestionContinue}
          />
        );

      case 'review':
        if (!state.feedback) {
          return <FeedbackGeneratingStep elapsedSeconds={feedbackGenElapsed} />;
        }
        return (
          <ReviewStep
            feedback={state.feedback}
            answers={state.answers}
            onBack={backFromReview}
            onEdit={editFromReview}
            onApplyFeedback={() => {
              void startApplyPreview();
            }}
          />
        );

      case 'generating-apply':
        return <GeneratingStep />;

      case 'preview':
        return (
          <RegenerateDiffPreview
            open
            onOpenChange={(open) => {
              if (!open) {
                returnToReview();
              }
            }}
            regeneratedItems={previewItems}
            error={state.error}
            onAccept={() => {
              void applyAccepted();
            }}
            onReject={returnToReview}
            isApplying={false}
          />
        );

      case 'applying':
        return <ApplyingStep />;

      case 'complete':
        return <CompleteStep onClose={handleDone} updatedCount={state.preview?.diff_summary.total_changes} />;

      case 'error':
        return (
          <ErrorStep
            error={state.error || backgroundGenError || t('enrichment.error.unexpected')}
            onRetry={handleGenerationRetry}
            onClose={handleClose}
          />
        );

      default:
        return null;
    }
  }
}
