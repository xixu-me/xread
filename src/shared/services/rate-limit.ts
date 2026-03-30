import { AsyncService } from "civkit/async-service";
import { ApplicationError, AutoCastable } from "civkit/civ-rpc";
import { singleton } from "tsyringe";
import { ApiRollRecord, API_CALL_STATUS } from "../db/api-roll";

type SubjectLimit = {
  at: number;
};

@singleton()
export class RateLimitControl extends AsyncService {
  protected hits = new Map<string, SubjectLimit[]>();

  override async init() {
    await this.dependencyReady();
    this.emit("ready");
  }

  protected prune(key: string, windowMs: number) {
    const now = Date.now();
    const entries = (this.hits.get(key) || []).filter(
      (entry) => now - entry.at < windowMs,
    );
    this.hits.set(key, entries);

    return entries;
  }

  protected async checkAndRecord(
    subject: string,
    tags: string[],
    descs: RateLimitDesc[],
  ) {
    const now = Date.now();
    for (const desc of descs) {
      const key = `${subject}:${tags.join(",")}:${desc.periodSeconds}:${desc.occurrence}`;
      const entries = this.prune(key, desc.periodSeconds * 1000);
      if (entries.length >= desc.occurrence) {
        const oldestRelevant = entries[0];
        const retryAfterMs = Math.max(
          1000,
          desc.periodSeconds * 1000 - (now - oldestRelevant.at),
        );
        throw RateLimitTriggeredError.from({
          message: `Rate limit exceeded for ${subject}`,
          retryAfter: Math.ceil(retryAfterMs / 1000),
          retryAfterDate: new Date(now + retryAfterMs),
        });
      }

      entries.push({ at: now });
      this.hits.set(key, entries);
    }
  }

  async simpleRPCUidBasedLimit(
    _rpcReflect: any,
    uid: string,
    tags: string[],
    ...descs: RateLimitDesc[]
  ) {
    const effectiveDescs = descs.length
      ? descs
      : [RateLimitDesc.from({ occurrence: 60, periodSeconds: 60 })];
    await this.checkAndRecord(`uid:${uid}`, tags, effectiveDescs);

    return ApiRollRecord.from({
      _id: `${Date.now()}-${Math.random()}`,
      uid,
      tags,
      status: API_CALL_STATUS.SUCCESS,
      createdAt: new Date(),
    });
  }

  async simpleRpcIPBasedLimit(
    _rpcReflect: any,
    ip: string,
    tags: string[],
    limits?: [Date, number] | Array<[Date, number]>,
  ) {
    const normalized = Array.isArray(limits?.[0])
      ? (limits as Array<[Date, number]>)
      : limits
        ? [limits as [Date, number]]
        : [];
    const descs = normalized.map(([date, occurrence]) => {
      const seconds = Math.max(
        1,
        Math.ceil((Date.now() - date.valueOf()) / 1000),
      );
      return RateLimitDesc.from({
        occurrence,
        periodSeconds: seconds,
      });
    });

    await this.checkAndRecord(
      `ip:${ip}`,
      tags,
      descs.length
        ? descs
        : [RateLimitDesc.from({ occurrence: 20, periodSeconds: 60 })],
    );

    return ApiRollRecord.from({
      _id: `${Date.now()}-${Math.random()}`,
      ip,
      tags,
      status: API_CALL_STATUS.SUCCESS,
      createdAt: new Date(),
    });
  }

  record(input: Partial<ApiRollRecord>) {
    return ApiRollRecord.from({
      createdAt: new Date(),
      status: API_CALL_STATUS.SUCCESS,
      ...input,
    });
  }
}

export class RateLimitDesc extends AutoCastable {
  occurrence!: number;
  periodSeconds!: number;

  isEffective() {
    return Boolean(this.occurrence && this.periodSeconds);
  }
}

export class RateLimitTriggeredError extends ApplicationError {
  retryAfter?: number;
  retryAfterDate?: Date;

  static override from(
    input: Partial<RateLimitTriggeredError> & { message?: string },
  ) {
    const err = new RateLimitTriggeredError(
      input.message || "Rate limit exceeded",
    );
    Object.assign(err, input);

    return err;
  }
}
