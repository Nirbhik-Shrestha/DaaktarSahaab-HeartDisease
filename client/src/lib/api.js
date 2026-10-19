/**
 * Talking to the API. Every request sends the sign-in cookie and the
 * X-Requested-With header the API requires for changes (its CSRF guard).
 * Errors become ApiError with the server's message, status and extra fields
 * (e.g. `errors` lists). A 401 also tells the app the sign-in has ended.
 */
export class ApiError extends Error {
    constructor(status, data) {
        super(data?.error || (status ? 'Something went wrong. Please try again.' : 'Connection problem. Please try again.'));
        this.status = status;
        this.data = data || {};
    }

    /** The list of problems to show, for forms that report several. */
    get messages() {
        return Array.isArray(this.data.errors) && this.data.errors.length ? this.data.errors : [this.message];
    }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
    const init = {
        method,
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-Requested-With': 'fetch' },
        signal,
    };
    if (body instanceof FormData) {
        init.body = body;
    } else if (body !== undefined) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
    }

    let res;
    try {
        res = await fetch(`/api${path}`, init);
    } catch (err) {
        if (err.name === 'AbortError') throw err;
        throw new ApiError(0, null);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        if (res.status === 401 && !path.startsWith('/auth/')) {
            window.dispatchEvent(new CustomEvent('auth:expired', { detail: data.role }));
        }
        throw new ApiError(res.status, data);
    }
    return data;
}

api.get = (path, opts) => api(path, opts);
api.post = (path, body) => api(path, { method: 'POST', body });
api.put = (path, body) => api(path, { method: 'PUT', body });
api.del = (path, body) => api(path, { method: 'DELETE', body });
