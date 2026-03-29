import { AsyncService } from 'civkit/async-service';
import { singleton } from 'tsyringe';

type EnvConfig = Record<string, string> & {
    readonly SERPER_SEARCH_API_KEY: string;
    readonly BRAVE_SEARCH_API_KEY: string;
    readonly CLOUD_FLARE_API_KEY: string;
    readonly LOCAL_PROXY_URLS: string;
    readonly STORAGE_ROOT: string;
};

export const readEnv = (key: string) => process.env[key] || '';

const envConfig = new Proxy({}, {
    get(_target, prop) {
        return readEnv(String(prop));
    },
}) as EnvConfig;

@singleton()
export class SecretExposer extends AsyncService {
    override async init() {
        await this.dependencyReady();
        this.emit('ready');
    }

    get SERPER_SEARCH_API_KEY() {
        return readEnv('SERPER_SEARCH_API_KEY');
    }

    get BRAVE_SEARCH_API_KEY() {
        return readEnv('BRAVE_SEARCH_API_KEY');
    }

    get CLOUD_FLARE_API_KEY() {
        return readEnv('CLOUD_FLARE_API_KEY');
    }

    get LOCAL_PROXY_URLS() {
        return readEnv('LOCAL_PROXY_URLS');
    }

    get STORAGE_ROOT() {
        return readEnv('STORAGE_ROOT');
    }
}

export default envConfig;
