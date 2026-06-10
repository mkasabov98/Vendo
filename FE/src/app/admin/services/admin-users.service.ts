import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import { AdminCustomersParams, AdminCustomersResponse, AdminUser, CustomerOrder } from "../models/admin-users.models";

@Injectable({ providedIn: "root" })
export class AdminUsersService {
    constructor(private http: HttpClient) {}

    getCustomers(params: AdminCustomersParams): Observable<AdminCustomersResponse> {
        const query: Record<string, string | number> = {
            pageNumber: params.pageNumber,
            itemsPerPage: params.itemsPerPage,
        };
        if (params.search?.trim()) query["search"] = params.search.trim();
        if (params.sortBy) query["sortBy"] = params.sortBy;
        if (params.sortDir) query["sortDir"] = params.sortDir;

        return this.http.get<AdminCustomersResponse>(`${environment.apiUrl}/admin/users/customers`, { params: query });
    }

    getAdmins(): Observable<AdminUser[]> {
        return this.http.get<AdminUser[]>(`${environment.apiUrl}/admin/users/admins`);
    }

    createAdmin(email: string, password: string): Observable<AdminUser> {
        return this.http.post<AdminUser>(`${environment.apiUrl}/admin/register`, { email, password });
    }

    getCustomerOrders(customerId: number): Observable<CustomerOrder[]> {
        return this.http.get<CustomerOrder[]>(`${environment.apiUrl}/admin/users/customers/${customerId}/orders`);
    }

    changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
        return this.http.patch<{ message: string }>(`${environment.apiUrl}/user/password`, { currentPassword, newPassword });
    }
}
