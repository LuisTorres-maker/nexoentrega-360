# Principios del proyecto NexoEntrega 360

Versión: v0.1 (borrador de la ronda R0)
Fecha: 2026-10-14 (UTC)
Commit y revisión: PENDIENTE (Luis, autor; Carlos B, revisor). Se completa en el PR.

Estas reglas guían todo el trabajo del equipo. Cada una se puede comprobar con una evidencia concreta.
Si una regla no se cumple, se registra como excepción (última sección) y no se oculta.

## Principios comprobables

| ID | Regla | Motivo | Evidencia | Responsable |
|---|---|---|---|---|
| C1 | Toda operación valida identidad, rol y organización **en el servidor**. El navegador solo muestra. | El navegador no es confiable; ocultar un botón no es autorización. | Pruebas de 401, 403 y 404 (RF01, RF02, RNF01). | Jhoimer |
| C2 | Todo cambio de inventario ocurre dentro de una transacción, y ninguna cantidad queda negativa. | Evita la doble reserva, que es el problema del cliente. | Pruebas con base real y restricciones `CHECK` en la base (RF05, RF07, RNF02). | Andrés |
| C3 | Toda transición exitosa guarda su evento de auditoría en la **misma transacción** que el cambio. | La auditoría no puede tener huecos ni eventos de operaciones que fallaron. | Prueba que cuenta los eventos tras cada transición (RF09). | Andrés |
| C4 | La salida de la IA se valida con esquema estricto y en código; la IA nunca escribe datos ni mueve inventario. | Riesgo de inyección de instrucciones (OWASP LLM01). | Los 7 fixtures de IA corren en CI (RF10, RF11, RF12). | Carlos B |
| C5 | No se escribe código de negocio sin una SPEC aprobada por otra persona y con fecha anterior al código. | Es la cadena SDD: requerimiento, historia, SPEC, código, prueba. | Actas de hito en `docs/gates/`. | Luis |
| C6 | Todo PR cita RF y AC, trae pruebas, declara el uso de IA y lo revisa otra persona. | Trazabilidad real y responsabilidad humana sobre lo generado. | Plantilla de PR completa y revisión registrada. | Todos |
| C7 | No se une un PR con el CI en rojo. Un check desactivado queda visible y no se reporta como aprobado. | Evidencia honesta del estado del proyecto. | Historial de CI de GitHub Actions. | Carlos C |
| C8 | Ningún secreto entra al repositorio. Se usa `.env` (ignorado por Git) y `.env.example` con marcadores. | Seguridad de la base y de las cuentas. | Detección de secretos en CI y revisión de cada PR. | Carlos C |
| C9 | La entrega se levanta con un comando documentado desde un clon limpio. | Reproducibilidad (RNF04). | Ensayo cronometrado en otro computador. | Carlos B |
| C10 | Las evidencias se generan sobre el commit final y citan su SHA. | Comparabilidad: lo que se afirma corresponde al código entregado. | SHA registrado en `evidence/acceptance.md`. | Carlos B |

## Criterio de excepción

Una regla solo se exceptúa con estos cinco datos: decisión, justificación, impacto, aprobación y caducidad.
La aprobación la da una persona distinta de quien pide la excepción.

| Regla | Decisión | Justificación | Impacto | Aprobación | Caducidad |
|---|---|---|---|---|---|
| (ninguna) | Sin excepciones registradas a la fecha de esta versión. | — | — | — | — |

## Historial de cambios

| Versión | Fecha UTC | Cambio |
|---|---|---|
| v0.1 | 2026-10-14 | Primera versión con las reglas C1 a C10. |
