import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.middleware";
import { getCategories, createCategory, setCategoryActive, setCategoryInactive, getCategoriesAnalytics, getCategoryTopProducts } from "../../controllers/admin/admin-categories.controller";

const router = Router();

router.get("/", authenticate, getCategories);
router.post("/", authenticate, createCategory);
router.get("/analytics", authenticate, getCategoriesAnalytics);
router.get("/:id/top-products", authenticate, getCategoryTopProducts);
router.patch("/:id/set-active", authenticate, setCategoryActive);
router.patch("/:id/set-inactive", authenticate, setCategoryInactive);

export default router;
