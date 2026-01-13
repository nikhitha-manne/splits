import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import { authRouter } from './routes/auth';
import { authMiddleware } from './middleware/authMiddleware';
import { userRouter } from './routes/user';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/user', authMiddleware, userRouter);

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
