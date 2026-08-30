import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Wraps async controllers so rejected promises reach the Express error middleware. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}
