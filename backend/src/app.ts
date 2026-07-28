import path from 'path';

import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import adminRoutes from './routes/admin';
import trendsRoutes, { categoriesRouter } from './routes/trends';
import usersRoutes from './routes/users';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { scheduleDailyCollect } from './jobs/dailyCollect';

dotenv.config();

const app = express();

// CORS_ORIGIN이 있으면 그 도메인만 허용(쉼표로 여러 개), 없으면 전체 허용.
// 로컬 개발은 설정 안 해도 되고, 배포 시 프론트 도메인을 넣어 좁힌다.
const corsOrigin = process.env.CORS_ORIGIN?.trim();
app.use(
  cors(
    corsOrigin ? { origin: corsOrigin.split(',').map((o) => o.trim()) } : undefined
  )
);
app.use(express.json());

// 백엔드 단독 시연용 데모 페이지 (public/demo.html -> http://localhost:4000/demo.html)
// 같은 오리진에서 서빙되므로 데모 페이지는 CORS 없이 상대 경로로 API를 호출한다.
// __dirname은 dev(src/)와 build(dist/) 둘 다 backend/ 한 단계 아래라 '..'로 통일.
app.use(express.static(path.join(__dirname, '..', 'public')));

// 헬스체크: DB 연결 없이도 항상 응답 (배포 환경 liveness probe용)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'trendpick-backend', time: new Date().toISOString() });
});

// 루트로 들어온 사람에게 어디로 가야 하는지 알려준다.
// (API 서버라 루트에 화면은 없지만, 빈 404보다 안내가 낫다)
app.get('/', (_req, res) => {
  res.json({
    service: 'trendpick-backend',
    message: 'TrendPick 백엔드 API 서버입니다.',
    demo: '/demo.html',
    health: '/health',
    docs: 'https://github.com/madcamp-official/zuki/blob/main/backend/API.md',
    endpoints: ['/api/trends', '/api/categories', '/api/users/me/*', '/api/admin/*'],
  });
});

app.use('/api/trends', trendsRoutes);
app.use('/api/categories', categoriesRouter);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`[trendpick-backend] listening on http://localhost:${port}`);
  });
  scheduleDailyCollect();
}

export default app;
