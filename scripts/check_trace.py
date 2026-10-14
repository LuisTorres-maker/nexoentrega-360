#!/usr/bin/env python3
"""Verifica la trazabilidad RF/RNF -> SPEC -> AC -> codigo -> prueba -> evidencia.

Lee evidence/traceability.csv y evidence/spec-vs-code.csv (columnas del anexo oficial)
y los spec.json generados por scripts/export_specs.py. Solo usa la biblioteca estandar.

Modos:
  (sin --fase)  Entrega final: todas las columnas llenas (el guion "—" cuenta como vacio),
                una fila por AC en spec-vs-code y todos los AC con prueba.
  --fase R1     Rondas intermedias: CodePath, TestID, PR y Evidence pueden valer "—" mientras
                el Status no sea "Cumple". Una fila "Cumple" siempre exige vinculos reales.
                spec-vs-code.csv es opcional; si existe, se valida lo que tenga.

Salida: codigo 0 si todo cuadra; 1 si hay errores; 2 si faltan archivos de entrada.
"""
import argparse
import csv
import json
import pathlib
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
REQUISITOS = [f"RF{n:02d}" for n in range(1, 13)] + [f"RNF{n:02d}" for n in range(1, 7)]
ESTADOS = ("Cumple", "Parcial", "No cumple")
VACIOS = {"", "—", "-", "–"}

COLS_TRAZA = [
    "Requirement", "SpecPathAndVersion", "AcceptanceCriterion", "ADRorContract", "Task",
    "CodePath", "TestID", "PR", "Evidence", "Status",
]
COLS_COMPARACION = [
    "SpecAndVersion", "Story", "RF", "AC", "ExpectedBehavior", "CodePath", "PR", "Test",
    "ObservedResult", "Status", "DefectOrDifference", "Correction", "EvidenceSHA",
]
# Columnas que en una fila "No cumple" o "Parcial" pueden estar pendientes en fase intermedia.
PENDIENTES_TRAZA = ("Task", "CodePath", "TestID", "PR", "Evidence")
PENDIENTES_COMPARACION = ("CodePath", "PR", "Test", "ObservedResult", "Correction", "EvidenceSHA")


def vacio(valor):
    return (valor or "").strip() in VACIOS


def leer(ruta, columnas):
    """Devuelve (filas, errores). Comprueba que los encabezados sean exactamente los del anexo."""
    with open(ruta, encoding="utf-8-sig", newline="") as f:
        lector = csv.DictReader(f)
        encabezados = [h.strip() for h in (lector.fieldnames or [])]
        errores = []
        if encabezados != columnas:
            errores.append(f"{ruta.name}: encabezados distintos a los del anexo. "
                           f"Esperado {columnas}; encontrado {encabezados}")
        return list(lector), errores


def cargar_specs(raiz):
    acs = {}
    requisitos_por_spec = {}
    for sj in sorted((raiz / "specs").glob("*/spec.json")):
        datos = json.loads(sj.read_text(encoding="utf-8"))
        requisitos_por_spec[datos["id"]] = set(datos.get("requirements", []))
        for ac in datos.get("acceptanceCriteria", []):
            acs[ac["id"]] = datos["id"]
    return acs, requisitos_por_spec


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fase", choices=["R1"], default=None,
                    help="modo de ronda intermedia (vinculos pendientes permitidos si no es Cumple)")
    ap.add_argument("--root", default=str(RAIZ), help="raiz del repositorio (para pruebas del script)")
    args = ap.parse_args(argv)
    raiz = pathlib.Path(args.root)
    intermedia = args.fase is not None

    ruta_traza = raiz / "evidence" / "traceability.csv"
    ruta_comp = raiz / "evidence" / "spec-vs-code.csv"
    if not ruta_traza.exists():
        print(f"Falta {ruta_traza.relative_to(raiz)}")
        return 2
    if not intermedia and not ruta_comp.exists():
        print(f"Falta {ruta_comp.relative_to(raiz)}")
        return 2

    errores = []
    acs, requisitos_por_spec = cargar_specs(raiz)
    if not acs:
        errores.append("No hay spec.json con criterios de aceptacion (ejecute scripts/export_specs.py)")

    # Todo RF/RNF debe aparecer en el arreglo requirements de alguna SPEC
    declarados = set().union(*requisitos_por_spec.values()) if requisitos_por_spec else set()
    errores += [f"{r} no aparece en ninguna SPEC (requirements)" for r in REQUISITOS if r not in declarados]

    trazas, e = leer(ruta_traza, COLS_TRAZA)
    errores += e
    for r in REQUISITOS:
        fila = next((f for f in trazas if (f.get("Requirement") or "").strip() == r), None)
        if fila is None:
            errores.append(f"Requisito sin fila de trazabilidad: {r}")
            continue
        estado = (fila.get("Status") or "").strip()
        if estado not in ESTADOS:
            errores.append(f"{r}: Status invalido ({estado!r}); use {ESTADOS}")
        for col in ("SpecPathAndVersion", "AcceptanceCriterion"):
            if vacio(fila.get(col)):
                errores.append(f"{r}: falta {col}")
        for ac in [a.strip() for a in (fila.get("AcceptanceCriterion") or "").split(";") if a.strip()]:
            if acs and ac not in acs:
                errores.append(f"{r}: el AC {ac} no existe en ningun spec.json")
        exige_vinculos = (not intermedia) or estado == "Cumple"
        if exige_vinculos:
            for col in PENDIENTES_TRAZA:
                if vacio(fila.get(col)):
                    errores.append(f"{r}: falta {col}" + (" (un Cumple exige vinculo real)" if intermedia else ""))
        if estado in ("Parcial", "No cumple") and vacio(fila.get("Evidence")) and not intermedia:
            errores.append(f"{r}: un estado {estado} debe explicar el gap en Evidence")
    conocidos = set(REQUISITOS)
    errores += [f"Fila de trazabilidad con requisito desconocido: {f.get('Requirement')}"
                for f in trazas if (f.get("Requirement") or "").strip() not in conocidos]

    # SPEC versus codigo
    n_comp = 0
    if ruta_comp.exists():
        comp, e = leer(ruta_comp, COLS_COMPARACION)
        errores += e
        n_comp = len(comp)
        cubiertos = set()
        for f in comp:
            ac = (f.get("AC") or "").strip()
            cubiertos.add(ac)
            if ac not in acs and acs:
                errores.append(f"AC inexistente en spec-vs-code: {ac}")
            estado = (f.get("Status") or "").strip()
            if estado not in ESTADOS:
                errores.append(f"{ac}: Status invalido en spec-vs-code ({estado!r})")
            exige = (not intermedia) or estado == "Cumple"
            if exige:
                for col in PENDIENTES_COMPARACION:
                    if vacio(f.get(col)):
                        errores.append(f"{ac}: falta {col} en spec-vs-code")
        if not intermedia:
            errores += [f"AC sin fila en spec-vs-code: {a}" for a in sorted(set(acs) - cubiertos)]

    if errores:
        print("TRAZABILIDAD CON ERRORES:")
        print("\n".join(f"  - {x}" for x in errores))
        return 1
    modo = f"fase {args.fase}" if intermedia else "entrega final"
    print(f"Trazabilidad correcta ({modo}): {len(REQUISITOS)} requisitos, "
          f"{len(acs)} AC, {n_comp} filas spec-vs-code")
    return 0


if __name__ == "__main__":
    sys.exit(main())
