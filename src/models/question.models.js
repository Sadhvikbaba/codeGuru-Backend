import mongoose from "mongoose";

const QuestionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    required: true
  },
  constraints: {
    type: String,
    required: true
  },
  examples: [
    {
      input: String,
      output: String,
      explanation: String
    }
  ],
  hints: {
    type: [String],
    default: []
  },
  solution: {
    type: String,
    default: ""
  },
  testCases: [{
    input: {
      type: String,
      required: true
    },
    output: {
      type: String,
      required: true
    }
  }], 
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  submissions: {
    type: Number,
    default: 0
  },
  acceptedSubmissions: {
    type: Number,
    default: 0
  },
});

export const Question = mongoose.model('Question', QuestionSchema);
