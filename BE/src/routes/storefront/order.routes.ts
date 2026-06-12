import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.middleware";
import { getUserOrders, cancelOrder } from "../../controllers/storefront/order.controller";

const router = Router();

router.get("/", authenticate, getUserOrders);
router.patch("/:orderId/cancel", authenticate, cancelOrder);

export default router;
