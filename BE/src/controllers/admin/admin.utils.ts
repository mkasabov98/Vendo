import { UserRoles } from "../../enums/user-enums.enum";

export const isAdmin = (user: { role: UserRoles }) => {
    return user.role === UserRoles.Admin;
};

export function getStartDate(timeframe: string): Date | null {
    const ms: Record<string, number> = {
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
        "90d": 90 * 24 * 60 * 60 * 1000,
        "1y": 365 * 24 * 60 * 60 * 1000,
    };
    return ms[timeframe] ? new Date(Date.now() - ms[timeframe]) : null;
}
