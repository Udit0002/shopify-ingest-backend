import express from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import axios from 'axios';
const router = express.Router();

// Use raw parser only for webhook route
router.post('/webhooks/shopify', express.raw({ type: 'application/json' }), async (req, res) => {
  const hmac = req.get('X-Shopify-Hmac-Sha256') || req.get('x-shopify-hmac-sha256');
  const topic = req.get('X-Shopify-Topic') || req.get('x-shopify-topic');
  const shop = req.get('X-Shopify-Shop-Domain') || req.get('x-shopify-shop-domain');
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  const digest = crypto.createHmac('sha256', secret).update(req.body).digest('base64');
  if(digest !== hmac) {
    return res.status(401).send('invalid hmac');
  }

  // parse JSON
  const payload = JSON.parse(req.body.toString());
  try {
    // handle events by topic
    if(topic.startsWith('orders/')) {
      // upsert order
      await prisma.order.upsert({
        where: { shopifyId_storeId: { shopifyId: String(payload.id), storeId: (await findStoreId(shop)) } },
        update: { totalPrice: parseFloat(payload.total_price || 0), currency: payload.currency },
        create: {
          shopifyId: String(payload.id),
          totalPrice: parseFloat(payload.total_price || 0),
          currency: payload.currency,
          storeId: await findStoreId(shop)
        }
      });
    } else if(topic.startsWith('customers/')) {
      await prisma.customer.upsert({
        where: { shopifyId_storeId: { shopifyId: String(payload.id), storeId: await findStoreId(shop) } },
        update: { email: payload.email, firstName: payload.first_name, lastName: payload.last_name },
        create: { shopifyId: String(payload.id), email: payload.email, firstName: payload.first_name, lastName: payload.last_name, storeId: await findStoreId(shop) }
      });
    } else if(topic.startsWith('products/')) {
      await prisma.product.upsert({
        where: { shopifyId_storeId: { shopifyId: String(payload.id), storeId: await findStoreId(shop) } },
        update: { title: payload.title },
        create: { shopifyId: String(payload.id), title: payload.title, storeId: await findStoreId(shop) }
      });
    }

    // respond 200 quickly
    res.status(200).send('ok');
  } catch (err) {
    console.error(err);
    res.status(500).send('server error');
  }
});

// helper to find store.id by shop domain
async function findStoreId(shopDomain) {
  const store = await prisma.store.findUnique({ where: { shopDomain }});
  if(!store) throw new Error('store not onboarded: ' + shopDomain);
  return store.id;
}

export default router;

// Fetch products for a store (manual)
router.get('/fetch-products/:shopDomain', async (req,res)=>{
  const shopDomain = req.params.shopDomain;
  const store = await prisma.store.findUnique({ where: { shopDomain }});
  if(!store) return res.status(404).send('store not found');
  const url = `https://${shopDomain}/admin/api/2025-07/products.json?limit=250`;
  const resp = await axios.get(url, { headers: { 'X-Shopify-Access-Token': store.accessToken }});
  const products = resp.data.products || [];
  // upsert loop
  for(const p of products) {
    await prisma.product.upsert({
      where: { shopifyId_storeId: { shopifyId: String(p.id), storeId: store.id } },
      update: { title: p.title },
      create: { shopifyId: String(p.id), title: p.title, storeId: store.id }
    });
  }
  res.json({ count: products.length });
});

// Fetch customers for a store (manual sync)
router.get('/fetch-customers/:shopDomain', async (req, res) => {
  const shopDomain = req.params.shopDomain;

  // find store in DB
  const store = await prisma.store.findUnique({ where: { shopDomain } });
  if (!store) return res.status(404).send('store not found');

  try {
    const url = `https://${shopDomain}/admin/api/2025-07/customers.json?limit=50`;
    const resp = await axios.get(url, {
      headers: { 'X-Shopify-Access-Token': store.accessToken }
    });

    const customers = resp.data.customers || [];

    // Upsert customers into Supabase via Prisma
    for (const c of customers) {
      await prisma.customer.upsert({
        where: {
          shopifyId_storeId: {
            shopifyId: String(c.id),
            storeId: store.id
          }
        },
        update: {
          email: c.email,
          firstName: c.first_name,
          lastName: c.last_name
        },
        create: {
          shopifyId: String(c.id),
          email: c.email,
          firstName: c.first_name,
          lastName: c.last_name,
          storeId: store.id
        }
      });
    }

    res.json({
      count: customers.length,
      customers: customers.map(c => ({
        id: c.id,
        email: c.email,
        firstName: c.first_name,
        lastName: c.last_name
      }))
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send('error fetching customers');
  }
});

// Fetch orders for a store (manual sync)
router.get('/fetch-orders/:shopDomain', async (req, res) => {
  const shopDomain = req.params.shopDomain;

  // find store in DB
  const store = await prisma.store.findUnique({ where: { shopDomain } });
  if (!store) return res.status(404).send('store not found');

  try {
    const url = `https://${shopDomain}/admin/api/2025-07/orders.json?status=any&limit=50`;
    const resp = await axios.get(url, {
      headers: { 'X-Shopify-Access-Token': store.accessToken }
    });

    const orders = resp.data.orders || [];

    // Upsert orders into DB
    for (const o of orders) {
      await prisma.order.upsert({
        where: {
          shopifyId_storeId: {
            shopifyId: String(o.id),
            storeId: store.id
          }
        },
        update: {
          totalPrice: parseFloat(o.total_price || 0),
          currency: o.currency
        },
        create: {
          shopifyId: String(o.id),
          totalPrice: parseFloat(o.total_price || 0),
          currency: o.currency,
          storeId: store.id
        }
      });
    }

    res.json({
      count: orders.length,
      orders: orders.map(o => ({
        id: o.id,
        email: o.email,
        totalPrice: o.total_price,
        currency: o.currency,
        createdAt: o.created_at
      }))
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send('error fetching orders');
  }
});
