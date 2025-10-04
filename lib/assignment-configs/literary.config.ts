// lib/assignment-configs/literary.config.ts
import { WritingStyleGatheringCDsConfig, WritingStyleShapingConfig } from './types';

export const literaryGatheringCDsConfig: WritingStyleGatheringCDsConfig = {
  style: 'literary',
  displayName: 'Literary Analysis',

  behavior: {
    maxChunks: 2,
    selectionMode: 'single', // Key difference: literary uses single selection
    minCDsPerChunk: 1,
    maxCDsPerChunk: 20,
    minSelectionsPerChunk: 1,
    maxSelectionsPerChunk: 1,
    allowReordering: true,
  },

  ui: {
    pageTitle: 'Gathering Concrete Details',
    instructionText: 'Add concrete details (quotes or examples) for each chunk of your literary analysis. Select the one you will use in your essay.',
    chunkLabel: (chunkNumber) => `Chunk ${chunkNumber}`,
    cdPlaceholder: 'Enter a quote or example from the text...',
    selectionInstruction: 'Select one concrete detail to use in your essay',

    helpText: {
      title: 'Tips for Gathering Concrete Details',
      sections: [
        {
          heading: 'What are Concrete Details?',
          content: 'Concrete details are direct quotes or specific examples from the literary text you are analyzing.',
        },
        {
          heading: 'How to write good CDs',
          content: 'Use exact quotes with proper citation. Choose passages that clearly support your analysis.',
        },
        {
          heading: 'Selecting your best CD',
          content: 'Choose the one CD that best supports your point. You can reorder your options by dragging.',
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

      if (selectedChunk1CDs.length < 1) {
        return { valid: false, message: 'Please select a concrete detail for Chunk 1' };
      }

      // Check chunk 2 if selected
      if (selectedChunks >= 2) {
        if (chunk2CDs.length === 0) {
          return { valid: false, message: 'Please add at least one concrete detail for Chunk 2' };
        }

        if (selectedChunk2CDs.length < 1) {
          return { valid: false, message: 'Please select a concrete detail for Chunk 2' };
        }
      }

      return { valid: true };
    },
  },

  nextStepRoute: '/dashboard/assignments/[id]/commentary',
};

export const literaryShapingConfig: WritingStyleShapingConfig = {
  style: 'literary',
  displayName: 'Literary Analysis',

  behavior: {
    sheetType: 'single',
    saveKey: 'step6',

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
        placeholder: 'First concrete detail (quote)...',
        rows: 2,
      },
      {
        key: 'chunk1CM1',
        label: 'Chunk 1 Commentary 1',
        type: 'textarea',
        placeholder: 'First commentary for Chunk 1...',
        rows: 2,
      },
      {
        key: 'chunk1CM2',
        label: 'Chunk 1 Commentary 2',
        type: 'textarea',
        placeholder: 'Second commentary for Chunk 1...',
        rows: 2,
      },
      {
        key: 'chunk2CD',
        label: 'Chunk 2 Concrete Detail',
        type: 'textarea',
        placeholder: 'Second concrete detail (quote)...',
        rows: 2,
        conditional: {
          field: 'selectedChunks',
          operator: '===',
          value: 2,
        },
      },
      {
        key: 'chunk2CM1',
        label: 'Chunk 2 Commentary 1',
        type: 'textarea',
        placeholder: 'First commentary for Chunk 2...',
        rows: 2,
        conditional: {
          field: 'selectedChunks',
          operator: '===',
          value: 2,
        },
      },
      {
        key: 'chunk2CM2',
        label: 'Chunk 2 Commentary 2',
        type: 'textarea',
        placeholder: 'Second commentary for Chunk 2...',
        rows: 2,
        conditional: {
          field: 'selectedChunks',
          operator: '===',
          value: 2,
        },
      },
      {
        key: 'concludingSentence',
        label: 'Concluding Sentence',
        type: 'textarea',
        placeholder: 'Wrap up your analysis...',
        rows: 3,
      },
    ],

    autoAssembleParagraph: false,

    dataSource: {
      stepKey: 'step4',
      fieldMappings: {
        topicSentence: 'topicSentence',
      },
    },
  },

  ui: {
    pageTitle: 'Shaping Sheet',
    instructionText: 'Organize your literary analysis paragraph. Fill in each section to create a well-developed analytical paragraph.',

    helpText: {
      title: 'Shaping Sheet Tips',
      sections: [
        {
          heading: 'Purpose',
          content: 'The shaping sheet helps you organize your textual evidence and analysis into a coherent paragraph structure.',
        },
        {
          heading: 'Concrete Details',
          content: 'Your concrete details should be direct quotes from the text that support your analytical claim.',
        },
        {
          heading: 'Commentary',
          content: 'Each CD needs two commentary sentences that analyze and explain how the quote supports your thesis.',
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
    requiredFields: ['topicSentence', 'chunk1CD', 'chunk1CM1', 'chunk1CM2', 'concludingSentence'],

    validateSubmit: (data) => {
      if (!data.topicSentence || data.topicSentence.trim().length === 0) {
        return { valid: false, message: 'Please enter a topic sentence' };
      }

      if (!data.chunk1CD || data.chunk1CD.trim().length === 0) {
        return { valid: false, message: 'Please enter the Chunk 1 concrete detail' };
      }

      if (!data.chunk1CM1 || data.chunk1CM1.trim().length === 0) {
        return { valid: false, message: 'Please enter Chunk 1 Commentary 1' };
      }

      if (!data.chunk1CM2 || data.chunk1CM2.trim().length === 0) {
        return { valid: false, message: 'Please enter Chunk 1 Commentary 2' };
      }

      // Check chunk 2 if 2 chunks selected
      if (data.selectedChunks === 2) {
        if (!data.chunk2CD || data.chunk2CD.trim().length === 0) {
          return { valid: false, message: 'Please enter the Chunk 2 concrete detail' };
        }
        if (!data.chunk2CM1 || data.chunk2CM1.trim().length === 0) {
          return { valid: false, message: 'Please enter Chunk 2 Commentary 1' };
        }
        if (!data.chunk2CM2 || data.chunk2CM2.trim().length === 0) {
          return { valid: false, message: 'Please enter Chunk 2 Commentary 2' };
        }
      }

      if (!data.concludingSentence || data.concludingSentence.trim().length === 0) {
        return { valid: false, message: 'Please enter a concluding sentence' };
      }

      return { valid: true };
    },
  },

  navigation: {
    backRoute: '/dashboard/assignments/[id]/commentary',
    nextRoute: '/dashboard/assignments/[id]/final-draft',
  },
};
