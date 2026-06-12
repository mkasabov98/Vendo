import { Op } from "sequelize";
import { Order } from "../models/order.model";
import { DiscountCode } from "../models/discountCode.model";
import { OrderStatuses } from "../enums/order-enums.enum";
import stripe from "../config/stripe";

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const INTERVAL_MS = 15 * 60 * 1000;        // run every 15 minutes

async function reconcileStaleOrders() {
    const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

    const staleOrders = await Order.findAll({
        where: {
            status: OrderStatuses.Pending,
            createdAt: { [Op.lt]: cutoff },
        } as any,
    });

    if (staleOrders.length === 0) return;

    console.log(`[reconciliation] Found ${staleOrders.length} stale pending order(s)`);

    for (const order of staleOrders) {
        try {
            const pi = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);

            if (pi.status === "succeeded") {
                // Webhook was missed — do not auto-cancel a paid order; alert for manual review
                console.error(
                    `[reconciliation] CRITICAL: Order ${order.id} is Pending but PaymentIntent ${pi.id} succeeded — webhook was missed, manual fulfillment required`,
                );
                continue;
            }

            if (pi.status === "processing") {
                // Still in flight, check again next cycle
                continue;
            }

            // All other statuses (canceled, requires_payment_method, payment_failed, etc.)
            await order.update({ status: OrderStatuses.Cancelled });

            if (order.discountCodeId) {
                await DiscountCode.update({ used: false }, { where: { id: order.discountCodeId } });
            }

            console.log(`[reconciliation] Cancelled stale order ${order.id} (PI status: ${pi.status})`);
        } catch (err) {
            console.error(`[reconciliation] Failed to reconcile order ${order.id}:`, err);
        }
    }
}

export function startStaleOrderReconciliation() {
    setInterval(() => {
        reconcileStaleOrders().catch((err) =>
            console.error("[reconciliation] Unhandled error in reconciliation job:", err),
        );
    }, INTERVAL_MS);

    console.log("[reconciliation] Stale order reconciliation job started (every 15 min)");
}
