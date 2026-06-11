export enum UserRoles {
    NO_USER = -1,
    User = 0,
    Admin = 1,
}

export interface loggedUser {
    email: string;
    role: UserRoles;
    id: number;
}

export interface loginResponse {
    userData: loggedUser;
    token: string;
}
