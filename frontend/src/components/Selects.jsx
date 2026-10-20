import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NONE = "__none__";

export const SimpleSelect = ({ value, onChange, options, placeholder, testid, className = "" }) => (
  <Select value={value || undefined} onValueChange={onChange}>
    <SelectTrigger className={`bg-zinc-900 border-zinc-800 ${className}`} data-testid={testid}><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent className="bg-zinc-950 border-zinc-800">
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        return <SelectItem key={v} value={v}>{typeof o === "string" ? o : o.label}</SelectItem>;
      })}
    </SelectContent>
  </Select>
);

export const UserSelect = ({ users, value, onChange, testid, className = "" }) => (
  <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
    <SelectTrigger className={`bg-zinc-900 border-zinc-800 ${className}`} data-testid={testid}><SelectValue placeholder="Asignar a..." /></SelectTrigger>
    <SelectContent className="bg-zinc-950 border-zinc-800">
      <SelectItem value={NONE}>Sin asignar</SelectItem>
      {users.filter((u) => u.activo !== false).map((u) => (
        <SelectItem key={u.id} value={u.id}>{u.name}{u.departamento ? ` · ${u.departamento}` : ""}</SelectItem>
      ))}
    </SelectContent>
  </Select>
);
