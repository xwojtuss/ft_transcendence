export default function changePasswordButton(image: HTMLElement, passwordField: HTMLInputElement, event?: Event) {
    event?.preventDefault();

    const imageElement = image as HTMLImageElement | null;
    if (!imageElement)
        return;
    if (imageElement.classList.contains('button-on')) {
        imageElement.classList.remove('button-on');
        imageElement.src = 'https://img.icons8.com/material-outlined/24/visible--v1.png';
        imageElement.alt = 'Show password';
        passwordField.type = 'password';
    } else {
        imageElement.classList.add('button-on');
        imageElement.src = 'https://img.icons8.com/material-outlined/24/hide.png';
        imageElement.alt = 'Hide password';
        passwordField.type = 'text';
    }
}