import * as dotenv from "dotenv";

dotenv.config();

// Transactional email is sent via Brevo's HTTP API (port 443) instead of SMTP,
// because cloud hosts like Railway block outbound SMTP ports (465/587/25).
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL;
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "Shop";

if (!BREVO_API_KEY || !SENDER_EMAIL) {
    throw new Error("BREVO_API_KEY or BREVO_SENDER_EMAIL is not defined in environment variables.");
}

interface MailOptions {
    from?: string;
    to: string;
    subject: string;
    html: string;
}

async function sendMail({ to, subject, html }: MailOptions): Promise<void> {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "api-key": BREVO_API_KEY as string,
            "Content-Type": "application/json",
            accept: "application/json",
        },
        body: JSON.stringify({
            sender: { name: SENDER_NAME, email: SENDER_EMAIL },
            to: [{ email: to }],
            subject,
            htmlContent: html,
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Brevo send failed: ${res.status} ${res.statusText} — ${body}`);
    }
}

export default { sendMail };
