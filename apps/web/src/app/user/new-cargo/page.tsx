'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useQuery, useMutation } from '@tanstack/react-query';
import { stationsApi, cargosApi } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function NewCargoPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    originStationId: '',
    weightKg: '',
    description: '',
    scheduledDate: '',
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const { data: stations, isLoading: stationsLoading } = useQuery({
    queryKey: ['stations'],
    queryFn: () => stationsApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: cargosApi.create,
    onSuccess: () => {
      router.push('/user');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      originStationId: formData.originStationId,
      weightKg: parseFloat(formData.weightKg),
      description: formData.description,
      scheduledDate: formData.scheduledDate || tomorrowStr,
    });
  };

  // Hub olmayan istasyonları filtrele
  const availableStations = stations?.filter((s: any) => !s.isHub) || [];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Yeni Kargo Oluştur
      </Typography>

      <Card sx={{ maxWidth: 600 }}>
        <CardContent>
          {createMutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {(createMutation.error as any)?.response?.data?.message || 'Kargo oluşturulurken hata oluştu'}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <FormControl fullWidth margin="normal" required>
              <InputLabel>Teslim Noktası (İlçe)</InputLabel>
              <Select
                value={formData.originStationId}
                label="Teslim Noktası (İlçe)"
                onChange={(e) => setFormData({ ...formData, originStationId: e.target.value })}
                disabled={stationsLoading}
              >
                {availableStations.map((station: any) => (
                  <MenuItem key={station.id} value={station.id}>
                    {station.name}
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
              helperText="Minimum 0.1 kg"
            />

            <TextField
              fullWidth
              label="Planlanan Tarih"
              type="date"
              value={formData.scheduledDate || tomorrowStr}
              onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
              margin="normal"
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: tomorrowStr }}
              helperText="En erken yarın için kargo oluşturabilirsiniz"
            />

            <TextField
              fullWidth
              label="Açıklama (opsiyonel)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              margin="normal"
              multiline
              rows={2}
            />

            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button variant="outlined" onClick={() => router.back()}>
                İptal
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={createMutation.isPending || !formData.originStationId || !formData.weightKg}
              >
                {createMutation.isPending ? <CircularProgress size={24} /> : 'Kargo Oluştur'}
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
