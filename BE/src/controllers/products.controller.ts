import { NextFunction, Request, Response } from "express";
import { Product } from "../models/product.model";
import { ProductCategory } from "../models/category.model";
import { FindAndCountOptions, Op, Sequelize } from "sequelize";
import { Review } from "../models/review.model";

export interface ProductQueryParams {
    limit: number;
    offset: number;
    categories: number[];
    sortBy: "asc" | "desc" | "reviews" | "id" | "price";
    searchString: string | null;
    pageNumber: number;
    itemsPerPage: number;
}

export interface PaginationMeta {
    totalItems: number;
    pageNumber: number;
    itemsPerPage: number;
    totalPages: number;
}

const getQueryParams = (req: Request): ProductQueryParams => {
    const { pageNumber, itemsPerPage, categories, sortBy, searchString } = req.query;
    const limit = parseInt(itemsPerPage as string, 10) || 10;
    const pNum = parseInt(pageNumber as string, 10) || 0;
    let updatedCategories: number[];
    if (!categories) {
        updatedCategories = [];
    } else if (typeof categories === "string") {
        updatedCategories = categories.split(",").map(Number);
    } else if (Array.isArray(categories)) {
        updatedCategories = categories.map(Number);
    }

    return {
        limit,
        pageNumber: pNum,
        itemsPerPage: limit,
        offset: pNum * limit,
        categories: updatedCategories,
        sortBy: (sortBy as ProductQueryParams["sortBy"]) || "id",
        searchString: searchString ? (searchString as string).trim() : null,
    };
};

// GET "/app/products"
export const getAllProducts = async (req: Request, res: Response, next: NextFunction) => {
    const params: ProductQueryParams = getQueryParams(req);
    const { limit, offset, categories, sortBy, searchString } = params;

    const whereClause: any = { isActive: true };
    let orderClause: any = [["id", "ASC"]];
    let isAggregating: boolean = false;

    if (searchString) {
        whereClause[Op.or] = [{ name: { [Op.like]: `%${searchString}%` } }, { description: { [Op.like]: `%${searchString}%` } }];
    }

    if (categories.length > 0) {
        whereClause.productCategoryId = { [Op.in]: categories };
    }

    if (sortBy === "reviews") {
        orderClause = [["reviewsCount", "DESC"]];
    } else if (sortBy === "asc" || sortBy === "desc") {
        orderClause = [["finalPrice", sortBy.toUpperCase()]];
    }

    try {
        const queryOptions: FindAndCountOptions = {
            where: whereClause,
            order: orderClause,
            limit,
            offset,
            attributes: ["id", "name", "description", "finalPrice", "imageUrl", "stock", "starReview", "reviewsCount", "productCategoryId"],
            include: [{ model: ProductCategory, as: "ProductCategory", where: { isActive: true }, required: true, attributes: [] }],
        };

        const countResult = await Product.findAndCountAll(queryOptions);
        const totalCount = isAggregating ? countResult.rows.length : (countResult.count as number);
        const meta: PaginationMeta = {
            totalItems: totalCount,
            pageNumber: params.pageNumber,
            itemsPerPage: limit,
            totalPages: Math.ceil(totalCount / limit),
        };

        res.status(200).json({
            data: countResult.rows as Product[],
            meta,
        });
    } catch (error) {
        next(error);
    }
};

//GET /app/products/specificProducts
export const getSpecificProducts = async (req: Request, res: Response, next: NextFunction) => {
    const {productsIds} = req.query;
    let updatedProductsIds: number[] = [];
    if (!productsIds) {
        updatedProductsIds = [];
    } else if (typeof productsIds === "string") {
        updatedProductsIds = productsIds.split(",").map(Number);
    } else if (Array.isArray(productsIds)) {
        updatedProductsIds = productsIds.map(Number);
    }

    try {
        const products = await Product.findAll({
            where: {
                id: updatedProductsIds,
            },
            attributes: ["id", "stock", "starReview", "name", "finalPrice", "imageUrl", "isActive"],
            include: [
                {
                    model: ProductCategory,
                    as: "ProductCategory",
                    attributes: ["categoryName", "isActive"],
                },
            ],
        });

        const flattedProducts = products.map((x) => ({
            productId: x.id,
            stock: x.stock,
            starReview: x.starReview,
            name: x.name,
            price: x.finalPrice,
            imageUrl: x.imageUrl,
            category: x.ProductCategory.categoryName,
            isActive: x.isActive && (x.ProductCategory?.isActive !== false),
        }));

        res.status(200).json({items: flattedProducts})
    } catch (error) {
        next(error);
    }
};

// GET "/app/products/:productId"
export const getProductById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const product = await Product.findOne({
            where: { id: req.params.productId, isActive: true },
            attributes: ["id", "name", "description", "finalPrice", "imageUrl", "stock", "starReview", "reviewsCount"],
            include: [{ model: ProductCategory, as: "ProductCategory", where: { isActive: true }, required: true, attributes: ["id", "categoryName"] }],
        });
        if (!product) {
            throw { status: 404, message: "Item does not exist" };
        }
        res.status(200).json(product);
    } catch (error) {
        next(error);
    }
};

//Get /app/products/categories
export const getAllCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const categories = await ProductCategory.findAll({
            where: { isActive: true },
            attributes: ["id", "categoryName"],
        });
        res.status(200).json(categories);
    } catch (error) {
        next(error);
    }
};
