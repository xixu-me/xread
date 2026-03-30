export class CloudFlareHTTP {
  constructor(
    protected accountId?: string,
    protected apiKey?: string,
  ) {}

  async fetchBrowserRenderedHTML(input: { url: string }) {
    if (!(this.accountId && this.apiKey)) {
      throw new Error(
        "CLOUD_FLARE_API_KEY must be configured as ACCOUNT_ID:API_KEY for browser rendering.",
      );
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/browser-rendering/fetch`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(input),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      const err: any = new Error(
        `Cloudflare browser rendering failed: ${response.status} ${response.statusText} ${text}`.trim(),
      );
      err.status = response.status;
      throw err;
    }

    return {
      parsed: (await response.json()) as any,
    };
  }
}
