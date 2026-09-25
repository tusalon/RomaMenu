"use client";

import { ShoppingBag } from "lucide-react";
import { formatCurrency, stockState } from "@/app/lib/format";
import type { Category, Product } from "@/app/lib/types";

type ProductCardProps = {
  product: Product;
  category?: Category;
  symbol: string;
  /** Unidades de este plato que ya hay en el carrito. */
  inCart?: number;
  /** Sin onAdd la tarjeta solo enseña el plato: fuera de horario no se pide nada. */
  onAdd?: (product: Product) => void;
};

export function ProductCard({ product, category, symbol, inCart = 0, onAdd }: ProductCardProps) {
  const badge = product.precio_anterior ? "Oferta" : product.nuevo ? "Nuevo" : product.recomendado ? "Recomendado" : null;
  const stock = stockState(product);
  // Con stock controlado no se deja pedir mas de lo que hay: rebotarlo en el
  // checkout, despues de rellenar todo el formulario, es peor experiencia.
  const sinMas = stock.restantes != null && inCart >= stock.restantes;

  return (
    <article className={stock.agotado ? "product-card sold-out" : "product-card"}>
      <div className="product-image">
        <img src={product.imagen_url} alt={product.nombre} loading="lazy" />
        {badge && <span className={`product-badge ${badge.toLowerCase()}`}>{badge}</span>}
        {stock.agotado && <span className="sold-out-label">Agotado por hoy</span>}
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

