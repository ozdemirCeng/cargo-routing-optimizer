'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  IconButton,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Map as MapIcon,
  LocalShipping as VehicleIcon,
  Inventory as CargoIcon,
  LocationOn as StationIcon,
  Route as RouteIcon,
  Assessment as ReportIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useAuthStore } from '@/store/auth';

const drawerWidth = 240;

const adminMenuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/admin' },
  { text: 'Harita', icon: <MapIcon />, path: '/admin/map' },
  { text: 'İstasyonlar', icon: <StationIcon />, path: '/admin/stations' },
  { text: 'Araçlar', icon: <VehicleIcon />, path: '/admin/vehicles' },
  { text: 'Kargolar', icon: <CargoIcon />, path: '/admin/cargos' },
  { text: 'Planlar', icon: <RouteIcon />, path: '/admin/plans' },
  { text: 'Seferler', icon: <VehicleIcon />, path: '/admin/trips' },
  { text: 'Raporlar', icon: <ReportIcon />, path: '/admin/reports' },
  { text: 'Ayarlar', icon: <SettingsIcon />, path: '/admin/settings' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, checkAuth } = useAuthStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/user');
    } else if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            🚚 Kargo İşletme Sistemi - Admin Panel
          </Typography>
          <IconButton
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{ p: 0 }}
          >
            <Avatar sx={{ bgcolor: 'secondary.main' }}>
              {user.fullName.charAt(0)}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            <MenuItem disabled>
              <Typography variant="body2">{user.fullName}</Typography>
            </MenuItem>
            <MenuItem disabled>
              <Typography variant="caption" color="text.secondary">
                {user.email}
              </Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Çıkış Yap
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {adminMenuItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  selected={pathname === item.path}
                  onClick={() => router.push(item.path)}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
