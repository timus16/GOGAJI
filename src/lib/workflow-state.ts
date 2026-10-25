/**
 * Workflow State Machine
 * 
 * Every submission gets a NEW state object.
 * State is NEVER shared between submissions.
 * State NEVER accumulates chat history.
 * 
 * State transitions are ONE-WAY:
 * 
 * SUBMISSION RECEIVED
 *     ?
 * INITIALIZE
 *     ?
 * KUNDLI_ENGINE ? CHART_COMPUTED
 *     ?
 * PROBLEM_ANALYZER ? PROBLEM_ANALYZED
 *     ?
 * WALLPAPER_CONTEXT ? CONTEXT_GENERATED
 *     ?
 * IMAGE_PROMPT ? PROMPT_READY
 *     ?
 * NVIDIA_IMAGE ? COMPLETED | DEGRADED
 * 
 * Error at any step ? DEGRADED (SVG fallback still works)
 */

import { generateSubmissionId, type WorkflowState, type PipelineStep } from '\''./mcp-router'\'';
import type { BirthInput } from '\''~/lib/astro'\'';

/** Pipeline step transitions */
export type StateTransition = 
  | { from: '\''INITIALIZE'\''; to: '\''KUNDLI_ENGINE'\'' }
  | { from: '\''KUNDLI_ENGINE'\''; to: '\''PROBLEM_ANALYZER'\'' | '\''WALLPAPER_CONTEXT'\'' }
  | { from: '\''PROBLEM_ANALYZER'\''; to: '\''WALLPAPER_CONTEXT'\'' }
  | { from: '\''WALLPAPER_CONTEXT'\''; to: '\''IMAGE_PROMPT'\'' }
  | { from: '\''IMAGE_PROMPT'\''; to: '\''NVIDIA_IMAGE'\'' }
  | { from: '\''NVIDIA_IMAGE'\''; to: '\''COMPLETE'\'' | '\''DEGRADED'\'' }
  | { from: '\''INITIALIZE'\'' | '\''KUNDLI_ENGINE'\'' | '\''PROBLEM_ANALYZER'\'' | '\''WALLPAPER_CONTEXT'\'' | '\''IMAGE_PROMPT'\'' | '\''NVIDIA_IMAGE'\''; to: '\''DEGRADED'\'' };

/** Valid state transitions */
const VALID_TRANSITIONS: Record<PipelineStep, PipelineStep[]> = {
  INITIALIZE: ['\''KUNDLI_ENGINE'\'', '\''DEGRADED'\''],
  KUNDLI_ENGINE: ['\''PROBLEM_ANALYZER'\'', '\''WALLPAPER_CONTEXT'\'', '\''DEGRADED'\''],
  PROBLEM_ANALYZER: ['\''WALLPAPER_CONTEXT'\'', '\''DEGRADED'\''],
  WALLPAPER_CONTEXT: ['\''IMAGE_PROMPT'\'', '\''DEGRADED'\''],
  IMAGE_PROMPT: ['\''NVIDIA_IMAGE'\'', '\''DEGRADED'\''],
  NVIDIA_IMAGE: ['\''COMPLETE'\'', '\''DEGRADED'\''],
  COMPLETE: [],
  DEGRADED: [],
};

/**
 * Create initial workflow state
 */
export function initializeWorkflow(
  birthDetails: BirthInput,
  problem: string | null
): WorkflowState {
  return {
    submissionId: generateSubmissionId(),
    step: '\''INITIALIZE'\'',
    birthDetails,
    problem,
    chart: null,
    problemAnalysis: null,
    wallpaperContext: null,
    imagePrompt: null,
    imageUrl: null,
    error: null,
    startedAt: Date.now(),
    completedAt: null,
  };
}

/**
 * Check if a transition is valid
 */
export function canTransition(from: PipelineStep, to: PipelineStep): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Advance the workflow to next step
 */
export function transition(
  state: WorkflowState,
  nextStep: PipelineStep
): WorkflowState {
  if (!canTransition(state.step, nextStep)) {
    // Force to DEGRADED if invalid transition
    return {
      ...state,
      step: '\''DEGRADED'\'',
      error: state.error ?? `Invalid transition from ${state.step} to ${nextStep}`,
      completedAt: Date.now(),
    };
  }

  return {
    ...state,
    step: nextStep,
  };
}

/**
 * Mark workflow as complete
 */
export function completeWorkflow(state: WorkflowState): WorkflowState {
  return {
    ...state,
    step: '\''COMPLETE'\'',
    completedAt: Date.now(),
  };
}

/**
 * Mark workflow as degraded (fallback path)
 */
export function degradeWorkflow(state: WorkflowState, error: string): WorkflowState {
  return {
    ...state,
    step: '\''DEGRADED'\'',
    error,
    completedAt: Date.now(),
  };
}

/**
 * Store chart data
 */
export function withChart(state: WorkflowState, chart: any): WorkflowState {
  return {
    ...state,
    chart,
  };
}

/**
 * Store problem analysis
 */
export function withProblemAnalysis(state: WorkflowState, analysis: any): WorkflowState {
  return {
    ...state,
    problemAnalysis: analysis,
  };
}

/**
 * Store wallpaper context
 */
export function withWallpaperContext(state: WorkflowState, context: any): WorkflowState {
  return {
    ...state,
    wallpaperContext: context,
  };
}

/**
 * Store image prompt
 */
export function withImagePrompt(state: WorkflowState, prompt: string): WorkflowState {
  return {
    ...state,
    imagePrompt: prompt,
  };
}

/**
 * Store image URL
 */
export function withImageUrl(state: WorkflowState, imageUrl: string): WorkflowState {
  return {
    ...state,
    imageUrl,
  };
}

/**
 * Check if workflow can produce AI image
 */
export function canProduceImage(state: WorkflowState): boolean {
  return state.step !== '\''DEGRADED'\'' && 
         state.imagePrompt !== null && 
         state.error === null;
}

/**
 * Get workflow duration in ms
 */
export function getWorkflowDuration(state: WorkflowState): number {
  if (state.completedAt === null) {
    return Date.now() - state.startedAt;
  }
  return state.completedAt - state.startedAt;
}

/**
 * Minimal state for client response
 */
export interface ClientReadyState {
  submissionId: string;
  step: PipelineStep;
  chart: any | null;
  problemAnalysis: any | null;
  imagePrompt: string | null;
  imageUrl: string | null;
  error: string | null;
  duration: number;
}

/**
 * Convert full state to minimal client-ready form
 */
export function toClientState(state: WorkflowState): ClientReadyState {
  return {
    submissionId: state.submissionId,
    step: state.step,
    chart: state.chart,
    problemAnalysis: state.problemAnalysis,
    imagePrompt: state.imagePrompt,
    imageUrl: state.imageUrl,
    error: state.error,
    duration: getWorkflowDuration(state),
  };
}

/**
 * Discard function - never store state beyond request lifetime
 */
export function discardWorkflow(state: WorkflowState): void {
  // In a real implementation with Redis/DB persistence,
  // this would clean up the state
  // For in-memory state machine, this is a no-op
  // The state object will be garbage collected when no references exist
}
