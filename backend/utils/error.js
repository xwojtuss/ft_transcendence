import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { cheerio } from '../server.js';
import fs from 'fs/promises';

let cachedErrorHtmlPromise = fs.readFile('./backend/views/error.html', 'utf8');

export default class HTTPError extends Error {
    /**
     * Create a HTTP error
     * @param {StatusCodes} code the status code the reply will have
     * @param {ReasonPhrases | string} message the message sent to the client in the reply
     */
    constructor(code, message) {
        super(message);
        this.code = code;
        this.message = message;
    }

    /**
     * Get the error page HTML of a particular error
     * @returns {Promise<string>} The rendered error page
     */
    async getErrorPage() {
        const cachedErrorHtml = await cachedErrorHtmlPromise;
        const errorPage = cheerio.load(cachedErrorHtml, null, false);

        errorPage('p.error-name').text(this.code + ' Error');
        errorPage('span.error-description').text(this.message);
        errorPage('.error-wrapper img').attr('src', 'https://http.cat/' + this.code + '.jpg');

        return errorPage.html();
    }
}