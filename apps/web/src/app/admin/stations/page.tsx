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
  IconButton,
  Chip,
  CircularProgress,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stationsApi } from '@/lib/api';
import dynamic from 'next/dynamic';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

export default function StationsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editStation, setEditStation] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    latitude: '',
    longitude: '',
    address: '',
  });

  const { data: stations, isLoading } = useQuery({
    queryKey: ['stations'],
    queryFn: () => stationsApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: stationsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stations'] });
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => stationsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stations'] });
      handleCloseDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: stationsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stations'] });
    },
  });

  const handleOpenDialog = (station?: any) => {
    if (station) {
      setEditStation(station);
      setFormData({
        name: station.name,
        code: station.code,
        latitude: String(station.latitude),
        longitude: String(station.longitude),
        address: station.address || '',
      });
    } else {
      setEditStation(null);
      setFormData({ name: '', code: '', latitude: '', longitude: '', address: '' });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditStation(null);
    setFormData({ name: '', code: '', latitude: '', longitude: '', address: '' });
  };

  const handleSubmit = () => {
    const data = {
      name: formData.name,
      code: formData.code.toUpperCase(),
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
      address: formData.address,
    };

    if (editStation) {
      updateMutation.mutate({ id: editStation.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'İstasyon Adı', flex: 1 },
    { field: 'code', headerName: 'Kod', width: 120 },
    {
      field: 'coordinates',
      headerName: 'Koordinatlar',
      width: 200,
      valueGetter: (params) =>
        `${Number(params.row.latitude).toFixed(4)}, ${Number(params.row.longitude).toFixed(4)}`,
    },
    {
      field: 'isHub',
      headerName: 'Tip',
      width: 100,
      renderCell: (params) =>
        params.value ? (
          <Chip label="Hub" color="error" size="small" />
        ) : (
          <Chip label="İstasyon" color="primary" size="small" variant="outlined" />
        ),
    },
    {
      field: 'isActive',
      headerName: 'Durum',
      width: 100,
      renderCell: (params) =>
        params.value ? (
          <Chip label="Aktif" color="success" size="small" />
        ) : (
          <Chip label="Pasif" color="default" size="small" />
        ),
    },
    {
      field: 'actions',
      headerName: 'İşlemler',
      width: 120,
      renderCell: (params) => (
        <Box>
          <IconButton size="small" onClick={() => handleOpenDialog(params.row)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => {
              if (confirm('Bu istasyonu silmek istediğinize emin misiniz?')) {
                deleteMutation.mutate(params.row.id);
              }
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  const mapStations = (stations || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    latitude: Number(s.latitude),
    longitude: Number(s.longitude),
    isHub: s.isHub,
  }));

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
        <Typography variant="h4">İstasyonlar</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          Yeni İstasyon
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Harita
          </Typography>
          <Map stations={mapStations} height="350px" />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <DataGrid
            rows={stations || []}
            columns={columns}
            autoHeight
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
            }}
            disableRowSelectionOnClick
          />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editStation ? 'İstasyon Düzenle' : 'Yeni İstasyon'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="İstasyon Adı"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Kod"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            margin="normal"
            required
            helperText="Örn: GEBZE, IZMIT"
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              label="Enlem (Latitude)"
              value={formData.latitude}
              onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
              margin="normal"
              required
              type="number"
              inputProps={{ step: 'any' }}
            />
            <TextField
              fullWidth
              label="Boylam (Longitude)"
              value={formData.longitude}
              onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
              margin="normal"
              required
              type="number"
              inputProps={{ step: 'any' }}
            />
          </Box>
          <TextField
            fullWidth
            label="Adres"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            margin="normal"
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>İptal</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {editStation ? 'Güncelle' : 'Oluştur'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
