require("dotenv").config();
import express from "express";
import cors from "cors";
import sequelize from "./config/database";

import "./models/index";
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

// Mobile testing on local network
// allowedOrigins.push("http://192.168.100.3:4200");

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

// DB_SYNC=true runs sequelize.sync({ alter: true }) to create/update tables.
// Use on first deploy to a fresh DB, then unset so subsequent boots only
// authenticate (faster, and avoids accidental schema changes from model edits).
const startupPromise =
    process.env.DB_SYNC === "true"
        ? sequelize.sync({ alter: true })
        : sequelize.authenticate();

startupPromise
    .then(() => startStaleOrderReconciliation())
    .catch((err) => console.error("Sequelize startup error:", err));

export default app;
