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
  cost_per_km: number;
  rental_cost_500kg: number;
  default_capacity_small: number;
  default_capacity_medium: number;
  default_capacity_large: number;
  max_working_hours: number;
  average_speed_kmh: number;
}

export default function ParametersPage() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Parameters>({
    cost_per_km: 1,
    rental_cost_500kg: 200,
    default_capacity_small: 500,
    default_capacity_medium: 750,
    default_capacity_large: 1000,
    max_working_hours: 8,
    average_speed_kmh: 50,
  });

  const { data: parameters, isLoading, refetch } = useQuery({
    queryKey: ['parameters'],
    queryFn: async () => {
      const rows = await parametersApi.getAll().then((r) => r.data as any[]);
      const map: Record<string, number> = {};
      for (const row of rows) {
        map[String(row.paramKey)] = Number(row.paramValue);
      }
      return map;
    },
  });

  useEffect(() => {
    if (parameters) {
      setFormData({
        cost_per_km: (parameters as any).cost_per_km || 1,
        rental_cost_500kg: (parameters as any).rental_cost_500kg || 200,
        default_capacity_small: (parameters as any).default_capacity_small || 500,
        default_capacity_medium: (parameters as any).default_capacity_medium || 750,
        default_capacity_large: (parameters as any).default_capacity_large || 1000,
        max_working_hours: (parameters as any).max_working_hours || 8,
        average_speed_kmh: (parameters as any).average_speed_kmh || 50,
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
    updateMutation.mutate(formData as unknown as Record<string, number>);
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
                  value={formData.cost_per_km}
                  onChange={(e) =>
                    setFormData({ ...formData, cost_per_km: parseFloat(e.target.value) })
                  }
                  margin="normal"
                  inputProps={{ min: 0, step: 0.1 }}
                  helperText="Her kilometre için hesaplanan yakıt + aşınma maliyeti"
                />

                <TextField
                  fullWidth
                  label="Araç Kiralama Maliyeti (TL/gün)"
                  type="number"
                  value={formData.rental_cost_500kg}
                  onChange={(e) =>
                    setFormData({ ...formData, rental_cost_500kg: parseFloat(e.target.value) })
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
                  value={formData.default_capacity_small}
                  onChange={(e) =>
                    setFormData({ ...formData, default_capacity_small: parseFloat(e.target.value) })
                  }
                  margin="normal"
                  inputProps={{ min: 100, step: 50 }}
                />

                <TextField
                  fullWidth
                  label="Orta Araç Kapasitesi (kg)"
                  type="number"
                  value={formData.default_capacity_medium}
                  onChange={(e) =>
                    setFormData({ ...formData, default_capacity_medium: parseFloat(e.target.value) })
                  }
                  margin="normal"
                  inputProps={{ min: 100, step: 50 }}
                />

                <TextField
                  fullWidth
                  label="Büyük Araç Kapasitesi (kg)"
                  type="number"
                  value={formData.default_capacity_large}
                  onChange={(e) =>
                    setFormData({ ...formData, default_capacity_large: parseFloat(e.target.value) })
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
                  value={formData.max_working_hours}
                  onChange={(e) =>
                    setFormData({ ...formData, max_working_hours: parseFloat(e.target.value) })
                  }
                  margin="normal"
                  inputProps={{ min: 1, max: 12, step: 1 }}
                  helperText="Günlük maksimum sürüş süresi"
                />

                <TextField
                  fullWidth
                  label="Ortalama Hız (km/saat)"
                  type="number"
                  value={formData.average_speed_kmh}
                  onChange={(e) =>
                    setFormData({ ...formData, average_speed_kmh: parseFloat(e.target.value) })
                  }
                  margin="normal"
                  inputProps={{ min: 10, max: 120, step: 5 }}
                  helperText="Rota süresi hesabı için ortalama hız"
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
