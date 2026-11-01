# Troubleshooting

Backend service and packet-capture issues on the Raspberry Pi. Cloudflare Pages, tunnel and
CORS/WebSocket issues are covered in [DEPLOYMENT.md](./DEPLOYMENT.md) (see its
troubleshooting sections). For a one-shot health report on the Pi, run
`./scripts/diagnose-backend.sh`.

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

```

The systemd unit grants `CAP_NET_RAW`/`CAP_NET_ADMIN` itself (`AmbientCapabilities`), so the
service needs no `setcap`. Only for running `python main.py` **by hand** without sudo, set
file capabilities on the real interpreter — `venv/bin/python3` is a symlink, and `setcap` on
a symlink fails:

```bash
PY=$(readlink -f backend/venv/bin/python3)
sudo setcap cap_net_raw,cap_net_admin=eip "$PY"
getcap "$PY"                            # expect: cap_net_raw,cap_net_admin=eip
```

### Scapy import or "capture not running"

```bash
cd backend && source venv/bin/activate
python -c "from scapy.all import get_if_list; print(get_if_list())"   # import + interfaces
pip install --upgrade scapy             # if the import fails
curl -s localhost:8000/api/capture/status   # backend's own view of capture
```

If the import works but capture stays stopped, check `NETWORK_INTERFACE` is in the list
printed above and look for `scapy`/`capture` errors in
`sudo journalctl -u netinsight-backend -n 100`.

### Manual service management

```bash
sudo systemctl {start,stop,restart,enable,disable} netinsight-backend
sudo journalctl -u netinsight-backend -f       # follow logs
sudo journalctl -u netinsight-backend -n 100   # last 100 lines
sudo journalctl -u netinsight-backend -b       # since boot
```
