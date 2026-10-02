// Ejecuta de verdad la parte nueva de supabase/migracion-numeracion.sql en un
// Postgres local (PGlite): el relleno, el contador, el cambio de unicidad y la
// numeracion por semana. No toca produccion ni necesita ninguna clave.
//
// PGlite no es una dependencia del proyecto; se instala solo para correr esto:
//
//     npm i --no-save @electric-sql/pglite
//     node tests/probar-numeracion.mjs
//
// Tarda un minuto: el Postgres en WebAssembly arranca despacio. Pasarlo cada vez
// que se toque la numeracion de crear_pedido_publico.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const REPO = new URL("../", import.meta.url);
const leer = (ruta) => readFileSync(new URL(ruta, REPO), "utf8");
const migracion = leer("supabase/migracion-numeracion.sql");
const schema = leer("supabase/schema.sql");

// La parte de la migracion que no necesita todo el esquema (la funcion grande
// va despues). Se cierra con commit, que en el fichero real esta al final.
const previa =
  migracion.slice(migracion.indexOf("begin;"), migracion.indexOf("drop function if exists public.crear_pedido_publico")) +
  "\ncommit;\n";

// Las lineas de numeracion, tal cual estan en el esquema.
const marcaFin = "v_numero := lpad(v_ultimo::text, 4, '0');";
const inicio = schema.indexOf("-- La semana es el lunes del dia de entrega");
const fin = schema.indexOf(marcaFin) + marcaFin.length;
if (inicio < 0 || fin < marcaFin.length) throw new Error("No encuentro la numeracion en schema.sql");
const numeracion = schema.slice(inicio, fin);

const db = new PGlite();
let fallos = 0;
const comprobar = (nombre, ok, detalle = "") => {
  if (!ok) fallos++;
  console.log(`${ok ? "ok " : "MAL"}  ${nombre}${detalle ? "  -> " + detalle : ""}`);
};

await db.exec(`
  create role anon; create role authenticated;
  -- Como estaba en produccion: numero unico para siempre.
  create table public.pedidos (
    id uuid primary key default gen_random_uuid(),
    numero_pedido text not null unique,
    fecha_entrega date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  insert into public.pedidos (numero_pedido, fecha_entrega, created_at) values
    ('0001', '2026-09-11', '2026-09-10 22:00+00'),
    ('0002', '2026-09-12', '2026-09-11 22:00+00'),
    ('0003', '2026-09-20', '2026-09-19 22:00+00'),
    ('0029', '2026-09-25', '2026-09-24 22:30+00'),
    ('0030', '2026-09-26', '2026-09-25 12:00+00'),
    ('0031', null,         '2026-10-02 15:00+00'),
    ('0032', '2026-10-02', '2026-10-01 23:00+00');
`);

await db.exec(previa);
comprobar("la migracion se ejecuta sin errores", true);

const semanas = (
  await db.query(`select semana::text, count(*)::int as n, max(numero_pedido) as ultimo from public.pedidos group by semana order by semana`)
).rows;
comprobar(
  "cada pedido cayo en el lunes de su dia de entrega",
  JSON.stringify(semanas.map((s) => s.semana)) === JSON.stringify(["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"]),
);

const contadores = (await db.query(`select semana::text, ultimo from public.contadores_pedido order by semana`)).rows;
comprobar(
  "cada contador parte del ultimo numero que ya habia en su semana",
  JSON.stringify(contadores.map((c) => c.ultimo)) === JSON.stringify([2, 3, 30, 32]),
);

const unicas = (
  await db.query(`select conname from pg_constraint where conrelid='public.pedidos'::regclass and contype='u'`)
).rows.map((r) => r.conname);
comprobar(
  "la unicidad antigua se fue y queda solo la de semana+numero",
  unicas.length === 1 && unicas[0] === "pedidos_semana_numero_unico",
  unicas.join(","),
);

await db.exec(previa);
comprobar("se puede correr dos veces seguidas", true);

// La numeracion, dentro de una funcion con la misma forma que la real: columnas
// de salida que se llaman igual que las de la tabla, y use_column.
await db.exec(`
  create function public.numerar(p_fecha date)
  returns table (id uuid, numero_pedido text, semana date)
  language plpgsql set search_path = '' as $f$
  #variable_conflict use_column
  declare
    v_pedido_id uuid := gen_random_uuid();
    v_numero text; v_semana date; v_ultimo integer; v_fecha_entrega date := p_fecha;
  begin
    ${numeracion}
    insert into public.pedidos (id, numero_pedido, semana, fecha_entrega) values (v_pedido_id, v_numero, v_semana, v_fecha_entrega);
    return query select v_pedido_id, v_numero, v_semana;
  end $f$;
`);
const numerar = async (fecha) =>
  (await db.query(`select numero_pedido, semana::text from public.numerar($1::date)`, [fecha])).rows[0];

let r = await numerar("2026-10-02");
comprobar("la semana en curso continua donde iba (no reinicia a mitad de fin de semana)", r.numero_pedido === "0033", `${r.numero_pedido} en ${r.semana}`);
r = await numerar("2026-10-03");
comprobar("y sigue contando", r.numero_pedido === "0034");

r = await numerar("2026-10-09");
comprobar("el viernes siguiente arranca en 0001", r.numero_pedido === "0001" && r.semana === "2026-10-05", `${r.numero_pedido} en ${r.semana}`);
r = await numerar("2026-10-11");
comprobar("el domingo de esa misma semana es el 0002", r.numero_pedido === "0002");
r = await numerar("2026-10-16");
comprobar("y la semana despues vuelve a 0001", r.numero_pedido === "0001" && r.semana === "2026-10-12");

let dup = false;
try {
  await db.query(`insert into public.pedidos (numero_pedido, semana) values ('0001', '2026-10-05')`);
} catch {
  dup = true;
}
await db.exec("rollback").catch(() => {});
comprobar("dos #0001 en la misma semana siguen prohibidos", dup);

// Un pedido que falla despues de numerar no deja hueco: el contador se deshace.
const antes = (await db.query(`select ultimo from public.contadores_pedido where semana='2026-10-05'`)).rows[0].ultimo;
try {
  await db.transaction(async (tx) => {
    await tx.query("select * from public.numerar($1::date)", ["2026-10-09"]);
    await tx.query("select 1/0");
  });
} catch {
  // Se esperaba: el pedido falla despues de numerar.
}
const despues = (await db.query(`select ultimo from public.contadores_pedido where semana='2026-10-05'`)).rows[0].ultimo;
comprobar("si el pedido falla, el contador no avanza (sin huecos)", antes === despues, `${antes} -> ${despues}`);

await db.exec(`insert into public.pedidos (numero_pedido, fecha_entrega) values ('9000', '2026-10-23')`);
const s9000 = (await db.query(`select semana::text from public.pedidos where numero_pedido='9000'`)).rows[0].semana;
comprobar("una insercion sin semana la calcula el disparador", s9000 === "2026-10-19", s9000);

console.log(fallos ? `\n${fallos} FALLOS` : "\nTODO BIEN");
await db.close();
process.exitCode = fallos ? 1 : 0;
