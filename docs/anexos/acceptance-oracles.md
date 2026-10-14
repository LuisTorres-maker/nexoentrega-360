# Oráculos de inventario del caso base

Restablezca seed antes de cada escenario.

- Reserva A-001: físico 10, reservado 7, disponible 3 de KIT-ALIMENTO en ORG-A.
- Cancelación de esa reserva: físico 10, reservado 0, disponible 10.
- Despacho de esa reserva: físico 3, reservado 0, disponible 3.
- Dos reservas simultáneas A-001 y A-002: una exitosa, otra 409; físico 10, reservado 7, disponible 3. No se fija qué solicitud gana.
- Reserva con una línea suficiente y otra insuficiente: ninguna línea ni estado cambia.
- Repetición con igual clave y contenido: un efecto; contenido distinto con igual clave: 409.
- Cada operación solo afecta su organización.

Escriba tests independientes de la implementación; compruebe base real.
