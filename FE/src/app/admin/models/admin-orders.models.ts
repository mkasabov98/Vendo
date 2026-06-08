export { OrderStatus, ORDER_STATUS_LABEL, ORDER_STATUS_SEVERITY } from "../../models/order.models";
import { OrderStatus } from "../../models/order.models";

export const ORDER_TRANSITIONS: Record<number, OrderStatus[]> = {
    [OrderStatus.Paid]: [OrderStatus.Shipped, OrderStatus.Cancelled],
    [OrderStatus.Shipped]: [OrderStatus.Delivered, OrderStatus.Cancelled],
};

export function canTransitionTo(from: OrderStatus, to: OrderStatus): boolean {
    return (ORDER_TRANSITIONS[from] ?? []).includes(to);
}

export interface AdminOrderItem {
    productId: number;
    name: string;
    imageUrl: string;
    quantity: number;
    priceAtPurchase: number;
}

export interface AdminOrderListItem {
    id: number;
    userEmail: string;
    status: OrderStatus;
    totalAmount: number;
    itemCount: number;
    shippingCountry: string;
    createdAt: string;
}

export interface AdminOrderDetail {
    id: number;
    userEmail: string;
    status: OrderStatus;
    totalAmount: number;
    discountAmount: number | null;
    discountCode: string | null;
    discountPercentage: number | null;
    shippingAddress: string;
    shippingCity: string;
    shippingCountry: string;
    createdAt: string;
    items: AdminOrderItem[];
}

export interface AdminOrdersResponse {
    data: AdminOrderListItem[];
    meta: {
        totalItems: number;
        pageNumber: number;
        itemsPerPage: number;
        totalPages: number;
    };
}
