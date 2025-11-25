# Troubleshooting Deployment Issues

## Error: "Project not found" (404)

If you're seeing this error, it means the Cloudflare Pages project doesn't exist yet. The workflow should create it automatically, but if it's not working:

### Solution 1: Verify the workflow file is updated

Make sure your `.github/workflows/deploy.yml` file is using Wrangler, not `cloudflare/pages-action`. The current workflow should have:

```yaml
- name: Deploy to Cloudflare Pages
  run: |
    wrangler pages deploy dist ...
```

NOT:
```yaml
- name: Deploy to Cloudflare Pages
  uses: cloudflare/pages-action@v1
```

### Solution 2: Create the project manually (Quick Fix)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Pages** in the sidebar
3. Click **"Create a project"**
4. Select **"Upload assets"** or **"Direct Upload"**
5. Name it: `net-traffic`
6. Click **"Create project"** (you don't need to upload anything)
7. Now run your GitHub Actions workflow again

### Solution 3: Check API Token Permissions

Ensure your API token has:
- **Account** → **Cloudflare Pages** → **Edit**

### Solution 4: Verify Account ID

Double-check that your `CLOUDFLARE_ACCOUNT_ID` secret matches your actual Cloudflare account ID.

## Debugging Steps

1. **Check the workflow logs** - Look at the "Create Cloudflare Pages Project" step output
2. **Verify secrets are set** - Go to GitHub → Settings → Secrets → Actions
3. **Test API token manually**:
   ```bash
   curl -X GET "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/pages/projects" \
     -H "Authorization: Bearer YOUR_API_TOKEN" \
     -H "Content-Type: application/json"
   ```

## Still Having Issues?

If the automatic project creation isn't working, the quickest solution is to **manually create the project in the Cloudflare Dashboard** (Solution 2 above). Once the project exists, all future deployments will work automatically.

