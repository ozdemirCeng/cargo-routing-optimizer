'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Tab,
  Tabs,
  CircularProgress,
} from '@mui/material';
import { useAuthStore } from '@/store/auth';

export default function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuthStore();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    fullName: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(loginData.email, loginData.password);
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await register(registerData.email, registerData.password, registerData.fullName);
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Kayıt başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%' }}>
        <CardContent>
          <Typography variant="h5" align="center" gutterBottom>
            🚚 Kargo İşletme Sistemi
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary" mb={3}>
            Kocaeli Üniversitesi
          </Typography>

          <Tabs value={tab} onChange={(_, v) => setTab(v)} centered sx={{ mb: 3 }}>
            <Tab label="Giriş Yap" />
            <Tab label="Kayıt Ol" />
          </Tabs>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {tab === 0 ? (
            <form onSubmit={handleLogin}>
              <TextField
                fullWidth
                label="E-posta"
                type="email"
                value={loginData.email}
                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Şifre"
                type="password"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                margin="normal"
                required
              />
              <Button
                fullWidth
                variant="contained"
                type="submit"
                disabled={loading}
                sx={{ mt: 2 }}
              >
                {loading ? <CircularProgress size={24} /> : 'Giriş Yap'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <TextField
                fullWidth
                label="Ad Soyad"
                value={registerData.fullName}
                onChange={(e) => setRegisterData({ ...registerData, fullName: e.target.value })}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="E-posta"
                type="email"
                value={registerData.email}
                onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Şifre"
                type="password"
                value={registerData.password}
                onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                margin="normal"
                required
              />
              <Button
                fullWidth
                variant="contained"
                type="submit"
                disabled={loading}
                sx={{ mt: 2 }}
              >
                {loading ? <CircularProgress size={24} /> : 'Kayıt Ol'}
              </Button>
            </form>
          )}

          <Typography variant="caption" display="block" align="center" mt={2} color="text.secondary">
            Demo: admin@kargo.local / admin123
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
