import express from 'express';
import dotenv from 'dotenv';
import morgan from 'morgan';
import cors from 'cors';
import healthRouter from './routes/health.js';
import tenantsRouter from './routes/tenants.js';
import shopifyRouter from './routes/shopify.js';
import insightsRouter from './routes/insights.js';

dotenv.config();
const app = express();

// IMPORTANT: mount webhook route BEFORE express.json or handle raw per-route (we do raw inside shopify route)
app.use(morgan('dev'));
app.use(cors());
app.use(express.json()); // normal API JSON body parser for non-webhook routes

app.use('/health', healthRouter);
app.use('/tenants', tenantsRouter);
app.use('/shopify', shopifyRouter);   // contains webhook route that accepts raw body
app.use('/insights', insightsRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`Server up on ${PORT}`));
