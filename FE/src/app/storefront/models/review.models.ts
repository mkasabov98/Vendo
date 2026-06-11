export interface productReview {
    id: number;
    starReview: number;
    review: string | null;
    createdAt: string;
    author: string;
    isOwn: boolean;
}

export interface reviewsResponse {
    reviews: productReview[];
    hasReviewed: boolean | null;
    canReview: boolean | null;
}
