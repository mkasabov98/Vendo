import { Router } from "express";
import { createReview, getReviewsByProductId, updateReview } from "../../controllers/storefront/review.controller";
import { authenticate, optionalAuthenticate } from "../../middlewares/authenticate.middleware";

const router = Router();

router.get("/:productId", optionalAuthenticate, getReviewsByProductId);
router.post("/", authenticate, createReview);
router.put("/:reviewId", authenticate, updateReview);

export default router;
