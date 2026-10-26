"use client";

import { ShoppingBag } from "lucide-react";
import { useEffect, useRef } from "react";
import { formatCurrency, stockState } from "@/app/lib/format";
import { photoSrcSet, photoUrl } from "@/app/lib/images";
import type { Category, Product } from "@/app/lib/types";

type ProductCardProps = {
  product: Product;
  category?: Category;
  symbol: string;
  /** Unidades de este plato que ya hay en el carrito. */
  inCart?: number;
  /** Sin onAdd la tarjeta solo enseña el plato: fuera de horario no se pide nada. */
  onAdd?: (product: Product) => void;
  /** Posicion en la lista: escalona la aparicion de las tarjetas de una misma fila. */
  index?: number;
};

export function ProductCard({ product, category, symbol, inCart = 0, onAdd, index = 0 }: ProductCardProps) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Lo que ya esta a la vista no se esconde: apareceria de la nada y parpadearia.
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    el.dataset.reveal = "pending";
    el.style.setProperty("--reveal-delay", `${(index % 3) * 0.08}s`);
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      el.dataset.reveal = "in";
      io.disconnect();
      // Pasada la entrada se suelta el atributo: asi el retraso no frena el hover de despues.
      window.setTimeout(() => { delete el.dataset.reveal; el.style.removeProperty("--reveal-delay"); }, 1500);
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [index]);
  const badge = product.precio_anterior ? "Oferta" : product.nuevo ? "Nuevo" : product.recomendado ? "Recomendado" : null;
  const stock = stockState(product);
  // Cerrado no se pide nada (sin onAdd), y entonces tampoco se marca "agotado": el stock de
  // hoy no dice nada de la proxima apertura, y un menu en gris no abre el apetito.
  const agotado = stock.agotado && !!onAdd;
  // Con stock controlado no se deja pedir mas de lo que hay: rebotarlo en el
  // checkout, despues de rellenar todo el formulario, es peor experiencia.
  const sinMas = stock.restantes != null && inCart >= stock.restantes;

  return (
    <article ref={ref} className={agotado ? "product-card sold-out" : "product-card"}>
      <div className="product-image">
        <img
          src={photoUrl(product.imagen_url, 640)}
          srcSet={photoSrcSet(product.imagen_url, [400, 640, 800, 960])}
          sizes="(max-width: 700px) 92vw, (max-width: 1000px) 46vw, 360px"
          alt={product.nombre}
          loading="lazy"
        />
        {badge && <span className={`product-badge ${badge.toLowerCase()}`}>{badge}</span>}
        {agotado && <span className="sold-out-label">Agotado por hoy</span>}
      </div>
      <div className="product-body">
        <small className="product-category">{category?.nombre}</small>
        <h3>{product.nombre}</h3>
        <p>{product.descripcion}</p>
        <div className="product-footer">
          <div className="price">
            <strong>{formatCurrency(product.precio, symbol)}</strong>
            {product.precio_anterior && <del>{formatCurrency(product.precio_anterior, symbol)}</del>}
          </div>
          {onAdd && <div className="add-controls">
            {/* Un toque, un plato. El aviso de abajo dice cuantos llevas. */}
            <button className="add-button" type="button" disabled={stock.agotado || sinMas} onClick={() => onAdd(product)} aria-label={`Añadir ${product.nombre} al carrito`}>
              <ShoppingBag size={17} /> <span>{sinMas && !stock.agotado ? "No quedan más" : "Añadir"}</span>
            </button>
          </div>}
        </div>
      </div>
    </article>
  );
}

