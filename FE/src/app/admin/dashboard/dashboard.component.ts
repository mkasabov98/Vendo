import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CurrencyPipe, DecimalPipe, NgClass } from "@angular/common";
import { take } from "rxjs";
import { ButtonModule } from "primeng/button";
import { SelectModule } from "primeng/select";
import { TableModule } from "primeng/table";
import { SkeletonModule } from "primeng/skeleton";
import { TagModule } from "primeng/tag";
import { DashboardService } from "../services/dashboard.service";
import { DashboardStats } from "../models/dashboard.models";
import { AdminCategoriesService } from "../services/admin-categories.service";
import { ToastService } from "../../services/toast.service";

@Component({
    selector: "app-dashboard",
    standalone: true,
    imports: [FormsModule, NgClass, CurrencyPipe, DecimalPipe, ButtonModule, SelectModule, TableModule, SkeletonModule, TagModule],
    templateUrl: "./dashboard.component.html",
    styleUrl: "./dashboard.component.scss",
})
export class DashboardComponent implements OnInit {
    loading = true;
    stats: DashboardStats | null = null;

    timeframe = "all";
    categoryId: number | null = null;
    status: number | null = null;

    readonly timeframeOptions = [
        { label: "All Time", value: "all" },
        { label: "Last 7 Days", value: "7d" },
        { label: "Last 30 Days", value: "30d" },
        { label: "Last 90 Days", value: "90d" },
        { label: "Last Year", value: "1y" },
    ];

    categoryOptions: { label: string; value: number | null }[] = [{ label: "All Categories", value: null }];

    readonly statusOptions = [
        { label: "All Statuses", value: null },
        { label: "Pending", value: 0 },
        { label: "Paid", value: 1 },
        { label: "Shipped", value: 2 },
        { label: "Delivered", value: 3 },
        { label: "Cancelled", value: 4 },
    ];

    readonly statusInfo: Record<string, { label: string }> = {
        pending: { label: "Pending" },
        paid: { label: "Paid" },
        shipped: { label: "Shipped" },
        delivered: { label: "Delivered" },
        cancelled: { label: "Cancelled" },
    };

    constructor(
        private dashboardService: DashboardService,
        private adminCategoriesService: AdminCategoriesService,
        private toastService: ToastService,
    ) {}

    ngOnInit() {
        this.adminCategoriesService
            .getCategories()
            .pipe(take(1))
            .subscribe((cats) => {
                this.categoryOptions = [
                    { label: "All Categories", value: null },
                    ...cats.map((c) => ({
                        label: c.isActive ? c.categoryName : `${c.categoryName} (Inactive)`,
                        value: c.id,
                    })),
                ];
            });
        this.loadStats();
    }

    loadStats() {
        this.loading = true;
        this.dashboardService
            .getStats({ timeframe: this.timeframe, categoryId: this.categoryId, status: this.status })
            .pipe(take(1))
            .subscribe({
                next: (data) => {
                    this.stats = data;
                    this.loading = false;
                },
                error: () => {
                    this.loading = false;
                    this.toastService.show("Failed to load dashboard stats", "error");
                },
            });
    }

    get statusRows(): { key: string; label: string; count: number }[] {
        if (!this.stats) return [];
        return (Object.keys(this.statusInfo) as (keyof DashboardStats["ordersByStatus"])[]).map((key) => ({
            key,
            label: this.statusInfo[key].label,
            count: this.stats!.ordersByStatus[key],
        }));
    }

    private get totalForPercent(): number {
        return this.statusRows.reduce((s, r) => s + r.count, 0) || 1;
    }

    statusPercent(count: number): number {
        return Math.round((count / this.totalForPercent) * 100);
    }

    clearAll() {
        this.timeframe = "all";
        this.categoryId = null;
        this.status = null;
        this.loadStats();
    }

    get hasActiveFilters(): boolean {
        return this.timeframe !== "all" || this.categoryId !== null || this.status !== null;
    }

    stockSeverity(stock: number): "danger" | "warn" | "secondary" {
        if (stock === 0) return "danger";
        if (stock < 5) return "warn";
        return "secondary";
    }

    stockLabel(stock: number): string {
        return stock === 0 ? "Out of Stock" : `${stock} left`;
    }
}
