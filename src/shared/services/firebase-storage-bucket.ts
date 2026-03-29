import { AsyncService } from 'civkit/async-service';
import { singleton } from 'tsyringe';
import path from 'path';
import fs from 'fs/promises';
import { pathToFileURL } from 'url';
import { SecretExposer } from './secrets';

type SaveOptions = {
    contentType?: string;
    metadata?: {
        contentType?: string;
    };
};

@singleton()
export class FirebaseStorageBucketControl extends AsyncService {
    rootDir!: string;

    constructor(
        protected secretExposer: SecretExposer,
    ) {
        super(...arguments);
    }

    override async init() {
        await this.dependencyReady();
        this.rootDir = path.resolve(this.secretExposer.STORAGE_ROOT || '.cache/xread/storage');
        await fs.mkdir(this.rootDir, { recursive: true });
        this.emit('ready');
    }

    protected resolvePath(key: string) {
        const safeKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
        return path.resolve(this.rootDir, safeKey);
    }

    async saveFile(key: string, content: Buffer | Uint8Array, _options?: SaveOptions) {
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

