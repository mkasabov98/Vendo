import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CurrencyPipe, DatePipe } from "@angular/common";
import { take } from "rxjs";
import { ButtonModule } from "primeng/button";
import { SelectModule } from "primeng/select";
import { TableModule } from "primeng/table";
import { TagModule } from "primeng/tag";
import { InputTextModule } from "primeng/inputtext";
import { DialogModule } from "primeng/dialog";
import { ChartModule } from "primeng/chart";
import { SkeletonModule } from "primeng/skeleton";
import { TooltipModule } from "primeng/tooltip";
import { AdminCategoriesService } from "../services/admin-categories.service";
import { AdminCategory, CategoryAnalyticsItem, CategoryTopProduct } from "../models/admin-categories.models";
import { ToastService } from "../../services/toast.service";

const PALETTE = ["#3b82f6", "#22c55e", "#f97316", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#ef4444", "#6366f1", "#84cc16"];

@Component({
    selector: "app-categories",
    standalone: true,
    imports: [
        FormsModule,
        CurrencyPipe,
        DatePipe,
        ButtonModule,
        SelectModule,
        TableModule,
        TagModule,
        InputTextModule,
        DialogModule,
        ChartModule,
        SkeletonModule,
        TooltipModule,
    ],
    templateUrl: "./categories.component.html",
    styleUrl: "./categories.component.scss",
})
export class CategoriesComponent implements OnInit {
    // ── Categories table ──────────────────────────────────────────
    categories: AdminCategory[] = [];
    loadingCategories = true;

    // ── Add dialog ────────────────────────────────────────────────
    showAddDialog = false;
    newCategoryName = "";
    addingCategory = false;

    // ── Deactivate confirm dialog ─────────────────────────────────
    showConfirmDialog = false;
    categoryToDeactivate: AdminCategory | null = null;
    deactivating = false;

    // ── Analytics ─────────────────────────────────────────────────
    loadingAnalytics = false;
    analyticsCategories: CategoryAnalyticsItem[] = [];

    loadingTopProducts = false;
    topProducts: CategoryTopProduct[] = [];

    selectedCategoryId: number | null = null;

    selectedTimeframe = "30d";
    readonly timeframeOptions = [
        { label: "Past 7 Days", value: "7d" },
        { label: "Past 30 Days", value: "30d" },
        { label: "Past 90 Days", value: "90d" },
        { label: "Past Year", value: "1y" },
        { label: "All Time", value: "all" },
    ];

    // ── Chart ─────────────────────────────────────────────────────
    chartData: any = null;
    chartOptions: any = null;

    constructor(
        private categoriesService: AdminCategoriesService,
        private toastService: ToastService,
    ) {}

    ngOnInit() {
        this.initChartOptions();
        this.loadCategories();
        this.loadAnalytics();
    }

    // ── Categories list ───────────────────────────────────────────

    loadCategories() {
        this.loadingCategories = true;
        this.categoriesService
            .getCategories()
            .pipe(take(1))
            .subscribe({
                next: (data) => {
                    this.categories = data;
                    this.loadingCategories = false;
                },
                error: () => {
                    this.toastService.show("Failed to load categories", "error");
                    this.loadingCategories = false;
                },
            });
    }

    // ── Add category ──────────────────────────────────────────────

    openAddDialog() {
        this.newCategoryName = "";
        this.showAddDialog = true;
    }

    submitAddCategory() {
        const name = this.newCategoryName.trim();
        if (!name) return;
        this.addingCategory = true;
        this.categoriesService
            .createCategory(name)
            .pipe(take(1))
            .subscribe({
                next: () => {
                    this.toastService.show("Category created", "success");
                    this.showAddDialog = false;
                    this.addingCategory = false;
                    this.loadCategories();
                    this.loadAnalytics();
                },
                error: (err) => {
                    this.toastService.show(err?.error?.message ?? "Failed to create category", "error");
                    this.addingCategory = false;
                },
            });
    }

    // ── Activate category ─────────────────────────────────────────

    activateCategory(category: AdminCategory) {
        const inactiveProducts = category.totalProducts - category.activeProducts;
        this.categoriesService
            .setCategoryActive(category.id)
            .pipe(take(1))
            .subscribe({
                next: () => {
                    const msg =
                        inactiveProducts > 0
                            ? `Category activated — ${inactiveProducts} product(s) still inactive, re-activate individually to show on storefront`
                            : "Category activated";
                    this.toastService.show(msg, "success");
                    this.loadCategories();
                    this.loadAnalytics();
                },
                error: () => this.toastService.show("Failed to activate category", "error"),
            });
    }

    // ── Deactivate category ───────────────────────────────────────

    confirmDeactivate(category: AdminCategory) {
        this.categoryToDeactivate = category;
        this.showConfirmDialog = true;
    }

    executeDeactivate() {
        if (!this.categoryToDeactivate) return;
        this.deactivating = true;
        this.categoriesService
            .setCategoryInactive(this.categoryToDeactivate.id)
            .pipe(take(1))
            .subscribe({
                next: () => {
                    this.toastService.show("Category and its products deactivated", "success");
                    this.showConfirmDialog = false;
                    this.categoryToDeactivate = null;
                    this.deactivating = false;
                    this.loadCategories();
                    this.loadAnalytics();
                },
                error: () => {
                    this.toastService.show("Failed to deactivate category", "error");
                    this.deactivating = false;
                },
            });
    }

    cancelDeactivate() {
        this.showConfirmDialog = false;
        this.categoryToDeactivate = null;
    }

    // ── Analytics ─────────────────────────────────────────────────

    onTimeframeChange() {
        this.loadAnalytics();
    }

    onCategoryChange() {
        if (this.selectedCategoryId !== null) {
            this.loadTopProducts(this.selectedCategoryId);
        }
    }

    private loadAnalytics() {
        this.loadingAnalytics = true;
        this.categoriesService
            .getCategoriesAnalytics(this.selectedTimeframe)
            .pipe(take(1))
            .subscribe({
                next: (data) => {
                    this.analyticsCategories = data.categories;
                    this.buildChart();
                    this.loadingAnalytics = false;

                    const topId = data.topCategoryId;
                    if (topId !== null && this.selectedCategoryId === null) {
                        this.selectedCategoryId = topId;
                    }
                    if (this.selectedCategoryId !== null) {
                        this.loadTopProducts(this.selectedCategoryId);
                    }
                },
                error: () => {
                    this.toastService.show("Failed to load analytics", "error");
                    this.loadingAnalytics = false;
                },
            });
    }

    private loadTopProducts(categoryId: number) {
        this.loadingTopProducts = true;
        this.categoriesService
            .getCategoryTopProducts(categoryId, this.selectedTimeframe)
            .pipe(take(1))
            .subscribe({
                next: (data) => {
                    this.topProducts = data;
                    this.loadingTopProducts = false;
                },
                error: () => {
                    this.toastService.show("Failed to load top products", "error");
                    this.loadingTopProducts = false;
                },
            });
    }

    // ── Chart ─────────────────────────────────────────────────────

    private buildChart() {
        const cats = this.analyticsCategories;
        this.chartData = {
            labels: cats.map((c) => c.categoryName),
            datasets: [
                {
                    label: "Revenue",
                    data: cats.map((c) => c.revenue),
                    backgroundColor: cats.map((_, i) => PALETTE[i % PALETTE.length] + "cc"),
                    borderColor: cats.map((_, i) => PALETTE[i % PALETTE.length]),
                    borderWidth: 1,
                    borderRadius: 4,
                },
                {
                    label: "Profit",
                    data: cats.map((c) => c.profit),
                    backgroundColor: cats.map((_, i) => PALETTE[i % PALETTE.length] + "55"),
                    borderColor: cats.map((_, i) => PALETTE[i % PALETTE.length]),
                    borderWidth: 1,
                    borderRadius: 4,
                },
            ],
        };
    }

    private initChartOptions() {
        const muted = "#64748b";
        const ff = "'Inter',sans-serif";
        const tick = { color: muted, font: { family: ff, size: 11 } };
        const dollar = (v: number) => `$${Number(v).toLocaleString("en-US", { notation: "compact" as any })}`;
        this.chartOptions = {
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: muted, font: { family: ff, size: 12 } } },
                tooltip: {
                    callbacks: {
                        label: (i: any) => ` ${i.dataset.label}: $${Number(i.raw).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
                        afterBody: (items: any[]) => {
                            const cat = this.analyticsCategories[items[0]?.dataIndex];
                            return cat ? [`Units Sold: ${cat.unitsSold.toLocaleString()}`] : [];
                        },
                    },
                },
            },
            scales: {
                x: { grid: { color: "rgba(0,0,0,0.05)" }, ticks: tick },
                y: { grid: { color: "rgba(0,0,0,0.05)" }, ticks: { ...tick, callback: dollar } },
            },
        };
    }

    // ── Helpers ───────────────────────────────────────────────────

    get categoryOptions() {
        return this.analyticsCategories.map((c) => ({ label: c.categoryName, value: c.id }));
    }

    get selectedCategoryName(): string {
        return this.analyticsCategories.find((c) => c.id === this.selectedCategoryId)?.categoryName ?? "";
    }

    get selectedTimeframeLabel(): string {
        return this.timeframeOptions.find((t) => t.value === this.selectedTimeframe)?.label ?? "";
    }

    get noAnalyticsData(): boolean {
        return !this.loadingAnalytics && this.analyticsCategories.every((c) => c.revenue === 0);
    }

    get noTopProductsData(): boolean {
        return !this.loadingTopProducts && this.topProducts.length === 0;
    }
}
