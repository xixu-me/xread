import { singleton } from "tsyringe";
import { AsyncService } from "civkit/async-service";
import { GlobalLogger } from "../logger";
import { JSDomControl } from "../jsdom";
import { WebSearchEntry } from "./compat";
import { ServiceBadApproachError, ServiceBadAttemptError } from "../errors";

function decodeDuckDuckGoTarget(href: string) {
  try {
    const url = new URL(href, "https://html.duckduckgo.com");
    const actual = url.searchParams.get("uddg");
    if (actual) {
      return decodeURIComponent(actual);
    }
    return url.toString();
  } catch {
    return href;
  }
}

function isAdLikeDuckDuckGoTarget(target: string) {
  try {
    const url = new URL(target);
    if (url.hostname === "duckduckgo.com" && url.pathname === "/y.js") {
      return true;
    }
    return (
      url.searchParams.has("ad_domain") || url.searchParams.has("ad_provider")
    );
  } catch {
    return /ad_domain=|ad_provider=/.test(target);
  }
}

@singleton()
export class StandaloneSearchFallbackService extends AsyncService {
  logger = this.globalLogger.child({ service: this.constructor.name });

  constructor(
    protected globalLogger: GlobalLogger,
    protected jsDomControl: JSDomControl,
  ) {
    super(...arguments);
  }

  override async init() {
    await this.dependencyReady();
    this.emit("ready");
  }

  async webSearch(query: { [k: string]: any }) {
    const url = new URL("https://html.duckduckgo.com/html/");
    url.searchParams.set("q", query.q || "");

    const response = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
        "accept-language": query.hl || "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(20_000),
    }).catch((err) => {
      throw new ServiceBadAttemptError(
        `DuckDuckGo HTML fallback failed: ${err instanceof Error ? err.message : err}`,
      );
    });

    if (!response.ok) {
      throw new ServiceBadAttemptError(
        `DuckDuckGo HTML fallback returned ${response.status}`,
      );
    }

    const html = await response.text();
    const { document } = this.jsDomControl.linkedom.parseHTML(html).window;
    const nodes = Array.from(
      document.querySelectorAll(".result:not(.result--ad)"),
    );
    const results = nodes
      .map((node) => {
        const linkElem = node.querySelector(
          ".result__title a[href], .result__a[href]",
        );
        const title = linkElem?.textContent?.replace(/\s+/g, " ").trim();
        const href = linkElem?.getAttribute("href");

        if (!title || !href) {
          return undefined;
        }

        const link = decodeDuckDuckGoTarget(href);
        if (isAdLikeDuckDuckGoTarget(link)) {
          return undefined;
        }

        const snippet = node
          .querySelector(".result__snippet, .result-snippet")
          ?.textContent?.replace(/\s+/g, " ")
          .trim();
        const source = node
          .querySelector(".result__url, .result__extras__url")
          ?.textContent?.replace(/\s+/g, " ")
          .trim();

        return {
          link,
          title,
          snippet: snippet || undefined,
          source: source || undefined,
          variant: "web",
        } as WebSearchEntry;
      })
      .filter(Boolean) as WebSearchEntry[];

    if (!results.length) {
      throw new ServiceBadAttemptError(
        "DuckDuckGo HTML fallback returned no results.",
      );
    }

    return results.slice(0, query.num || 10);
  }

  async newsSearch() {
    throw new ServiceBadApproachError(
      "Standalone HTML fallback does not support news search.",
    );
  }

  async imageSearch() {
    throw new ServiceBadApproachError(
      "Standalone HTML fallback does not support image search.",
    );
  }
}
