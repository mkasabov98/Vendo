import { Router } from "express";
import { bulkUpdateCart, deleteProductFromCart, getAllProductsInCart, updateCartProduct, validateDiscountCode, removeDiscountCode } from "../../controllers/storefront/cart.controller";
import { authenticate } from "../../middlewares/authenticate.middleware";
import { createPaymentIntent } from "../../controllers/storefront/order.controller";

const router = Router();

router.post("/create-payment-intent", authenticate, createPaymentIntent);
router.post("/validate-discount", authenticate, validateDiscountCode);
router.delete("/discount", authenticate, removeDiscountCode);
router.patch("/updateProduct", authenticate, updateCartProduct);
router.patch("/updateCart", authenticate, bulkUpdateCart);
router.delete("/deleteProduct/:productId", authenticate, deleteProductFromCart);
router.get("/", authenticate, getAllProductsInCart);

export default router;
