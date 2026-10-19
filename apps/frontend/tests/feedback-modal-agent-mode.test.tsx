import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AgentPromptDialog } from '@/components/agent/agent-prompt-dialog';
import { FeedbackModal } from '@/components/feedback/feedback-modal';
import type { ResumeFeedback } from '@/lib/api/feedback';

/**
 * Agent mode: the feedback modal still shows the agent's report and saves the
 * user's answers, but writing and applying feedback go to the coding agent.
 */

const api = vi.hoisted(() => ({
  patchFeedbackAnswers: vi.fn(),
  previewFeedbackApply: vi.fn(),
  applyFeedback: vi.fn(),
  generateFeedback: vi.fn(),
}));

vi.mock('@/lib/api/feedback', () => ({
  patchFeedbackAnswers: (...args: unknown[]) => api.patchFeedbackAnswers(...args),
  previewFeedbackApply: (...args: unknown[]) => api.previewFeedbackApply(...args),
  applyFeedback: (...args: unknown[]) => api.applyFeedback(...args),
  generateFeedback: (...args: unknown[]) => api.generateFeedback(...args),
}));
// Echo the key with its params, so a prompt shows which values it carries.
vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}${JSON.stringify(params)}` : key,
  }),
}));

const FEEDBACK: ResumeFeedback = {
  report_markdown: '## Strengths\n\nGood.',
  questions: [{ question_id: 'q1', category: 'gap', prompt: 'Kubernetes?', context: '' }],
  answers: {},
  generated_at: '2026-10-19T00:00:00+00:00',
  applied_at: null,
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.patchFeedbackAnswers.mockImplementation(
    async (_id: string, answers: Record<string, string>) => ({ ...FEEDBACK, answers })
  );
  // jsdom has no modal dialogs.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };
});

afterEach(() => vi.restoreAllMocks());

function renderModal(initialFeedback: ResumeFeedback | null) {
  const onClose = vi.fn();
  const onAgentTask = vi.fn();
  render(
    <FeedbackModal
      resumeId="res-1"
      isOpen
      onClose={onClose}
      onComplete={vi.fn()}
      initialFeedback={initialFeedback}
      onAgentTask={onAgentTask}
    />
  );
  return { onClose, onAgentTask };
}

describe('FeedbackModal in agent mode', () => {
  it('saves the answers, then hands applying them to the agent', async () => {
    const { onClose, onAgentTask } = renderModal(FEEDBACK);
    fireEvent.click(screen.getByRole('button', { name: 'common.continue' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Yes, staging cluster.' } });
    await act(async () => screen.getByRole('button', { name: 'common.continue' }).click());
    await act(async () =>
      screen.getByRole('button', { name: 'feedback.review.applyFeedback' }).click()
    );

    expect(api.patchFeedbackAnswers).toHaveBeenCalledWith('res-1', {
      q1: 'Yes, staging cluster.',
    });
    expect(api.previewFeedbackApply).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(onAgentTask).toHaveBeenCalledWith('applyFeedback');
  });

  it('hands Regenerate to the agent instead of generating', async () => {
    const { onAgentTask } = renderModal(FEEDBACK);
    fireEvent.click(screen.getByRole('button', { name: /feedback.regenerate/ }));
    await act(async () =>
      screen.getByRole('button', { name: 'feedback.regenerateDialog.confirm' }).click()
    );
    expect(onAgentTask).toHaveBeenCalledWith('feedback');
    expect(api.generateFeedback).not.toHaveBeenCalled();
  });

  it('asks the agent for feedback when there is none, instead of waiting for it', () => {
    const { onClose, onAgentTask } = renderModal(null);
    expect(onClose).toHaveBeenCalled();
    expect(onAgentTask).toHaveBeenCalledWith('feedback');
  });
});

describe('AgentPromptDialog tailoring length', () => {
  const LENGTH = { target_pages: 1, bullets_per_job_min: 2, bullets_per_job_max: 4 };
  const promptText = () => document.querySelector('pre')?.textContent ?? '';

  it.each(['applyLength', 'retailor'] as const)('puts the length in the %s prompt', (task) => {
    render(
      <AgentPromptDialog task={task} resumeId="res-1" tailorLength={LENGTH} onClose={vi.fn()} />
    );
    expect(promptText()).toBe(
      `agentPrompt.${task}.prompt{"resumeId":"res-1","targetPages":1,"min":2,"max":4}`
    );
  });

  it('adds the length after the job in the tailor prompt', () => {
    render(
      <AgentPromptDialog
        task="tailor"
        resumeId="m1"
        jobDescription="A job"
        tailorLength={LENGTH}
        onClose={vi.fn()}
      />
    );
    expect(promptText()).toBe(
      'agentPrompt.tailor.promptWithJob{"resumeId":"m1","job":"A job"}\n\n' +
        'agentPrompt.tailor.length{"targetPages":1,"min":2,"max":4}'
    );
  });

  it('leaves the length out of prompts that do not use it', () => {
    render(
      <AgentPromptDialog
        task="coverLetter"
        resumeId="res-1"
        tailorLength={LENGTH}
        onClose={vi.fn()}
      />
    );
    expect(promptText()).toBe('agentPrompt.coverLetter.prompt{"resumeId":"res-1"}');
  });
});
