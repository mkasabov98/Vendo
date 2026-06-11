import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.middleware";
import { registerAdmin } from "../../controllers/admin/admin-users.controller";
import productsRouter from "./admin-products.routes";
import ordersRouter from "./admin-orders.routes";
import categoriesRouter from "./admin-categories.routes";
import analyticsRouter from "./admin-analytics.routes";
import dashboardRouter from "./admin-dashboard.routes";
import usersRouter from "./admin-users.routes";

const router = Router();

router.post("/register", authenticate, registerAdmin);
router.use("/products", productsRouter);
router.use("/orders", ordersRouter);
router.use("/categories", categoriesRouter);
router.use("/analytics", analyticsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/users", usersRouter);

export default router;
