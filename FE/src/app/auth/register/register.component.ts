import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Subject, take, takeUntil } from 'rxjs';
import { ReactiveFormsModule, Validators, FormBuilder, FormGroup } from '@angular/forms';
import { PasswordModule } from 'primeng/password';
import { FloatLabelModule } from 'primeng/floatlabel';
import { Button } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { DrawerModule } from 'primeng/drawer';
import { MessageModule } from 'primeng/message';
import { TooltipModule } from 'primeng/tooltip';
import { ToastService } from '../../shared/services/toast.service';
import { BreakpointObserver } from '@angular/cdk/layout';

@Component({
    selector: 'app-register',
    imports: [
        ReactiveFormsModule, FloatLabelModule, PasswordModule,
        Button, InputTextModule, DialogModule, DrawerModule,
        MessageModule, TooltipModule,
    ],
    providers: [AuthService, ToastService],
    templateUrl: './register.component.html',
    styleUrl: './register.component.scss',
    standalone: true,
})
export class RegisterComponent implements OnInit, OnDestroy {
    private formBuilder = inject(FormBuilder);
    private destroy$ = new Subject<void>();

    private registerFormSubmitted = false;
    public registerModalVisible = false;
    public isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    public registerForm: FormGroup = this.formBuilder.group({
        email: ['', [Validators.email, Validators.required]],
        password: [
            '',
            [
                Validators.required,
                Validators.pattern(
                    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/
                ),
            ],
        ],
    });

    constructor(
        private authService: AuthService,
        private toastService: ToastService,
        private breakpointObserver: BreakpointObserver,
    ) {}

    ngOnInit() {
        this.breakpointObserver
            .observe(['(max-width: 768px)'])
            .pipe(takeUntil(this.destroy$))
            .subscribe((result) => (this.isMobile = result.matches));
    }

    onCloseRegisterFrom() {
        this.registerForm?.reset();
    }

    onRegisterFormSubmit() {
        this.registerFormSubmitted = true;
        const [email, password] = [
            this.registerForm?.controls['email'].value,
            this.registerForm?.controls['password'].value,
        ];
        this.authService
            .registerUser({ email: email!, password: password! })
            .pipe(take(1))
            .subscribe(
                () => {
                    this.toastService.show('Successful registration! You can login now.', 'success');
                    this.registerModalVisible = false;
                },
                (err) => {
                    this.toastService.show(err.error.message, 'error');
                }
            );
    }

    isInvalidEmail(controlName: string) {
        const control = this.registerForm?.get(controlName);
        return control?.invalid && (control.touched || this.registerFormSubmitted);
    }

    disableRegisterButton() {
        return (
            this.registerForm?.controls['email'].errors ||
            this.registerForm?.controls['password'].errors
        );
    }

    ngOnDestroy() {
        this.destroy$.next();
    }
}
