import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middlewares/authenticate.middleware";
import { Product, ProductCreationAttributes } from "../../models/product.model";
import { ProductCategory } from "../../models/category.model";
import { CartProduct } from "../../models/cartProduct.model";
import { Op } from "sequelize";
import { isAdmin } from "./admin.utils";

// POST "/app/admin/products/create"
export const createProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const body: ProductCreationAttributes = req.body;
    try {
        if (!isAdmin(req.user)) {
            throw { status: 401, message: "Unauthorized" };
        }
        if (body.margin !== undefined && body.margin < 0) {
            throw { status: 400, message: "Margin cannot be negative" };
        }
        if (body.imageUrl === "") delete (body as any).imageUrl;
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
        if (margin !== undefined) {
            if (margin < 0) throw { status: 400, message: "Margin cannot be negative" };
            product.margin = margin;
        }
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
            id: "id",
            name: "name",
            finalPrice: "finalPrice",
            supplyPrice: "supplyPrice",
            margin: "margin",
            stock: "stock",
            reviews: "reviewsCount",
            rating: "starReview",
            createdAt: "createdAt",
            updatedAt: "updatedAt",
        };
        const sortColumn = sortByMap[(req.query.sortBy as string) ?? ""] ?? "createdAt";

        const whereClause: any = {};

        if (searchString) {
            whereClause[Op.or] = [{ name: { [Op.like]: `%${searchString}%` } }, { description: { [Op.like]: `%${searchString}%` } }];
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
                "id",
                "name",
                "description",
                "supplyPrice",
                "margin",
                "finalPrice",
                "imageUrl",
                "stock",
                "starReview",
                "reviewsCount",
                "isActive",
                "createdAt",
                "updatedAt",
                "productCategoryId",
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
