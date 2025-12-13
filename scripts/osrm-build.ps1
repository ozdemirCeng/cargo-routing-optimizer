$ErrorActionPreference = 'Stop'

# Build OSRM MLD data from osrm-data/turkey-latest.osm.pbf
# Requires: Docker Desktop

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dataDir = (Join-Path $repoRoot 'osrm-data')
$pbfPath = (Join-Path $dataDir 'turkey-latest.osm.pbf')
$image = 'osrm/osrm-backend:latest'

if (-not (Test-Path $pbfPath)) {
  throw "Missing PBF: $pbfPath`nDownload 'turkey-latest.osm.pbf' and place it under osrm-data/."
}

Write-Host "Using repoRoot: $repoRoot"
Write-Host "Using dataDir:  $dataDir"
Write-Host "Using image:    $image"

# 1) extract
Write-Host "[1/3] osrm-extract..."
docker run --rm -t -v "${dataDir}:/data" $image osrm-extract -p /opt/car.lua /data/turkey-latest.osm.pbf
if ($LASTEXITCODE -ne 0) { throw "osrm-extract failed" }

# 2) partition (MLD)
Write-Host "[2/3] osrm-partition..."
docker run --rm -t -v "${dataDir}:/data" $image osrm-partition /data/turkey-latest.osrm
if ($LASTEXITCODE -ne 0) { throw "osrm-partition failed" }

# 3) customize (MLD)
Write-Host "[3/3] osrm-customize..."
docker run --rm -t -v "${dataDir}:/data" $image osrm-customize /data/turkey-latest.osrm
if ($LASTEXITCODE -ne 0) { throw "osrm-customize failed" }

Write-Host "OSRM build complete. You can now run: docker compose up -d"
