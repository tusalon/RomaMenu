-- Datos de demostración. Ejecutar después de schema.sql.

insert into public.configuracion_negocio (
  id, nombre_negocio, descripcion, portada_url, whatsapp, telefono, direccion,
  texto_bienvenida, moneda, simbolo_moneda, pedido_minimo, tiempo_entrega,
  abierto, aceptar_fuera_horario, mensaje_abierto, mensaje_cerrado,
  color_primario, color_secundario
) values (
  '10000000-0000-4000-8000-000000000001', 'La Cocina de Miguelón',
  'Comida casera cubana preparada al momento y llevada hasta tu puerta.',
  'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1600&q=86',
  '5355555555', '+53 5 555 5555', 'Artemisa, Cuba',
  'Comida casera preparada con sabor, calidad y cariño. Elige tus platos favoritos y recibe tu pedido directamente en casa.',
  'CUP', '$', 800, '45–60 min', true, true,
  'Estamos cocinando. Entrega estimada de 45 a 60 minutos.',
  'Ahora mismo estamos cerrados. Puedes programar tu pedido para mañana.',
  '#8f241f', '#ee7d32'
) on conflict (id) do update set nombre_negocio = excluded.nombre_negocio;

insert into public.categorias (id, nombre, descripcion, orden, activa) values
  ('20000000-0000-4000-8000-000000000001', 'Platos principales', 'Los favoritos de la casa', 1, true),
  ('20000000-0000-4000-8000-000000000002', 'Combos', 'Más sabor para compartir', 2, true),
  ('20000000-0000-4000-8000-000000000003', 'Guarniciones', 'El acompañamiento perfecto', 3, true),
  ('20000000-0000-4000-8000-000000000004', 'Postres', 'Un final dulce', 4, true),
  ('20000000-0000-4000-8000-000000000005', 'Bebidas', 'Bien frías', 5, true)
on conflict (id) do update set nombre = excluded.nombre, descripcion = excluded.descripcion, orden = excluded.orden, activa = excluded.activa;

insert into public.productos (id, categoria_id, nombre, descripcion, imagen_url, precio, precio_anterior, disponible, recomendado, nuevo, activo, orden) values
  ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Pollo asado','Jugoso pollo marinado con especias de la casa y asado lentamente.','https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&w=900&q=82',1500,null,true,true,false,true,1),
  ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003','Arroz congrí','Arroz y frijoles colorados con el punto criollo de Miguelón.','https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=82',450,null,true,false,false,true,2),
  ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','Cerdo asado','Cerdo tierno con mojo cítrico, ajo y cebolla caramelizada.','https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=82',1650,1800,true,true,false,true,3),
  ('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','Ropa vieja','Carne deshebrada en salsa criolla de tomate, pimientos y vino seco.','https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=82',1450,null,true,true,true,true,4),
  ('30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','Arroz frito','Arroz salteado con vegetales, huevo, jamón y sabores orientales.','https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=82',1000,null,true,false,true,true,5),
  ('30000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000003','Ensalada fresca','Vegetales del día con vinagreta ligera preparada en casa.','https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=900&q=82',350,null,true,false,false,true,6),
  ('30000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000003','Vianda con mojo','Selección de viandas hervidas con mojo de ajo y limón.','https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=900&q=82',400,null,false,false,false,true,7),
  ('30000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000002','Combo familiar','Pollo asado, congrí, ensalada y viandas para compartir entre cuatro.','https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=82',4200,4700,true,true,false,true,8),
  ('30000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000004','Flan de la casa','Flan cremoso con caramelo, hecho cada mañana.','https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=900&q=82',300,null,true,false,false,true,9),
  ('30000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000005','Refresco','Lata fría de 355 ml. Consulta los sabores disponibles.','https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=82',250,null,true,false,false,true,10)
on conflict (id) do update set nombre = excluded.nombre, precio = excluded.precio, disponible = excluded.disponible;

insert into public.zonas_entrega (id, nombre, costo, pedido_minimo, tiempo_estimado, activa) values
  ('40000000-0000-4000-8000-000000000001','Centro',200,800,'35–45 min',true),
  ('40000000-0000-4000-8000-000000000002','Zona Norte',300,1000,'45–60 min',true),
  ('40000000-0000-4000-8000-000000000003','Zona Sur',350,1200,'50–70 min',true)
on conflict (id) do update set costo = excluded.costo, pedido_minimo = excluded.pedido_minimo;

insert into public.metodos_pago (id, nombre, descripcion, activo) values
  ('50000000-0000-4000-8000-000000000001','Efectivo','Paga al recibir tu pedido.',true),
  ('50000000-0000-4000-8000-000000000002','Transferencia','Te enviaremos los datos al confirmar.',true),
  ('50000000-0000-4000-8000-000000000003','Pago al recibir','Coordina el pago con el repartidor.',true)
on conflict (id) do update set nombre = excluded.nombre, descripcion = excluded.descripcion, activo = excluded.activo;

insert into public.horarios_negocio (dia_semana, hora_apertura, hora_cierre, trabaja) values
  (0, '11:00', '21:00', true), (1, null, null, false),
  (2, '11:00', '21:00', true), (3, '11:00', '21:00', true),
  (4, '11:00', '21:00', true), (5, '11:00', '22:00', true),
  (6, '11:00', '22:00', true)
on conflict (dia_semana) do update set hora_apertura = excluded.hora_apertura, hora_cierre = excluded.hora_cierre, trabaja = excluded.trabaja;

