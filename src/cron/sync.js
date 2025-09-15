// src/cron/syncCron.js
import cron from 'node-cron';
import prisma from '../lib/prisma.js';
import axios from 'axios';

// small helper for sleep
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Try to acquire a Postgres advisory lock. Returns true if lock acquired.
// Use a numeric key (choose large constant unique to your job).
async function tryAcquireLock(key = 1234567890) {
  try {
    const r = await prisma.$queryRaw`SELECT pg_try_advisory_lock(${key}) as locked;`;
    // result shape may vary; handle both array/object variants
    const locked = Array.isArray(r) ? r[0]?.locked : r?.locked;
    return !!locked;
  } catch (err) {
    console.error('Lock check failed', err);
    return false;
  }
}

// Release the advisory lock
async function releaseLock(key = 1234567890) {
  try {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${key});`;
  } catch (err) {
    console.error('Unlock failed', err);
  }
}

// The actual sync worker for a single store (upsert logic placeholder)
async function syncStore(s) {
  console.log(`[sync] start store ${s.shopDomain}`);
  const axiosClient = axios.create({ timeout: 15000 });
  try {
    // Example: fetch products (you should implement pagination)
    const url = `https://${s.shopDomain}/admin/api/2025-07/products.json?limit=250`;
    const resp = await axiosClient.get(url, { headers: { 'X-Shopify-Access-Token': s.accessToken }});
    const products = resp.data.products || [];
    // upsert products - keep this small / batched in real code
    for (const p of products) {
      await prisma.product.upsert({
        where: { shopifyId_storeId: { shopifyId: String(p.id), storeId: s.id } },
        update: { title: p.title },
        create: { shopifyId: String(p.id), title: p.title, storeId: s.id }
      });
    }

    // You can also call customers/orders backfill selectively here (or only incremental fetch)
    console.log(`[sync] finished store ${s.shopDomain} - products: ${products.length}`);
  } catch (err) {
    console.error(`[sync] error store ${s.shopDomain}`, err?.response?.data || err.message || err);
  }
}

// The scheduled job (every 10 minutes as your original)
cron.schedule('*/10 * * * *', async () => {
  const start = new Date().toISOString();
  console.log(`⏰ CRON START ${start}`);

  const lockKey = 987654321; // change to any deterministic number for this job
  const locked = await tryAcquireLock(lockKey);
  if (!locked) {
    console.log('⏳ Another instance is running the cron, skipping this run.');
    return;
  }

  try {
    const stores = await prisma.store.findMany();
    for (const s of stores) {
      // run each store sequentially to avoid hitting Shopify concurrently too hard
      await syncStore(s);
      await sleep(200); // small gap between stores
    }
    const end = new Date().toISOString();
    console.log(`✅ CRON FINISH ${end}`);
  } catch (err) {
    console.error('CRON ERROR', err);
  } finally {
    await releaseLock(lockKey);
  }
});
