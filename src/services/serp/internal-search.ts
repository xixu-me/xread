import { singleton } from "tsyringe";
import { GlobalLogger } from "../logger";
import { AsyncService } from "civkit/async-service";
import { SerperSearchQueryParams } from "../../shared/3rd-party/serper-search";
import { ServiceDisabledError } from "../errors";
import { WebSearchEntry } from "./compat";

@singleton()
export class InternalSearchService extends AsyncService {
  logger = this.globalLogger.child({ service: this.constructor.name });

  constructor(protected globalLogger: GlobalLogger) {
    super(...arguments);
  }

  override async init() {
    await this.dependencyReady();
    this.emit("ready");
  }

  protected disabled(): never {
    throw new ServiceDisabledError(
      "Internal search provider is not available in this standalone build. Use a public provider such as google, bing, or serper.",
    );
  }

  async doSearch(
    _variant: "web" | "images" | "news",
    _query: SerperSearchQueryParams,
  ) {
    this.disabled();
  }

  async webSearch(_query: SerperSearchQueryParams) {
    return this.disabled() as WebSearchEntry[];
  }

  async imageSearch(_query: SerperSearchQueryParams) {
    return this.disabled() as WebSearchEntry[];
  }

  async newsSearch(_query: SerperSearchQueryParams) {
    return this.disabled() as WebSearchEntry[];
  }
}
