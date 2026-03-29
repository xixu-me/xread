import type { Context, Next } from 'koa';

export function getAuditionMiddleware() {
    return async (_ctx: Context, next: Next) => next();
}

