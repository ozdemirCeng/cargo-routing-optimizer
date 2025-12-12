'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Button,
} from '@mui/material';
import {
  LocalShipping as VehicleIcon,
  Inventory as CargoIcon,
  Route as RouteIcon,
  AttachMoney as MoneyIcon,
  Today as TodayIcon,
  PlayArrow as PlayIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, stationsApi } from '@/lib/api';
import dynamic from 'next/dynamic';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: `${color}15`,
              color: color,
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="h4" fontWeight="bold">
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => dashboardApi.getSummary().then((r) => r.data),
  });

  const { data: stations } = useQuery({
    queryKey: ['stations'],
    queryFn: () => stationsApi.getAll().then((r) => r.data),
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const { data: stationSummary } = useQuery({
    queryKey: ['station-summary', tomorrowStr],
    queryFn: () => stationsApi.getSummary(tomorrowStr).then((r) => r.data),
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const mapStations = (stationSummary || stations || []).map((s: any) => ({
    id: s.stationId || s.id,
    name: s.stationName || s.name,
    code: s.stationCode || s.code,
    latitude: Number(s.latitude),
    longitude: Number(s.longitude),
    isHub: s.isHub,
    cargoCount: s.cargoCount,
    totalWeightKg: s.totalWeightKg,
  }));

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Toplam Kargo"
            value={summary?.totalCargos || 0}
            icon={<CargoIcon />}
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Bekleyen Kargo"
            value={summary?.pendingCargos || 0}
            icon={<TodayIcon />}
            color="#f57c00"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Aktif Sefer"
            value={summary?.activeTrips || 0}
            icon={<VehicleIcon />}
            color="#388e3c"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Günlük Maliyet"
            value={`₺${summary?.totalCostToday?.toFixed(2) || '0.00'}`}
            icon={<MoneyIcon />}
            color="#d32f2f"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                İstasyonlar Haritası
              </Typography>
              <Map stations={mapStations} height="400px" />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Yarınki Kargo Özeti
              </Typography>
              {stationSummary?.filter((s: any) => s.cargoCount > 0).length === 0 ? (
                <Typography color="text.secondary">
                  Yarın için bekleyen kargo yok
                </Typography>
              ) : (
                <Box sx={{ maxHeight: 350, overflow: 'auto' }}>
                  {stationSummary
                    ?.filter((s: any) => s.cargoCount > 0)
                    .map((s: any) => (
                      <Box
                        key={s.stationId}
                        sx={{
                          p: 1.5,
                          mb: 1,
                          bgcolor: 'grey.50',
                          borderRadius: 1,
                        }}
                      >
                        <Typography variant="subtitle2">{s.stationName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {s.cargoCount} kargo • {s.totalWeightKg.toFixed(1)} kg
                        </Typography>
                      </Box>
                    ))}
                </Box>
              )}
              <Button
                variant="contained"
                fullWidth
                startIcon={<PlayIcon />}
                sx={{ mt: 2 }}
                href="/admin/plans"
              >
                Plan Oluştur
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
