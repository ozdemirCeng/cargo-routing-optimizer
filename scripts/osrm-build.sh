#!/usr/bin/env bash
set -euo pipefail

# Build OSRM MLD data from osrm-data/turkey-latest.osm.pbf
# Requires: Docker

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$REPO_ROOT/osrm-data"
PBF="$DATA_DIR/turkey-latest.osm.pbf"
IMAGE="osrm/osrm-backend:v5.27.1"

if [[ ! -f "$PBF" ]]; then
  echo "Missing PBF: $PBF" >&2
  echo "Download 'turkey-latest.osm.pbf' and place it under osrm-data/." >&2
  exit 1
fi

echo "Using repoRoot: $REPO_ROOT"
echo "Using dataDir:  $DATA_DIR"
echo "Using image:    $IMAGE"

echo "[1/3] osrm-extract..."
docker run --rm -t -v "$DATA_DIR:/data" "$IMAGE" osrm-extract -p /opt/car.lua /data/turkey-latest.osm.pbf

echo "[2/3] osrm-partition..."
docker run --rm -t -v "$DATA_DIR:/data" "$IMAGE" osrm-partition /data/turkey-latest.osrm

echo "[3/3] osrm-customize..."
docker run --rm -t -v "$DATA_DIR:/data" "$IMAGE" osrm-customize /data/turkey-latest.osrm

echo "OSRM build complete. You can now run: docker compose up -d"
