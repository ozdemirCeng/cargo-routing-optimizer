import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const api = axios.create({
  baseURL: API_URL ? `${API_URL}/api` : '/api',
  headers: {
    "Content-Type": "application/json",
  },
});

// Token interceptor
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Error interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  register: (email: string, password: string, fullName: string) =>
    api.post("/auth/register", { email, password, fullName }),
  me: () => api.get("/auth/me"),
};

// Users API
export const usersApi = {
  getAll: () => api.get("/users"),
  getById: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post("/users", data),
  update: (id: string, data: any) => api.patch(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
};

// Stations API
export const stationsApi = {
  getAll: () => api.get("/stations"),
  getById: (id: string) => api.get(`/stations/${id}`),
  getSummary: (date: string) => api.get(`/stations/summary?date=${date}`),
  create: (data: any) => api.post("/stations", data),
  update: (id: string, data: any) => api.patch(`/stations/${id}`, data),
  delete: (id: string) => api.delete(`/stations/${id}`),
};

// Vehicles API
export const vehiclesApi = {
  getAll: () => api.get("/vehicles"),
  getAvailable: () => api.get("/vehicles/available"),
  create: (data: any) => api.post("/vehicles", data),
  update: (id: string, data: any) => api.patch(`/vehicles/${id}`, data),
  delete: (id: string) => api.delete(`/vehicles/${id}`),
};

// Cargos API
export const cargosApi = {
  getAll: (params?: any) => api.get("/cargos", { params }),
  getById: (id: string) => api.get(`/cargos/${id}`),
  getRoute: (id: string) => api.get(`/cargos/${id}/route`),
  create: (data: any) => api.post("/cargos", data),
  update: (id: string, data: any) => api.patch(`/cargos/${id}`, data),
  delete: (id: string) => api.delete(`/cargos/${id}`),
  loadScenario: (data: any) => api.post("/cargos/load-scenario", data),
  getSummary: (date: string) => api.get(`/cargos/summary/${date}`),
  clearByDate: (date: string) => api.delete(`/cargos/clear/${date}`),
};

// Plans API
export const plansApi = {
  getAll: (params?: any) => api.get("/plans", { params }),
  getById: (id: string) => api.get(`/plans/${id}`),
  getRoutes: (id: string) => api.get(`/plans/${id}/routes`),
  create: (data: any) => api.post("/plans", data),
  activate: (id: string) => api.post(`/plans/${id}/activate`),
  delete: (id: string) => api.delete(`/plans/${id}`),
};

// Trips API
export const tripsApi = {
  getAll: (params?: any) => api.get("/trips", { params }),
  getById: (id: string) => api.get(`/trips/${id}`),
  start: (id: string) => api.post(`/trips/${id}/start`),
  complete: (id: string) => api.post(`/trips/${id}/complete`),
  updateStatus: (id: string, status: string) =>
    api.patch(`/trips/${id}/status`, { status }),
};

// Dashboard API
export const dashboardApi = {
  getSummary: () => api.get("/dashboard/summary"),
  getCostAnalysis: (planId?: string) =>
    api.get("/dashboard/cost-analysis", { params: { planId } }),
  getScenarioComparison: (planIds: string[]) =>
    api.get("/dashboard/scenario-comparison", { params: { planIds } }),
};

// Parameters API
export const parametersApi = {
  getAll: () => api.get("/parameters"),
  update: (data: Record<string, number>) => api.patch("/parameters", data),
};

// Routing API
export const routingApi = {
  getDistance: (from: string, to: string) =>
    api.get(`/routing/distance?from=${from}&to=${to}`),
  getMatrix: (stationIds: string[]) =>
    api.post("/routing/matrix", { stationIds }),
  refreshCache: () => api.post("/routing/refresh-cache"),
};
