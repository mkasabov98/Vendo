import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, ObservableLike } from "rxjs";
import { filtersSubject, getProductsParams, getProductsResponse, productCategory, productDetail } from "../models/products.models";
import { environment } from "../../../environments/environment";
import { getCartProductsResponse } from "../models/cart.models";

@Injectable({
    providedIn: "root",
})
export class ProductsService {
    private initialFilters: filtersSubject = {
        categories: [],
        sortBy: undefined,
        searchString: "",
    };
    public filtersSubject = new BehaviorSubject<filtersSubject>(this.initialFilters);
    constructor(private http: HttpClient) {}

    public getProducts(params: getProductsParams): Observable<getProductsResponse> {
        return this.http.get<getProductsResponse>(`${environment.apiUrl}/products`, {
            observe: "body",
            params: { ...params },
        });
    }

    public getSpecificProducts(productsIds: number[]): Observable<getCartProductsResponse> {
        return this.http.get<getCartProductsResponse>(`${environment.apiUrl}/products/specificProducts`, {
            observe: "body",
            params: { productsIds },
        });
    }

    public getCategories(): Observable<productCategory[]> {
        return this.http.get<productCategory[]>(`${environment.apiUrl}/products/categories`, {
            observe: "body",
        });
    }

    public getProductById(id: number): Observable<productDetail> {
        return this.http.get<productDetail>(`${environment.apiUrl}/products/${id}`);
    }
}
