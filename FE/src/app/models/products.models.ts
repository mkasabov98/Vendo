export interface cardProduct {
    id: number;
    name: string;
    description: string; //percent
    finalPrice: number;
    imageUrl: string;
    stock: number; // quantity in stock
    starReview: number | null;
    reviewsCount: number;
    categoryId: number;
    isActive?: boolean;
}

export interface getProductsParams {
    pageNumber?: number;
    itemsPerPage?: number;
    categories?: number[];
    sortBy?: sortByOptions;
    searchString?: string;
}
export interface getProductsResponse {
    data: cardProduct[];
    meta: {
        totalItems: number;
        pageNumber: number;
        itemsPerPage: number;
        totalPages: number;
    };
}
export interface productCategory {
    id: number;
    categoryName: string;
}

export interface filtersSubject {
    categories: number[];
    sortBy: sortByOptions | undefined;
    searchString: string;
}

export enum sortByOptions {
    ASC = "asc",
    DESC = "desc",
    REVIEW = "reviews",
}

export interface productDetail {
    id: number;
    name: string;
    description: string;
    finalPrice: number;
    imageUrl: string;
    stock: number;
    starReview: number | null;
    reviewsCount: number;
    ProductCategory: { id: number; categoryName: string };
    isActive?: boolean;
}
