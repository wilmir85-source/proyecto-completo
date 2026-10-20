import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { useUsers } from "@/hooks/useUsers";
import { UserSelect } from "@/components/Selects";
import { toISO, fmtDate, apiError } from "@/lib/stages";
import { Avatar } from "@/components/Badges";

const EMPTY = { titulo: "", descripcion: "", fecha: "", prioridad: "media", asignado_a: "" };

export default function Tareas() {
  const { users } = useUsers();
  const [tasks, setTasks] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = () => api.get("/tasks").then((r) => setTasks(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.titulo) return toast.error("Pon un título");
    try {
      await api.post("/tasks", { ...form, fecha: toISO(form.fecha), asignado_a: form.asignado_a || null });
      setOpen(false);
      setForm(EMPTY);
      load();
      toast.success("Tarea creada · llegará a tu iPhone si estás suscrito");
    } catch (e) { toast.error(apiError(e)); }
  };

  const toggle = async (t) => {
    await api.patch(`/tasks/${t.id}`, { completada: !t.completada });
    load();
  };

  const remove = async (id) => {
    try {
      await api.delete(`/tasks/${id}`);
      load();
      toast.success("Eliminada");
    } catch (e) { toast.error(apiError(e)); }
  };

  const prioColor = { alta: "text-red-400 bg-red-500/15 border-red-500/30", media: "text-amber-400 bg-amber-500/15 border-amber-500/30", baja: "text-zinc-400 bg-zinc-500/15 border-zinc-500/30" };

  return (
    <div className="p-5 md:p-12">
      <header className="flex items-end justify-between mb-10">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-3">Agenda</div>
          <h1 className="font-display text-4xl font-light">Tareas</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-600 hover:bg-amber-500 text-black" data-testid="btn-new-task"><Plus className="w-4 h-4 mr-1" />Nueva tarea</Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-950 border-zinc-800">
            <DialogHeader><DialogTitle className="font-display">Nueva tarea</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Título" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="bg-zinc-900 border-zinc-800" data-testid="input-task-titulo" />
              <Input placeholder="Descripción" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className="bg-zinc-900 border-zinc-800" data-testid="input-task-descripcion" />
              <Input type="datetime-local" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="bg-zinc-900 border-zinc-800" data-testid="input-task-fecha" />
              <Select value={form.prioridad} onValueChange={(v) => setForm({ ...form, prioridad: v })}>
                <SelectTrigger className="bg-zinc-900 border-zinc-800" data-testid="select-task-prioridad"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800">
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
              <UserSelect users={users} value={form.asignado_a} onChange={(v) => setForm({ ...form, asignado_a: v })} testid="select-task-asignado" />
              <Button onClick={create} className="w-full bg-amber-600 hover:bg-amber-500 text-black" data-testid="btn-create-task">Crear</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="space-y-3 max-w-3xl">
        {tasks.length === 0 && <div className="text-sm text-zinc-500">No hay tareas aún</div>}
        {tasks.map((t) => (
          <div key={t.id} className={`card-glass rounded-xl p-4 flex items-center gap-4 group ${t.completada ? "opacity-50" : ""}`} data-testid={`task-${t.id}`}>
            <Checkbox checked={t.completada} onCheckedChange={() => toggle(t)} data-testid={`check-${t.id}`} />
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${t.completada ? "line-through" : ""}`}>{t.titulo}</div>
              {t.descripcion && <div className="text-xs text-zinc-500 mt-0.5">{t.descripcion}</div>}
              {t.fecha && <div className={`text-xs mt-1 flex items-center gap-1 ${!t.completada && new Date(t.fecha) < new Date() ? "text-red-400" : "text-zinc-500"}`}><CalendarClock className="w-3 h-3" />{fmtDate(t.fecha)}</div>}
              {(t.asignado_nombre || t.creado_por) && <div className="text-[10px] text-zinc-600 mt-1">{t.asignado_nombre ? `Para ${t.asignado_nombre}` : ""}{t.creado_por ? ` · de ${t.creado_por}` : ""}</div>}
            </div>
            {t.asignado_nombre && <Avatar name={t.asignado_nombre} />}
            <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded border ${prioColor[t.prioridad]}`}>{t.prioridad}</span>
            <button onClick={() => remove(t.id)} className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`del-task-${t.id}`}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
