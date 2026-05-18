# Deployment Guide

## Standard Deploy (auto from GitHub)

Pushing to `main` triggers a Netlify auto-deploy. No manual steps needed.

## Preview Deploys (branch deploys)

1. Create a feature branch:
   ```bash
   git checkout -b feature/my-change
   ```

2. Push the branch:
   ```bash
   git push -u origin feature/my-change
   ```

3. Netlify auto-creates a preview deploy at:
   `https://feature-my-change--<site-name>.netlify.app`

4. Test the preview URL. When satisfied, merge to main.

### Enable Branch Deploys (if not enabled)

In Netlify dashboard: Site > Configuration > Build & deploy > Branches and deploy contexts > Set "Branch deploys" to "All".

Or via API:
```bash
curl -s -X PATCH "https://api.netlify.com/api/v1/sites/<SITE_ID>" \
  -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"build_settings": {"allowed_branches": ["main"], "branch_deploy_custom_domain": null}}'
```

## Rollback

### Via Dashboard
1. Go to Netlify > Site > Deploys
2. Find the last known-good deploy
3. Click "Publish deploy"

### Via API
```bash
# List recent deploys
curl -s "https://api.netlify.com/api/v1/sites/<SITE_ID>/deploys?per_page=10" \
  -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" | \
  python3 -c "import sys,json; [print(f'{d[\"id\"]} | {d[\"created_at\"]} | {d[\"state\"]}') for d in json.load(sys.stdin)]"

# Rollback to a specific deploy
curl -s -X POST "https://api.netlify.com/api/v1/sites/<SITE_ID>/deploys/<DEPLOY_ID>/restore" \
  -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN"
```

## Environment Variables

Set via Netlify dashboard (Site > Configuration > Environment variables), NOT in code:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (for Netlify functions only)
- `SUPABASE_ANON_KEY`
- `ZAPI_INSTANCE`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`
- `ARTHUR_WHATSAPP`

## Pre-Deploy Checklist

1. Run security check: `bash templates/security-check.sh <project-dir>`
2. Test locally: `npx serve .`
3. Verify membership gate works
4. Check no secrets in frontend bundle
5. Confirm RLS enabled on all Supabase tables
