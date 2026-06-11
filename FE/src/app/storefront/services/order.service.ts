import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import { Order } from "../models/order.models";

@Injectable({ providedIn: "root" })
export class OrderService {
    constructor(private http: HttpClient) {}

    public getOrders(): Observable<Order[]> {
        return this.http.get<Order[]>(`${environment.apiUrl}/order`);
    }
}
