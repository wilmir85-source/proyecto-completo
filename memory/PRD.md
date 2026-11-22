# Jarvis Joyería (Mundo de Joyas) – PRD
## Problem
Jewelry workshop management app (React + FastAPI + Mongo): orders Kanban, production, inventory, molds, clients, sales, Jarvis AI assistant.
## Roles
admin, ventas (staff: see money), trabajador (no money).
## Implemented
- Arc reactor HUD for Jarvis (SVG + canvas lightning, curved "MUNDO DE JOYAS"/"JOYERÍA 3D").
- 2026-06: Requisitions (Pedir material): POST/GET/PATCH /api/requisitions; notify only active admin/ventas (in-app inbox + web push). Bell in header with panel: /api/notifications/inbox, read, read-all. Tap opens /requisiciones/:id + marks read.
- Money hiding: core.hide_money() for workers on orders list/update/notes/production; frontend MoneyGate (lib/permissions.jsx) on order detail, card saldo, finish dialog, revenue chart, requisition cost.
- Accessibility redesign: 16px base (tailwind font scale bumped), zinc-400 min contrast, 44px+ buttons/inputs, modern cards, plain-language nav (lib/nav.js shared by sidebar + bottom nav, role filtered), arc-reactor Jarvis icon.
- Horizontal scroll: Kanban + Equipo + Ventas with touch-pan-x/y and visible styled scrollbar.
- Self-registration always creates 'trabajador' (admin promotes in Mi equipo).
- 2026-06 (v3 visual): Day/Night mode (ThemeContext, localStorage jarvis_theme, follows system first; Jarvis always dark), cream+gold day palette, Cormorant Garamond + Manrope fonts, thin lucide icons, floating glass sidebar (lg+) and pill bottom nav (<lg), gold-gradient buttons, glass cards, Moldes themed via CSS vars, theme-aware revenue chart, direct navigation (?pedido=id opens order, FAB ?nuevo opens new order). Day mode for older pages via theme-light.css mapping.
## Backlog
- P1: Notify requester when requisition status changes; delete requisition.
- P2: Exclude archived orders from active stats; dark-themed date picker.
