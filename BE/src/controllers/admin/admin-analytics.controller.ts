import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middlewares/authenticate.middleware";
import { QueryTypes } from "sequelize";
import sequelize from "../../config/database";
import { isAdmin } from "./admin.utils";

function buildGroupExpr(alias: string, groupBy: string): string {
    const col = `\`${alias}\`.\`createdAt\``;
    switch (groupBy) {
        case "day":
            return `DATE(${col})`;
        case "week":
            return `YEARWEEK(${col}, 1)`;
        case "month":
            return `DATE_FORMAT(${col}, '%Y-%m')`;
        case "quarter":
            return `CONCAT(YEAR(${col}), '-Q', QUARTER(${col}))`;
        default:
            return `DATE_FORMAT(${col}, '%Y-%m')`;
    }
}

// GET /admin/analytics/timeseries?startDate=2024-01-01&endDate=2024-12-31&groupBy=month
export const getAnalyticsTimeseries = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!isAdmin(req.user)) throw { status: 401, message: "Unauthorized" };

        const { startDate, endDate } = req.query as { startDate: string; endDate: string };
        const groupBy = (req.query.groupBy as string) || "month";

        if (!startDate || !endDate) throw { status: 400, message: "startDate and endDate are required" };
        if (!["day", "week", "month", "quarter"].includes(groupBy)) throw { status: 400, message: "Invalid groupBy" };

        const orderExpr = buildGroupExpr("o", groupBy);
        const userExpr = buildGroupExpr("u", groupBy);
        const repl = { startDate, endDate };

        const [revenueRows, profitRows, userRows, discountRows] = await Promise.all([
            sequelize.query(
                `SELECT ${orderExpr} AS period,
                        ROUND(SUM(o.totalAmount), 2) AS revenue,
                        COUNT(*) AS orderCount
                 FROM Orders o
                 WHERE DATE(o.createdAt) BETWEEN DATE(:startDate) AND DATE(:endDate)
                   AND o.status NOT IN (0, 4)
                 GROUP BY period ORDER BY period ASC`,
                { replacements: repl, type: QueryTypes.SELECT },
            ) as Promise<any[]>,
            sequelize.query(
                `SELECT ${orderExpr} AS period,
                        ROUND(SUM((op.priceAtPurchase - p.supplyPrice) * op.quantity), 2) AS profit
                 FROM Orders o
                 JOIN OrderProducts op ON op.orderId = o.id
                 JOIN Products p ON p.id = op.productId
                 WHERE DATE(o.createdAt) BETWEEN DATE(:startDate) AND DATE(:endDate)
                   AND o.status NOT IN (0, 4)
                 GROUP BY period ORDER BY period ASC`,
                { replacements: repl, type: QueryTypes.SELECT },
            ) as Promise<any[]>,
            sequelize.query(
                `SELECT ${userExpr} AS period, COUNT(*) AS newUsers
                 FROM Users u
                 WHERE DATE(u.createdAt) BETWEEN DATE(:startDate) AND DATE(:endDate)
                   AND u.role = 0
                 GROUP BY period ORDER BY period ASC`,
                { replacements: repl, type: QueryTypes.SELECT },
            ) as Promise<any[]>,
            sequelize.query(
                `SELECT ${orderExpr} AS period,
                        ROUND(SUM(o.discountAmount), 2) AS discountAmount
                 FROM Orders o
                 WHERE DATE(o.createdAt) BETWEEN DATE(:startDate) AND DATE(:endDate)
                   AND o.discountCodeId IS NOT NULL AND o.discountAmount > 0
                 GROUP BY period ORDER BY period ASC`,
                { replacements: repl, type: QueryTypes.SELECT },
            ) as Promise<any[]>,
        ]);

        const revenueMap = new Map((revenueRows as any[]).map((r) => [String(r.period), r]));
        const profitMap = new Map((profitRows as any[]).map((p) => [String(p.period), p]));
        const discountMap = new Map((discountRows as any[]).map((d) => [String(d.period), d]));
        const allOrderPeriods = [
            ...new Set([...(revenueRows as any[]).map((r) => String(r.period)), ...(profitRows as any[]).map((p) => String(p.period))]),
        ].sort();

        const timeseries = allOrderPeriods.map((period) => ({
            period,
            revenue: parseFloat((revenueMap.get(period) as any)?.revenue ?? "0") || 0,
            orderCount: parseInt((revenueMap.get(period) as any)?.orderCount ?? "0", 10),
            profit: parseFloat((profitMap.get(period) as any)?.profit ?? "0") || 0,
            discountAmount: parseFloat((discountMap.get(period) as any)?.discountAmount ?? "0") || 0,
        }));

        const users = (userRows as any[]).map((u) => ({
            period: String(u.period),
            newUsers: parseInt(u.newUsers, 10),
        }));

        res.json({ timeseries, users });
    } catch (error) {
        next(error);
    }
};

// GET /admin/analytics/breakdown?startDate=2024-01-01&endDate=2024-12-31
export const getAnalyticsBreakdown = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!isAdmin(req.user)) throw { status: 401, message: "Unauthorized" };

        const { startDate, endDate } = req.query as { startDate: string; endDate: string };
        if (!startDate || !endDate) throw { status: 400, message: "startDate and endDate are required" };

        const repl = { startDate, endDate };
        const dateF = `DATE(o.createdAt) BETWEEN DATE(:startDate) AND DATE(:endDate) AND o.status NOT IN (0, 4)`;

        const [statusRows, revByCategory, topProducts, revByCountry, marginByCategory, discountStatusRows] = await Promise.all([
            sequelize.query(
                `SELECT status, COUNT(*) AS count FROM Orders
                 WHERE DATE(createdAt) BETWEEN DATE(:startDate) AND DATE(:endDate)
                 GROUP BY status`,
                { replacements: repl, type: QueryTypes.SELECT },
            ) as Promise<any[]>,
            sequelize.query(
                `SELECT pc.categoryName AS category,
                        ROUND(SUM(op.quantity * op.priceAtPurchase), 2) AS revenue
                 FROM Orders o
                 JOIN OrderProducts op ON op.orderId = o.id
                 JOIN Products p ON p.id = op.productId
                 JOIN ProductCategories pc ON pc.id = p.productCategoryId
                 WHERE ${dateF} GROUP BY pc.id, pc.categoryName ORDER BY revenue DESC LIMIT 10`,
                { replacements: repl, type: QueryTypes.SELECT },
            ) as Promise<any[]>,
            sequelize.query(
                `SELECT op.productId, p.name, pc.categoryName AS category,
                        CAST(SUM(op.quantity) AS UNSIGNED) AS unitsSold,
                        ROUND(SUM(op.quantity * op.priceAtPurchase), 2) AS revenue,
                        ROUND(SUM((op.priceAtPurchase - p.supplyPrice) * op.quantity), 2) AS profit
                 FROM Orders o
                 JOIN OrderProducts op ON op.orderId = o.id
                 JOIN Products p ON p.id = op.productId
                 LEFT JOIN ProductCategories pc ON pc.id = p.productCategoryId
                 WHERE ${dateF}
                 GROUP BY op.productId, p.name, pc.categoryName
                 ORDER BY profit DESC LIMIT 10`,
                { replacements: repl, type: QueryTypes.SELECT },
            ) as Promise<any[]>,
            sequelize.query(
                `SELECT shippingCountry AS country,
                        ROUND(SUM(totalAmount), 2) AS revenue,
                        COUNT(*) AS orderCount
                 FROM Orders
                 WHERE DATE(createdAt) BETWEEN DATE(:startDate) AND DATE(:endDate)
                   AND status NOT IN (0, 4)
                   AND shippingCountry IS NOT NULL AND shippingCountry != ''
                 GROUP BY shippingCountry ORDER BY revenue DESC LIMIT 20`,
                { replacements: repl, type: QueryTypes.SELECT },
            ) as Promise<any[]>,
            sequelize.query(
                `SELECT pc.categoryName AS category,
                        ROUND(SUM((op.priceAtPurchase - p.supplyPrice) * op.quantity)
                              / NULLIF(SUM(op.quantity * op.priceAtPurchase), 0) * 100, 1) AS marginPct,
                        ROUND(SUM((op.priceAtPurchase - p.supplyPrice) * op.quantity), 2) AS profit,
                        ROUND(SUM(op.quantity * op.priceAtPurchase), 2) AS revenue
                 FROM Orders o
                 JOIN OrderProducts op ON op.orderId = o.id
                 JOIN Products p ON p.id = op.productId
                 JOIN ProductCategories pc ON pc.id = p.productCategoryId
                 WHERE ${dateF}
                 GROUP BY pc.id, pc.categoryName ORDER BY marginPct DESC LIMIT 10`,
                { replacements: repl, type: QueryTypes.SELECT },
            ) as Promise<any[]>,
            sequelize.query(
                `SELECT
                    SUM(CASE WHEN used = 1 THEN 1 ELSE 0 END) AS usedCount,
                    SUM(CASE WHEN used = 0 AND expirationDate >= NOW() THEN 1 ELSE 0 END) AS activeCount,
                    SUM(CASE WHEN used = 0 AND expirationDate < NOW() THEN 1 ELSE 0 END) AS expiredCount
                 FROM DiscountCodes
                 WHERE DATE(createdAt) BETWEEN DATE(:startDate) AND DATE(:endDate)`,
                { replacements: repl, type: QueryTypes.SELECT },
            ) as Promise<any[]>,
        ]);

        const ordersByStatus = { pending: 0, paid: 0, shipped: 0, delivered: 0, cancelled: 0 };
        const statusKey: Record<number, keyof typeof ordersByStatus> = { 0: "pending", 1: "paid", 2: "shipped", 3: "delivered", 4: "cancelled" };
        (statusRows as any[]).forEach((r) => {
            const k = statusKey[Number(r.status)];
            if (k) ordersByStatus[k] = parseInt(r.count, 10);
        });

        const dsr = (discountStatusRows as any[])[0] ?? {};
        res.json({
            ordersByStatus,
            revByCategory: (revByCategory as any[]).map((r) => ({ category: r.category, revenue: parseFloat(r.revenue) || 0 })),
            topProducts: (topProducts as any[]).map((p) => ({
                productId: p.productId,
                name: p.name,
                category: p.category ?? "",
                unitsSold: parseInt(p.unitsSold, 10),
                revenue: parseFloat(p.revenue) || 0,
                profit: parseFloat(p.profit) || 0,
            })),
            revByCountry: (revByCountry as any[]).map((r) => ({
                country: r.country,
                revenue: parseFloat(r.revenue) || 0,
                orderCount: parseInt(r.orderCount, 10),
            })),
            marginByCategory: (marginByCategory as any[]).map((m) => ({
                category: m.category,
                marginPct: parseFloat(m.marginPct) || 0,
                profit: parseFloat(m.profit) || 0,
                revenue: parseFloat(m.revenue) || 0,
            })),
            discountStatus: {
                used: parseInt(dsr.usedCount ?? 0, 10),
                activeUnused: parseInt(dsr.activeCount ?? 0, 10),
                expiredUnused: parseInt(dsr.expiredCount ?? 0, 10),
            },
        });
    } catch (error) {
        next(error);
    }
};
