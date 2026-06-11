import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.middleware";
import { getAdminOrders, getAdminOrderDetail, updateAdminOrderStatus } from "../../controllers/admin/admin-orders.controller";

const router = Router();

router.get("/", authenticate, getAdminOrders);
router.get("/:id", authenticate, getAdminOrderDetail);
router.patch("/:id/status", authenticate, updateAdminOrderStatus);

export default router;
