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

## Error: "wrangler: not found" in Cloudflare Pages

If you see this error in Cloudflare Pages build logs, it means Cloudflare Pages is trying to run a deploy command in its build environment.

### Solution: Configure for Direct Upload

1. Go to your Cloudflare Pages project in the dashboard
2. Navigate to **Settings** → **Builds & deployments**
3. Make sure the project is set to **"Direct Upload"** mode, not connected to a Git repository
4. Or if connected to Git, disable automatic deployments and let GitHub Actions handle it

**Important:** When using GitHub Actions for deployment, you should either:

- Use **Direct Upload** mode in Cloudflare Pages (recommended)
- Or disable automatic builds/deployments if connected to Git

## Still Having Issues?

If the automatic project creation isn't working, the quickest solution is to **manually create the project in the Cloudflare Dashboard** (Solution 2 above). Once the project exists, all future deployments will work automatically.
