import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { take } from "rxjs";
import { SelectModule } from "primeng/select";
import { ChartModule } from "primeng/chart";
import { DatePickerModule } from "primeng/datepicker";
import { SkeletonModule } from "primeng/skeleton";
import { AnalyticsService } from "../services/analytics.service";
import { AnalyticsBreakdown, AnalyticsTimeseriesResponse } from "../models/analytics.models";
import { ToastService } from "../../shared/services/toast.service";

type GroupBy = "day" | "week" | "month" | "quarter";
type Preset = "week" | "month" | "qtd" | "ytd" | "custom";

interface GroupingOption {
    label: string;
    value: GroupBy;
    disabled: boolean;
}

const PALETTE = [
    "#3b82f6",
    "#22c55e",
    "#f97316",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#f59e0b",
    "#ef4444",
    "#6366f1",
    "#84cc16",
    "#06b6d4",
    "#a855f7",
    "#e11d48",
    "#0ea5e9",
    "#10b981",
    "#d97706",
    "#7c3aed",
    "#059669",
    "#dc2626",
    "#0891b2",
];

@Component({
    selector: "app-analytics",
    standalone: true,
    imports: [FormsModule, SelectModule, ChartModule, DatePickerModule, SkeletonModule],
    templateUrl: "./analytics.component.html",
    styleUrl: "./analytics.component.scss",
})
export class AnalyticsComponent implements OnInit {
    // ── Filter state ───────────────────────────────────────────────
    selectedPreset: Preset = "ytd";
    selectedGroupBy: GroupBy = "month";
    customRange: Date[] | undefined;
    startDate!: Date;
    endDate!: Date;
    rangeDays = 0;

    readonly minCustomDate = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
    readonly maxCustomDate = new Date();

    readonly presetOptions = [
        { label: "Past Week", value: "week" as Preset },
        { label: "Past Month", value: "month" as Preset },
        { label: "Quarter to Date", value: "qtd" as Preset },
        { label: "Year to Date", value: "ytd" as Preset },
        { label: "Custom Range", value: "custom" as Preset },
    ];

    private readonly allGroupings: GroupingOption[] = [
        { label: "Day", value: "day", disabled: false },
        { label: "Week", value: "week", disabled: false },
        { label: "Month", value: "month", disabled: false },
        { label: "Quarter", value: "quarter", disabled: false },
    ];
    groupingOptions: GroupingOption[] = [...this.allGroupings];

    // ── Loading ────────────────────────────────────────────────────
    loadingTimeseries = false;
    loadingBreakdown = false;

    // ── Raw data ───────────────────────────────────────────────────
    timeseriesPoints: AnalyticsTimeseriesResponse["timeseries"] = [];
    usersPoints: AnalyticsTimeseriesResponse["users"] = [];
    breakdown: AnalyticsBreakdown | null = null;

    // ── Chart data ─────────────────────────────────────────────────
    revenueChartData: any = null;
    orderVolumeChartData: any = null;
    newUsersChartData: any = null;
    statusChartData: any = null;
    revByCategoryChartData: any = null;
    topProductsChartData: any = null;
    revByCountryChartData: any = null;
    marginChartData: any = null;
    discountImpactChartData: any = null;
    discountStatusChartData: any = null;

    // ── Chart options ──────────────────────────────────────────────
    lineChartOptions: any;
    barChartOptions: any;
    statusChartOptions: any;
    horizBarDollarOptions: any;
    horizBarPctOptions: any;
    topProductsOptions: any;

    constructor(
        private analyticsService: AnalyticsService,
        private toastService: ToastService,
    ) {}

    ngOnInit() {
        this.initChartOptions();
        this.applyPreset("ytd");
    }

    // ── Filter logic ───────────────────────────────────────────────

    onPresetChange() {
        if (this.selectedPreset === "custom") return;
        this.applyPreset(this.selectedPreset);
    }

    onGroupByChange() {
        this.loadTimeseries();
    }

    onCustomRangeSelect() {
        if (this.customRange?.length !== 2 || !this.customRange[1]) return;
        this.startDate = this.customRange[0];
        this.endDate = this.customRange[1];
        this.rangeDays = this.computeDays(this.startDate, this.endDate);
        this.updateGroupingOptions();
        this.autoAdjustGrouping();
        this.loadAll();
    }

    get selectedGroupByLabel(): string {
        return this.allGroupings.find((g) => g.value === this.selectedGroupBy)?.label ?? "";
    }

    get selectedPresetLabel(): string {
        return this.presetOptions.find((p) => p.value === this.selectedPreset)?.label ?? "";
    }

    private applyPreset(preset: Preset) {
        const { start, end } = this.getPresetDates(preset);
        this.startDate = start;
        this.endDate = end;
        this.rangeDays = this.computeDays(start, end);
        this.updateGroupingOptions();
        this.autoAdjustGrouping();
        this.loadAll();
    }

    private getPresetDates(preset: Preset): { start: Date; end: Date } {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        switch (preset) {
            case "week":
                start.setDate(start.getDate() - 6);
                break;
            case "month":
                start.setDate(start.getDate() - 29);
                break;
            case "qtd": {
                const q = Math.floor(start.getMonth() / 3);
                start.setMonth(q * 3, 1);
                break;
            }
            case "ytd":
                start.setMonth(0, 1);
                break;
            default:
                start.setMonth(0, 1);
        }
        return { start, end };
    }

    private computeDays(start: Date, end: Date): number {
        return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    }

    private updateGroupingOptions() {
        this.groupingOptions = this.allGroupings.map((g) => ({ ...g, disabled: !this.isGroupingValid(g.value) }));
    }

    private isGroupingValid(g: GroupBy): boolean {
        const d = this.rangeDays;
        if (d <= 7) return g === "day";
        if (d <= 60) return g === "day" || g === "week";
        if (d <= 179) return g === "week" || g === "month";
        return g === "week" || g === "month" || g === "quarter";
    }

    private autoAdjustGrouping() {
        if (!this.isGroupingValid(this.selectedGroupBy)) {
            const d = this.rangeDays;
            this.selectedGroupBy = d <= 60 ? "day" : d <= 179 ? "week" : "month";
        }
    }

    // ── Data loading ───────────────────────────────────────────────

    private loadAll() {
        this.loadTimeseries();
        this.loadBreakdown();
    }

    private loadTimeseries() {
        this.loadingTimeseries = true;
        this.analyticsService
            .getTimeseries({
                startDate: this.fmtDate(this.startDate),
                endDate: this.fmtDate(this.endDate),
                groupBy: this.selectedGroupBy,
            })
            .pipe(take(1))
            .subscribe({
                next: (data) => {
                    this.timeseriesPoints = data.timeseries;
                    this.usersPoints = data.users;
                    this.buildTimeseriesCharts();
                    this.loadingTimeseries = false;
                },
                error: () => {
                    this.loadingTimeseries = false;
                    this.toastService.show("Failed to load analytics data", "error");
                },
            });
    }

    private loadBreakdown() {
        this.loadingBreakdown = true;
        this.analyticsService
            .getBreakdown({
                startDate: this.fmtDate(this.startDate),
                endDate: this.fmtDate(this.endDate),
            })
            .pipe(take(1))
            .subscribe({
                next: (data) => {
                    this.breakdown = data;
                    this.buildBreakdownCharts();
                    this.loadingBreakdown = false;
                },
                error: () => {
                    this.loadingBreakdown = false;
                    this.toastService.show("Failed to load breakdown data", "error");
                },
            });
    }

    private fmtDate(d: Date): string {
        return d.toISOString().split("T")[0];
    }

    // ── Chart building ─────────────────────────────────────────────

    private buildTimeseriesCharts() {
        const orderLabels = this.timeseriesPoints.map((p) => this.formatPeriod(p.period));
        const allPeriods = [...new Set([...this.timeseriesPoints.map((p) => p.period), ...this.usersPoints.map((u) => u.period)])].sort();
        const userMap = new Map(this.usersPoints.map((u) => [u.period, u.newUsers]));
        const n = orderLabels.length;

        this.revenueChartData = {
            labels: orderLabels,
            datasets: [
                {
                    label: "Revenue",
                    data: this.timeseriesPoints.map((p) => p.revenue),
                    borderColor: "#3b82f6",
                    backgroundColor: "rgba(59,130,246,0.1)",
                    fill: true,
                    tension: 0.4,
                    pointRadius: n > 30 ? 0 : 3,
                    pointHoverRadius: 5,
                },
                {
                    label: "Profit",
                    data: this.timeseriesPoints.map((p) => p.profit),
                    borderColor: "#22c55e",
                    backgroundColor: "rgba(34,197,94,0.08)",
                    fill: true,
                    tension: 0.4,
                    pointRadius: n > 30 ? 0 : 3,
                    pointHoverRadius: 5,
                },
            ],
        };

        this.orderVolumeChartData = {
            labels: orderLabels,
            datasets: [{ label: "Orders", data: this.timeseriesPoints.map((p) => p.orderCount), backgroundColor: "rgba(139,92,246,0.75)", borderRadius: 4 }],
        };

        this.newUsersChartData = {
            labels: allPeriods.map((p) => this.formatPeriod(p)),
            datasets: [{ label: "New Users", data: allPeriods.map((p) => userMap.get(p) ?? 0), backgroundColor: "rgba(249,115,22,0.75)", borderRadius: 4 }],
        };

        this.discountImpactChartData = {
            labels: orderLabels,
            datasets: [
                {
                    label: "Discount Given",
                    data: this.timeseriesPoints.map((p) => p.discountAmount),
                    borderColor: "#f59e0b",
                    backgroundColor: "rgba(245,158,11,0.1)",
                    fill: true,
                    tension: 0.4,
                    pointRadius: n > 30 ? 0 : 3,
                    pointHoverRadius: 5,
                },
            ],
        };
    }

    private buildBreakdownCharts() {
        if (!this.breakdown) return;
        const s = this.breakdown.ordersByStatus;

        this.statusChartData = {
            labels: ["Pending", "Paid", "Shipped", "Delivered", "Cancelled"],
            datasets: [
                {
                    data: [s.pending, s.paid, s.shipped, s.delivered, s.cancelled],
                    backgroundColor: ["#f97316", "#3b82f6", "#a855f7", "#22c55e", "#ef4444"],
                    borderWidth: 0,
                },
            ],
        };

        const cats = this.breakdown.revByCategory;
        this.revByCategoryChartData = {
            labels: cats.map((c) => c.category),
            datasets: [
                { label: "Revenue", data: cats.map((c) => c.revenue), backgroundColor: cats.map((_, i) => PALETTE[i % PALETTE.length]), borderRadius: 4 },
            ],
        };

        const prods = this.breakdown.topProducts;
        this.topProductsChartData = {
            labels: prods.map((p) => p.name),
            datasets: [{ label: "Profit", data: prods.map((p) => p.profit), backgroundColor: "#22c55e", borderRadius: 4 }],
        };
        this.topProductsOptions = this.buildTopProductsOptions();

        const countries = this.breakdown.revByCountry;
        this.revByCountryChartData = {
            labels: countries.map((c) => c.country),
            datasets: [{ label: "Revenue", data: countries.map((c) => c.revenue), backgroundColor: "#3b82f6", borderRadius: 4 }],
        };

        const margins = this.breakdown.marginByCategory;
        this.marginChartData = {
            labels: margins.map((m) => m.category),
            datasets: [
                {
                    label: "Margin %",
                    data: margins.map((m) => m.marginPct),
                    backgroundColor: margins.map((_, i) => PALETTE[i % PALETTE.length]),
                    borderRadius: 4,
                },
            ],
        };

        const ds = this.breakdown.discountStatus;
        this.discountStatusChartData = {
            labels: ["Redeemed", "Active", "Expired Unused"],
            datasets: [{ data: [ds.used, ds.activeUnused, ds.expiredUnused], backgroundColor: ["#22c55e", "#3b82f6", "#94a3b8"], borderWidth: 0 }],
        };
    }

    // ── Chart options ──────────────────────────────────────────────

    private initChartOptions() {
        const grid = "rgba(0,0,0,0.05)";
        const muted = "#64748b";
        const ff = "'Inter',sans-serif";
        const tick = { color: muted, font: { family: ff, size: 11 } };
        const axisX = { grid: { color: grid }, ticks: tick };
        const axisY = { grid: { color: grid }, ticks: tick };
        const dollar = (v: number) => `$${Number(v).toLocaleString("en-US", { notation: "compact" as any })}`;

        this.lineChartOptions = {
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: muted, font: { family: ff, size: 12 } } },
                tooltip: { callbacks: { label: (i: any) => ` ${i.dataset.label}: $${Number(i.raw).toLocaleString("en-US", { maximumFractionDigits: 0 })}` } },
            },
            scales: { x: axisX, y: { ...axisY, ticks: { ...tick, callback: dollar } } },
        };

        this.barChartOptions = {
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (i: any) => ` ${i.dataset.label}: ${i.raw}` } },
            },
            scales: { x: axisX, y: { ...axisY, ticks: { ...tick, stepSize: 1 } } },
        };

        this.statusChartOptions = {
            maintainAspectRatio: false,
            cutout: "65%",
            plugins: {
                legend: { position: "bottom", labels: { color: muted, font: { family: ff }, padding: 16 } },
                tooltip: { callbacks: { label: (i: any) => ` ${i.label}: ${i.raw}` } },
            },
        };

        this.horizBarDollarOptions = {
            indexAxis: "y",
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (i: any) => ` $${Number(i.raw).toLocaleString("en-US", { maximumFractionDigits: 0 })}` } },
            },
            scales: {
                x: { grid: { color: grid }, ticks: { ...tick, callback: dollar } },
                y: { grid: { display: false }, ticks: tick },
            },
        };

        this.horizBarPctOptions = {
            indexAxis: "y",
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (i: any) => ` ${i.raw}%` } },
            },
            scales: {
                x: { grid: { color: grid }, ticks: { ...tick, callback: (v: number) => `${v}%` } },
                y: { grid: { display: false }, ticks: tick },
            },
        };
    }

    private buildTopProductsOptions() {
        const prods = this.breakdown?.topProducts ?? [];
        const muted = "#64748b";
        const ff = "'Inter',sans-serif";
        const tick = { color: muted, font: { family: ff, size: 11 } };
        const dollar = (v: number) => `$${Number(v).toLocaleString("en-US", { notation: "compact" as any })}`;
        return {
            indexAxis: "y",
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (i: any) => ` Profit: $${Number(i.raw).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
                        afterBody: (items: any[]) => {
                            const p = prods[items[0]?.dataIndex];
                            return p
                                ? [
                                      `Units Sold: ${p.unitsSold}`,
                                      `Revenue: $${Number(p.revenue).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
                                      `Category: ${p.category}`,
                                  ]
                                : [];
                        },
                    },
                },
            },
            scales: {
                x: { grid: { color: "rgba(0,0,0,0.05)" }, ticks: { ...tick, callback: dollar } },
                y: { grid: { display: false }, ticks: tick },
            },
        };
    }

    // ── Period label formatting ────────────────────────────────────

    formatPeriod(period: string): string {
        switch (this.selectedGroupBy) {
            case "day": {
                const d = new Date(period + "T00:00:00");
                return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            }
            case "week": {
                const yr = period.substring(0, 4);
                const wk = parseInt(period.substring(4), 10);
                return `W${wk} '${yr.substring(2)}`;
            }
            case "month": {
                const [yr, mo] = period.split("-");
                return new Date(+yr, +mo - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
            }
            case "quarter": {
                const [yr, q] = period.split("-");
                return `${q} '${yr.substring(2)}`;
            }
            default:
                return period;
        }
    }

    // ── Empty state ────────────────────────────────────────────────

    get noTimeseriesData(): boolean {
        return !this.loadingTimeseries && this.timeseriesPoints.length === 0;
    }
    get noUsersData(): boolean {
        return !this.loadingTimeseries && this.usersPoints.length === 0;
    }
    get noStatusData(): boolean {
        if (!this.breakdown) return true;
        const s = this.breakdown.ordersByStatus;
        return s.pending + s.paid + s.shipped + s.delivered + s.cancelled === 0;
    }
    get noRevByCatData(): boolean {
        return !this.breakdown || this.breakdown.revByCategory.length === 0;
    }
    get noTopProdData(): boolean {
        return !this.breakdown || this.breakdown.topProducts.length === 0;
    }
    get noCountryData(): boolean {
        return !this.breakdown || this.breakdown.revByCountry.length === 0;
    }
    get noMarginData(): boolean {
        return !this.breakdown || this.breakdown.marginByCategory.length === 0;
    }
    get noDiscountImpactData(): boolean {
        return !this.loadingTimeseries && this.timeseriesPoints.every((p) => p.discountAmount === 0);
    }
    get noDiscountStatusData(): boolean {
        if (!this.breakdown) return true;
        const s = this.breakdown.discountStatus;
        return s.used + s.activeUnused + s.expiredUnused === 0;
    }

    // ── Dynamic chart heights ──────────────────────────────────────

    get topProductsHeight(): string {
        return Math.max((this.breakdown?.topProducts.length ?? 0) * 40 + 48, 200) + "px";
    }
    get revByCountryHeight(): string {
        return Math.max((this.breakdown?.revByCountry.length ?? 0) * 34 + 48, 200) + "px";
    }
    get revByCategoryHeight(): string {
        return Math.max((this.breakdown?.revByCategory.length ?? 0) * 34 + 48, 200) + "px";
    }
    get marginHeight(): string {
        return Math.max((this.breakdown?.marginByCategory.length ?? 0) * 34 + 48, 200) + "px";
    }
}
