# Deployment Guide: Render.com Production

This guide provides step-by-step instructions for deploying WhatsApp AI SaaS to Render.com.

## Prerequisites

- GitHub account with push access to the repository
- Render.com account (free tier available)
- MongoDB Atlas account with a free cluster (M0)
- Node.js 20.x or higher (local testing only)

## Step 1: Prepare MongoDB Atlas

### 1.1 Create MongoDB Cluster

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up or log in
3. Create a new project (e.g., "WhatsApp AI SaaS")
4. Create a cluster:
   - Cloud provider: AWS (or your preference)
   - Region: Choose closest to your users
   - Cluster tier: **M0 Shared** (free, 512MB storage, adequate for MVP)
   - Cluster name: `whatsapp-saas`

### 1.2 Configure Network Access

1. Navigate to **Security** → **Network Access**
2. Click **Add IP Address**
3. Select **Allow access from anywhere** (0.0.0.0/0)
   - ⚠️ **For production:** Whitelist only Render.com IP ranges
   - This is sufficient for development/MVP

### 1.3 Create Database User

1. Go to **Security** → **Database Access**
2. Click **Create a Database User**
3. Create user:
   - **Username:** `whatsapp_saas_user`
   - **Password:** Generate secure password (25+ characters)
   - **Authentication Method:** Password
   - **Database User Privileges:** Read and write to any database
4. Copy the generated connection string (we'll use this in Step 3)

### 1.4 Get Connection String

1. Go to **Databases** → Click **Connect** on your cluster
2. Choose **Drivers** → **Node.js** → **Version 5.5+**
3. Copy the connection string
4. Replace `<username>` and `<password>` with your database user credentials
5. Example:
   ```
   mongodb+srv://whatsapp_saas_user:YOUR_PASSWORD@whatsapp-saas.xxxxx.mongodb.net/whatsapp_saas?retryWrites=true&w=majority
   ```

## Step 2: Generate Secrets

Generate secure secrets for JWT and encryption keys. Run these commands locally:

### 2.1 Generate JWT Secret (32+ characters)

```bash
# macOS/Linux
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Random -Minimum 100000000000 -Maximum 999999999999).ToString())) | Out-String

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save this value for Step 3 as `JWT_SECRET`

### 2.2 Generate Encryption Key (64 hex characters = 32 bytes)

```bash
# macOS/Linux
openssl rand -hex 32

# Windows PowerShell
(Get-Random -Minimum 1000000000000000 -Maximum 9999999999999999).ToString() + (Get-Random -Minimum 1000000000000000 -Maximum 9999999999999999).ToString()

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save this value for Step 3 as `ENCRYPTION_KEY`

## Step 3: Create Render.com Service

### 3.1 Sign Up / Log In

1. Go to [Render.com](https://render.com)
2. Sign up with GitHub (recommended for auto-deployment)
3. Complete onboarding

### 3.2 Create Web Service

1. Click **New +** → **Web Service**
2. Connect your GitHub repository:
   - Select `whatsapp-sass` repository
   - Allow Render access to your GitHub account
   - Click **Connect**
3. Configure service:
   - **Name:** `whatsapp-ai-saas`
   - **Environment:** Node
   - **Region:** Select closest to users
   - **Branch:** `main`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
   - **Plan:** Free (can upgrade to Paid for production)

### 3.3 Add Environment Variables

1. In the service settings, find **Environment** section
2. Add these variables:

   ```env
   NODE_ENV=production
   PORT=3000

   # Replace with values from Step 1.4
   MONGO_URI=mongodb+srv://whatsapp_saas_user:YOUR_PASSWORD@cluster.mongodb.net/whatsapp_saas?retryWrites=true&w=majority

   # Use values from Step 2
   JWT_SECRET=paste_your_32+_char_secret_here
   ENCRYPTION_KEY=paste_your_64_hex_chars_here

   # Security: CORS origins (change to your domain)
   CORS_ORIGIN=https://yourfrontend.com,https://app.yourfrontend.com

   # AI Configuration
   AI_REPLY_MAX_PER_MINUTE=30
   AI_MEMORY_MAX_MESSAGES=30
   ```

3. Click **Save Changes**

## Step 4: Deploy

### 4.1 Automatic Deployment

1. Render automatically detects pushes to the `main` branch
2. Deployment starts immediately
3. Monitor progress in **Logs** tab

### 4.2 Manual Deployment (if needed)

1. In service dashboard, click **Manual Deploy**
2. Select branch (`main`) and **Deploy**
3. Monitor logs for errors

### 4.3 Verify Deployment

Once deployment completes:

1. Copy your service URL (e.g., `https://whatsapp-ai-saas.onrender.com`)
2. Test health endpoint:

   ```bash
   curl https://whatsapp-ai-saas.onrender.com/health
   # Expected: {"ok":true,"timestamp":"2024-01-15T..."}
   ```

3. Test root endpoint:

   ```bash
   curl https://whatsapp-ai-saas.onrender.com/
   # Expected: {"ok":true,"name":"whatsapp-ai-saas-backend",...}
   ```

4. Access API documentation:
   ```
   https://whatsapp-ai-saas.onrender.com/api/docs
   ```

## Step 5: Configure Frontend

Update your frontend application with the backend URL:

```env
REACT_APP_API_URL=https://whatsapp-ai-saas.onrender.com/api
```

Or in your API client:

```typescript
const API_URL = "https://whatsapp-ai-saas.onrender.com/api";
```

## Step 6: Monitoring & Maintenance

### 6.1 View Logs

In Render.com dashboard:

1. Select your service
2. Click **Logs** tab
3. View real-time application logs
4. Set log retention: **Settings** → **Log Retention** (free: 24 hours)

### 6.2 Check Health

API endpoints for monitoring:

- **Health check:** `GET /health` → `{ok:true,timestamp:...}`
- **Status:** `GET /` → Full service info + version

### 6.3 Database Monitoring

In MongoDB Atlas:

1. **Monitoring** tab shows:
   - Connection count
   - Operations (connections, reads, writes)
   - Storage usage
   - Errors/warnings

### 6.4 View Metrics

In Render.com:

1. **Metrics** tab shows:
   - CPU usage
   - Memory usage
   - Requests per second
   - Response time

## Troubleshooting

### Issue: "Deployment Failed - Build Error"

**Solution:**

1. Check logs for specific error
2. Ensure `npm run build` passes locally:
   ```bash
   npm run build
   ```
3. Verify all dependencies in `package.json`
4. Check TypeScript errors with `npm run type-check`

### Issue: "Cannot connect to MongoDB"

**Solution:**

1. Verify `MONGO_URI` in environment variables
2. Check MongoDB Atlas **Network Access** whitelist includes `0.0.0.0/0`
3. Test connection string locally:
   ```bash
   mongosh "mongodb+srv://user:pass@cluster.mongodb.net/db"
   ```
4. Ensure database user has correct password

### Issue: "CORS errors on frontend"

**Solution:**

1. Update `CORS_ORIGIN` environment variable with your frontend domain
2. Verify format: `https://domain.com` (no trailing slash)
3. For multiple domains: `https://domain1.com,https://domain2.com`
4. Restart service for changes to take effect

### Issue: "Free tier memory exceeded"

**Solution:**

- Render.com free tier has 0.5GB RAM
- Monitor memory in **Metrics** tab
- Upgrade to Paid - [$7/month minimum](https://render.com/pricing)
- Or optimize memory usage:
  - Reduce `AI_MEMORY_MAX_MESSAGES` to 20
  - Clean up old sessions regularly

### Issue: "WhatsApp QR code not connecting"

**Solution:**

1. Ensure service is running: Check `/health` endpoint
2. Verify Baileys library compatibility
3. Check MongoDB session storage is working
4. Review logs for connection errors
5. Restart service: **Settings** → **Restart Instance**

## Performance Optimization

### 6.5 Scale Up (if needed)

1. In **Settings**, upgrade to **Paid** plan
2. Available plan options:
   - **Starter:** $7/month, 0.5GB RAM, 1 shared vCPU
   - **Standard:** $21/month, 1GB RAM, 1 vCPU
   - **Professional:** $115/month, 4GB RAM, 2 vCPU

### 6.6 Enable Auto-scaling

For high traffic applications (Paid plans only):

1. **Settings** → **Instance Count** → Toggle **Horizontal auto-scaling**
2. Set min/max instances based on traffic

### 6.7 Optimize AI Queue

If experiencing rate limit issues:

1. Reduce `AI_REPLY_MAX_PER_MINUTE` environment variable
2. Increase `AI_MEMORY_MAX_MESSAGES` for context efficiency
3. Monitor queue performance in logs

## Security Best Practices

1. **Never commit secrets** to Git
2. **Rotate JWT_SECRET** monthly
   - Update in Render.com environment
   - Invalidate existing tokens by restarting service
3. **Use HTTPS only** - Render enforces SSL/TLS
4. **Whitelist MongoDB IPs** - Update from `0.0.0.0/0` to Render IP ranges for production
5. **Monitor logs** for suspicious activity
6. **Enable database backups** in MongoDB Atlas (paid tier)

## Update Deployment

### To deploy new code changes:

1. Commit and push to `main` branch:

   ```bash
   git add .
   git commit -m "Fix: update feature"
   git push origin main
   ```

2. Render automatically redeploys
3. Monitor logs during deployment
4. Verify endpoints after deployment completes

### Roll back to previous deployment:

1. In Render.com **Deployments** tab
2. Find previous successful deployment
3. Click **Redeploy**
4. Service rolls back to that version

## Database Backups

**MongoDB Atlas Free Tier (M0) does NOT include backups.** For production data safety:

1. Upgrade to M2+ cluster (paid)
2. Enable **Backup** in cluster settings
3. Or manually export data:
   ```bash
   mongodump --uri "mongodb+srv://..." --out ./backup
   ```

## CI/CD Pipeline (Optional)

To add automated testing before deployment:

1. Create `.github/workflows/deploy.yml` in your repository
2. Configure GitHub Actions to run tests on push
3. Only deploy if tests pass

See `GitHub_Actions_Setup.md` for detailed instructions.

## Support & Additional Resources

- **Render.com Docs:** https://render.com/docs
- **MongoDB Atlas:** https://docs.atlas.mongodb.com
- **WhatsApp Web.js:** https://wwebjs.dev
- **Google Gemini API:** https://ai.google.dev

## Checklist Before Production

- [ ] Secret keys generated (JWT, Encryption)
- [ ] MongoDB Atlas cluster created and configured
- [ ] CORS_ORIGIN set to your frontend domain
- [ ] Service deployed successfully to Render.com
- [ ] Health endpoint (`/health`) returns 200 OK
- [ ] Frontend can call backend API without CORS errors
- [ ] WhatsApp QR code scans and connects successfully
- [ ] Messages flow correctly through the system
- [ ] Logs are being collected in Render.com dashboard
- [ ] Error tracking is enabled (optional: integrate Sentry)

---

**Last Updated:** January 2024
**Maintained By:** WhatsApp AI SaaS Team
