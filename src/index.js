import express from 'express';
import dotenv from 'dotenv';
import morgan from 'morgan';
import cors from 'cors';

import healthRouter from './routes/health.js';
import tenantsRouter from './routes/tenants.js';
import shopifyRouter from './routes/shopify.js';
import insightsRouter from './routes/insights.js';

// import cron (make sure src/cron/syncCron.js exists and exports nothing, it just schedules)
import './cron/sync.js';

dotenv.config();
const app = express();

app.use(morgan('dev'));
app.use(cors());

// Important: raw parser for webhooks path *before* express.json
app.use('/shopify/webhooks', express.raw({ type: 'application/json' }));

// then normal JSON parser for everything else
app.use(express.json());

app.use('/health', healthRouter);
app.use('/tenants', tenantsRouter);
app.use('/shopify', shopifyRouter); // shopify router expects raw on /shopify/webhooks
app.use('/insights', insightsRouter);

// optional: basic error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'internal_server_error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server up on ${PORT}`));
