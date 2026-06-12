import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middlewares/authenticate.middleware";
import { Product } from "../../models/product.model";
import { User } from "../../models/user.model";
import { ProductCategory } from "../../models/category.model";
import { Order } from "../../models/order.model";
import { OrderProduct } from "../../models/orderProduct.model";
import { Op, fn, col, QueryTypes } from "sequelize";
import sequelize from "../../config/database";
import { UserRoles } from "../../enums/user-enums.enum";
import { OrderStatuses } from "../../enums/order-enums.enum";
import { isAdmin, getStartDate } from "./admin.utils";

// GET /app/admin/dashboard?timeframe=30d&categoryId=1&status=1
export const getDashboardStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!isAdmin(req.user)) throw { status: 401, message: "Unauthorized" };

        const timeframe = (req.query.timeframe as string) || "all";

        const rawCategoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
        if (rawCategoryId !== null && isNaN(rawCategoryId)) throw { status: 400, message: "Invalid categoryId" };
        const categoryId = rawCategoryId;

        const rawStatus = req.query.status !== undefined && req.query.status !== "all" ? Number(req.query.status) : null;
        if (rawStatus !== null && isNaN(rawStatus)) throw { status: 400, message: "Invalid status" };
        const statusVal = rawStatus;

        const startDate = getStartDate(timeframe);
        const dateWhere: any = startDate ? { createdAt: { [Op.gte]: startDate } } : {};

        // Base order filter (timeframe + optional status). Exclude Pending/Cancelled by default
        // so revenue and profit stats reflect only fulfilled orders.
        const orderWhere: any = {
            ...dateWhere,
            status: { [Op.notIn]: [OrderStatuses.Pending, OrderStatuses.Cancelled] },
        };
        if (statusVal !== null) orderWhere.status = statusVal;

        // Category filter: collect order IDs containing products in that category
        if (categoryId !== null) {
            const opRows = await OrderProduct.findAll({
                include: [{ model: Product, attributes: [], where: { productCategoryId: categoryId }, required: true }],
                attributes: ["orderId"],
                raw: true,
            });
            const orderIds = [...new Set((opRows as any[]).map((r) => r.orderId))];
            orderWhere.id = { [Op.in]: orderIds.length ? orderIds : [-1] };
        }

        // Revenue + order count
        const revenueRow: any = await Order.findOne({
            where: orderWhere,
            attributes: [
                [fn("COALESCE", fn("SUM", col("totalAmount")), 0), "revenue"],
                [fn("COUNT", col("id")), "orderCount"],
            ],
            raw: true,
        });

        const revenue = parseFloat(revenueRow?.revenue ?? "0");
        const orderCount = parseInt(revenueRow?.orderCount ?? "0", 10);
        const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0;

        // Orders by status — respects timeframe + category but ignores status filter
        // so all buckets always show relative to each other
        const statusBaseWhere: any = { ...dateWhere };
        if (categoryId !== null && orderWhere.id) statusBaseWhere.id = orderWhere.id;

        const statusRows: any[] = await Order.findAll({
            where: statusBaseWhere,
            attributes: ["status", [fn("COUNT", col("id")), "count"]],
            group: ["status"],
            raw: true,
        });

        const ordersByStatus = { pending: 0, paid: 0, shipped: 0, delivered: 0, cancelled: 0 };
        const statusKey: Record<number, keyof typeof ordersByStatus> = {
            0: "pending",
            1: "paid",
            2: "shipped",
            3: "delivered",
            4: "cancelled",
        };
        statusRows.forEach((r) => {
            const key = statusKey[r.status];
            if (key) ordersByStatus[key] = parseInt(r.count, 10);
        });

        // Top products — raw SQL avoids ONLY_FULL_GROUP_BY issues
        const dateClause = startDate ? "AND o.createdAt >= :startDate" : "";
        const catClause = categoryId !== null ? "AND p.productCategoryId = :categoryId" : "";
        const statusClause = statusVal !== null
            ? "AND o.status = :statusVal"
            : `AND o.status NOT IN (${OrderStatuses.Pending}, ${OrderStatuses.Cancelled})`;

        const topProducts: any[] = await sequelize.query(
            `SELECT op.productId,
                    p.name,
                    pc.categoryName AS category,
                    CAST(SUM(op.quantity) AS UNSIGNED) AS unitsSold,
                    ROUND(SUM(op.quantity * op.priceAtPurchase), 2) AS revenue,
                    ROUND(SUM((op.priceAtPurchase - p.supplyPrice) * op.quantity), 2) AS profit
             FROM OrderProducts op
             JOIN Orders o  ON o.id  = op.orderId
             JOIN Products p ON p.id = op.productId
             LEFT JOIN ProductCategories pc ON pc.id = p.productCategoryId
             WHERE 1=1 ${dateClause} ${statusClause} ${catClause}
             GROUP BY op.productId, p.name, pc.categoryName
             ORDER BY unitsSold DESC
             LIMIT 5`,
            {
                replacements: {
                    ...(startDate ? { startDate } : {}),
                    ...(statusVal !== null ? { statusVal } : {}),
                    ...(categoryId !== null ? { categoryId } : {}),
                },
                type: QueryTypes.SELECT,
            },
        );

        // Profit = (priceAtPurchase - supplyPrice) * quantity, same filters as revenue
        const profitRow: any[] = await sequelize.query(
            `SELECT ROUND(SUM((op.priceAtPurchase - p.supplyPrice) * op.quantity), 2) AS profit
             FROM OrderProducts op
             JOIN Orders o ON o.id = op.orderId
             JOIN Products p ON p.id = op.productId
             WHERE 1=1 ${dateClause} ${statusClause} ${catClause}`,
            {
                replacements: {
                    ...(startDate ? { startDate } : {}),
                    ...(statusVal !== null ? { statusVal } : {}),
                    ...(categoryId !== null ? { categoryId } : {}),
                },
                type: QueryTypes.SELECT,
            },
        );
        const profit = parseFloat((profitRow[0] as any)?.profit ?? "0") || 0;

        // Low stock (<10 units, active products only)
        const lowStockRows = await Product.findAll({
            where: { stock: { [Op.gt]: 0, [Op.lt]: 10 }, isActive: true },
            include: [{ model: ProductCategory, as: "ProductCategory", attributes: ["categoryName"] }],
            attributes: ["id", "name", "stock"],
            order: [["stock", "ASC"]],
            limit: 10,
        });

        const lowStock = lowStockRows.map((p: any) => ({
            id: p.id,
            name: p.name,
            stock: p.stock,
            category: p.ProductCategory?.categoryName ?? "",
        }));

        // Global totals (unaffected by filters)
        const [totalProducts, totalUsers] = await Promise.all([Product.count(), User.count({ where: { role: UserRoles.User } })]);

        res.json({ revenue, orderCount, avgOrderValue, profit, ordersByStatus, topProducts, lowStock, totalProducts, totalUsers });
    } catch (error) {
        next(error);
    }
};
