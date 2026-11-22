# Test credentials (preview only, local DB joyeria_preview)
- Admin: admin@joyeria.com / joyeria123 (role admin, seeded from backend/.env)
- Ventas: ventas@joyeria.com / ventas123 (role ventas)
- Trabajador: maria@joyeria.com / maria123 (role trabajador, name "María López")
Login: POST /api/auth/login {email,password} -> {token,user}; frontend stores token in localStorage "jarvis_token".
