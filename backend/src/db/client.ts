import { Pool } from 'pg';

// DATABASE_URL이 없으면(로컬 초기 세팅 단계 등) 앱 자체는 뜨되,
// 실제 쿼리 시점에 에러가 나도록 지연 생성한다. 헬스체크 등 DB 없이도
// 동작해야 하는 라우트가 있기 때문에 부팅 시 즉시 연결하지 않는다.
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL이 설정되지 않았습니다. .env 파일을 확인하세요 (.env.example 참고).'
      );
    }
    pool = new Pool({
      connectionString,
      // Supabase는 기본적으로 SSL 필요. 로컬 개발 DB는 .env에서 sslmode=disable로 끌 수 있음
      ssl: connectionString.includes('sslmode=disable')
        ? false
        : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function query<T = any>(text: string, params?: unknown[]): Promise<T[]> {
  const { rows } = await getPool().query(text, params);
  return rows;
}
