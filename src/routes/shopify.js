// import express from 'express';
// import crypto from 'crypto';
// import prisma from '../lib/prisma.js';
// import axios from 'axios';
// const router = express.Router();

// // Use raw parser only for webhook route
// router.post('/webhooks/shopify', express.raw({ type: 'application/json' }), async (req, res) => {
//   const hmac = req.get('X-Shopify-Hmac-Sha256') || req.get('x-shopify-hmac-sha256');
//   const topic = req.get('X-Shopify-Topic') || req.get('x-shopify-topic');
//   const shop = req.get('X-Shopify-Shop-Domain') || req.get('x-shopify-shop-domain');
//   const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
//   const digest = crypto.createHmac('sha256', secret).update(req.body).digest('base64');
//   if(digest !== hmac) {
//     return res.status(401).send('invalid hmac');
//   }

//   // parse JSON
//   const payload = JSON.parse(req.body.toString());
//   try {
//     // handle events by topic
//     if(topic.startsWith('orders/')) {
//       // upsert order
//       await prisma.order.upsert({
//         where: { shopifyId_storeId: { shopifyId: String(payload.id), storeId: (await findStoreId(shop)) } },
//         update: { totalPrice: parseFloat(payload.total_price || 0), currency: payload.currency },
//         create: {
//           shopifyId: String(payload.id),
//           totalPrice: parseFloat(payload.total_price || 0),
//           currency: payload.currency,
//           storeId: await findStoreId(shop)
//         }
//       });
//     } else if(topic.startsWith('customers/')) {
//       await prisma.customer.upsert({
//         where: { shopifyId_storeId: { shopifyId: String(payload.id), storeId: await findStoreId(shop) } },
//         update: { email: payload.email, firstName: payload.first_name, lastName: payload.last_name },
//         create: { shopifyId: String(payload.id), email: payload.email, firstName: payload.first_name, lastName: payload.last_name, storeId: await findStoreId(shop) }
//       });
//     } else if(topic.startsWith('products/')) {
//       await prisma.product.upsert({
//         where: { shopifyId_storeId: { shopifyId: String(payload.id), storeId: await findStoreId(shop) } },
//         update: { title: payload.title },
//         create: { shopifyId: String(payload.id), title: payload.title, storeId: await findStoreId(shop) }
//       });
//     }

//     // respond 200 quickly
//     res.status(200).send('ok');
//   } catch (err) {
//     console.error(err);
//     res.status(500).send('server error');
//   }
// });

// // helper to find store.id by shop domain
// async function findStoreId(shopDomain) {
//   const store = await prisma.store.findUnique({ where: { shopDomain }});
//   if(!store) throw new Error('store not onboarded: ' + shopDomain);
//   return store.id;
// }

// export default router;

// // Fetch products for a store (manual)
// router.get('/fetch-products/:shopDomain', async (req,res)=>{
//   const shopDomain = req.params.shopDomain;
//   const store = await prisma.store.findUnique({ where: { shopDomain }});
//   if(!store) return res.status(404).send('store not found');
//   const url = `https://${shopDomain}/admin/api/2025-07/products.json?limit=250`;
//   const resp = await axios.get(url, { headers: { 'X-Shopify-Access-Token': store.accessToken }});
//   const products = resp.data.products || [];
//   // upsert loop
//   for(const p of products) {
//     await prisma.product.upsert({
//       where: { shopifyId_storeId: { shopifyId: String(p.id), storeId: store.id } },
//       update: { title: p.title },
//       create: { shopifyId: String(p.id), title: p.title, storeId: store.id }
//     });
//   }
//   res.json({ count: products.length });
// });

// // Fetch customers for a store (manual sync)
// // inside src/routes/shopify.js (replace existing fetch-customers route)
// router.get('/fetch-customers/:shopDomain', async (req, res) => {
//   const shopDomain = req.params.shopDomain;
//   const fetchAll = req.query.all === 'true';

//   const store = await prisma.store.findUnique({ where: { shopDomain } });
//   if (!store) return res.status(404).send('store not found');

//   try {
//     if (!fetchAll) {
//       // existing single-page behavior (keep for quick tests)
//       const url = `https://${shopDomain}/admin/api/2025-07/customers.json?limit=250`;
//       const resp = await axios.get(url, { headers: { 'X-Shopify-Access-Token': store.accessToken }});
//       const customers = resp.data.customers || [];
//       for (const c of customers) {
//         await prisma.customer.upsert({
//           where: { shopifyId_storeId: { shopifyId: String(c.id), storeId: store.id } },
//           update: { email: c.email, firstName: c.first_name, lastName: c.last_name },
//           create: { shopifyId: String(c.id), email: c.email, firstName: c.first_name, lastName: c.last_name, storeId: store.id }
//         });
//       }
//       return res.json({ count: customers.length });
//     }

//     // FULL BACKFILL: paginate using since_id
//     let sinceId = 0;
//     let total = 0;
//     while (true) {
//       const url = `https://${shopDomain}/admin/api/2025-07/customers.json?limit=250&since_id=${sinceId}`;
//       const resp = await axios.get(url, { headers: { 'X-Shopify-Access-Token': store.accessToken }});
//       const customers = resp.data.customers || [];
//       if (!customers.length) break;

//       // upsert batch
//       for (const c of customers) {
//         await prisma.customer.upsert({
//           where: { shopifyId_storeId: { shopifyId: String(c.id), storeId: store.id } },
//           update: { email: c.email, firstName: c.first_name, lastName: c.last_name },
//           create: { shopifyId: String(c.id), email: c.email, firstName: c.first_name, lastName: c.last_name, storeId: store.id }
//         });
//       }

//       total += customers.length;
//       sinceId = customers[customers.length - 1].id;
//       // small delay to be polite (avoid throttling)
//       await new Promise(r => setTimeout(r, 200));
//     }

//     res.json({ totalImported: total });
//   } catch (err) {
//     console.error('fetch-customers error', err.response?.data || err.message || err);
//     res.status(500).send('error fetching customers');
//   }
// });


// // Fetch orders for a store (manual sync)
// // inside src/routes/shopify.js (replace existing fetch-orders route)
// import url from 'url'; // at top if not already imported

// // helper to parse Link header and return next page_info (if any)
// function getNextPageInfo(linkHeader) {
//   if (!linkHeader) return null;
//   // Link header format: <https://...&page_info=xxx>; rel="next", <...>; rel="previous"
//   const parts = linkHeader.split(',');
//   for (const p of parts) {
//     if (p.includes('rel="next"')) {
//       const match = p.match(/page_info=([^&>]+)/);
//       if (match) return match[1];
//     }
//   }
//   return null;
// }

// router.get('/fetch-orders/:shopDomain', async (req, res) => {
//   const shopDomain = req.params.shopDomain;
//   const fetchAll = req.query.all === 'true';

//   const store = await prisma.store.findUnique({ where: { shopDomain } });
//   if (!store) return res.status(404).send('store not found');

//   try {
//     if (!fetchAll) {
//       const url0 = `https://${shopDomain}/admin/api/2025-07/orders.json?status=any&limit=50`;
//       const resp = await axios.get(url0, { headers: { 'X-Shopify-Access-Token': store.accessToken }});
//       const orders = resp.data.orders || [];
//       for (const o of orders) {
//         await prisma.order.upsert({
//           where: { shopifyId_storeId: { shopifyId: String(o.id), storeId: store.id } },
//           update: { totalPrice: parseFloat(o.total_price || 0), currency: o.currency },
//           create: { shopifyId: String(o.id), totalPrice: parseFloat(o.total_price || 0), currency: o.currency, storeId: store.id }
//         });
//       }
//       return res.json({ count: orders.length });
//     }

//     // FULL backfill using cursor (page_info)
//     let nextPageInfo = null;
//     let total = 0;
//     // initial request
//     let reqUrl = `https://${shopDomain}/admin/api/2025-07/orders.json?status=any&limit=250`;
//     while (true) {
//       if (nextPageInfo) {
//         reqUrl = `https://${shopDomain}/admin/api/2025-07/orders.json?status=any&limit=250&page_info=${nextPageInfo}`;
//       }
//       const resp = await axios.get(reqUrl, { headers: { 'X-Shopify-Access-Token': store.accessToken }, validateStatus: null });
//       // if 429 or 500, break or retry
//       if (resp.status >= 400) {
//         console.error('Shopify orders fetch error status', resp.status, resp.data);
//         break;
//       }
//       const orders = resp.data.orders || [];
//       if (!orders.length) break;

//       for (const o of orders) {
//         await prisma.order.upsert({
//           where: { shopifyId_storeId: { shopifyId: String(o.id), storeId: store.id } },
//           update: { totalPrice: parseFloat(o.total_price || 0), currency: o.currency },
//           create: { shopifyId: String(o.id), totalPrice: parseFloat(o.total_price || 0), currency: o.currency, storeId: store.id }
//         });
//       }

//       total += orders.length;

//       const link = resp.headers['link'] || resp.headers['Link'];
//       nextPageInfo = getNextPageInfo(link);
//       if (!nextPageInfo) break;

//       // be polite
//       await new Promise(r => setTimeout(r, 300));
//     }

//     res.json({ totalImported: total });
//   } catch (err) {
//     console.error('fetch-orders error', err.response?.data || err.message || err);
//     res.status(500).send('error fetching orders');
//   }
// });

// // // INSIGHTS: orders by date
// // router.get('/insights/orders-by-date/:tenantId', async (req, res) => {
// //   const { tenantId } = req.params;
// //   const { from, to } = req.query; // expect YYYY-MM-DD

// //   try {
// //     // find store - adjust if tenantId maps differently
// //     const store = await prisma.store.findUnique({ where: { id: tenantId }});
// //     if (!store) return res.status(404).json({ error: 'store not found' });

// //     // build where clause
// //     const where = { storeId: store.id };
// //     if (from || to) {
// //       where.createdAt = {};
// //       if (from) where.createdAt.gte = new Date(String(from) + 'T00:00:00Z');
// //       if (to) where.createdAt.lte = new Date(String(to) + 'T23:59:59Z');
// //     }

// //     // fetch relevant orders (limit to safe number - you can page if needed)
// //     const orders = await prisma.order.findMany({
// //       where,
// //       select: { id: true, createdAt: true, totalPrice: true }
// //     });

// //     // group by date (yyyy-mm-dd)
// //     const map = new Map();
// //     for (const o of orders) {
// //       const d = new Date(o.createdAt).toISOString().slice(0, 10); // 'YYYY-MM-DD'
// //       const curr = map.get(d) || { date: d, orders: 0, revenue: 0 };
// //       curr.orders += 1;
// //       curr.revenue += Number(o.totalPrice || 0);
// //       map.set(d, curr);
// //     }

// //     // convert to sorted array
// //     const arr = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
// //     res.json({ data: arr });
// //   } catch (err) {
// //     console.error('insights orders-by-date error', err);
// //     res.status(500).json({ error: 'server error' });
// //   }
// // });

// // // INSIGHTS: top customers by spend
// // router.get('/insights/top-customers/:tenantId', async (req, res) => {
// //   const { tenantId } = req.params;
// //   const limit = Number(req.query.limit) || 5;

// //   try {
// //     const store = await prisma.store.findUnique({ where: { id: tenantId }});
// //     if (!store) return res.status(404).json({ error: 'store not found' });

// //     // Use Prisma groupBy on orders to sum spend per customerId
// //     // Adjust field names if your order model uses customerId or customerShopifyId
// //     const groups = await prisma.order.groupBy({
// //       by: ['customerId'],
// //       where: { storeId: store.id, customerId: { not: null } },
// //       _sum: { totalPrice: true },
// //       orderBy: { _sum: { totalPrice: 'desc' } },
// //       take: limit,
// //     });

// //     // join with customers table to get name/email
// //     const results = [];
// //     for (const g of groups) {
// //       const cust = await prisma.customer.findUnique({
// //         where: { id: g.customerId },
// //         select: { id: true, email: true, firstName: true, lastName: true },
// //       });
// //       results.push({
// //         id: cust?.id || g.customerId,
// //         name: cust ? `${cust.firstName || ''} ${cust.lastName || ''}`.trim() || '—' : '—',
// //         email: cust?.email || null,
// //         totalSpend: Number(g._sum.totalPrice || 0),
// //       });
// //     }

// //     res.json({ data: results });
// //   } catch (err) {
// //     console.error('insights top-customers error', err);
// //     res.status(500).json({ error: 'server error' });
// //   }
// // });
import express from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import axios from 'axios';
import url from 'url';
const router = express.Router();

// ---------------------------
// Helpers
// ---------------------------

async function findStoreId(shopDomain) {
  const store = await prisma.store.findUnique({ where: { shopDomain }});
  if(!store) throw new Error('store not onboarded: ' + shopDomain);
  return store.id;
}

// find-or-create customer by shopifyId or email (scoped to store)
async function findOrCreateCustomer({ shopifyCustomerId, email, firstName, lastName, storeId }) {
  if (shopifyCustomerId) {
    const existing = await prisma.customer.findFirst({
      where: { shopifyId: String(shopifyCustomerId), storeId }
    });
    if (existing) return existing;
  }

  if (email) {
    const byEmail = await prisma.customer.findFirst({
      where: { email: String(email), storeId }
    });
    if (byEmail) return byEmail;
  }

  // create new customer
  const created = await prisma.customer.create({
    data: {
      shopifyId: shopifyCustomerId ? String(shopifyCustomerId) : undefined,
      email: email ? String(email) : undefined,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      store: { connect: { id: storeId } }
    }
  });
  return created;
}

// Upsert order and link to customer when possible (payload = Shopify order object)
async function upsertOrderFromPayload({ payload, storeId }) {
  const shopifyOrderId = String(payload.id);
  const totalPrice = payload.total_price ? parseFloat(payload.total_price) : 0;
  const currency = payload.currency || payload.currency_code || null;

  // extract possible customer info
  const shopifyCustomerId = payload.customer?.id || payload.customer_id || null;
  const customerEmail = payload.customer?.email || payload.email || payload.customer_email || null;
  const firstName = payload.customer?.first_name || payload.customer?.firstName || null;
  const lastName = payload.customer?.last_name || payload.customer?.lastName || null;

  let customerId = undefined;
  try {
    if (shopifyCustomerId || customerEmail) {
      const cust = await findOrCreateCustomer({
        shopifyCustomerId,
        email: customerEmail,
        firstName,
        lastName,
        storeId
      });
      customerId = cust?.id;
    }
  } catch (err) {
    // don't abort order upsert for customer creation errors; log and continue
    console.error('findOrCreateCustomer error', err);
  }

  const upsertArgs = {
    where: { shopifyId_storeId: { shopifyId: shopifyOrderId, storeId } },
    update: {
      totalPrice,
      currency,
      ...(customerId ? { customerId } : {})
    },
    create: {
      shopifyId: shopifyOrderId,
      totalPrice,
      currency,
      storeId,
      ...(customerId ? { customerId } : {})
    }
  };

  return prisma.order.upsert(upsertArgs);
}

// helper to parse Link header and return next page_info (if any)
function getNextPageInfo(linkHeader) {
  if (!linkHeader) return null;
  // Link header format: <https://...&page_info=xxx>; rel="next", <...>; rel="previous"
  const parts = linkHeader.split(',');
  for (const p of parts) {
    if (p.includes('rel="next"')) {
      const match = p.match(/page_info=([^&>]+)/);
      if (match) return match[1];
    }
  }
  return null;
}

// ---------------------------
// Webhook route
// ---------------------------

// Use raw parser only for webhook route
router.post('/webhooks/shopify', express.raw({ type: 'application/json' }), async (req, res) => {
  const hmac = req.get('X-Shopify-Hmac-Sha256') || req.get('x-shopify-hmac-sha256');
  const topic = req.get('X-Shopify-Topic') || req.get('x-shopify-topic') || '';
  const shop = req.get('X-Shopify-Shop-Domain') || req.get('x-shopify-shop-domain') || '';
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

  // verify HMAC
  const digest = crypto.createHmac('sha256', secret).update(req.body).digest('base64');
  if (digest !== hmac) {
    console.warn('Invalid HMAC for webhook from', shop, 'topic', topic);
    return res.status(401).send('invalid hmac');
  }

  // parse JSON
  const payload = JSON.parse(req.body.toString());
  try {
    // resolve storeId once
    const storeId = await findStoreId(shop);

    // handle events by topic
    if (topic.startsWith('orders/')) {
      // upsert order and link customer when possible
      await upsertOrderFromPayload({ payload, storeId });
    } else if (topic.startsWith('customers/')) {
      const shopifyCustomerId = String(payload.id);
      await prisma.customer.upsert({
        where: { shopifyId_storeId: { shopifyId: shopifyCustomerId, storeId } },
        update: { email: payload.email || null, firstName: payload.first_name || payload.firstName || null, lastName: payload.last_name || payload.lastName || null },
        create: { shopifyId: shopifyCustomerId, email: payload.email || null, firstName: payload.first_name || payload.firstName || null, lastName: payload.last_name || payload.lastName || null, storeId }
      });
    } else if (topic.startsWith('products/')) {
      const shopifyProductId = String(payload.id);
      await prisma.product.upsert({
        where: { shopifyId_storeId: { shopifyId: shopifyProductId, storeId } },
        update: { title: payload.title || null },
        create: { shopifyId: shopifyProductId, title: payload.title || null, storeId }
      });
    }

    // respond 200 quickly
    res.status(200).send('ok');
  } catch (err) {
    console.error('webhook handler error', err);
    if (String(err).includes('store not onboarded')) {
      return res.status(404).send(String(err));
    }
    res.status(500).send('server error');
  }
});

// ---------------------------
// Fetch products for a store (manual)
// ---------------------------
router.get('/fetch-products/:shopDomain', async (req,res)=>{
  const shopDomain = req.params.shopDomain;
  const store = await prisma.store.findUnique({ where: { shopDomain }});
  if(!store) return res.status(404).send('store not found');
  const url0 = `https://${shopDomain}/admin/api/2025-07/products.json?limit=250`;
  try {
    const resp = await axios.get(url0, { headers: { 'X-Shopify-Access-Token': store.accessToken }});
    const products = resp.data.products || [];
    // upsert loop
    for(const p of products) {
      await prisma.product.upsert({
        where: { shopifyId_storeId: { shopifyId: String(p.id), storeId: store.id } },
        update: { title: p.title || null },
        create: { shopifyId: String(p.id), title: p.title || null, storeId: store.id }
      });
    }
    res.json({ count: products.length });
  } catch (err) {
    console.error('fetch-products error', err.response?.data || err.message || err);
    res.status(500).send('error fetching products');
  }
});

// ---------------------------
// Fetch customers for a store (manual sync)
// ---------------------------
router.get('/fetch-customers/:shopDomain', async (req, res) => {
  const shopDomain = req.params.shopDomain;
  const fetchAll = req.query.all === 'true';

  const store = await prisma.store.findUnique({ where: { shopDomain } });
  if (!store) return res.status(404).send('store not found');

  try {
    if (!fetchAll) {
      // existing single-page behavior (keep for quick tests)
      const url0 = `https://${shopDomain}/admin/api/2025-07/customers.json?limit=250`;
      const resp = await axios.get(url0, { headers: { 'X-Shopify-Access-Token': store.accessToken }});
      const customers = resp.data.customers || [];
      for (const c of customers) {
        await prisma.customer.upsert({
          where: { shopifyId_storeId: { shopifyId: String(c.id), storeId: store.id } },
          update: { email: c.email || null, firstName: c.first_name || null, lastName: c.last_name || null },
          create: { shopifyId: String(c.id), email: c.email || null, firstName: c.first_name || null, lastName: c.last_name || null, storeId: store.id }
        });
      }
      return res.json({ count: customers.length });
    }

    // FULL BACKFILL: paginate using since_id
    let sinceId = 0;
    let total = 0;
    while (true) {
      const url0 = `https://${shopDomain}/admin/api/2025-07/customers.json?limit=250&since_id=${sinceId}`;
      const resp = await axios.get(url0, { headers: { 'X-Shopify-Access-Token': store.accessToken }});
      const customers = resp.data.customers || [];
      if (!customers.length) break;

      // upsert batch
      for (const c of customers) {
        await prisma.customer.upsert({
          where: { shopifyId_storeId: { shopifyId: String(c.id), storeId: store.id } },
          update: { email: c.email || null, firstName: c.first_name || null, lastName: c.last_name || null },
          create: { shopifyId: String(c.id), email: c.email || null, firstName: c.first_name || null, lastName: c.last_name || null, storeId: store.id }
        });
      }

      total += customers.length;
      sinceId = customers[customers.length - 1].id;
      // small delay to be polite (avoid throttling)
      await new Promise(r => setTimeout(r, 200));
    }

    res.json({ totalImported: total });
  } catch (err) {
    console.error('fetch-customers error', err.response?.data || err.message || err);
    res.status(500).send('error fetching customers');
  }
});

// ---------------------------
// Fetch orders for a store (manual sync)
// ---------------------------
router.get('/fetch-orders/:shopDomain', async (req, res) => {
  const shopDomain = req.params.shopDomain;
  const fetchAll = req.query.all === 'true';

  const store = await prisma.store.findUnique({ where: { shopDomain } });
  if (!store) return res.status(404).send('store not found');

  try {
    if (!fetchAll) {
      const url0 = `https://${shopDomain}/admin/api/2025-07/orders.json?status=any&limit=50`;
      const resp = await axios.get(url0, { headers: { 'X-Shopify-Access-Token': store.accessToken }});
      const orders = resp.data.orders || [];
      for (const o of orders) {
        // upsert and link customer when payload contains customer info
        await upsertOrderFromPayload({ payload: o, storeId: store.id });
      }
      return res.json({ count: orders.length });
    }

    // FULL backfill using cursor (page_info)
    let nextPageInfo = null;
    let total = 0;
    // initial request
    let reqUrl = `https://${shopDomain}/admin/api/2025-07/orders.json?status=any&limit=250`;
    while (true) {
      if (nextPageInfo) {
        reqUrl = `https://${shopDomain}/admin/api/2025-07/orders.json?status=any&limit=250&page_info=${nextPageInfo}`;
      }
      const resp = await axios.get(reqUrl, { headers: { 'X-Shopify-Access-Token': store.accessToken }, validateStatus: null });
      // if 429 or 500, break or retry
      if (resp.status >= 400) {
        console.error('Shopify orders fetch error status', resp.status, resp.data);
        break;
      }
      const orders = resp.data.orders || [];
      if (!orders.length) break;

      for (const o of orders) {
        await upsertOrderFromPayload({ payload: o, storeId: store.id });
      }

      total += orders.length;

      const link = resp.headers['link'] || resp.headers['Link'];
      nextPageInfo = getNextPageInfo(link);
      if (!nextPageInfo) break;

      // be polite
      await new Promise(r => setTimeout(r, 300));
    }

    res.json({ totalImported: total });
  } catch (err) {
    console.error('fetch-orders error', err.response?.data || err.message || err);
    res.status(500).send('error fetching orders');
  }
});

// ---------------------------
// Export router
// ---------------------------
export default router;
