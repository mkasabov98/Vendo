import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ProductFormComponent } from './product-form/product-form.component';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { debounceTime, distinctUntilChanged, Subject, take, takeUntil } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputNumberModule } from 'primeng/inputnumber';
import { TableModule, Table, TableLazyLoadEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { AdminProductsService } from '../services/admin-products.service';
import { AdminCategoriesService } from '../services/admin-categories.service';
import { AdminProduct, AdminProductsParams } from '../models/admin-products.models';
import { ToastService } from '../../services/toast.service';
import { getInventorySeverity } from '../../utils/stock.utils';

@Component({
    selector: 'app-admin-products',
    standalone: true,
    imports: [
        FormsModule, CurrencyPipe, DatePipe,
        ButtonModule, SelectModule, MultiSelectModule,
        TableModule, TagModule, InputTextModule, InputNumberModule,
        IconFieldModule, InputIconModule, TooltipModule, DialogModule,
        ProductFormComponent,
    ],
    templateUrl: './products.component.html',
    styleUrl: './products.component.scss',
})
export class AdminProductsComponent implements OnInit, OnDestroy {
    @ViewChild('dt') dt!: Table;
    @ViewChild(ProductFormComponent) productForm!: ProductFormComponent;

    products: AdminProduct[] = [];
    totalRecords = 0;
    loading = true;
    selectedProducts: AdminProduct[] = [];

    pageNumber = 0;
    itemsPerPage = 20;

    searchString = '';
    selectedCategories: number[] = [];
    sortBy = 'createdAt';
    sortDir: 'asc' | 'desc' = 'desc';
    status = 'all';
    stockFilter = 'all';

    categoryOptions: { label: string; value: number }[] = [];

    readonly sortByOptions = [
        { label: 'Created Date',  value: 'createdAt'  },
        { label: 'Updated Date',  value: 'updatedAt'  },
        { label: 'Name',          value: 'name'        },
        { label: 'Final Price',   value: 'finalPrice'  },
        { label: 'Supply Price',  value: 'supplyPrice' },
        { label: 'Margin',        value: 'margin'      },
        { label: 'Stock',         value: 'stock'       },
        { label: 'Reviews',       value: 'reviews'     },
        { label: 'Rating',        value: 'rating'      },
    ];

    readonly statusOptions = [
        { label: 'All',      value: 'all'      },
        { label: 'Active',   value: 'active'   },
        { label: 'Inactive', value: 'inactive' },
    ];

    readonly stockFilterOptions = [
        { label: 'All Levels',   value: 'all'        },
        { label: 'In Stock',     value: 'instock'    },
        { label: 'Low Stock',    value: 'lowstock'   },
        { label: 'Out of Stock', value: 'outofstock' },
    ];

    showSelectionWarning = false;
    private pendingAction: (() => void) | null = null;

    showDeleteConfirm = false;
    deletingProduct: AdminProduct | null = null;
    deleteCartCount = 0;
    deleteLoading = false;

    showBulkDeleteConfirm = false;
    bulkDeleteLoading = false;

    showBulkStockUpdate = false;
    bulkStockValue: number | null = null;
    bulkStockLoading = false;

    showBulkActivateConfirm = false;
    bulkActivateLoading = false;

    get bulkActivateEligible(): AdminProduct[] {
        return this.selectedProducts.filter(p => p.stock > 0 && p.ProductCategory?.isActive !== false);
    }

    get bulkActivateSkippedStock(): number {
        return this.selectedProducts.filter(p => p.stock === 0).length;
    }

    get bulkActivateSkippedCategory(): number {
        return this.selectedProducts.filter(p => p.stock > 0 && p.ProductCategory?.isActive === false).length;
    }

    get canBulkActivate(): boolean {
        return this.bulkActivateEligible.length > 0;
    }

    get bulkActivateTooltip(): string {
        const skippedStock = this.bulkActivateSkippedStock;
        const skippedCat = this.bulkActivateSkippedCategory;
        const reasons: string[] = [];
        if (skippedStock > 0) reasons.push(`${skippedStock} with 0 stock`);
        if (skippedCat > 0) reasons.push(`${skippedCat} in inactive categor${skippedCat === 1 ? 'y' : 'ies'}`);
        if (reasons.length === 0) return 'Set selected products to active';
        if (this.bulkActivateEligible.length === 0) return `Cannot activate: ${reasons.join(', ')}`;
        return `${reasons.join(', ')} will be skipped`;
    }

    private searchSubject = new Subject<string>();
    private destroy$ = new Subject<void>();

    constructor(
        private adminProductsService: AdminProductsService,
        private adminCategoriesService: AdminCategoriesService,
        private toastService: ToastService,
    ) {}

    ngOnInit() {
        this.adminCategoriesService.getCategories().pipe(take(1)).subscribe((cats) => {
            this.categoryOptions = cats.map((c) => ({
                label: c.isActive ? c.categoryName : `${c.categoryName} (Inactive)`,
                value: c.id,
            }));
        });

        this.searchSubject.pipe(
            debounceTime(400),
            distinctUntilChanged(),
            takeUntil(this.destroy$),
        ).subscribe(() => this.resetAndLoad());
    }

    onLazyLoad(event: TableLazyLoadEvent) {
        this.pageNumber = Math.floor((event.first ?? 0) / (event.rows ?? this.itemsPerPage));
        this.itemsPerPage = event.rows ?? this.itemsPerPage;
        this.loadProducts();
    }

    loadProducts() {
        this.loading = true;

        const params: AdminProductsParams = {
            pageNumber: this.pageNumber,
            itemsPerPage: this.itemsPerPage,
            sortBy: this.sortBy,
            sortDir: this.sortDir,
            status: this.status as AdminProductsParams['status'],
            stockFilter: this.stockFilter as AdminProductsParams['stockFilter'],
        };

        if (this.searchString.trim()) params.searchString = this.searchString.trim();
        if (this.selectedCategories?.length) params.categories = this.selectedCategories.join(',');

        this.adminProductsService.getProducts(params).pipe(take(1)).subscribe({
            next: (res) => {
                this.products = res.data;
                this.totalRecords = res.meta.totalItems;
                this.selectedProducts = [];
                this.loading = false;
            },
            error: () => {
                this.loading = false;
                this.toastService.show('Failed to load products', 'error');
            },
        });
    }

    onSearchChange(value: string) {
        this.searchSubject.next(value);
    }

    applyFilters() {
        this.withSelectionCheck(() => this.resetAndLoad());
    }

    toggleSortDir() {
        this.withSelectionCheck(() => {
            this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
            this.resetAndLoad();
        });
    }

    clearAll() {
        this.searchString = '';
        this.selectedCategories = [];
        this.sortBy = 'createdAt';
        this.sortDir = 'desc';
        this.status = 'all';
        this.stockFilter = 'all';
        this.selectedProducts = [];
        this.resetAndLoad();
    }

    onCategoriesClear() {
        this.selectedCategories = [];
    }

    onStockFilterClear() {
        this.stockFilter = 'all';
    }

    onStatusClear() {
        this.status = 'all';
    }

    confirmSelectionWarning() {
        this.selectedProducts = [];
        this.pendingAction?.();
        this.pendingAction = null;
        this.showSelectionWarning = false;
    }

    cancelSelectionWarning() {
        this.pendingAction = null;
        this.showSelectionWarning = false;
    }

    get hasActiveFilters(): boolean {
        return !!(
            this.searchString ||
            this.selectedCategories?.length ||
            this.sortBy !== 'createdAt' ||
            this.sortDir !== 'desc' ||
            this.status !== 'all' ||
            this.stockFilter !== 'all'
        );
    }

    private withSelectionCheck(action: () => void) {
        if (this.selectedProducts.length > 0) {
            this.pendingAction = action;
            this.showSelectionWarning = true;
        } else {
            action();
        }
    }

    openCreate() { this.productForm.open('create'); }
    openEdit(product: AdminProduct) { this.productForm.open('edit', product); }
    openCopy(product: AdminProduct) { this.productForm.open('copy', product); }
    onProductSaved() { this.resetAndLoad(); }

    openDeleteConfirm(product: AdminProduct) {
        this.deletingProduct = product;
        this.deleteCartCount = 0;
        this.deleteLoading = true;
        this.showDeleteConfirm = true;
        this.adminProductsService.getCartCount(product.id).pipe(take(1)).subscribe({
            next: (res) => { this.deleteCartCount = res.cartCount; this.deleteLoading = false; },
            error: () => {
                this.deleteLoading = false;
                this.showDeleteConfirm = false;
                this.toastService.show('Failed to fetch cart info', 'error');
            },
        });
    }

    confirmDelete() {
        if (!this.deletingProduct) return;
        this.deleteLoading = true;
        this.adminProductsService.deactivateProduct(this.deletingProduct.id).pipe(take(1)).subscribe({
            next: () => {
                this.deleteLoading = false;
                this.showDeleteConfirm = false;
                this.deletingProduct = null;
                this.toastService.show('Product deactivated', 'success');
                this.resetAndLoad();
            },
            error: () => {
                this.deleteLoading = false;
                this.toastService.show('Failed to deactivate product', 'error');
            },
        });
    }

    cancelDelete() {
        this.showDeleteConfirm = false;
        this.deletingProduct = null;
        this.deleteCartCount = 0;
    }

    openBulkDeleteConfirm() {
        this.showBulkDeleteConfirm = true;
    }

    confirmBulkDelete() {
        this.bulkDeleteLoading = true;
        const ids = this.selectedProducts.map(p => p.id);
        this.adminProductsService.bulkUpdateProducts(ids, { isActive: false }).pipe(take(1)).subscribe({
            next: () => {
                this.bulkDeleteLoading = false;
                this.showBulkDeleteConfirm = false;
                this.toastService.show(`${ids.length} product(s) deactivated`, 'success');
                this.selectedProducts = [];
                this.resetAndLoad();
            },
            error: () => {
                this.bulkDeleteLoading = false;
                this.toastService.show('Failed to deactivate products', 'error');
            },
        });
    }

    cancelBulkDelete() {
        this.showBulkDeleteConfirm = false;
    }

    openBulkStockUpdate() {
        this.bulkStockValue = null;
        this.showBulkStockUpdate = true;
    }

    confirmBulkStockUpdate() {
        if (this.bulkStockValue === null || this.bulkStockValue < 0) return;
        this.bulkStockLoading = true;
        const ids = this.selectedProducts.map(p => p.id);
        const update: Record<string, unknown> = { stock: this.bulkStockValue };
        if (this.bulkStockValue === 0) update['isActive'] = false;
        this.adminProductsService.bulkUpdateProducts(ids, update).pipe(take(1)).subscribe({
            next: () => {
                this.bulkStockLoading = false;
                this.showBulkStockUpdate = false;
                this.toastService.show(`Stock updated for ${ids.length} product(s)`, 'success');
                this.selectedProducts = [];
                this.resetAndLoad();
            },
            error: () => {
                this.bulkStockLoading = false;
                this.toastService.show('Failed to update stock', 'error');
            },
        });
    }

    cancelBulkStockUpdate() {
        this.showBulkStockUpdate = false;
    }

    openBulkActivateConfirm() {
        this.showBulkActivateConfirm = true;
    }

    confirmBulkActivate() {
        this.bulkActivateLoading = true;
        const eligible = this.bulkActivateEligible;
        const ids = eligible.map(p => p.id);
        const totalSelected = this.selectedProducts.length;
        this.adminProductsService.bulkUpdateProducts(ids, { isActive: true }).pipe(take(1)).subscribe({
            next: () => {
                this.bulkActivateLoading = false;
                this.showBulkActivateConfirm = false;
                const skipped = totalSelected - ids.length;
                const msg = skipped > 0
                    ? `${ids.length} product(s) set to active, ${skipped} skipped`
                    : `${ids.length} product(s) set to active`;
                this.toastService.show(msg, 'success');
                this.selectedProducts = [];
                this.resetAndLoad();
            },
            error: () => {
                this.bulkActivateLoading = false;
                this.toastService.show('Failed to activate products', 'error');
            },
        });
    }

    cancelBulkActivate() {
        this.showBulkActivateConfirm = false;
    }

    stockSeverity(stock: number) { return getInventorySeverity(stock); }

    stockLabel(stock: number): string {
        return `${stock}`;
    }

    onImageError(event: Event) {
        (event.target as HTMLImageElement).src =
            'https://s13emagst.akamaized.net/products/92844/92843211/images/res_dbe5508e65ad2167a08d5b3d0dc6b4fd.jpg';
    }

    private resetAndLoad() {
        this.pageNumber = 0;
        if (this.dt) this.dt.first = 0;
        this.loadProducts();
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }
}
