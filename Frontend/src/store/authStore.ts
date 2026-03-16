import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'PROJECT_MANAGER' | 'TEAM_MEMBER';

export interface AuthUser {
  id:          string;
  name:        string;
  email:       string;
  role:        UserRole;
  employeeId?: string;
  department?: string;
}

interface AuthState {
  user:               AuthUser | null;
  token:              string | null;
  isAuthenticated:    boolean;
  mustChangePassword: boolean;
  setAuth:            (user: AuthUser, token: string, mustChange?: boolean) => void;
  setMustChange:      (v: boolean) => void;
  logout:             () => void;
  hasRole:            (...roles: UserRole[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:               null,
      token:              null,
      isAuthenticated:    false,
      mustChangePassword: false,
      setAuth: (user, token, mustChange = false) => {
        localStorage.setItem('access_token', token);
        set({ user, token, isAuthenticated: true, mustChangePassword: mustChange });
      },
      setMustChange: (v) => set({ mustChangePassword: v }),
      logout: () => {
        localStorage.removeItem('access_token');
        set({ user: null, token: null, isAuthenticated: false, mustChangePassword: false });
      },
      hasRole: (...roles) => {
        const user = get().user;
        return user ? roles.includes(user.role) : false;
      },
    }),
    {
      name: 'vthink-auth',
      partialize: (s) => ({
        user:               s.user,
        token:              s.token,
        isAuthenticated:    s.isAuthenticated,
        mustChangePassword: s.mustChangePassword,
      }),
    }
  )
);
