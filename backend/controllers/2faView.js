import QRCode from "qrcode";
import TFA from "../utils/TFA.js";
import fs from "fs/promises";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { cheerio } from '../buildApp.js';
import HTTPError from "../utils/error.js";

let cached2FAHtmlPromise = fs.readFile('./backend/views/2FA.html', 'utf8');

/**
 * Get the 2FA verify/setup view HTML
 * @param {Object} payload the payload of the 2FA token
 * @param {string} nickname the nickname of the user to pass to the 2FA TOTP
 * @returns {Promise<string>} the HTML for the 2FA verify/setup view
 */
export async function get2FAview(payload, nickname) {
    const cached2FAHtml = await cached2FAHtmlPromise;
    const tfaPage = cheerio.load(cached2FAHtml, null, false);
    let TFAtoDisplay;

    if (payload.status === 'update') {
        const pendingTFA = await TFA.getUsersPendingTFA(payload.id);
        TFAtoDisplay = pendingTFA
        if (!pendingTFA) throw new HTTPError(StatusCodes.BAD_REQUEST, ReasonPhrases.BAD_REQUEST);
        if (pendingTFA.type === 'totp') {
            const uri = pendingTFA.getURI(nickname);
            const imageURL = await QRCode.toDataURL(uri);
            tfaPage('div#qr-wrapper').append(`<img src="${imageURL}" alt="QR code" />`);
        }
    } else if (payload.status === 'check') {
        TFAtoDisplay = await TFA.getUsersTFA(payload.id)
        tfaPage('div#qr-wrapper').html('');
        tfaPage('form#tfa-form legend').text('Verify Your Identity');
    } else {
        throw new HTTPError(StatusCodes.BAD_REQUEST, ReasonPhrases.BAD_REQUEST);
    }
    switch (TFAtoDisplay.type) {
        case 'totp':
            break;
        case 'email':
            await TFAtoDisplay.sendEmail();
            tfaPage('p#tfa-action-description').text('Enter the code from the email we sent');
            break;
        case 'sms':
            await TFAtoDisplay.sendSMS();
            tfaPage('p#tfa-action-description').text('Enter the code from the SMS we sent');
            break;
        default:
            break;
    }
    return tfaPage.html();
}