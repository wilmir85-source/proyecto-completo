import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { DEPARTMENTS, ROLE_LABELS, apiError } from "@/lib/stages";
import { SimpleSelect } from "@/components/Selects";
import { Avatar } from "@/components/Badges";

const ROLE_OPTS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

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
            <div className="md:col-span-4 flex items-center gap-3 min-w-0">
              <Avatar name={u.name} className="w-9 h-9 text-xs" />
              <div className="min-w-0">
                <div className="truncate">{u.name}</div>
                <div className="text-xs text-zinc-500 truncate">{u.email}{u.telefono ? ` · ${u.telefono}` : ""}</div>
              </div>
            </div>
            <div className="md:col-span-3">
              <SimpleSelect value={u.role} onChange={(v) => update(u.id, { role: v })} options={ROLE_OPTS} testid={`team-role-${u.id}`} />
            </div>
            <div className="md:col-span-3">
              <SimpleSelect value={u.departamento} placeholder="Departamento" onChange={(v) => update(u.id, { departamento: v })} options={DEPARTMENTS} testid={`team-dept-${u.id}`} />
            </div>
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
