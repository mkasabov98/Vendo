import { Component, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { FormsModule } from "@angular/forms";
import { Subject, take, takeUntil } from "rxjs";

import { ButtonModule } from "primeng/button";
import { ImageModule } from "primeng/image";
import { TagModule } from "primeng/tag";
import { SkeletonModule } from "primeng/skeleton";
import { TabsModule } from "primeng/tabs";
import { RatingModule } from "primeng/rating";
import { ProgressBarModule } from "primeng/progressbar";
import { AvatarModule } from "primeng/avatar";
import { DividerModule } from "primeng/divider";
import { BreadcrumbModule } from "primeng/breadcrumb";
import { InputNumberModule } from "primeng/inputnumber";
import { FloatLabelModule } from "primeng/floatlabel";
import { TextareaModule } from "primeng/textarea";
import { MenuItem } from "primeng/api";

import { ProductsService } from "../../services/products.service";
import { ReviewService } from "../../services/review.service";
import { CartService } from "../../services/cart.service";
import { AuthService } from "../../services/auth.service";
import { ToastService } from "../../services/toast.service";
import { productDetail } from "../../models/products.models";
import { productReview } from "../../models/review.models";
import { loggedUser, UserRoles } from "../../models/auth.models";
import { NO_USER } from "../../constants/constants";
import { getInventoryStatus, getInventorySeverity, InventoryStatus, InventorySeverity } from "../../utils/stock.utils";

@Component({
    selector: "app-product-page",
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        FormsModule,
        ButtonModule,
        ImageModule,
        TagModule,
        SkeletonModule,
        TabsModule,
        RatingModule,
        ProgressBarModule,
        AvatarModule,
        DividerModule,
        BreadcrumbModule,
        InputNumberModule,
        FloatLabelModule,
        TextareaModule,
    ],
    templateUrl: "./product-page.component.html",
    styleUrl: "./product-page.component.scss",
})
export class ProductPageComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject<void>();

    public product: productDetail | null = null;
    public reviews: productReview[] = [];
    public hasReviewed: boolean | null = null;
    public canReview: boolean | null = null;
    public loadingProduct = true;
    public loadingReviews = true;
    public productUnavailable = false;
    public submittingReview = false;
    public editingReview = false;

    public loggedUser: loggedUser = NO_USER;
    public readonly NO_USER = NO_USER;
    public UserRoles = UserRoles;
    public quantity = 1;
    public activeTab = 'description';

    public reviewForm = new FormGroup({
        starReview: new FormControl<number | null>(null, [Validators.required]),
        reviewText: new FormControl<string>(""),
    });

    public breadcrumbHome: MenuItem = { icon: "pi pi-home", routerLink: "/e-com" };
    public breadcrumbItems: MenuItem[] = [];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private productsService: ProductsService,
        private reviewService: ReviewService,
        private cartService: CartService,
        private authService: AuthService,
        private toastService: ToastService,
    ) {}

    ngOnInit() {
        this.authService.loggedUserSubject
            .pipe(takeUntil(this.destroy$))
            .subscribe((user) => (this.loggedUser = user));

        this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
            const id = parseInt(params["id"], 10);
            this.loadProduct(id);
            this.loadReviews(id);
        });

        if (this.route.snapshot.queryParams['tab'] === 'reviews') {
            this.activeTab = 'reviews';
            setTimeout(() => {
                document.querySelector('.p-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
        }
    }

    loadProduct(id: number) {
        this.loadingProduct = true;
        this.productUnavailable = false;
        this.productsService
            .getProductById(id)
            .pipe(take(1))
            .subscribe({
                next: (product) => {
                    this.product = product;
                    this.breadcrumbItems = [
                        {
                            label: product.ProductCategory.categoryName,
                            command: () => this.navigateToCategory(),
                            styleClass: "breadcrumb-category",
                        },
                        { label: product.name },
                    ];
                    this.loadingProduct = false;
                },
                error: () => {
                    this.loadingProduct = false;
                    this.productUnavailable = true;
                },
            });
    }

    navigateToCategory() {
        if (!this.product) return;
        this.productsService.filtersSubject.next({
            categories: [this.product.ProductCategory.id],
            sortBy: undefined,
            searchString: "",
        });
        this.router.navigate(["/e-com"]);
    }

    loadReviews(id: number) {
        this.loadingReviews = true;
        this.reviewService
            .getReviews(id)
            .pipe(take(1))
            .subscribe({
                next: (res) => {
                    this.reviews = res.reviews;
                    this.hasReviewed = res.hasReviewed;
                    this.canReview = res.canReview;

                    if (this.product) {
                        this.product.reviewsCount = res.reviews.length;
                        this.product.starReview = res.reviews.length
                            ? res.reviews.reduce((sum, r) => sum + r.starReview, 0) / res.reviews.length
                            : null;
                    }

                    if (this.hasReviewed) {
                        const mine = this.reviews.find((r) => r.isOwn);
                        if (mine) {
                            this.reviewForm.patchValue({
                                starReview: mine.starReview,
                                reviewText: mine.review ?? "",
                            });
                        }
                    }
                    this.loadingReviews = false;
                },
                error: () => {
                    this.loadingReviews = false;
                },
            });
    }

    get myReview(): productReview | undefined {
        return this.reviews.find((r) => r.isOwn);
    }

    get ratingBreakdown(): { stars: number; count: number; percentage: number }[] {
        return [5, 4, 3, 2, 1].map((stars) => {
            const count = this.reviews.filter((r) => Math.round(r.starReview) === stars).length;
            return {
                stars,
                count,
                percentage: this.reviews.length ? Math.round((count / this.reviews.length) * 100) : 0,
            };
        });
    }

    get inventoryStatus(): InventoryStatus {
        return getInventoryStatus(this.product?.stock ?? 0);
    }

    get inventorySeverity(): InventorySeverity {
        return getInventorySeverity(this.product?.stock ?? 0);
    }

    addToCart() {
        if (!this.product || this.product.stock === 0 || this.product.isActive === false) return;
        this.cartService
            .addToCart(this.product.id, this.quantity, this.product.stock, this.loggedUser.id === NO_USER.id)
            .pipe(take(1))
            .subscribe();
    }

    submitReview() {
        if (this.reviewForm.invalid || this.submittingReview) return;
        const { starReview, reviewText } = this.reviewForm.value;
        this.submittingReview = true;

        const obs = this.hasReviewed
            ? this.reviewService.updateReview(this.myReview!.id, starReview!, reviewText || null)
            : this.reviewService.createReview(this.product!.id, starReview!, reviewText || null);

        obs.pipe(take(1)).subscribe({
            next: () => {
                this.toastService.show(
                    this.hasReviewed ? "Review updated!" : "Review submitted!",
                    "success",
                );
                this.editingReview = false;
                this.submittingReview = false;
                this.loadReviews(this.product!.id);
            },
            error: (err) => {
                this.toastService.show(err.error?.message ?? "Failed to submit review", "warn");
                this.submittingReview = false;
            },
        });
    }

    onImageError(event: Event) {
        (event.target as HTMLImageElement).src = "https://placehold.co/400x300?text=No+Image";
    }

    ngOnDestroy() {
        this.destroy$.next();
    }
}
