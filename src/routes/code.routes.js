import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {compileCode , testRun , getAllCodes ,getCounts , getQuestionById} from "../controllers/code.controller.js"

const router = Router();

router.route("/submit-code/:slug").post(verifyJWT , compileCode);
router.route("/testing-code").post(testRun);
router.route("/get-codes").get(verifyJWT , getAllCodes);
router.route("/get-counts").get(getCounts);
router.route("/question/:slug").get(getQuestionById);

export default router