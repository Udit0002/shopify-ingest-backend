import cron from 'node-cron';
import prisma from '../lib/prisma.js';
import axios from 'axios';

cron.schedule('*/10 * * * *', async ()=>{
  // every 10 minutes
  const stores = await prisma.store.findMany();
  for(const s of stores){
    try {
      // call internal route to fetch (or call function directly)
      // fetch products
      const url = `https://${s.shopDomain}/admin/api/2025-07/products.json?limit=250`;
      const resp = await axios.get(url, { headers: { 'X-Shopify-Access-Token': s.accessToken }});
      // upsert to DB as before...
    } catch(e) { console.error('sync error', s.shopDomain, e.message) }
  }
});
