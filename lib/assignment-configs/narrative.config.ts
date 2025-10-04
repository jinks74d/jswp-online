// lib/assignment-configs/narrative.config.ts
import { WritingStyleGatheringCDsConfig, NarrativeShapingSequenceConfig, WritingStyleShapingConfig } from './types';

export const narrativeGatheringCDsConfig: WritingStyleGatheringCDsConfig = {
  style: 'narrative',
  displayName: 'Narrative',

  behavior: {
    maxChunks: 2,
    selectionMode: 'multi',
    minCDsPerChunk: 1,
    maxCDsPerChunk: 20,
    minSelectionsPerChunk: 2,
    maxSelectionsPerChunk: 4,
    allowReordering: true,
  },

  ui: {
    pageTitle: 'Gathering Concrete Details',
    instructionText: 'Add concrete details for each chunk of your narrative. You can add multiple CDs and select 2-4 to use in your story.',
    chunkLabel: (chunkNumber) => `Chunk ${chunkNumber}`,
    cdPlaceholder: 'Enter a concrete detail...',
    selectionInstruction: 'Select 2-4 concrete details to use in your narrative',

    helpText: {
      title: 'Tips for Gathering Concrete Details',
      sections: [
        {
          heading: 'What are Concrete Details?',
          content: 'Concrete details are specific sensory descriptions, actions, or dialogue that bring your story to life.',
        },
        {
          heading: 'How to write good CDs',
          content: 'Use vivid descriptions that appeal to the senses. Show, don\'t tell. Include specific actions and dialogue.',
        },
        {
          heading: 'Selecting your best CDs',
          content: 'Choose 2-4 CDs that best tell your story. You can reorder them by dragging.',
        },
      ],
    },

    buttons: {
      addCD: 'Add CD',
      save: 'Save Progress',
      submit: 'Submit',
      next: 'Next Step',
    },
  },

  validation: {
    validateSave: (data) => {
      return { valid: true };
    },

    validateSubmit: (data) => {
      const { chunk1CDs, chunk2CDs, selectedChunk1CDs, selectedChunk2CDs, selectedChunks } = data;

      // Check chunk 1
      if (chunk1CDs.length === 0) {
        return { valid: false, message: 'Please add at least one concrete detail for Chunk 1' };
      }

      if (selectedChunk1CDs.length < 2) {
        return { valid: false, message: 'Please select at least 2 concrete details for Chunk 1' };
      }

      if (selectedChunk1CDs.length > 4) {
        return { valid: false, message: 'Please select no more than 4 concrete details for Chunk 1' };
      }

      // Check chunk 2 if selected
      if (selectedChunks >= 2) {
        if (chunk2CDs.length === 0) {
          return { valid: false, message: 'Please add at least one concrete detail for Chunk 2' };
        }

        if (selectedChunk2CDs.length < 2) {
          return { valid: false, message: 'Please select at least 2 concrete details for Chunk 2' };
        }

        if (selectedChunk2CDs.length > 4) {
          return { valid: false, message: 'Please select no more than 4 concrete details for Chunk 2' };
        }
      }

      return { valid: true };
    },
  },

  nextStepRoute: '/dashboard/assignments/[id]/shaping-1',
};

// Sheet 1 configuration - When/Where/Who CDs
const narrativeShapingSheet1Config: WritingStyleShapingConfig = {
  style: 'narrative',
  displayName: 'Narrative - Sheet 1',

  behavior: {
    sheetType: 'single',
    fields: [
      {
        key: 'topicSentence',
        type: 'textarea',
        label: 'Topic Sentence',
        required: true,
        rows: 3,
      },
      {
        key: 'concreteDetails',
        type: 'cd-array',
        label: 'Concrete Details',
        required: false,
        readonly: true,
      },
      {
        key: 'commentary',
        type: 'textarea',
        label: 'Commentary',
        required: true,
        rows: 3,
      },
      {
        key: 'concludingSentence',
        type: 'textarea',
        label: 'Concluding Sentence',
        required: true,
        rows: 3,
      },
      {
        key: 'assembledParagraph',
        type: 'textarea',
        label: 'Assembled Paragraph',
        required: false,
        readonly: true,
        rows: 6,
      },
    ],
    saveKey: 'shapingSheet1',
    dataSource: 'tChartData',
    autoAssembleParagraph: true,
  },

  ui: {
    pageTitle: 'Narrative Shaping Sheet 1 - When/Where/Who',
    instructionText: 'Create your first narrative paragraph focusing on when, where, and who aspects of your story.',
    
    helpText: {
      title: 'Narrative Shaping Sheet 1 Tips',
      sections: [
        {
          heading: 'Topic Sentence',
          content: 'Start with a strong topic sentence that introduces the setting and characters.',
        },
        {
          heading: 'Concrete Details',
          content: 'Your concrete details from the T-Chart (when, where, who) are shown here.',
        },
        {
          heading: 'Commentary',
          content: 'Add commentary that explains the significance of these details.',
        },
        {
          heading: 'Concluding Sentence',
          content: 'End with a sentence that transitions to the next part of your story.',
        },
      ],
    },

    buttons: {
      save: 'Save Progress',
      submit: 'Continue to Sheet 2',
      back: 'Back to T-Chart',
      next: 'Continue to Sheet 2',
    },
  },

  validation: {
    requiredFields: ['topicSentence', 'commentary', 'concludingSentence'],
    validateSave: () => ({ valid: true }),
    
    validateSubmit: (data) => {
      const { topicSentence, commentary, concludingSentence } = data;
      
      if (!topicSentence?.trim()) {
        return { valid: false, message: 'Please enter a topic sentence' };
      }
      
      if (!commentary?.trim()) {
        return { valid: false, message: 'Please enter commentary' };
      }
      
      if (!concludingSentence?.trim()) {
        return { valid: false, message: 'Please enter a concluding sentence' };
      }
      
      return { valid: true };
    },
  },

  navigation: {
    backRoute: '/dashboard/assignments/[id]/t-chart',
    nextRoute: '/dashboard/assignments/[id]/shaping-sheet-2',
  },
};

// Sheet 2 configuration - What Happened CDs
const narrativeShapingSheet2Config: WritingStyleShapingConfig = {
  style: 'narrative',
  displayName: 'Narrative - Sheet 2',

  behavior: {
    sheetType: 'single',
    fields: [
      {
        key: 'topicSentence',
        type: 'textarea',
        label: 'Topic Sentence',
        required: true,
        rows: 3,
      },
      {
        key: 'concreteDetails',
        type: 'cd-array',
        label: 'Concrete Details',
        required: false,
        readonly: true,
      },
      {
        key: 'commentary',
        type: 'textarea',
        label: 'Commentary',
        required: true,
        rows: 3,
      },
      {
        key: 'concludingSentence',
        type: 'textarea',
        label: 'Concluding Sentence',
        required: true,
        rows: 3,
      },
      {
        key: 'assembledParagraph',
        type: 'textarea',
        label: 'Assembled Paragraph',
        required: false,
        readonly: true,
        rows: 6,
      },
    ],
    saveKey: 'shapingSheet2',
    dataSource: 'tChartData',
    autoAssembleParagraph: true,
  },

  ui: {
    pageTitle: 'Narrative Shaping Sheet 2 - What Happened',
    instructionText: 'Create your second narrative paragraph focusing on what happened in your story.',
    
    helpText: {
      title: 'Narrative Shaping Sheet 2 Tips',
      sections: [
        {
          heading: 'Topic Sentence',
          content: 'Start with a topic sentence that introduces the main action or event.',
        },
        {
          heading: 'Concrete Details',
          content: 'Your concrete details about what happened are shown here.',
        },
        {
          heading: 'Commentary',
          content: 'Explain the importance and impact of these events.',
        },
        {
          heading: 'Concluding Sentence',
          content: 'Transition to the next part of your narrative.',
        },
      ],
    },

    buttons: {
      save: 'Save Progress',
      submit: 'Continue to Sheet 3',
      back: 'Back to Sheet 1',
      next: 'Continue to Sheet 3',
    },
  },

  validation: {
    requiredFields: ['topicSentence', 'commentary', 'concludingSentence'],
    validateSave: () => ({ valid: true }),
    
    validateSubmit: (data) => {
      const { topicSentence, commentary, concludingSentence } = data;
      
      if (!topicSentence?.trim()) {
        return { valid: false, message: 'Please enter a topic sentence' };
      }
      
      if (!commentary?.trim()) {
        return { valid: false, message: 'Please enter commentary' };
      }
      
      if (!concludingSentence?.trim()) {
        return { valid: false, message: 'Please enter a concluding sentence' };
      }
      
      return { valid: true };
    },
  },

  navigation: {
    backRoute: '/dashboard/assignments/[id]/shaping-sheet-1',
    nextRoute: '/dashboard/assignments/[id]/shaping-sheet-3',
  },
};

// Sheet 3 configuration - Why/How/Impact CDs
const narrativeShapingSheet3Config: WritingStyleShapingConfig = {
  style: 'narrative',
  displayName: 'Narrative - Sheet 3',

  behavior: {
    sheetType: 'single',
    fields: [
      {
        key: 'topicSentence',
        type: 'textarea',
        label: 'Topic Sentence',
        required: true,
        rows: 3,
      },
      {
        key: 'concreteDetails',
        type: 'cd-array',
        label: 'Concrete Details',
        required: false,
        readonly: true,
      },
      {
        key: 'commentary',
        type: 'textarea',
        label: 'Commentary',
        required: true,
        rows: 3,
      },
      {
        key: 'concludingSentence',
        type: 'textarea',
        label: 'Concluding Sentence',
        required: true,
        rows: 3,
      },
      {
        key: 'assembledParagraph',
        type: 'textarea',
        label: 'Assembled Paragraph',
        required: false,
        readonly: true,
        rows: 6,
      },
    ],
    saveKey: 'shapingSheet3',
    dataSource: 'tChartData',
    autoAssembleParagraph: true,
  },

  ui: {
    pageTitle: 'Narrative Shaping Sheet 3 - Why/How/Impact',
    instructionText: 'Create your final narrative paragraph focusing on why things happened, how they happened, and their impact.',
    
    helpText: {
      title: 'Narrative Shaping Sheet 3 Tips',
      sections: [
        {
          heading: 'Topic Sentence',
          content: 'Start with a topic sentence that introduces the significance and meaning.',
        },
        {
          heading: 'Concrete Details',
          content: 'Your concrete details about why, how, and the impact are shown here.',
        },
        {
          heading: 'Commentary',
          content: 'Reflect on the deeper meaning and lessons learned.',
        },
        {
          heading: 'Concluding Sentence',
          content: 'Wrap up your narrative with a powerful conclusion.',
        },
      ],
    },

    buttons: {
      save: 'Save Progress',
      submit: 'Continue to Final Draft',
      back: 'Back to Sheet 2',
      next: 'Continue to Final Draft',
    },
  },

  validation: {
    requiredFields: ['topicSentence', 'commentary', 'concludingSentence'],
    validateSave: () => ({ valid: true }),
    
    validateSubmit: (data) => {
      const { topicSentence, commentary, concludingSentence } = data;
      
      if (!topicSentence?.trim()) {
        return { valid: false, message: 'Please enter a topic sentence' };
      }
      
      if (!commentary?.trim()) {
        return { valid: false, message: 'Please enter commentary' };
      }
      
      if (!concludingSentence?.trim()) {
        return { valid: false, message: 'Please enter a concluding sentence' };
      }
      
      return { valid: true };
    },
  },

  navigation: {
    backRoute: '/dashboard/assignments/[id]/shaping-sheet-2',
    nextRoute: '/dashboard/assignments/[id]/final-draft',
  },
};

// Export the narrative shaping sequence configuration
export const narrativeShapingSequenceConfig: NarrativeShapingSequenceConfig = {
  style: 'narrative',
  displayName: 'Narrative',

  sheets: {
    sheet1: narrativeShapingSheet1Config,
    sheet2: narrativeShapingSheet2Config,
    sheet3: narrativeShapingSheet3Config,
  },

  sequenceNavigation: {
    entryRoute: '/dashboard/assignments/[id]/shaping-sheet-1',
    exitRoute: '/dashboard/assignments/[id]/final-draft',
  },
};
