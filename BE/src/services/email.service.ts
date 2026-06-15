import transporter from "../config/mailer";

interface OrderItem {
    name: string;
    quantity: number;
    priceAtPurchase: number;
}

export const sendWelcomeEmail = async (to: string, discountCode: string): Promise<void> => {
    await transporter.sendMail({
        from: `"Shop" <${process.env.GMAIL_USER}>`,
        to,
        subject: "Welcome to Shop!",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
                <h2 style="margin: 0 0 8px; color: #1a1a1a;">Welcome aboard!</h2>
                <p style="margin: 0 0 24px; color: #555; line-height: 1.6;">
                    Your account has been created successfully. You can now browse products,
                    save addresses, and place orders.
                </p>
                <div style="background: #f9f9f9; border-radius: 8px; padding: 20px 24px; margin-bottom: 24px; text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 13px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Your welcome discount</p>
                    <p style="margin: 0 0 12px; font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #1a1a1a;">${discountCode}</p>
                    <p style="margin: 0; font-size: 14px; color: #555;">10% off your first order — valid for 30 days</p>
                </div>
                <p style="margin: 0; color: #999; font-size: 13px;">
                    If you didn't create this account, you can safely ignore this email.
                </p>
            </div>
        `,
    });
};

export const sendOrderShippedEmail = async (to: string, orderId: number): Promise<void> => {
    await transporter.sendMail({
        from: `"Shop" <${process.env.GMAIL_USER}>`,
        to,
        subject: `Order #${orderId} Shipped`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
                <h2 style="margin: 0 0 8px; color: #1a1a1a;">Your order is on its way!</h2>
                <div style="background: #f9f9f9; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
                    <p style="margin: 0 0 4px; font-size: 13px; color: #999;">Order</p>
                    <p style="margin: 0; font-weight: bold; color: #1a1a1a;">#${orderId}</p>
                </div>
                <p style="margin: 0 0 24px; color: #555; line-height: 1.6;">
                    Great news — your order has been shipped and is on its way to you. You'll receive another email once it's been delivered.
                </p>
                <p style="margin: 0; color: #999; font-size: 13px;">
                    If you have any questions about your shipment, feel free to contact our support team.
                </p>
            </div>
        `,
    });
};

export const sendOrderDeliveredEmail = async (to: string, orderId: number): Promise<void> => {
    await transporter.sendMail({
        from: `"Shop" <${process.env.GMAIL_USER}>`,
        to,
        subject: `Order #${orderId} Delivered`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
                <h2 style="margin: 0 0 8px; color: #1a1a1a;">Your order has been delivered!</h2>
                <div style="background: #f9f9f9; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
                    <p style="margin: 0 0 4px; font-size: 13px; color: #999;">Order</p>
                    <p style="margin: 0; font-weight: bold; color: #1a1a1a;">#${orderId}</p>
                </div>
                <p style="margin: 0 0 24px; color: #555; line-height: 1.6;">
                    Your order has been delivered. We hope you love your purchase!
                </p>
                <p style="margin: 0; color: #999; font-size: 13px;">
                    If you'd like to leave a review or have any questions, feel free to visit the product page or contact our support team.
                </p>
            </div>
        `,
    });
};

export const sendOrderCancelledEmail = async (to: string, orderId: number): Promise<void> => {
    await transporter.sendMail({
        from: `"Shop" <${process.env.GMAIL_USER}>`,
        to,
        subject: `Order #${orderId} Cancelled`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
                <h2 style="margin: 0 0 8px; color: #1a1a1a;">Your order has been cancelled</h2>
                <div style="background: #f9f9f9; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
                    <p style="margin: 0 0 4px; font-size: 13px; color: #999;">Order</p>
                    <p style="margin: 0; font-weight: bold; color: #1a1a1a;">#${orderId}</p>
                </div>
                <p style="margin: 0 0 24px; color: #555; line-height: 1.6;">
                    We're sorry to let you know that your order has been cancelled. If you were charged, a refund will appear on your original payment method within 5–10 business days.
                </p>
                <p style="margin: 0; color: #999; font-size: 13px;">
                    If you have any questions or believe this was a mistake, please don't hesitate to contact our support team.
                </p>
            </div>
        `,
    });
};

export const sendOrderConfirmationEmail = async (
    to: string,
    orderId: number,
    items: OrderItem[],
    total: number,
    shippingAddress: string,
    discountAmount?: number,
): Promise<void> => {
    const itemRows = items
        .map(
            (item) => `
            <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #1a1a1a;">${item.name}</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #555; text-align: center;">${item.quantity}</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #555; text-align: right;">$${(item.priceAtPurchase * item.quantity).toFixed(2)}</td>
            </tr>`,
        )
        .join("");

    await transporter.sendMail({
        from: `"Shop" <${process.env.GMAIL_USER}>`,
        to,
        subject: `Order #${orderId} Confirmed`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
                <h2 style="margin: 0 0 4px; color: #1a1a1a;">Order Confirmed</h2>
                <p style="margin: 0 0 24px; color: #555;">Your payment was successful. Here's a summary of your order.</p>

                <div style="background: #f9f9f9; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 4px; font-size: 13px; color: #999;">Order</p>
                    <p style="margin: 0; font-weight: bold; color: #1a1a1a;">#${orderId}</p>
                </div>

                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="text-align: left; padding-bottom: 10px; color: #999; font-size: 12px; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #f0f0f0;">Product</th>
                            <th style="text-align: center; padding-bottom: 10px; color: #999; font-size: 12px; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #f0f0f0;">Qty</th>
                            <th style="text-align: right; padding-bottom: 10px; color: #999; font-size: 12px; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #f0f0f0;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemRows}
                    </tbody>
                </table>

                <div style="margin-top: 16px; text-align: right;">
                    ${discountAmount ? `<p style="margin: 0 0 4px; color: #22a35a; font-size: 14px;">Discount applied: -$${Number(discountAmount).toFixed(2)}</p>` : ""}
                    <span style="font-size: 16px; font-weight: bold; color: #1a1a1a;">Total: $${Number(total).toFixed(2)}</span>
                </div>

                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #f0f0f0;">
                    <p style="margin: 0 0 4px; font-size: 13px; color: #999;">Shipping to</p>
                    <p style="margin: 0; color: #1a1a1a;">${shippingAddress}</p>
                </div>

                <p style="margin: 32px 0 0; color: #999; font-size: 12px;">
                    Our team will process your order shortly. You'll receive a shipping confirmation email once it's on its way.
                </p>
            </div>
        `,
    });
};
