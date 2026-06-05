export interface AdminCategory {
    id: number;
    categoryName: string;
    isActive: boolean;
    totalProducts: number;
    activeProducts: number;
}

export interface CategoryAnalyticsItem {
    id: number;
    categoryName: string;
    revenue: number;
    profit: number;
    unitsSold: number;
}

export interface CategoryAnalyticsResponse {
    categories: CategoryAnalyticsItem[];
    topCategoryId: number | null;
}

export interface CategoryTopProduct {
    productId: number;
    name: string;
    revenue: number;
    profit: number;
    unitsSold: number;
    createdAt: string;
}
