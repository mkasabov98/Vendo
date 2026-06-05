import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminCategory, CategoryAnalyticsResponse, CategoryTopProduct } from '../models/admin-categories.models';

@Injectable({ providedIn: 'root' })
export class AdminCategoriesService {
    constructor(private http: HttpClient) {}

    getCategories(): Observable<AdminCategory[]> {
        return this.http.get<AdminCategory[]>(`${environment.apiUrl}/admin/categories`);
    }

    createCategory(categoryName: string): Observable<AdminCategory> {
        return this.http.post<AdminCategory>(`${environment.apiUrl}/admin/categories`, { categoryName });
    }

    setCategoryActive(id: number): Observable<{ message: string }> {
        return this.http.patch<{ message: string }>(`${environment.apiUrl}/admin/categories/${id}/set-active`, {});
    }

    setCategoryInactive(id: number): Observable<{ message: string }> {
        return this.http.patch<{ message: string }>(`${environment.apiUrl}/admin/categories/${id}/set-inactive`, {});
    }

    getCategoriesAnalytics(timeframe: string): Observable<CategoryAnalyticsResponse> {
        return this.http.get<CategoryAnalyticsResponse>(`${environment.apiUrl}/admin/categories/analytics`, { params: { timeframe } });
    }

    getCategoryTopProducts(id: number, timeframe: string): Observable<CategoryTopProduct[]> {
        return this.http.get<CategoryTopProduct[]>(`${environment.apiUrl}/admin/categories/${id}/top-products`, { params: { timeframe } });
    }
}
