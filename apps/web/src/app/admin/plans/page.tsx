'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Chip,
  Grid,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Add as AddIcon, PlayArrow as PlayIcon, Visibility as ViewIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plansApi, stationsApi } from '@/lib/api';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

const VEHICLE_COLORS = ['#1976d2', '#d32f2f', '#388e3c', '#f57c00', '#7b1fa2', '#0097a7'];

export default function PlansPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [formData, setFormData] = useState({
    planDate: '',
    problemType: 'unlimited_vehicles',
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const { data: plans, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => plansApi.getAll().then((r) => r.data),
  });

  const { data: stationSummary } = useQuery({
    queryKey: ['station-summary', formData.planDate || tomorrowStr],
    queryFn: () => stationsApi.getSummary(formData.planDate || tomorrowStr).then((r) => r.data),
    enabled: dialogOpen,
  });

  const createMutation = useMutation({
    mutationFn: plansApi.create,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      setDialogOpen(false);
      setSelectedPlan(response.data);
    },
  });

  const activateMutation = useMutation({
    mutationFn: plansApi.activate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });

  const handleOpenDialog = () => {
    setFormData({ planDate: tomorrowStr, problemType: 'unlimited_vehicles' });
    setDialogOpen(true);
  };

  const handleCreatePlan = () => {
    createMutation.mutate({
      planDate: formData.planDate,
      problemType: formData.problemType,
    });
  };

  const columns: GridColDef[] = [
    {
      field: 'planDate',
      headerName: 'Tarih',
      width: 120,
      valueFormatter: (params) => new Date(params.value).toLocaleDateString('tr-TR'),
    },
    {
      field: 'problemType',
      headerName: 'Problem Tipi',
      width: 150,
      renderCell: (params) => (
        <Chip
          label={params.value === 'unlimited_vehicles' ? 'Sınırsız Araç' : 'Belirli Araç'}
          size="small"
          color={params.value === 'unlimited_vehicles' ? 'primary' : 'secondary'}
        />
      ),
    },
    {
      field: 'status',
      headerName: 'Durum',
      width: 100,
      renderCell: (params) => {
        const colors: any = {
          draft: 'default',
          active: 'success',
          completed: 'info',
          cancelled: 'error',
        };
        const labels: any = {
          draft: 'Taslak',
          active: 'Aktif',
          completed: 'Tamamlandı',
          cancelled: 'İptal',
        };
        return <Chip label={labels[params.value]} color={colors[params.value]} size="small" />;
      },
    },
    { field: 'vehiclesUsed', headerName: 'Araç', width: 80, align: 'center' },
    { field: 'totalCargos', headerName: 'Kargo', width: 80, align: 'center' },
    {
      field: 'totalDistanceKm',
      headerName: 'Mesafe (km)',
      width: 110,
      valueFormatter: (params) => Number(params.value).toFixed(1),
    },
    {
      field: 'totalCost',
      headerName: 'Maliyet',
      width: 100,
      valueFormatter: (params) => `₺${Number(params.value).toFixed(2)}`,
    },
    {
      field: 'actions',
      headerName: 'İşlemler',
      width: 180,
      renderCell: (params) => (
        <Box>
          <Button
            size="small"
            startIcon={<ViewIcon />}
            onClick={() => setSelectedPlan(params.row)}
          >
            Görüntüle
          </Button>
          {params.row.status === 'draft' && (
            <Button
              size="small"
              color="success"
              onClick={() => activateMutation.mutate(params.row.id)}
            >
              Aktifleştir
            </Button>
          )}
        </Box>
      ),
    },
  ];

  // Harita için rotalar
  const mapRoutes = selectedPlan?.routes?.map((route: any, idx: number) => ({
    vehicleId: route.vehicleId,
    vehicleName: route.vehicle?.name,
    color: VEHICLE_COLORS[idx % VEHICLE_COLORS.length],
    polyline: route.routePolyline,
    stations: [],
  })) || [];

  const mapStations = selectedPlan?.routes?.flatMap((route: any) =>
    (route.routeDetails || []).map((stop: any) => ({
      id: stop.station_id,
      name: stop.station_name,
      code: stop.station_code,
      latitude: stop.latitude,
      longitude: stop.longitude,
      isHub: stop.is_hub,
      cargoCount: stop.cargo_count,
    }))
  ) || [];

  // Unique stations
  const uniqueStations = mapStations.filter(
    (s: any, i: number, arr: any[]) => arr.findIndex((x) => x.id === s.id) === i
  );

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Rota Planları</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenDialog}>
          Yeni Plan Oluştur
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={selectedPlan ? 6 : 12}>
          <Card>
            <CardContent>
              <DataGrid
                rows={plans || []}
                columns={columns}
                autoHeight
                pageSizeOptions={[10, 25]}
                initialState={{
                  pagination: { paginationModel: { pageSize: 10 } },
                }}
                disableRowSelectionOnClick
              />
            </CardContent>
          </Card>
        </Grid>

        {selectedPlan && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">Plan Detayı</Typography>
                  <Button size="small" onClick={() => setSelectedPlan(null)}>
                    Kapat
                  </Button>
                </Box>

                <Map stations={uniqueStations} routes={mapRoutes} height="300px" />

                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Özet
                  </Typography>
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Toplam Maliyet
                      </Typography>
                      <Typography variant="body1">
                        ₺{Number(selectedPlan.totalCost).toFixed(2)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Toplam Mesafe
                      </Typography>
                      <Typography variant="body1">
                        {Number(selectedPlan.totalDistanceKm).toFixed(1)} km
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Araç Sayısı
                      </Typography>
                      <Typography variant="body1">{selectedPlan.vehiclesUsed}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Kiralanan
                      </Typography>
                      <Typography variant="body1">{selectedPlan.vehiclesRented}</Typography>
                    </Grid>
                  </Grid>
                </Box>

                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Araç Rotaları
                  </Typography>
                  {selectedPlan.routes?.map((route: any, idx: number) => (
                    <Box
                      key={route.id}
                      sx={{
                        p: 1.5,
                        mb: 1,
                        bgcolor: 'grey.50',
                        borderRadius: 1,
                        borderLeft: `4px solid ${VEHICLE_COLORS[idx % VEHICLE_COLORS.length]}`,
                      }}
                    >
                      <Typography variant="subtitle2">{route.vehicle?.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {route.cargoCount} kargo • {Number(route.totalWeightKg).toFixed(1)} kg •{' '}
                        {Number(route.totalDistanceKm).toFixed(1)} km • ₺
                        {Number(route.totalCost).toFixed(2)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Yeni Plan Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Yeni Rota Planı Oluştur</DialogTitle>
        <DialogContent>
          {createMutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {(createMutation.error as any)?.response?.data?.message || 'Plan oluşturulurken hata oluştu'}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Plan Tarihi"
            type="date"
            value={formData.planDate}
            onChange={(e) => setFormData({ ...formData, planDate: e.target.value })}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />

          <FormControl fullWidth margin="normal">
            <InputLabel>Problem Tipi</InputLabel>
            <Select
              value={formData.problemType}
              label="Problem Tipi"
              onChange={(e) => setFormData({ ...formData, problemType: e.target.value })}
            >
              <MenuItem value="unlimited_vehicles">
                Sınırsız Araç (Min maliyet, gerekirse kirala)
              </MenuItem>
              <MenuItem value="limited_vehicles">
                Belirli Araç (Min maliyet + Max kargo)
              </MenuItem>
            </Select>
          </FormControl>

          {stationSummary && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                {formData.planDate} için Kargo Özeti
              </Typography>
              <Typography variant="body2">
                Toplam:{' '}
                {stationSummary.reduce((sum: number, s: any) => sum + s.cargoCount, 0)} kargo,{' '}
                {stationSummary
                  .reduce((sum: number, s: any) => sum + s.totalWeightKg, 0)
                  .toFixed(1)}{' '}
                kg
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {stationSummary.filter((s: any) => s.cargoCount > 0).length} istasyondan kargo var
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>İptal</Button>
          <Button
            variant="contained"
            startIcon={<PlayIcon />}
            onClick={handleCreatePlan}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? <CircularProgress size={24} /> : 'Planla'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
