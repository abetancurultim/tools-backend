import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import apiRoutes from './routes/api.js';
import elevenLabsLibranzaRoutes from './routes/elevenLabsLibranzaRoutes.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({
  limit: '25mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use('/api/v1', apiRoutes);
app.use('/api/v1/elevenlabs/libranzas', elevenLabsLibranzaRoutes);

app.get('/health', (req, res) => res.send('Ultim Tools API is running 🚀'));

export default app;
