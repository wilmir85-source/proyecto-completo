import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Bienvenido de vuelta");
      nav("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al ingresar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-20 left-20 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-10"><BrandMark size="lg" /></div>

        <div className="card-glass rounded-2xl p-8 relative grain">
          <h1 className="font-display text-3xl font-light mb-2">Bienvenido</h1>
          <p className="text-sm text-zinc-400 mb-8">Ingresa a tu taller inteligente</p>

          <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            <div>
              <label className="text-xs uppercase tracking-widest text-zinc-500 mb-2 block">Email</label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-zinc-950 border-zinc-800 h-11"
                placeholder="tu@joyeria.com"
                data-testid="login-email"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-zinc-500 mb-2 block">Contraseña</label>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-zinc-950 border-zinc-800 h-11"
                placeholder="••••••••"
                data-testid="login-password"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-amber-600 hover:bg-amber-500 text-black font-medium rounded-xl mt-2"
              data-testid="login-submit"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ingresar al taller"}
            </Button>
          </form>

          <div className="mt-6 text-sm text-zinc-500 text-center">
            ¿Primera vez?{" "}
            <Link to="/register" className="text-amber-500 hover:text-amber-400" data-testid="link-register">
              Crear cuenta
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
