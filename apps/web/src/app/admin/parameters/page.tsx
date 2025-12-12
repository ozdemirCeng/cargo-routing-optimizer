'use client';

import { useState, useEffect } from 'react';
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
  Divider,
} from '@mui/material';
import { Save as SaveIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { parametersApi } from '@/lib/api';

interface Parameters {
  costPerKm: number;
  vehicleRentalCost: number;
  defaultCapacitySmall: number;
  defaultCapacityMedium: number;
  defaultCapacityLarge: number;
  maxWorkingHours: number;
  averageSpeedKmh: number;
  hubStationCode: string;
}

export default function ParametersPage() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Parameters>({
    costPerKm: 1,
    vehicleRentalCost: 200,
    defaultCapacitySmall: 500,
    defaultCapacityMedium: 750,
    defaultCapacityLarge: 1000,
    maxWorkingHours: 8,
    averageSpeedKmh: 50,
    hubStationCode: 'KOC-MERKEZ',
  });

  const { data: parameters, isLoading, refetch } = useQuery({
    queryKey: ['parameters'],
    queryFn: () => parametersApi.getAll().then((r) => r.data),
  });

  useEffect(() => {
    if (parameters) {
      setFormData({
        costPerKm: parameters.costPerKm || 1,
        vehicleRentalCost: parameters.vehicleRentalCost || 200,
        defaultCapacitySmall: parameters.defaultCapacitySmall || 500,
        defaultCapacityMedium: parameters.defaultCapacityMedium || 750,
        defaultCapacityLarge: parameters.defaultCapacityLarge || 1000,
        maxWorkingHours: parameters.maxWorkingHours || 8,
        averageSpeedKmh: parameters.averageSpeedKmh || 50,
        hubStationCode: parameters.hubStationCode || 'KOC-MERKEZ',
      });
    }
  }, [parameters]);

  const updateMutation = useMutation({
    mutationFn: parametersApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parameters'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

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
        <Typography variant="h4">Sistem Parametreleri</Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => refetch()}
        >
          Yenile
        </Button>
      </Box>

      {updateMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Parametreler başarıyla güncellendi
        </Alert>
      )}

      {updateMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Parametreler güncellenirken hata oluştu
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Maliyet Parametreleri
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <TextField
                  fullWidth
                  label="Kilometre Başı Maliyet (TL/km)"
                  type="number"
                  value={formData.costPerKm}
                  onChange={(e) =>
                    setFormData({ ...formData, costPerKm: parseFloat(e.target.value) })
                  }
                  margin="normal"
                  inputProps={{ min: 0, step: 0.1 }}
                  helperText="Her kilometre için hesaplanan yakıt + aşınma maliyeti"
                />

                <TextField
                  fullWidth
                  label="Araç Kiralama Maliyeti (TL/gün)"
                  type="number"
                  value={formData.vehicleRentalCost}
                  onChange={(e) =>
                    setFormData({ ...formData, vehicleRentalCost: parseFloat(e.target.value) })
                  }
                  margin="normal"
                  inputProps={{ min: 0, step: 10 }}
                  helperText="Araç başına günlük sabit maliyet"
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Araç Kapasiteleri
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <TextField
                  fullWidth
                  label="Küçük Araç Kapasitesi (kg)"
                  type="number"
                  value={formData.defaultCapacitySmall}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultCapacitySmall: parseFloat(e.target.value) })
                  }
                  margin="normal"
                  inputProps={{ min: 100, step: 50 }}
                />

                <TextField
                  fullWidth
                  label="Orta Araç Kapasitesi (kg)"
                  type="number"
                  value={formData.defaultCapacityMedium}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultCapacityMedium: parseFloat(e.target.value) })
                  }
                  margin="normal"
                  inputProps={{ min: 100, step: 50 }}
                />

                <TextField
                  fullWidth
                  label="Büyük Araç Kapasitesi (kg)"
                  type="number"
                  value={formData.defaultCapacityLarge}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultCapacityLarge: parseFloat(e.target.value) })
                  }
                  margin="normal"
                  inputProps={{ min: 100, step: 50 }}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Operasyon Parametreleri
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <TextField
                  fullWidth
                  label="Maksimum Çalışma Saati"
                  type="number"
                  value={formData.maxWorkingHours}
                  onChange={(e) =>
                    setFormData({ ...formData, maxWorkingHours: parseFloat(e.target.value) })
                  }
                  margin="normal"
                  inputProps={{ min: 1, max: 12, step: 1 }}
                  helperText="Günlük maksimum sürüş süresi"
                />

                <TextField
                  fullWidth
                  label="Ortalama Hız (km/saat)"
                  type="number"
                  value={formData.averageSpeedKmh}
                  onChange={(e) =>
                    setFormData({ ...formData, averageSpeedKmh: parseFloat(e.target.value) })
                  }
                  margin="normal"
                  inputProps={{ min: 10, max: 120, step: 5 }}
                  helperText="Rota süresi hesabı için ortalama hız"
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Diğer Ayarlar
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <TextField
                  fullWidth
                  label="Merkez İstasyon Kodu"
                  value={formData.hubStationCode}
                  onChange={(e) =>
                    setFormData({ ...formData, hubStationCode: e.target.value })
                  }
                  margin="normal"
                  helperText="Tüm araçların başlangıç ve bitiş noktası"
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => refetch()}
              >
                Değişiklikleri İptal Et
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? <CircularProgress size={24} /> : 'Kaydet'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
}
