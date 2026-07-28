/**
 * 관리자 권한 부여 스크립트
 *
 * 사용법:
 *   npm run grant:admin -- gyumin3789@gmail.com
 *   npm run grant:admin -- someone@example.com editor
 *
 * 왜 스크립트인가:
 *   권한 부여를 API로 열어두면 "누가 그 API를 부를 수 있나"라는 순환 문제가 생긴다.
 *   첫 관리자는 DB에 직접 접근할 수 있는 사람이 만들어야 한다.
 *
 * 대상 계정은 먼저 회원가입이 되어 있어야 한다 (auth.users에 존재해야 함).
 */

import { query } from '../db/client';

const VALID_ROLES = ['owner', 'editor', 'admin'] as const;
type Role = (typeof VALID_ROLES)[number];

async function main() {
  const email = process.argv[2];
  const role = (process.argv[3] ?? 'admin') as Role;

  if (!email) {
    console.error('사용법: npm run grant:admin -- <이메일> [owner|editor|admin]');
    process.exit(1);
  }
  if (!VALID_ROLES.includes(role)) {
    console.error(`role은 ${VALID_ROLES.join(' | ')} 중 하나여야 합니다. (입력: ${role})`);
    process.exit(1);
  }

  // auth.users에서 계정을 찾는다. 프로필(public.users)은 첫 로그인 시 생성되므로
  // 아직 없을 수 있어 여기서 함께 만들어준다.
  const accounts = await query<{ id: string; email: string }>(
    `SELECT id, email FROM auth.users WHERE email = $1`,
    [email]
  );

  if (accounts.length === 0) {
    console.error(`"${email}" 계정을 찾을 수 없습니다. 먼저 회원가입을 해주세요.`);
    process.exit(1);
  }

  const account = accounts[0];

  const [updated] = await query<{ id: string; email: string | null; role: string }>(
    `INSERT INTO users (id, email, role) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role
     RETURNING id, email, role`,
    [account.id, account.email, role]
  );

  console.log(`완료: ${updated.email} -> role="${updated.role}"`);
  console.log('로그인 중이었다면 토큰을 새로 받아야 반영됩니다(로그아웃 후 재로그인).');
  process.exit(0);
}

main().catch((err) => {
  console.error('실패:', err instanceof Error ? err.message : err);
  process.exit(1);
});
