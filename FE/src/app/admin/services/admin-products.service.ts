import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminProduct, AdminProductsParams, AdminProductsResponse } from '../models/admin-products.models';

@Injectable({ providedIn: 'root' })
export class AdminProductsService {
    constructor(private http: HttpClient) {}

    getProducts(params: AdminProductsParams): Observable<AdminProductsResponse> {
        return this.http.get<AdminProductsResponse>(`${environment.apiUrl}/admin/products`, { params: { ...params } });
    }

    getCartCount(id: number): Observable<{ cartCount: number }> {
        return this.http.get<{ cartCount: number }>(`${environment.apiUrl}/admin/products/${id}/cart-count`);
    }

    createProduct(body: Partial<AdminProduct>): Observable<AdminProduct> {
        return this.http.post<AdminProduct>(`${environment.apiUrl}/admin/products/create`, body);
    }

    updateProduct(id: number, body: Partial<AdminProduct>): Observable<AdminProduct> {
        return this.http.patch<AdminProduct>(`${environment.apiUrl}/admin/products/update/${id}`, body);
    }

    deactivateProduct(id: number): Observable<{ message: string }> {
        return this.http.delete<{ message: string }>(`${environment.apiUrl}/admin/products/delete/${id}`);
    }

    bulkUpdateProducts(ids: number[], update: Record<string, unknown>): Observable<{ updated: number }> {
        return this.http.patch<{ updated: number }>(`${environment.apiUrl}/admin/products/bulk-update`, { ids, update });
    }
}
