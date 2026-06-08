export enum OrderStatus {
    Pending = 0,
    Paid = 1,
    Shipped = 2,
    Delivered = 3,
    Cancelled = 4,
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
    [OrderStatus.Pending]: "Pending",
    [OrderStatus.Paid]: "Paid",
    [OrderStatus.Shipped]: "Shipped",
    [OrderStatus.Delivered]: "Delivered",
    [OrderStatus.Cancelled]: "Cancelled",
};

export const ORDER_STATUS_SEVERITY: Record<OrderStatus, "warn" | "info" | "secondary" | "success" | "danger"> = {
    [OrderStatus.Pending]: "warn",
    [OrderStatus.Paid]: "info",
    [OrderStatus.Shipped]: "secondary",
    [OrderStatus.Delivered]: "success",
    [OrderStatus.Cancelled]: "danger",
};

export interface OrderProduct {
    productId: number;
    name: string;
    imageUrl: string;
    priceAtPurchase: number;
    quantity: number;
}

export interface Order {
    id: number;
    status: OrderStatus;
    totalAmount: number;
    shippingAddress: string;
    createdAt: string;
    products: OrderProduct[];
}
