import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.middleware";
import { getDashboardStats } from "../../controllers/admin/admin-dashboard.controller";

const router = Router();

router.get("/", authenticate, getDashboardStats);

export default router;
