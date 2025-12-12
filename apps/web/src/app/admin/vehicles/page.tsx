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
  Chip,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vehiclesApi } from '@/lib/api';

interface VehicleForm {
  plate: string;
  capacityKg: string;
  isActive: boolean;
}

export default function VehiclesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [formData, setFormData] = useState<VehicleForm>({
    plate: '',
    capacityKg: '',
    isActive: true,
  });

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => vehiclesApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: vehiclesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => vehiclesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      handleCloseDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: vehiclesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });

  const handleOpenDialog = (vehicle?: any) => {
    if (vehicle) {
      setEditingVehicle(vehicle);
      setFormData({
        plate: vehicle.plate,
        capacityKg: vehicle.capacityKg.toString(),
        isActive: vehicle.isActive,
      });
    } else {
      setEditingVehicle(null);
      setFormData({ plate: '', capacityKg: '', isActive: true });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingVehicle(null);
    setFormData({ plate: '', capacityKg: '', isActive: true });
  };

  const handleSubmit = () => {
    const data = {
      plate: formData.plate,
      capacityKg: parseFloat(formData.capacityKg),
      isActive: formData.isActive,
    };

    if (editingVehicle) {
      updateMutation.mutate({ id: editingVehicle.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Bu aracı silmek istediğinizden emin misiniz?')) {
      deleteMutation.mutate(id);
    }
  };

  const columns: GridColDef[] = [
    { field: 'plate', headerName: 'Plaka', width: 150 },
    {
      field: 'capacityKg',
      headerName: 'Kapasite (kg)',
      width: 130,
      valueFormatter: (params) => `${Number(params.value).toLocaleString()} kg`,
    },
    {
      field: 'isActive',
      headerName: 'Durum',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Aktif' : 'Pasif'}
          color={params.value ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'createdAt',
      headerName: 'Oluşturulma',
      width: 150,
      valueFormatter: (params) => new Date(params.value).toLocaleString('tr-TR'),
    },
    {
      field: 'actions',
      headerName: 'İşlemler',
      width: 120,
      renderCell: (params) => (
        <Box>
          <IconButton
            size="small"
            onClick={() => handleOpenDialog(params.row)}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDelete(params.row.id)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

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
        <Typography variant="h4">Araç Yönetimi</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Yeni Araç
        </Button>
      </Box>

      {deleteMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Araç silinirken hata oluştu
        </Alert>
      )}

      <Card>
        <CardContent>
          <DataGrid
            rows={vehicles || []}
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

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingVehicle ? 'Araç Düzenle' : 'Yeni Araç'}
        </DialogTitle>
        <DialogContent>
          {(createMutation.isError || updateMutation.isError) && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {(createMutation.error as any)?.response?.data?.message ||
                (updateMutation.error as any)?.response?.data?.message ||
                'İşlem sırasında hata oluştu'}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Plaka"
            value={formData.plate}
            onChange={(e) => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
            margin="normal"
            required
            placeholder="41 ABC 123"
          />

          <TextField
            fullWidth
            label="Kapasite (kg)"
            type="number"
            value={formData.capacityKg}
            onChange={(e) => setFormData({ ...formData, capacityKg: e.target.value })}
            margin="normal"
            required
            inputProps={{ min: 100, step: 50 }}
            helperText="Önerilen değerler: 500, 750, 1000 kg"
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
            ) : editingVehicle ? (
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
