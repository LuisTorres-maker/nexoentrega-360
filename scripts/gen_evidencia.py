#!/usr/bin/env python3
"""Genera evidence/spec-vs-code.csv y actualiza el estado de evidence/traceability.csv.

Entrada: el reporte JSON de Vitest (npx vitest run --reporter=json --outputFile=<ruta>) y los
spec.json. Un AC se vincula con las pruebas cuyo titulo contiene su identificador. El estado sale
del resultado REAL de esas pruebas:

  sin --sha   Prueba que paso -> "Parcial" (paso sobre el arbol de trabajo, falta el SHA).
  con --sha   Prueba que paso -> "Cumple" y EvidenceSHA = SHA, salvo que el titulo diga "(base)"
              o "(parcial)": entonces sigue "Parcial" porque solo cubre una parte del AC.
  AC sin prueba o con una prueba fallida -> "No cumple".

Uso:
  python3 scripts/gen_evidencia.py --reporte vitest.json [--sha <git rev-parse HEAD>] [--base <sha>]
"""
import argparse
import csv
import json
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
COL_COMP = ["SpecAndVersion", "Story", "RF", "AC", "ExpectedBehavior", "CodePath", "PR", "Test",
            "ObservedResult", "Status", "DefectOrDifference", "Correction", "EvidenceSHA"]
CODIGO = {
    "RF01": "apps/api/src/security/auth.ts", "RF02": "apps/api/src/services/requests.ts",
    "RF03": "apps/api/src/domain/request-schema.ts", "RF04": "apps/api/src/services/transitions.ts",
    "RF05": "apps/api/src/services/transitions.ts", "RF06": "apps/api/src/services/transitions.ts",
    "RF07": "apps/api/src/services/transitions.ts", "RF08": "apps/api/src/services/requests.ts",
    "RF09": "apps/api/src/services/transitions.ts; migrations/001_init.sql",
    "RF10": "apps/api/src/services/ai.ts", "RF11": "apps/api/src/ai/ai.ts",
    "RF12": "apps/api/src/services/ai.ts; apps/api/src/ai/ai.ts",
    "RNF01": "apps/api/src/security/auth.ts; migrations/002_security.sql",
    "RNF02": "apps/api/src/services/transitions.ts; migrations/001_init.sql",
    "RNF03": "seeds/002_load.sql", "RNF04": "migrations/; seeds/001_base.sql",
    "RNF05": "apps/web/", "RNF06": "apps/api/src/app.ts",
}
PR_PLAN = {"RF01": "PR-8", "RF02": "PR-8", "RF03": "PR-7", "RF04": "PR-7", "RF05": "PR-7", "RF06": "PR-7",
           "RF07": "PR-7", "RF08": "PR-8", "RF09": "PR-7", "RF10": "PR-9", "RF11": "PR-9", "RF12": "PR-9",
           "RNF01": "PR-8", "RNF02": "PR-7", "RNF03": "PR-11", "RNF04": "PR-5", "RNF05": "PR-10", "RNF06": "PR-8"}
ID_AC = re.compile(r"AC-(?:RF|RNF)\d{2}-\d{2}")


def cargar_pruebas(ruta):
    datos = json.loads(pathlib.Path(ruta).read_text(encoding="utf-8"))
    por_ac = {}
    for archivo in datos["testResults"]:
        nombre = pathlib.Path(archivo["name"]).as_posix()
        rel = nombre.split("/tests/", 1)
        rel = "tests/" + rel[1] if len(rel) == 2 else nombre
        for t in archivo["assertionResults"]:
            for ac in set(ID_AC.findall(t["title"])):
                por_ac.setdefault(ac, []).append((rel, t["title"], t["status"]))
    return por_ac


def cargar_e2e(ruta, por_ac):
    """Agrega las pruebas de Playwright (reporte JSON) al mismo mapa AC -> pruebas."""
    datos = json.loads(pathlib.Path(ruta).read_text(encoding="utf-8"))

    def recorrer(suite, archivo):
        archivo = suite.get("file") or archivo
        for spec in suite.get("specs", []):
            estados = [r.get("status") for t in spec.get("tests", []) for r in t.get("results", [])]
            estado = "passed" if estados and all(x == "passed" for x in estados) else "failed"
            rel = "tests/e2e/" + pathlib.PurePosixPath(archivo.replace("\\", "/")).name
            for ac in set(ID_AC.findall(spec["title"])):
                por_ac.setdefault(ac, []).append((rel, spec["title"], estado))
        for hija in suite.get("suites", []):
            recorrer(hija, archivo)

    for s in datos.get("suites", []):
        recorrer(s, s.get("file", ""))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--reporte", required=True)
    ap.add_argument("--reporte-e2e", default=None)
    ap.add_argument("--sha", default=None)
    ap.add_argument("--base", default="sin-commit")
    ap.add_argument("--fecha", default="")
    a = ap.parse_args()
    pruebas = cargar_pruebas(a.reporte)
    # Evidencia por ejecucion documentada (no es una prueba de Vitest ni de Playwright).
    carga = RAIZ / "evidence" / "tests" / "carga.md"
    if carga.exists():
        texto = carga.read_text(encoding="utf-8")
        estado = "passed" if "Veredicto: CUMPLE" in texto else "failed" if "Veredicto: NO CUMPLE" in texto else None
        if estado:
            pruebas.setdefault("AC-RNF03-01", []).append(
                ("evidence/tests/carga.md", "AC-RNF03-01 prueba de carga k6 (reporte con hardware y version)", estado))
    clon = RAIZ / "evidence" / "tests" / "clon-limpio.md"
    if clon.exists():
        texto = clon.read_text(encoding="utf-8")
        if "Veredicto: CUMPLE" in texto:
            pruebas.setdefault("AC-RNF04-01", []).append(
                ("evidence/tests/clon-limpio.md", "AC-RNF04-01 clon limpio cronometrado", "passed"))
    if a.reporte_e2e:
        cargar_e2e(a.reporte_e2e, pruebas)
    filas = []
    por_req = {}
    for sj in sorted((RAIZ / "specs").glob("*/spec.json")):
        spec = json.loads(sj.read_text(encoding="utf-8"))
        for ac in spec["acceptanceCriteria"]:
            req = re.match(r"AC-((?:RF|RNF)\d{2})-", ac["id"]).group(1)
            ts = pruebas.get(ac["id"], [])
            pasaron = [t for t in ts if t[2] == "passed"]
            falla = [t for t in ts if t[2] == "failed"]
            parcial_titulo = any("(base)" in t[1] or "(parcial)" in t[1] for t in pasaron)
            if falla:
                estado, obs, dif = "No cumple", "Una prueba fallo: " + "; ".join(t[1] for t in falla), "prueba fallida"
            elif not pasaron:
                estado, obs, dif = "No cumple", "NO EJECUTADO", "sin prueba automatica todavia"
            elif a.sha and not parcial_titulo:
                estado, obs, dif = "Cumple", f"{len(pasaron)} prueba(s) pasaron sobre {a.sha[:7]}", "ninguno"
            elif a.sha:
                estado, obs, dif = "Parcial", f"{len(pasaron)} prueba(s) pasaron; cubren solo una parte del AC", "parte del AC sin prueba (API, interfaz o carga)"
            else:
                estado = "Parcial"
                obs = f"{len(pasaron)} prueba(s) pasaron en el arbol de trabajo (base {a.base}); falta ejecutar sobre el SHA unido"
                dif = "falta SHA evaluado" + ("; cubre solo parte del AC" if parcial_titulo else "")
            filas.append({
                "SpecAndVersion": f"{spec['id']} v{spec['version']}", "Story": spec["story"]["id"], "RF": req,
                "AC": ac["id"], "ExpectedBehavior": ac["then"], "CodePath": CODIGO[req],
                "PR": PR_PLAN[req] + " (planificado)",
                "Test": " || ".join(f"{t[0]}::{t[1]}" for t in ts) if ts else "—",
                "ObservedResult": obs, "Status": estado, "DefectOrDifference": dif,
                "Correction": "—", "EvidenceSHA": a.sha if a.sha else "—",
            })
            por_req.setdefault(req, []).append((ac["id"], estado, [t[0] for t in ts]))
    with open(RAIZ / "evidence" / "spec-vs-code.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COL_COMP, lineterminator="\n")
        w.writeheader()
        w.writerows(filas)

    # trazabilidad: estado por requisito a partir de sus AC
    ruta = RAIZ / "evidence" / "traceability.csv"
    trazas = list(csv.DictReader(open(ruta, encoding="utf-8-sig", newline="")))
    cols = list(trazas[0].keys())
    for r in trazas:
        k = r["Requirement"]
        acs = por_req.get(k, [])
        cumple = [x for x in acs if x[1] == "Cumple"]
        parcial = [x for x in acs if x[1] == "Parcial"]
        total = len(acs)
        archivos = sorted({p for x in acs for p in x[2]})
        r["CodePath"] = CODIGO[k]
        r["TestID"] = "; ".join(archivos) if archivos else "—"
        r["PR"] = PR_PLAN[k] + " (planificado)"
        if total and len(cumple) == total:
            r["Status"] = "Cumple"
            r["Evidence"] = f"{total} de {total} AC con prueba aprobada sobre {a.sha[:7] if a.sha else 'SHA'}; evidence/spec-vs-code.csv"
        elif cumple or parcial:
            r["Status"] = "Parcial"
            faltan = [x[0] for x in acs if x[1] == "No cumple"]
            r["Evidence"] = (f"{len(cumple)} Cumple, {len(parcial)} Parcial y {len(faltan)} sin prueba de {total} AC. "
                             + ("Sin prueba: " + ", ".join(faltan) + ". " if faltan else "")
                             + ("Pruebas pasaron en el arbol de trabajo; falta SHA evaluado. " if not a.sha else "")
                             + "Detalle en evidence/spec-vs-code.csv")
        else:
            r["Status"] = "No cumple"
            r["Evidence"] = f"Gap: {total} AC sin prueba automatica (ver evidence/spec-vs-code.csv)"
    with open(ruta, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, lineterminator="\n")
        w.writeheader()
        w.writerows(trazas)
    resumen = {}
    for fila in filas:
        resumen[fila["Status"]] = resumen.get(fila["Status"], 0) + 1
    print("AC:", len(filas), resumen)
    return 0


if __name__ == "__main__":
    sys.exit(main())
