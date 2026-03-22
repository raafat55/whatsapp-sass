# Production Readiness Checklist

Complete this checklist before deploying to production to ensure security, reliability, and performance.

## 1. Security & Secrets

- [ ] **JWT_SECRET** generated and set (min 32 characters)
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] **ENCRYPTION_KEY** generated and set (exactly 64 hex characters)

  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

- [ ] All secrets stored in Render.com environment variables (NOT in `.env` file)

- [ ] `.env` file added to `.gitignore` and NOT committed

- [ ] Review `package.json` for vulnerable dependencies

  ```bash
  npm audit --production
  ```

- [ ] CORS_ORIGIN configured for your production domain

  ```env
  CORS_ORIGIN=https://yourdomain.com
  ```

- [ ] No hardcoded credentials in codebase
  - Search for: `password`, `key`, `secret`, `token`

  ```bash
  grep -r "password\|API_KEY\|SECRET" src/ --exclude-dir=node_modules
  ```

- [ ] Removed any debug/console.log statements
  ```bash
  grep -r "console.log\|debugger" src/ --exclude-dir=node_modules
  ```

## 2. Database Configuration

- [ ] MongoDB Atlas cluster created
  - [ ] Cluster tier: M0+ (recommended M2+ for production)
  - [ ] Automatic backups enabled (M2+ tier)
  - [ ] Network access configured (whitelist Render.com IP or 0.0.0.0/0)
- [ ] Database user created with strong password (25+ characters)
  - [ ] User has read/write permissions to correct database
  - [ ] User password stored securely (NOT in code)

- [ ] MONGO_URI tested and verified

  ```bash
  mongosh "your-connection-string"
  ```

- [ ] Database indexes created (automatic with Mongoose schemas)

- [ ] Data retention policy configured (backups, archival, deletion)

## 3. Application Configuration

- [ ] NODE_ENV set to `production`

- [ ] PORT set to 3000 (or verified with Render.com)

- [ ] AI_REPLY_MAX_PER_MINUTE tuned for expected load (default: 30)

- [ ] AI_MEMORY_MAX_MESSAGES optimized (default: 30, max: 100)

- [ ] Error handling comprehensive
  - [ ] Global error middleware in place
  - [ ] Unhandled promise rejections caught
  - [ ] Uncaught exceptions handled
  - [ ] Graceful shutdown implemented

- [ ] Request timeouts configured (30 seconds)

- [ ] Rate limiting configured
  - [ ] Per-IP limits (optional)
  - [ ] Per-user limits (if applicable)

## 4. API & Endpoints

- [ ] Health check endpoint working: `GET /health`

  ```bash
  curl https://yourdomain.com/health
  ```

- [ ] Root endpoint accessible: `GET /`

- [ ] Swagger documentation accessible: `GET /api/docs`

- [ ] OpenAPI spec valid: `GET /api/openapi.json`

- [ ] All API endpoints tested with Postman/Insomnia
  - [ ] Auth endpoints (login, register, token refresh)
  - [ ] Session endpoints (list, create, start, stop)
  - [ ] Message endpoints (send, history)
  - [ ] Contact endpoints (list, sync)
  - [ ] Agent endpoints (list, create, update)

- [ ] CORS headers correctly returned on cross-origin requests

- [ ] 404 responses return proper error format

- [ ] Errors don't expose sensitive information (stack traces)

## 5. Authentication & Authorization

- [ ] JWT token validation working
  - [ ] Valid tokens accepted
  - [ ] Expired tokens rejected
  - [ ] Invalid tokens rejected
  - [ ] Missing tokens rejected

- [ ] Authorization middleware enforcing user isolation
  - [ ] Users can only access their own data
  - [ ] No privilege escalation possible
  - [ ] Admin endpoints (if any) are protected

- [ ] Password requirements enforced (if registration enabled)
  - [ ] Min 8 characters
  - [ ] Complexity requirements
  - [ ] Bcrypt hashing verified

- [ ] Session tokens stored securely
  - [ ] HttpOnly flag set (in cookies, if used)
  - [ ] Secure flag set (HTTPS only)
  - [ ] SameSite attribute set

## 6. WhatsApp Integration

- [ ] Baileys version compatible with WhatsApp

  ```bash
  npm list @whiskeysockets/baileys
  ```

- [ ] WhatsApp session management robust
  - [ ] Sessions auto-restore on startup (if enabled)
  - [ ] Graceful handling of disconnections
  - [ ] Auto-reconnect with exponential backoff
  - [ ] QR code properly stored and returned

- [ ] Message queuing working
  - [ ] No message loss on restart
  - [ ] Queue processing visible in logs
  - [ ] Rate limiting prevents overload

- [ ] Contact sync functioning
  - [ ] Contacts loaded on session start
  - [ ] New contacts added automatically
  - [ ] Contact updates reflected in DB

## 7. AI Integration

- [ ] Gemini API key encrypted in database
  - [ ] ENCRYPTION_KEY correct length (64 hex)
  - [ ] Decryption working in production

- [ ] Gemini API calls working
  - [ ] API key validation on agent creation
  - [ ] Response generation tested
  - [ ] Error handling for API failures

- [ ] Professional features configured
  - [ ] Typing indicators working (if enabled)
  - [ ] Emoji reactions working (if enabled)
  - [ ] Response variants applied (if enabled)
  - [ ] Memory retention policy working

- [ ] Rate limiting prevents API quota exceeded errors
  - [ ] AI_REPLY_MAX_PER_MINUTE enforced
  - [ ] Response times acceptable

## 8. Logging & Monitoring

- [ ] Structured logging implemented (Pino)
  - [ ] JSON logs for easy parsing
  - [ ] Log levels configured (development vs production)
  - [ ] Sensitive data NOT logged (passwords, API keys)

- [ ] Logs collected in centralized location
  - [ ] Render.com logs accessible
  - [ ] Log retention configured (min 7 days)
  - [ ] Log rotation configured (if self-hosted)

- [ ] Monitoring & alerting set up
  - [ ] Health check endpoints monitored
  - [ ] Error rates tracked
  - [ ] Performance metrics collected
  - [ ] Alerts configured for critical errors

- [ ] Error tracking integrated (optional)
  - [ ] Sentry, LogRocket, or similar
  - [ ] Error rates visible
  - [ ] Stack traces captured

## 9. Performance & Scalability

- [ ] Build verified to complete successfully

  ```bash
  npm run build
  ```

- [ ] Cold start time acceptable
  - [ ] Render.com deployment <60 seconds
  - [ ] Server ready to accept requests

- [ ] Memory usage within Render.com limits
  - [ ] Free tier: <512MB
  - [ ] Starter: <1GB
  - [ ] Monitor actual usage in Render metrics

- [ ] Response times acceptable
  - [ ] Health check: <100ms
  - [ ] API endpoints: <1s average
  - [ ] AI generation: <3s average

- [ ] Database query optimization
  - [ ] Queries with indexes used
  - [ ] N+1 queries eliminated
  - [ ] Pagination implemented for large datasets

- [ ] Queue processing efficient
  - [ ] Concurrency set appropriately (default: 6)
  - [ ] No queue starvation
  - [ ] Queue metrics visible in logs

## 10. Deployment Configuration

- [ ] Render.com service created
  - [ ] Web service configured correctly
  - [ ] Build command: `npm install && npm run build`
  - [ ] Start command: `npm run start`
  - [ ] Node version: 20.x or higher

- [ ] All environment variables configured in Render.com
  - [ ] No .env file needed
  - [ ] Variables not visible in logs

- [ ] Deploy hook configured (for CI/CD)
  - [ ] GitHub Actions workflow created
  - [ ] Webhook URL stored as repository secret

- [ ] Custom domain configured (if applicable)
  - [ ] Domain SSL certificate valid
  - [ ] DNS records pointing to Render.com

- [ ] Health check configured in Render.com
  - [ ] Path: `/health`
  - [ ] Protocol: HTTPS
  - [ ] Check interval: 30-60 seconds

## 11. Backup & Disaster Recovery

- [ ] Database backup strategy documented
  - [ ] MongoDB Atlas automatic backups (if paid tier)
  - [ ] Manual backup script (if free tier)
  - [ ] Backup frequency (daily, weekly, etc.)

- [ ] Backup restoration tested
  - [ ] Verified backups can be restored
  - [ ] RTO (Recovery Time Objective) acceptable
  - [ ] RPO (Recovery Point Objective) documented

- [ ] Disaster recovery plan documented
  - [ ] Steps to restore from backup
  - [ ] Contact information for database admin
  - [ ] Rollback procedure documented

## 12. Testing & Validation

- [ ] Unit tests pass (if applicable)

  ```bash
  npm test
  ```

- [ ] Integration tests pass (if applicable)

  ```bash
  npm run test:integration
  ```

- [ ] End-to-end flow tested manually
  - [ ] Can create WhatsApp session
  - [ ] Can scan QR code
  - [ ] Can send message
  - [ ] Can create AI agent
  - [ ] Can generate AI reply

- [ ] Load testing performed (if high traffic expected)
  - [ ] Acceptable response times under load
  - [ ] No errors under concurrent requests

- [ ] Browser/client testing
  - [ ] Frontend can call backend API
  - [ ] CORS errors resolved
  - [ ] QR code displays correctly

## 13. Documentation

- [ ] README.md up to date
  - [ ] Installation instructions clear
  - [ ] Usage examples included
  - [ ] Troubleshooting section included

- [ ] DEPLOYMENT.md complete
  - [ ] All steps tested by another person
  - [ ] Expected outcomes documented
  - [ ] Troubleshooting section included

- [ ] API documentation generated
  - [ ] Swagger endpoint working
  - [ ] OpenAPI spec valid
  - [ ] Example requests provided

- [ ] Environment variables documented
  - [ ] Purpose of each variable
  - [ ] Format/constraints noted
  - [ ] Example values provided

## 14. Communication & Handoff

- [ ] Stakeholders notified of deployment date/time

- [ ] Rollback plan communicated
  - [ ] Team knows how to rollback
  - [ ] Rollback time: <15 minutes

- [ ] On-call support assigned for first week

- [ ] Post-deployment review scheduled (24-48 hours after)

## 15. Final Deployment Steps

1. **Pre-deployment check** (same day)

   ```bash
   npm run build        # Verify build succeeds
   npm test            # Run all tests
   npm audit           # Final security check
   ```

2. **Deploy to staging** (if available)
   - Verify all endpoints
   - Test user flows
   - Check logs for errors

3. **Deploy to production**
   - Push to main branch
   - Monitor logs for errors
   - Verify health endpoint
   - Test critical user flows

4. **Post-deployment** (1 hour after)
   - Monitor error rates
   - Check response times
   - Verify database connections
   - Monitor costs (especially API usage)

5. **Post-deployment** (24 hours after)
   - Verify all features working
   - Check database growth
   - Review logs for unexpected errors
   - Update documentation if needed

## Sign-Off

- [ ] Infrastructure Team: ********\_\_******** Date: **\_\_\_\_**
- [ ] Development Team: ********\_\_******** Date: **\_\_\_\_**
- [ ] QA Team: ********\_\_******** Date: **\_\_\_\_**
- [ ] Product Owner: ********\_\_******** Date: **\_\_\_\_**

---

**Production Deployment Date:** ********\_\_\_********

**Production URL:** ********\_\_\_********

**Deployed Version:** ********\_\_\_********

**Notes:**

```
[Add any important notes, known issues, or special configurations]
```

---

**Document Last Updated:** January 2024
**Next Review:** [Schedule quarterly review]
