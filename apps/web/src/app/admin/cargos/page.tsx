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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Grid,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cargosApi, stationsApi, usersApi } from '@/lib/api';

export default function CargosPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCargo, setEditingCargo] = useState<any>(null);
  const [filters, setFilters] = useState({
    status: '',
    stationId: '',
    date: '',
  });
  const [formData, setFormData] = useState({
    originStationId: '',
    userId: '',
    weightKg: '',
    description: '',
    scheduledDate: '',
  });

  const { data: cargos, isLoading } = useQuery({
    queryKey: ['cargos', filters],
    queryFn: () => cargosApi.getAll(filters).then((r) => r.data),
  });

  const { data: stations } = useQuery({
    queryKey: ['stations'],
    queryFn: () => stationsApi.getAll().then((r) => r.data),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: cargosApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargos'] });
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => cargosApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargos'] });
      handleCloseDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: cargosApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargos'] });
    },
  });

  const handleOpenDialog = (cargo?: any) => {
    if (cargo) {
      setEditingCargo(cargo);
      setFormData({
        originStationId: cargo.originStationId,
        userId: cargo.userId || '',
        weightKg: cargo.weightKg.toString(),
        description: cargo.description || '',
        scheduledDate: cargo.scheduledDate?.split('T')[0] || '',
      });
    } else {
      setEditingCargo(null);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setFormData({
        originStationId: '',
        userId: '',
        weightKg: '',
        description: '',
        scheduledDate: tomorrow.toISOString().split('T')[0],
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCargo(null);
  };

  const handleSubmit = () => {
    const data: any = {
      originStationId: formData.originStationId,
      weightKg: parseFloat(formData.weightKg),
      description: formData.description,
      scheduledDate: formData.scheduledDate,
    };

    if (formData.userId) {
      data.userId = formData.userId;
    }

    if (editingCargo) {
      updateMutation.mutate({ id: editingCargo.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Bu kargoyu silmek istediğinizden emin misiniz?')) {
      deleteMutation.mutate(id);
    }
  };

  const statusLabels: any = {
    pending: 'Bekliyor',
    assigned: 'Atandı',
    in_transit: 'Yolda',
    delivered: 'Teslim Edildi',
    cancelled: 'İptal',
  };

  const statusColors: any = {
    pending: 'warning',
    assigned: 'info',
    in_transit: 'primary',
    delivered: 'success',
    cancelled: 'error',
  };

  const columns: GridColDef[] = [
    { field: 'trackingCode', headerName: 'Takip Kodu', width: 130 },
    {
      field: 'user',
      headerName: 'Kullanıcı',
      width: 150,
      valueGetter: (params) => params.row.user?.fullName || '-',
    },
    {
      field: 'originStation',
      headerName: 'İstasyon',
      width: 120,
      valueGetter: (params) => params.row.originStation?.name,
    },
    {
      field: 'weightKg',
      headerName: 'Ağırlık',
      width: 90,
      valueFormatter: (params) => `${Number(params.value).toFixed(1)} kg`,
    },
    {
      field: 'scheduledDate',
      headerName: 'Tarih',
      width: 100,
      valueFormatter: (params) =>
        params.value ? new Date(params.value).toLocaleDateString('tr-TR') : '-',
    },
    {
      field: 'status',
      headerName: 'Durum',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={statusLabels[params.value]}
          color={statusColors[params.value]}
          size="small"
        />
      ),
    },
    {
      field: 'createdAt',
      headerName: 'Oluşturulma',
      width: 100,
      valueFormatter: (params) => new Date(params.value).toLocaleDateString('tr-TR'),
    },
    {
      field: 'actions',
      headerName: 'İşlemler',
      width: 100,
      renderCell: (params) => (
        <Box>
          <IconButton
            size="small"
            onClick={() => handleOpenDialog(params.row)}
            disabled={params.row.status !== 'pending'}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDelete(params.row.id)}
            disabled={params.row.status !== 'pending'}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  const nonHubStations = stations?.filter((s: any) => !s.isHub) || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Kargo Yönetimi</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Yeni Kargo
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
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
                  <MenuItem value="assigned">Atandı</MenuItem>
                  <MenuItem value="in_transit">Yolda</MenuItem>
                  <MenuItem value="delivered">Teslim Edildi</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>İstasyon</InputLabel>
                <Select
                  value={filters.stationId}
                  label="İstasyon"
                  onChange={(e) => setFilters({ ...filters, stationId: e.target.value })}
                >
                  <MenuItem value="">Tümü</MenuItem>
                  {nonHubStations.map((s: any) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
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

      <Card>
        <CardContent>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <DataGrid
              rows={cargos || []}
              columns={columns}
              autoHeight
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
              }}
              disableRowSelectionOnClick
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCargo ? 'Kargo Düzenle' : 'Yeni Kargo'}
        </DialogTitle>
        <DialogContent>
          {(createMutation.isError || updateMutation.isError) && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {(createMutation.error as any)?.response?.data?.message ||
                (updateMutation.error as any)?.response?.data?.message ||
                'İşlem sırasında hata oluştu'}
            </Alert>
          )}

          <FormControl fullWidth margin="normal">
            <InputLabel>Kullanıcı (Opsiyonel)</InputLabel>
            <Select
              value={formData.userId}
              label="Kullanıcı (Opsiyonel)"
              onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
            >
              <MenuItem value="">Misafir</MenuItem>
              {users?.map((u: any) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.fullName} ({u.email})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal" required>
            <InputLabel>Teslim Noktası</InputLabel>
            <Select
              value={formData.originStationId}
              label="Teslim Noktası"
              onChange={(e) => setFormData({ ...formData, originStationId: e.target.value })}
            >
              {nonHubStations.map((s: any) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Ağırlık (kg)"
            type="number"
            value={formData.weightKg}
            onChange={(e) => setFormData({ ...formData, weightKg: e.target.value })}
            margin="normal"
            required
            inputProps={{ min: 0.1, step: 0.1 }}
          />

          <TextField
            fullWidth
            label="Planlanan Tarih"
            type="date"
            value={formData.scheduledDate}
            onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            fullWidth
            label="Açıklama"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            margin="normal"
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>İptal</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {createMutation.isPending || updateMutation.isPending ? (
              <CircularProgress size={24} />
            ) : editingCargo ? (
              'Güncelle'
            ) : (
              'Oluştur'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
