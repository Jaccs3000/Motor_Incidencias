# Monitor de Incidencias Jira

Aplicación web local para consultar Jira Cloud desde un backend Spring Boot, persistir información funcional en IndexedDB y mostrar una vista consolidada por proyecto funcional.

## Arquitectura

- Backend: Java 17, Spring Boot, Maven Wrapper.
- Frontend: React, Vite, MUI.
- Persistencia funcional: IndexedDB en el navegador.
- Logs técnicos: archivos locales en `logs/`.
- Jira: llamadas REST desde backend usando API token configurado localmente.

El frontend no llama Jira directamente. Esto evita el bloqueo CORS del navegador y mantiene el API token fuera de la interfaz.

## Configuración Local

Copia el archivo de ejemplo:

```powershell
Copy-Item config\application-local.example.yml config\application-local.yml
```

Edita:

```yaml
jira:
  base-url: https://puertodecartagena.atlassian.net
  email: usuario@empresa.com
  api-token: PEGAR_API_TOKEN_AQUI
```

`config/application-local.yml` está ignorado por Git.

## Ejecutar Backend

```powershell
cd C:\Monitor_Incidencias
.\mvnw.cmd spring-boot:run
```

Health check:

```text
http://localhost:8080/api/health
```

## Ejecutar Frontend

```powershell
cd C:\Monitor_Incidencias\src\app
npm install
npm run dev -- --host localhost --port 5174
```

Aplicación:

```text
http://localhost:5173
```

## Compilar

Backend:

```powershell
cd C:\Monitor_Incidencias
.\mvnw.cmd -DskipTests package
```

Frontend:

```powershell
cd C:\Monitor_Incidencias\src\app
npm run build
```

## Flujo Principal

1. El usuario configura filtros Jira en la pantalla de configuración.
2. El frontend solicita sincronización.
3. El backend consulta Jira con Basic Auth.
4. El frontend recorre incidencias enlazadas por lotes.
5. Se normalizan incidencias relevantes según `monitorConfig`.
6. Se persiste estado actual en IndexedDB.
7. Se construyen grupos de proyecto funcional.
8. Se actualiza el grid.
9. Se evalúan alertas y notificaciones no leídas.

## Archivos Relevantes

- `src/app/src/config/monitorConfig.js`: tipos de incidencia, atributos, columnas y parámetros técnicos.
- `src/app/src/services/syncService.js`: sincronización, recorrido de enlaces y persistencia.
- `src/app/src/services/notificationService.js`: alertas, notificaciones, acknowledge y recordatorios.
- `src/app/src/db/database.js`: stores de IndexedDB.
- `src/main/java/com/gpc/monitorincidencias/service/JiraClientService.java`: cliente REST de Jira.
- `src/main/java/com/gpc/monitorincidencias/service/SyncLockService.java`: bloqueo de sincronización.
- `src/main/java/com/gpc/monitorincidencias/service/AppLogService.java`: escritura de logs.

## Pruebas Sin API Token

Sin token real, se puede validar:

- build backend;
- build frontend;
- `/api/health`;
- estado visual de Jira no configurado;
- pantalla de configuración;
- IndexedDB y preferencias locales;
- lock de sincronización;
- logs locales.

Las pruebas contra Jira real requieren completar `config/application-local.yml`.
