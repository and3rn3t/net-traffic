# Backend Service Troubleshooting Guide

This guide helps you troubleshoot issues with the NetInsight backend service on Raspberry Pi.

## Quick Setup

To set up the backend as a systemd service:

```bash
cd /home/pi/net-traffic
sudo ./scripts/setup-backend-service.sh
```

## Common Issues

### Service Won't Start

1. **Check service status:**

   ```bash
   sudo systemctl status netinsight-backend
   ```

2. **View detailed logs:**

   ```bash
   sudo journalctl -u netinsight-backend -n 50 --no-pager
   ```

3. **Check if virtual environment exists:**

   ```bash
   ls -la /home/pi/net-traffic/backend/venv
   ```

   If missing, create it:

   ```bash
   cd /home/pi/net-traffic/backend
   python3 -m venv venv
   source venv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **Verify Python path in service:**

   ```bash
   sudo systemctl cat netinsight-backend
   ```

   Check that the `ExecStart` path points to the correct virtual environment.

5. **Test running manually:**
   ```bash
   cd /home/pi/net-traffic/backend
   source venv/bin/activate
   python main.py
   ```
   If this works but the service doesn't, it's likely a path or permission issue.

### Permission Denied Errors

1. **Check file ownership:**

   ```bash
   ls -la /home/pi/net-traffic/backend/
   ```

   Files should be owned by the `pi` user (or your user).

2. **Fix ownership if needed:**

   ```bash
   sudo chown -R pi:pi /home/pi/net-traffic
   ```

3. **Check database permissions:**
   ```bash
   ls -la /home/pi/net-traffic/backend/*.db
   ```
   Database files should be writable by the service user.

### Port Already in Use

If port 8000 is already in use:

1. **Find what's using the port:**

   ```bash
   sudo lsof -i :8000
   # or
   sudo netstat -tulpn | grep 8000
   ```

2. **Stop conflicting service:**

   ```bash
   # If it's another instance of the backend
   sudo systemctl stop netinsight-backend

   # Or kill the process
   sudo kill <PID>
   ```

3. **Change port in .env file:**
   ```bash
   nano /home/pi/net-traffic/backend/.env
   # Change PORT=8000 to PORT=8001
   sudo systemctl restart netinsight-backend
   ```

### Import Errors

If you see Python import errors:

1. **Verify virtual environment is activated in service:**
   Check the service file:

   ```bash
   sudo systemctl cat netinsight-backend | grep ExecStart
   ```

   Should show: `/home/pi/net-traffic/backend/venv/bin/python`

2. **Reinstall dependencies:**

   ```bash
   cd /home/pi/net-traffic/backend
   source venv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

3. **Check Python version:**
   ```bash
   /home/pi/net-traffic/backend/venv/bin/python --version
   ```
   Should be Python 3.10 or higher.

### Service Keeps Restarting

If the service keeps restarting (check with `systemctl status`):

1. **View recent logs:**

   ```bash
   sudo journalctl -u netinsight-backend -n 100 --no-pager
   ```

2. **Check for errors in logs:**
   Look for Python tracebacks or error messages.

3. **Test manually to see the error:**

   ```bash
   cd /home/pi/net-traffic/backend
   source venv/bin/activate
   python main.py
   ```

4. **Check .env file:**
   ```bash
   cat /home/pi/net-traffic/backend/.env
   ```
   Ensure all required variables are set.

### Database Locked Errors

1. **Stop the service:**

   ```bash
   sudo systemctl stop netinsight-backend
   ```

2. **Check for stale database connections:**

   ```bash
   lsof /home/pi/net-traffic/backend/*.db
   ```

3. **Remove lock files if they exist:**

   ```bash
   rm -f /home/pi/net-traffic/backend/*.db-journal
   rm -f /home/pi/net-traffic/backend/*.db-wal
   ```

4. **Restart service:**
   ```bash
   sudo systemctl start netinsight-backend
   ```

### Network Interface Issues

If packet capture isn't working:

1. **Check network interface in .env:**

   ```bash
   grep NETWORK_INTERFACE /home/pi/net-traffic/backend/.env
   ```

2. **List available interfaces:**

   ```bash
   ip link show
   ```

3. **Update .env with correct interface:**

   ```bash
   nano /home/pi/net-traffic/backend/.env
   # Update NETWORK_INTERFACE=eth0 to your interface
   sudo systemctl restart netinsight-backend
   ```

4. **Check packet capture permissions:**

   ```bash
   getcap /home/pi/net-traffic/backend/venv/bin/python3
   ```

   Should show: `cap_net_raw,cap_net_admin=eip`

   If not, set it:

   ```bash
   sudo setcap cap_net_raw,cap_net_admin=eip /home/pi/net-traffic/backend/venv/bin/python3
   ```

## Manual Service Management

### Start the service:

```bash
sudo systemctl start netinsight-backend
```

### Stop the service:

```bash
sudo systemctl stop netinsight-backend
```

### Restart the service:

```bash
sudo systemctl restart netinsight-backend
```

### Enable on boot:

```bash
sudo systemctl enable netinsight-backend
```

### Disable on boot:

```bash
sudo systemctl disable netinsight-backend
```

### View logs in real-time:

```bash
sudo journalctl -u netinsight-backend -f
```

### View last 100 log lines:

```bash
sudo journalctl -u netinsight-backend -n 100
```

### View logs since boot:

```bash
sudo journalctl -u netinsight-backend -b
```

## Service File Location

The service file is located at:

- Source: `/home/pi/net-traffic/scripts/netinsight-backend.service`
- Installed: `/etc/systemd/system/netinsight-backend.service`

To edit the service file:

```bash
sudo nano /etc/systemd/system/netinsight-backend.service
sudo systemctl daemon-reload
sudo systemctl restart netinsight-backend
```

## Testing the Backend

Once the service is running:

1. **Check health endpoint:**

   ```bash
   curl http://localhost:8000/api/health
   ```

2. **Check API docs:**
   Open in browser: `http://localhost:8000/docs`

3. **Check capture status:**
   ```bash
   curl http://localhost:8000/api/capture/status
   ```

## Still Having Issues?

1. **Check all logs:**

   ```bash
   sudo journalctl -u netinsight-backend --since "1 hour ago" | less
   ```

2. **Verify file paths:**

   ```bash
   ls -la /home/pi/net-traffic/backend/
   ls -la /home/pi/net-traffic/backend/venv/bin/python*
   ```

3. **Test Python directly:**

   ```bash
   /home/pi/net-traffic/backend/venv/bin/python --version
   /home/pi/net-traffic/backend/venv/bin/python -c "import fastapi; print('FastAPI OK')"
   ```

4. **Reinstall service:**
   ```bash
   sudo systemctl stop netinsight-backend
   sudo systemctl disable netinsight-backend
   sudo rm /etc/systemd/system/netinsight-backend.service
   sudo systemctl daemon-reload
   sudo ./scripts/setup-backend-service.sh
   ```
