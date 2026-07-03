import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { RegenerateDiffPreview } from '@/components/builder/regenerate-diff-preview';
import { FeedbackQuestionStep } from '@/components/feedback/feedback-question-step';
import type { RegeneratedItem } from '@/lib/api/enrichment';
import type { FeedbackQuestion } from '@/lib/api/feedback';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({ t: (key: string) => key }),
}));

const sampleQuestion: FeedbackQuestion = {
  question_id: 'q1',
  category: 'gap',
  prompt: 'What metrics can you quantify?',
  context: 'Your resume lacks numbers.',
};

const baseQuestionProps = {
  question: sampleQuestion,
  answer: '',
  questionNumber: 1,
  totalQuestions: 3,
  returnToReview: false,
  onAnswer: vi.fn(),
  onBack: vi.fn(),
  onContinue: vi.fn(),
};

const sampleRegeneratedItems: RegeneratedItem[] = [
  {
    item_id: 'exp_0',
    item_type: 'experience',
    title: 'Engineer',
    subtitle: 'Acme',
    original_content: ['Old bullet'],
    new_content: ['New bullet'],
    diff_summary: 'Updated experience',
  },
];

describe('FeedbackQuestionStep keyboard shortcuts', () => {
  it('continues on Cmd+Enter while the textarea is focused', () => {
    const onContinue = vi.fn();
    render(<FeedbackQuestionStep {...baseQuestionProps} onContinue={onContinue} />);

    const textarea = screen.getByRole('textbox');
    textarea.focus();
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true, bubbles: true });

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('continues on Ctrl+Enter while the textarea is focused', () => {
    const onContinue = vi.fn();
    render(<FeedbackQuestionStep {...baseQuestionProps} onContinue={onContinue} />);

    const textarea = screen.getByRole('textbox');
    textarea.focus();
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true, bubbles: true });

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('does not continue on plain Enter in the textarea', () => {
    const onContinue = vi.fn();
    render(<FeedbackQuestionStep {...baseQuestionProps} onContinue={onContinue} />);

    const textarea = screen.getByRole('textbox');
    textarea.focus();
    fireEvent.keyDown(textarea, { key: 'Enter', bubbles: true });

    expect(onContinue).not.toHaveBeenCalled();
  });
});

describe('RegenerateDiffPreview embedded mode (feedback apply preview)', () => {
  it('renders inline inside a parent container instead of portaling to document.body', () => {
    const { container: modalBody } = render(
      <div data-testid="feedback-modal-body">
        <RegenerateDiffPreview
          embedded
          open
          onOpenChange={vi.fn()}
          regeneratedItems={sampleRegeneratedItems}
          error={null}
          onAccept={vi.fn()}
          onReject={vi.fn()}
          isApplying={false}
        />
      </div>
    );

    const body = modalBody.querySelector('[data-testid="feedback-modal-body"]') as HTMLElement;
    expect(within(body).getByText('builder.regenerate.diffPreview.title')).toBeInTheDocument();
    expect(within(body).getByText('Engineer | Acme')).toBeInTheDocument();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it('portals to document.body when not embedded', () => {
    render(
      <RegenerateDiffPreview
        open
        onOpenChange={vi.fn()}
        regeneratedItems={sampleRegeneratedItems}
        error={null}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        isApplying={false}
      />
    );

    const portaledDialog = document.body.querySelector('[role="dialog"]');
    expect(portaledDialog).toBeTruthy();
    expect(portaledDialog).toHaveTextContent('builder.regenerate.diffPreview.title');
  });

  it('calls onAccept from the embedded accept button', () => {
    const onAccept = vi.fn();
    render(
      <RegenerateDiffPreview
        embedded
        open
        onOpenChange={vi.fn()}
        regeneratedItems={sampleRegeneratedItems}
        error={null}
        onAccept={onAccept}
        onReject={vi.fn()}
        isApplying={false}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'builder.regenerate.diffPreview.acceptButton' })
    );
    expect(onAccept).toHaveBeenCalledTimes(1);
  });
});
