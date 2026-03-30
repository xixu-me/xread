import {
  Also,
  AuthenticationRequiredError,
  AutoCastable,
  RPC_CALL_ENVIRONMENT,
} from "civkit/civ-rpc";
import { htmlEscape } from "civkit/escape";
import { Prop } from "civkit";

import type { Context } from "koa";

import { InjectProperty } from "../services/registry";
import { AsyncLocalContext } from "../services/async-context";
import { RateLimitDesc } from "../shared/services/rate-limit";

const ANONYMOUS_USER_ID = "anonymous";

export class ApiTokenAccount extends AutoCastable {
  @Prop()
  user_id = ANONYMOUS_USER_ID;

  @Prop()
  full_name = "Anonymous";

  @Prop()
  wallet = {
    total_balance: Number.MAX_SAFE_INTEGER,
  };

  @Prop()
  metadata: Record<string, any> = {
    speed_level: "0",
  };

  @Prop()
  customRateLimits?: Record<string, RateLimitDesc[]>;

  @Prop()
  lastSyncedAt = new Date();
}

@Also({
  openapi: {
    operation: {
      parameters: {
        Authorization: {
          description:
            htmlEscape`Optional API token for compatibility.\n\n` +
            htmlEscape`- Member of <AuthDTO>\n\n` +
            `- Authorization: Bearer {YOUR_XREAD_TOKEN}`,
          in: "header",
          schema: {
            anyOf: [{ type: "string", format: "token" }],
          },
        },
      },
    },
  },
})
export class AuthDTO extends AutoCastable {
  uid?: string;
  bearerToken?: string;
  user?: ApiTokenAccount;

  @InjectProperty(AsyncLocalContext)
  ctxMgr!: AsyncLocalContext;

  static override from(input: any) {
    const instance = super.from(input) as AuthDTO;
    const ctx = input[RPC_CALL_ENVIRONMENT] as Context | undefined;

    if (ctx) {
      const authorization = ctx.get("authorization");
      if (authorization) {
        instance.bearerToken = authorization.split(" ")[1] || authorization;
      }
    }

    if (!instance.bearerToken && input._token) {
      instance.bearerToken = input._token;
    }

    return instance;
  }

  protected buildLocalAccount() {
    const tokenSuffix = this.bearerToken ? this.bearerToken.slice(-8) : "";
    const userId = this.bearerToken
      ? `token:${tokenSuffix || "local"}`
      : ANONYMOUS_USER_ID;

    return ApiTokenAccount.from({
      user_id: userId,
      full_name: this.bearerToken ? "Local Token User" : "Anonymous",
      wallet: {
        total_balance: Number.MAX_SAFE_INTEGER,
      },
      metadata: {
        speed_level: this.bearerToken ? "1" : "0",
      },
      lastSyncedAt: new Date(),
    });
  }

  async getBrief() {
    const account = this.buildLocalAccount();
    this.user = account;
    this.uid = this.bearerToken ? account.user_id : undefined;

    return account;
  }

  async reportUsage(
    _tokenCount: number,
    _mdl: string,
    _endpoint: string = "/encode",
  ) {
    return undefined;
  }

  async solveUID() {
    if (this.uid) {
      this.ctxMgr.set("uid", this.uid);
      return this.uid;
    }

    if (this.bearerToken) {
      await this.getBrief();
      this.ctxMgr.set("uid", this.uid);
      return this.uid;
    }

    return undefined;
  }

  async assertUID() {
    const uid = await this.solveUID();

    if (!uid) {
      throw new AuthenticationRequiredError("Authentication failed");
    }

    return uid;
  }

  async assertUser() {
    if (this.user) {
      return this.user;
    }

    return this.getBrief();
  }

  async assertTier(_n: number, _feature?: string) {
    return true;
  }

  getRateLimits(...tags: string[]) {
    const descs = tags
      .map((tag) => this.user?.customRateLimits?.[tag] || [])
      .flat()
      .filter((item) => item.isEffective());

    if (descs.length) {
      return descs;
    }

    return undefined;
  }
}
