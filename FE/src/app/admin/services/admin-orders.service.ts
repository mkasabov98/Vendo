import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import { AdminOrderDetail, AdminOrderListItem, AdminOrdersResponse, OrderStatus } from "../models/admin-orders.models";

export interface AdminOrdersParams {
    pageNumber: number;
    itemsPerPage: number;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    sortBy?: string;
    sortDir?: "asc" | "desc";
}

@Injectable({ providedIn: "root" })
export class AdminOrdersService {
    constructor(private http: HttpClient) {}

    getOrders(params: AdminOrdersParams): Observable<AdminOrdersResponse> {
        const query: Record<string, string | number> = {
            pageNumber: params.pageNumber,
            itemsPerPage: params.itemsPerPage,
        };
        if (params.status && params.status !== "all") query["status"] = params.status;
        if (params.dateFrom) query["dateFrom"] = params.dateFrom;
        if (params.dateTo) query["dateTo"] = params.dateTo;
        if (params.search?.trim()) query["search"] = params.search.trim();
        if (params.sortBy) query["sortBy"] = params.sortBy;
        if (params.sortDir) query["sortDir"] = params.sortDir;

        return this.http.get<AdminOrdersResponse>(`${environment.apiUrl}/admin/orders`, { params: query });
    }

    getOrderDetail(id: number): Observable<AdminOrderDetail> {
        return this.http.get<AdminOrderDetail>(`${environment.apiUrl}/admin/orders/${id}`);
    }

    updateOrderStatus(id: number, status: OrderStatus): Observable<{ id: number; status: OrderStatus }> {
        return this.http.patch<{ id: number; status: OrderStatus }>(`${environment.apiUrl}/admin/orders/${id}/status`, { status });
    }
}
