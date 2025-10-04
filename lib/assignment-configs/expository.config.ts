// lib/assignment-configs/expository.config.ts
import { WritingStyleGatheringCDsConfig, WritingStyleWorkingTopicSentenceConfig, WritingStyleShapingConfig } from './types';

export const expositoryGatheringCDsConfig: WritingStyleGatheringCDsConfig = {
  style: 'expository',
  displayName: 'Expository',

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
    instructionText: 'Add concrete details for each chunk of your expository essay. You can add multiple CDs and select 2-4 to use in your essay.',
    chunkLabel: (chunkNumber) => `Chunk ${chunkNumber}`,
    cdPlaceholder: 'Enter a concrete detail...',
    selectionInstruction: 'Select 2-4 concrete details to use in your essay',

    helpText: {
      title: 'Tips for Gathering Concrete Details',
      sections: [
        {
          heading: 'What are Concrete Details?',
          content: 'Concrete details are specific facts, examples, or evidence that explain your topic.',
        },
        {
          heading: 'How to write good CDs',
          content: 'Be specific and informative. Use facts, examples, or descriptions that help explain.',
        },
        {
          heading: 'Selecting your best CDs',
          content: 'Choose 2-4 CDs that best explain your topic. You can reorder them by dragging.',
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

  nextStepRoute: '/dashboard/assignments/[id]/working-topic-sentence',
};

export const expositoryWorkingTopicSentenceConfig: WritingStyleWorkingTopicSentenceConfig = {
  style: 'expository',
  displayName: 'Expository',

  behavior: {
    commentaryStructure: 'cd-sections',
    cdSections: {
      cmFieldCount: 5, // 5 CM fields per CD
      cmLabel: (index) => `CM ${index + 1}`,
      cmPlaceholder: 'Enter commentary...',
    },
  },

  ui: {
    pageTitle: 'Working Topic Sentence',
    instructionText: 'Create your working topic sentence and provide 5 commentary statements (CMs) for each concrete detail.',
    topicSentenceLabel: 'Working Topic Sentence',
    topicSentencePlaceholder: 'Enter your working topic sentence...',

    helpText: {
      title: 'Working Topic Sentence & Commentary Tips',
      sections: [
        {
          heading: 'What is a Working Topic Sentence?',
          content: 'A working topic sentence introduces the main idea you will explain in this paragraph.',
        },
        {
          heading: 'Writing Commentary (CM)',
          content: 'Commentary explains and elaborates on your concrete details. Each CD should have 5 CMs that help explain the information.',
        },
        {
          heading: 'CM Best Practices',
          content: 'Make each CM a complete sentence. Explain, analyze, or connect the CD to your topic. Vary your commentary to provide different perspectives.',
        },
      ],
    },

    buttons: {
      save: 'Save Progress',
      submit: 'Submit',
      next: 'Save and Next',
    },
  },

  validation: {
    validateSubmit: (data) => {
      if (!data.workingTopicSentence || data.workingTopicSentence.trim().length === 0) {
        return { valid: false, message: 'Please enter a working topic sentence' };
      }

      // Check if all CMs are provided
      if (data.cdSections) {
        for (const section of data.cdSections) {
          const emptyCMs = section.cms.filter((cm: string) => !cm || cm.trim().length === 0);
          if (emptyCMs.length > 0) {
            return { valid: false, message: 'Please provide all 5 commentary statements (CMs) for each concrete detail' };
          }
        }
      }

      return { valid: true };
    },
  },

  nextStepRoute: '/dashboard/assignments/[id]/shaping',
};

export const expositoryShapingConfig: WritingStyleShapingConfig = {
  style: 'expository',
  displayName: 'Expository',

  behavior: {
    sheetType: 'single',
    saveKey: 'shapingSheet',

    fields: [
      {
        key: 'topicSentence',
        label: 'Topic Sentence',
        type: 'textarea',
        placeholder: 'Enter your topic sentence...',
        rows: 3,
      },
      {
        key: 'chunk1CD',
        label: 'Chunk 1 Concrete Detail',
        type: 'textarea',
        placeholder: 'First concrete detail...',
        rows: 2,
      },
      {
        key: 'chunk2CD',
        label: 'Chunk 2 Concrete Detail',
        type: 'textarea',
        placeholder: 'Second concrete detail...',
        rows: 2,
        conditional: {
          field: 'selectedChunks',
          operator: '===',
          value: 2,
        },
      },
      {
        key: 'commentarySentence',
        label: 'Commentary Sentence',
        type: 'textarea',
        placeholder: 'Explain and connect your concrete details...',
        rows: 3,
      },
      {
        key: 'concludingSentence',
        label: 'Concluding Sentence',
        type: 'textarea',
        placeholder: 'Wrap up your explanation...',
        rows: 3,
      },
    ],

    autoAssembleParagraph: false,

    dataSource: {
      stepKey: 'commentary',
      fieldMappings: {
        topicSentence: 'revisedTopicSentence',
        commentarySentence: 'commentarySentence',
        concludingSentence: 'concludingSentence',
      },
    },
  },

  ui: {
    pageTitle: 'Shaping Sheet',
    instructionText: 'Organize your expository paragraph. Fill in each section to create a well-structured explanatory paragraph.',

    helpText: {
      title: 'Shaping Sheet Tips',
      sections: [
        {
          heading: 'Purpose',
          content: 'The shaping sheet helps you organize your explanation into a clear, coherent paragraph structure.',
        },
        {
          heading: 'Concrete Details',
          content: 'Your concrete details should provide specific facts, examples, or evidence that explain your topic clearly.',
        },
        {
          heading: 'Commentary',
          content: 'The commentary sentence should explain the significance of your concrete details and connect them to your topic sentence.',
        },
      ],
    },

    buttons: {
      back: 'Back',
      save: 'Save Progress',
      next: 'Save and Next',
    },
  },

  validation: {
    requiredFields: ['topicSentence', 'chunk1CD', 'commentarySentence', 'concludingSentence'],

    validateSubmit: (data) => {
      if (!data.topicSentence || data.topicSentence.trim().length === 0) {
        return { valid: false, message: 'Please enter a topic sentence' };
      }

      if (!data.chunk1CD || data.chunk1CD.trim().length === 0) {
        return { valid: false, message: 'Please enter the Chunk 1 concrete detail' };
      }

      // Check chunk 2 if 2 chunks selected
      if (data.selectedChunks === 2) {
        if (!data.chunk2CD || data.chunk2CD.trim().length === 0) {
          return { valid: false, message: 'Please enter the Chunk 2 concrete detail' };
        }
      }

      if (!data.commentarySentence || data.commentarySentence.trim().length === 0) {
        return { valid: false, message: 'Please enter a commentary sentence' };
      }

      if (!data.concludingSentence || data.concludingSentence.trim().length === 0) {
        return { valid: false, message: 'Please enter a concluding sentence' };
      }

      return { valid: true };
    },
  },

  navigation: {
    backRoute: '/dashboard/assignments/[id]/working-topic-sentence',
    nextRoute: '/dashboard/assignments/[id]/final-draft',
  },
};
