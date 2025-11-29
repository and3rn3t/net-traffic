# Raspberry Pi 5 Installation Checklist

Use this checklist to verify all components are in place for Raspberry Pi 5 deployment.

## ✅ Pre-Installation Checklist

### Hardware

- [ ] Raspberry Pi 5 (4GB RAM or more)
- [ ] MicroSD Card (32GB minimum, Class 10 or better)
- [ ] Power Supply (5V 5A USB-C)
- [ ] Network Connection (Ethernet cable recommended)
- [ ] Optional: USB-to-Ethernet adapter for passive monitoring

### Software

- [ ] Raspberry Pi OS 64-bit installed
- [ ] SSH access configured (or keyboard/monitor available)
- [ ] System updated: `sudo apt update && sudo apt upgrade -y`

## ✅ Docker Installation Checklist

- [ ] Docker installed: `docker --version`
- [ ] Docker Compose installed: `docker compose version`
- [ ] User added to docker group: `groups | grep docker`
- [ ] Docker service running: `sudo systemctl status docker`

## ✅ Project Files Checklist

### Core Files

- [ ] `Dockerfile` (Frontend) - ARM64 optimized
- [ ] `backend/Dockerfile` (Backend) - ARM64 optimized
- [ ] `docker-compose.yml` - ARM64 platform specified
- [ ] `backend/requirements.txt` - All dependencies listed
- [ ] `package.json` - Frontend dependencies

### Scripts

- [ ] `scripts/raspberry-pi-start.sh` - Startup script
- [ ] `scripts/raspberry-pi-update.sh` - Update script
- [ ] `scripts/netinsight.service` - Systemd service file
- [ ] Scripts are executable: `chmod +x scripts/*.sh`

### Configuration

- [ ] `backend/.env.example` - Environment variable template
- [ ] `.env` file created (optional, for custom config)
- [ ] Network interface identified: `ip link show`

### Documentation

- [ ] `docs/RASPBERRY_PI5_QUICK_START.md` - Quick start guide
- [ ] `docs/DEPLOYMENT_RASPBERRY_PI.md` - Full deployment guide
- [ ] `docs/RASPBERRY_PI_OPTIMIZATION.md` - Optimization details
- [ ] `scripts/README.md` - Script documentation

## ✅ Docker Configuration Verification

### Dockerfiles

- [ ] Frontend Dockerfile specifies `--platform=linux/arm64`
- [ ] Backend Dockerfile specifies `--platform=linux/arm64`
- [ ] Both use multi-stage builds for optimization

### Docker Compose

- [ ] `platform: linux/arm64` specified for both services
- [ ] `platforms: [linux/arm64]` in build sections
- [ ] Image tags defined for both services
- [ ] Restart policies set to `unless-stopped`
- [ ] Health checks configured
- [ ] Network and volumes configured

## ✅ Startup Verification

### Initial Startup

- [ ] Project cloned/copied to Raspberry Pi
- [ ] Scripts made executable
- [ ] Startup script runs successfully: `./scripts/raspberry-pi-start.sh`
- [ ] Images build without errors
- [ ] Containers start successfully: `docker compose ps`
- [ ] Both containers show as "Up"

### Service Verification

- [ ] Backend health check passes: `curl http://localhost:8000/api/health`
- [ ] Frontend accessible: `curl http://localhost/`
- [ ] API documentation accessible: `curl http://localhost:8000/docs`
- [ ] Logs show no errors: `docker compose logs`

### Network Access

- [ ] Pi IP address identified: `hostname -I`
- [ ] Frontend accessible from network: `http://<pi-ip>/`
- [ ] Backend accessible from network: `http://<pi-ip>:8000/api/health`
- [ ] Firewall configured (if needed): `sudo ufw allow 80/tcp && sudo ufw allow 8000/tcp`

## ✅ Automatic Startup Configuration

### Systemd Service

- [ ] Service file copied: `sudo cp scripts/netinsight.service /etc/systemd/system/`
- [ ] Paths updated in service file to match installation
- [ ] Service enabled: `sudo systemctl enable netinsight`
- [ ] Service starts on boot: `sudo systemctl status netinsight`
- [ ] Service logs accessible: `sudo journalctl -u netinsight -f`

### Image Updates

- [ ] Startup script uses `--pull` flag for latest base images
- [ ] Update script available: `./scripts/raspberry-pi-update.sh`
- [ ] Service pulls latest images on boot

## ✅ Functionality Verification

### Backend API

- [ ] Health endpoint responds: `GET /api/health`
- [ ] Devices endpoint works: `GET /api/devices`
- [ ] Flows endpoint works: `GET /api/flows`
- [ ] Analytics endpoint works: `GET /api/analytics`
- [ ] WebSocket connection works: `WS /ws`

### Frontend

- [ ] Dashboard loads in browser
- [ ] No console errors in browser
- [ ] API connection successful (if using real API mode)
- [ ] Real-time updates working (if WebSocket enabled)

### Packet Capture (Optional)

- [ ] Network interface configured
- [ ] Promiscuous mode enabled (if needed)
- [ ] Permissions set for packet capture
- [ ] Capture can be started: `POST /api/capture/start`
- [ ] Packets are being captured

## ✅ Performance Verification

### Resource Usage

- [ ] CPU usage reasonable: `htop`
- [ ] Memory usage acceptable: `free -h`
- [ ] Disk space sufficient: `df -h`
- [ ] No memory leaks observed

### Container Performance

- [ ] Containers restart automatically on failure
- [ ] Health checks passing
- [ ] No excessive logging
- [ ] Response times acceptable

## ✅ Security Checklist

- [ ] Default Pi password changed
- [ ] SSH key authentication configured (recommended)
- [ ] Firewall configured (if applicable)
- [ ] CORS origins properly configured
- [ ] Rate limiting enabled
- [ ] Debug mode disabled in production
- [ ] HTTPS configured (for production)

## ✅ Backup & Maintenance

- [ ] Database backup strategy planned
- [ ] Update process documented
- [ ] Monitoring configured (optional)
- [ ] Log rotation configured (optional)

## 📝 Notes

- First build takes 5-10 minutes (downloads base images)
- Subsequent starts take ~30 seconds
- Images are automatically updated on boot (if systemd service configured)
- All scripts support both `docker compose` (v2) and `docker-compose` (v1)

## 🆘 Troubleshooting

If any item fails:

1. **Docker issues**: Check `sudo systemctl status docker`
2. **Build failures**: Check `docker compose logs`
3. **Permission errors**: Verify user in docker group
4. **Network issues**: Check firewall and port availability
5. **Service issues**: Check `sudo journalctl -u netinsight`

## 📚 Reference Documentation

- Quick Start: `docs/RASPBERRY_PI5_QUICK_START.md`
- Full Guide: `docs/DEPLOYMENT_RASPBERRY_PI.md`
- Optimization: `docs/RASPBERRY_PI_OPTIMIZATION.md`
- Scripts: `scripts/README.md`

---

**Status**: ⬜ Not Started | 🟡 In Progress | ✅ Complete
