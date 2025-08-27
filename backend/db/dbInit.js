import sqlite3 from "sqlite3";
import { open } from "sqlite";
import fs from "fs/promises";

sqlite3.verbose();

/**
 * Initialize the database, run the schema.sql script
 * @param {string} filename The filename of the database e.g. test.sqlite
 * @returns {Promise<Database>} The database instance
 */
export async function initDb(filename) {
    const db = await open({
        filename: './backend/db/' + filename,
        driver: sqlite3.Database
    });
    await db.exec("PRAGMA foreign_keys = ON");
    const sqlQueries = (await fs.readFile('./backend/db/schema.sql')).toString();
    const sqlQueriesArray = sqlQueries
        .split(';\n\n')
        .map(query => query.trim())
        .filter(query => query.length > 0);

    for (const query of sqlQueriesArray) {
        try {
            await db.exec(query + ";");
        } catch (err) {
            console.error('SQL Error:', err.message);
        }
    }
    return db;
}