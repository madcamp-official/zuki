import { Request, Response } from 'express';
import { query } from '../db/client';
import { ApiError } from '../middlewares/errorHandler';

// 인증(Supabase Auth) 연동 전까지는 요청 헤더의 x-user-id를 임시로 사용한다.
// 실제 인증 미들웨어가 들어오면 이 부분을 req.user.id 로 교체할 것.
function requireUserId(req: Request): string {
  const userId = req.header('x-user-id');
  if (!userId) {
    throw new ApiError(401, 'x-user-id 헤더가 필요합니다 (임시 인증, Supabase Auth 연동 전).');
  }
  return userId;
}

/** GET /api/users/me/bookmarks : 즐겨찾기 목록 (기획서 4-4) */
export async function listBookmarks(req: Request, res: Response) {
  const userId = requireUserId(req);
  const rows = await query(
    `SELECT t.id, t.title, t.summary, t.status, t.image_url, b.created_at AS bookmarked_at
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
