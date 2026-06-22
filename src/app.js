import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import apiRoutes from './routes/api.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({
  limit: '25mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use('/api/v1', apiRoutes);

app.get('/health', (req, res) => res.send('Ultim Tools API is running 🚀'));

export default app;
