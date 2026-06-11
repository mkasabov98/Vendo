import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.middleware";
import { createProduct, updateProduct, getAdminProducts, getProductCartCount, deleteProduct, bulkUpdateProducts } from "../../controllers/admin/admin-products.controller";

const router = Router();

router.get("/", authenticate, getAdminProducts);
router.post("/create", authenticate, createProduct);
router.patch("/bulk-update", authenticate, bulkUpdateProducts);
router.patch("/update/:productId", authenticate, updateProduct);
router.get("/:productId/cart-count", authenticate, getProductCartCount);
router.delete("/delete/:productId", authenticate, deleteProduct);

export default router;
