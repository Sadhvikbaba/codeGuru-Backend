import mongoose from "mongoose";

const submissionSchema= new mongoose.Schema({
    questionId : {
        type : mongoose.Schema.Types.ObjectId ,
        ref : "Question",
        required : true
    },
    code : {
        type : String ,
        required : true
    },
    userId : {
        type : mongoose.Schema.Types.ObjectId ,
        ref : "User" ,
        required : true
    } ,
    language : {
        type : String ,
        required : true ,
    }
} , {timestamps : true})

export const Submission = mongoose.model('Submission' , submissionSchema)