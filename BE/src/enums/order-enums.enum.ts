export enum OrderStatuses {
    Pending,
    Paid,
    Shipped,
    Delivered,
    Cancelled,
}

export const ORDER_TRANSITIONS: Record<number, OrderStatuses[]> = {
    [OrderStatuses.Paid]: [OrderStatuses.Shipped, OrderStatuses.Cancelled],
    [OrderStatuses.Shipped]: [OrderStatuses.Delivered, OrderStatuses.Cancelled],
};

export function canTransitionTo(from: OrderStatuses, to: OrderStatuses): boolean {
    return (ORDER_TRANSITIONS[from] ?? []).includes(to);
}
