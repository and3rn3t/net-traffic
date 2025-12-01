#!/bin/bash
# Setup Registry-Based Deployment
# This script helps configure your Raspberry Pi to use registry images
# Usage: ./scripts/setup-registry-deployment.sh [registry-url]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

REGISTRY="${1:-}"

if [ -z "$REGISTRY" ]; then
    echo "=========================================="
    echo "NetInsight Registry Deployment Setup"
    echo "=========================================="
    echo ""
    echo "This will configure your Pi to pull images from a registry"
    echo "instead of building them locally."
    echo ""
    read -p "Enter registry URL (e.g., ghcr.io/username or docker.io/username): " REGISTRY
    
    if [ -z "$REGISTRY" ]; then
        echo "❌ Registry URL is required"
        exit 1
    fi
fi

# Remove trailing slash
REGISTRY="${REGISTRY%/}"

echo ""
echo "Configuring for registry: $REGISTRY"
echo ""

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml not found"
    exit 1
fi

# Backup existing docker-compose.yml
if [ -f "docker-compose.yml" ]; then
    BACKUP_FILE="docker-compose.yml.backup.$(date +%Y%m%d-%H%M%S)"
    cp docker-compose.yml "$BACKUP_FILE"
    echo "✅ Backed up docker-compose.yml to $BACKUP_FILE"
fi

# Check if registry compose file exists
if [ -f "docker-compose.registry.yml" ]; then
    echo "Found docker-compose.registry.yml, using it..."
    cp docker-compose.registry.yml docker-compose.yml
    # Update registry URL in the file (works on both Linux and macOS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|image: .*/netinsight-backend:latest|image: $REGISTRY/netinsight-backend:latest|g" docker-compose.yml
        sed -i '' "s|image: .*/netinsight-frontend:latest|image: $REGISTRY/netinsight-frontend:latest|g" docker-compose.yml
    else
        sed -i "s|image: .*/netinsight-backend:latest|image: $REGISTRY/netinsight-backend:latest|g" docker-compose.yml
        sed -i "s|image: .*/netinsight-frontend:latest|image: $REGISTRY/netinsight-frontend:latest|g" docker-compose.yml
    fi
    echo "✅ Updated docker-compose.yml from registry template"
elif [ -f "docker-compose.registry.yml.example" ]; then
    echo "Using docker-compose.registry.yml.example as template..."
    cp docker-compose.registry.yml.example docker-compose.yml
    # Update registry URL
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|your-registry|$REGISTRY|g" docker-compose.yml
    else
        sed -i "s|your-registry|$REGISTRY|g" docker-compose.yml
    fi
    echo "✅ Created docker-compose.yml from example template"
else
    echo "Updating docker-compose.yml to use registry images..."
    
    # Try Python YAML first (more reliable)
    if command -v python3 &> /dev/null && python3 -c "import yaml" 2>/dev/null; then
        python3 <<EOF
import yaml
import sys

try:
    with open('docker-compose.yml', 'r') as f:
        compose = yaml.safe_load(f)
    
    # Update backend
    if 'services' in compose and 'backend' in compose['services']:
        if 'build' in compose['services']['backend']:
            del compose['services']['backend']['build']
        compose['services']['backend']['image'] = '$REGISTRY/netinsight-backend:latest'
        compose['services']['backend']['pull_policy'] = 'always'
    
    # Update frontend
    if 'services' in compose and 'frontend' in compose['services']:
        if 'build' in compose['services']['frontend']:
            del compose['services']['frontend']['build']
        compose['services']['frontend']['image'] = '$REGISTRY/netinsight-frontend:latest'
        compose['services']['frontend']['pull_policy'] = 'always'
    
    with open('docker-compose.yml', 'w') as f:
        yaml.dump(compose, f, default_flow_style=False, sort_keys=False)
    
    print("✅ Updated docker-compose.yml")
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
EOF
        if [ $? -ne 0 ]; then
            echo "⚠️  Python YAML update failed, using sed method..."
            USE_SED=true
        fi
    else
        USE_SED=true
    fi
    
    # Fallback to sed-based update (simpler but less robust)
    if [ "${USE_SED:-false}" = "true" ]; then
        echo "Using sed-based update..."
        
        # Create temporary file
        TMP_FILE=$(mktemp)
        
        # Process backend service
        awk -v registry="$REGISTRY" '
        /^  backend:/ { in_backend=1; print; next }
        in_backend && /^    build:/ { 
            # Skip build section
            getline
            while (/^      / || /^    /) {
                if (!/^      / && !/^    build/) break
                getline
            }
        }
        in_backend && /^    image:/ { 
            print "    image: " registry "/netinsight-backend:latest"
            next
        }
        in_backend && /^    platform:/ { 
            print
            print "    pull_policy: always"
            next
        }
        in_backend && /^  [a-z]/ { in_backend=0 }
        { print }
        ' docker-compose.yml > "$TMP_FILE"
        
        # Process frontend service
        awk -v registry="$REGISTRY" '
        /^  frontend:/ { in_frontend=1; print; next }
        in_frontend && /^    build:/ { 
            # Skip build section
            getline
            while (/^      / || /^    /) {
                if (!/^      / && !/^    build/) break
                getline
            }
        }
        in_frontend && /^    image:/ { 
            print "    image: " registry "/netinsight-frontend:latest"
            next
        }
        in_frontend && /^    platform:/ { 
            print
            print "    pull_policy: always"
            next
        }
        in_frontend && /^  [a-z]/ { in_frontend=0 }
        { print }
        ' "$TMP_FILE" > docker-compose.yml
        
        rm "$TMP_FILE"
        
        echo "⚠️  Manual verification recommended. Please check docker-compose.yml"
    fi
fi

echo ""
echo "✅ Configuration updated!"
echo ""
echo "📋 Verification:"
echo ""

# Verify configuration
if grep -q "pull_policy: always" docker-compose.yml && grep -q "$REGISTRY" docker-compose.yml; then
    echo "✅ docker-compose.yml is configured for registry deployment"
    echo ""
    echo "Images will be pulled from:"
    grep "image:" docker-compose.yml | grep "$REGISTRY"
else
    echo "⚠️  Configuration may not be complete. Please verify docker-compose.yml"
fi

echo ""
echo "=========================================="
echo "✅ Registry deployment configured!"
echo "=========================================="
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Ensure images are pushed to registry:"
echo "   ./scripts/build-and-push-images.sh $REGISTRY"
echo ""
echo "2. On your Raspberry Pi, pull and start:"
echo "   docker compose pull"
echo "   ./scripts/raspberry-pi-start.sh"
echo ""
echo "3. Images will automatically pull on boot!"
echo ""

