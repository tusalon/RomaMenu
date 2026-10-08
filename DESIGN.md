---
name: La Cocina de Miguelón
description: Comida criolla casera con pedido por WhatsApp; papel crema, tinta ladrillo y letras de menú impreso.
colors:
  brick-red: "#8f241f"
  brick-deep: "#681713"
  orange: "#ee7d32"
  orange-text: "#b84e14"
  cream-paper: "#fbf5ea"
  warm-white: "#fffdf8"
  white: "#ffffff"
  ink: "#27201d"
  clay-muted: "#716762"
  line-sand: "#e8ddcf"
  leaf-green: "#417548"
  soot: "#151210"
  peach-arch: "#f3c9a8"
typography:
  display:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "clamp(48px, 6vw, 76px)"
    fontWeight: 500
    lineHeight: 0.98
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "clamp(38px, 5vw, 54px)"
    fontWeight: 500
    lineHeight: 0.98
    letterSpacing: "-0.045em"
  title:
    fontFamily: "Georgia, serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.2
  price:
    fontFamily: "Georgia, serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  ui:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    lineHeight: 1.2
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 850
    lineHeight: 1.2
    letterSpacing: "0.07em"
  field:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.3
rounded:
  sm: "10px"
  md: "14px"
  lg: "23px"
  pill: "99px"
  arch: "190px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "14px"
  lg: "24px"
  xl: "72px"
components:
  button-primary:
    backgroundColor: "{colors.brick-red}"
    textColor: "{colors.white}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "49px"
  button-primary-hover:
    backgroundColor: "{colors.brick-deep}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "49px"
  add-button:
    backgroundColor: "{colors.brick-red}"
    textColor: "{colors.white}"
    typography: "{typography.ui}"
    rounded: "{rounded.sm}"
    padding: "0 13px"
    height: "44px"
  chip:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "12px"
    padding: "0 16px"
    height: "44px"
  chip-active:
    backgroundColor: "{colors.brick-red}"
    textColor: "{colors.white}"
  product-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.field}"
    rounded: "11px"
    padding: "0 11px"
    height: "43px"
  banner-closed:
    backgroundColor: "{colors.brick-deep}"
    textColor: "{colors.white}"
    padding: "9px 20px"
---

# Design System: La Cocina de Miguelón

## Overview

**Creative North Star: "El Menú de la Casa"**

La tienda se comporta como el menú que te entregan en una casa donde se cocina de verdad: papel crema, tinta ladrillo, títulos con letra de imprenta (Georgia) y la foto del plato primero. No hay nada pulido de más. El cartel de Miguelón —negro, naranja y amarillo— es la pieza que manda y el resto del sistema se pone a su servicio sin competir con él.

Se usa casi siempre desde un móvil, en Cuba, con prisa y a veces con poca luz y poca conexión. Por eso la densidad es amable (letra de 11 px como mínimo, botones de 44 px, campos de 16 px) y no descarga nada que no haga falta: cero fuentes web, fotos pedidas al ancho que toca. La calidez sale del color y de la forma redondeada, no del adorno.

Se rechaza el aspecto de plantilla de pedidos genérica: cuadrículas de iconos idénticos, degradados de moda, cristal translúcido y el naranja pálido como color de texto. Lo que se ve es de esta cocina o no está.

**Key Characteristics:**
- Papel crema con tinta ladrillo; el naranja solo acentúa, nunca escribe texto pequeño.
- Georgia para todo lo que se lee como carta (nombres, precios, titulares); sans de sistema para todo lo que se toca.
- Esquinas generosas (14–24 px) y sombras cálidas teñidas de marrón.
- Todo lo que se pulsa mide al menos 44 px; todo campo, 16 px.
- Tienda cerrada = escaparate: se ve el menú entero, no se puede pedir nada.

## Colors

Una paleta de cocina: ladrillo cocido, brasa, papel y tizne. El color de marca lo puede cambiar el admin desde Configuración (`--brand`, `--accent`); los demás se derivan de él o son neutros cálidos.

### Primary
- **Ladrillo (Brick Red)** (#8f241f): el color de la casa. Precios, acción principal (Pedir, Añadir, Continuar), categoría activa, marca del logo y el paso "en curso" del seguimiento. Sobre crema da 7,93:1.
- **Ladrillo Hondo (Brick Deep)** (#681713): estado de pulsación del botón principal y fondos solemnes. En la tienda **se deriva**: 80% del ladrillo + 20% de #260000, así que sigue al color que elija el admin (#7a1d19 con el de serie). Lo usan el aviso de cerrado y la franja de recomendados.

### Secondary
- **Brasa (Orange)** (#ee7d32): el acento. Rayas decorativas, iconos, borde de campo enfocado y anillo de foco. **Nunca** para texto pequeño: sobre blanco da solo 2,76:1.
- **Brasa de Texto (Orange Text)** (#b84e14): la versión del naranja que sí se lee. Categoría de cada plato, etiqueta "Recomendado", estrella. 5,08:1 sobre blanco y 4,68:1 sobre crema.

### Tertiary
- **Hoja (Leaf Green)** (#417548): lo bueno y lo hecho. Etiqueta "Nuevo", pasos ya cumplidos del seguimiento, indicador de abierto.

### Neutral
- **Papel Crema (Cream Paper)** (#fbf5ea): fondo de página.
- **Blanco Cálido (Warm White)** (#fffdf8): superficies de panel y del carrito.
- **Blanco (White)** (#ffffff): tarjetas de plato y campos, que deben destacar sobre el papel.
- **Tinta (Ink)** (#27201d): texto principal.
- **Barro (Clay Muted)** (#716762): texto secundario; 5,07:1 sobre crema, 5,50:1 sobre blanco.
- **Arena (Line Sand)** (#e8ddcf): bordes y separadores.
- **Tizne (Soot)** (#151210): pie de página. El texto gris sobre él es #8a817c (4,90:1).
- **Melocotón (Peach Arch)** (#f3c9a8): el fondo en arco detrás del cartel de portada.

### Named Rules
**The Readable Orange Rule.** El naranja #ee7d32 decora; el que escribe es #b84e14. Cualquier texto menor de 18 px sobre claro usa el segundo.
**The Derived Deep Rule.** Los fondos oscuros de la tienda salen del ladrillo de marca por mezcla, no de un hex fijo; si el admin cambia el color, todo cambia con él.
**The Muted Is Not Faded Rule.** Lo secundario se atenúa con Barro (#716762), nunca con opacidad: la opacidad se lleva consigo el contraste del texto y de las etiquetas que lleve dentro.

## Typography

**Display Font:** Georgia (con Times New Roman, serif)
**Body Font:** pila de sistema — `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`. Inter solo se nombra: **no se descarga**; cada dispositivo usa su fuente de sistema.

**Character:** una serif de imprenta para lo que se lee como carta y una sans neutra para lo que se pulsa. El contraste entre las dos es todo el sistema tipográfico; no hay un tercer tipo ni pesos decorativos.

### Hierarchy
- **Display** (500, clamp(48px, 6vw, 76px), 0.98, tracking −0.045em): el titular de portada ("Hoy cocinamos. Tú solo disfrutas.").
- **Headline** (500, clamp(38px, 5vw, 54px), 0.98): títulos de sección ("Elige algo delicioso").
- **Title** (600, 21px, 1.2): nombre del plato.
- **Price** (700, 22px): precio, en ladrillo y en Georgia.
- **Body** (400, 14px, 1.6): descripciones; en la portada 17px con interlineado 1.75 y un máximo de ~590px de línea.
- **UI** (800, 13px): botones, etiquetas de campo, celdas de tabla.
- **Label** (850, 11px, tracking 0.07em, mayúsculas): categoría, etiquetas de estado, encabezados de tabla. Es el mínimo absoluto.
- **Field** (400, 16px): todo campo de texto, lista y selector.

La escala vive en cuatro variables (`--fs-label` 11, `--fs-meta` 12, `--fs-ui` 13, `--fs-field` 16). Todo lo demás son titulares.

### Named Rules
**The Sixteen Rule.** Un campo mide 16 px o Safari de iPhone amplía la página al tocarlo, justo en el formulario donde el cliente escribe su dirección.
**The Eleven Floor Rule.** Nada se escribe por debajo de 11 px, y solo las etiquetas en mayúsculas llegan a ese tamaño; el texto normal empieza en 12.
**The No Download Rule.** No se añaden fuentes web. Con conexiones lentas, una fuente es el primer lujo que se cae.

## Layout

Un contenedor central de `min(1180px, 100% − 40px)`. La portada es de dos columnas (texto y cartel, 1,02 / 0,98) con un hueco de `clamp(38px, 6vw, 88px)`, y pasa a una columna bajo 760 px. Los puntos de corte, hechos a la medida del contenido, son 1000, 760 y 500 px (de escritorio hacia móvil).

El ritmo de espaciado va en saltos de 6, 8, 12, 14 y 18 px dentro de los componentes; la portada respira con 72 px arriba y 86 abajo, el menú con 105 y 120, y la sección oscura de "Cómo pedir" con 92 y 104. En móvil, el panel de carrito ocupa todo el ancho y se desliza desde la derecha.

La prioridad es el iPhone: una sola columna, los controles principales al alcance del pulgar (botón flotante "Ver carrito" abajo) y ningún desbordamiento horizontal a 375 px. Con los pedidos cerrados desaparecen el carrito, "Pedir ahora", los "Añadir" y "Cómo pedir"; el menú sigue completo.

## Elevation & Depth

Sistema híbrido: las superficies descansan casi planas con un borde de Arena y una sombra muy suave, y se elevan solo como respuesta (pasar el ratón, abrir un panel). Todas las sombras tienen desplazamiento y desenfoque, y están teñidas de marrón cálido; ninguna es negra ni gris.

### Shadow Vocabulary
- **Reposo de tarjeta** (`box-shadow: 0 10px 35px rgba(77, 46, 29, .055)`): tarjeta de plato en reposo.
- **Elevada** (`box-shadow: 0 22px 45px rgba(77, 46, 29, .11)`): la misma tarjeta al pasar el ratón, junto con `translateY(−5px)`.
- **Ambiente** (`box-shadow: 0 20px 60px rgba(73, 42, 29, .1)`, token `--shadow`): cartel, tarjetas de confirmación y de seguimiento.
- **Brillo de acción** (`0 12px 28px color-mix(in srgb, var(--brand) 22%, transparent)`): el botón principal, teñido de su propio color.
- **Panel** (`-20px 0 60px rgba(30, 19, 15, .17)`): el carrito deslizante.
- **Aro de foco** (`0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent)`): campos enfocados.

### Named Rules
**The Warm Shadow Rule.** Una sombra siempre lleva desplazamiento, desenfoque y un tinte marrón o del color del propio elemento. Nunca un halo sin desplazamiento ni un bloque duro.
**The Rise On Response Rule.** Una tarjeta solo sube cuando se le responde (hover). En reposo no flota.

## Shapes

Lenguaje de formas blandas, hechas para el pulgar. Tarjetas de plato y de confirmación entre 23 y 24 px; botones de acción a 14 px; botones pequeños y botón "Añadir" a 10–11 px; chips de categoría a 12 px; etiquetas y píldoras de estado a 99 px; y las fotos de producto se recortan por la tarjeta (`overflow: hidden`).

La marca del logo es un cuadrado de 44 px con la **esquina inferior izquierda cortada** (14 · 14 · 14 · 5 px): una de las pocas asimetrías del sistema y su firma pequeña.

La pieza distintiva grande es el **arco**: el cartel de portada se enmarca con las esquinas superiores casi circulares (190 px) y las inferiores casi rectas (28 px), sobre un fondo melocotón girado −3°. Está pensado así porque el cartel lleva el número de WhatsApp en una franja que llega hasta el borde inferior.

### Named Rules
**The Arch Rule.** El cartel va en arco, nunca en círculo ni en una mancha orgánica: cualquier máscara redonda de verdad se come la franja del teléfono.
**The Whole Thumb Rule.** Todo lo que se pulsa mide 44 × 44 px como mínimo (con puntero táctil, también en el panel).

## Components

### Buttons
- **Shape:** esquinas suaves (14 px), 49 px de alto, texto en 14 px / 800.
- **Primary:** ladrillo (#8f241f) con texto blanco y brillo del mismo color (`0 12px 28px`). Es la acción por pantalla: "Ver el menú", "Continuar con el pedido", "Confirmar y abrir WhatsApp".
- **Hover / Focus:** al pasar el ratón sube 2 px y el principal pasa a Ladrillo Hondo; en foco con teclado lleva un anillo de 3 px en Brasa de Texto con 2 px de separación.
- **Secondary:** blanco con borde de Arena y texto Tinta. "Pedir ahora", "Volver al catálogo".
- **Danger:** #a8322c con texto blanco, solo para eliminar.
- **Añadir:** botón compacto de 44 px de alto con 10 px de radio, ladrillo. Desactivado pasa a #7a726c con texto blanco (4,72:1), no a un gris que no se lea.

### Chips
- **Style:** píldora de 12 px de radio, 44 px de alto, fondo blanco translúcido, borde de Arena y texto #554c47.
- **State:** el chip activo se rellena de ladrillo, texto blanco y una sombra suave del mismo color. Es el filtro de categoría.

### Cards / Containers
- **Corner Style:** 23 px.
- **Background:** blanco sobre el papel crema.
- **Shadow Strategy:** Reposo de tarjeta; sube con Elevada en hover (ver Elevation & Depth).
- **Border:** 1 px de Arena.
- **Internal Padding:** la foto a sangre arriba (proporción 1,55 / 1, con su hueco reservado para no dar saltos) y el cuerpo con 20 px.
- **Agotado:** la foto pasa a **blanco y negro** (`grayscale(1)`), el título y el precio a Barro y aparece la etiqueta "Agotado por hoy". Sin opacidad.

### Inputs / Fields
- **Style:** blanco, borde de Arena, 11 px de radio, 43 px de alto, texto de 16 px.
- **Focus:** el borde pasa a Brasa y aparece un aro de 3 px al 22% de Brasa.
- **Error / Disabled:** el error va en un recuadro con `role="alert"`, en tinta ladrillo sobre fondo rosado; las etiquetas de campo siempre son visibles (no se usa el marcador como etiqueta).

### Navigation
- **Cabecera:** logo (marca ladrillo con gorro de cocinero), indicador "Abierto / Cerrado", botón de carrito y menú de hamburguesa de 44 px. El indicador de cerrado usa fondo rosado pálido con ladrillo.
- **Móvil:** el carrito pasa a un botón flotante de 48 px abajo; el menú de hamburguesa abre las secciones.
- **Panel de administración:** barra lateral oscura (#211d1a) con la sección activa marcada por una raya de 3 px en Brasa.

### Aviso de añadido (Toast)
Verde bosque (#263827) con texto blanco, abajo al centro. Dice cuántos platos de ese llevas ("Añadiste 2 platos de Ropa vieja") y se reinicia en cada pulsación.

### Seguimiento del pedido
Una línea vertical de cinco pasos (Recibido, Confirmado, En la cocina, En camino, Entregado) con un punto por paso: verde y relleno los cumplidos, ladrillo con halo el actual, vacío los pendientes.

## Do's and Don'ts

### Do:
- **Do** usar Georgia para nombres de plato, precios y titulares, y la sans de sistema para todo lo que se pulsa.
- **Do** usar #b84e14 para cualquier texto naranja menor de 18 px sobre fondo claro.
- **Do** dar 44 × 44 px a todo control táctil y 16 px a todo campo de texto.
- **Do** atenuar con Barro (#716762) y apagar lo agotado con gris en la foto, no con opacidad.
- **Do** teñir las sombras de marrón cálido y darles siempre desplazamiento y desenfoque.
- **Do** pedir cada foto al ancho al que se va a pintar (`srcset`), no al original de 1400 px.
- **Do** dejar visible el menú completo cuando la tienda está cerrada y esconder todo lo que sirva para pedir.

### Don't:
- **Don't** escribir texto por debajo de 11 px, ni de 12 px si no es una etiqueta en mayúsculas.
- **Don't** usar #ee7d32 como color de texto pequeño: da 2,76:1.
- **Don't** añadir fuentes web: la pila de sistema es una decisión de rendimiento, no un descuido.
- **Don't** enmarcar el cartel en un círculo o una mancha: tapa el teléfono de WhatsApp.
- **Don't** aplicar `opacity` a una tarjeta agotada: lava la etiqueta "Agotado" y el contraste del texto.
- **Don't** llamar "lo más pedido" a lo que solo está marcado como recomendado.
- **Don't** hardcodear el rojo oscuro: se deriva del color de marca con `color-mix`.
- **Don't** usar degradados sobre texto, cristal translúcido de adorno ni cuadrículas de tarjetas idénticas con icono y rótulo.
