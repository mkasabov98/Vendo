import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { map, Observable } from "rxjs";
import { address, city, state } from "../models/address.models";
import { environment } from "../../../environments/environment";

const GEO_API = "https://api.geocoded.me";

@Injectable({
    providedIn: "root",
})
export class AddressService {
    constructor(private http: HttpClient) {}

    public getStates(countryCode: string): Observable<state[]> {
        return this.http
            .get<{ data: state[] }>(`${GEO_API}/countries/${countryCode}/states?fields=name,iso2&limit=200`)
            .pipe(map((res) => res.data));
    }

    public getCities(countryCode: string, stateCode: string): Observable<city[]> {
        return this.http
            .get<{ data: { name: string; geonameId: number }[] }>(
                `${GEO_API}/countries/${countryCode}/states/${stateCode}/cities?fields=name,geonameId&limit=2000`
            )
            .pipe(map((res) => res.data.map((c) => ({ id: c.geonameId, name: c.name }))));
    }

    public createAddress(body: address): Observable<address> {
        return this.http.post<address>(`${environment.apiUrl}/address`, body, {
            observe: "body",
        });
    }

    public getAddresses(): Observable<address[]> {
        return this.http.get<address[]>(`${environment.apiUrl}/address`, {
            observe: "body",
        });
    }

    public setDefaultAddress(id: number): Observable<address> {
        return this.http.patch<address>(`${environment.apiUrl}/address/${id}/default`, {});
    }

    public deleteAddress(id: number): Observable<void> {
        return this.http.delete<void>(`${environment.apiUrl}/address/${id}`);
    }
}
