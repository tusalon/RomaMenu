"""Prueba la regla de horario de ventana_pedidos() contra produccion.

Solo lee: le pasa horas inventadas y compara lo que responde. Supone el horario
configurado hoy (viernes a domingo de 12:30 a 20:00, pedidos desde la vispera a
las 18:00); si alguien lo cambia en el panel, avisa y no compara.

    python tests/probar-horario.py
"""
import json, sys, urllib.error, urllib.request

K = "sb_publishable_alE5AiBzLESvnHLT3BD1Pw_51zIM7DH"
U = "https://zfozknltebjdxwzwoyjf.supabase.co/rest/v1"
H = {"apikey": K, "Authorization": f"Bearer {K}", "Content-Type": "application/json"}


def get(path):
    return json.load(urllib.request.urlopen(urllib.request.Request(U + path, headers=H)))


def ventana(ahora):
    body = json.dumps({"p_ahora": ahora}).encode()
    req = urllib.request.Request(U + "/rpc/ventana_pedidos", data=body, headers=H, method="POST")
    return json.load(urllib.request.urlopen(req))[0]


horario = {h["dia_semana"]: h for h in get("/horarios_negocio?select=*")}
conf = get("/configuracion_negocio?select=abierto,aceptar_fuera_horario,pedidos_vispera_desde")[0]
esperado = all(
    horario.get(d, {}).get("trabaja") and horario[d]["hora_apertura"] == "12:30:00" and horario[d]["hora_cierre"] == "20:00:00"
    for d in (5, 6, 0)
) and not any(horario.get(d, {}).get("trabaja") for d in (1, 2, 3, 4)) and conf == {
    "abierto": True, "aceptar_fuera_horario": False, "pedidos_vispera_desde": "18:00:00"}
if not esperado:
    print("El horario configurado no es el de referencia; no se compara nada.")
    print(json.dumps({"horario": horario, "config": conf}, ensure_ascii=False, indent=2))
    sys.exit(2)

# Semana de referencia: lunes 28/09 a domingo 04/10/2026. En Cuba es horario de
# verano (UTC-4), asi que -04:00 es la hora local de La Habana.
casos = [
    ("lunes 10:00",                "2026-09-28T10:00:00-04:00", False, "2026-10-02", "2026-10-01T18:00:00"),
    ("jueves 17:59",               "2026-10-01T17:59:00-04:00", False, "2026-10-02", "2026-10-01T18:00:00"),
    ("jueves 18:00",               "2026-10-01T18:00:00-04:00", True,  "2026-10-02", None),
    ("viernes 12:00, antes de abrir", "2026-10-02T12:00:00-04:00", True, "2026-10-02", None),
    ("viernes 13:00",              "2026-10-02T13:00:00-04:00", True,  "2026-10-02", None),
    ("viernes 19:59",              "2026-10-02T19:59:00-04:00", True,  "2026-10-02", None),
    ("viernes 20:00 -> sabado",    "2026-10-02T20:00:00-04:00", True,  "2026-10-03", None),
    ("sabado 23:00 -> domingo",    "2026-10-03T23:00:00-04:00", True,  "2026-10-04", None),
    ("domingo 19:59",              "2026-10-04T19:59:00-04:00", True,  "2026-10-04", None),
    ("domingo 20:00 -> cerrado",   "2026-10-04T20:00:00-04:00", False, "2026-10-09", "2026-10-08T18:00:00"),
    # La hora del reloj de la base es UTC: esto comprueba que se pasa a La Habana.
    ("jueves 18:30 Cuba en UTC",   "2026-10-01T22:30:00Z",      True,  "2026-10-02", None),
    # En diciembre Cuba vuelve a UTC-5. 22:30Z son las 17:30: todavia cerrado.
    # Si la base usara un desfase fijo de -4 lo daria por abierto.
    ("invierno: jueves 17:30",     "2026-12-03T22:30:00Z",      False, "2026-12-04", "2026-12-03T18:00:00"),
]

fallos = 0
for nombre, ahora, acepta, fecha, abre_en in casos:
    r = ventana(ahora)
    bien = r["acepta"] == acepta and r["fecha_entrega"] == fecha and r["abre_en"] == abre_en
    fallos += not bien
    detalle = f"para {r['fecha_entrega']}" if r["acepta"] else f"abre {r['abre_en']} para {r['fecha_entrega']}"
    print(f"{'ok ' if bien else 'MAL'}  {nombre:30} {'ACEPTA' if r['acepta'] else 'cerrado'}  {detalle}")

print(f"\n{'TODO BIEN' if not fallos else f'{fallos} FALLOS'}")
sys.exit(1 if fallos else 0)
