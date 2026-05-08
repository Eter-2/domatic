# Handoff: main

**Último autor:** Luís (via Claude Code / Vera)
**Data:** 2026-05-08
**Branch:** main

## O que foi feito

Sessão de arranque e debugging do domAtic do zero até ao estado funcional. O projecto já existia mas nunca tinha sido arrancado — resolvemos conflitos de portas, bugs de autenticação, CORS, dashboard com crash, e integrámos o módulo BIM completo portado do projecto constructos. Next.js atualizado de 14 para 15.

### Fixes resolvidos
1. **Porto 3000 ocupado pelo Wazuh** → frontend remapeado para `:3002`
2. **bcrypt 5.0 incompatível com passlib 1.7.4** → fixado `bcrypt==3.2.2` em requirements.txt
3. **CORS bloqueava `:3002`** → adicionado ao `CORS_ORIGINS` no `.env`
4. **NEXT_PUBLIC_API_URL embebido em build-time** → Dockerfile corrigido com ARG + ENV antes do npm build
5. **Frontend apontava para porta interna do container `:8000`** → corrigido para `:8001/api/v1`
6. **Login retornava sem user object** → `auth.ts` chama `/auth/me` após login
7. **Backend aceitava só `username`, frontend enviava `email`** → LoginRequest aceita ambos, authenticate_user faz OR query
8. **Dashboard crash** (TypeError: Cannot read properties of undefined) → DashboardSummary reconstruído com rooms/events/mqtt
9. **Conta admin criada** → admin@domatic.dev / domatic2026

### Integração BIM (portado do constructos)
- Backend: BimModel, migration 0002, bim_service.py, route /api/v1/bim
- Frontend: useBim.ts, IFCViewer.tsx, BimModelUpload.tsx, BimModelList.tsx, página /bim
- Sidebar: link "Modelos BIM" adicionado
- Next.js 14.2.3 → 15.5.18 (necessário para @thatopen/components)
- Deps BIM: @thatopen/components, web-ifc, three, @thatopen/fragments, camera-controls

## Onde parou

Tudo a correr. Containers up, login funcional, dashboard carrega, página /bim acessível em localhost:3002/bim.
**Não testado:** upload de .ifc real e visualização 3D no browser.

## Próximos passos

1. Copiar web-ifc WASM para public/:
   cp node_modules/web-ifc/*.wasm frontend/public/web-ifc/
   (necessário para o viewer 3D funcionar — sem eles cai para modo download)

2. Testar viewer BIM — carregar um ficheiro .ifc em localhost:3002/bim

3. Correr seeds: make seed

4. Investigar MQTT bridge — logs mostram "connection refused code:5"; ver mosquitto/config/

5. Fazer commit de tudo (17 ficheiros modificados + 11 novos, nada commitado)

## Bloqueios

- **MQTT desconectado** — mosquitto corre mas bridge falha. Verificar auth em mosquitto/config/passwd
- **web-ifc WASM em falta** — IFCViewer precisa de /web-ifc/*.wasm em public/; sem eles viewer não funciona

## Credenciais dev

- URL: http://localhost:3002
- Email: admin@domatic.dev  
- Password: domatic2026
- Backend API: http://localhost:8001/api/v1
- Docs: http://localhost:8001/api/docs

## Ficheiros principais tocados

backend/app/api/routes/auth.py          login aceita email ou username
backend/app/api/routes/dashboard.py     summary completo reconstruído
backend/app/api/routes/bim.py           NOVO — endpoints BIM
backend/app/config.py                   UPLOAD_DIR, BIM_MAX_BYTES
backend/app/db/models.py                BimModel adicionado
backend/app/schemas/auth.py             LoginRequest aceita email opcional
backend/app/schemas/dashboard.py        DashboardSummary reconstruído
backend/app/schemas/bim.py              NOVO
backend/app/services/auth_service.py    authenticate_user aceita email ou username
backend/app/services/bim_service.py     NOVO
backend/alembic/versions/0002_bim_models.py  NOVO migration
backend/requirements.txt                bcrypt==3.2.2

frontend/Dockerfile                     ARG build-time + --legacy-peer-deps
frontend/next.config.mjs                asyncWebAssembly + layers
frontend/package.json                   Next.js 15, React 19, deps BIM
frontend/.eslintrc.json                 no-explicit-any off
frontend/src/lib/auth.ts                login chama /auth/me após token
frontend/src/components/layout/Sidebar.tsx  link BIM
frontend/src/components/bim/            NOVO: IFCViewer, BimModelUpload, BimModelList
frontend/src/app/(dashboard)/bim/       NOVO: página BIM
frontend/src/hooks/useBim.ts            NOVO

docker-compose.yml                      portas corretas, volume bim_uploads, UPLOAD_DIR
.env                                    CORS_ORIGINS inclui :3002
