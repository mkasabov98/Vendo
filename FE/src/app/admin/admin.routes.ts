import { Routes } from '@angular/router';
import { AdminLayoutComponent } from './admin-layout/admin-layout.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { AnalyticsComponent } from './analytics/analytics.component';
import { AdminProductsComponent } from './products/products.component';

export const adminRoutes: Routes = [
    {
        path: '',
        component: AdminLayoutComponent,
        children: [
            { path: 'dashboard',  component: DashboardComponent      },
            { path: 'analytics',  component: AnalyticsComponent      },
            { path: 'products',   component: AdminProductsComponent  },
            { path: '', redirectTo: 'dashboard', pathMatch: 'full'   },
        ],
    },
];
