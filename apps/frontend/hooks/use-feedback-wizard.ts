'use client';

import { useCallback, useReducer } from 'react';
import {
  applyFeedback,
  generateFeedback,
  patchFeedbackAnswers,
  previewFeedbackApply,
  type FeedbackApplyPreview,
  type ResumeFeedback,
} from '@/lib/api/feedback';

export type FeedbackWizardStep =
  | 'idle'
  | 'generating'
  | 'summary'
  | 'questions'
  | 'review'
  | 'generating-apply'
  | 'preview'
  | 'applying'
  | 'complete'
  | 'error';

export interface FeedbackWizardState {
  step: FeedbackWizardStep;
  feedback: ResumeFeedback | null;
  currentQuestionIndex: number;
  returnToReview: boolean;
  answers: Record<string, string>;
  preview: FeedbackApplyPreview | null;
  error: string | null;
}

type FeedbackWizardAction =
  | { type: 'LOAD_FEEDBACK'; feedback: ResumeFeedback; answers: Record<string, string> }
  | { type: 'START_GENERATE' }
  | { type: 'START_APPLY_PREVIEW' }
  | { type: 'START_APPLY' }
  | { type: 'SET_ANSWER'; questionId: string; answer: string }
  | { type: 'SET_QUESTIONS_STEP'; index: number; returnToReview: boolean }
  | { type: 'PREV_QUESTION' }
  | { type: 'NEXT_QUESTION' }
  | { type: 'GO_REVIEW' }
  | { type: 'SET_PREVIEW'; preview: FeedbackApplyPreview }
  | { type: 'SET_COMPLETE' }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'RESET' };

const initialState: FeedbackWizardState = {
  step: 'idle',
  feedback: null,
  currentQuestionIndex: 0,
  returnToReview: false,
  answers: {},
  preview: null,
  error: null,
};

function hydrateAnswers(feedback: ResumeFeedback): Record<string, string> {
  const hydrated: Record<string, string> = {};
  for (const question of feedback.questions) {
    hydrated[question.question_id] = feedback.answers[question.question_id] ?? '';
  }
  return hydrated;
}

function clampQuestionIndex(index: number, feedback: ResumeFeedback | null): number {
  if (!feedback || feedback.questions.length === 0) {
    return 0;
  }
  return Math.max(0, Math.min(index, feedback.questions.length - 1));
}

function feedbackWizardReducer(
  state: FeedbackWizardState,
  action: FeedbackWizardAction
): FeedbackWizardState {
  switch (action.type) {
    case 'LOAD_FEEDBACK':
      return {
        ...state,
        step: 'summary',
        feedback: action.feedback,
        answers: action.answers,
        currentQuestionIndex: 0,
        returnToReview: false,
        preview: null,
        error: null,
      };

    case 'START_GENERATE':
      return {
        ...state,
        step: 'generating',
        error: null,
        preview: null,
      };

    case 'START_APPLY_PREVIEW':
      return {
        ...state,
        step: 'generating-apply',
        error: null,
      };

    case 'START_APPLY':
      return {
        ...state,
        step: 'applying',
        error: null,
      };

    case 'SET_ANSWER':
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.questionId]: action.answer,
        },
      };

    case 'SET_QUESTIONS_STEP':
      return {
        ...state,
        step: 'questions',
        currentQuestionIndex: clampQuestionIndex(action.index, state.feedback),
        returnToReview: action.returnToReview,
        error: null,
      };

    case 'PREV_QUESTION':
      return {
        ...state,
        step: 'questions',
        currentQuestionIndex: clampQuestionIndex(state.currentQuestionIndex - 1, state.feedback),
        returnToReview: false,
      };

    case 'NEXT_QUESTION': {
      if (!state.feedback || state.feedback.questions.length === 0) {
        return {
          ...state,
          step: 'review',
          returnToReview: false,
        };
      }

      const isLastQuestion = state.currentQuestionIndex >= state.feedback.questions.length - 1;
      if (isLastQuestion) {
        return {
          ...state,
          step: 'review',
          returnToReview: false,
        };
      }

      return {
        ...state,
        step: 'questions',
        currentQuestionIndex: state.currentQuestionIndex + 1,
        returnToReview: false,
      };
    }

    case 'GO_REVIEW':
      return {
        ...state,
        step: 'review',
        returnToReview: false,
        error: null,
      };

    case 'SET_PREVIEW':
      return {
        ...state,
        step: 'preview',
        preview: action.preview,
        error: null,
      };

    case 'SET_COMPLETE':
      return {
        ...state,
        step: 'complete',
        error: null,
      };

    case 'SET_ERROR':
      return {
        ...state,
        step: 'error',
        error: action.error,
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

function findFirstUnansweredQuestionIndex(
  feedback: ResumeFeedback,
  answers: Record<string, string>
): number {
  return feedback.questions.findIndex((question) => !(answers[question.question_id] ?? '').trim());
}

export interface UseFeedbackWizardReturn {
  state: FeedbackWizardState;
  currentQuestion: ResumeFeedback['questions'][number] | undefined;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  answeredCount: number;
  totalQuestions: number;
  loadFeedback: (feedback: ResumeFeedback | null) => void;
  startGenerate: (replace?: boolean) => Promise<void>;
  continueFromSummary: () => void;
  setAnswer: (questionId: string, answer: string) => void;
  nextQuestion: () => Promise<void>;
  prevQuestion: () => void;
  editFromReview: (index: number) => void;
  saveAndReturnToReview: () => Promise<void>;
  backFromQuestion: () => void;
  backFromReview: () => void;
  returnToReview: () => void;
  startApplyPreview: () => Promise<void>;
  applyAccepted: () => Promise<void>;
  reset: () => void;
  retry: () => Promise<void>;
  regenerateFeedback: () => Promise<void>;
  showGeneratingStep: () => void;
  showErrorStep: (error: string) => void;
}

export interface UseFeedbackWizardOptions {
  onGenerated?: (feedback: ResumeFeedback) => void;
}

export function useFeedbackWizard(
  resumeId: string,
  options: UseFeedbackWizardOptions = {}
): UseFeedbackWizardReturn {
  const [state, dispatch] = useReducer(feedbackWizardReducer, initialState);
  const { onGenerated } = options;

  const persistAnswers = useCallback(
    async (answers: Record<string, string>) => {
      await patchFeedbackAnswers(resumeId, answers);
    },
    [resumeId]
  );

  const loadFeedback = useCallback((feedback: ResumeFeedback | null) => {
    if (!feedback) {
      dispatch({ type: 'RESET' });
      return;
    }

    dispatch({
      type: 'LOAD_FEEDBACK',
      feedback,
      answers: hydrateAnswers(feedback),
    });
  }, []);

  const showGeneratingStep = useCallback(() => {
    dispatch({ type: 'START_GENERATE' });
  }, []);

  const showErrorStep = useCallback((error: string) => {
    dispatch({ type: 'SET_ERROR', error });
  }, []);

  const startGenerate = useCallback(
    async (replace = false) => {
      dispatch({ type: 'START_GENERATE' });

      try {
        const feedback = await generateFeedback(resumeId, replace);
        dispatch({
          type: 'LOAD_FEEDBACK',
          feedback,
          answers: hydrateAnswers(feedback),
        });
        onGenerated?.(feedback);
      } catch (error) {
        dispatch({
          type: 'SET_ERROR',
          error: error instanceof Error ? error.message : 'Failed to generate feedback',
        });
      }
    },
    [resumeId, onGenerated]
  );

  const continueFromSummary = useCallback(() => {
    if (!state.feedback) {
      return;
    }

    if (state.feedback.questions.length === 0) {
      return;
    }

    const firstUnanswered = findFirstUnansweredQuestionIndex(state.feedback, state.answers);
    if (firstUnanswered === -1) {
      dispatch({ type: 'GO_REVIEW' });
      return;
    }

    dispatch({
      type: 'SET_QUESTIONS_STEP',
      index: firstUnanswered,
      returnToReview: false,
    });
  }, [state.feedback, state.answers]);

  const setAnswer = useCallback((questionId: string, answer: string) => {
    dispatch({ type: 'SET_ANSWER', questionId, answer });
  }, []);

  const nextQuestion = useCallback(async () => {
    const answersToPersist = state.answers;
    void persistAnswers(answersToPersist).catch(() => {
      // Keep question flow responsive even if incremental save fails.
    });
    dispatch({ type: 'NEXT_QUESTION' });
  }, [state.answers, persistAnswers]);

  const prevQuestion = useCallback(() => {
    dispatch({ type: 'PREV_QUESTION' });
  }, []);

  const editFromReview = useCallback((index: number) => {
    dispatch({ type: 'SET_QUESTIONS_STEP', index, returnToReview: true });
  }, []);

  const saveAndReturnToReview = useCallback(async () => {
    try {
      const feedback = await patchFeedbackAnswers(resumeId, state.answers);
      dispatch({
        type: 'LOAD_FEEDBACK',
        feedback,
        answers: hydrateAnswers(feedback),
      });
      dispatch({ type: 'GO_REVIEW' });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        error: error instanceof Error ? error.message : 'Failed to save feedback answers',
      });
    }
  }, [resumeId, state.answers]);

  const backFromQuestion = useCallback(() => {
    if (state.returnToReview) {
      dispatch({ type: 'GO_REVIEW' });
      return;
    }
    dispatch({ type: 'PREV_QUESTION' });
  }, [state.returnToReview]);

  const backFromReview = useCallback(() => {
    if (!state.feedback || state.feedback.questions.length === 0) {
      return;
    }

    dispatch({
      type: 'SET_QUESTIONS_STEP',
      index: state.feedback.questions.length - 1,
      returnToReview: false,
    });
  }, [state.feedback]);

  const returnToReview = useCallback(() => {
    dispatch({ type: 'GO_REVIEW' });
  }, []);

  const startApplyPreview = useCallback(async () => {
    dispatch({ type: 'START_APPLY_PREVIEW' });

    try {
      const preview = await previewFeedbackApply(resumeId);
      dispatch({ type: 'SET_PREVIEW', preview });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        error: error instanceof Error ? error.message : 'Failed to generate apply preview',
      });
    }
  }, [resumeId]);

  const applyAccepted = useCallback(async () => {
    if (!state.preview) {
      dispatch({
        type: 'SET_ERROR',
        error: 'No preview available to apply',
      });
      return;
    }

    dispatch({ type: 'START_APPLY' });

    try {
      await applyFeedback(resumeId, state.preview.improved_data);
      dispatch({ type: 'SET_COMPLETE' });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        error: error instanceof Error ? error.message : 'Failed to apply feedback',
      });
    }
  }, [resumeId, state.preview]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const retry = useCallback(async () => {
    if (state.preview) {
      await applyAccepted();
      return;
    }

    if (state.feedback) {
      continueFromSummary();
      return;
    }

    await startGenerate();
  }, [state.preview, state.feedback, applyAccepted, continueFromSummary, startGenerate]);

  const regenerateFeedback = useCallback(async () => {
    await startGenerate(true);
  }, [startGenerate]);

  const currentQuestion =
    state.feedback && state.feedback.questions.length > 0
      ? state.feedback.questions[state.currentQuestionIndex]
      : undefined;

  const totalQuestions = state.feedback?.questions.length ?? 0;
  const isFirstQuestion = state.currentQuestionIndex === 0;
  const isLastQuestion = totalQuestions > 0 && state.currentQuestionIndex === totalQuestions - 1;
  const answeredCount = Object.values(state.answers).filter((answer) => answer.trim() !== '').length;

  return {
    state,
    currentQuestion,
    isFirstQuestion,
    isLastQuestion,
    answeredCount,
    totalQuestions,
    loadFeedback,
    startGenerate,
    continueFromSummary,
    setAnswer,
    nextQuestion,
    prevQuestion,
    editFromReview,
    saveAndReturnToReview,
    backFromQuestion,
    backFromReview,
    returnToReview,
    startApplyPreview,
    applyAccepted,
    reset,
    retry,
    regenerateFeedback,
    showGeneratingStep,
    showErrorStep,
  };
}
