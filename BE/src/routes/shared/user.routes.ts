import { Router } from "express";
import { changePassword } from "../../controllers/shared/user.controller";
import { authenticate } from "../../middlewares/authenticate.middleware";

const router = Router();

router.patch("/password", authenticate, changePassword);

export default router;
