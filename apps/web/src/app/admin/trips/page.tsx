'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Refresh as RefreshIcon, Map as MapIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tripsApi, vehiclesApi } from '@/lib/api';
import dynamic from 'next/dynamic';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

const VEHICLE_COLORS = ['#1976d2', '#d32f2f', '#388e3c', '#f57c00', '#7b1fa2'];

export default function TripsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    vehicleId: '',
    status: '',
    date: '',
  });
  const [selectedTrip, setSelectedTrip] = useState<any>(null);

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => vehiclesApi.getAll().then((r) => r.data),
  });

  const { data: trips, isLoading, refetch } = useQuery({
    queryKey: ['trips', filters],
    queryFn: () => tripsApi.getAll(filters).then((r) => r.data),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: any) => tripsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });

  const statusLabels: any = {
    pending: 'Bekliyor',
    in_progress: 'Devam Ediyor',
    completed: 'Tamamlandı',
    cancelled: 'İptal',
  };

  const statusColors: any = {
    pending: 'warning',
    in_progress: 'info',
    completed: 'success',
    cancelled: 'error',
  };

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 80 },
    {
      field: 'vehicle',
      headerName: 'Araç',
      width: 120,
      valueGetter: (params) => params.row.vehicle?.plate,
    },
    {
      field: 'startedAt',
      headerName: 'Başlangıç',
      width: 150,
      valueFormatter: (params) =>
        params.value ? new Date(params.value).toLocaleString('tr-TR') : '-',
    },
    {
      field: 'endedAt',
      headerName: 'Bitiş',
      width: 150,
      valueFormatter: (params) =>
        params.value ? new Date(params.value).toLocaleString('tr-TR') : '-',
    },
    {
      field: 'totalDistanceKm',
      headerName: 'Mesafe',
      width: 100,
      valueFormatter: (params) =>
        params.value ? `${Number(params.value).toFixed(1)} km` : '-',
    },
    {
      field: 'totalLoadKg',
      headerName: 'Yük',
      width: 100,
      valueFormatter: (params) =>
        params.value ? `${Number(params.value).toFixed(1)} kg` : '-',
    },
    {
      field: 'status',
      headerName: 'Durum',
      width: 130,
      renderCell: (params) => (
        <Chip
          label={statusLabels[params.value]}
          color={statusColors[params.value]}
          size="small"
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'İşlemler',
      width: 150,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Haritada Gör">
            <IconButton
              size="small"
              onClick={() => setSelectedTrip(params.row)}
            >
              <MapIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {params.row.status === 'pending' && (
            <Button
              size="small"
              onClick={() =>
                updateStatusMutation.mutate({ id: params.row.id, status: 'in_progress' })
              }
            >
              Başlat
            </Button>
          )}
          {params.row.status === 'in_progress' && (
            <Button
              size="small"
              color="success"
              onClick={() =>
                updateStatusMutation.mutate({ id: params.row.id, status: 'completed' })
              }
            >
              Bitir
            </Button>
          )}
        </Box>
      ),
    },
  ];

  // Harita verileri
  const mapStations = selectedTrip?.waypoints?.map((w: any) => ({
    id: w.station?.id,
    name: w.station?.name,
    code: w.station?.code || '',
    latitude: Number(w.station?.latitude),
    longitude: Number(w.station?.longitude),
    isHub: w.station?.isHub,
  })) || [];

  const mapRoutes = selectedTrip?.polyline ? [{
    vehicleId: selectedTrip.vehicleId,
    vehicleName: selectedTrip.vehicle?.plate,
    color: VEHICLE_COLORS[0],
    polyline: selectedTrip.polyline,
    stations: mapStations,
  }] : [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Sefer Takip</Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => refetch()}
        >
          Yenile
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Araç</InputLabel>
                <Select
                  value={filters.vehicleId}
                  label="Araç"
                  onChange={(e) => setFilters({ ...filters, vehicleId: e.target.value })}
                >
                  <MenuItem value="">Tümü</MenuItem>
                  {vehicles?.map((v: any) => (
                    <MenuItem key={v.id} value={v.id}>
                      {v.plate}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Durum</InputLabel>
                <Select
                  value={filters.status}
                  label="Durum"
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                  <MenuItem value="">Tümü</MenuItem>
                  <MenuItem value="pending">Bekliyor</MenuItem>
                  <MenuItem value="in_progress">Devam Ediyor</MenuItem>
                  <MenuItem value="completed">Tamamlandı</MenuItem>
                  <MenuItem value="cancelled">İptal</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Tarih"
                value={filters.date}
                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid item xs={12} md={selectedTrip ? 6 : 12}>
          <Card>
            <CardContent>
              {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <DataGrid
                  rows={trips || []}
                  columns={columns}
                  autoHeight
                  pageSizeOptions={[10, 25]}
                  initialState={{
                    pagination: { paginationModel: { pageSize: 10 } },
                  }}
                  disableRowSelectionOnClick
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        {selectedTrip && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">
                    Sefer #{selectedTrip.id} - {selectedTrip.vehicle?.plate}
                  </Typography>
                  <Button size="small" onClick={() => setSelectedTrip(null)}>
                    Kapat
                  </Button>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Duraklar:{' '}
                    {selectedTrip.waypoints?.map((w: any, i: number) => (
                      <Chip
                        key={i}
                        label={`${w.sequenceOrder}. ${w.station?.name}`}
                        size="small"
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                    ))}
                  </Typography>
                </Box>

                <Map
                  stations={mapStations}
                  routes={mapRoutes}
                  height="400px"
                />
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
