/**
 * API Module Exports
 *
 * Centralized exports for all API-related functionality.
 */

// Client utilities
export {
  API_URL,
  API_BASE,
  apiFetch,
  apiPost,
  apiPatch,
  apiPut,
  apiDelete,
  getUploadUrl,
} from './client';

// Resume operations
export {
  uploadJobDescriptions,
  improveResume,
  previewImproveResume,
  confirmImproveResume,
  fetchResume,
  fetchResumeList,
  updateResume,
  patchTailorSettings,
  applyTailorLength,
  downloadResumePdf,
  deleteResume,
  type ResumeListItem,
  type TailorLengthSettings as ResumeTailorLengthSettings,
  type ImproveResumeOptions,
} from './resume';

// Feedback operations
export {
  generateFeedback,
  patchFeedbackAnswers,
  previewFeedbackApply,
  applyFeedback,
  type FeedbackQuestion,
  type ResumeFeedback,
  type FeedbackApplyPreview,
} from './feedback';

// Resume wizard operations
export {
  createInitialResumeWizardState,
  finalizeResumeWizard,
  postResumeWizardTurn,
  type ResumeWizardAction,
  type ResumeWizardFinalizeResponse,
  type ResumeWizardSection,
  type ResumeWizardState,
  type ResumeWizardStep,
  type ResumeWizardTurnRequest,
  type ResumeWizardTurnResponse,
} from './resume-wizard';

// Config operations
export {
  fetchLlmConfig,
  fetchLlmApiKey,
  updateLlmConfig,
  updateLlmApiKey,
  testLlmConnection,
  fetchSystemStatus,
  PROVIDER_INFO,
  fetchPromptConfig,
  updatePromptConfig,
  type LLMProvider,
  type ProviderConfigSnapshot,
  type LLMConfig,
  type LLMConfigUpdate,
  type DatabaseStats,
  type SystemStatus,
  type LLMHealthCheck,
  type PromptOption,
  type PromptConfig,
  type PromptConfigUpdate,
  fetchTailorLengthConfig,
  updateTailorLengthConfig,
  type TailorLengthSettings,
} from './config';
