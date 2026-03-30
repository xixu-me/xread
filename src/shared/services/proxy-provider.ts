import { AsyncService } from "civkit/async-service";
import { singleton } from "tsyringe";
import { SecretExposer } from "./secrets";
import { ServiceDisabledError } from "../../services/errors";

@singleton()
export class ProxyProviderService extends AsyncService {
  protected proxies: URL[] = [];

  constructor(protected secretExposer: SecretExposer) {
    super(...arguments);
  }

  override async init() {
    await this.dependencyReady();
    this.proxies = this.secretExposer.LOCAL_PROXY_URLS.split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => new URL(x));
    this.emit("ready");
  }

  supports(input?: string) {
    if (!input || input === "auto" || input === "any" || input === "none") {
      return true;
    }

    return /^[a-z]{2}$/i.test(input);
  }

  isConfigured() {
    return this.proxies.length > 0;
  }

  async alloc(input?: string) {
    if (input === "none") {
      throw new ServiceDisabledError(
        `Proxy allocation is disabled for '${input}'.`,
      );
    }

    const picked = this.proxies[0];
    if (!picked) {
      throw new ServiceDisabledError(
        "Proxy allocation is not configured in this standalone build.",
      );
    }

    return picked;
  }

  async *iterAlloc(input?: string) {
    yield await this.alloc(input);
  }
}
