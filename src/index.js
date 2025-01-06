import connectDB from "./db/index.js"
import dotenv from "dotenv"
import { app } from "./app.js";
import cors from "cors"

dotenv.config({
    path: '.env'
})

connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000 , () => {
        console.log(`server is running on https://localhost:${process.env.PORT}`);
    })
}).catch((err) => {
    console.log("Mongo DB connection failed :",err);
})