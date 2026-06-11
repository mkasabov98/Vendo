import { Router } from "express";
import { getAllCategories, getAllProducts, getProductById, getSpecificProducts } from "../../controllers/storefront/products.controller";

const router = Router();

router.get("/categories", getAllCategories);
router.get("/specificProducts", getSpecificProducts);
router.get("/:productId", getProductById);
router.get("/", getAllProducts);

export default router;
