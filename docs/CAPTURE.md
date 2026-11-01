# Packet Capture

How NetInsight gets packets, what it does with them, and what it extracts. Code lives in
`backend/services/packet_capture/` (`service.py` for capture and flow tracking,
`protocol_decoders.py` for HTTP/TLS/DNS decoding).

## Getting traffic to the Pi

Modern switches only forward a device's own traffic to its port, so where the capture point
sits matters far more than cable length (Ethernet works to ~100 m).

> **This deployment uses `remote_ssh` capture.** The backend SSHes into the router and streams
> `tcpdump -i <iface> -w - -U` back over the connection, so the Pi sees WAN-side traffic without
> any switch support. Set in `backend/.env`:
>
> ```env
> CAPTURE_MODE=remote_ssh
> REMOTE_CAPTURE_HOST=<router-ip>
> REMOTE_CAPTURE_USER=root
> REMOTE_CAPTURE_INTERFACE=<wan-iface>
> REMOTE_CAPTURE_SSH_KEY=/home/pi/.ssh/<key>
> ```
>
> Lock that key down on the router with a forced `command=` in `authorized_keys`, so it can
> only run tcpdump. Implementation: `_capture_loop_remote_ssh` in `service.py`.

Other options, for networks where they work:

| Option | Topology | Trade-offs |
| --- | --- | --- |
| **Port mirroring / SPAN** | Managed switch mirrors the router port to the Pi's port | No network impact; needs a switch whose mirroring really works (see warning). |
| **Network TAP** | Passive TAP between router and switch | Full visibility, no config; extra hardware. |
| **Inline bridge** | Pi bridges between router and switch | Sees everything, but the Pi becomes a single point of failure and a throughput cap. |
| **Wi-Fi monitor mode** | USB adapter in monitor mode | One channel at a time; encrypted payloads; adapter support varies. |

For any local option, set `CAPTURE_MODE=local` and `NETWORK_INTERFACE` to the capturing NIC,
then confirm packets arrive: `sudo ip link set eth0 promisc on && sudo tcpdump -i eth0 -c 10`.
A mirror destination port often gets no DHCP lease (normal); manage the Pi over another
interface.

> ⚠️ **Port mirroring is broken on the UniFi UDM Pro.** The Controller shows the mirror as
> enabled, but no `tc` rules are ever programmed, and manually forced `tc mirred` frames never
> reach the physical DSA (Realtek RTL8370B) switch ports. It's a driver/hardware limitation, so
> don't retry `tc` tuning on this hardware — use `remote_ssh`.

**Pi 5 limits:** gigabit NIC; roughly 500–800 Mbps of sustained capture with the current
pipeline. Put the database on a USB SSD rather than the SD card (see
[DEPLOYMENT_RASPBERRY_PI.md](./DEPLOYMENT_RASPBERRY_PI.md)).

## How capture works

```text
NIC / remote tcpdump stream
  │  kernel BPF filter ("ip or ip6")
  ▼
sniff() in a worker thread ── packet handler: sampling → 1 ms dedup → queue
  ▼
async batch processor (100 packets per batch)
  ▼
per-packet decode: IP/TCP/UDP → flow key → protocol decoders (TLS SNI, HTTP, DNS)
  ▼
active-flow table (≤10,000 flows) ──► batched DB writes (50 flows) + WebSocket updates
```

- **Threading:** Scapy's `sniff()` blocks, so it runs off the event loop. It's called with
  `store=False` (no packet retention) and `timeout=2`, so an idle interface still re-checks the
  stop flag every 2 s. In `remote_ssh` mode, a subprocess reading the pcap stream replaces the
  sniff thread; both sources share the same handler.
- **Filtering and sampling:** `start(bpf_filter=…, sampling_rate=…)` accepts both, but nothing
  passes them today, so production uses the defaults (`"ip or ip6"`, 100%). Exposing them via
  config is a small change if you ever need sampling for high-rate links.
- **Deduplication:** identical packets within a 1 ms window are dropped. This matters with
  mirror ports that copy both directions.
- **Flow lifecycle:** flows are keyed by 5-tuple and updated in memory. A cleanup pass evicts
  flows idle for more than 5 minutes (at most 20% of the table per pass, so it never blocks for
  long). Writes to SQLite are batched.
- **Stall detection:** the service records when it last saw a packet (`is_stale()`), so a
  stuck `remote_ssh` connection shows up as `stale` in `/api/health` rather than looking like a
  quiet network.

Control endpoints: `POST /api/capture/start`, `POST /api/capture/stop`,
`GET /api/capture/status` (running, interface, packets captured, flows detected). Capture
starts automatically with the backend.

## What gets extracted

### Flow level

- Source/destination IP and port, protocol (TCP/UDP/ICMP/ARP/other), bytes and packets in
  each direction, duration, status, owning device (MAC).
- **TCP:** flags, connection state, retransmissions (payload-bearing segments only — pure ACKs
  don't count).
- **IP:** TTL (input for OS fingerprinting).
- **Quality:** RTT and jitter estimated from inter-packet timing (sliding windows of ~10 and ~20
  packets). Gaps over 2 s (`MAX_PLAUSIBLE_INTERVAL_SECONDS`) are treated as idle and excluded.
- **Geolocation:** country, city and ASN via GeoIP2 (`services/geolocation.py`), cached per IP.
  This needs a `.mmdb` at `GEOIP_DB_PATH` (`./scripts/update-geoip-db.sh`); without one, the
  fields stay empty.

### Application layer

- **TLS:** SNI from the ClientHello, and the negotiated version from the `supported_versions`
  extension (the record version reads `0x0303` even for TLS 1.3, so the extension is required).
  This is the main source of visibility into encrypted traffic.
- **HTTP** (plaintext only): Host, method, path, status code, User-Agent.
- **DNS:** query name and type, A/AAAA/CNAME answers, response code.

### Devices

MAC/IP, vendor (OUI — `./scripts/update-oui-db.sh`), device type, hostname, first/last seen,
totals, connection count, threat score, IPv6 support, average RTT, connection quality. Tuning
for hostname/vendor/type identification is in
[ADVANCED_IDENTIFICATION_CONFIG.md](./ADVANCED_IDENTIFICATION_CONFIG.md).

### Threat detection

Large outbound transfers (>10 MB), suspicious or scanning ports, connection-reset abuse (only
abrupt resets under `EARLY_RESET_PACKET_THRESHOLD`, since most connections end with RST), and
per-device EMA baselines with z-score anomaly scoring.

> **Gotcha:** the retransmission, reset and RTT heuristics are sensitive to changes in the
> capture source. If threat noise spikes after switching capture modes or interfaces, check
> those three distributions before assuming a new bug.

### Known gaps

- OS fingerprinting beyond TTL (TCP window, options, IP ID): framework only.
- TCP window size and options (MSS, SACK): not extracted.
- Communication graph and time-of-day/weekly behaviour analysis.
- Threat-intel reputation feeds, DGA/C2/tunnelling detection.
- Application categories beyond port/protocol guesses.

## Privacy and cost

Everything is decoded and stored on the Pi; nothing goes to a third party (see
[ARCHITECTURE.md](./ARCHITECTURE.md)). Each extra field costs CPU per packet and database space
— check `DATABASE_SCHEMA.md` and the slow-query logging (`SLOW_QUERY_MS`) before adding more.
