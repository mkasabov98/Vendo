import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config'
import Aura from '@primeuix/themes/aura'
import { authInterceptor } from './shared/interceptors/auth.interceptor';
import { ToastService } from './shared/services/toast.service';
import { MessageService } from 'primeng/api';
import ECommercePreset from '../e-com-preset';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    providePrimeNG({
        theme: {
            preset: ECommercePreset,
            options: {
                cssLayer: {
                    name: 'primeng',
                    order: 'app-styles, primeng'
                }
            }
        }
    }),
    MessageService,
    ToastService
  ]
};