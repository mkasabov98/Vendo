import { Routes } from '@angular/router';
import { HomePage } from './storefront/home-page/home-page.component';
import { CartComponent } from './storefront/cart/cart.component';
import { userGuard } from './shared/guards/user.guard';
import { adminGuard } from './shared/guards/admin.guard';
import { nonAdminGuard } from './shared/guards/non-admin.guard';
import { LayoutComponent } from './storefront/layout/layout.component';
import { ProfileComponent } from './storefront/profile/profile.component';
import { ProductPageComponent } from './storefront/product-page/product-page.component';
import { cartGuard } from './shared/guards/cart.guard';

export const routes: Routes = [
    {
        path: 'e-com',
        component: LayoutComponent,
        canActivate: [nonAdminGuard],
        children: [
            {
                path: '',
                component: HomePage
            },
            {
                path: 'product/:id',
                component: ProductPageComponent
            },
            {
                path: 'cart',
                component: CartComponent,
                canActivate: [cartGuard]
            },
            {
                path: 'profile',
                component: ProfileComponent,
                canActivate: [userGuard]
            }
        ],
    },
    {
        path: 'admin',
        canActivate: [adminGuard],
        loadChildren: () => import('./admin/admin.routes').then(m => m.adminRoutes)
    },
    {
        path: '**',
        redirectTo: 'e-com',
        pathMatch: 'full',
    },
];
