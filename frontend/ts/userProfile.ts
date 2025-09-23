import { renderPage } from "./app.js";
import { invalidateAccessToken } from "./authenticate.js";

export async function profileHandler(): Promise<void> {
    document.getElementById('edit-profile')?.addEventListener("click", async (e) => {
        e.preventDefault();

        return await renderPage('/update', false);
    });
    document.getElementById('log-out')?.addEventListener("click", async (e) => {
        e.preventDefault();
        invalidateAccessToken();
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        return await renderPage('/', true);
    });
}

export function updateHandler(): void {
    const image: HTMLElement | null = document.getElementById('preview-avatar');
    document.querySelectorAll('.edit-field')?.forEach(element => {
        element.addEventListener('click', (e) => {
            const inputField = element.previousElementSibling;

            if (inputField) {
                inputField.classList.toggle('input-not-allowed');
                inputField.toggleAttribute('disabled');
                (inputField as HTMLElement).focus();
            }
        });
    });
    document.getElementById('file-input')?.addEventListener('change', (e) => {
        const input: EventTarget | null = e.target;
        if (!input || !(input instanceof HTMLInputElement)) return;
        if (!image || !(image instanceof HTMLImageElement)) return;
        if (!input.files || input.files.length === 0) return;

        const blobUrl: string = URL.createObjectURL(input.files[0]);
        image.src = blobUrl;
        image.onload = () => {
            URL.revokeObjectURL(blobUrl);
        }
    });
    document.querySelector('form#update-form #cancel-form')?.addEventListener('click', (e) => {
        e.preventDefault();
        return renderPage('/profile', false);
    })
    document.getElementById('new-password-input')?.addEventListener('click', (e) => {
        e.preventDefault();
        const inputField = e.target as HTMLInputElement;

        if (inputField.type === 'password') return;
        inputField.type = 'password';
        inputField.value = '';
        inputField.classList.toggle('font-bold');
        let sibling = inputField.nextElementSibling;
        if (!sibling) return;
        sibling.classList.remove('hidden');
        sibling = sibling.nextElementSibling;
        if (!sibling) return;
        sibling.classList.remove('hidden');
    });
}

export function update2FAHandler(): void {
    document.querySelector('form#tfa-form #cancel-form')?.addEventListener('click', (e) => {
        e.preventDefault();
        const url = (e.target as HTMLInputElement).getAttribute('formaction');
        return renderPage(url ? url : '/update', false);
    })
    const inputs: NodeListOf<Element> = document.querySelectorAll('form input.digit');

    if (inputs.length === 0 || !(inputs[0] instanceof HTMLInputElement)) return;
    inputs[0].focus();
    inputs.forEach((element, key) => {
        const input: Element = element;
        if (!(input instanceof HTMLInputElement)) return;
        input.addEventListener('input', (e) => {
            e.preventDefault();
            const value: string = input.value.replace(/[^0-9]/g, '');
            input.value = value;
            if (value && key < inputs.length - 1) {
                (inputs[key + 1] as HTMLElement).focus();
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !input.value && key > 0) {
                (inputs[key - 1] as HTMLElement).focus();
            }
        });
        input.addEventListener('paste', (e: ClipboardEvent) => {
            e.preventDefault();
            const paste = e.clipboardData?.getData('text') || '';
            const digits = paste.replace(/[^0-9]/g, '').split('');
            let lastIndex = 0;
            if (digits.length === 0) return;
            digits.forEach((digit, index) => {
                if (key + index >= inputs.length) return;
                (inputs[key + index] as HTMLInputElement).value = digit;
                lastIndex = key + index;
            });
            lastIndex = lastIndex >= inputs.length - 1 ? inputs.length - 1 : lastIndex + 1;
            (inputs[lastIndex] as HTMLInputElement).focus();
        });
    });
}