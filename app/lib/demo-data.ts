import type {
  BusinessSettings,
  Category,
  DeliveryZone,
  Order,
  PaymentMethod,
  Product,
  PublicCatalog,
} from "./types";

export const demoSettings: BusinessSettings = {
  id: "demo-business",
  nombre_negocio: "La Cocina de Miguelón",
  descripcion: "Comida casera cubana preparada al momento y llevada hasta tu puerta.",
  portada_url:
    "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1600&q=86",
  whatsapp: "5355555555",
  telefono: "+53 5 555 5555",
  direccion: "Artemisa, Cuba",
  moneda: "CUP",
  simbolo_moneda: "$",
  pedido_minimo: 800,
  tiempo_entrega: "45–60 min",
  abierto: true,
  aceptar_fuera_horario: true,
  mensaje_abierto: "Estamos cocinando. Entrega estimada de 45 a 60 minutos.",
  mensaje_cerrado: "Ahora mismo estamos cerrados. Puedes programar tu pedido para mañana.",
  color_primario: "#8f241f",
  color_secundario: "#ee7d32",
  texto_bienvenida:
    "Comida casera preparada con sabor, calidad y cariño. Elige tus platos favoritos y recibe tu pedido directamente en casa.",
};

export const demoCategories: Category[] = [
  { id: "principales", nombre: "Platos principales", descripcion: "Los favoritos de la casa", orden: 1, activa: true },
  { id: "combos", nombre: "Combos", descripcion: "Más sabor para compartir", orden: 2, activa: true },
  { id: "guarniciones", nombre: "Guarniciones", descripcion: "El acompañamiento perfecto", orden: 3, activa: true },
  { id: "postres", nombre: "Postres", descripcion: "Un final dulce", orden: 4, activa: true },
  { id: "bebidas", nombre: "Bebidas", descripcion: "Bien frías", orden: 5, activa: true },
];

const images = {
  chicken: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&w=900&q=82",
  rice: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=82",
  pork: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=82",
  beef: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=82",
  salad: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=900&q=82",
  roots: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=900&q=82",
  family: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=82",
  flan: "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=900&q=82",
  drink: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=82",
};

export const demoProducts: Product[] = [
  { id: "pollo-asado", categoria_id: "principales", nombre: "Pollo asado", descripcion: "Jugoso pollo marinado con especias de la casa y asado lentamente.", imagen_url: images.chicken, precio: 1500, precio_anterior: null, disponible: true, recomendado: true, nuevo: false, activo: true, orden: 1 },
  { id: "arroz-congri", categoria_id: "guarniciones", nombre: "Arroz congrí", descripcion: "Arroz y frijoles colorados con el punto criollo de Miguelón.", imagen_url: images.rice, precio: 450, precio_anterior: null, disponible: true, recomendado: false, nuevo: false, activo: true, orden: 2 },
  { id: "cerdo-asado", categoria_id: "principales", nombre: "Cerdo asado", descripcion: "Cerdo tierno con mojo cítrico, ajo y cebolla caramelizada.", imagen_url: images.pork, precio: 1650, precio_anterior: 1800, disponible: true, recomendado: true, nuevo: false, activo: true, orden: 3 },
  { id: "ropa-vieja", categoria_id: "principales", nombre: "Ropa vieja", descripcion: "Carne deshebrada en salsa criolla de tomate, pimientos y vino seco.", imagen_url: images.beef, precio: 1450, precio_anterior: null, disponible: true, recomendado: true, nuevo: true, activo: true, orden: 4 },
  { id: "arroz-frito", categoria_id: "principales", nombre: "Arroz frito", descripcion: "Arroz salteado con vegetales, huevo, jamón y sabores orientales.", imagen_url: images.rice, precio: 1000, precio_anterior: null, disponible: true, recomendado: false, nuevo: true, activo: true, orden: 5 },
  { id: "ensalada", categoria_id: "guarniciones", nombre: "Ensalada fresca", descripcion: "Vegetales del día con vinagreta ligera preparada en casa.", imagen_url: images.salad, precio: 350, precio_anterior: null, disponible: true, recomendado: false, nuevo: false, activo: true, orden: 6 },
  { id: "vianda", categoria_id: "guarniciones", nombre: "Vianda con mojo", descripcion: "Selección de viandas hervidas con mojo de ajo y limón.", imagen_url: images.roots, precio: 400, precio_anterior: null, disponible: false, recomendado: false, nuevo: false, activo: true, orden: 7 },
  { id: "combo-familiar", categoria_id: "combos", nombre: "Combo familiar", descripcion: "Pollo asado, congrí, ensalada y viandas para compartir entre cuatro.", imagen_url: images.family, precio: 4200, precio_anterior: 4700, disponible: true, recomendado: true, nuevo: false, activo: true, orden: 8 },
  { id: "flan", categoria_id: "postres", nombre: "Flan de la casa", descripcion: "Flan cremoso con caramelo, hecho cada mañana.", imagen_url: images.flan, precio: 300, precio_anterior: null, disponible: true, recomendado: false, nuevo: false, activo: true, orden: 9 },
  { id: "refresco", categoria_id: "bebidas", nombre: "Refresco", descripcion: "Lata fría de 355 ml. Consulta los sabores disponibles.", imagen_url: images.drink, precio: 250, precio_anterior: null, disponible: true, recomendado: false, nuevo: false, activo: true, orden: 10 },
];

export const demoZones: DeliveryZone[] = [
  { id: "centro", nombre: "Centro", costo: 200, pedido_minimo: 800, tiempo_estimado: "35–45 min", activa: true },
  { id: "norte", nombre: "Zona Norte", costo: 300, pedido_minimo: 1000, tiempo_estimado: "45–60 min", activa: true },
  { id: "sur", nombre: "Zona Sur", costo: 350, pedido_minimo: 1200, tiempo_estimado: "50–70 min", activa: true },
];

export const demoPaymentMethods: PaymentMethod[] = [
  { id: "efectivo", nombre: "Efectivo", descripcion: "Paga al recibir tu pedido.", activo: true },
  { id: "transferencia", nombre: "Transferencia", descripcion: "Te enviaremos los datos al confirmar.", activo: true },
  { id: "pago-recibir", nombre: "Pago al recibir", descripcion: "Coordina el pago con el repartidor.", activo: true },
];

export const demoCatalog: PublicCatalog = {
  settings: demoSettings,
  categories: demoCategories,
  products: demoProducts,
  zones: demoZones,
  paymentMethods: demoPaymentMethods,
};

export const initialDemoOrders: Order[] = [
  {
    id: "demo-order-1",
    numero_pedido: "0001",
    nombre_cliente: "Laura Martínez",
    telefono: "55123456",
    direccion: "Calle 10, número 25",
    zona_id: "centro",
    referencia: "Frente al parque",
    metodo_pago_id: "efectivo",
    horario_entrega: "19:00",
    observaciones: "Sin cebolla, por favor.",
    items: [
      { producto_id: "pollo-asado", nombre_producto: "Pollo asado", cantidad: 1, precio_unitario: 1500, subtotal: 1500 },
      { producto_id: "arroz-congri", nombre_producto: "Arroz congrí", cantidad: 2, precio_unitario: 450, subtotal: 900 },
    ],
    subtotal: 2400,
    costo_entrega: 200,
    total: 2600,
    estado: "nuevo",
    origen: "web",
    notas_internas: "",
    created_at: new Date().toISOString(),
  },
];

