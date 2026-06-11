import { Component, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ProductCardComponent } from "../product-card/product-card.component";
import { SideNavComponent } from "../side-nav/side-nav.component";
import { ProductsService } from "../services/products.service";
import { Subject, take, takeUntil } from "rxjs";
import {
    cardProduct,
    filtersSubject,
    getProductsParams,
    productCategory,
    sortByOptions,
} from "../models/products.models";
import { SkeletonModule } from "primeng/skeleton";
import { PaginatorModule, PaginatorState } from "primeng/paginator";

@Component({
    selector: "app-home-page",
    imports: [CommonModule, ProductCardComponent, SideNavComponent, SkeletonModule, PaginatorModule],
    templateUrl: "./home-page.component.html",
    styleUrl: "./home-page.component.scss",
    standalone: true,
})
export class HomePage implements OnInit, OnDestroy {
    private destroy$ = new Subject<void>();

    private defaultProductParams: getProductsParams = {
        pageNumber: 0,
        itemsPerPage: 20,
        categories: [],
        sortBy: sortByOptions.ASC,
        searchString: "",
    };
    private defaultPaginatorParams = { first: 0, rows: 20, totalRecords: 0 };

    private fetchProductsParams: getProductsParams = { ...this.defaultProductParams };

    public products: cardProduct[] = [];
    public loading = true;
    public paginationParams = { ...this.defaultPaginatorParams };
    public currentFilters: filtersSubject = { categories: [], sortBy: undefined, searchString: "" };
    public productCategories: productCategory[] = [];
    public skeletonItems = Array(16).fill(null);
    public mobileFiltersOpen = false;

    get activeFilterCount(): number {
        return this.currentFilters.categories.length + (this.currentFilters.sortBy ? 1 : 0);
    }

    private sortLabelMap: Record<string, string> = {
        [sortByOptions.ASC]: "Price ↑",
        [sortByOptions.DESC]: "Price ↓",
        [sortByOptions.REVIEW]: "Top Rated",
    };

    constructor(private productsService: ProductsService) {}

    ngOnInit(): void {
        this.productsService
            .getCategories()
            .pipe(take(1))
            .subscribe((cats) => (this.productCategories = cats));

        this.productsService.filtersSubject.pipe(takeUntil(this.destroy$)).subscribe((res) => {
            this.currentFilters = res;
            this.paginationParams.first = 0;
            this.fetchProductsParams = {
                ...this.fetchProductsParams,
                categories: res.categories,
                sortBy: res.sortBy,
                searchString: res.searchString,
                pageNumber: 0,
                itemsPerPage: this.paginationParams.rows,
            };
            this.fetchProducts(this.fetchProductsParams);
        });
    }

    fetchProducts(params: getProductsParams) {
        this.loading = true;
        this.productsService
            .getProducts(params)
            .pipe(take(1))
            .subscribe((res) => {
                this.products = res.data;
                this.paginationParams.totalRecords = res.meta.totalItems;
                window.scrollTo({ top: 0, behavior: "smooth" });
                this.loading = false;
            });
    }

    onPageChange(event: PaginatorState) {
        this.fetchProductsParams.pageNumber = event.page;
        this.fetchProductsParams.itemsPerPage = event.rows;
        this.fetchProducts(this.fetchProductsParams);
    }

    getCategoryName(id: number): string {
        return this.productCategories.find((c) => c.id === id)?.categoryName ?? "";
    }

    getSortLabel(sort: sortByOptions): string {
        return this.sortLabelMap[sort] ?? "";
    }

    removeCategory(id: number) {
        const current = this.productsService.filtersSubject.getValue();
        this.productsService.filtersSubject.next({
            ...current,
            categories: current.categories.filter((x) => x !== id),
        });
    }

    removeSort() {
        const current = this.productsService.filtersSubject.getValue();
        this.productsService.filtersSubject.next({ ...current, sortBy: undefined });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.productsService.filtersSubject.next({
            categories: [],
            sortBy: undefined,
            searchString: "",
        });
    }
}
