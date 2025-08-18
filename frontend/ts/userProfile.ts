import { renderPage } from "./app.js";

export async function profileHandler() {
    document.getElementById('edit-profile')?.addEventListener("click", async (e) => {
        e.preventDefault();

        return await renderPage('/update', false);
    });
}

export function updateHandler() {
    const image = document.getElementById('preview-avatar') as HTMLImageElement;
    document.querySelectorAll('.edit-field').forEach(element => {
        element.addEventListener('click', (e) => {
            const inputField = element.previousElementSibling;

            if (inputField) {
                inputField.classList.toggle('input-not-allowed');
                inputField.toggleAttribute('disabled');
            }
        });
    });
    document.getElementById('file-input')?.addEventListener('change', (e) => {
        const input = e.target as HTMLInputElement;
        if (!image || !input.files || input.files.length === 0) return;
        image.src = URL.createObjectURL(input.files[0]);
        image.onload = () => {
            URL.revokeObjectURL(image.src);
        }
    });
    document.querySelector('form#update-form #cancel-form')?.addEventListener('click', (e) => {
        e.preventDefault();
        return renderPage('/profile', false);
    })
}