import { NextFunction, Response } from "express";
import { AuthRequest } from "../middlewares/authenticate.middleware";
import { UserRoles } from "../enums/user-enums.enum";
import { User } from "../models/user.model";
import { Cart } from "../models/cart.model";
import { CartProduct } from "../models/cartProduct.model";
import { Product } from "../models/product.model";
import { DiscountCode } from "../models/discountCode.model";
import sequelize from "../config/database";
import { ProductCategory } from "../models/category.model";

//Patch app/cart/updateProduct
//Used to add product to the cart if not existing or update the quantity of the product
export const updateCartProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const product: { productId: number; quantity: number; increment?: boolean } = req.body;
    const userId = req.user.id;

    try {
        if (req.user?.role !== UserRoles.User) {
            throw { status: 401, message: "Unauthorized" };
        }

        const existingProduct = await Product.findByPk(product.productId);
        if (!existingProduct) throw { status: 404, message: "Product with that Id does not exist" };
        if (!existingProduct.isActive && product.quantity > 0) throw { status: 400, message: "This product is no longer available" };

        const [userCart] = await Cart.findOrCreate({ where: { userId: userId } });

        const userCartId = userCart.get().id;
        const cartProduct = await CartProduct.findOne({
            where: {
                productId: product.productId,
                cartId: userCartId,
            },
        });

        if (product.quantity === 0) {
            if (!cartProduct) {
                throw { status: 404, message: "Product is not found in your cart" };
            } else {
                await cartProduct.destroy();
                return res.status(200).json({ message: "Item removed from cart" });
            }
        }

        if (!cartProduct) {
            if (product.quantity > existingProduct.stock) {
                throw { status: 400, message: `Only ${existingProduct.stock} unit(s) of this item are available` };
            }
            const newProductInCart = await CartProduct.create({ cartId: userCartId, productId: product.productId, quantity: product.quantity });
            return res.status(200).json(newProductInCart.get());
        }

        const newQuantity = product.increment ? cartProduct.quantity + product.quantity : product.quantity;
        if (newQuantity > existingProduct.stock) {
            throw { status: 400, message: `Only ${existingProduct.stock} unit(s) of this item are available` };
        }
        cartProduct.quantity = newQuantity;
        await cartProduct.save();
        await cartProduct.reload();
        res.status(200).json({ productId: cartProduct.productId, quantity: cartProduct.quantity });
    } catch (error) {
        next(error);
    }
};

//Patch app/cart/updateCart
export const bulkUpdateCart = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const products: { productId: number; productQuantity: number }[] = req.body;
    const user = req.user;

    try {
        if (req.user?.role !== UserRoles.User) {
            throw { status: 401, message: "Unauthorized" };
        }

        const userCart = await Cart.findOne({
            where: {
                userId: user.id,
            },
        });

        if (!userCart) throw { status: 404, message: "There is no cart associated with that user ID." };

        const transaction = await sequelize.transaction();
        try {
            for (const product of products) {
                const [row, created] = await CartProduct.findOrCreate({
                    where: {
                        cartId: userCart.id,
                        productId: product.productId,
                    },
                    defaults: {
                        cartId: userCart.id,
                        productId: product.productId,
                        quantity: product.productQuantity,
                    },
                    transaction: transaction,
                });

                if (!created) {
                    await row.increment("quantity", { by: product.productQuantity, transaction: transaction });
                }
            }
            await transaction.commit();
            res.status(201).json({ message: "Cart successfully updated!" });
        } catch (error) {
            await transaction.rollback();
            next(error);
        }
    } catch (error) {
        next(error);
    }
};

//POST app/cart/deleteProduct/:productId
export const deleteProductFromCart = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const productId = req.params.productId;
    const userId = req.user.id;

    try {
        if (req.user?.role !== UserRoles.User) {
            throw { status: 401, message: "Unauthorized" };
        }

        const userCart = await Cart.findOne({ where: { userId: userId } });
        if (!userCart) throw { status: 404, message: "Cart not found" };

        const product = await CartProduct.findOne({ where: { productId: productId, cartId: userCart.id } });
        if (!product) {
            throw { status: 404, message: "The product does not exist in your cart" };
        }
        await product.destroy();
        res.status(200).json({ message: "Product has been removed from cart" });
    } catch (error) {
        next(error);
    }
};

export const getAllProductsInCart = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user.id;
    try {
        const user = await User.findByPk(userId);
        if (!user) {
            throw { status: 404, message: "There is no user associated with that userId" };
        }
        if (req.user?.role !== UserRoles.User) {
            throw { status: 401, message: "Unauthorized" };
        }

        const userCart = await Cart.findOne({
            where: { userId },
            include: [{ model: DiscountCode, as: "CartDiscount" }],
        }) as Cart & { CartDiscount: DiscountCode | null };
        if (!userCart) throw { status: 404, message: "There is no cart associated with that userId" };

        const cartProducts = await CartProduct.findAll({
            where: { cartId: userCart.id },
            include: [
                {
                    model: Product,
                    as: "Product",
                    attributes: ["name", "finalPrice", "imageUrl", "stock", "starReview", "isActive"],
                    include: [
                        {
                            model: ProductCategory,
                            as: "ProductCategory",
                            attributes: ["categoryName"],
                        },
                    ],
                },
            ],
        });

        const totalPrice = cartProducts.reduce((acc, curr) => {
            if (!curr.Product!.isActive) return acc;
            return acc + curr.quantity * curr.Product!.finalPrice;
        }, 0);

        const cartItems = cartProducts.map((x) => ({
            productId: x.productId,
            quantity: x.quantity,
            stock: x.Product.stock,
            starReview: x.Product.starReview,
            name: x.Product!.name,
            price: x.Product!.finalPrice,
            imageUrl: x.Product!.imageUrl,
            category: x.Product!.ProductCategory.categoryName,
            isActive: x.Product!.isActive,
        }));

        const dc = userCart.CartDiscount;
        const discount =
            dc && !dc.used && new Date(dc.expirationDate) >= new Date()
                ? { code: dc.code, percentage: Number(dc.discountPercentage) }
                : null;

        res.status(200).json({ items: cartItems, totalPrice, discount });
    } catch (error) {
        next(error);
    }
};

// POST /app/cart/validate-discount
export const validateDiscountCode = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { code } = req.body;

    try {
        if (req.user?.role !== UserRoles.User) throw { status: 401, message: "Unauthorized" };

        const discountCode = await DiscountCode.findOne({ where: { code } });

        if (!discountCode) throw { status: 400, message: "Invalid discount code" };
        if (discountCode.userId !== req.user.id) throw { status: 400, message: "Invalid discount code" };
        if (discountCode.used) throw { status: 400, message: "This discount code has already been used" };
        if (new Date(discountCode.expirationDate) < new Date()) throw { status: 400, message: "This discount code has expired" };

        await Cart.update({ discountCodeId: discountCode.id }, { where: { userId: req.user.id } });

        res.status(200).json({ valid: true, discountPercentage: Number(discountCode.discountPercentage), code: discountCode.code });
    } catch (error) {
        next(error);
    }
};

// DELETE /app/cart/discount
export const removeDiscountCode = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (req.user?.role !== UserRoles.User) throw { status: 401, message: "Unauthorized" };

        await Cart.update({ discountCodeId: null }, { where: { userId: req.user.id } });

        res.status(200).json({ message: "Discount code removed" });
    } catch (error) {
        next(error);
    }
};
