import { NextFunction, Response } from "express";
import { User } from "../../models/user.model";
import { AuthRequest } from "../../middlewares/authenticate.middleware";

export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { currentPassword, newPassword } = req.body;

    try {
        const user = await User.findByPk(req.user.id);
        if (!user) throw { status: 404, message: "User not found" };

        const passwordMatch = await user.checkPassword(currentPassword);
        if (!passwordMatch) throw { status: 400, message: "Current password is incorrect" };

        user.password = newPassword;
        await user.save();

        res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
        next(error);
    }
};

export const deleteUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user.id;
    try {
        const existingUser = await User.findByPk(userId);
        if (!existingUser) {
            throw {
                status: 400,
                message: "No user found with that userId",
            };
        }
        await existingUser.destroy();
        res.status(200).json({
            message: "User deleted",
        });
    } catch (error) {
        next(error);
    }
};
