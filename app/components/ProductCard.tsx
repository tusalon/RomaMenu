"use client";

import { Minus, Plus, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { formatCurrency, stockState } from "@/app/lib/format";
import type { Category, Product } from "@/app/lib/types";

type ProductCardProps = {
  product: Product;
  category?: Category;
  symbol: string;
  /** Sin onAdd la tarjeta solo enseña el plato: fuera de horario no se pide nada. */
  onAdd?: (product: Product, quantity: number) => void;
};

export function ProductCard({ product, category, symbol, onAdd }: ProductCardProps) {
  const [quantity, setQuantity] = useState(1);
  const badge = product.precio_anterior ? "Oferta" : product.nuevo ? "Nuevo" : product.recomendado ? "Recomendado" : null;
  const stock = stockState(product);
  // Con stock controlado no se deja pedir mas de lo que hay: rebotarlo en el
  // checkout, despues de rellenar todo el formulario, es peor experiencia.
  const maxQuantity = stock.restantes ?? Infinity;

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
            <div className="quantity-control" aria-label={`Cantidad de ${product.nombre}`}>
              <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Disminuir cantidad"><Minus size={14} /></button>
              <span>{quantity}</span>
              <button type="button" disabled={quantity >= maxQuantity} onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))} aria-label="Aumentar cantidad"><Plus size={14} /></button>
            </div>
            <button className="add-button" type="button" disabled={stock.agotado} onClick={() => onAdd(product, Math.min(quantity, maxQuantity))} aria-label={`Añadir ${quantity} ${product.nombre} al carrito`}>
              <ShoppingBag size={17} /> <span>Añadir</span>
            </button>
          </div>}
        </div>
      </div>
    </article>
  );
}

