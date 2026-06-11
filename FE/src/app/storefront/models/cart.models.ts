export interface updateCartProductResponse {
    productId: number;
    quantity: number;
}

export interface cartProduct {
    productId: number;
    quantity?: number;
    name: string;
    starReview: number;
    description: string;
    category: string;
    stock: number;
    price: number;
    imageUrl: string;
    isActive: boolean;
}

export interface getCartProductsResponse {
    items: cartProduct[];
    totalPrice?: number;
    discount: { code: string; percentage: number } | null;
}
