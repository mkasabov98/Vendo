import {
    HttpErrorResponse,
    HttpHandlerFn,
    HttpInterceptorFn,
    HttpRequest,
} from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { inject } from '@angular/core';

export const authInterceptor: HttpInterceptorFn = (
    req: HttpRequest<unknown>,
    next: HttpHandlerFn
) => {
    const router = inject(Router);
    const url = req.url;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    // Fully public — no auth needed
    const publicRoutes = [
        `${environment.apiUrl}/auth`,
        `${environment.apiUrl}/products`,
    ];

    // Optional auth — attach JWT if present and valid, but never redirect
    const optionalAuthGetRoutes = [
        `${environment.apiUrl}/review`,
    ];

    if (publicRoutes.some((x) => url.includes(x))) {
        return next(req.clone({ setHeaders: headers }));
    }

    if (req.method === 'GET' && optionalAuthGetRoutes.some((x) => url.includes(x))) {
        const jwt = localStorage.getItem('jwt');
        if (jwt) {
            try {
                const payload = JSON.parse(atob(jwt.split('.')[1]));
                const now = Math.floor(Date.now() / 1000);
                if (payload.exp > now) {
                    headers['Authorization'] = `Bearer ${JSON.parse(jwt)}`;
                }
            } catch {
                // malformed JWT — skip auth header
            }
        }
        return next(req.clone({ setHeaders: headers }));
    }

    // Protected routes — require a valid JWT
    const jwt = localStorage.getItem('jwt');

    if (jwt) {
        let payload: { exp: number } | null = null;
        try {
            payload = JSON.parse(atob(jwt.split('.')[1]));
        } catch {
            localStorage.removeItem('jwt');
            router.navigate(['/e-com']);
            return throwError(
                () =>
                    new HttpErrorResponse({
                        error: { message: 'Session expired', typeOfToast: 'info' },
                        status: 401,
                        statusText: 'Unauthorized',
                    })
            );
        }
        const now = Math.floor(Date.now() / 1000);

        if (payload!.exp < now) {
            localStorage.removeItem('jwt');
            router.navigate(['/e-com']);
            return throwError(
                () =>
                    new HttpErrorResponse({
                        error: {
                            message: 'Session expired',
                            typeOfToast: 'info',
                        },
                        status: 401,
                        statusText: 'Unauthorized',
                    })
            );
        }
    } else {
        router.navigate(['/e-com']);
        return throwError(
            () =>
                new HttpErrorResponse({
                    error: {
                        message: 'Please log in your account!',
                        typeOfToast: 'info',
                    },
                    status: 401,
                    statusText: 'Unauthorized',
                })
        );
    }

    headers['Authorization'] = `Bearer ${JSON.parse(jwt)}`;
    const clonedReq = req.clone({
        setHeaders: headers,
    });

    return next(clonedReq);
};
