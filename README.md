# SENATI TaskHub PWA

**Reto:** Bandeja de entregas offline con validación, persistencia IndexedDB y control de estados de sincronización.  
**Institución:** SENATI – Escuela de Tecnologías de la Información  
**Curso:** Seminario de Complementación Práctica / Aplicaciones Web Progresivas  
**Instructor:** Jorge Luque Chambi  
**Estudiante:** Rodrigo Daniel Ormeño Llanos  

---

## 1. Descripción del Proyecto

SENATI TaskHub PWA es una Aplicación Web Progresiva construida con **Angular 19** que resuelve el flujo completo de entrega de tareas y asignaciones para estudiantes en escenarios de conectividad variable o nula:

- **Búsqueda y filtros combinables:** Búsqueda en tiempo real por título o docente e interactividad con filtro por asignatura.
- **Formulario validado:** Validación estricta de tarea académica seleccionada y justificación/comentario no vacío con mensajes de error contextuales.
- **Persistencia en IndexedDB (`senatiTaskHubDB`):** Las entregas se almacenan localmente con esquema tipado (`EntregaLocal`), persistiendo íntegramente tras recargar el navegador o reiniciar el equipo.
- **Bandeja "Mis entregas locales":** Consulta detallada de entregas persistidas, conteo de registros y eliminación confirmada.
- **Control honesto de sincronización (TH-06):** No asume falsamente que los datos se enviaron a un servidor remoto solo por tener conexión `navigator.onLine`. Todo registro inicializa en `PENDIENTE` y mantiene mensajes claros de transparencia técnica.
- **Capacidades PWA:** Configuración de `manifest.webmanifest`, registro de `Service Worker` (`ngsw-worker.js`) y almacenamiento en caché de activos y datos JSON.

---

## 2. Requisitos Previos

- **Node.js:** v18.x o v20.x / v22.x
- **NPM:** v9.x o superior
- **Angular CLI:** `@angular/cli` v19+ (o vía `npx ng`)
- **Navegador:** Google Chrome, Edge o Firefox con soporte para Service Workers e IndexedDB.

---

## 3. Comandos de Ejecución

### Modo Desarrollo
```bash
npm start
# O alternativamente:
npx ng serve
```
Acceder en el navegador a: `http://localhost:4200`

### Compilación para Producción (PWA)
Para verificar el Service Worker y el Cache Storage en funcionamiento real:
```bash
npm run build
```
Los archivos optimizados se generan en `dist/backus-ventas-pwa/browser`.

### Servir en entorno PWA (con Service Worker activo)
```bash
npx http-server ./dist/backus-ventas-pwa/browser -p 8080 -c-1
```
Abrir `http://localhost:8080` en Chrome o Edge.

---

## 4. Matriz de Cumplimiento de Reglas y Aceptación

| ID | Regla | Resultado Verificable | Estado |
|---|---|---|---|
| **TH-01** | Búsqueda y filtro combinables | Permite buscar por texto y filtrar simultáneamente por asignatura (ej. "Service Worker" + "Desarrollo Web PWA"). | ✅ Implementado |
| **TH-02** | Tarea y comentario obligatorios | Impide el registro si no se seleccionó tarea o si el comentario está vacío, mostrando alertas en rojo. | ✅ Implementado |
| **TH-03** | Entrega guarda tarea y fecha | Registra `tareaId`, curso, título, comentario y marca de tiempo ISO en IndexedDB. Persiste tras recargar. | ✅ Implementado |
| **TH-04** | Nueva entrega empieza `PENDIENTE` | Al registrarse, el estado inicial es indefectiblemente `PENDIENTE`. | ✅ Implementado |
| **TH-05** | Contador derivado de persistidos | La insignia de entregas pendientes en el menú y las tarjetas métricas reflejan los datos de IndexedDB. | ✅ Implementado |
| **TH-06** | Online no significa sincronizado | Al detectar red, muestra *"Con conexión: listo para intentar sincronizar"*. No marca `SINCRONIZADO` sin confirmación de API remota. | ✅ Implementado |
| **TH-07** | Eliminación confirmada | Diálogo modal de advertencia: cancelar conserva el registro, confirmar lo elimina físicamente de IndexedDB. | ✅ Implementado |
| **TH-08** | Errores de IndexedDB informados | Captura de errores en transacciones asíncronas con feedback visual al usuario. | ✅ Implementado |

---

## 5. Preguntas de Reflexión Técnica

### 1. ¿Por qué una entrega debe persistir tras recargar el navegador?
> Porque en entornos reales de estudiantes con conectividad móvil o inestable, el navegador puede recargarse accidentalmente por falta de memoria o reinicio de pestaña. Si la entrega solo reside en memoria RAM (variables de JavaScript), el trabajo del estudiante se perdería irremediablemente. Persistir en IndexedDB garantiza durabilidad y resiliencia.

### 2. ¿Qué campos relacionan la entrega con su tarea?
> Principalmente el campo `tareaId: number`, complementado por `curso: string` y `tituloTarea: string` para mantener trazabilidad histórica incluso si el catálogo cambia.

### 3. ¿Qué riesgo hay al reintentar sincronizar varias veces?
> El riesgo de duplicidad de envíos o colisiones (condiciones de carrera). Si un intento previo quedó en tránsito o el servidor lo procesó pero se perdió el ACK, reintentar ciegamente crearía registros duplicados. Por ello, una API real debe implementar idempotencia (mediante tokens o identificador único `UUID` por entrega).

### 4. ¿Qué validaciones debe repetir el servidor al integrar una API?
> El servidor nunca debe confiar en el cliente: debe validar la existencia y estado de la tarea (`tareaId`), permisos del usuario autenticado, que el plazo de entrega no haya expirado según la hora oficial del servidor, que el comentario no contenga inyecciones maliciosas (XSS/SQLi) y que los archivos adjuntos cumplan con el tipo MIME y límite de tamaño permitido.

---

## 6. Estructura del Código

```text
senati-taskhub-pwa/
├── public/
│   ├── data/
│   │   └── tareas.json           # Catálogo académico base
│   ├── icons/                    # Iconos PWA estándar (72x72 a 512x512)
│   └── manifest.webmanifest      # Configuración de instalación PWA
├── src/
│   ├── app/
│   │   ├── services/
│   │   │   ├── tarea.service.ts   # Carga y fallback de tareas
│   │   │   └── storage.service.ts # Capa de persistencia IndexedDB
│   │   ├── app.html              # Vistas: Catálogo, Formulario y Bandeja
│   │   ├── app.scss              # Estilos responsivos institucionales SENATI
│   │   └── app.ts                # Lógica del componente y eventos PWA
│   ├── index.html
│   ├── main.ts
│   └── styles.scss
├── angular.json
├── ngsw-config.json              # Configuración de Service Worker y Cache
└── package.json
```
