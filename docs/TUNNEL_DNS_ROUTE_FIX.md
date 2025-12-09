# Fix: Cannot Determine Origin Certificate Path

## Problem

When running `cloudflared tunnel route dns` with `sudo`, you see:

```
ERR Cannot determine default origin certificate path. No file cert.pem in [~/.cloudflared ...]
```

## Cause

When you use `sudo`, the home directory (`~`) changes from `/home/pi` to `/root`. Cloudflared looks for `cert.pem` in `/root/.cloudflared/` instead of `/home/pi/.cloudflared/`.

## Solution

**Run cloudflared commands as the `pi` user, not as root:**

### Option 1: Run Without Sudo

DNS route creation doesn't require root privileges:

```bash
# Run as pi user (don't use sudo)
cloudflared tunnel route dns netinsight-backend net-backend.andernet.dev
```

### Option 2: Use sudo -u pi

If you need to run from a sudo script, use `sudo -u pi`:

```bash
# Run as pi user via sudo
sudo -u pi cloudflared tunnel route dns netinsight-backend net-backend.andernet.dev
```

### Option 3: Set Environment Variable

Specify the cert path explicitly:

```bash
# Set cert path and run
export TUNNEL_ORIGIN_CERT=/home/pi/.cloudflared/cert.pem
cloudflared tunnel route dns netinsight-backend net-backend.andernet.dev
```

Or with sudo:

```bash
sudo -u pi env TUNNEL_ORIGIN_CERT=/home/pi/.cloudflared/cert.pem cloudflared tunnel route dns netinsight-backend net-backend.andernet.dev
```

## Quick Fix for Your Situation

Since you're already logged in as `pi`, just run without sudo:

```bash
# Create DNS route (no sudo needed)
cloudflared tunnel route dns netinsight-backend net-backend.andernet.dev

# Verify it was created
cloudflared tunnel route dns list
```

Then continue with the service setup:

```bash
# The service setup script will now skip DNS route creation if it exists
sudo ./scripts/setup-cloudflared-service.sh
```

## Verify Cert File Location

Check where your cert.pem is:

```bash
# As pi user
ls -la ~/.cloudflared/cert.pem
# Should show: /home/pi/.cloudflared/cert.pem

# If you're root (via sudo)
ls -la ~/.cloudflared/cert.pem
# Will show: /root/.cloudflared/cert.pem (wrong location!)
```

## Why This Happens

- `cloudflared tunnel login` saves cert.pem to `~/.cloudflared/cert.pem`
- When you run as `pi`, `~` = `/home/pi`
- When you run as `root` (via sudo), `~` = `/root`
- Cloudflared looks for cert in the current user's home directory

## Prevention

Always run cloudflared commands (login, create, route) as the same user that will run the service. In this case, use the `pi` user.
