/**
 * API functions for tailored resume feedback.
 */

import type { ResumeData } from '@/components/dashboard/resume-component';
import type {
  ResumeDiffSummary,
  ResumeFieldDiff,
} from '@/components/common/resume_previewer_context';
import { apiPatch, apiPost } from './client';

export interface FeedbackQuestion {
  question_id: string;
  category: 'gap' | 'risk' | 'clarification' | 'improvement' | 'ats';
  prompt: string;
  context: string;
}

export interface ResumeFeedback {
  report_markdown: string;
  questions: FeedbackQuestion[];
  answers: Record<string, string>;
  generated_at: string;
  applied_at: string | null;
}

export interface FeedbackApplyPreview {
  improved_data: ResumeData;
  diff_summary: ResumeDiffSummary;
  detailed_changes: ResumeFieldDiff[];
  strategy_notes?: string;
}

async function parseFeedbackResponse(res: Response, action: string): Promise<ResumeFeedback> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to ${action} (status ${res.status}).`);
  }
  const payload = (await res.json()) as { data: ResumeFeedback };
  return payload.data;
}

/**
 * Generate and persist structured feedback for a tailored resume.
 */
export async function generateFeedback(
  resumeId: string,
  replace = false
): Promise<ResumeFeedback> {
  const res = await apiPost(`/resumes/${encodeURIComponent(resumeId)}/feedback/generate`, {
    replace,
  });
  return parseFeedbackResponse(res, 'generate feedback');
}

/**
 * Merge answer updates into persisted feedback answers.
 */
export async function patchFeedbackAnswers(
  resumeId: string,
  answers: Record<string, string>
): Promise<ResumeFeedback> {
  const res = await apiPatch(`/resumes/${encodeURIComponent(resumeId)}/feedback/answers`, {
    answers,
  });
  return parseFeedbackResponse(res, 'update feedback answers');
}

/**
 * Build a feedback-driven apply preview for a tailored resume.
 */
export async function previewFeedbackApply(resumeId: string): Promise<FeedbackApplyPreview> {
  const res = await apiPost(
    `/resumes/${encodeURIComponent(resumeId)}/feedback/apply-preview`,
    {}
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to preview feedback apply (status ${res.status}).`);
  }
  const payload = (await res.json()) as { data: FeedbackApplyPreview };
  return payload.data;
}

/**
 * Apply accepted feedback preview data and mark feedback as applied.
 */
export async function applyFeedback(resumeId: string, improvedData: ResumeData): Promise<void> {
  const res = await apiPost(`/resumes/${encodeURIComponent(resumeId)}/feedback/apply`, {
    improved_data: improvedData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to apply feedback (status ${res.status}).`);
  }
}
