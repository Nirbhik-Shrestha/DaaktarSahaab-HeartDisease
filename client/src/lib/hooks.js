import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

/** Set the browser tab's title for this page. */
export function usePageTitle(title) {
    useEffect(() => {
        document.title = title;
    }, [title]);
}

/**
 * Load JSON from the API for a page.
 *
 * @returns {{data, error, loading, reload}} reload() fetches again and keeps
 *   showing the old data meanwhile (so the page does not flash).
 */
export function useApi(path) {
    const [state, setState] = useState({ data: null, error: null, loading: true });
    const current = useRef(0);

    const load = useCallback(() => {
        if (!path) return Promise.resolve();
        const id = ++current.current;
        setState((s) => ({ ...s, loading: true }));
        return api.get(path)
            .then((data) => {
                if (id === current.current) setState({ data, error: null, loading: false });
            })
            .catch((error) => {
                if (id === current.current) setState((s) => ({ data: s.data, error, loading: false }));
            });
    }, [path]);

    useEffect(() => {
        setState({ data: null, error: null, loading: true });
        load();
    }, [load]);

    return { ...state, reload: load };
}
