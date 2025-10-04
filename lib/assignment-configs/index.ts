// lib/assignment-configs/index.ts
// Central export and configuration getter

import {
  WritingStyle,
  WritingStyleGatheringCDsConfig,
  WritingStyleWorkingTopicSentenceConfig,
  WritingStyleShapingConfig,
  NarrativeShapingSequenceConfig
} from './types';
import {
  argumentationGatheringCDsConfig,
  argumentationWorkingTopicSentenceConfig,
  argumentationShapingConfig
} from './argumentation.config';
import {
  expositoryGatheringCDsConfig,
  expositoryWorkingTopicSentenceConfig,
  expositoryShapingConfig
} from './expository.config';
import { narrativeGatheringCDsConfig, narrativeShapingSequenceConfig } from './narrative.config';
import { literaryGatheringCDsConfig, literaryShapingConfig } from './literary.config';

// Export all types
export * from './types';

// Export all configs
export {
  argumentationGatheringCDsConfig,
  argumentationWorkingTopicSentenceConfig,
  argumentationShapingConfig,
  expositoryGatheringCDsConfig,
  expositoryWorkingTopicSentenceConfig,
  expositoryShapingConfig,
  narrativeGatheringCDsConfig,
  narrativeShapingSequenceConfig,
  literaryGatheringCDsConfig,
  literaryShapingConfig,
};

/**
 * Get the gathering CDs configuration for a specific writing style
 */
export function getGatheringCDsConfig(
  writingStyle: WritingStyle | string
): WritingStyleGatheringCDsConfig {
  const normalizedStyle = writingStyle?.toLowerCase() as WritingStyle;

  switch (normalizedStyle) {
    case 'argumentation':
      return argumentationGatheringCDsConfig;
    case 'expository':
      return expositoryGatheringCDsConfig;
    case 'narrative':
      return narrativeGatheringCDsConfig;
    case 'literary':
      return literaryGatheringCDsConfig;
    default:
      // Default to literary for unknown styles
      console.warn(`Unknown writing style: ${writingStyle}, defaulting to literary`);
      return literaryGatheringCDsConfig;
  }
}

/**
 * Get the working topic sentence configuration for a specific writing style
 */
export function getWorkingTopicSentenceConfig(
  writingStyle: WritingStyle | string
): WritingStyleWorkingTopicSentenceConfig {
  const normalizedStyle = writingStyle?.toLowerCase() as WritingStyle;

  switch (normalizedStyle) {
    case 'argumentation':
      return argumentationWorkingTopicSentenceConfig;
    case 'expository':
      return expositoryWorkingTopicSentenceConfig;
    default:
      // For narrative and literary, they don't have this step, return argumentation as fallback
      console.warn(`Writing style ${writingStyle} doesn't have working topic sentence step`);
      return argumentationWorkingTopicSentenceConfig;
  }
}

/**
 * Get the single sheet shaping configuration for a specific writing style
 * Used for argumentation, expository, and literary styles
 */
export function getSingleSheetShapingConfig(
  writingStyle: WritingStyle | string
): WritingStyleShapingConfig {
  const normalizedStyle = writingStyle?.toLowerCase() as WritingStyle;

  switch (normalizedStyle) {
    case 'argumentation':
      return argumentationShapingConfig;
    case 'expository':
      return expositoryShapingConfig;
    case 'literary':
      return literaryShapingConfig;
    default:
      console.warn(`Unknown writing style for single sheet: ${writingStyle}`);
      return argumentationShapingConfig;
  }
}

/**
 * Get the narrative shaping sequence configuration
 * This is specifically for the narrative writing style which uses 3 sheets
 */
export function getNarrativeShapingSequenceConfig(): NarrativeShapingSequenceConfig {
  return narrativeShapingSequenceConfig;
}
