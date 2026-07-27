import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import adminRoutes from './routes/admin';
import trendsRoutes, { categoriesRouter } from './routes/trends';
import usersRoutes from './routes/users';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// 헬스체크: DB 연결 없이도 항상 응답 (배포 환경 liveness probe용)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'trendpick-backend', time: new Date().toISOString() });
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
}

export default app;
