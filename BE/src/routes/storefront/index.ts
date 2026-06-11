import { Router } from "express";
import productsRouter from "./products.routes";
import cartRouter from "./cart.routes";
import orderRouter from "./order.routes";
import addressRouter from "./address.routes";
import reviewRouter from "./review.routes";

const router = Router();

router.use("/products", productsRouter);
router.use("/cart", cartRouter);
router.use("/order", orderRouter);
router.use("/address", addressRouter);
router.use("/review", reviewRouter);

export default router;
