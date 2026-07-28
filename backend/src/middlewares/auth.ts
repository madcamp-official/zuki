import { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { query } from '../db/client';
import { ApiError } from './errorHandler';

/**
 * Supabase Auth 토큰 검증
 *
 * 프론트엔드가 Supabase 클라이언트로 로그인하면 access token(JWT)을 받는다.
 * 그 토큰을 Authorization: Bearer <token> 헤더로 보내면 여기서 검증한다.
 *
 * 검증 방식:
 *   우리 프로젝트는 ES256(비대칭 키)으로 서명한다. 공개키를 JWKS 엔드포인트에서
 *   가져와 로컬에서 검증하므로, 요청마다 Supabase에 물어볼 필요가 없다.
 *   jose의 createRemoteJWKSet이 키를 캐시하고 자동 갱신한다.
 *
 *   HS256(대칭 키, 구 방식)을 쓰는 프로젝트를 위해 SUPABASE_JWT_SECRET
 *   폴백도 남겨둔다.
 */

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error(
        'SUPABASE_URL이 설정되지 않았습니다. (예: https://xxxx.supabase.co)'
      );
    }
    jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

export interface AuthUser {
  id: string;
  email: string | null;
  /** 우리 users 테이블의 role. 프로필이 아직 없으면 'user' */
  role: string;
}

// Express Request에 user를 붙이기 위한 타입 확장
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** JWT를 검증해 사용자 정보를 반환. 실패하면 null */
async function verifyToken(token: string): Promise<{ id: string; email: string | null } | null> {
  try {
    const secret = process.env.SUPABASE_JWT_SECRET;

    const { payload } = secret
      ? await jwtVerify(token, new TextEncoder().encode(secret))
      : await jwtVerify(token, getJwks());

    // Supabase JWT의 sub이 auth.users.id
    const id = typeof payload.sub === 'string' ? payload.sub : null;
    if (!id) return null;

    const email = typeof payload.email === 'string' ? payload.email : null;
    return { id, email };
  } catch {
    // 만료·위조·형식 오류 모두 인증 실패로 처리 (사유를 노출하지 않는다)
    return null;
  }
}

/**
 * users 테이블에 프로필이 없으면 만들어준다.
 *
 * public.users는 서비스 프로필(매장명·지역·권한)만 담고, 계정 자체는
 * auth.users가 관리한다. 두 테이블은 같은 id를 공유하며 FK로 묶여 있다.
 *
 * DB 트리거로 동기화하는 방법도 있지만, 첫 요청 때 만드는 방식이 더 단순하고
 * 가입 경로(이메일/카카오/관리자 생성)에 상관없이 동작한다.
 */
async function ensureProfile(id: string, email: string | null): Promise<string> {
  const rows = await query<{ role: string }>(
    `INSERT INTO users (id, email) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET email = COALESCE(EXCLUDED.email, users.email)
     RETURNING role`,
    [id, email]
  );
  // 스키마상 기본 역할은 'owner'(사장님). editor/admin은 수동 부여한다.
  return rows[0]?.role ?? 'owner';
}

/**
 * 인증 필수 미들웨어.
 *
 * Authorization: Bearer <Supabase access token> 만 받는다.
 * (이전의 x-user-id 임시 인증은 users.id가 auth.users를 참조하게 되면서
 *  실제 계정 없는 임의 UUID로는 프로필을 만들 수 없어 제거했다)
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.header('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      throw new ApiError(401, '로그인이 필요합니다. Authorization: Bearer <access_token> 헤더를 보내주세요.');
    }

    const verified = await verifyToken(authHeader.slice(7).trim());
    if (!verified) throw new ApiError(401, '유효하지 않거나 만료된 토큰입니다.');

    const role = await ensureProfile(verified.id, verified.email);
    req.user = { id: verified.id, email: verified.email, role };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * 인증 선택 미들웨어 — 토큰이 있으면 사용자를 붙이고, 없어도 통과시킨다.
 * 로그인 여부에 따라 응답이 달라지는 공개 API에서 쓴다
 * (예: 트렌드 목록에 즐겨찾기 여부를 함께 표시).
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.header('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const verified = await verifyToken(authHeader.slice(7).trim());
      if (verified) {
        const role = await ensureProfile(verified.id, verified.email);
        req.user = { id: verified.id, email: verified.email, role };
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

/** 관리자 전용 라우트 보호. requireAuth 다음에 붙여 쓴다. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new ApiError(401, '로그인이 필요합니다.'));
  if (req.user.role !== 'admin' && req.user.role !== 'editor') {
    return next(new ApiError(403, '관리자 권한이 필요합니다.'));
  }
  next();
}
