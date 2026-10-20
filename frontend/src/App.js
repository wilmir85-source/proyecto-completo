import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "sonner";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Tablero from "@/pages/Tablero";
import Tareas from "@/pages/Tareas";
import Clientes from "@/pages/Clientes";
import JarvisHUD from "@/pages/JarvisHUD";
import Produccion from "@/pages/Produccion";
import MisTrabajos from "@/pages/MisTrabajos";
import Ventas from "@/pages/Ventas";
import Equipo from "@/pages/Equipo";
import IPhone from "@/pages/IPhone";
import Inventario from "@/pages/Inventario";
import MiJoyeria from "@/pages/MiJoyeria";
import Seguimiento from "@/pages/Seguimiento";
import { Loader2 } from "lucide-react";

const ADMIN_VENTAS = ["admin", "ventas"];
const ADMIN_ONLY = ["admin"];

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RoleGate({ roles, children }) {
  const { user } = useAuth();
  return roles.includes(user?.role) ? children : <Navigate to="/" replace />;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster theme="dark" position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/seguimiento/:token" element={<Seguimiento />} />
          <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
          <Route element={<Protected><Layout /></Protected>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pedidos" element={<Tablero />} />
            <Route path="/produccion" element={<Produccion />} />
            <Route path="/mis-trabajos" element={<MisTrabajos />} />
            <Route path="/ventas" element={<RoleGate roles={ADMIN_VENTAS}><Ventas /></RoleGate>} />
            <Route path="/tareas" element={<Tareas />} />
            <Route path="/clientes" element={<RoleGate roles={ADMIN_VENTAS}><Clientes /></RoleGate>} />
            <Route path="/equipo" element={<RoleGate roles={ADMIN_ONLY}><Equipo /></RoleGate>} />
            <Route path="/iphone" element={<IPhone />} />
            <Route path="/inventario" element={<Inventario />} />
            <Route path="/mi-joyeria" element={<RoleGate roles={ADMIN_ONLY}><MiJoyeria /></RoleGate>} />
            <Route path="/jarvis" element={<JarvisHUD />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
