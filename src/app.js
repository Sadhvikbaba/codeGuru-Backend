import express, { urlencoded } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import errorHandler from "./middlewares/errorHandler.js";


const app = express()

app.use(cors({
  origin: "https://code-guru-frontend.vercel.app",
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'Access-Control-Allow-Headers', 'Access-Control-Allow-Methods'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
}));


app.use(express.json({limit : "16kb"}))
app.use(express.urlencoded({extended : true , limit : "16kb"}))
app.use(express.static("public"))
app.use(cookieParser())


//routes import
import userRouter from "./routes/user.routes.js";
import codeRouter from "./routes/code.routes.js"
//import { createSampleQuestion } from "./codePush.js";

//createSampleQuestion()
//routes usage
app.use("/api/v1/user" , userRouter);
app.use("/api/v1/code" , codeRouter);

app.use(errorHandler)

export {app}