# Ensayo de clon limpio (RNF04)

Estado: **NO EJECUTADO.** El ensayo definitivo lo debe hacer una persona en **otro computador** con `bash scripts/clon-limpio.sh`
y pegar aquí su salida literal. La IA no inventa tiempos (R-07).

| Dato | Valor |
|---|---|
| Fecha UTC | PENDIENTE (persona) |
| Persona y equipo | PENDIENTE |
| SHA clonado | PENDIENTE |
| Descarga inicial (paquetes e imágenes) | PENDIENTE |
| Arranque (sin la descarga inicial) | PENDIENTE |
| Total sin la descarga inicial | PENDIENTE (RNF04: ≤ 15 min) |
| `/ready` y login (esperado 200) | PENDIENTE |

Veredicto: PENDIENTE.

## Referencia parcial ya medida (no sustituye el ensayo)

El 2026-10-14, `npm run up` sobre el árbol de trabajo (con imágenes ya descargadas) dejó `db`, `api` y `web` en estado `Healthy`.
Tiempos observados: 30 s y 51 s en dos corridas con `db` y `api`, y menos de 45 s con la construcción de la web incluida.
No es un clon limpio: el árbol tenía caché de Docker y de npm.
