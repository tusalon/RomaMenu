"""Prueba crear_pedido_publico contra produccion sin crear ningun pedido.

Cada caso esta pensado para que la funcion lance un error ANTES de insertar
nada. El unico que llega a descontar stock falla justo despues, y se comprueba
que la transaccion lo deshace. No hace falta ninguna clave privada.

    python tests/probar-pedido.py

Asi se encontro dos veces el mismo fallo (columna 'id' ambigua): pasar esto
despues de tocar la funcion.
"""
import json, sys, urllib.error, urllib.request

K = "sb_publishable_alE5AiBzLESvnHLT3BD1Pw_51zIM7DH"
U = "https://zfozknltebjdxwzwoyjf.supabase.co/rest/v1"
H = {"apikey": K, "Authorization": f"Bearer {K}", "Content-Type": "application/json"}
FAKE = "00000000-0000-0000-0000-000000000000"


def get(path):
    return json.load(urllib.request.urlopen(urllib.request.Request(U + path, headers=H), timeout=30))


def rpc(cliente, items):
    body = json.dumps({"p_cliente": cliente, "p_items": items}).encode()
    req = urllib.request.Request(U + "/rpc/crear_pedido_publico", data=body, headers=H, method="POST")
    try:
        r = urllib.request.urlopen(req, timeout=30)
        return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)


def ventana():
    req = urllib.request.Request(U + "/rpc/ventana_pedidos", data=b"{}", headers=H, method="POST")
    return json.load(urllib.request.urlopen(req, timeout=30))[0]


# El horario se comprueba despues de zona y metodo de pago y antes de los
# productos. Con la tienda cerrada, todo lo que va detras responde "cerrado":
# eso es correcto, y el stock solo se puede probar en horario.
CERRADO = "Ahora mismo no estamos recibiendo pedidos. Mira en la página cuándo abrimos."
abierta = ventana()["acepta"]
tras_horario = lambda msg: msg if abierta else CERRADO

prods = get("/productos?select=id,nombre,stock")
sin_control = next(p for p in prods if p["stock"] is None)
con_stock = next((p for p in prods if (p["stock"] or 0) > 0), None)
agotado = next((p for p in prods if p["stock"] == 0), None)
zona = get("/zonas_entrega?select=id")[0]["id"]
metodo = get("/metodos_pago?select=id")[0]["id"]
ok = {"nombre_cliente": "Prueba", "telefono": "5355002272", "direccion": "Calle de prueba 123",
      "zona_id": zona, "metodo_pago_id": metodo, "referencia": "", "horario_entrega": "", "observaciones": ""}
it = lambda p, n=1: {"producto_id": p["id"], "cantidad": n}
fake = {"producto_id": FAKE, "cantidad": 1}

casos = [
    ("carrito vacio", ok, [], "El carrito está vacío."),
    ("nombre de 1 letra", {**ok, "nombre_cliente": "A"}, [it(sin_control)], "El nombre es obligatorio."),
    ("telefono corto", {**ok, "telefono": "123"}, [it(sin_control)], "El teléfono no es válido."),
    ("direccion corta", {**ok, "direccion": "x"}, [it(sin_control)], "La dirección es obligatoria."),
    ("zona que no es uuid", {**ok, "zona_id": "abc"}, [it(sin_control)], "La zona o el método de pago no son válidos."),
    ("zona inexistente", {**ok, "zona_id": FAKE}, [it(sin_control)], "La zona de entrega no está disponible."),
    ("metodo inexistente", {**ok, "metodo_pago_id": FAKE}, [it(sin_control)], "El método de pago no está disponible."),
    ("cantidad 0", ok, [it(sin_control, 0)], tras_horario("La cantidad solicitada no es válida.")),
    ("cantidad 51", ok, [it(sin_control, 51)], tras_horario("La cantidad solicitada no es válida.")),
    ("producto inexistente", ok, [fake], tras_horario("Uno de los productos ya no está disponible.")),
]
if agotado:
    casos.append(("plato con stock 0", ok, [it(agotado)],
                  tras_horario(f"Solo quedan 0 unidades de {agotado['nombre'].strip()}.")))
if con_stock:
    n = con_stock["stock"]
    casos.append((f"pedir {n + 1} de {n} en stock", ok, [it(con_stock, n + 1)],
                  tras_horario(f"Solo quedan {n} unidades de {con_stock['nombre'].strip()}.")))
    # Descuenta una unidad y despues falla: la base tiene que deshacer el descuento.
    casos.append(("descuenta y falla despues", ok, [it(con_stock), fake],
                  tras_horario("Uno de los productos ya no está disponible.")))

print("Tienda ABIERTA: se prueba todo." if abierta else
      "Tienda CERRADA por horario: stock y rollback no se alcanzan; vuelve a pasarlo en horario.")
fallos = 0
for nombre, cliente, items, esperado in casos:
    code, body = rpc(cliente, items)
    msg = body.get("message", "") if isinstance(body, dict) else str(body)
    bien = code == 400 and msg == esperado
    fallos += not bien
    print(f"{'ok ' if bien else 'MAL'}  {nombre:28} {msg}")

if con_stock:
    despues = next(p["stock"] for p in get("/productos?select=id,stock") if p["id"] == con_stock["id"])
    bien = despues == con_stock["stock"]
    fallos += not bien
    print(f"{'ok ' if bien else 'MAL'}  {'stock intacto tras fallar':28} antes {con_stock['stock']}, despues {despues}")

print(f"\n{'TODO BIEN' if not fallos else f'{fallos} FALLOS'}")
sys.exit(1 if fallos else 0)
