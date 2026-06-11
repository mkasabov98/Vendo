import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../auth/services/auth.service';
import { map, take } from 'rxjs';
import { UserRoles } from '../../auth/models/auth.models';

export const nonAdminGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);
    authService.restoreSessionFromStorage();
    return authService.loggedUserSubject.pipe(
        take(1),
        map((res) => {
            if (res?.role === UserRoles.Admin) {
                return router.createUrlTree(['/admin/dashboard']);
            }
            return true;
        })
    );
};
