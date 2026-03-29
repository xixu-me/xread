import { AsyncService } from 'civkit/async-service';
import { singleton } from 'tsyringe';
import { ServiceDisabledError } from '../../services/errors';

@singleton()
export class LLMManager extends AsyncService {
    override async init() {
        await this.dependencyReady();
        this.emit('ready');
    }

    async *iterRun(model: string, _input?: unknown): AsyncGenerator<string> {
        throw new ServiceDisabledError(`LLM feature '${model}' is not enabled in this standalone build.`);
    }
}
