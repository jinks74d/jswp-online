// lib/assignment-configs/types.ts
// Type definitions for writing style configurations

/**
 * Writing style identifiers
 */
export type WritingStyle = 'argumentation' | 'expository' | 'narrative' | 'literary';

/**
 * Configuration for CD (Concrete Details) gathering behavior
 */
export interface CDGatheringConfig {
  // Number of chunks to gather CDs for
  maxChunks: number;

  // Selection behavior
  selectionMode: 'single' | 'multi';

  // Minimum CDs required per chunk
  minCDsPerChunk: number;

  // Maximum CDs allowed per chunk
  maxCDsPerChunk: number;

  // Minimum selections required per chunk
  minSelectionsPerChunk: number;

  // Maximum selections allowed per chunk
  maxSelectionsPerChunk: number;

  // Whether to allow drag-and-drop reordering
  allowReordering: boolean;
}

/**
 * UI text and labels specific to writing style
 */
export interface GatheringCDsUIConfig {
  // Page title
  pageTitle: string;

  // Main instruction text
  instructionText: string;

  // Chunk label (e.g., "Chunk 1", "Body Paragraph 1")
  chunkLabel: (chunkNumber: number) => string;

  // CD input placeholder
  cdPlaceholder: string;

  // Selection instruction
  selectionInstruction: string;

  // Help text for the tip modal
  helpText: {
    title: string;
    sections: {
      heading: string;
      content: string;
    }[];
  };

  // Button labels
  buttons: {
    addCD: string;
    save: string;
    submit: string;
    next: string;
  };
}

/**
 * Validation rules for gathering CDs
 */
export interface GatheringCDsValidation {
  // Validate before saving
  validateSave: (data: {
    chunk1CDs: string[];
    chunk2CDs: string[];
    selectedChunks: number;
  }) => { valid: boolean; message?: string };

  // Validate before submitting
  validateSubmit: (data: {
    chunk1CDs: string[];
    chunk2CDs: string[];
    selectedChunk1CDs: number[];
    selectedChunk2CDs: number[];
    selectedChunks: number;
  }) => { valid: boolean; message?: string };
}

/**
 * Complete configuration for a writing style's Gathering CDs step
 */
export interface WritingStyleGatheringCDsConfig {
  // Writing style identifier
  style: WritingStyle;

  // Display name for the style
  displayName: string;

  // CD gathering behavior
  behavior: CDGatheringConfig;

  // UI text and labels
  ui: GatheringCDsUIConfig;

  // Validation rules
  validation: GatheringCDsValidation;

  // Next step route after completion
  nextStepRoute: string;
}

/**
 * Helper type for CD data structure
 */
export interface CDData {
  chunk1CDs: string[];
  chunk2CDs: string[];
  selectedChunk1CDs: number[];
  selectedChunk2CDs: number[];
  selectedChunks: number;
}

/**
 * Configuration for Working Topic Sentence behavior
 */
export interface WorkingTopicSentenceConfig {
  // Commentary structure type
  commentaryStructure: 'simple' | 'cd-sections';

  // For simple structure (argumentation)
  simpleCommentary?: {
    label: string;
    placeholder: string;
  };

  // For CD sections structure (expository)
  cdSections?: {
    cmFieldCount: number; // Number of CM fields per CD
    cmLabel: (index: number) => string; // e.g., "CM 1", "CM 2"
    cmPlaceholder: string;
  };
}

/**
 * UI text and labels for Working Topic Sentence
 */
export interface WorkingTopicSentenceUIConfig {
  pageTitle: string;
  instructionText: string;
  topicSentenceLabel: string;
  topicSentencePlaceholder: string;

  helpText: {
    title: string;
    sections: {
      heading: string;
      content: string;
    }[];
  };

  buttons: {
    save: string;
    submit: string;
    next: string;
  };
}

/**
 * Validation rules for Working Topic Sentence
 */
export interface WorkingTopicSentenceValidation {
  validateSubmit: (data: {
    workingTopicSentence: string;
    commentaryData?: { [key: string]: string };
    cdSections?: any[];
  }) => { valid: boolean; message?: string };
}

/**
 * Complete configuration for Working Topic Sentence step
 */
export interface WritingStyleWorkingTopicSentenceConfig {
  style: WritingStyle;
  displayName: string;
  behavior: WorkingTopicSentenceConfig;
  ui: WorkingTopicSentenceUIConfig;
  validation: WorkingTopicSentenceValidation;
  nextStepRoute: string;
}

/**
 * Field types for shaping sheets
 */
export type ShapingFieldType = 'text' | 'textarea' | 'cd-array';

/**
 * Shaping sheet type (single form or multi-sheet sequence)
 */
export type ShapingSheetType = 'single' | 'sequence';

/**
 * Individual field definition for shaping sheets
 */
export interface ShapingField {
  // Unique key for the field
  key: string;

  // Display label
  label: string;

  // Field type
  type: ShapingFieldType;

  // Placeholder text
  placeholder?: string;

  // Whether field is required
  required?: boolean;

  // Whether field is readonly (e.g., pre-filled from previous step)
  readonly?: boolean;

  // Conditional rendering
  conditional?: {
    field: string; // Field name to check
    operator: '===' | '!==' | '>' | '<' | '>=' | '<=';
    value: any; // Value to compare against
  };

  // For textarea: number of rows
  rows?: number;
}

/**
 * Configuration for shaping sheet behavior
 */
export interface ShapingSheetBehaviorConfig {
  // Sheet type: single form or multi-sheet sequence
  sheetType: ShapingSheetType;

  // Number of sheets in sequence (for narrative: 3)
  sequenceCount?: number;

  // Field definitions
  fields: ShapingField[];

  // Whether to auto-assemble paragraph (narrative only)
  autoAssembleParagraph?: boolean;

  // Key to save data under in concrete_details
  saveKey: string;

  // Where to load initial data from
  dataSource: string | {
    // Step name or key in concrete_details
    stepKey: string;
    // Field mappings: { formField: sourceField }
    fieldMappings: { [key: string]: string };
  };
}

/**
 * UI configuration for shaping sheets
 */
export interface ShapingSheetUIConfig {
  // Page title
  pageTitle: string;

  // Main instructions
  instructionText: string;

  // Help text for modal
  helpText: {
    title: string;
    sections: {
      heading: string;
      content: string;
    }[];
  };

  // Button labels
  buttons: {
    back: string;
    save: string;
    next: string;
    submit?: string;
  };
}

/**
 * Validation configuration for shaping sheets
 */
export interface ShapingSheetValidation {
  // List of required field keys
  requiredFields: string[];

  // Validation function for save action
  validateSave?: (data: any) => { valid: boolean; message?: string };

  // Custom validation function for submit
  validateSubmit: (data: any) => { valid: boolean; message?: string };
}

/**
 * Navigation configuration for shaping sheets
 */
export interface ShapingSheetNavigation {
  // Route to go back to
  backRoute: string;

  // Route to proceed to
  nextRoute: string;
}

/**
 * Complete configuration for a writing style's Shaping Sheet step
 */
export interface WritingStyleShapingConfig {
  // Writing style identifier
  style: WritingStyle;

  // Display name
  displayName: string;

  // Behavior configuration
  behavior: ShapingSheetBehaviorConfig;

  // UI configuration
  ui: ShapingSheetUIConfig;

  // Validation rules
  validation: ShapingSheetValidation;

  // Navigation routes
  navigation: ShapingSheetNavigation;
}

/**
 * Configuration for narrative shaping sequence (3 sheets)
 */
export interface NarrativeShapingSequenceConfig {
  // Writing style (always 'narrative')
  style: 'narrative';

  // Display name
  displayName: string;

  // Configurations for each sheet
  sheets: {
    sheet1: WritingStyleShapingConfig;
    sheet2: WritingStyleShapingConfig;
    sheet3: WritingStyleShapingConfig;
  };

  // Overall sequence navigation
  sequenceNavigation: {
    entryRoute: string; // Where sequence starts
    exitRoute: string; // Where sequence ends
  };
}
