'use client';

import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  CircularProgress,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Add as AddIcon, Visibility as ViewIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { cargosApi } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function UserDashboard() {
  const router = useRouter();

  const { data: cargos, isLoading } = useQuery({
    queryKey: ['my-cargos'],
    queryFn: () => cargosApi.getAll().then((r) => r.data),
  });

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
    { field: 'trackingCode', headerName: 'Takip Kodu', width: 150 },
    {
      field: 'originStation',
      headerName: 'Teslim Noktası',
      width: 150,
      valueGetter: (params) => params.row.originStation?.name,
    },
    {
      field: 'weightKg',
      headerName: 'Ağırlık',
      width: 100,
      valueFormatter: (params) => `${Number(params.value).toFixed(1)} kg`,
    },
    {
      field: 'scheduledDate',
      headerName: 'Planlanan Tarih',
      width: 130,
      valueFormatter: (params) =>
        params.value ? new Date(params.value).toLocaleDateString('tr-TR') : '-',
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
      field: 'createdAt',
      headerName: 'Oluşturma',
      width: 130,
      valueFormatter: (params) => new Date(params.value).toLocaleDateString('tr-TR'),
    },
    {
      field: 'actions',
      headerName: 'İşlemler',
      width: 120,
      renderCell: (params) => (
        <Button
          size="small"
          startIcon={<ViewIcon />}
          onClick={() => router.push(`/user/track?id=${params.row.id}`)}
          disabled={!['assigned', 'in_transit'].includes(params.row.status)}
        >
          Takip
        </Button>
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
        <Typography variant="h4">Kargolarım</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => router.push('/user/new-cargo')}
        >
          Yeni Kargo
        </Button>
      </Box>

      <Card>
        <CardContent>
          {cargos?.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                Henüz kargonuz bulunmuyor
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => router.push('/user/new-cargo')}
              >
                İlk Kargonuzu Oluşturun
              </Button>
            </Box>
          ) : (
            <DataGrid
              rows={cargos || []}
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
    </Box>
  );
}
