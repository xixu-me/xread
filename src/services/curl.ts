import { AsyncService } from "civkit/async-service";
import { singleton } from "tsyringe";
import { parseString as parseSetCookieString } from "set-cookie-parser";

import { ScrappingOptions } from "./puppeteer";
import { GlobalLogger } from "./logger";
import { AssertionFailureError, FancyFile } from "civkit";
import { ServiceBadAttemptError } from "./errors";
import { TempFileManager } from "../services/temp-file";
import { AsyncLocalContext } from "./async-context";
import { BlackHoleDetector } from "./blackhole-detector";

type HeaderInfo = Record<
  string,
  string | string[] | { code: number; reason?: string } | undefined
>;

export interface CURLScrappingOptions extends ScrappingOptions {
  method?: string;
  body?: string | Buffer;
}

@singleton()
export class CurlControl extends AsyncService {
  logger = this.globalLogger.child({ service: this.constructor.name });

  chromeVersion = "132";
  safariVersion = "537.36";
  platform = "Linux";
  ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/${this.safariVersion} (KHTML, like Gecko) Chrome/${this.chromeVersion}.0.0.0 Safari/${this.safariVersion}`;

  lifeCycleTrack = new WeakMap();

  constructor(
    protected globalLogger: GlobalLogger,
    protected tempFileManager: TempFileManager,
    protected asyncLocalContext: AsyncLocalContext,
    protected blackHoleDetector: BlackHoleDetector,
  ) {
    super(...arguments);
  }

  override async init() {
    await this.dependencyReady();

    if (process.platform === "darwin") {
      this.platform = "macOS";
    } else if (process.platform === "win32") {
      this.platform = "Windows";
    }

    this.emit("ready");
  }

  impersonateChrome(ua: string) {
    this.chromeVersion = ua.match(/Chrome\/(\d+)/)?.[1] || this.chromeVersion;
    this.safariVersion =
      ua.match(/AppleWebKit\/([\d.]+)/)?.[1] || this.safariVersion;
    this.ua = ua;
  }

  protected buildHeaders(urlToCrawl: URL, crawlOpts?: CURLScrappingOptions) {
    const headers = new Headers();
    headers.set("User-Agent", crawlOpts?.overrideUserAgent || this.ua);
    headers.set(
      "Accept",
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    );
    headers.set("Accept-Encoding", "gzip, deflate, br");
    headers.set("Accept-Language", crawlOpts?.locale || "en-US,en;q=0.9");

    for (const [key, value] of Object.entries(crawlOpts?.extraHeaders || {})) {
      if (typeof value !== "undefined") {
        headers.set(key, `${value}`);
      }
    }

    if (crawlOpts?.referer) {
      headers.set("Referer", crawlOpts.referer);
    }

    if (crawlOpts?.cookies?.length) {
      const cookieKv: Record<string, string> = {};
      for (const cookie of crawlOpts.cookies) {
        cookieKv[cookie.name] = cookie.value;
      }
      for (const cookie of crawlOpts.cookies) {
        if (cookie.maxAge && cookie.maxAge < 0) {
          delete cookieKv[cookie.name];
          continue;
        }
        if (cookie.expires && cookie.expires < new Date()) {
          delete cookieKv[cookie.name];
          continue;
        }
        if (cookie.secure && urlToCrawl.protocol !== "https:") {
          delete cookieKv[cookie.name];
          continue;
        }
        if (cookie.domain && !urlToCrawl.hostname.endsWith(cookie.domain)) {
          delete cookieKv[cookie.name];
          continue;
        }
        if (cookie.path && !urlToCrawl.pathname.startsWith(cookie.path)) {
          delete cookieKv[cookie.name];
          continue;
        }
      }
      const cookieValue = Object.entries(cookieKv)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join("; ");
      if (cookieValue) {
        headers.set("Cookie", cookieValue);
      }
    }

    return headers;
  }

  protected async responseToFancyFile(response: Response, fileName?: string) {
    const ab = await response.arrayBuffer();
    const buffer = Buffer.from(ab);
    if (!buffer.length) {
      return undefined;
    }

    const tmpPath = this.tempFileManager.alloc();

    return FancyFile.auto(
      {
        fileBuffer: buffer,
        mimeType:
          response.headers.get("content-type") || "application/octet-stream",
        fileName,
        size: buffer.length,
      },
      tmpPath,
    );
  }

  protected headersToHeaderInfo(response: Response): HeaderInfo {
    const headerInfo: HeaderInfo = {
      result: {
        code: response.status,
        reason: response.statusText,
      },
    };

    response.headers.forEach((value, key) => {
      headerInfo[key] = value;
      headerInfo[
        key.replace(/(^|-)([a-z])/g, (_m, p1, p2) => `${p1}${p2.toUpperCase()}`)
      ] = value;
    });

    return headerInfo;
  }

  async urlToFile1Shot(urlToCrawl: URL, crawlOpts?: CURLScrappingOptions) {
    const response = await fetch(urlToCrawl, {
      method: crawlOpts?.method || (crawlOpts?.body ? "POST" : "GET"),
      headers: this.buildHeaders(urlToCrawl, crawlOpts),
      body: crawlOpts?.body as any,
      redirect: "manual",
      signal: AbortSignal.timeout(crawlOpts?.timeoutMs || 30_000),
    }).catch((err) => {
      throw new AssertionFailureError(
        `Failed to access ${urlToCrawl.origin}: ${err}`,
      );
    });

    const headerInfo = this.headersToHeaderInfo(response);
    const contentDisposition =
      response.headers.get("content-disposition") || "";
    const fileName =
      contentDisposition.match(/filename="([^"]+)"/i)?.[1] ||
      urlToCrawl.pathname.split("/").pop() ||
      "download.bin";
    const data =
      response.status >= 300 && response.status < 400
        ? undefined
        : await this.responseToFancyFile(response, fileName);

    return {
      statusCode: response.status,
      statusText: response.statusText,
      data,
      headers: [headerInfo],
    };
  }

  async urlToFile(urlToCrawl: URL, crawlOpts?: CURLScrappingOptions) {
    let leftRedirection = 6;
    let cookieRedirects = 0;
    let opts = { ...crawlOpts };
    let nextHopUrl = urlToCrawl;
    const fakeHeaderInfos: HeaderInfo[] = [];

    do {
      const r = await this.urlToFile1Shot(nextHopUrl, opts);

      if ([301, 302, 303, 307, 308].includes(r.statusCode)) {
        fakeHeaderInfos.push(...r.headers);
        const headers = r.headers[r.headers.length - 1];
        const location = (headers.Location || headers.location) as
          | string
          | undefined;
        const setCookieHeader = headers["Set-Cookie"] || headers["set-cookie"];
        if (setCookieHeader) {
          const cookieAssignments = Array.isArray(setCookieHeader)
            ? setCookieHeader
            : [setCookieHeader];
          const parsed = cookieAssignments
            .filter(Boolean)
            .map((x) => parseSetCookieString(`${x}`, { decodeValues: true }));
          if (parsed.length) {
            opts.cookies = [...(opts.cookies || []), ...parsed];
          }
          if (!location) {
            cookieRedirects += 1;
          }
        }

        if (!location && !setCookieHeader) {
          return {
            statusCode: r.statusCode,
            statusText: r.statusText,
            data: r.data,
            headers: fakeHeaderInfos.concat(r.headers),
          };
        }

        if (!location && cookieRedirects > 1) {
          throw new ServiceBadAttemptError(
            `Failed to access ${urlToCrawl}: Browser required to solve complex cookie preconditions.`,
          );
        }

        nextHopUrl = new URL(location || "", nextHopUrl);
        leftRedirection -= 1;
        continue;
      }

      return {
        statusCode: r.statusCode,
        statusText: r.statusText,
        data: r.data,
        headers: fakeHeaderInfos.concat(r.headers),
      };
    } while (leftRedirection > 0);

    throw new ServiceBadAttemptError(
      `Failed to access ${urlToCrawl}: Too many redirections.`,
    );
  }

  async sideLoad(targetUrl: URL, crawlOpts?: CURLScrappingOptions) {
    const curlResult = await this.urlToFile(targetUrl, crawlOpts);
    this.blackHoleDetector.itWorked();

    let finalURL = targetUrl;
    const sideLoadOpts: CURLScrappingOptions["sideLoad"] = {
      impersonate: {},
      proxyOrigin: {},
    };

    for (const headers of curlResult.headers) {
      sideLoadOpts.impersonate[finalURL.href] = {
        status: (headers.result as any)?.code || -1,
        headers: Object.fromEntries(
          Object.entries(headers).filter(([key]) => key !== "result"),
        ) as Record<string, string | string[]>,
        contentType:
          `${headers["Content-Type"] || headers["content-type"] || ""}` ||
          undefined,
      };
      if (crawlOpts?.proxyUrl) {
        sideLoadOpts.proxyOrigin[finalURL.origin] = crawlOpts.proxyUrl;
      }
      const code = (headers.result as any)?.code;
      if (code && [301, 302, 303, 307, 308].includes(code)) {
        const location = (headers.Location || headers.location) as
          | string
          | undefined;
        if (location) {
          finalURL = new URL(location, finalURL);
        }
      }
    }

    const lastHeaders = curlResult.headers[curlResult.headers.length - 1];
    const contentType =
      `${lastHeaders["Content-Type"] || lastHeaders["content-type"] || ""}`.toLowerCase() ||
      (await curlResult.data?.mimeType) ||
      "application/octet-stream";
    const contentDisposition =
      `${lastHeaders["Content-Disposition"] || lastHeaders["content-disposition"] || ""}` ||
      undefined;
    const fileName =
      contentDisposition?.match(/filename="([^"]+)"/i)?.[1] ||
      finalURL.pathname.split("/").pop();

    if (
      sideLoadOpts.impersonate[finalURL.href] &&
      (await curlResult.data?.size)
    ) {
      sideLoadOpts.impersonate[finalURL.href].body = curlResult.data;
    }

    this.lifeCycleTrack.set(this.asyncLocalContext.ctx, curlResult.data);

    return {
      finalURL,
      sideLoadOpts,
      chain: curlResult.headers,
      status: curlResult.statusCode,
      statusText: curlResult.statusText,
      headers: lastHeaders,
      contentType,
      contentDisposition,
      fileName,
      file: curlResult.data,
    };
  }
}
