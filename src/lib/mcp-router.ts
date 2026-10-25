/**
 * MCP Router - Skill Loader for GOGAJI Deterministic Pipeline
 * 
 * Loads ONLY required skills per request. No speculative loading.
 * Each workflow step has a specific skill set.
 * 
 * Architecture: Instead of loading 20+ comprehensive skills,
 * this router loads ONLY the 1-2 focused skills needed for each step.
 * 
 * Skill files live in .kilo/skills/<name>/SKILL.md
 */

import type { BirthInput } from "~/lib/astro";

/** Pipeline steps */
export type PipelineStep = 
  | 'INITIALIZE'
  | 'KUNDLI_ENGINE'
  | 'PROBLEM_ANALYZER'
  | 'WALLPAPER_CONTEXT'
  | 'IMAGE_PROMPT'
  | 'NVIDIA_IMAGE'
  | 'COMPLETE'
  | 'DEGRADED';

export interface WorkflowState {
  submissionId: string;
  step: PipelineStep;
  birthDetails: BirthInput | null;
  problem: string | null;
  chart: any | null;
  problemAnalysis: any | null;
  wallpaperContext: any | null;
  imagePrompt: string | null;
  imageUrl: string | null;
  error: string | null;
  startedAt: number;
  completedAt: number | null;
}

/**
 * Step-to-Skill mapping
 * 
 * Each step loads ONLY its required skills.
 * No step loads more than necessary.
 */
export const STEP_SKILLS: Record<PipelineStep, string[]> = {
  INITIALIZE: [],
  KUNDLI_ENGINE: ['kundli-engine'],
  PROBLEM_ANALYZER: ['problem-analyzer'],
  WALLPAPER_CONTEXT: ['wallpaper-context'],
  IMAGE_PROMPT: ['image-prompt'],
  NVIDIA_IMAGE: [],
  COMPLETE: [],
  DEGRADED: [],
};

/**
 * Problem-to-focus mapping
 * 
 * When problem is provided, load problem-analyzer and wallpaper-context.
 * When no problem, skip to wallpaper-context with generic params.
 */
export const PROBLEM_STEPS: Record<string, PipelineStep[]> = {
  career: ['KUNDLI_ENGINE', 'PROBLEM_ANALYZER', 'WALLPAPER_CONTEXT', 'IMAGE_PROMPT', 'NVIDIA_IMAGE'],
  wealth: ['KUNDLI_ENGINE', 'PROBLEM_ANALYZER', 'WALLPAPER_CONTEXT', 'IMAGE_PROMPT', 'NVIDIA_IMAGE'],
  relationships: ['KUNDLI_ENGINE', 'PROBLEM_ANALYZER', 'WALLPAPER_CONTEXT', 'IMAGE_PROMPT', 'NVIDIA_IMAGE'],
  health: ['KUNDLI_ENGINE', 'PROBLEM_ANALYZER', 'WALLPAPER_CONTEXT', 'IMAGE_PROMPT', 'NVIDIA_IMAGE'],
  education: ['KUNDLI_ENGINE', 'PROBLEM_ANALYZER', 'WALLPAPER_CONTEXT', 'IMAGE_PROMPT', 'NVIDIA_IMAGE'],
  spiritual: ['KUNDLI_ENGINE', 'PROBLEM_ANALYZER', 'WALLPAPER_CONTEXT', 'IMAGE_PROMPT', 'NVIDIA_IMAGE'],
  protection: ['KUNDLI_ENGINE', 'PROBLEM_ANALYZER', 'WALLPAPER_CONTEXT', 'IMAGE_PROMPT', 'NVIDIA_IMAGE'],
  family: ['KUNDLI_ENGINE', 'PROBLEM_ANALYZER', 'WALLPAPER_CONTEXT', 'IMAGE_PROMPT', 'NVIDIA_IMAGE'],
};

/**
 * Default path when no problem specified (all-in-one)
 */
export const DEFAULT_STEPS: PipelineStep[] = [
  'KUNDLI_ENGINE',
  'PROBLEM_ANALYZER',
  'WALLPAPER_CONTEXT',
  'IMAGE_PROMPT',
  'NVIDIA_IMAGE',
];

/**
 * Get required skills for a given step
 */
export function getSkillsForStep(step: PipelineStep): string[] {
  return STEP_SKILLS[step] ?? [];
}

/**
 * Get the pipeline steps for a given problem
 */
export function getStepsForProblem(problem: string | null): PipelineStep[] {
  if (!problem) return DEFAULT_STEPS;
  return PROBLEM_STEPS[problem.toLowerCase()] ?? DEFAULT_STEPS;
}

/**
 * Create a new workflow state for a submission
 */
export function createWorkflowState(submissionId: string, birthDetails: BirthInput, problem: string | null): WorkflowState {
  const steps = getStepsForProblem(problem);
  const firstStep = steps[0] ?? 'INITIALIZE';
  
  return {
    submissionId,
    step: firstStep,
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
 * Transition to next step
 * 
 * State is ONE-WAY. Never go back to previous step.
 */
export function advanceState(state: WorkflowState, nextStep: PipelineStep): WorkflowState {
  return {
    ...state,
    step: nextStep,
  };
}

/**
 * Check if state is terminal
 */
export function isTerminalState(state: WorkflowState): boolean {
  return state.step === 'COMPLETE' || state.step === 'DEGRADED';
}

/**
 * Generate submission ID
 */
export function generateSubmissionId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Load skill content for a given skill name
 * 
 * Skills are markdown files in .kilo/skills/<name>/SKILL.md
 * This function reads the skill file and returns its content.
 * 
 * In the current implementation, skills are documentation for agents.
 * The actual computation happens in src/lib/astro.ts, src/content/problems.ts, etc.
 */
export async function loadSkill(skillName: string): Promise<string | null> {
  // Skill loading is handled by the agent system
  // This function is a placeholder for future MCP server implementation
  // where skills might be loaded from a remote server
  return null;
}

/**
 * Get skills manifest for the pipeline
 */
export function getSkillsManifest(): Record<string, { name: string; description: string; maxTokens: number }> {
  return {
    'kundli-engine': {
      name: 'KUNDLI_ENGINE',
      description: 'Vedic chart calculator - computes planetary positions, nakshatra, houses',
      maxTokens: 500,
    },
    'problem-analyzer': {
      name: 'PROBLEM_ANALYZER',
      description: 'Maps problem to houses and planets - pure mapping function',
      maxTokens: 300,
    },
    'wallpaper-context': {
      name: 'WALLPAPER_CONTEXT',
      description: 'Generates visual context - energy, chakra, color, symbols',
      maxTokens: 400,
    },
    'image-prompt': {
      name: 'IMAGE_PROMPT',
      description: 'Generates optimized prompts for NVIDIA flux.1-dev',
      maxTokens: 250,
    },
    'adhd-focus': {
      name: 'ADHD_FOCUS',
      description: 'Enforces strict execution discipline - prevents token explosion',
      maxTokens: 0,
    },
  };
}
