type SearchVariant = 'search' | 'images' | 'news';

export type SerperSearchQueryParams = {
    q: string;
    page?: number;
    num?: number;
    start?: number;
    gl?: string;
    hl?: string;
    location?: string;
    [k: string]: any;
};

export type SerperWebSearchResponse = {
    organic: Array<Record<string, any>>;
};

export type SerperImageSearchResponse = {
    images: Array<Record<string, any>>;
};

export type SerperNewsSearchResponse = {
    news: Array<Record<string, any>>;
};

export const WORLD_COUNTRIES: Record<string, string> = {
    US: 'United States',
    CN: 'China',
    JP: 'Japan',
    DE: 'Germany',
    FR: 'France',
    GB: 'United Kingdom',
    IN: 'India',
    CA: 'Canada',
    AU: 'Australia',
    SG: 'Singapore',
};

export const WORLD_LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'de', name: 'German' },
    { code: 'fr', name: 'French' },
    { code: 'es', name: 'Spanish' },
];

class SerperBaseHTTP {
    constructor(
        protected apiKey: string,
        protected provider: 'google' | 'bing',
    ) { }

    protected getBaseUrl(variant: SearchVariant) {
        const host = this.provider === 'bing' ? 'https://bing.serper.dev' : 'https://google.serper.dev';
        return `${host}/${variant}`;
    }

    protected async request<T>(variant: SearchVariant, query: SerperSearchQueryParams) {
        if (!this.apiKey) {
            throw new Error(`SERPER_SEARCH_API_KEY is required for ${this.provider} ${variant} search.`);
        }

        const response = await fetch(this.getBaseUrl(variant), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': this.apiKey,
            },
            body: JSON.stringify(query),
        });

        if (!response.ok) {
            const text = await response.text();
            const err: any = new Error(`Serper ${this.provider} ${variant} search failed: ${response.status} ${response.statusText} ${text}`.trim());
            err.status = response.status;
            throw err;
        }

        return response.json() as Promise<T>;
    }

    async webSearch(query: SerperSearchQueryParams) {
        const parsed = await this.request<SerperWebSearchResponse>('search', query);

        return { parsed };
    }

    async imageSearch(query: SerperSearchQueryParams) {
        const parsed = await this.request<SerperImageSearchResponse>('images', query);

        return { parsed };
    }

    async newsSearch(query: SerperSearchQueryParams) {
        const parsed = await this.request<SerperNewsSearchResponse>('news', query);

        return { parsed };
    }
}

export class SerperGoogleHTTP extends SerperBaseHTTP {
    constructor(apiKey: string) {
        super(apiKey, 'google');
    }
}

export class SerperBingHTTP extends SerperBaseHTTP {
    constructor(apiKey: string) {
        super(apiKey, 'bing');
    }
}

