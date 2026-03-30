import { AutoCastable } from "civkit/civ-rpc";
import { randomUUID } from "crypto";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";

type WhereOp = "==" | ">=" | "<=" | ">" | "<";
type OrderDirection = "asc" | "desc";

type IncrementOp = {
  __op: "increment";
  value: number;
};

type QueryFilter = {
  field: string;
  op: WhereOp;
  value: any;
};

type QueryOrder = {
  field: string;
  direction: OrderDirection;
};

function reviveJson(_key: string, value: any) {
  if (value && typeof value === "object" && value.__type === "Date") {
    return new Date(value.value);
  }

  return value;
}

function serializeJson(_key: string, value: any) {
  if (value instanceof Date) {
    return {
      __type: "Date",
      value: value.toISOString(),
    };
  }

  return value;
}

function getByPath(input: any, pathText: string) {
  return pathText.split(".").reduce((acc, key) => acc?.[key], input);
}

function setByPath(input: any, pathText: string, value: any) {
  const parts = pathText.split(".");
  const last = parts.pop()!;
  let cursor = input;
  for (const part of parts) {
    cursor[part] ??= {};
    cursor = cursor[part];
  }

  cursor[last] = value;
}

function applyPatch(base: any, patch: any) {
  const draft = structuredClone(base || {});

  for (const [key, value] of Object.entries(patch || {})) {
    const currentValue = getByPath(draft, key);
    if (
      value &&
      typeof value === "object" &&
      (value as IncrementOp).__op === "increment"
    ) {
      setByPath(
        draft,
        key,
        (Number(currentValue) || 0) + (value as IncrementOp).value,
      );
      continue;
    }

    setByPath(draft, key, value);
  }

  return draft;
}

class LocalStore {
  rootDir = path.resolve(process.env.LOCAL_DB_ROOT || ".cache/xread/db");

  constructor() {
    fs.mkdirSync(this.rootDir, { recursive: true });
  }

  filePath(collectionName: string) {
    return path.join(this.rootDir, `${collectionName}.json`);
  }

  async readCollection(collectionName: string) {
    const filePath = this.filePath(collectionName);
    try {
      const content = await fsp.readFile(filePath, "utf8");
      return JSON.parse(content, reviveJson) as Record<string, any>;
    } catch (err: any) {
      if (err?.code === "ENOENT") {
        return {};
      }
      throw err;
    }
  }

  async writeCollection(collectionName: string, payload: Record<string, any>) {
    const filePath = this.filePath(collectionName);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(
      filePath,
      JSON.stringify(payload, serializeJson, 2),
      "utf8",
    );
  }
}

const LOCAL_STORE = new LocalStore();

export class LocalDocRef<
  T extends typeof FirestoreRecord = typeof FirestoreRecord,
> {
  constructor(
    protected recordType: T,
    readonly id: string,
  ) {}

  async get() {
    const bucket = await LOCAL_STORE.readCollection(
      this.recordType.collectionName,
    );
    const raw = bucket[this.id];
    if (!raw) {
      return undefined;
    }

    return this.recordType.from(raw);
  }

  async set(payload: any, options?: { merge?: boolean }) {
    const bucket = await LOCAL_STORE.readCollection(
      this.recordType.collectionName,
    );
    const previous = bucket[this.id];
    const merged = options?.merge
      ? applyPatch(previous, payload)
      : { ...payload };
    merged._id ??= this.id;
    bucket[this.id] = merged;
    await LOCAL_STORE.writeCollection(this.recordType.collectionName, bucket);

    return this.recordType.from(merged);
  }

  async update(payload: any) {
    const bucket = await LOCAL_STORE.readCollection(
      this.recordType.collectionName,
    );
    const previous = bucket[this.id] || { _id: this.id };
    const merged = applyPatch(previous, payload);
    merged._id ??= this.id;
    bucket[this.id] = merged;
    await LOCAL_STORE.writeCollection(this.recordType.collectionName, bucket);

    return this.recordType.from(merged);
  }
}

export class LocalQuery<
  T extends typeof FirestoreRecord = typeof FirestoreRecord,
> {
  constructor(
    protected recordType: T,
    protected filters: QueryFilter[] = [],
    protected orders: QueryOrder[] = [],
    protected limitCount?: number,
  ) {}

  where(field: string, op: WhereOp, value: any) {
    return new LocalQuery(
      this.recordType,
      [...this.filters, { field, op, value }],
      this.orders,
      this.limitCount,
    );
  }

  orderBy(field: string, direction: OrderDirection = "asc") {
    return new LocalQuery(
      this.recordType,
      this.filters,
      [...this.orders, { field, direction }],
      this.limitCount,
    );
  }

  limit(count: number) {
    return new LocalQuery(this.recordType, this.filters, this.orders, count);
  }

  async exec() {
    const bucket = await LOCAL_STORE.readCollection(
      this.recordType.collectionName,
    );
    let values = Object.values(bucket);

    for (const filter of this.filters) {
      values = values.filter((entry) => {
        const left = getByPath(entry, filter.field);
        const right = filter.value;
        switch (filter.op) {
          case "==":
            return left === right;
          case ">=":
            return left >= right;
          case "<=":
            return left <= right;
          case ">":
            return left > right;
          case "<":
            return left < right;
          default:
            return false;
        }
      });
    }

    for (const order of this.orders.slice().reverse()) {
      values.sort((a, b) => {
        const left = getByPath(a, order.field);
        const right = getByPath(b, order.field);
        const factor = order.direction === "desc" ? -1 : 1;
        if (left === right) {
          return 0;
        }

        return left > right ? factor : -factor;
      });
    }

    if (typeof this.limitCount === "number") {
      values = values.slice(0, this.limitCount);
    }

    return values.map((entry) => this.recordType.from(entry));
  }
}

export class LocalCollectionRef<
  T extends typeof FirestoreRecord = typeof FirestoreRecord,
> extends LocalQuery<T> {
  constructor(recordType: T) {
    super(recordType);
  }

  doc(id?: string) {
    return new LocalDocRef(this.recordType, id || randomUUID());
  }
}

class LocalBatch {
  protected tasks: Array<() => Promise<unknown>> = [];

  set(ref: LocalDocRef, payload: any, options?: { merge?: boolean }) {
    this.tasks.push(() => ref.set(payload, options));
  }

  update(ref: LocalDocRef, payload: any) {
    this.tasks.push(() => ref.update(payload));
  }

  async commit() {
    await Promise.all(this.tasks.map((task) => task()));
  }
}

class LocalTransaction {
  async get(ref: LocalDocRef) {
    return ref.get();
  }

  set(ref: LocalDocRef, payload: any, options?: { merge?: boolean }) {
    return ref.set(payload, options);
  }

  update(ref: LocalDocRef, payload: any) {
    return ref.update(payload);
  }
}

class LocalDB {
  batch() {
    return new LocalBatch();
  }

  async runTransaction<T>(
    handler: (transaction: LocalTransaction) => Promise<T>,
  ) {
    return handler(new LocalTransaction());
  }
}

const LOCAL_DB = new LocalDB();

export class FirestoreRecord extends AutoCastable {
  static collectionName = "records";

  _id!: string;

  static get COLLECTION() {
    return new LocalCollectionRef(this);
  }

  static get DB() {
    return LOCAL_DB;
  }

  static OPS = {
    increment(value: number): IncrementOp {
      return {
        __op: "increment",
        value,
      };
    },
  };

  static async fromFirestore<T extends typeof FirestoreRecord>(
    this: T,
    id: string,
  ) {
    if (!id) {
      return undefined;
    }

    return this.COLLECTION.doc(id).get() as Promise<
      InstanceType<T> | undefined
    >;
  }

  static async fromFirestoreQuery<T extends typeof FirestoreRecord>(
    this: T,
    query: LocalQuery<any>,
  ) {
    return query.exec() as Promise<Array<InstanceType<T>>>;
  }

  static async save<T extends typeof FirestoreRecord>(
    this: T,
    input: any,
    id?: string,
    options?: { merge?: boolean },
  ) {
    const payload =
      input instanceof this ? input.degradeForFireStore() : { ...input };
    const resolvedId = id || payload._id || randomUUID();
    payload._id = resolvedId;

    return this.COLLECTION.doc(resolvedId).set(payload, options) as Promise<
      InstanceType<T>
    >;
  }

  async save(options?: { merge?: boolean }) {
    return (this.constructor as typeof FirestoreRecord).save(
      this,
      this._id,
      options,
    );
  }

  degradeForFireStore() {
    return { ...this };
  }
}
