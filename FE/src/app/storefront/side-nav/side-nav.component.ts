import { Component, OnDestroy, OnInit, signal } from "@angular/core";
import { ProductsService } from "../services/products.service";
import { Subject, take, takeUntil } from "rxjs";
import { CommonModule } from "@angular/common";
import { productCategory, sortByOptions } from "../models/products.models";
import { ButtonModule } from "primeng/button";

@Component({
    selector: "app-side-nav",
    imports: [CommonModule, ButtonModule],
    templateUrl: "./side-nav.component.html",
    styleUrl: "./side-nav.component.scss",
    standalone: true,
})
export class SideNavComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject<void>();

    public productCategories = signal<productCategory[]>([]);
    public selectedCategories = signal<number[]>([]);
    public sortBy: sortByOptions | undefined = undefined;

    public sortOptions = [
        { label: "Price ↑", value: sortByOptions.ASC },
        { label: "Price ↓", value: sortByOptions.DESC },
        { label: "Top Rated", value: sortByOptions.REVIEW },
    ];

    constructor(private productsService: ProductsService) {}

    get activeFilterCount(): number {
        return this.selectedCategories().length + (this.sortBy ? 1 : 0);
    }

    ngOnInit() {
        this.fetchCategories();
    }

    fetchCategories() {
        this.productsService
            .getCategories()
            .pipe(take(1))
            .subscribe((res) => {
                this.productCategories.set(res);
                this.productsService.filtersSubject
                    .pipe(takeUntil(this.destroy$))
                    .subscribe((filters) => {
                        this.selectedCategories.set([...filters.categories]);
                        this.sortBy = filters.sortBy;
                    });
            });
    }

    onSortSelect(value: sortByOptions) {
        this.sortBy = this.sortBy === value ? undefined : value;
        const current = this.productsService.filtersSubject.getValue();
        this.productsService.filtersSubject.next({ ...current, sortBy: this.sortBy });
    }

    isCategorySelected(id: number): boolean {
        return this.selectedCategories().includes(id);
    }

    toggleCategory(id: number) {
        const current = this.selectedCategories();
        const updated = current.includes(id)
            ? current.filter((x) => x !== id)
            : [...current, id];
        this.selectedCategories.set(updated);
        const currentFilters = this.productsService.filtersSubject.getValue();
        this.productsService.filtersSubject.next({ ...currentFilters, categories: updated });
    }

    clearFilters() {
        this.sortBy = undefined;
        this.selectedCategories.set([]);
        const current = this.productsService.filtersSubject.getValue();
        this.productsService.filtersSubject.next({ ...current, categories: [], sortBy: undefined });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
    }
}
