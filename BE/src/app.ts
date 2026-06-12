require("dotenv").config();
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import sequelize from "./config/database";

import "./models/index";
import { DiscountCode } from "./models/discountCode.model";
//Routes
import adminRoutes from "./routes/admin/index";
import storefrontRoutes from "./routes/storefront/index";
import authRoutes from "./routes/shared/auth.routes";
import userRoutes from "./routes/shared/user.routes";
//Middlewares
import { errorHandler } from "./middlewares/errorHandler";
import { handleStripeWebhook } from "./controllers/storefront/order.controller";
import { startStaleOrderReconciliation } from "./jobs/staleOrderReconciliation";

const app = express();

app.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);
// Middlewares
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:4200")
    .split(",")
    .map((o) => o.trim());

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
}));
app.use(express.json());

//Routes
app.use("/app", storefrontRoutes);
app.use("/app/admin", adminRoutes);
app.use("/app/auth", authRoutes);
app.use("/app/user", userRoutes);

app.use(errorHandler);

// DiscountCodes must exist before sequelize.sync() alters Carts and Orders,
// both of which have discountCodeId FK columns referencing this table.
DiscountCode.sync({ alter: true })
    .then(() => sequelize.sync({ alter: true }))
    .then(() => startStaleOrderReconciliation())
    .catch((err) => console.error("Sequelize sync error:", err.message));

export default app;
