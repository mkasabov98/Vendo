import { NextFunction, Response } from "express";
import { AuthRequest } from "../middlewares/authenticate.middleware";
import { Product, ProductCreationAttributes } from "../models/product.model";
import { UserRoles } from "../enums/user-enums.enum";
import { User } from "../models/user.model";
import { ProductCategory } from "../models/category.model";
import { Order } from "../models/order.model";
import { OrderProduct } from "../models/orderProduct.model";
import { CartProduct } from "../models/cartProduct.model";
import { Op, fn, col, QueryTypes } from "sequelize";
import sequelize from "../config/database";

const isAdmin = (user: { role: UserRoles }) => {
    return user.role === UserRoles.Admin;
};

// POST /app/admin/register body: {email, user}
export const registerAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const body: { email: string; password: string } = { email: req.body.email, password: req.body.password };
    try {
        if (!isAdmin(req.user)) throw { status: 401, message: "Unauthorized" };

        const existingUser = await User.findOne({ where: { email: body.email } });
        if (existingUser) throw { status: 404, message: "There is a user associated with that email" };

        const newAdmin = await User.create({ ...body, role: UserRoles.Admin });
        const { password, ...adminData } = newAdmin.get();

        res.status(201).json(adminData);
    } catch (error) {
        next(error);
    }
};

// POST "/app/admin/products/create" body: ProductCreationAttributes
export const createProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const body: ProductCreationAttributes = req.body;
    try {
        if (!isAdmin(req.user)) {
            throw { status: 401, message: "Unauthorized" };
        }
        const newProduct = await Product.create({ ...body, reviewsCount: 0 });
        await newProduct.reload({
            include: [{ model: ProductCategory, as: "ProductCategory", attributes: ["id", "categoryName", "isActive"] }],
        });
        res.status(201).json(newProduct);
    } catch (error) {
        next(error);
    }
};

// PATCH "/app/admin/products/update/:productId"
export const updateProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const productId = req.params.productId;
    try {
        if (!isAdmin(req.user)) {
            throw { status: 401, message: "Unauthorized" };
        }

        const product = await Product.findByPk(productId);
        if (!product) {
            throw { status: 404, message: "Product not found" };
        }

        const { name, description, productCategoryId, supplyPrice, margin, imageUrl, stock, isActive } = req.body;

        if (productCategoryId !== undefined) {
            const category = await ProductCategory.findByPk(productCategoryId);
            if (!category) throw { status: 404, message: "Category not found" };
            if (isActive === true && !category.isActive) {
                throw { status: 400, message: "Cannot activate a product in an inactive category" };
            }
        }

        if (isActive === true && productCategoryId === undefined) {
            const category = await ProductCategory.findByPk(product.productCategoryId);
            if (!category?.isActive) {
                throw { status: 400, message: "Cannot activate a product in an inactive category" };
            }
        }

        if (name !== undefined) product.name = name;
        if (description !== undefined) product.description = description;
        if (productCategoryId !== undefined) product.productCategoryId = productCategoryId;
        if (supplyPrice !== undefined) product.supplyPrice = supplyPrice;
        if (margin !== undefined) product.margin = margin;
        if (imageUrl !== undefined) product.imageUrl = imageUrl;
        if (stock !== undefined) product.stock = stock;
        if (isActive !== undefined) product.isActive = isActive;

        await product.save();

        await product.reload({
            include: [{ model: ProductCategory, as: "ProductCategory", attributes: ["id", "categoryName", "isActive"] }],
        });

        res.status(200).json(product);
    } catch (error) {
        next(error);
    }
};

// GET "/app/admin/products"
export const getAdminProducts = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!isAdmin(req.user)) {
            throw { status: 401, message: "Unauthorized" };
        }

        const pageNumber = parseInt(req.query.pageNumber as string, 10) || 0;
        const itemsPerPage = parseInt(req.query.itemsPerPage as string, 10) || 20;
        const offset = pageNumber * itemsPerPage;
        const searchString = req.query.searchString ? (req.query.searchString as string).trim() : null;
        const sortDir = (req.query.sortDir as string) === "asc" ? "ASC" : "DESC";
        const status = (req.query.status as string) || "all";
        const stockFilter = (req.query.stockFilter as string) || "all";

        const rawCategories = req.query.categories;
        let categories: number[] = [];
        if (rawCategories) {
            if (typeof rawCategories === "string") {
                categories = rawCategories.split(",").map(Number).filter(Boolean);
            } else if (Array.isArray(rawCategories)) {
                categories = (rawCategories as string[]).map(Number).filter(Boolean);
            }
        }

        const sortByMap: Record<string, string> = {
            id:          "id",
            name:        "name",
            finalPrice:  "finalPrice",
            supplyPrice: "supplyPrice",
            margin:      "margin",
            stock:       "stock",
            reviews:     "reviewsCount",
            rating:      "starReview",
            createdAt:   "createdAt",
            updatedAt:   "updatedAt",
        };
        const sortColumn = sortByMap[(req.query.sortBy as string) ?? ""] ?? "createdAt";

        const whereClause: any = {};

        if (searchString) {
            whereClause[Op.or] = [
                { name:        { [Op.like]: `%${searchString}%` } },
                { description: { [Op.like]: `%${searchString}%` } },
            ];
        }

        if (categories.length > 0) {
            whereClause.productCategoryId = { [Op.in]: categories };
        }

        if (status === "active") {
            whereClause.isActive = true;
        } else if (status === "inactive") {
            whereClause.isActive = false;
        }

        if (stockFilter === "outofstock") {
            whereClause.stock = 0;
        } else if (stockFilter === "lowstock") {
            whereClause.stock = { [Op.gt]: 0, [Op.lt]: 10 };
        } else if (stockFilter === "instock") {
            whereClause.stock = { [Op.gte]: 10 };
        }

        const { count, rows } = await Product.findAndCountAll({
            where: whereClause,
            include: [{ model: ProductCategory, as: "ProductCategory", attributes: ["id", "categoryName", "isActive"] }],
            attributes: [
                "id", "name", "description",
                "supplyPrice", "margin", "finalPrice",
                "imageUrl", "stock", "starReview", "reviewsCount",
                "isActive", "createdAt", "updatedAt", "productCategoryId",
            ],
            order: [[sortColumn, sortDir]],
            limit: itemsPerPage,
            offset,
        });

        res.status(200).json({
            data: rows,
            meta: {
                totalItems: count as number,
                pageNumber,
                itemsPerPage,
                totalPages: Math.ceil((count as number) / itemsPerPage),
            },
        });
    } catch (error) {
        next(error);
    }
};

// GET /app/admin/categories
export const getCategories = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!isAdmin(req.user)) throw { status: 401, message: "Unauthorized" };

        const rows: any[] = await sequelize.query(
            `SELECT pc.id, pc.categoryName, pc.isActive,
                    COUNT(p.id) AS totalProducts,
                    SUM(CASE WHEN p.isActive = 1 THEN 1 ELSE 0 END) AS activeProducts
             FROM ProductCategories pc
             LEFT JOIN Products p ON p.productCategoryId = pc.id
             GROUP BY pc.id, pc.categoryName, pc.isActive
             ORDER BY pc.categoryName ASC`,
            { type: QueryTypes.SELECT },
        );

        const result = rows.map((r) => ({
            id: r.id,
            categoryName: r.categoryName,
            isActive: r.isActive === 1 || r.isActive === true,
            totalProducts: parseInt(r.totalProducts, 10) || 0,
            activeProducts: parseInt(r.activeProducts, 10) || 0,
        }));

        res.json(result);
    } catch (error) {
        next(error);
    }
};

// POST /app/admin/categories body: {categoryName: string}
export const createCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const body = req.body;
    const user = req.user;

    try {
        if (!isAdmin(user)) {
            throw { status: 401, message: "Unauthorized" };
        }

        const name = body.categoryName?.trim();
        if (!name) throw { status: 400, message: "Category name is required" };

        const existingCategory = await ProductCategory.findOne({
            where: { categoryName: name },
        });

        if (existingCategory) throw { status: 409, message: "This category already exists." };

        const newCategory = await ProductCategory.create({ categoryName: name, isActive: false });

        res.status(201).json(newCategory);
    } catch (error) {
        next(error);
    }
};

// PATCH /app/admin/categories/:id/set-active
export const setCategoryActive = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const categoryId = req.params.id;
    try {
        if (!isAdmin(req.user)) throw { status: 401, message: "Unauthorized" };

        const category = await ProductCategory.findByPk(categoryId);
        if (!category) throw { status: 404, message: "Category not found" };

        category.isActive = true;
        await category.save();

        res.json({ message: "Category activated successfully" });
    } catch (error) {
        next(error);
    }
};

// PATCH /app/admin/categories/:id/set-inactive
export const setCategoryInactive = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const categoryId = req.params.id;
    try {
        if (!isAdmin(req.user)) throw { status: 401, message: "Unauthorized" };

        const category = await ProductCategory.findByPk(categoryId);
        if (!category) throw { status: 404, message: "Category not found" };

        await sequelize.transaction(async (t) => {
            category.isActive = false;
            await category.save({ transaction: t });
            await Product.update({ isActive: false }, { where: { productCategoryId: categoryId }, transaction: t });
        });

        res.json({ message: "Category and its products deactivated successfully" });
    } catch (error) {
        next(error);
    }
};

// GET /app/admin/categories/analytics?timeframe=30d
export const getCategoriesAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!isAdmin(req.user)) throw { status: 401, message: "Unauthorized" };

        const timeframe = (req.query.timeframe as string) || "all";
        const startDate = getStartDate(timeframe);
        const dateClause = startDate ? "AND DATE(o.createdAt) >= DATE(:startDate)" : "";

        const rows: any[] = await sequelize.query(
            `SELECT pc.id, pc.categoryName,
                    COALESCE(ROUND(SUM(op.quantity * op.priceAtPurchase), 2), 0) AS revenue,
                    COALESCE(ROUND(SUM((op.priceAtPurchase - p.supplyPrice) * op.quantity), 2), 0) AS profit,
                    COALESCE(CAST(SUM(op.quantity) AS UNSIGNED), 0) AS unitsSold
             FROM ProductCategories pc
             LEFT JOIN Products p ON p.productCategoryId = pc.id
             LEFT JOIN OrderProducts op ON op.productId = p.id
             LEFT JOIN Orders o ON o.id = op.orderId AND 1=1 ${dateClause}
             GROUP BY pc.id, pc.categoryName
             ORDER BY revenue DESC`,
            {
                replacements: startDate ? { startDate } : {},
                type: QueryTypes.SELECT,
            },
        );

        const categories = rows.map((r) => ({
            id: r.id,
            categoryName: r.categoryName,
            revenue: parseFloat(r.revenue) || 0,
            profit: parseFloat(r.profit) || 0,
            unitsSold: parseInt(r.unitsSold, 10) || 0,
        }));

        const topCategoryId = categories.find((c) => c.revenue > 0)?.id ?? (categories[0]?.id ?? null);

        res.json({ categories, topCategoryId });
    } catch (error) {
        next(error);
    }
};

// GET /app/admin/categories/:id/top-products?timeframe=30d
export const getCategoryTopProducts = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const categoryId = req.params.id;
    try {
        if (!isAdmin(req.user)) throw { status: 401, message: "Unauthorized" };

        const timeframe = (req.query.timeframe as string) || "all";
        const startDate = getStartDate(timeframe);
        const dateClause = startDate ? "AND DATE(o.createdAt) >= DATE(:startDate)" : "";

        const rows: any[] = await sequelize.query(
            `SELECT p.id AS productId, p.name, p.createdAt,
                    ROUND(SUM(op.quantity * op.priceAtPurchase), 2) AS revenue,
                    ROUND(SUM((op.priceAtPurchase - p.supplyPrice) * op.quantity), 2) AS profit,
                    CAST(SUM(op.quantity) AS UNSIGNED) AS unitsSold
             FROM Products p
             JOIN OrderProducts op ON op.productId = p.id
             JOIN Orders o ON o.id = op.orderId
             WHERE p.productCategoryId = :categoryId ${dateClause}
             GROUP BY p.id, p.name, p.createdAt
             ORDER BY revenue DESC
             LIMIT 10`,
            {
                replacements: { categoryId, ...(startDate ? { startDate } : {}) },
                type: QueryTypes.SELECT,
            },
        );

        const products = rows.map((r) => ({
            productId: r.productId,
            name: r.name,
            revenue: parseFloat(r.revenue) || 0,
            profit: parseFloat(r.profit) || 0,
            unitsSold: parseInt(r.unitsSold, 10) || 0,
            createdAt: r.createdAt,
        }));

        res.json(products);
    } catch (error) {
        next(error);
    }
};

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

        // Base order filter (timeframe + optional status)
        const orderWhere: any = { ...dateWhere };
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
        const statusClause = statusVal !== null ? "AND o.status = :statusVal" : "";

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

function getStartDate(timeframe: string): Date | null {
    const ms: Record<string, number> = {
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
        "90d": 90 * 24 * 60 * 60 * 1000,
        "1y": 365 * 24 * 60 * 60 * 1000,
    };
    return ms[timeframe] ? new Date(Date.now() - ms[timeframe]) : null;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

function buildGroupExpr(alias: string, groupBy: string): string {
    const col = `\`${alias}\`.\`createdAt\``;
    switch (groupBy) {
        case "day":     return `DATE(${col})`;
        case "week":    return `YEARWEEK(${col}, 1)`;
        case "month":   return `DATE_FORMAT(${col}, '%Y-%m')`;
        case "quarter": return `CONCAT(YEAR(${col}), '-Q', QUARTER(${col}))`;
        default:        return `DATE_FORMAT(${col}, '%Y-%m')`;
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
        const userExpr  = buildGroupExpr("u", groupBy);
        const repl      = { startDate, endDate };

        const [revenueRows, profitRows, userRows, discountRows] = await Promise.all([
            sequelize.query(
                `SELECT ${orderExpr} AS period,
                        ROUND(SUM(o.totalAmount), 2) AS revenue,
                        COUNT(*) AS orderCount
                 FROM Orders o
                 WHERE DATE(o.createdAt) BETWEEN DATE(:startDate) AND DATE(:endDate)
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

        const revenueMap       = new Map((revenueRows as any[]).map((r) => [String(r.period), r]));
        const profitMap        = new Map((profitRows as any[]).map((p) => [String(p.period), p]));
        const discountMap      = new Map((discountRows as any[]).map((d) => [String(d.period), d]));
        const allOrderPeriods  = [...new Set([
            ...(revenueRows as any[]).map((r) => String(r.period)),
            ...(profitRows as any[]).map((p) => String(p.period)),
        ])].sort();

        const timeseries = allOrderPeriods.map((period) => ({
            period,
            revenue:        parseFloat((revenueMap.get(period) as any)?.revenue        ?? "0") || 0,
            orderCount:     parseInt((revenueMap.get(period) as any)?.orderCount       ?? "0", 10),
            profit:         parseFloat((profitMap.get(period) as any)?.profit          ?? "0") || 0,
            discountAmount: parseFloat((discountMap.get(period) as any)?.discountAmount ?? "0") || 0,
        }));

        const users = (userRows as any[]).map((u) => ({
            period:   String(u.period),
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

        const repl  = { startDate, endDate };
        const dateF = `DATE(o.createdAt) BETWEEN DATE(:startDate) AND DATE(:endDate)`;

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
                 WHERE ${dateF} GROUP BY pc.id, pc.categoryName ORDER BY revenue DESC`,
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
                 GROUP BY pc.id, pc.categoryName ORDER BY marginPct DESC`,
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
        (statusRows as any[]).forEach((r) => { const k = statusKey[Number(r.status)]; if (k) ordersByStatus[k] = parseInt(r.count, 10); });

        const dsr = (discountStatusRows as any[])[0] ?? {};
        res.json({
            ordersByStatus,
            revByCategory:    (revByCategory as any[]).map((r) => ({ category: r.category, revenue: parseFloat(r.revenue) || 0 })),
            topProducts:      (topProducts as any[]).map((p) => ({ productId: p.productId, name: p.name, category: p.category ?? "", unitsSold: parseInt(p.unitsSold, 10), revenue: parseFloat(p.revenue) || 0, profit: parseFloat(p.profit) || 0 })),
            revByCountry:     (revByCountry as any[]).map((r) => ({ country: r.country, revenue: parseFloat(r.revenue) || 0, orderCount: parseInt(r.orderCount, 10) })),
            marginByCategory: (marginByCategory as any[]).map((m) => ({ category: m.category, marginPct: parseFloat(m.marginPct) || 0, profit: parseFloat(m.profit) || 0, revenue: parseFloat(m.revenue) || 0 })),
            discountStatus: {
                used:          parseInt(dsr.usedCount   ?? 0, 10),
                activeUnused:  parseInt(dsr.activeCount ?? 0, 10),
                expiredUnused: parseInt(dsr.expiredCount ?? 0, 10),
            },
        });
    } catch (error) {
        next(error);
    }
};

// GET "/app/admin/products/:productId/cart-count"
export const getProductCartCount = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const productId = req.params.productId;
    try {
        if (!isAdmin(req.user)) {
            throw { status: 401, message: "Unauthorized" };
        }
        const cartCount = await CartProduct.count({ where: { productId } });
        res.status(200).json({ cartCount });
    } catch (error) {
        next(error);
    }
};

// DELETE "/app/admin/products/delete/:productId"
export const deleteProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const productId = req.params.productId;
    try {
        if (!isAdmin(req.user)) {
            throw { status: 401, message: "Unauthorized" };
        }
        const product = await Product.findByPk(productId);
        if (!product) {
            throw { status: 404, message: "Product not found" };
        }
        product.isActive = false;
        await product.save();
        res.status(200).json({ message: "Product deactivated successfully" });
    } catch (error) {
        next(error);
    }
};

// PATCH "/app/admin/products/bulk-update"
export const bulkUpdateProducts = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { ids, update } = req.body;
    try {
        if (!isAdmin(req.user)) throw { status: 401, message: "Unauthorized" };
        if (!Array.isArray(ids) || ids.length === 0) throw { status: 400, message: "ids must be a non-empty array" };

        const { stock, isActive } = update ?? {};
        const payload: Record<string, unknown> = {};

        if (stock !== undefined) {
            if (typeof stock !== "number" || stock < 0) throw { status: 400, message: "stock must be a non-negative number" };
            payload.stock = stock;
        }
        if (isActive !== undefined) {
            payload.isActive = isActive;
        }
        if (Object.keys(payload).length === 0) throw { status: 400, message: "No valid fields to update" };

        const [updated] = await Product.update(payload, { where: { id: ids } });
        res.status(200).json({ updated });
    } catch (error) {
        next(error);
    }
};
