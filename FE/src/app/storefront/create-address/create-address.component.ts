import { Component, EventEmitter, inject, OnInit, OnDestroy, Output } from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
import { FormBuilder, ReactiveFormsModule, FormsModule } from "@angular/forms";
import { Button } from "primeng/button";
import { CheckboxModule } from "primeng/checkbox";
import { DialogModule } from "primeng/dialog";
import { DrawerModule } from "primeng/drawer";
import { FloatLabel } from "primeng/floatlabel";
import { InputTextModule } from "primeng/inputtext";
import { ToastService } from "../../shared/services/toast.service";
import { SelectModule } from "primeng/select";
import { COUNTRIES } from "../../shared/constants/constants";
import { Subject, take, takeUntil } from "rxjs";
import { AddressService } from "../services/address.service";
import { city, state } from "../models/address.models";
import { BreakpointObserver } from "@angular/cdk/layout";

@Component({
    selector: "app-create-address",
    imports: [
        Button,
        CheckboxModule,
        DialogModule,
        DrawerModule,
        FormsModule,
        ReactiveFormsModule,
        InputTextModule,
        FloatLabel,
        SelectModule,
        NgTemplateOutlet,
    ],
    providers: [ToastService],
    templateUrl: "./create-address.component.html",
    styleUrl: "./create-address.component.scss",
    standalone: true,
})
export class CreateAddressComponent implements OnInit, OnDestroy {
    @Output() onAddressCreate: EventEmitter<any> = new EventEmitter();

    private formBuilder = inject(FormBuilder);
    private destroy$ = new Subject<void>();

    public addressForm = this.formBuilder.group({
        country: [null],
        state: [{ value: null, disabled: true }],
        city: [{ value: null, disabled: true }],
        address: [{ value: null, disabled: true }],
        isDefault: [false],
    });

    public visible = false;
    public isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
    public countries = COUNTRIES;
    public states: state[] = [];
    public cities: city[] = [];
    public isLoadingStates = false;
    public isLoadingCities = false;

    constructor(
        private addressService: AddressService,
        private toastService: ToastService,
        private breakpointObserver: BreakpointObserver,
    ) {}

    ngOnInit(): void {
        this.breakpointObserver
            .observe(["(max-width: 768px)"])
            .pipe(takeUntil(this.destroy$))
            .subscribe((result) => (this.isMobile = result.matches));

        this.formDependencies();
    }

    formDependencies() {
        const countryControl = this.addressForm.get("country");
        const stateControl = this.addressForm.get("state");
        const cityControl = this.addressForm.get("city");
        const addressControl = this.addressForm.get("address");

        countryControl?.valueChanges.subscribe((countryValue) => {
            stateControl?.disable();
            stateControl?.setValue(null);
            cityControl?.disable();
            cityControl?.setValue(null);
            addressControl?.disable();
            addressControl?.setValue(null);
            this.states = [];
            this.cities = [];
            if (countryValue) this.fetchStates(countryValue);
        });

        stateControl?.valueChanges.subscribe((stateValue) => {
            cityControl?.disable();
            cityControl?.setValue(null);
            addressControl?.disable();
            addressControl?.setValue(null);
            this.cities = [];
            if (stateValue) {
                const country = this.addressForm.value.country as unknown as { code: string };
                this.fetchCities(country.code, (stateValue as unknown as state).iso2);
            }
        });

        cityControl?.valueChanges.subscribe((cityValue) => {
            if (cityValue) {
                addressControl?.enable();
                addressControl?.setValue(null);
            } else {
                addressControl?.disable();
                addressControl?.setValue(null);
            }
        });
    }

    fetchStates(country: { code: string; name: string }) {
        this.isLoadingStates = true;
        this.addressService
            .getStates(country.code)
            .pipe(take(1))
            .subscribe({
                next: (res) => {
                    this.states = res;
                    this.addressForm.controls.state.enable();
                    this.isLoadingStates = false;
                },
                error: (err) => {
                    this.toastService.show(err.error?.message ?? "Failed to load states", "warn");
                    this.isLoadingStates = false;
                },
            });
    }

    fetchCities(countryCode: string, stateCode: string) {
        this.isLoadingCities = true;
        this.addressService
            .getCities(countryCode, stateCode)
            .pipe(take(1))
            .subscribe({
                next: (res) => {
                    this.cities = res;
                    this.addressForm.controls.city.enable();
                    this.isLoadingCities = false;
                },
                error: (err) => {
                    this.toastService.show(err.error?.message ?? "Failed to load cities", "warn");
                    this.isLoadingCities = false;
                },
            });
    }

    disableButton() {
        const { country, state, city, address } = this.addressForm.controls;
        return !country.value || !state.value || !city.value || !address.value;
    }

    onFormSubmit() {
        const country = this.addressForm.value.country as unknown as { name: string; code: string };
        const city = this.addressForm.value.city as unknown as { name: string; id: number };
        const address = this.addressForm.value.address!;
        const isDefault = this.addressForm.value.isDefault ?? false;

        this.addressService.createAddress({ country: country.name, city: city.name, address, isDefault }).subscribe({
            next: () => {
                this.toastService.show("Address has been created!", "success");
                this.onAddressCreate.emit();
                this.visible = false;
                this.resetForm();
            },
            error: (err) => this.toastService.show(err.error?.message ?? "Failed to create address", "warn"),
        });
    }

    resetForm() {
        this.addressForm.reset();
        this.states = [];
        this.cities = [];
    }

    ngOnDestroy() {
        this.destroy$.next();
    }
}
