import express from 'express';
import prisma from '../lib/prisma.js';
const router = express.Router();

// Basic summary: total customers, orders, total revenue for tenant
router.get('/summary/:tenantId', async (req,res)=>{
  const tenantId = req.params.tenantId;
  const totalCustomers = await prisma.customer.count({ where: { store: { tenantId } } });
  const totalOrders = await prisma.order.count({ where: { store: { tenantId } } });
  const revenueAgg = await prisma.order.aggregate({ where: { store: { tenantId } }, _sum: { totalPrice: true }});
  res.json({
    totalCustomers, totalOrders, totalRevenue: revenueAgg._sum.totalPrice || 0
  });
});

// routes/insights.js (or wherever)
router.get('/orders-by-date/:id', async (req, res) => {
  // :id may be either a storeId or a tenantId (backwards-compatible)
  // prefer explicit query ?storeId= if provided
  const paramId = req.params.id;
  const explicitStoreId = req.query.storeId ? String(req.query.storeId) : null;
  const tenantId = req.query.tenantId ? String(req.query.tenantId) : null;
  let { from, to } = req.query;

  try {
    // helper to resolve store by various inputs
    async function resolveStore() {
      // 1) explicit query param storeId
      if (explicitStoreId) {
        const s = await prisma.store.findUnique({ where: { id: explicitStoreId } });
        if (s) return s;
        // if not found, keep trying other options for helpful error messages
      }

      // 2) path param provided and looks like a store id
      if (paramId) {
        // try as store id first
        let s = await prisma.store.findUnique({ where: { id: paramId } });
        if (s) return s;

        // if not found as store id, assume paramId is tenantId and try to find a store for tenant
        s = await prisma.store.findFirst({ where: { tenantId: paramId } });
        if (s) return s;
      }

      // 3) explicit query tenantId (e.g. ?tenantId=...)
      if (tenantId) {
        const s = await prisma.store.findFirst({ where: { tenantId } });
        if (s) return s;
      }

      // none matched
      return null;
    }

    const store = await resolveStore();
    if (!store) {
      console.log('[insights] store resolve failed', { paramId, explicitStoreId, tenantId });
      return res.status(404).json({
        error: 'store_not_found',
        tried: { paramId, explicitStoreId, tenantId }
      });
    }

    // parse dates (same as your original logic)
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(now.getDate() - 30);

    const fromDate = from ? new Date(String(from) + 'T00:00:00Z') : defaultFrom;
    const toDate = to ? new Date(String(to) + 'T23:59:59Z') : now;

    // Parameterized raw SQL - qualify createdAt with table alias `o`
    const rows = await prisma.$queryRaw`
      SELECT
        to_char(date_trunc('day', o."createdAt"), 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS orders,
        COALESCE(SUM(o."totalPrice"), 0)::numeric AS revenue
      FROM "Order" o
      WHERE o."storeId" = ${store.id}
        AND o."createdAt" >= ${fromDate}
        AND o."createdAt" <= ${toDate}
      GROUP BY date
      ORDER BY date;
    `;

    const data = rows.map(r => ({
      date: String(r.date),
      orders: Number(r.orders),
      revenue: Number(r.revenue)
    }));

    return res.json({ storeId: store.id, data });
  } catch (err) {
    console.error('insights orders-by-date error', err);
    return res.status(500).json({ error: 'internal_server_error' });
  }
});


// INSIGHTS: top customers by spend
// GET /insights/top-customers/:tenantId?limit=5
router.get('/top-customers/:tenantId', async (req, res) => {
  const { tenantId } = req.params;
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 5));

  try {
    const store = await prisma.store.findUnique({ where: { id: tenantId }});
    if (!store) return res.status(404).json({ error: 'store not found' });

    // Use Prisma groupBy (safe) to sum by customerId
    const groups = await prisma.order.groupBy({
      by: ['customerId'],
      where: { storeId: store.id, customerId: { not: null } },
      _sum: { totalPrice: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: limit,
    });

    const results = [];
    for (const g of groups) {
      const cust = await prisma.customer.findUnique({
        where: { id: g.customerId },
        select: { id: true, email: true, firstName: true, lastName: true },
      });

      results.push({
        id: cust?.id || g.customerId,
        name: cust ? `${cust.firstName || ''} ${cust.lastName || ''}`.trim() || '—' : '—',
        email: cust?.email || null,
        totalSpend: Number(g._sum.totalPrice || 0),
      });
    }

    res.json({ data: results });
  } catch (err) {
    console.error('insights top-customers error', err);
    res.status(500).json({ error: 'internal_server_error' });
  }
});

export default router;
