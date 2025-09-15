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

// Orders by date (range)
router.get('/orders-by-date/:tenantId', async (req, res) => {
  const { tenantId } = req.params;
  let { from, to } = req.query;

  try {
    // find store
    const store = await prisma.store.findUnique({ where: { id: tenantId } });
    if (!store) return res.status(404).json({ error: 'store not found' });

    // default range: last 30 days
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

    // rows is an array of objects { date, orders, revenue }
    // convert revenue to number (depending on driver it may be string)
    const data = rows.map(r => ({
      date: String(r.date),
      orders: Number(r.orders),
      revenue: Number(r.revenue)
    }));

    res.json({ data });
  } catch (err) {
    console.error('insights orders-by-date error', err);
    res.status(500).json({ error: 'internal_server_error' });
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
