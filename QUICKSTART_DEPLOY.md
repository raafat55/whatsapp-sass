# Quick Start: Deploy to Render.com in 5 Minutes

This is a fast-track guide for deploying WhatsApp AI SaaS to Render.com production.

## Prerequisites Checklist

- [ ] GitHub account
- [ ] Render.com account (free)
- [ ] MongoDB Atlas account (free M0 cluster)
- [ ] Terminal access

## Step 1: Generate Secrets (2 minutes)

Run these commands and save the output:

```bash
# JWT Secret (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Encryption Key (64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save both values - you'll need them in Step 3.

## Step 2: Setup MongoDB (2 minutes)

1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free cluster (M0 tier)
3. Get your connection string:
   - Cluster → Connect → Drivers → Node.js
   - Replace `<password>` with your database password
   - Save the string

## Step 3: Deploy to Render.com (1 minute)

1. Go to https://render.com
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Name:** `whatsapp-ai-saas`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
   - **Node Version:** 20
5. Click **Advanced** → **Add Environment Variables**

Paste all these (replace with your values from Steps 1 & 2):

```env
NODE_ENV=production
PORT=3000

MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/whatsapp_saas?retryWrites=true&w=majority

JWT_SECRET=your_32_char_secret_from_step_1

ENCRYPTION_KEY=your_64_hex_key_from_step_1

CORS_ORIGIN=https://yourfrontend.com

AI_REPLY_MAX_PER_MINUTE=30

AI_MEMORY_MAX_MESSAGES=30
```

6. Click **Create Web Service**
7. Wait 2-3 minutes for deployment to complete

## Step 4: Verify Deployment (1 minute)

Once deployed:

1. Copy your service URL (e.g., `https://whatsapp-ai-saas.onrender.com`)
2. Test it:

   ```bash
   curl https://whatsapp-ai-saas.onrender.com/health
   ```

   Should return: `{"ok":true}`

3. View API docs:
   ```
   https://whatsapp-ai-saas.onrender.com/api/docs
   ```

## Done! 🎉

Your backend is now running in production!

### Next Steps

- Update your frontend to use: `https://whatsapp-ai-saas.onrender.com/api`
- Share the service URL with your team
- Monitor logs in Render.com dashboard

## Troubleshooting

**Deployment failed?**

- Check logs: Render dashboard → Logs tab
- Ensure all environment variables are set
- Run `npm run build` locally to test

**MongoDB connection error?**

- Verify MONGO_URI is correct
- Check MongoDB whitelist includes 0.0.0.0/0
- Verify database user password

**Backend working but frontend can't reach it?**

- Update CORS_ORIGIN to your frontend domain
- Restart service: Settings → Restart Instance

## Support

- **Render.com Docs:** https://render.com/docs
- **MongoDB Setup:** https://docs.atlas.mongodb.com
- **Deployment Deep Dive:** See `DEPLOYMENT.md`
- **Pre-deployment Checklist:** See `PRODUCTION_CHECKLIST.md`

---

**Deployment Time:** ~5 minutes  
**Annual Cost:** Free (Render + MongoDB M0)  
**Uptime SLA:** 99.9% (Render paid plans)
