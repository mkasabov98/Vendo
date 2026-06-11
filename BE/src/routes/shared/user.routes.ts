import { Router } from "express";
import { deleteUser, changePassword } from "../../controllers/shared/user.controller";
import { authenticate } from "../../middlewares/authenticate.middleware";

const router = Router();

router.patch("/password", authenticate, changePassword);
router.delete("/delete/:userId", authenticate, deleteUser);

export default router;
