import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../stores/useAuth';

export default function ProtectedRoute() {
  const token = useAuth((s) => s.token);
  return token ? <Outlet /> : <Navigate to="/auth/login" replace />;
}
