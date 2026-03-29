import { AsyncService } from 'civkit/async-service';
import { singleton } from 'tsyringe';
import { ServiceDisabledError } from '../../services/errors';

@singleton()
export class ImageInterrogationManager extends AsyncService {
    override async init() {
        await this.dependencyReady();
        this.emit('ready');
    }

    async interrogate(model: string, _input?: unknown): Promise<string> {
        throw new ServiceDisabledError(`Image interrogation feature '${model}' is not enabled in this standalone build.`);
    }
}
