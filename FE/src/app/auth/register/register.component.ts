import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Subject, take, takeUntil } from 'rxjs';
import { AbstractControl, ReactiveFormsModule, ValidationErrors, Validators, FormBuilder, FormGroup } from '@angular/forms';
import { PasswordModule } from 'primeng/password';
import { Button } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { DrawerModule } from 'primeng/drawer';
import { FloatLabel } from 'primeng/floatlabel';
import { ToastService } from '../../shared/services/toast.service';
import { BreakpointObserver } from '@angular/cdk/layout';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const pw = control.get('password')?.value;
    const cpw = control.get('confirmPassword')?.value;
    if (!pw || !cpw) return null;
    return pw === cpw ? null : { mismatch: true };
}

@Component({
    selector: 'app-register',
    imports: [
        ReactiveFormsModule, PasswordModule,
        Button, InputTextModule, DialogModule, DrawerModule,
        FloatLabel,
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
    public isLoading = false;
    public isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    public registerForm: FormGroup = this.formBuilder.group(
        {
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
            confirmPassword: ['', Validators.required],
        },
        { validators: passwordMatchValidator }
    );

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

    get formErrors(): string[] {
        if (!this.registerFormSubmitted) return [];
        const errors: string[] = [];
        const emailCtrl = this.registerForm.get('email');
        const pwCtrl = this.registerForm.get('password');
        if (emailCtrl?.errors?.['required']) errors.push('Email is required');
        if (emailCtrl?.errors?.['email']) errors.push('Enter a valid email address');
        if (pwCtrl?.errors?.['required']) errors.push('Password is required');
        if (pwCtrl?.errors?.['pattern']) errors.push('Password must be at least 8 characters, including uppercase, lowercase, a number and a special character (!@#$%^&*)');
        if (this.registerForm.errors?.['mismatch']) errors.push('Passwords do not match');
        return errors;
    }

    onCloseRegisterFrom() {
        this.registerForm.reset();
        this.registerFormSubmitted = false;
        this.isLoading = false;
    }

    onRegisterFormSubmit() {
        this.registerFormSubmitted = true;
        if (this.isLoading || this.registerForm.invalid) return;
        this.isLoading = true;
        this.authService
            .registerUser({
                email: this.registerForm.get('email')!.value,
                password: this.registerForm.get('password')!.value,
            })
            .pipe(take(1))
            .subscribe(
                () => {
                    this.toastService.show('Successful registration! You can login now.', 'success');
                    this.registerModalVisible = false;
                    this.isLoading = false;
                },
                (err) => {
                    this.toastService.show(err.error.message, 'error');
                    this.isLoading = false;
                }
            );
    }

    ngOnDestroy() {
        this.destroy$.next();
    }
}
