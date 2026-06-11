import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middlewares/authenticate.middleware";
import { Order } from "../../models/order.model";
import { User } from "../../models/user.model";
import { QueryTypes } from "sequelize";
import sequelize from "../../config/database";
import stripe from "../../config/stripe";
import { OrderStatuses, canTransitionTo } from "../../enums/order-enums.enum";
import { sendOrderShippedEmail, sendOrderDeliveredEmail, sendOrderCancelledEmail } from "../../services/email.service";
import { isAdmin } from "./admin.utils";

// GET /app/admin/orders
export const getAdminOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!isAdmin(req.user)) throw { status: 401, message: "Unauthorized" };

        const pageNumber = Math.max(0, parseInt(req.query.pageNumber as string, 10) || 0);
        const itemsPerPage = Math.min(100, Math.max(1, parseInt(req.query.itemsPerPage as string, 10) || 20));
        const offset = pageNumber * itemsPerPage;
        const status = req.query.status as string | undefined;
        const dateFrom = req.query.dateFrom as string | undefined;
        const dateTo = req.query.dateTo as string | undefined;
        const rawSearch = req.query.search ? (req.query.search as string).trim() : null;

        const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
        if (dateFrom && !ISO_DATE.test(dateFrom)) throw { status: 400, message: "Invalid dateFrom format (expected YYYY-MM-DD)" };
        if (dateTo && !ISO_DATE.test(dateTo)) throw { status: 400, message: "Invalid dateTo format (expected YYYY-MM-DD)" };

        const sortByMap: Record<string, string> = {
            createdAt: "o.createdAt",
            totalAmount: "o.totalAmount",
            status: "o.status",
        };
        const sortColumn = sortByMap[(req.query.sortBy as string) ?? ""] ?? "o.createdAt";
        const sortDir = (req.query.sortDir as string) === "asc" ? "ASC" : "DESC";

        const conditions: string[] = ["1=1"];
        const filterReplacements: Record<string, any> = {};

        if (status !== undefined && status !== "all") {
            const statusNum = parseInt(status, 10);
            if (!isNaN(statusNum)) {
                conditions.push("o.status = :status");
                filterReplacements.status = statusNum;
            }
        }

        if (dateFrom) {
            conditions.push("DATE(o.createdAt) >= DATE(:dateFrom)");
            filterReplacements.dateFrom = dateFrom;
        }
        if (dateTo) {
            conditions.push("DATE(o.createdAt) <= DATE(:dateTo)");
            filterReplacements.dateTo = dateTo;
        }
        if (rawSearch) {
            conditions.push("(CAST(o.id AS CHAR) LIKE :search OR u.email LIKE :search)");
            filterReplacements.search = `%${rawSearch}%`;
        }

        const whereClause = conditions.join(" AND ");

        const [rows, countRows] = await Promise.all([
            sequelize.query(
                `SELECT o.id, u.email AS userEmail, o.status,
                        o.totalAmount, COUNT(op.id) AS itemCount,
                        o.shippingCountry, o.createdAt
                 FROM Orders o
                 JOIN Users u ON u.id = o.userId
                 LEFT JOIN OrderProducts op ON op.orderId = o.id
                 WHERE ${whereClause}
                 GROUP BY o.id, u.email, o.status, o.totalAmount, o.shippingCountry, o.createdAt
                 ORDER BY ${sortColumn} ${sortDir}
                 LIMIT :limit OFFSET :offset`,
                { replacements: { ...filterReplacements, limit: itemsPerPage, offset }, type: QueryTypes.SELECT },
            ) as Promise<any[]>,
            sequelize.query(
                `SELECT COUNT(DISTINCT o.id) AS total
                 FROM Orders o
                 JOIN Users u ON u.id = o.userId
                 WHERE ${whereClause}`,
                { replacements: filterReplacements, type: QueryTypes.SELECT },
            ) as Promise<any[]>,
        ]);

        const totalItems = parseInt((countRows[0] as any)?.total ?? "0", 10);

        const data = (rows as any[]).map((r) => ({
            id: r.id,
            userEmail: r.userEmail,
            status: r.status,
            totalAmount: parseFloat(r.totalAmount) || 0,
            itemCount: parseInt(r.itemCount, 10) || 0,
            shippingCountry: r.shippingCountry,
            createdAt: r.createdAt,
        }));

        res.json({
            data,
            meta: {
                totalItems,
                pageNumber,
                itemsPerPage,
                totalPages: Math.ceil(totalItems / itemsPerPage),
            },
        });
    } catch (error) {
        next(error);
    }
};

// GET /app/admin/orders/:id
export const getAdminOrderDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const orderId = parseInt(req.params.id, 10);
    try {
        if (!isAdmin(req.user)) throw { status: 401, message: "Unauthorized" };
        if (isNaN(orderId)) throw { status: 400, message: "Invalid order ID" };

        const rows: any[] = await sequelize.query(
            `SELECT o.id, o.status, o.totalAmount, o.discountAmount,
                    o.shippingAddress, o.shippingCity, o.shippingCountry, o.createdAt,
                    u.email AS userEmail,
                    dc.code AS discountCode, dc.discountPercentage,
                    op.productId, op.priceAtPurchase, op.quantity,
                    p.name AS productName, p.imageUrl
             FROM Orders o
             JOIN Users u ON u.id = o.userId
             LEFT JOIN DiscountCodes dc ON dc.id = o.discountCodeId
             LEFT JOIN OrderProducts op ON op.orderId = o.id
             LEFT JOIN Products p ON p.id = op.productId
             WHERE o.id = :orderId`,
            { replacements: { orderId }, type: QueryTypes.SELECT },
        );

        if (!rows.length) throw { status: 404, message: "Order not found" };

        const first = rows[0];
        const detail = {
            id: first.id,
            userEmail: first.userEmail,
            status: first.status,
            totalAmount: parseFloat(first.totalAmount) || 0,
            discountAmount: first.discountAmount !== null ? parseFloat(first.discountAmount) : null,
            discountCode: first.discountCode ?? null,
            discountPercentage: first.discountPercentage !== null ? parseFloat(first.discountPercentage) : null,
            shippingAddress: first.shippingAddress,
            shippingCity: first.shippingCity,
            shippingCountry: first.shippingCountry,
            createdAt: first.createdAt,
            items: rows
                .filter((r) => r.productId !== null)
                .map((r) => ({
                    productId: r.productId,
                    name: r.productName,
                    imageUrl: r.imageUrl,
                    quantity: r.quantity,
                    priceAtPurchase: parseFloat(r.priceAtPurchase) || 0,
                })),
        };

        res.json(detail);
    } catch (error) {
        next(error);
    }
};

// PATCH /app/admin/orders/:id/status
export const updateAdminOrderStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const orderId = parseInt(req.params.id, 10);
    const { status: newStatus } = req.body;
    try {
        if (!isAdmin(req.user)) throw { status: 401, message: "Unauthorized" };
        if (isNaN(orderId)) throw { status: 400, message: "Invalid order ID" };
        if (typeof newStatus !== "number") throw { status: 400, message: "status must be a number" };

        const order = await Order.findByPk(orderId);
        if (!order) throw { status: 404, message: "Order not found" };

        if (!canTransitionTo(order.status, newStatus)) {
            throw { status: 400, message: `Cannot transition order from status ${order.status} to ${newStatus}` };
        }

        order.status = newStatus;
        await order.save();

        if (newStatus === OrderStatuses.Cancelled && order.stripePaymentIntentId) {
            stripe.refunds
                .create({ payment_intent: order.stripePaymentIntentId })
                .catch((err) => console.error(`CRITICAL: Refund failed for order ${order.id} (PI: ${order.stripePaymentIntentId}):`, err));
        }

        const user = await User.findByPk(order.userId, { attributes: ["email"] });
        if (user) {
            if (newStatus === OrderStatuses.Shipped) {
                sendOrderShippedEmail(user.email, order.id).catch((err) => console.error("Failed to send shipped email:", err));
            } else if (newStatus === OrderStatuses.Delivered) {
                sendOrderDeliveredEmail(user.email, order.id).catch((err) => console.error("Failed to send delivered email:", err));
            } else if (newStatus === OrderStatuses.Cancelled) {
                sendOrderCancelledEmail(user.email, order.id).catch((err) => console.error("Failed to send cancelled email:", err));
            }
        }

        res.json({ id: order.id, status: order.status });
    } catch (error) {
        next(error);
    }
};
