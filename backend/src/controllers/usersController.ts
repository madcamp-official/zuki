import { Request, Response } from 'express';
import { query } from '../db/client';
import { ApiError } from '../middlewares/errorHandler';

// 인증은 requireAuth 미들웨어가 처리하고 req.user에 붙여준다.
// (Supabase JWT 또는 하위 호환용 x-user-id 헤더)
function requireUserId(req: Request): string {
  if (!req.user) {
    throw new ApiError(401, '로그인이 필요합니다.');
  }
  return req.user.id;
}

/**
 * GET /api/users/me : 내 프로필
 * 로그인 직후 프론트가 사용자 정보를 채우는 데 쓴다.
 * 프로필 행은 인증 미들웨어가 첫 요청 때 자동 생성한다.
 */
export async function getMyProfile(req: Request, res: Response) {
  const userId = requireUserId(req);

  const [profile] = await query(
    `SELECT id, email, store_name, region_si, region_gu, role, created_at
       FROM users WHERE id = $1`,
    [userId]
  );

  if (!profile) {
    throw new ApiError(404, '프로필을 찾을 수 없습니다.');
  }

  const interests = await query(
    `SELECT c.id, c.name, c.slug
       FROM user_category_interests uci
       JOIN categories c ON c.id = uci.category_id
      WHERE uci.user_id = $1
      ORDER BY c.sort_order`,
    [userId]
  );

  res.json({ user: profile, categoryInterests: interests });
}

/**
 * PATCH /api/users/me : 프로필 수정 (마이페이지)
 * 매장명과 지역만 수정 가능. role은 여기서 바꿀 수 없다(권한 상승 방지).
 */
export async function updateMyProfile(req: Request, res: Response) {
  const userId = requireUserId(req);
  const { storeName, regionSi, regionGu } = req.body as {
    storeName?: string;
    regionSi?: string;
    regionGu?: string;
  };

  const [updated] = await query(
    `UPDATE users
        SET store_name = COALESCE($2, store_name),
            region_si  = COALESCE($3, region_si),
            region_gu  = COALESCE($4, region_gu)
      WHERE id = $1
      RETURNING id, email, store_name, region_si, region_gu, role`,
    [userId, storeName ?? null, regionSi ?? null, regionGu ?? null]
  );

  if (!updated) {
    throw new ApiError(404, '프로필을 찾을 수 없습니다.');
  }

  res.json({ user: updated });
}

/** GET /api/users/me/bookmarks : 즐겨찾기 목록 (기획서 4-4) */
export async function listBookmarks(req: Request, res: Response) {
  const userId = requireUserId(req);
  const rows = await query(
    `SELECT t.id, t.title, t.summary, t.status, t.score, t.image_url, b.created_at AS bookmarked_at
       FROM bookmarks b
       JOIN trends t ON t.id = b.trend_id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC`,
    [userId]
  );
  res.json({ bookmarks: rows });
}

/** POST /api/users/me/bookmarks/:trendId : 즐겨찾기 추가 */
export async function addBookmark(req: Request, res: Response) {
  const userId = requireUserId(req);
  const { trendId } = req.params;

  await query(
    `INSERT INTO bookmarks (user_id, trend_id) VALUES ($1, $2)
     ON CONFLICT (user_id, trend_id) DO NOTHING`,
    [userId, trendId]
  );

  res.status(201).json({ ok: true });
}

/** DELETE /api/users/me/bookmarks/:trendId : 즐겨찾기 해제 */
export async function removeBookmark(req: Request, res: Response) {
  const userId = requireUserId(req);
  const { trendId } = req.params;

  await query(`DELETE FROM bookmarks WHERE user_id = $1 AND trend_id = $2`, [userId, trendId]);

  res.status(204).send();
}

/** PUT /api/users/me/category-interests : 관심 카테고리 설정 (기획서 13, 마이페이지) */
export async function setCategoryInterests(req: Request, res: Response) {
  const userId = requireUserId(req);
  const { categoryIds } = req.body as { categoryIds: number[] };

  if (!Array.isArray(categoryIds)) {
    throw new ApiError(400, 'categoryIds는 배열이어야 합니다.');
  }

  const pool = (await import('../db/client')).getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_category_interests WHERE user_id = $1', [userId]);
    for (const categoryId of categoryIds) {
      await client.query(
        'INSERT INTO user_category_interests (user_id, category_id) VALUES ($1, $2)',
        [userId, categoryId]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json({ ok: true, categoryIds });
}
