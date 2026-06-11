import { Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';

@Injectable({ providedIn: 'root' })
export class ToastService {
    constructor(private messageService: MessageService) {}

    show(
        message: string,
        type: 'success' | 'info' | 'warn' | 'error' = 'info',
        life = 5000
    ) {
        this.messageService.clear();
        this.messageService.add({
            severity: type,
            summary: type[0].toUpperCase() + type.slice(1),
            detail: message,
            life,
        });
    }
}
