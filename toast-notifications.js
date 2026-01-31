/**
 * Toast Notification System
 * Replaces native alert() with user-friendly notifications
 */

class ToastManager {
    constructor() {
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            this.container.setAttribute('role', 'alert');
            this.container.setAttribute('aria-live', 'polite');
            document.body.appendChild(this.container);
        }
        this.toasts = new Map();
    }

    show(message, type = 'info', duration = 4000) {
        const id = Date.now();
        const toast = this.createToast(message, type, id);
        this.container.appendChild(toast);
        this.toasts.set(id, toast);

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        if (duration > 0) {
            setTimeout(() => {
                this.dismiss(id);
            }, duration);
        }

        return id;
    }

    success(message, duration = 4000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 6000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 5000) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = 4000) {
        return this.show(message, 'info', duration);
    }

    dismiss(id) {
        const toast = this.toasts.get(id);
        if (toast) {
            toast.classList.remove('show');
            toast.classList.add('dismiss');
            setTimeout(() => {
                toast.remove();
                this.toasts.delete(id);
            }, 300);
        }
    }

    dismissAll() {
        this.toasts.forEach((toast, id) => {
            this.dismiss(id);
        });
    }

    createToast(message, type, id) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.id = `toast-${id}`;
        toast.setAttribute('role', 'alert');

        const icon = this.getIcon(type);
        const iconHtml = `<i class="${icon}" aria-hidden="true"></i>`;

        toast.innerHTML = `
            <div class="toast-content">
                ${iconHtml}
                <span class="toast-message">${message}</span>
                <button class="toast-close" aria-label="Kapat" data-toast-id="${id}">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </div>
        `;

        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.dismiss(id));

        return toast;
    }

    getIcon(type) {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        return icons[type] || icons.info;
    }
}

const toast = new ToastManager();
export default toast;
