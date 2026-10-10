import mongoose from 'mongoose';

/** An error with an HTTP status; the error handler sends it as {error}. */
export class HttpError extends Error {
    constructor(status, message, extra = {}) {
        super(message);
        this.status = status;
        this.extra = extra;
    }
}

export const httpError = (status, message, extra) => new HttpError(status, message, extra);

/** Ids from the URL or body: anything that is not an ObjectId matches nothing. */
export function isId(value) {
    return typeof value === 'string' && mongoose.isValidObjectId(value) && /^[a-f\d]{24}$/i.test(value);
}

/** A trimmed string from the request body (non-strings become ''). */
export function str(value) {
    return typeof value === 'string' ? value.trim() : (typeof value === 'number' ? String(value) : '');
}

/** The id as a string, for JSON responses. */
export const idOf = (value) => (value ? String(value._id ?? value) : null);
