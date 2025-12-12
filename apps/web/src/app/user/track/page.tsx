'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { cargosApi } from '@/lib/api';
import dynamic from 'next/dynamic';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

const VEHICLE_COLORS = ['#1976d2', '#d32f2f', '#388e3c', '#f57c00', '#7b1fa2'];

function TrackCargoContent() {
  const searchParams = useSearchParams();
  const [cargoId, setCargoId] = useState(searchParams.get('id') || '');
  const [searchId, setSearchId] = useState(searchParams.get('id') || '');

  const { data: cargo, isLoading, isError, refetch } = useQuery({
    queryKey: ['cargo', searchId],
    queryFn: () => cargosApi.getById(searchId).then((r) => r.data),
    enabled: !!searchId,
  });

  const { data: route, isLoading: routeLoading } = useQuery({
    queryKey: ['cargo-route', searchId],
    queryFn: () => cargosApi.getRoute(searchId).then((r) => r.data),
    enabled: !!searchId && !!cargo && ['assigned', 'in_transit'].includes(cargo?.status),
  });

  const handleSearch = () => {
    setSearchId(cargoId);
  };

  const statusLabels: any = {
    pending: 'Bekliyor',
    assigned: 'Araca Atandı',
    in_transit: 'Yolda',
    delivered: 'Teslim Edildi',
    cancelled: 'İptal',
  };

  const statusSteps = ['pending', 'assigned', 'in_transit', 'delivered'];
  const activeStep = statusSteps.indexOf(cargo?.status || 'pending');

  // Harita verileri
  const mapStations = route?.stations?.map((s: any) => ({
    id: s.id,
    name: s.name,
    code: s.code || '',
    latitude: Number(s.latitude),
    longitude: Number(s.longitude),
    isHub: s.isHub,
  })) || [];

  const mapRoutes = route ? [{
    vehicleId: route.vehicleId,
    vehicleName: route.vehicleName,
    color: VEHICLE_COLORS[0],
    polyline: route.polyline,
    stations: mapStations,
  }] : [];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Kargo Takip
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <TextField
              label="Kargo ID veya Takip Kodu"
              value={cargoId}
              onChange={(e) => setCargoId(e.target.value)}
              sx={{ flexGrow: 1 }}
              placeholder="Kargo ID girin..."
            />
            <Button
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={handleSearch}
              sx={{ height: 56 }}
            >
              Ara
            </Button>
          </Box>
        </CardContent>
      </Card>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {isError && (
        <Alert severity="error">
          Kargo bulunamadı veya bu kargoya erişim yetkiniz yok.
        </Alert>
      )}

      {cargo && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Kargo Bilgileri
                </Typography>

                <Box sx={{ mb: 3 }}>
                  <Stepper activeStep={activeStep} alternativeLabel>
                    {statusSteps.map((step) => (
                      <Step key={step}>
                        <StepLabel>{statusLabels[step]}</StepLabel>
                      </Step>
                    ))}
                  </Stepper>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Takip Kodu
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {cargo.trackingCode}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Durum
                    </Typography>
                    <Box>
                      <Chip
                        label={statusLabels[cargo.status]}
                        color={
                          cargo.status === 'delivered'
                            ? 'success'
                            : cargo.status === 'in_transit'
                            ? 'primary'
                            : 'default'
                        }
                        size="small"
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Teslim Noktası
                    </Typography>
                    <Typography variant="body1">
                      {cargo.originStation?.name}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Ağırlık
                    </Typography>
                    <Typography variant="body1">
                      {Number(cargo.weightKg).toFixed(1)} kg
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Planlanan Tarih
                    </Typography>
                    <Typography variant="body1">
                      {cargo.scheduledDate
                        ? new Date(cargo.scheduledDate).toLocaleDateString('tr-TR')
                        : '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Oluşturulma
                    </Typography>
                    <Typography variant="body1">
                      {new Date(cargo.createdAt).toLocaleDateString('tr-TR')}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Araç Rotası
                </Typography>

                {routeLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : route ? (
                  <>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Araç: <strong>{route.vehicleName}</strong>
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Toplam Mesafe: <strong>{route.totalDistanceKm?.toFixed(1)} km</strong>
                      </Typography>
                    </Box>
                    <Map
                      stations={mapStations}
                      routes={mapRoutes}
                      height="300px"
                    />
                  </>
                ) : (
                  <Alert severity="info">
                    {cargo.status === 'pending'
                      ? 'Kargonuz henüz bir araca atanmadı.'
                      : cargo.status === 'delivered'
                      ? 'Kargonuz teslim edildi.'
                      : 'Rota bilgisi bulunamadı.'}
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

export default function TrackCargoPage() {
  return (
    <Suspense fallback={<CircularProgress />}>
      <TrackCargoContent />
    </Suspense>
  );
}
