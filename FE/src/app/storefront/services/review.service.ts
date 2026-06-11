import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { productReview, reviewsResponse } from "../models/review.models";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class ReviewService {
    constructor(private http: HttpClient) {}

    public getReviews(productId: number): Observable<reviewsResponse> {
        return this.http.get<reviewsResponse>(`${environment.apiUrl}/review/${productId}`);
    }

    public createReview(productId: number, starReview: number, review: string | null): Observable<productReview> {
        return this.http.post<productReview>(`${environment.apiUrl}/review`, { productId, starReview, review });
    }

    public updateReview(reviewId: number, starReview: number, review: string | null): Observable<productReview> {
        return this.http.put<productReview>(`${environment.apiUrl}/review/${reviewId}`, { starReview, review });
    }
}
