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
## Backlog
- P1: Notify requester when requisition status changes; delete requisition.
- P2: Exclude archived orders from active stats; dark-themed date picker.
