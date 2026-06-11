import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middlewares/authenticate.middleware";
import { Product } from "../../models/product.model";
import { ProductCategory } from "../../models/category.model";
import { QueryTypes } from "sequelize";
import sequelize from "../../config/database";
import { isAdmin, getStartDate } from "./admin.utils";

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

// POST /app/admin/categories
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

        const topCategoryId = categories.find((c) => c.revenue > 0)?.id ?? categories[0]?.id ?? null;

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
