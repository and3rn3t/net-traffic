# UniFi Port Mirroring Setup for NetInsight

## Your Configuration

- **Source Port**: Port 9 (Internet/WAN connection)
- **Destination Port**: Port 8 (Raspberry Pi monitoring port)
- **Status**: ✅ Already configured in UniFi Controller

## Quick Setup Checklist

- [ ] Connect Raspberry Pi 5 Ethernet to UniFi Switch Port 8
- [ ] Enable promiscuous mode on Pi network interface
- [ ] Verify port mirroring is working with tcpdump
- [ ] Configure NetInsight to use correct interface
- [ ] Start packet capture service

## Step-by-Step Setup

### 1. Physical Connection

Connect your Raspberry Pi 5's Ethernet port to **Port 8** on your UniFi switch using a standard Ethernet cable (Cat5e or better).

```
Internet → Port 9 (Source) → UniFi Switch
                              ↓
                        Port 8 (Destination) → Raspberry Pi 5 eth0
```

### 2. Verify Port Mirroring in UniFi Controller

1. Open UniFi Controller (web interface)
2. Navigate to: **Settings** → **Switches** → **[Your Switch]**
3. Go to **Ports** section
4. Find **Port Mirroring** configuration
5. Verify:
   - Source Port: **Port 9**
   - Destination Port: **Port 8**
   - Status: **Active** or **Enabled**

### 3. Configure Raspberry Pi Network Interface

```bash
# SSH into your Raspberry Pi 5

# Identify the network interface
ip link show
# Look for: eth0 (or similar Ethernet interface)

# Enable promiscuous mode (REQUIRED for packet capture)
sudo ip link set eth0 promisc on

# Verify promiscuous mode is enabled
ip link show eth0
# Should show: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 ... promiscuity 1

# Make promiscuous mode persistent (optional, add to /etc/network/interfaces)
# Or create systemd service to enable on boot
```

**Note**: Port 8 may not get an IP address via DHCP - this is **NORMAL** for port mirroring. The Pi can use WiFi or another interface for management/SSH access.

### 4. Test Port Mirroring

```bash
# Install tcpdump if not already installed
sudo apt-get update
sudo apt-get install tcpdump

# Test packet capture (should see traffic from Port 9)
sudo tcpdump -i eth0 -c 10 -v
# Press Ctrl+C after seeing packets

# If you see packets, port mirroring is working! ✅
# If no packets, check UniFi Controller configuration
```

### 5. Configure NetInsight

```bash
# Navigate to backend directory
cd /path/to/net-traffic/backend

# Edit .env file
nano .env

# Set network interface (usually eth0)
NETWORK_INTERFACE=eth0

# Save and exit (Ctrl+X, Y, Enter)
```

### 6. Start Packet Capture

```bash
# Start the backend service
python main.py

# Or with uvicorn for development
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Check logs - should see:
# "Packet capture started on eth0"
# "Packet capture started on eth0 (filter: ip or ip6, sampling: 100.0%)"
```

## Troubleshooting

### No Packets Being Captured

1. **Check UniFi Port Mirroring Configuration**
   - Verify Source = Port 9, Destination = Port 8
   - Ensure status is "Active"
   - Check if port mirroring is enabled on the switch

2. **Verify Promiscuous Mode**

   ```bash
   ip link show eth0 | grep PROMISC
   # Should show promiscuous mode

   # If not, enable it:
   sudo ip link set eth0 promisc on
   ```

3. **Check Port 8 Settings in UniFi**
   - Port 8 should be in "All" mode (not restricted to specific VLAN)
   - Port 8 should NOT have port isolation enabled
   - Port 8 should NOT have PoE enabled (unless needed)

4. **Test with tcpdump**
   ```bash
   sudo tcpdump -i eth0 -c 10 -v
   # If this shows packets, mirroring works
   # If not, check UniFi configuration
   ```

### Port 8 Not Getting IP Address

- **This is NORMAL** - Port mirroring ports don't need IP addresses
- The Pi can use:
  - WiFi for management/SSH access
  - Another Ethernet interface (if available)
  - Static IP configuration on Port 8 (if needed)

### Only Seeing One Direction of Traffic

- UniFi port mirroring should capture both directions by default
- Check UniFi Controller settings for ingress/egress configuration
- Some switches may require separate configuration

### High CPU Usage

If your internet connection is very fast (>1 Gbps), enable packet sampling:

```python
# In main.py or startup code
packet_capture.start(
    bpf_filter="tcp or udp",  # Filter out ICMP/ARP
    sampling_rate=0.5  # Capture 50% of packets
)
```

## Performance Optimization

### For High-Speed Internet (>1 Gbps)

1. **Enable Packet Sampling**

   ```python
   # Already supported in code
   packet_capture.start(
       bpf_filter="tcp or udp",
       sampling_rate=0.5  # 50% sampling
   )
   ```

2. **Use BPF Filtering**
   - Already configured: `"ip or ip6"` by default
   - Can be more specific: `"tcp port 80 or tcp port 443"`

3. **Monitor Performance**

   ```bash
   # Check packet capture stats
   curl http://localhost:8000/api/health/capture

   # Look for performance_stats section
   ```

### Expected Performance

- **Raspberry Pi 5**: Can handle ~500-800 Mbps with optimizations
- **With Sampling**: Can handle 2-5 Gbps
- **Network Impact**: None (port mirroring is passive)

## Network Topology

```
Internet/WAN
    ↓
Port 9 (Source - Mirrored) → UniFi Switch
                              ↓
                        Port 8 (Destination - Monitoring)
                              ↓
                        Raspberry Pi 5 (eth0)
                              ↓
                        NetInsight Packet Capture
```

## What You'll See

With this setup, NetInsight will capture:

- ✅ All traffic to/from the internet (Port 9)
- ✅ Both directions (ingress and egress)
- ✅ Full packet headers and metadata
- ✅ No impact on network performance
- ✅ No added latency

## Security Considerations

1. **Port 8 Access**: Only connect the monitoring Pi to Port 8
2. **Physical Security**: Ensure Pi is in a secure location
3. **Network Access**: Pi should have limited network access (use firewall)
4. **Data Storage**: Encrypt database if storing sensitive information

## Maintenance

### Restart Promiscuous Mode (if needed)

```bash
sudo ip link set eth0 promisc off
sudo ip link set eth0 promisc on
```

### Check Port Mirroring Status

- Regularly verify in UniFi Controller
- Check that Port 8 is still configured as destination

### Monitor Disk Space

```bash
# Check database size
du -h netinsight.db

# Check available space
df -h
```

## Next Steps

1. ✅ Connect Pi to Port 8
2. ✅ Enable promiscuous mode
3. ✅ Verify with tcpdump
4. ✅ Start NetInsight
5. ✅ Monitor traffic in web interface

## Support

If you encounter issues:

1. Check UniFi Controller port mirroring configuration
2. Verify promiscuous mode is enabled
3. Test with tcpdump first
4. Check NetInsight logs for errors
5. Review troubleshooting section above

---

**Your setup is optimal!** Port mirroring provides the best packet capture method with zero impact on network performance.
