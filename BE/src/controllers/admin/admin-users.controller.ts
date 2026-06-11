import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middlewares/authenticate.middleware";
import { User } from "../../models/user.model";
import { UserRoles } from "../../enums/user-enums.enum";
import { QueryTypes } from "sequelize";
import sequelize from "../../config/database";
import { isAdmin } from "./admin.utils";

// POST /app/admin/register
export const registerAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const body: { email: string; password: string } = { email: req.body.email, password: req.body.password };
    try {
        if (!isAdmin(req.user)) throw { status: 401, message: "Unauthorized" };

        const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
        if (!body.password || !passwordPattern.test(body.password))
            throw { status: 400, message: "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character (!@#$%^&*)." };

        const existingUser = await User.findOne({ where: { email: body.email } });
        if (existingUser) throw { status: 404, message: "There is a user associated with that email" };

        const newAdmin = await User.create({ ...body, role: UserRoles.Admin });
        const { password, ...adminData } = newAdmin.get();

        res.status(201).json(adminData);
    } catch (error) {
        next(error);
    }
};

// GET /app/admin/users/customers
export const getAdminCustomers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!isAdmin(req.user)) throw { status: 401, message: "Unauthorized" };

        const pageNumber = Math.max(0, parseInt(req.query.pageNumber as string, 10) || 0);
        const itemsPerPage = Math.min(100, Math.max(1, parseInt(req.query.itemsPerPage as string, 10) || 20));
        const offset = pageNumber * itemsPerPage;
        const search = req.query.search ? (req.query.search as string).trim() : null;
        const sortDir = (req.query.sortDir as string) === "asc" ? "ASC" : "DESC";

        const sortByMap: Record<string, string> = {
            joined: "u.createdAt",
            orders: "orderCount",
            spent: "totalSpent",
        };
        const sortColumn = sortByMap[(req.query.sortBy as string) ?? ""] ?? "u.createdAt";

        const conditions: string[] = ["u.role = :userRole"];
        const replacements: Record<string, any> = { userRole: UserRoles.User };

        if (search) {
            conditions.push("u.email LIKE :search");
            replacements.search = `%${search}%`;
        }

        const whereClause = conditions.join(" AND ");

        const [rows, countRows] = await Promise.all([
            sequelize.query(
                `SELECT u.id, u.email, u.createdAt,
                        COUNT(DISTINCT o.id) AS orderCount,
                        COALESCE(ROUND(SUM(o.totalAmount), 2), 0) AS totalSpent,
                        MAX(o.createdAt) AS lastOrderDate
                 FROM Users u
                 LEFT JOIN Orders o ON o.userId = u.id
                 WHERE ${whereClause}
                 GROUP BY u.id, u.email, u.createdAt
                 ORDER BY ${sortColumn} ${sortDir}
                 LIMIT :limit OFFSET :offset`,
                { replacements: { ...replacements, limit: itemsPerPage, offset }, type: QueryTypes.SELECT },
            ) as Promise<any[]>,
            sequelize.query(
                `SELECT COUNT(*) AS total FROM Users u WHERE ${whereClause}`,
                { replacements, type: QueryTypes.SELECT },
            ) as Promise<any[]>,
        ]);

        const totalItems = parseInt((countRows[0] as any)?.total ?? "0", 10);

        const data = (rows as any[]).map((r) => ({
            id: r.id,
            email: r.email,
            createdAt: r.createdAt,
            orderCount: parseInt(r.orderCount, 10) || 0,
            totalSpent: parseFloat(r.totalSpent) || 0,
            lastOrderDate: r.lastOrderDate ?? null,
        }));

        res.json({
            data,
            meta: { totalItems, pageNumber, itemsPerPage, totalPages: Math.ceil(totalItems / itemsPerPage) },
        });
    } catch (error) {
        next(error);
    }
};

// GET /app/admin/users/customers/:id/orders
export const getCustomerOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const customerId = parseInt(req.params.id, 10);
    try {
        if (!isAdmin(req.user)) throw { status: 401, message: "Unauthorized" };
        if (isNaN(customerId)) throw { status: 400, message: "Invalid customer ID" };

        const rows: any[] = await sequelize.query(
            `SELECT o.id, o.status, o.totalAmount, o.createdAt,
                    COUNT(op.id) AS itemCount
             FROM Orders o
             LEFT JOIN OrderProducts op ON op.orderId = o.id
             WHERE o.userId = :customerId
             GROUP BY o.id, o.status, o.totalAmount, o.createdAt
             ORDER BY o.createdAt DESC
             LIMIT 5`,
            { replacements: { customerId }, type: QueryTypes.SELECT },
        );

        res.json(
            rows.map((r) => ({
                id: r.id,
                status: r.status,
                totalAmount: parseFloat(r.totalAmount) || 0,
                itemCount: parseInt(r.itemCount, 10) || 0,
                createdAt: r.createdAt,
            })),
        );
    } catch (error) {
        next(error);
    }
};

// GET /app/admin/users/admins
export const getAdminAdmins = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!isAdmin(req.user)) throw { status: 401, message: "Unauthorized" };

        const admins = await User.findAll({
            where: { role: UserRoles.Admin },
            attributes: ["id", "email", "createdAt"],
            order: [["createdAt", "DESC"]],
        });

        res.json(admins.map((a) => ({ id: a.id, email: a.email, createdAt: a.createdAt })));
    } catch (error) {
        next(error);
    }
};
