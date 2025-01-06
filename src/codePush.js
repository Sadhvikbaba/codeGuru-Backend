import mongoose from 'mongoose';
import { Question } from './models/question.models.js';

export async function createSampleQuestion() {
  const question = new Question({
    "title": "Add Two Numbers",
    "description": "Given two integers, return their sum.",
    "difficulty": "Easy",
    "constraints": "The integers will be non-negative and not exceed 10^5.",
    "examples": [
      {
        "input": "3\n4",
        "output": "7",
        "explanation": "The sum of 3 and 4 is 7."
      }
    ],
    "hints": ["Use the '+' operator to add the numbers.", "Read input as integers."],
    "solution": "def add_two_numbers(a, b):\n    return a + b",
    "testCases": [
      { "input": "5\n6", "output": "11" },
      { "input": "0\n0", "output": "0" },
      { "input": "10\n15", "output": "25" }
    ],
    "author": "67238f8fa3920f8089ac7d9a",
    "submissions": 15,
    "acceptedSubmissions": 10
  });

  await question.save();
  console.log('Sample question created:', question);
}

// createSampleQuestion().catch(err => console.error(err));

// author : 67238f8fa3920f8089ac7d9a
