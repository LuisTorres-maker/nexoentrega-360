# Listas de aceptación y rúbrica pública

Las cinco partes organizan el trabajo. Los seis criterios siguientes califican evidencias distintas y suman 100 puntos. Todos los RF y RNF son obligatorios. La nota es total / 20.

## Parte 1 SPECS
- [ ] Cinco historias y cinco SPECS cubren todos los RF/RNF.
- [ ] Entradas, proceso, salida, reglas y AC permiten comprobar efectos persistidos.
- [ ] La revisión tiene autor, otra persona revisora, fecha y commit antes del código afectado.
- [ ] JSON generado desde fuente única; comprobación de coincidencia en CI.
- [ ] Cada requisito enlaza AC, tarea, módulo, PR, test y evidencia final.

## Parte 2 IA e implementación
- [ ] Flujo completo por interfaz y API: identidad → borrador → envío → reserva → despacho → entrega → auditoría.
- [ ] Cancelación y estados inválidos respetan stock y permisos.
- [ ] Base relacional real, reserva total, idempotencia y concurrencia correctas.
- [ ] Listados/tablero/roles aíslan organizaciones y propietarios.
- [ ] Seis intervenciones relevantes de IA incluyen contexto, decisión y verificación reales.
- [ ] Asistente valida formato y pertenencia, conserva origen, solicita aprobación y degrada con seguridad.

## Parte 3 VALIDACIÓN
- [ ] Matriz SPEC versus código registra esperado, observado, defectos y correcciones.
- [ ] Pruebas consultan base y usan oráculos independientes definidos antes.
- [ ] Dominio, API, E2E, concurrencia, permisos, IA y regresión de correcciones tienen resultados.
- [ ] CI, carga, teclado y móvil tienen entorno, comandos, datos y SHA verificables.

## Parte 4 RIESGOS Y ENTREGA
- [ ] Riesgos con impacto, probabilidad, responsable, control probado y residual.
- [ ] baseline-v1 conserva el recorrido completo y el estado real de pruebas.
- [ ] Integración de módulos comprobada; correcciones revisadas y regresión.
- [ ] Clon limpio, runbook, rollback compatible y acta de aceptación reproducibles.
- [ ] Entrega en PDF con release-examen, SHA, acceso docente y contribuciones por integrante; mismo PDF para todo el equipo de proyecto integrador.

## Parte 5 ARQUITECTURA
- [ ] Diseño inicial en días 1–2 y actualización con cada cambio relevante.
- [ ] Cuatro ADR comparan alternativas y justifican restricciones y consecuencias.
- [ ] Contexto, componentes, datos, estados y dos secuencias coinciden con la entrega.
- [ ] Contrato HTTP y salida IA explícitos; restricciones de base, transacciones y fronteras verificables.

## Rúbrica analítica
| Criterio | Máximo | Subcriterios |
| --- | ---: | --- |
| Especificaciones y trazabilidad | 20 | Cobertura HU/RF/RNF 4; entradas, reglas, salidas y AC 8; fuente única y exportación 3; trazabilidad y revisión previa 5. |
| Arquitectura, datos y contratos | 15 | Cuatro ADR 5; diagramas y fronteras 4; datos, restricciones y contratos HTTP/IA 6. |
| Implementación funcional y consistencia | 25 | Identidad y aislamiento 5; solicitudes y estados 5; inventario atómico y transiciones 6; idempotencia y concurrencia 5; consultas y auditoría 4. |
| Pruebas, validación y CI | 20 | Matriz y oráculos 4; API y base real 5; concurrencia y regresión 4; E2E, permisos y fallos 4; CI del SHA final 3. |
| Uso crítico de IA y controles | 10 | Seis intervenciones y decisión humana 3; adaptador y salida real declarada 2; validación e inyección 3; aprobación y degradación 2. |
| Entrega reproducible y operación | 10 | Migraciones y seed 2; clon limpio, runbook y rollback 4; carga, UI y logs 2; PDF, aceptación, SHA y contribuciones 2. |

Cada subcriterio usa 0%, 25%, 50%, 75% o 100%: sin evidencia; incipiente; parcial con fallos materiales; casi completo con límites menores; completo y comprobable. El docente justifica valores intermedios con evidencia. Los fallos pierden únicamente los subcriterios afectados; no se aplica una penalización general oculta ni se descuenta dos veces el mismo subcriterio.

## Base y ampliaciones
baseline-v1 debe recorrer hasta entrega y auditoría con al menos un caso feliz y uno de rechazo; puede declarar consultas avanzadas, IA y pruebas de carga pendientes hasta el cierre. Es un hito, no una reducción del alcance final. Microservicios, hosting público, otros modelos y funcionalidades adicionales son opcionales y no otorgan puntos extra. No se exige sustentación, presentación oral ni video.
