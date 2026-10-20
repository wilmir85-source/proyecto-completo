import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { toast } from "sonner";
import { DEPARTMENTS, apiError } from "@/lib/stages";
import { SimpleSelect } from "@/components/Selects";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", departamento: "", telefono: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.departamento) return toast.error("Elige tu departamento");
    setLoading(true);
    try {
      await register(form);
      toast.success("Cuenta creada");
      nav("/");
    } catch (err) {
      toast.error(apiError(err, "Error al registrarse"));
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
          <h1 className="font-display text-3xl font-light mb-2">Crear cuenta</h1>
          <p className="text-sm text-zinc-400 mb-8">Únete al taller. Tu rol se asigna según tu departamento (el admin puede cambiarlo).</p>
          <form onSubmit={submit} className="space-y-4" data-testid="register-form">
            <div>
              <label className="text-xs uppercase tracking-widest text-zinc-500 mb-2 block">Nombre</label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-zinc-950 border-zinc-800 h-11" placeholder="Tu nombre" data-testid="register-name" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-zinc-500 mb-2 block">Email</label>
              <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-zinc-950 border-zinc-800 h-11" placeholder="tu@joyeria.com" data-testid="register-email" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-zinc-500 mb-2 block">Contraseña</label>
              <Input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="bg-zinc-950 border-zinc-800 h-11" placeholder="Mínimo 6 caracteres" data-testid="register-password" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-widest text-zinc-500 mb-2 block">Departamento</label>
                <SimpleSelect value={form.departamento} onChange={(v) => setForm({ ...form, departamento: v })} options={DEPARTMENTS} placeholder="Elige..." testid="register-departamento" className="bg-zinc-950 h-11" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-zinc-500 mb-2 block">Teléfono</label>
                <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="bg-zinc-950 border-zinc-800 h-11" placeholder="Opcional" data-testid="register-telefono" />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 bg-amber-600 hover:bg-amber-500 text-black font-medium rounded-xl mt-2" data-testid="register-submit">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear cuenta"}
            </Button>
          </form>
          <div className="mt-6 text-sm text-zinc-500 text-center">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="text-amber-500 hover:text-amber-400" data-testid="link-login">Ingresar</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
