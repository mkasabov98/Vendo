import { NextFunction, Request, Response } from "express";
import { Transaction } from "sequelize";
import { AuthRequest } from "../middlewares/authenticate.middleware";
import { UserRoles } from "../enums/user-enums.enum";
import { Cart } from "../models/cart.model";
import { CartProduct } from "../models/cartProduct.model";
import { Product } from "../models/product.model";
import { Order } from "../models/order.model";
import { OrderStatuses } from "../enums/order-enums.enum";
import sequelize from "../config/database";
import { OrderProduct } from "../models/orderProduct.model";
import { Address } from "../models/address.model";
import stripe from "../config/stripe";
import Stripe from "stripe";
import { User } from "../models/user.model";
import { DiscountCode } from "../models/discountCode.model";
import { sendOrderConfirmationEmail, sendOrderShippedEmail, sendOrderDeliveredEmail } from "../services/email.service";

interface WebhookRequest extends Request {
    rawBody: Buffer;
}

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_LOCAL_WEBHOOK_SECRET;

export const handleStripeWebhook = async (req: WebhookRequest, res, next: NextFunction) => {
    const sig = req.headers["stripe-signature"] as string;
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (error) {
        console.log(`❌ Webhook signature verification failed:`, error);
        return res.sendStatus(400);
    }

    if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const transaction = await sequelize.transaction();

        try {
            const order = await Order.findOne({
                where: { stripePaymentIntentId: paymentIntent.id },
                transaction,
            });

            if (!order || order.status !== OrderStatuses.Pending) {
                await transaction.rollback();
                return res.sendStatus(200);
            }

            const orderProducts = await OrderProduct.findAll({
                where: { orderId: order.id },
                include: [{ model: Product, attributes: ["name"] }],
                transaction,
            });

            // Lock each product row and validate stock before committing anything
            for (const x of orderProducts) {
                const product = await Product.findByPk(x.productId, {
                    lock: Transaction.LOCK.UPDATE,
                    transaction,
                });
                if (!product || product.stock < x.quantity) {
                    try {
                        await stripe.refunds.create({ payment_intent: paymentIntent.id });
                    } catch (refundError) {
                        console.error(`CRITICAL: Refund failed for payment intent ${paymentIntent.id}`, refundError);
                    }
                    await order.update({ status: OrderStatuses.Cancelled }, { transaction });
                    await transaction.commit();
                    console.warn(`Order ${order.id} cancelled and refunded — insufficient stock for payment intent ${paymentIntent.id}`);
                    return res.sendStatus(200);
                }
            }

            await order.update({ status: OrderStatuses.Paid }, { transaction });

            for (const x of orderProducts) {
                await Product.decrement("stock", { by: x.quantity, where: { id: x.productId }, transaction });
                await Product.update(
                    { isActive: false },
                    { where: { id: x.productId, stock: 0 }, transaction },
                );
            }

            const userId = parseInt(paymentIntent.metadata.userId);
            if (isNaN(userId)) {
                console.error(`Webhook: missing userId in metadata for payment intent ${paymentIntent.id}`);
                await transaction.rollback();
                return res.sendStatus(200);
            }

            const userCart = await Cart.findOne({ where: { userId }, transaction });
            if (userCart) {
                await CartProduct.destroy({ where: { cartId: userCart.id }, transaction });
                await userCart.update({ discountCodeId: null }, { transaction });
            }

            if (order.discountCodeId) {
                await DiscountCode.update(
                    { used: true, orderId: order.id },
                    { where: { id: order.discountCodeId }, transaction }
                );
            }

            await transaction.commit();
            console.log(`Order ${order.id} fulfilled for user ${userId} — payment intent ${paymentIntent.id}`);

            const user = await User.findByPk(userId, { attributes: ["email"] });

            if (user) {
                const items = orderProducts.map((x: any) => ({
                    name: x.Product?.name ?? "Unknown product",
                    quantity: x.quantity,
                    priceAtPurchase: x.priceAtPurchase,
                }));

                sendOrderConfirmationEmail(
                    user.email,
                    order.id,
                    items,
                    order.totalAmount,
                    order.shippingAddress,
                    order.discountAmount ?? undefined
                ).catch((err) => console.error("Failed to send order confirmation email:", err));

                const THREE_MINUTES = 3 * 60 * 1000;
                const orderId = order.id;
                const userEmail = user.email;

                setTimeout(async () => {
                    try {
                        await Order.update({ status: OrderStatuses.Shipped }, { where: { id: orderId } });
                        sendOrderShippedEmail(userEmail, orderId).catch((err) =>
                            console.error("Failed to send order shipped email:", err)
                        );
                    } catch (err) {
                        console.error(`Failed to update order ${orderId} to Shipped:`, err);
                    }
                }, THREE_MINUTES);

                setTimeout(async () => {
                    try {
                        await Order.update({ status: OrderStatuses.Delivered }, { where: { id: orderId } });
                        sendOrderDeliveredEmail(userEmail, orderId).catch((err) =>
                            console.error("Failed to send order delivered email:", err)
                        );
                    } catch (err) {
                        console.error(`Failed to update order ${orderId} to Delivered:`, err);
                    }
                }, THREE_MINUTES * 2);
            }
        } catch (error) {
            console.error("Error during webhook fulfillment:", error);
            await transaction.rollback();
        }
    }

    if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        try {
            await Order.update(
                { status: OrderStatuses.Cancelled },
                { where: { stripePaymentIntentId: paymentIntent.id, status: OrderStatuses.Pending } }
            );
            console.log(`Order cancelled due to ${event.type} — payment intent ${paymentIntent.id}`);
        } catch (error) {
            console.error(`Failed to cancel order for payment intent ${paymentIntent.id}`, error);
        }
    }

    return res.sendStatus(200);
};

export const getUserOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (req.user?.role !== UserRoles.User) throw { status: 401, message: "Unauthorized" };

        const orders = await Order.findAll({
            where: { userId: req.user.id },
            include: [
                {
                    model: OrderProduct,
                    include: [{ model: Product, attributes: ["name", "imageUrl"] }],
                },
            ],
            order: [["createdAt", "DESC"]],
        });

        const result = orders.map((order: any) => ({
            id: order.id,
            status: order.status,
            totalAmount: order.totalAmount,
            shippingAddress: order.shippingAddress,
            createdAt: order.createdAt,
            products: order.OrderProducts?.map((op: any) => ({
                productId: op.productId,
                name: op.Product?.name,
                imageUrl: op.Product?.imageUrl,
                priceAtPurchase: op.priceAtPurchase,
                quantity: op.quantity,
            })) ?? [],
        }));

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const createPaymentIntent = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    const addressId = req.body.addressId;

    try {
        if (req.user?.role !== UserRoles.User) throw { status: 401, message: "Unauthorized" };

        const userCart = await Cart.findOne({
            where: { userId: user.id },
            include: [{ model: DiscountCode, as: "CartDiscount" }],
        }) as Cart & { CartDiscount: DiscountCode | null };
        if (!userCart) throw { status: 400, message: "No cart found." };

        const address = await Address.findOne({ where: { id: addressId, userId: user.id } });
        if (!address) throw { status: 400, message: "No matching address" };

        const productsInCart = await CartProduct.findAll({
            where: { cartId: userCart.id },
            include: [
                {
                    model: Product,
                    as: "Product",
                    attributes: ["stock", "finalPrice", "name", "isActive"],
                },
            ],
        });

        if (productsInCart.length === 0) throw { status: 400, message: "Cart is empty" };

        const subtotal = productsInCart.reduce((acc, x) => acc + x.quantity * x.Product.finalPrice, 0);

        const errors: string[] = [];
        productsInCart.forEach((x) => {
            if (!x.Product.isActive) {
                errors.push(`"${x.Product.name}" is no longer available. Please remove it from your cart before checking out.`);
            } else if (x.quantity > x.Product.stock) {
                errors.push(
                    `Currently we do not have ${x.quantity} units of ${x.Product.name} in stock. We have ${x.Product.stock} units in stock of that item.`
                );
            }
        });
        if (errors.length) {
            return res.status(400).json({ errors });
        }

        let discountCode: DiscountCode | null = userCart.CartDiscount ?? null;
        let discountAmount = 0;

        if (discountCode) {
            if (discountCode.used || new Date(discountCode.expirationDate) < new Date()) {
                await Cart.update({ discountCodeId: null }, { where: { id: userCart.id } });
                throw { status: 400, message: "Your discount code has expired and has been removed." };
            }
            discountAmount = subtotal * (Number(discountCode.discountPercentage) / 100);
        }

        const totalAmount = subtotal - discountAmount;
        const stripeAmount = Math.round(totalAmount * 100);

        const paymentIntent = await stripe.paymentIntents.create({
            amount: stripeAmount,
            currency: "usd",
            metadata: {
                userId: user.id,
                cartId: userCart.id,
            },
        });

        const transaction = await sequelize.transaction();
        try {
            const order = await Order.create(
                {
                    userId: user.id,
                    status: OrderStatuses.Pending,
                    totalAmount: totalAmount,
                    shippingCountry: address.country,
                    shippingCity: address.city,
                    shippingAddress: address.country + ", " + address.city + ", " + address.address,
                    stripePaymentIntentId: paymentIntent.id,
                    discountCodeId: discountCode?.id ?? null,
                    discountAmount: discountAmount > 0 ? discountAmount : null,
                },
                { transaction }
            );

            const orderProducts = productsInCart.map((x) => ({
                orderId: order.id,
                productId: x.productId,
                priceAtPurchase: x.Product.finalPrice,
                quantity: x.quantity,
            }));

            await OrderProduct.bulkCreate(orderProducts, { transaction });

            await transaction.commit();

            res.status(200).json({
                message: "Payment Intent Created",
                orderId: order.id,
                clientSecret: paymentIntent.client_secret,
            });
        } catch (error) {
            await transaction.rollback();
            // Cancel the orphaned payment intent so the user is never charged
            try {
                await stripe.paymentIntents.cancel(paymentIntent.id);
            } catch (cancelError) {
                console.error(`Failed to cancel orphaned payment intent ${paymentIntent.id}`, cancelError);
            }
            next(error);
        }
    } catch (error) {
        next(error);
    }
};
