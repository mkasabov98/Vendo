import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.middleware";
import {
    bulkUpdateProducts,
    createCategory,
    createProduct,
    deleteProduct,
    getAdminOrders,
    getAdminOrderDetail,
    updateAdminOrderStatus,
    getAdminProducts,
    getAdminCustomers,
    getAdminAdmins,
    getCustomerOrders,
    getAnalyticsBreakdown,
    getAnalyticsTimeseries,
    getCategories,
    getCategoriesAnalytics,
    getCategoryTopProducts,
    getDashboardStats,
    getProductCartCount,
    registerAdmin,
    setCategoryActive,
    setCategoryInactive,
    updateProduct,
} from "../controllers/admin.controller";

const router = Router();

router.get("/users/customers", authenticate, getAdminCustomers);
router.get("/users/customers/:id/orders", authenticate, getCustomerOrders);
router.get("/users/admins", authenticate, getAdminAdmins);
router.get("/orders", authenticate, getAdminOrders);
router.get("/orders/:id", authenticate, getAdminOrderDetail);
router.patch("/orders/:id/status", authenticate, updateAdminOrderStatus);
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
router.get("/categories", authenticate, getCategories);
router.post("/categories", authenticate, createCategory);
router.get("/categories/analytics", authenticate, getCategoriesAnalytics);
router.get("/categories/:id/top-products", authenticate, getCategoryTopProducts);
router.patch("/categories/:id/set-active", authenticate, setCategoryActive);
router.patch("/categories/:id/set-inactive", authenticate, setCategoryInactive);

export default router;
