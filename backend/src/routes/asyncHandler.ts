import { NextFunction, Request, RequestHandler, Response } from 'express';

// Express 4는 async 핸들러에서 던진 에러를 자동으로 next()에 넘기지 않는다.
// 컨트롤러마다 try/catch를 반복하지 않도록 공통 래퍼로 처리한다.
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
