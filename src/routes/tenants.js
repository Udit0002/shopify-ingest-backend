import express from 'express';
import prisma from '../lib/prisma.js';
const router = express.Router();

// Simple onboarding: create tenant + store (manual token)
router.post('/register', async (req,res)=>{
  /* body: { tenantName, shopDomain, accessToken } */
  const { tenantName, shopDomain, accessToken } = req.body;
  if(!shopDomain || !accessToken) return res.status(400).send('shopDomain+accessToken required');
  // create tenant if none; simple logic: one tenant per admin run
  let tenant = await prisma.tenant.findFirst({ where: { name: tenantName || 'default' }});
  if(!tenant) tenant = await prisma.tenant.create({ data: { name: tenantName || 'default' }});
  const store = await prisma.store.upsert({
    where: { shopDomain },
    update: { accessToken, tenantId: tenant.id },
    create: { shopDomain, accessToken, tenantId: tenant.id }
  });
  res.json({ store });
});

export default router;
