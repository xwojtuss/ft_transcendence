/**
 * Sets up the listeners for the change password visibility buttons
 * @returns
 */
export default function formPasswordVisibility(): void {
    document.querySelectorAll('.toggle-password-visibility')?.forEach(element => {
        element.addEventListener('click', (e) => {
            e.preventDefault();
            const inputField = element.previousElementSibling;
            const imageElement = element.firstElementChild;

            if (!(imageElement instanceof HTMLImageElement) || !(inputField instanceof HTMLInputElement))
                return;
            if (element.classList.contains('button-on')) {
                imageElement.src = 'https://img.icons8.com/material-outlined/24/visible--v1.png';
                imageElement.alt = 'Show password';
                inputField.type = 'password';
            } else {
                imageElement.src = 'https://img.icons8.com/material-outlined/24/hide.png';
                imageElement.alt = 'Hide password';
                inputField.type = 'text';
            }
            (inputField as HTMLElement).focus();
            element.classList.toggle('button-on');
        });
    });
}
