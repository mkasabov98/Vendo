import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middlewares/authenticate.middleware";
import { UserRoles } from "../../enums/user-enums.enum";
import { OrderProduct } from "../../models/orderProduct.model";
import { Order } from "../../models/order.model";
import { OrderStatuses } from "../../enums/order-enums.enum";
import { Review } from "../../models/review.model";
import { Product } from "../../models/product.model";
import { User } from "../../models/user.model";
import { literal } from "sequelize";
import sequelize from "../../config/database";

// POST app/review
export const createReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    const body: { productId: number; starReview: number; review: string | null } = req.body;

    try {
        if (user?.role !== UserRoles.User) {
            throw { status: 401, message: "Unauthorized" };
        }

        if (!Number.isInteger(body.starReview) || body.starReview < 1 || body.starReview > 5) {
            throw { status: 400, message: "starReview must be a whole number between 1 and 5." };
        }

        const existingReview = await Review.findOne({
            where: {
                userId: user.id,
                productId: body.productId,
            },
        });

        if (existingReview) {
            throw { status: 400, message: "You have already left a review for this product." };
        }

        const lastOrder = await Order.findOne({
            where: {
                userId: user.id,
                status: OrderStatuses.Delivered,
            },
            include: [
                {
                    model: OrderProduct,
                    required: true,
                    where: {
                        productId: body.productId,
                    },
                },
            ],
            order: [["createdAt", "DESC"]],
        });

        if (!lastOrder) {
            throw {
                status: 400,
                message: "You can leave a review only after you purchased this product and it was delivered.",
            };
        }

        const t = await sequelize.transaction();
        let newReview: Review;
        try {
            newReview = await Review.create({
                userId: user.id,
                productId: body.productId,
                orderId: lastOrder.id,
                starReview: body.starReview,
                review: body.review,
            }, { transaction: t });

            const productReviews = await Review.findAll({ where: { productId: body.productId }, transaction: t });
            const productReviewEstimate = productReviews.reduce((acc, x) => acc + x.starReview, 0) / productReviews.length;

            await Product.update(
                { starReview: productReviewEstimate, reviewsCount: literal("reviewsCount + 1") },
                { where: { id: body.productId }, transaction: t }
            );

            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }

        return res.status(201).json(newReview);
    } catch (error) {
        next(error);
    }
};

// GET app/review/:productId
export const getReviewsByProductId = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const productId = parseInt(req.params.productId, 10);
    const userId = req.user?.id;

    try {
        const reviews = await Review.findAll({
            where: { productId },
            include: [{ model: User, attributes: ["email"] }],
            order: [["createdAt", "DESC"]],
        });

        const formattedReviews = reviews.map((r) => {
            const raw = r as any;
            const author = raw.User?.email?.split("@")[0] ?? "Anonymous";
            return {
                id: r.id,
                starReview: r.starReview,
                review: r.review,
                createdAt: r.createdAt,
                author,
                isOwn: userId ? r.userId === userId : false,
            };
        });

        let hasReviewed: boolean | null = null;
        let canReview: boolean | null = null;

        if (userId) {
            hasReviewed = reviews.some((r) => r.userId === userId);

            const deliveredOrder = await Order.findOne({
                where: { userId, status: OrderStatuses.Delivered },
                include: [{ model: OrderProduct, required: true, where: { productId } }],
            });
            canReview = !!deliveredOrder;
        }

        return res.status(200).json({ reviews: formattedReviews, hasReviewed, canReview });
    } catch (error) {
        next(error);
    }
};

// PUT app/review/:reviewId
export const updateReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    const reviewId = parseInt(req.params.reviewId, 10);
    const body: { starReview: number; review: string | null } = req.body;

    try {
        if (user?.role !== UserRoles.User) {
            throw { status: 401, message: "Unauthorized" };
        }

        if (!Number.isInteger(body.starReview) || body.starReview < 1 || body.starReview > 5) {
            throw { status: 400, message: "starReview must be a whole number between 1 and 5." };
        }

        const review = await Review.findOne({ where: { id: reviewId, userId: user.id } });

        if (!review) {
            throw { status: 404, message: "Review not found." };
        }

        const deliveredOrder = await Order.findOne({
            where: { id: review.orderId, userId: user.id, status: OrderStatuses.Delivered },
        });
        if (!deliveredOrder) {
            throw { status: 403, message: "You can only edit a review for a delivered order." };
        }

        const t = await sequelize.transaction();
        try {
            await review.update({ starReview: body.starReview, review: body.review ?? null }, { transaction: t });

            const productReviews = await Review.findAll({ where: { productId: review.productId }, transaction: t });
            const newAverage = productReviews.reduce((acc, r) => acc + r.starReview, 0) / productReviews.length;

            await Product.update({ starReview: newAverage }, { where: { id: review.productId }, transaction: t });

            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }

        return res.status(200).json(review);
    } catch (error) {
        next(error);
    }
};
