export interface AdminCustomersParams {
    pageNumber: number;
    itemsPerPage: number;
    search?: string;
    sortBy?: string;
    sortDir?: "asc" | "desc";
}

export interface AdminCustomer {
    id: number;
    email: string;
    createdAt: string;
    orderCount: number;
    totalSpent: number;
    lastOrderDate: string | null;
}

export interface AdminCustomersResponse {
    data: AdminCustomer[];
    meta: {
        totalItems: number;
        pageNumber: number;
        itemsPerPage: number;
        totalPages: number;
    };
}

export interface CustomerOrder {
    id: number;
    status: number;
    totalAmount: number;
    itemCount: number;
    createdAt: string;
}

export interface AdminUser {
    id: number;
    email: string;
    createdAt: string;
}
