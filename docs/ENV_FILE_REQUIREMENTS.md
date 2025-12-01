# Environment File (.env) Requirements

## Summary

**Short Answer**: The `.env` file is **recommended but not strictly required** for deployment. The backend will work with defaults, but you should create one for proper configuration.

## When .env is Required vs Optional

### ✅ Optional (Will Work with Defaults)

1. **Docker Deployment**:
   - `docker-compose.yml` has default values for all environment variables
   - Uses syntax like `${NETWORK_INTERFACE:-eth0}` which provides defaults
   - Will work without `.env` file

2. **Backend Code**:
   - All configuration properties have defaults in `backend/utils/config.py`
   - Uses `os.getenv("KEY", "default")` pattern
   - Will start and run with defaults

### ⚠️ Recommended (Should Create)

1. **Non-Docker Deployment**:
   - Scripts check for `.env` and will create one if missing
   - Better to have explicit configuration
   - Easier to customize settings

2. **Production Deployment**:
   - Explicit configuration is better than relying on defaults
   - Easier to manage and document
   - Prevents configuration drift

## Automatic .env Creation

The following scripts automatically create `.env` if it doesn't exist:

1. **`scripts/ensure-env.sh`** - Standalone script to create `.env`
2. **`scripts/backend-setup.sh`** - Creates `.env` during setup
3. **`scripts/raspberry-pi-start.sh`** - Calls `ensure-env.sh` before starting
4. **`backend/start.sh`** - Creates `.env` with defaults if missing

### Usage

```bash
# Manually ensure .env exists
npm run ensure-env
# or
bash scripts/ensure-env.sh

# Or it will be created automatically during setup
npm run backend:setup
```

## Default Values

If `.env` doesn't exist, the backend uses these defaults:

```env
NETWORK_INTERFACE=eth0
HOST=0.0.0.0
PORT=8000
DEBUG=false
ALLOWED_ORIGINS=*
DB_PATH=netinsight.db
DATA_RETENTION_DAYS=30
RATE_LIMIT_PER_MINUTE=120
ENABLE_DNS_TRACKING=true
ENABLE_REVERSE_DNS=true
REVERSE_DNS_TIMEOUT=2.0
REVERSE_DNS_RETRIES=2
ENABLE_SERVICE_FINGERPRINTING=true
ENABLE_DEEP_PACKET_INSPECTION=true
ENABLE_HTTP_HOST_EXTRACTION=true
ENABLE_ALPN_DETECTION=true
LOG_LEVEL=INFO
USE_JSON_LOGGING=true
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Minimum Required Configuration

For **packet capture to work**, you should at least set:

```env
NETWORK_INTERFACE=eth0
```

This is the only critical setting that might need to be different from the default.

## Docker vs Non-Docker

### Docker Deployment

**`.env` file is optional** because:

- `docker-compose.yml` defines environment variables with defaults
- Variables can be set in `docker-compose.yml` or passed via command line
- Example: `NETWORK_INTERFACE=${NETWORK_INTERFACE:-eth0}`

**To customize for Docker:**

1. Create `.env` file in project root (not `backend/.env`)
2. Docker Compose will read it automatically
3. Or set variables in `docker-compose.yml` directly

### Non-Docker Deployment

**`.env` file is recommended** because:

- Scripts expect it to exist
- Easier to manage configuration
- Better for production deployments

**Location**: `backend/.env`

## Verification

After deployment, verify configuration:

```bash
# Check if .env exists
ls -la backend/.env

# View current configuration (if using Python)
cd backend
source venv/bin/activate
python -c "from utils.config import config; print(f'Interface: {config.network_interface}')"

# Check backend health
curl http://localhost:8000/api/health
```

## Best Practices

1. **Always create `.env` for production**
   - Explicit configuration is better than defaults
   - Easier to document and maintain

2. **Don't commit `.env` to git**
   - Already in `.gitignore`
   - Contains potentially sensitive configuration

3. **Use `.env.example` as template** (if it exists)
   - Document all available options
   - Provide examples

4. **Review after auto-creation**
   - Scripts create `.env` with defaults
   - Always review, especially `NETWORK_INTERFACE`

## Troubleshooting

### Backend won't start without .env

**Solution**: The scripts now automatically create `.env` if missing. If you see errors:

```bash
# Manually create it
npm run ensure-env
# or
bash scripts/ensure-env.sh
```

### Wrong network interface

**Solution**: Edit `backend/.env` and set correct interface:

```bash
# Find your interface
ip link show

# Edit .env
nano backend/.env
# Change: NETWORK_INTERFACE=eth0
# To: NETWORK_INTERFACE=<your-interface>
```

### Docker not reading .env

**Solution**:

- For Docker, `.env` should be in project root (not `backend/.env`)
- Or set variables directly in `docker-compose.yml`
- Or use `docker compose --env-file` flag

## Summary

| Deployment Type | .env Required? | Location       | Auto-Created?                     |
| --------------- | -------------- | -------------- | --------------------------------- |
| Docker          | Optional       | Project root   | No (uses docker-compose defaults) |
| Non-Docker      | Recommended    | `backend/.env` | Yes (by scripts)                  |
| Production      | Recommended    | `backend/.env` | Yes (by scripts)                  |

**Bottom Line**: The system will work without `.env`, but it's **recommended to create one** for explicit configuration, especially for the `NETWORK_INTERFACE` setting.
