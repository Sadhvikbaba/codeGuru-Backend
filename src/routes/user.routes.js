import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { logoutUser, refreshAccesstoken,  getUserDashboard , getStarted , getUsers , updateDetails , getCurrentUser} from "../controllers/user.controller.js";

const router = Router()

router.route("/get-started").post(getStarted);
router.route("/logout").post(verifyJWT , logoutUser);
router.route("/refresh").post(verifyJWT ,refreshAccesstoken);
router.route("/update-details").post(verifyJWT , updateDetails);
router.route("/get-details/:slug").get(verifyJWT ,getUserDashboard);
router.route("/get-users").get(verifyJWT ,getUsers);
router.route("/current-user").get(verifyJWT ,getCurrentUser);

export default router