// lib/assignment-configs/argumentation.config.ts
import { WritingStyleGatheringCDsConfig, WritingStyleWorkingTopicSentenceConfig, WritingStyleShapingConfig } from './types';

export const argumentationGatheringCDsConfig: WritingStyleGatheringCDsConfig = {
  style: 'argumentation',
  displayName: 'Argumentation',

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
    instructionText: 'Add concrete details for each chunk of your argumentation essay. You can add multiple CDs and select 2-4 to use in your essay.',
    chunkLabel: (chunkNumber) => `Chunk ${chunkNumber}`,
    cdPlaceholder: 'Enter a concrete detail...',
    selectionInstruction: 'Select 2-4 concrete details to use in your essay',

    helpText: {
      title: 'Tips for Gathering Concrete Details',
      sections: [
        {
          heading: 'What are Concrete Details?',
          content: 'Concrete details are specific facts, examples, or evidence that support your argument.',
        },
        {
          heading: 'How to write good CDs',
          content: 'Be specific and factual. Use quotes, statistics, or real examples.',
        },
        {
          heading: 'Selecting your best CDs',
          content: 'Choose 2-4 CDs that best support your argument. You can reorder them by dragging.',
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

  nextStepRoute: '/dashboard/assignments/[id]/shaping',
};

export const argumentationWorkingTopicSentenceConfig: WritingStyleWorkingTopicSentenceConfig = {
  style: 'argumentation',
  displayName: 'Argumentation',

  behavior: {
    commentaryStructure: 'simple',
    simpleCommentary: {
      label: 'Commentary',
      placeholder: 'Enter your commentary for this concrete detail...',
    },
  },

  ui: {
    pageTitle: 'Working Topic Sentence',
    instructionText: 'Create your working topic sentence and add commentary for each concrete detail you selected.',
    topicSentenceLabel: 'Working Topic Sentence',
    topicSentencePlaceholder: 'Enter your working topic sentence...',

    helpText: {
      title: 'Working Topic Sentence Tips',
      sections: [
        {
          heading: 'What is a Working Topic Sentence?',
          content: 'A working topic sentence introduces the main argument of your paragraph and sets up the evidence you will present.',
        },
        {
          heading: 'Writing Commentary',
          content: 'Commentary explains how your concrete details support your argument. It connects the evidence to your claim.',
        },
        {
          heading: 'Tips for Strong Commentary',
          content: 'Explain the significance of each piece of evidence. Show how it proves your point rather than just restating the fact.',
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

      // Check if commentary is provided for each CD
      if (data.commentaryData) {
        const hasEmptyCommentary = Object.values(data.commentaryData).some(
          (commentary) => !commentary || commentary.trim().length === 0
        );
        if (hasEmptyCommentary) {
          return { valid: false, message: 'Please provide commentary for all concrete details' };
        }
      }

      return { valid: true };
    },
  },

  nextStepRoute: '/dashboard/assignments/[id]/first-draft',
};

export const argumentationShapingConfig: WritingStyleShapingConfig = {
  style: 'argumentation',
  displayName: 'Argumentation',

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
        key: 'concessionCounterargument',
        label: 'Concession / Counterargument / Counterclaim',
        type: 'textarea',
        placeholder: 'Acknowledge the opposing viewpoint...',
        rows: 3,
      },
      {
        key: 'refutation',
        label: 'Refutation',
        type: 'textarea',
        placeholder: 'Refute the counterargument...',
        rows: 3,
      },
      {
        key: 'concreteDetails',
        label: 'Concrete Details',
        type: 'cd-array',
        readonly: true,
      },
      {
        key: 'commentarySentence',
        label: 'Commentary Sentence',
        type: 'textarea',
        placeholder: 'Explain how your evidence supports your argument...',
        rows: 3,
      },
      {
        key: 'concludingSentence',
        label: 'Concluding Sentence',
        type: 'textarea',
        placeholder: 'Wrap up your argument...',
        rows: 3,
      },
    ],

    autoAssembleParagraph: false,

    dataSource: {
      stepKey: 'step5',
      fieldMappings: {
        topicSentence: 'revisedTopicSentence',
        concessionCounterargument: 'concessionCounterargument',
        refutation: 'refutation',
        concreteDetails: 'selectedCDs',
        commentarySentence: 'commentarySentence',
        concludingSentence: 'concludingSentence',
      },
    },
  },

  ui: {
    pageTitle: 'Shaping Sheet',
    instructionText: 'Organize your argument into a structured paragraph. Fill in each section to create a well-developed argumentative paragraph.',

    helpText: {
      title: 'Shaping Sheet Tips',
      sections: [
        {
          heading: 'Purpose',
          content: 'The shaping sheet helps you organize all elements of your argument into a coherent paragraph structure.',
        },
        {
          heading: 'Concession & Refutation',
          content: 'Acknowledge opposing viewpoints (concession) and explain why your argument is stronger (refutation). This shows critical thinking.',
        },
        {
          heading: 'Commentary',
          content: 'Your commentary sentence should tie everything together, explaining how your evidence and reasoning support your main argument.',
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
    requiredFields: ['topicSentence', 'concessionCounterargument', 'refutation', 'commentarySentence', 'concludingSentence'],

    validateSubmit: (data) => {
      const required = ['topicSentence', 'concessionCounterargument', 'refutation', 'commentarySentence', 'concludingSentence'];

      for (const field of required) {
        if (!data[field] || data[field].trim().length === 0) {
          const labels: Record<string, string> = {
            topicSentence: 'Topic Sentence',
            concessionCounterargument: 'Concession/Counterargument',
            refutation: 'Refutation',
            commentarySentence: 'Commentary Sentence',
            concludingSentence: 'Concluding Sentence',
          };
          return { valid: false, message: `Please enter a ${labels[field]}` };
        }
      }

      return { valid: true };
    },
  },

  navigation: {
    backRoute: '/dashboard/assignments/[id]/first-draft',
    nextRoute: '/dashboard/assignments/[id]/final-draft',
  },
};
