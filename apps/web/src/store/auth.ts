import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '@/lib/api';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'user';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: true,

      login: async (email: string, password: string) => {
        const response = await authApi.login(email, password);
        const { access_token, user } = response.data;
        
        localStorage.setItem('token', access_token);
        set({ user, token: access_token, isLoading: false });
      },

      register: async (email: string, password: string, fullName: string) => {
        const response = await authApi.register(email, password, fullName);
        const { access_token, user } = response.data;
        
        localStorage.setItem('token', access_token);
        set({ user, token: access_token, isLoading: false });
      },

      logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null });
      },

      checkAuth: async () => {
        const token = localStorage.getItem('token');
        if (!token) {
          set({ isLoading: false });
          return;
        }

        try {
          const response = await authApi.me();
          set({ user: response.data, token, isLoading: false });
        } catch (error) {
          localStorage.removeItem('token');
          set({ user: null, token: null, isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
    }
  )
);
