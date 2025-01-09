import { asyncHandler } from "../utils/asyncHandler.js";
import { submitCode } from "../utils/codeCompiler.js";
import { Question } from "../models/question.models.js";
import mongoose from "mongoose";
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.models.js";
import { Submission } from "../models/submission.models.js";
import { submitBatchedCode } from "../utils/batchedSubmit.js";
import Bottleneck from "bottleneck";


export const compileCode = asyncHandler(async (req, res) => {
    const limiter = new Bottleneck({
        maxConcurrent: 1,
        minTime: 1000,
    });

    const limitedSubmitBatchedCode = limiter.wrap(submitBatchedCode);

    const { source_code, language_id } = req.body;
    const { slug } = req.params;
    const userId = req.user?._id;

    if (!source_code || !language_id) {
        return res.status(400).json({ message: "source_code and language_id are required" });
    }

    const question = mongoose.isValidObjectId(slug)
        ? await Question.findById(slug)
        : await Question.findOne({ slug });

    if (!question) {
        return res.status(404).json({ message: "Question not found" });
    }

    const testCases = question.testCases;

    const submissions = testCases.map(testCase => ({
        source_code,
        language_id,
        stdin: testCase.input.trim(),
    }));

    const results = await limitedSubmitBatchedCode(submissions);

    const processedResults = results.map((result, index) => {
        const actualOutput = result.stdout ? result.stdout.trim() : result.stderr;
        const expectedOutput = testCases[index].output.trim();

        return {
            input: testCases[index].input.trim() || " ",
            expectedOutput,
            actualOutput,
            passed: result.status !== "error" && actualOutput === expectedOutput,
        };
    });

    const passedCount = processedResults.filter(r => r.passed).length;

    if (passedCount === testCases.length) {
        const user = await User.findById(userId);
        if (!user) throw new Error("User not found");

        let solved = user.solved || [] ;

        const updatedHistory = solved.filter((item, pos) => solved.indexOf(item) === pos);
        
        await User.findByIdAndUpdate(userId, { $set: { solved: updatedHistory } }, { new: true });
        await Question.findByIdAndUpdate(slug, { $inc: { acceptedSubmissions: 1 } });

        const existingSubmission = await Submission.findOne({ userId, language: language_id });
        if (existingSubmission) {
            existingSubmission.code = source_code;
            await existingSubmission.save();
        } else {
            await Submission.create({ questionId: slug, userId, code: source_code, language: language_id });
        }
    }

    await Question.findByIdAndUpdate(slug, { $inc: { submissions: 1 } });

    res.status(200).json({
        message: "Compilation completed",
        totalTestCases: testCases.length,
        passedTestCases: passedCount,
        results: processedResults,
    });
});

export const testRun = asyncHandler(async (req , res)=>{
    
    const { source_code, language_id , stdin} = req.body;
    //console.log(source_code, language_id , stdin);
    

    const response =  await submitCode({source_code , language_id , stdin});
    console.log(response);

    res.status(200).json({response})

});

export const getAllCodes = asyncHandler(async (req , res) => {
    const response = await Question.aggregate([
        {$project : {
            title : 1,
            description : 1,
            difficulty : 1,
            submissions : 1
        }}
    ])

    return res.status(200).json({response})

});

export const getCounts = asyncHandler(async (req , res) => {
    const response = await Promise.all([User.countDocuments() , Submission.countDocuments() ,Question.countDocuments()]);

    if(!response) throw new ApiError(500 , "problem with fetching");

    return res.status(200).json({users : response[0] , submissions : response[1] , questions : response[2]})
});

export const getQuestionById = asyncHandler(async (req, res) => {
    const { slug } = req.params;

    const [question, submissions] = await Promise.all([
        Question.aggregate([
            {$match : {_id : new mongoose.Types.ObjectId(slug)}},
            {$lookup : {
                localField : "author",
                foreignField : "_id",
                from : "users",
                as : "author",
                pipeline : [{
                    $project : {fullName : 1}
                }]
            }}
        ]),
        Submission.aggregate([
            {
                $match: {
                    questionId: new mongoose.Types.ObjectId(slug),
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user",
                    pipeline: [
                        {
                            $project: {
                                avatar: 1,
                                fullName: 1,
                            },
                        },
                    ],
                },
            },
            {
                $addFields: {
                    user: { $arrayElemAt: ["$user", 0] }, 
                },
            },
        ]),
    ]);

    return res.status(200).json({ question : question[0], submissions });
});
