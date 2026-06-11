import { NextFunction, Request, Response } from "express";
import { User } from "../../models/user.model";
import { Cart } from "../../models/cart.model";
import { DiscountCode } from "../../models/discountCode.model";
import { UserRoles } from "../../enums/user-enums.enum";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendWelcomeEmail } from "../../services/email.service";

// POST /app/auth/register
export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
    const body: { email: string; password: string } = { email: req.body.email, password: req.body.password };
    try {
        const existingUser = await User.findOne({
            where: {
                email: body.email,
            },
        });
        if (!existingUser) {
            const newUser = await User.create({ ...body, role: UserRoles.User });
            const { password, ...userData } = newUser.get();
            await Cart.findOrCreate({ where: { userId: newUser.id } });

            const code = "WELCOME-" + crypto.randomBytes(4).toString("hex").toUpperCase();
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + 30);
            await DiscountCode.create({ code, userId: newUser.id, discountPercentage: 10, expirationDate });

            sendWelcomeEmail(newUser.email, code).catch((err) =>
                console.error("Failed to send welcome email:", err)
            );
            return res.status(201).json(userData);
        }
        throw {
            status: 400,
            message: "There is a user with that email",
        };
    } catch (error) {
        next(error);
    }
};

// POST /app/auth/login
export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = req.body;
        const existingUser = await User.findOne({
            where: {
                email: body.email,
            },
        });

        if (!existingUser) {
            throw {
                status: 400,
                message: "There is no registered user with that email",
            };
        }

        const passwordMatch = await existingUser.checkPassword(body.password);
        if (!passwordMatch) {
            throw {
                status: 400,
                message: "Password does not match to the provided email",
            };
        }

        const token = jwt.sign(
            {
                id: existingUser.id,
                role: existingUser.role,
                email: existingUser.email,
            },
            process.env.JWT_SECRET!,
            { expiresIn: 3600 }
        );
        res.status(200).json({
            userData: { email: existingUser.email, id: existingUser.id, role: existingUser.role },
            token,
        });
    } catch (error) {
        next(error);
    }
};
