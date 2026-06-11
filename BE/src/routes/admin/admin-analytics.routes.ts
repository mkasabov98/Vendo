import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.middleware";
import { getAnalyticsTimeseries, getAnalyticsBreakdown } from "../../controllers/admin/admin-analytics.controller";

const router = Router();

router.get("/timeseries", authenticate, getAnalyticsTimeseries);
router.get("/breakdown", authenticate, getAnalyticsBreakdown);

export default router;
