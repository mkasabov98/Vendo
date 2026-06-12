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

export const ORDER_STATUS_TOOLTIP: Record<OrderStatus, string> = {
    [OrderStatus.Pending]: "Payment is being processed",
    [OrderStatus.Paid]: "Payment confirmed — order is being prepared",
    [OrderStatus.Shipped]: "Your order is on the way",
    [OrderStatus.Delivered]: "Order has been delivered",
    [OrderStatus.Cancelled]: "Order was cancelled",
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
