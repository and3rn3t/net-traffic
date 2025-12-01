# Network Topology and Raspberry Pi 5 Placement for Packet Capture

## Quick Answer

**Physical distance doesn't matter for Ethernet** (within standard limits ~100m), but **network topology placement is critical** for effective packet capture.

## Key Factors

### 1. Physical Distance (Ethernet)

- **Doesn't matter** for Ethernet connections (Cat5e/Cat6 up to 100m)
- Signal quality is binary: either works or doesn't
- No performance degradation from distance (within spec)

### 2. Network Topology (Critical)

- **Where the Pi is placed in the network matters most**
- Must be on a network segment where it can see traffic
- Modern switches don't broadcast traffic to all ports

## Best Placement Options

### Option 1: Port Mirroring / SPAN (Recommended)

**Setup:**

```
Internet → Router → Managed Switch (Port Mirroring)
                          ↓
                    Raspberry Pi 5
```

**Configuration:**

- Connect Pi to a port configured for port mirroring/SPAN
- Mirror traffic from router port or specific VLAN
- Pi sees all traffic without affecting network performance

**Pros:**

- ✅ No impact on network performance
- ✅ Sees all traffic on mirrored port/VLAN
- ✅ Easy to enable/disable
- ✅ Works with any managed switch

**Cons:**

- ⚠️ Requires managed switch with port mirroring
- ⚠️ May not capture all traffic (depends on switch capabilities)

**Switch Configuration Example:**

```bash
# On managed switch (varies by vendor)
# Cisco-style:
monitor session 1 source interface GigabitEthernet0/1
monitor session 1 destination interface GigabitEthernet0/24

# Ubiquiti UniFi:
# Configure port mirroring in UniFi Controller
```

### Option 2: Network TAP (Best for Full Visibility)

**Setup:**

```
Internet → Router → Network TAP → Switch → Devices
                      ↓
                Raspberry Pi 5
```

**Configuration:**

- Network TAP sits inline between router and switch
- Passively copies all traffic to monitoring port
- Pi connected to TAP monitoring port

**Pros:**

- ✅ Sees 100% of traffic (bidirectional)
- ✅ No impact on network (passive)
- ✅ Works with any switch (managed or unmanaged)
- ✅ No configuration needed

**Cons:**

- ⚠️ Requires hardware TAP (additional cost)
- ⚠️ Physical installation required
- ⚠️ Single point of failure if inline

**TAP Options:**

- **Passive TAP**: No power needed, works for 10/100/1000 Mbps
- **Active TAP**: Requires power, works for 10Gbps+

### Option 3: Inline Bridge (Simple but Impactful)

**Setup:**

```
Internet → Router → Raspberry Pi 5 (Bridge) → Switch → Devices
```

**Configuration:**

- Pi acts as transparent bridge
- All traffic passes through Pi
- Pi captures and forwards packets

**Pros:**

- ✅ Sees all traffic
- ✅ No additional hardware needed
- ✅ Works with any switch

**Cons:**

- ⚠️ Single point of failure (if Pi fails, network goes down)
- ⚠️ Adds latency (minimal but measurable)
- ⚠️ Requires two network interfaces on Pi
- ⚠️ Performance bottleneck (Pi may not handle full line rate)

**Raspberry Pi 5 Bridge Setup:**

```bash
# Enable IP forwarding
sudo sysctl -w net.ipv4.ip_forward=1

# Create bridge
sudo brctl addbr br0
sudo brctl addif br0 eth0
sudo brctl addif br0 eth1
sudo ifconfig br0 up

# Configure packet capture on bridge
```

### Option 4: WiFi Monitor Mode (For Wireless Networks)

**Setup:**

```
WiFi Router → WiFi Adapter (Monitor Mode) → Raspberry Pi 5
```

**Configuration:**

- Use USB WiFi adapter in monitor mode
- Captures all WiFi traffic on selected channel
- Requires compatible WiFi adapter

**Pros:**

- ✅ Captures wireless traffic
- ✅ No wired connection needed
- ✅ Can monitor multiple channels

**Cons:**

- ⚠️ Requires compatible WiFi adapter
- ⚠️ May miss some traffic (channel hopping)
- ⚠️ Physical proximity matters (signal strength)
- ⚠️ Lower performance than Ethernet

**WiFi Adapter Requirements:**

- Supports monitor mode
- Compatible with Linux (rtl8812au, rtl8814au, etc.)
- USB 3.0 recommended for performance

## Physical Placement Considerations

### Ethernet (Wired)

- **Distance**: Doesn't matter (within 100m)
- **Cable Quality**: Use Cat5e or better
- **Interference**: Minimal (shielded cables help in noisy environments)

### WiFi (Wireless)

- **Distance**: Matters for signal strength
- **Placement**: Closer to router = better signal
- **Obstacles**: Walls, metal objects reduce signal
- **Recommendation**: Within 10-15m for best results

### Power and Environment

- **Power**: Use quality power supply (5V 5A for Pi 5)
- **Temperature**: Ensure adequate cooling (Pi 5 can throttle)
- **Physical Security**: Consider lockable enclosure if in public area

## Network Topology Recommendations

### Home Network (Simple)

```
Internet → Router → Unmanaged Switch → Devices
                          ↓
                    Raspberry Pi 5 (Port Mirroring if switch supports it)
```

**Best Option**: Port mirroring if router/switch supports it, otherwise inline bridge

### Small Business Network

```
Internet → Router → Managed Switch (Port Mirroring)
                          ↓
                    Raspberry Pi 5
```

**Best Option**: Port mirroring on managed switch

### Enterprise Network

```
Internet → Router → Network TAP → Core Switch → Distribution Switches
                      ↓
                Raspberry Pi 5
```

**Best Option**: Network TAP for full visibility

## Performance Impact by Placement

### Port Mirroring / SPAN

- **Network Impact**: None (passive)
- **Pi Performance**: Full line rate (if Pi can handle it)
- **Latency**: None added
- **Reliability**: High (no single point of failure)

### Network TAP

- **Network Impact**: None (passive)
- **Pi Performance**: Full line rate (if Pi can handle it)
- **Latency**: None added
- **Reliability**: Medium (TAP is single point if inline)

### Inline Bridge

- **Network Impact**: Minimal latency (~1-2ms)
- **Pi Performance**: May bottleneck at high rates (>500 Mbps)
- **Latency**: 1-2ms added
- **Reliability**: Low (Pi failure = network down)

### WiFi Monitor Mode

- **Network Impact**: None (passive)
- **Pi Performance**: Limited by WiFi adapter (~150-300 Mbps)
- **Latency**: None added
- **Reliability**: High (no impact on network)

## Raspberry Pi 5 Specific Considerations

### Performance Limits

- **Ethernet**: Gigabit (1 Gbps) capable
- **CPU**: Can handle ~500-800 Mbps packet capture (with optimizations)
- **Memory**: 4GB/8GB - sufficient for packet capture
- **Storage**: Use fast SD card or USB SSD for database

### Optimization Tips

1. **Use Port Mirroring**: Best performance, no impact
2. **Enable Packet Sampling**: For high-rate networks (>1 Gbps)
3. **BPF Filtering**: Filter at kernel level (reduces CPU)
4. **Batch Processing**: Already implemented in code
5. **Fast Storage**: Use USB SSD instead of SD card

### Example Configuration for High-Rate Networks

```python
# In main.py or startup
packet_capture.start(
    bpf_filter="tcp or udp",  # Skip ICMP/ARP
    sampling_rate=0.5  # 50% sampling for 2+ Gbps
)
```

## Troubleshooting

### Not Seeing Traffic

1. **Check Interface**: Verify correct interface (`ip link show`)
2. **Check Promiscuous Mode**: Ensure enabled (`ip link set eth0 promisc on`)
3. **Check Network Topology**: Pi must be on same segment or use port mirroring
4. **Check Switch**: Unmanaged switches don't broadcast to all ports

### Missing Packets

1. **High-Rate Traffic**: Enable packet sampling
2. **CPU Overload**: Check CPU usage, reduce processing
3. **Buffer Overflow**: Increase kernel buffer sizes
4. **Switch Limitations**: Port mirroring may have limits

### Performance Issues

1. **Storage**: Use fast storage (USB SSD)
2. **CPU**: Enable packet sampling for high rates
3. **Memory**: Check for memory leaks, restart periodically
4. **Network**: Use port mirroring instead of inline bridge

## Recommendations by Use Case

### Home Network Monitoring

- **Placement**: Port mirroring on router (if supported) or inline bridge
- **Distance**: Doesn't matter (Ethernet)
- **Performance**: Should handle home speeds easily (<500 Mbps)

### Small Business Security

- **Placement**: Port mirroring on managed switch
- **Distance**: Doesn't matter (Ethernet)
- **Performance**: May need sampling for >1 Gbps

### Enterprise Network Analysis

- **Placement**: Network TAP at core switch
- **Distance**: Doesn't matter (Ethernet)
- **Performance**: Use sampling and filtering for high rates

### Wireless Network Monitoring

- **Placement**: Close to router (within 10-15m)
- **Distance**: Matters (signal strength)
- **Performance**: Limited by WiFi adapter (~150-300 Mbps)

## Summary

### Physical Distance

- **Ethernet**: Doesn't matter (within 100m)
- **WiFi**: Matters (closer = better signal)

### Network Topology

- **Most Important**: Where Pi is placed in network
- **Best Option**: Port mirroring (no impact, full visibility)
- **Alternative**: Network TAP (requires hardware)
- **Last Resort**: Inline bridge (impacts network)

### Performance

- **Pi 5 Capable**: ~500-800 Mbps with optimizations
- **For Higher Rates**: Use packet sampling
- **Best Practice**: Port mirroring + BPF filtering + sampling

### Recommendation

For most use cases, **physical distance doesn't matter**, but **use port mirroring** on a managed switch for best results. If that's not available, a network TAP is the next best option.

---

**For Raspberry Pi 5 specifically:**

- Place it anywhere convenient (distance doesn't matter for Ethernet)
- Use port mirroring if possible (best performance)
- Enable packet sampling for networks >1 Gbps
- Use fast storage (USB SSD) for database
