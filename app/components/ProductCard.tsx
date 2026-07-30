"use client";

import { Minus, Plus, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { formatCurrency } from "@/app/lib/format";
import type { Category, Product } from "@/app/lib/types";

type ProductCardProps = {
  product: Product;
  category?: Category;
  symbol: string;
  onAdd: (product: Product, quantity: number) => void;
};

export function ProductCard({ product, category, symbol, onAdd }: ProductCardProps) {
  const [quantity, setQuantity] = useState(1);
  const badge = product.precio_anterior ? "Oferta" : product.nuevo ? "Nuevo" : product.recomendado ? "Recomendado" : null;

  return (
    <article className={product.disponible ? "product-card" : "product-card sold-out"}>
      <div className="product-image">
        <img src={product.imagen_url} alt={product.nombre} loading="lazy" />
        {badge && <span className={`product-badge ${badge.toLowerCase()}`}>{badge}</span>}
        {!product.disponible && <span className="sold-out-label">Agotado por hoy</span>}
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
          <div className="add-controls">
            <div className="quantity-control" aria-label={`Cantidad de ${product.nombre}`}>
              <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Disminuir cantidad"><Minus size={14} /></button>
              <span>{quantity}</span>
              <button type="button" onClick={() => setQuantity((value) => value + 1)} aria-label="Aumentar cantidad"><Plus size={14} /></button>
            </div>
            <button className="add-button" type="button" disabled={!product.disponible} onClick={() => onAdd(product, quantity)} aria-label={`Añadir ${quantity} ${product.nombre} al carrito`}>
              <ShoppingBag size={17} /> <span>Añadir</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

