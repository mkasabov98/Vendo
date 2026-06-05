export interface AdminProduct {
    id: number;
    name: string;
    description: string;
    supplyPrice: number;
    margin: number;
    finalPrice: number;
    imageUrl: string;
    stock: number;
    starReview: number | null;
    reviewsCount: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    productCategoryId: number;
    ProductCategory: { id: number; categoryName: string; isActive: boolean };
}

export interface AdminProductsParams {
    pageNumber?: number;
    itemsPerPage?: number;
    searchString?: string;
    categories?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    status?: 'all' | 'active' | 'inactive';
    stockFilter?: 'all' | 'instock' | 'lowstock' | 'outofstock';
}

export interface AdminProductsResponse {
    data: AdminProduct[];
    meta: {
        totalItems: number;
        pageNumber: number;
        itemsPerPage: number;
        totalPages: number;
    };
}
