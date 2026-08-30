import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, infer as ZodInfer } from 'zod';

type Source = 'body' | 'query' | 'params';

/**
 * Validates and *replaces* the given request section with the parsed result, so controllers get
 * fully typed, coerced data.
 */
export function validate<T extends ZodTypeAny>(schema: T, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(result.error);
      return;
    }
    if (source === 'query') {
      // Express 5 exposes req.query as a getter; attach parsed data separately.
      (req as Request & { validatedQuery?: unknown }).validatedQuery = result.data;
    } else {
      req[source] = result.data as never;
    }
    next();
  };
}

export function validated<T>(req: Request): T {
  return ((req as Request & { validatedQuery?: unknown }).validatedQuery ?? req.query) as T;
}

export type Infer<T extends ZodTypeAny> = ZodInfer<T>;
