import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PORT } from './config/env.js';
import apiRoutes from './routes/api.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/v1', apiRoutes);

app.get('/', (req, res) => res.send('Ultim Tools API is running 🚀'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});