import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { DEPARTMENTS, ROLE_LABELS, apiError } from "@/lib/stages";
import { SimpleSelect } from "@/components/Selects";
import { Avatar } from "@/components/Badges";
import { Check, ChevronsUpDown } from "lucide-react";

const ROLE_OPTS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

// Componente interno para seleccionar múltiples departamentos
const DeptMultiSelect = ({ value, onChange, testid }) => {
  const [open, setOpen] = useState(false);
  
  // Convertimos el valor a array (por si el usuario tenía un solo departamento en la DB)
  const selected = Array.isArray(value) ? value : (value ? [value] : []);

  const toggle = (dept) => {
    if (selected.includes(dept)) {
      onChange(selected.filter((d) => d !== dept));
    } else {
      onChange([...selected, dept]);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        data-testid={testid}
        className="w-full h-10 px-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-left flex items-center justify-between text-zinc-300 hover:border-zinc-700 transition-colors"
      >
        <span className="truncate pr-2">
          {selected.length > 0 ? selected.join(", ") : "Sin departamento"}
        </span>
        <ChevronsUpDown className="w-4 h-4 text-zinc-500 shrink-0" />
      </button>

      {open && (
        <>
          {/* Fondo oscuro invisible para cerrar al tocar afuera */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          
          <div className="absolute z-50 top-12 left-0 w-full bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl max-h-60 overflow-y-auto p-1.5">
            {DEPARTMENTS.map((d) => (
              <div
                key={d}
                onClick={() => toggle(d)}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-900 rounded-md cursor-pointer text-sm text-zinc-300 transition-colors"
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${selected.includes(d) ? 'bg-amber-500 border-amber-500' : 'border-zinc-600'}`}>
                  {selected.includes(d) && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                </div>
                {d}
              </div>
            ))}
            <div className="p-1.5 border-t border-zinc-800/50 mt-1">
              <button onClick={() => setOpen(false)} className="w-full py-2 text-xs bg-zinc-900 hover:bg-zinc-800 rounded-md font-medium text-zinc-300">
                Listo
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default function Equipo() {
  const { user: me } = useAuth();
  const { users, reload } = useUsers();

  const update = async (id, body) => {
    try {
      await api.patch(`/users/${id}`, body);
      toast.success("Usuario actualizado");
      reload();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="p-5 md:p-12 max-w-5xl">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-3">Administración</div>
        <h1 className="font-display text-4xl font-light">Equipo</h1>
        <p className="text-sm text-zinc-500 mt-2">Los trabajadores se registran solos en /register. Aquí defines su rol y departamento.</p>
      </header>
      <div className="space-y-3" data-testid="team-list">
        {users.map((u) => (
          <div key={u.id} className={`card-glass rounded-2xl p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center ${u.activo === false ? "opacity-50" : ""}`} data-testid={`team-${u.id}`}>
            
            {/* Nombre y Correo */}
            <div className="md:col-span-3 flex items-center gap-3 min-w-0">
              <Avatar name={u.name} className="w-9 h-9 text-xs" />
              <div className="min-w-0">
                <div className="truncate">{u.name}</div>
                <div className="text-xs text-zinc-500 truncate">{u.email}{u.telefono ? ` · ${u.telefono}` : ""}</div>
              </div>
            </div>

            {/* Selector de Rol */}
            <div className="md:col-span-2">
              <SimpleSelect value={u.role} onChange={(v) => update(u.id, { role: v })} options={ROLE_OPTS} testid={`team-role-${u.id}`} />
            </div>

            {/* Selector Múltiple de Departamentos */}
            <div className="md:col-span-5">
              <DeptMultiSelect 
                value={u.departamento} 
                onChange={(newDeptos) => update(u.id, { departamento: newDeptos })} 
                testid={`team-dept-${u.id}`} 
              />
            </div>

            {/* Switch de Activo */}
            <div className="md:col-span-2 flex items-center gap-2 justify-end text-xs text-zinc-500">
              Activo
              <Switch checked={u.activo !== false} disabled={u.id === me?.id} onCheckedChange={(v) => update(u.id, { activo: v })} data-testid={`team-active-${u.id}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}