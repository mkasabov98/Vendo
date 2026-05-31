import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.middleware";
import { bulkUpdateProducts, createCategory, createProduct, deleteProduct, getAdminProducts, getAnalyticsBreakdown, getAnalyticsTimeseries, getDashboardStats, getProductCartCount, registerAdmin, updateProduct } from "../controllers/admin.controller";

const router = Router();

router.get("/dashboard", authenticate, getDashboardStats);
router.get("/analytics/timeseries", authenticate, getAnalyticsTimeseries);
router.get("/analytics/breakdown", authenticate, getAnalyticsBreakdown);
router.post("/register", authenticate, registerAdmin);
router.get("/products", authenticate, getAdminProducts);
router.post("/products/create", authenticate, createProduct);
router.patch("/products/bulk-update", authenticate, bulkUpdateProducts);
router.patch("/products/update/:productId", authenticate, updateProduct);
router.get("/products/:productId/cart-count", authenticate, getProductCartCount);
router.delete("/products/delete/:productId", authenticate, deleteProduct);
router.post("/category", authenticate, createCategory);

export default router;
