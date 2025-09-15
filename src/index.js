// import express from 'express';
// import dotenv from 'dotenv';
// import morgan from 'morgan';
// import cors from 'cors';
// import healthRouter from './routes/health.js';
// import tenantsRouter from './routes/tenants.js';
// import shopifyRouter from './routes/shopify.js';
// import insightsRouter from './routes/insights.js';

// console.log("🚀 Starting server with env:", {
//   PORT: process.env.PORT,
//   DATABASE_URL: !!process.env.DATABASE_URL,
//   SUPABASE_URL: !!process.env.SUPABASE_URL,
//   SUPABASE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
//   WEBHOOK_SECRET: !!process.env.SHOPIFY_WEBHOOK_SECRET
// });


// dotenv.config();
// const app = express();

// // IMPORTANT: mount webhook route BEFORE express.json or handle raw per-route (we do raw inside shopify route)
// app.use(morgan('dev'));
// app.use(cors());
// app.use(express.json()); // normal API JSON body parser for non-webhook routes


// app.use('/health', healthRouter);
// app.use('/tenants', tenantsRouter);
// app.use('/shopify', shopifyRouter);   // contains webhook route that accepts raw body
// app.use('/insights', insightsRouter);
// const PORT = process.env.PORT || 3000;

// app.get("/", (req, res) => res.send("OK"));  // Railway health check

// const server = app.listen(PORT, "0.0.0.0", () => {
//   console.log(`🚀 Server running on ${PORT}`);
// });

// server.on("error", (err) => {
//   console.error("❌ Server error:", err);
// });
// index.js (relevant part)
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server up on ${PORT}`));
