import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { AGENT_REFRESH_INTERVAL_MS } from '@/hooks/use-agent-refresh';

/**
 * Agent mode and the fork's features on a tailored resume: the builder makes no
 * AI calls for feedback or tailoring length, hands that work to the agent, and
 * shows the feedback and length settings the agent saves.
 */

type Resume = Record<string, unknown> & { summary: string };

const server = vi.hoisted(() => ({
  resume: null as unknown as Resume,
  feedback: null as Record<string, unknown> | null,
  tailorSettings: null as Record<string, number> | null,
}));
const form = vi.hoisted(() => ({ mounts: 0 }));
const api = vi.hoisted(() => ({
  fetchResume: vi.fn(),
  updateResume: vi.fn(),
  patchTailorSettings: vi.fn(),
  applyTailorLength: vi.fn(),
  improveResume: vi.fn(),
  generateFeedback: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('id=res-1'),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock('@/lib/api/resume', () => ({
  fetchResume: (...args: unknown[]) => api.fetchResume(...args),
  updateResume: (...args: unknown[]) => api.updateResume(...args),
  patchTailorSettings: (...args: unknown[]) => api.patchTailorSettings(...args),
  applyTailorLength: (...args: unknown[]) => api.applyTailorLength(...args),
  improveResume: (...args: unknown[]) => api.improveResume(...args),
  updateCoverLetter: vi.fn(),
  downloadResumePdf: vi.fn(),
  downloadCoverLetterPdf: vi.fn(),
  getResumePdfUrl: vi.fn(() => ''),
  getCoverLetterPdfUrl: vi.fn(() => ''),
  updateOutreachMessage: vi.fn(),
  generateCoverLetter: vi.fn(),
  generateOutreachMessage: vi.fn(),
  generateInterviewPrep: vi.fn(),
  fetchJobDescription: vi.fn(() => Promise.resolve({ content: 'A job', job_id: 'job-1' })),
}));
vi.mock('@/lib/api/feedback', () => ({
  generateFeedback: (...args: unknown[]) => api.generateFeedback(...args),
}));
vi.mock('@/lib/api/config', () => ({
  fetchFeatureConfig: () => Promise.resolve({ enable_resume_feedback: true }),
}));
vi.mock('@/lib/i18n', () => ({ useTranslations: () => ({ t: (key: string) => key }) }));
vi.mock('@/lib/context/language-context', () => ({
  useLanguage: () => ({ uiLanguage: 'en', contentLanguage: 'en' }),
}));
vi.mock('@/components/common/resume_previewer_context', () => ({
  useResumePreview: () => ({ improvedData: null }),
}));
vi.mock('@/components/preview', () => ({ PaginatedPreview: () => null }));
vi.mock('@/components/builder/resume-form', () => ({
  ResumeForm: function ResumeFormMock({ resumeData }: { resumeData: Resume }) {
    React.useEffect(() => {
      form.mounts += 1;
    }, []);
    return <output data-testid="summary">{resumeData.summary}</output>;
  },
}));
// The modal's own behaviour is tested in feedback-modal-agent-mode.test.tsx.
vi.mock('@/components/feedback/feedback-modal', () => ({
  FeedbackModal: ({
    isOpen,
    initialFeedback,
  }: {
    isOpen: boolean;
    initialFeedback: { questions: unknown[] } | null;
  }) =>
    isOpen ? (
      <div data-testid="feedback-modal">{initialFeedback?.questions.length ?? 'none'}</div>
    ) : null,
}));
vi.mock('@/components/builder/formatting-controls', () => ({ FormattingControls: () => null }));
vi.mock('@/components/builder/cover-letter-preview', () => ({ CoverLetterPreview: () => null }));
vi.mock('@/components/builder/outreach-preview', () => ({ OutreachPreview: () => null }));
vi.mock('@/components/builder/generate-prompt', () => ({ GeneratePrompt: () => null }));
vi.mock('@/components/builder/interview-prep-view', () => ({ InterviewPrepView: () => null }));
vi.mock('@/components/builder/jd-comparison-view', () => ({ JDComparisonView: () => null }));
vi.mock('@/components/builder/regenerate-wizard', () => ({ RegenerateWizard: () => null }));
vi.mock('@/hooks/use-regenerate-wizard', () => ({
  useRegenerateWizard: () => ({ step: 'idle', reset: vi.fn() }),
}));

const RESUME: Resume = {
  personalInfo: { name: 'Ada Lovelace', email: 'ada@example.com' },
  summary: 'Saved summary',
  workExperience: [
    {
      id: 1,
      company: 'Analytical Engines',
      location: 'London',
      roles: [{ id: 1, title: 'Engineer', years: '2020 - Present' }],
      description: ['Built the engine.'],
      descriptionStyles: ['bullet'],
    },
  ],
  education: [],
  personalProjects: [],
  additional: {},
};

const FEEDBACK = {
  report_markdown: '## Strengths\n\nGood.',
  questions: [{ question_id: 'q1', category: 'gap', prompt: 'Kubernetes?', context: '' }],
  answers: {},
  generated_at: '2026-10-19T00:00:00+00:00',
  applied_at: null,
};

async function renderBuilder(agentMode = true) {
  const { ResumeBuilder } = await import('@/components/builder/resume-builder');
  render(<ResumeBuilder agentMode={agentMode} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

async function nextAgentCheck() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(AGENT_REFRESH_INTERVAL_MS);
  });
}

const feedbackButton = () => screen.getByRole('button', { name: /feedback.buttonLabel/ });

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  server.resume = structuredClone(RESUME);
  server.feedback = null;
  server.tailorSettings = null;
  form.mounts = 0;
  Object.values(api).forEach((fn) => fn.mockReset());
  api.fetchResume.mockImplementation(async () => ({
    processed_resume: server.resume,
    cover_letter: '',
    outreach_message: '',
    parent_id: 'master-1',
    title: 'Engineer @ Acme',
    resume_feedback: server.feedback,
    tailor_settings: server.tailorSettings,
    raw_resume: { processing_status: 'ready' },
  }));
  api.patchTailorSettings.mockImplementation(
    async (_id: string, settings: Record<string, number>) => {
      server.tailorSettings = settings;
    }
  );
  api.generateFeedback.mockResolvedValue(FEEDBACK);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.resetModules();
});

describe('tailored resume in agent mode', () => {
  it('does not generate feedback in the background, and asks the agent for it', async () => {
    await renderBuilder();
    await nextAgentCheck();
    expect(api.generateFeedback).not.toHaveBeenCalled();

    await act(async () => feedbackButton().click());
    expect(screen.getByRole('dialog', { name: 'agentPrompt.feedback.title' })).toBeInTheDocument();
    expect(screen.queryByTestId('feedback-modal')).toBeNull();
  });

  it('still generates feedback in the background outside agent mode', async () => {
    await renderBuilder(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(api.generateFeedback).toHaveBeenCalledWith('res-1', false);
  });

  it('shows feedback the agent saved, then opens it instead of asking again', async () => {
    await renderBuilder();
    server.feedback = FEEDBACK;
    await nextAgentCheck();

    await act(async () => feedbackButton().click());
    // The agent's feedback, picked up by the refresh (the app generated none).
    expect(api.generateFeedback).not.toHaveBeenCalled();
    expect(screen.getByTestId('feedback-modal')).toHaveTextContent('1');
    expect(screen.queryByRole('dialog', { name: 'agentPrompt.feedback.title' })).toBeNull();
    // Feedback alone is not a resume change: no banner, no form rebuild.
    expect(screen.queryByText('builder.agentUpdate.applied')).toBeNull();
    expect(form.mounts).toBe(1);
  });

  it('saves the length settings and hands Apply and Re-tailor to the agent', async () => {
    await renderBuilder();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () =>
      screen.getByRole('button', { name: 'builder.tailorLength.applyConstraints' }).click()
    );
    expect(api.patchTailorSettings).toHaveBeenCalledTimes(1);
    expect(api.applyTailorLength).not.toHaveBeenCalled();
    expect(
      screen.getByRole('dialog', { name: 'agentPrompt.applyLength.title' })
    ).toBeInTheDocument();
    const dialog = screen.getByRole('dialog', { name: 'agentPrompt.applyLength.title' });
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'common.close' })[0]);

    const confirm = vi.spyOn(window, 'confirm');
    await act(async () =>
      screen.getByRole('button', { name: 'builder.tailorLength.reTailor' }).click()
    );
    expect(api.improveResume).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'agentPrompt.retailor.title' })).toBeInTheDocument();
  });

  it('does not report an agent change when the server copy only differs in shape', async () => {
    // Legacy flat shape on the server: the editor normalizes it to roles on load.
    const { roles, ...job } = (RESUME.workExperience as Record<string, unknown>[])[0] as {
      roles: { title: string; years: string }[];
    } & Record<string, unknown>;
    server.resume = {
      ...structuredClone(RESUME),
      workExperience: [{ ...job, title: roles[0].title, years: roles[0].years }],
    };
    await renderBuilder();
    await nextAgentCheck();
    await nextAgentCheck();

    expect(screen.queryByText('builder.agentUpdate.applied')).toBeNull();
    expect(screen.queryByText('builder.agentUpdate.conflictTitle')).toBeNull();
    expect(form.mounts).toBe(1);
  });
});
