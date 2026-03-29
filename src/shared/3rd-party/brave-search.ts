export type WebSearchQueryParams = {
    q: string;
    count?: number;
    offset?: number;
    country?: string;
    search_lang?: string;
    [k: string]: any;
};

export class BraveSearchHTTP {
    constructor(
        protected apiKey: string,
    ) { }

    async webSearch(query: WebSearchQueryParams, options?: { headers?: Record<string, string> }) {
        if (!this.apiKey) {
            throw new Error('BRAVE_SEARCH_API_KEY is required for Brave search.');
        }

        const url = new URL('https://api.search.brave.com/res/v1/web/search');
        for (const [key, value] of Object.entries(query)) {
            if (value === undefined || value === null) {
                continue;
            }
            url.searchParams.set(key, `${value}`);
        }

        const response = await fetch(url, {
            headers: {
                Accept: 'application/json',
                'X-Subscription-Token': this.apiKey,
                ...(options?.headers || {}),
            },
        });

        if (!response.ok) {
            const text = await response.text();
            const err: any = new Error(`Brave search failed: ${response.status} ${response.statusText} ${text}`.trim());
            err.status = response.status;
            throw err;
        }

        return {
            parsed: await response.json(),
        };
    }
}

