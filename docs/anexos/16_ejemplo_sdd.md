# Ejemplo ilustrativo de una cadena SDD

Este ejemplo está construido para enseñar el formato. No demuestra trabajo realizado por un estudiante ni resuelve la SPEC completa de solicitudes.

## Necesidad y alcance
RF03 exige cantidades enteras de 1 a 500. HU-02: como solicitante, quiero enviar una solicitud válida para que el coordinador pueda evaluarla. Fragmento de SPEC-02 v1: rechazar cantidad 0 antes de persistir el envío. Este fragmento no cubre creación, edición, fechas, SKU ni el resto de RF03.

## Criterio observable
AC-RF03-01: dado un solicitante de ORG-A autenticado, un borrador propio con SKU activo y cantidad 0, cuando intenta enviarlo, recibe 422 y un error asociado a cantidad. El borrador conserva su estado previo, no hay solicitud ENVIADA nueva, inventario y auditoría de transiciones no cambian.

## Diseño y tarea
Contrato HTTP propuesto por el equipo: POST /requests/{id}/submit. Documentar en OpenAPI el cuerpo, error y permisos; la ruta es ilustrativa y se puede cambiar. T-02-03: validar cantidad en el servidor antes de la transacción de envío y escribir la prueba de integración. Dependencias: identidad, borrador y contrato aprobados. Terminado: prueba de base real y revisión humana pasan.

## Uso de IA
Prompt ilustrativo: «Revisa AC-RF03-01 contra SPEC-02 v1 y el contrato. Sugiere casos límite y riesgos de persistencia. No cambies reglas ni implementes todavía». La salida solo es una propuesta. El equipo verifica cantidades 0, 1, 500, 501, decimal y falta de campo contra RF03, acepta los casos aplicables y enlaza resultados. No se proporciona una respuesta ficticia para entregar como bitácora real.

## Prueba y oráculo
Antes: borrador BORRADOR, físico 10, reservado 0, disponible 10; número de eventos exitosos de transición E. Ejecutar con cantidad 0. Esperado: 422; mismo estado y cantidades; eventos E. Consultar directamente base de prueba y comprobar también respuesta. Para cantidad 1, usar un escenario limpio con los demás campos válidos; enviar no reserva stock.

## Evidencia que debe producir el estudiante
SPEC-02 v1 aprobada → T-02-03 → módulo real → PR y revisión → test real → reporte y SHA final. Los enlaces, fechas, resultados y decisiones deben proceder de su repositorio. El JSON se exporta desde la fuente aprobada. Marcar Cumple exige comprobar el resultado; una salida de IA o una captura de interfaz no lo demuestra.
