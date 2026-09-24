"use client";

import {
  ArrowRight,
  Check,
  ChevronDown,
  ChefHat,
  MapPin,
  MessageCircle,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { demoCatalog } from "@/app/lib/demo-data";
import { describeWindow } from "@/app/lib/format";
import { fetchOrderWindow, fetchPublicCatalog, isSupabaseConfigured } from "@/app/lib/repository";
import type { OrderWindow, Product, PublicCatalog } from "@/app/lib/types";
import { useCart } from "@/app/lib/use-cart";
import { CartDrawer } from "./CartDrawer";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { ProductCard } from "./ProductCard";

type SortOption = "featured" | "price-asc" | "price-desc";

export function Storefront() {
  const [catalog, setCatalog] = useState<PublicCatalog>(demoCatalog);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sort, setSort] = useState<SortOption>("featured");
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [orderWindow, setOrderWindow] = useState<OrderWindow | null>(null);
  const cart = useCart();

  useEffect(() => {
    fetchPublicCatalog()
      .then(setCatalog)
      .catch(() => {
        setCatalog(demoCatalog);
        setLoadError("No pudimos sincronizar el menú. Mostramos los productos de demostración.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const refresh = () => fetchOrderWindow().then(setOrderWindow).catch(() => undefined);
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Sin respuesta de la base todavia, manda el interruptor de siempre.
  const accepting = orderWindow ? orderWindow.acepta : catalog.settings.abierto;
  const windowNotice = describeWindow(orderWindow);

  const products = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    const filtered = catalog.products.filter((product) => {
      if (!product.activo) return false;
      if (category !== "all" && product.categoria_id !== category) return false;
      if (availableOnly && !product.disponible) return false;
      return !normalizedQuery || product.nombre.toLocaleLowerCase("es").includes(normalizedQuery);
    });
    if (sort === "price-asc") return [...filtered].sort((a, b) => a.precio - b.precio);
    if (sort === "price-desc") return [...filtered].sort((a, b) => b.precio - a.precio);
    return [...filtered].sort((a, b) => Number(b.recomendado) - Number(a.recomendado) || a.orden - b.orden);
  }, [availableOnly, catalog.products, category, query, sort]);

  const recommended = catalog.products.filter((product) => product.activo && product.disponible && product.recomendado).slice(0, 3);

  function addToCart(product: Product, quantity: number) {
    cart.add(product, quantity);
    setToast(`${quantity} × ${product.nombre} añadido al carrito`);
    window.setTimeout(() => setToast(""), 2400);
  }

  const style = {
    "--brand": catalog.settings.color_primario,
    "--accent": catalog.settings.color_secundario,
  } as React.CSSProperties;

  return (
    <div className="storefront" style={style}>
      {!accepting ? (
        <div className="closed-banner">{windowNotice ?? catalog.settings.mensaje_cerrado}</div>
      ) : windowNotice ? (
        <div className="closed-banner open-notice">{windowNotice}</div>
      ) : null}
      <Header settings={catalog.settings} accepting={accepting} cartCount={cart.count} onCartOpen={() => setCartOpen(true)} />
      <main>
        <Hero settings={catalog.settings} onOrder={() => setCartOpen(true)} />

        <section className="recommended-strip" id="recomendados">
          <div className="shell">
            <div className="strip-heading">
              <span><Sparkles size={17} /></span>
              <div><small>Favoritos de nuestros clientes</small><strong>Lo más pedido esta semana</strong></div>
            </div>
            <div className="mini-products">
              {recommended.map((product) => (
                <button key={product.id} type="button" onClick={() => addToCart(product, 1)}>
                  <img src={product.imagen_url} alt="" />
                  <span><strong>{product.nombre}</strong><small>Añadir rápido <ArrowRight size={13} /></small></span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="menu-section shell" id="menu">
          <div className="section-heading">
            <div>
              <span className="eyebrow"><span /> Nuestro menú</span>
              <h2>Elige algo <em>delicioso</em></h2>
              <p>Todo se prepara al momento con ingredientes frescos y el sabor de casa.</p>
            </div>
            <span className="dish-count">{products.length} platos</span>
          </div>

          <div className="category-tabs" aria-label="Filtrar por categoría">
            <button type="button" className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}><UtensilsCrossed size={17} /> Todos</button>
            {catalog.categories.filter((item) => item.activa).map((item) => (
              <button key={item.id} type="button" className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)}>{item.nombre}</button>
            ))}
          </div>

          <div className="catalog-toolbar">
            <label className="search-box">
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre…" aria-label="Buscar productos por nombre" />
            </label>
            <label className="availability-check">
              <input type="checkbox" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} />
              <span><Check size={13} /></span> Solo disponibles
            </label>
            <label className="sort-select">
              <SlidersHorizontal size={17} />
              <select value={sort} onChange={(event) => setSort(event.target.value as SortOption)} aria-label="Ordenar productos">
                <option value="featured">Destacados</option>
                <option value="price-asc">Menor precio</option>
                <option value="price-desc">Mayor precio</option>
              </select>
              <ChevronDown size={15} />
            </label>
          </div>

          {loadError && <div className="inline-notice">{loadError}</div>}
          {!isSupabaseConfigured() && !loading && <div className="demo-notice"><span>Vista de demostración</span> Conecta Supabase para publicar productos y pedidos reales.</div>}

          {loading ? (
            <div className="product-grid loading-grid">{Array.from({ length: 6 }).map((_, index) => <div className="product-skeleton" key={index} />)}</div>
          ) : products.length ? (
            <div className="product-grid">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} category={catalog.categories.find((item) => item.id === product.categoria_id)} symbol={catalog.settings.simbolo_moneda} onAdd={addToCart} />
              ))}
            </div>
          ) : (
            <div className="no-results"><Search size={30} /><h3>No encontramos ese plato</h3><p>Prueba con otro nombre o cambia los filtros.</p><button type="button" onClick={() => { setQuery(""); setCategory("all"); setAvailableOnly(false); }}>Limpiar filtros</button></div>
          )}
        </section>

        <section className="how-section" id="como-pedir">
          <div className="shell">
            <div className="section-heading compact"><div><span className="eyebrow light"><span /> Fácil y rápido</span><h2>Tu comida en <em>tres pasos</em></h2></div></div>
            <div className="steps-grid">
              <article><span>01</span><div className="step-icon"><UtensilsCrossed size={23} /></div><h3>Elige tus platos</h3><p>Explora el menú y añade al carrito todo lo que te apetezca.</p></article>
              <article><span>02</span><div className="step-icon"><MapPin size={23} /></div><h3>Indica dónde</h3><p>Completa tus datos y calculamos la entrega según tu zona.</p></article>
              <article><span>03</span><div className="step-icon"><MessageCircle size={23} /></div><h3>Confirma por WhatsApp</h3><p>Guardamos el pedido y abrimos un mensaje listo para enviar.</p></article>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell footer-grid">
          <div><a className="brand footer-brand" href="#inicio"><span className="brand-mark"><ChefHat size={25} /></span><span><strong>La Cocina</strong><small>de Miguelón</small></span></a><p>{catalog.settings.descripcion}</p></div>
          <div><small>Horario y entrega</small><strong>{accepting ? catalog.settings.mensaje_abierto : catalog.settings.mensaje_cerrado}</strong><span>{catalog.settings.direccion}</span></div>
          <div><small>¿Necesitas ayuda?</small><a href={`https://wa.me/${catalog.settings.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">Escríbenos por WhatsApp <ArrowRight size={15} /></a><span>{catalog.settings.telefono}</span></div>
        </div>
        <div className="shell footer-bottom"><span>© {new Date().getFullYear()} La Cocina de Miguelón</span><span>Comida casera · Entrega a domicilio</span></div>
      </footer>

      <button className="mobile-cart" type="button" onClick={() => setCartOpen(true)} aria-label={`Abrir carrito con ${cart.count} productos`}><ShoppingBag size={20} /><span>Ver carrito</span><b>{cart.count}</b></button>
      {toast && <div className="toast" role="status"><Check size={18} /> {toast}</div>}
      <CartDrawer open={cartOpen} catalog={catalog} orderWindow={orderWindow} items={cart.items} subtotal={cart.subtotal} onClose={() => setCartOpen(false)} onAdd={cart.add} onUpdate={cart.update} onRemove={cart.remove} onClear={cart.clear} />
    </div>
  );
}

