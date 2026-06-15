import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import * as dotenv from "dotenv";
import dns from "dns";

dotenv.config();

// Some hosts (e.g. Railway) resolve smtp.gmail.com to an IPv6 address but have
// no IPv6 route, so connecting on port 465 fails with ENETUNREACH. Prefer IPv4.
dns.setDefaultResultOrder("ipv4first");

if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error("GMAIL_USER or GMAIL_APP_PASSWORD is not defined in environment variables.");
}

const transportOptions: SMTPTransport.Options = {
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
};

const transporter = nodemailer.createTransport(transportOptions);

export default transporter;
