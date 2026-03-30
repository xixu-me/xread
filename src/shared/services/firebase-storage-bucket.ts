import { AsyncService } from "civkit/async-service";
import { singleton } from "tsyringe";
import os from "os";
import path from "path";
import fs from "fs/promises";
import { pathToFileURL } from "url";
import { SecretExposer } from "./secrets";

type SaveOptions = {
  contentType?: string;
  metadata?: {
    contentType?: string;
  };
};

@singleton()
export class FirebaseStorageBucketControl extends AsyncService {
  rootDir!: string;

  constructor(protected secretExposer: SecretExposer) {
    super(...arguments);
  }

  override async init() {
    await this.dependencyReady();
    this.rootDir = await this.resolveWritableRoot(
      this.secretExposer.STORAGE_ROOT || ".cache/xread/storage",
    );
    this.emit("ready");
  }

  protected async resolveWritableRoot(preferredRoot: string) {
    const preferred = path.resolve(preferredRoot);
    const fallback = path.join(os.tmpdir(), "xread", "storage");

    for (const candidate of [preferred, fallback]) {
      try {
        await fs.mkdir(candidate, { recursive: true });
        const probe = path.join(candidate, `.write-test-${process.pid}`);
        await fs.writeFile(probe, "");
        await fs.rm(probe, { force: true });

        if (candidate !== preferred) {
          console.warn(
            `[xread] Storage root ${preferred} is not writable, falling back to ${candidate}`,
          );
        }

        return candidate;
      } catch {
        continue;
      }
    }

    throw new Error(
      `Neither preferred nor fallback storage roots are writable: ${preferred}`,
    );
  }

  protected resolvePath(key: string) {
    const safeKey = key.replace(/\\/g, "/").replace(/^\/+/, "");
    return path.resolve(this.rootDir, safeKey);
  }

  async saveFile(
    key: string,
    content: Buffer | Uint8Array,
    _options?: SaveOptions,
  ) {
    const fullPath = this.resolvePath(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);

    return { fullPath };
  }

  async downloadFile(key: string) {
    return fs.readFile(this.resolvePath(key));
  }

  async signDownloadUrl(key: string, _expiresAt?: number) {
    return pathToFileURL(this.resolvePath(key)).href;
  }
}
