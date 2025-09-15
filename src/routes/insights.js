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
router.get('/orders-by-date/:tenantId', async (req,res)=>{
  const { start, end } = req.query; // e.g. ?start=2025-01-01&end=2025-02-01
  const tenantId = req.params.tenantId;
  // Simple raw SQL for grouping by date (safe with prisma.$queryRaw if you prefer)
  const rows = await prisma.$queryRaw`
    SELECT date_trunc('day', "createdAt") AS day, COUNT(*) as orders_count, SUM("totalPrice") as revenue
    FROM "Order" o
    JOIN "Store" s ON o."storeId" = s.id
    WHERE s."tenantId" = ${tenantId} AND o."createdAt" BETWEEN ${start}::timestamp AND ${end}::timestamp
    GROUP BY day
    ORDER BY day;
  `;
  res.json(rows);
});

export default router;
