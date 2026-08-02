# Troubleshooting

Covers Cloudflare Pages deployment issues (frontend) and backend systemd service issues (Raspberry Pi). For Cloudflare Tunnel-specific issues, see [CLOUDFLARE_TUNNEL_SETUP.md](./CLOUDFLARE_TUNNEL_SETUP.md#troubleshooting).

## Cloudflare Pages: "Project not found" (404)

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

## Cloudflare Pages: "wrangler: not found" in build logs

If you see this error in Cloudflare Pages build logs, it means Cloudflare Pages is trying to run a deploy command in its build environment.

### Solution: Configure for Direct Upload

1. Go to your Cloudflare Pages project in the dashboard
2. Navigate to **Settings** → **Builds & deployments**
3. Make sure the project is set to **"Direct Upload"** mode, not connected to a Git repository
4. Or if connected to Git, disable automatic deployments and let GitHub Actions handle it

**Important:** When using GitHub Actions for deployment, you should either:

- Use **Direct Upload** mode in Cloudflare Pages (recommended)
- Or disable automatic builds/deployments if connected to Git

## Backend service (systemd, Raspberry Pi)

Setup: `sudo ./scripts/setup-backend-service.sh` from the repo root on the Pi. All commands below assume a deployment at `/home/pi/net-traffic` — adjust the path if yours differs.

### Service won't start

1. `sudo systemctl status netinsight-backend` and `sudo journalctl -u netinsight-backend -n 50 --no-pager`
2. Confirm the venv exists: `ls -la backend/venv` — if missing, recreate it (`python3 -m venv venv && source venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt`).
3. `sudo systemctl cat netinsight-backend` — verify `ExecStart` points at `backend/venv/bin/python`.
4. Try running manually to surface the real error: `cd backend && source venv/bin/activate && python main.py`. If this works but the service doesn't, it's a path/permission mismatch in the unit file.

### Permission denied errors

- Check ownership: `ls -la /home/pi/net-traffic/backend/` (should be owned by `pi`); fix with `sudo chown -R pi:pi /home/pi/net-traffic`.
- Database files must be writable by the service user: `ls -la backend/*.db`.

### Port already in use

```bash
sudo lsof -i :8000   # or: sudo netstat -tulpn | grep 8000
sudo systemctl stop netinsight-backend   # if it's a stale instance
```

Or change the port: edit `PORT=8000` in `backend/.env`, then `sudo systemctl restart netinsight-backend`.

### Import errors

- Confirm the service's `ExecStart` uses `backend/venv/bin/python` (`sudo systemctl cat netinsight-backend | grep ExecStart`).
- Reinstall deps: `pip install --upgrade pip && pip install -r requirements.txt`.
- Check Python version is 3.10+: `backend/venv/bin/python --version`.

### Service keeps restarting

`sudo journalctl -u netinsight-backend -n 100 --no-pager` for tracebacks; run manually (`python main.py`) to see the error directly; verify `backend/.env` has all required variables set.

### Database locked errors

```bash
sudo systemctl stop netinsight-backend
lsof backend/*.db                       # check for stale connections
rm -f backend/*.db-journal backend/*.db-wal
sudo systemctl start netinsight-backend
```

### Network interface / packet capture issues

```bash
grep NETWORK_INTERFACE backend/.env
ip link show                            # list available interfaces
# fix NETWORK_INTERFACE in backend/.env, then:
sudo systemctl restart netinsight-backend

# verify capture capability is set:
getcap backend/venv/bin/python3         # expect: cap_net_raw,cap_net_admin=eip
sudo setcap cap_net_raw,cap_net_admin=eip backend/venv/bin/python3   # if missing
```

### Manual service management

```bash
sudo systemctl {start,stop,restart,enable,disable} netinsight-backend
sudo journalctl -u netinsight-backend -f       # follow logs
sudo journalctl -u netinsight-backend -n 100   # last 100 lines
sudo journalctl -u netinsight-backend -b       # since boot
```

## Still Having Issues?

If the automatic Cloudflare Pages project creation isn't working, the quickest solution is to **manually create the project in the Cloudflare Dashboard** (see above). Once the project exists, all future deployments will work automatically.
