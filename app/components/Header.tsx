"use client";

import { ChefHat, Menu, MessageCircle, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import type { BusinessSettings } from "@/app/lib/types";

type HeaderProps = {
  settings: BusinessSettings;
  cartCount: number;
  onCartOpen: () => void;
};

export function Header({ settings, cartCount, onCartOpen }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const whatsappUrl = `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`;

  return (
    <header className="site-header">
      <div className="header-inner shell">
        <a className="brand" href="#inicio" aria-label="Ir al inicio">
          <span className="brand-mark" aria-hidden="true">
            <ChefHat size={25} strokeWidth={1.8} />
          </span>
          <span>
            <strong>La Cocina</strong>
            <small>de Miguelón</small>
          </span>
        </a>

        <nav className={menuOpen ? "main-nav is-open" : "main-nav"} aria-label="Navegación principal">
          <a href="#menu" onClick={() => setMenuOpen(false)}>Menú</a>
          <a href="#recomendados" onClick={() => setMenuOpen(false)}>Recomendados</a>
          <a href="#como-pedir" onClick={() => setMenuOpen(false)}>Cómo pedir</a>
        </nav>

        <div className="header-actions">
          <span className={settings.abierto ? "open-pill" : "open-pill closed"}>
            <i /> {settings.abierto ? "Abierto" : "Cerrado"}
          </span>
          <a className="icon-button whatsapp-header" href={whatsappUrl} target="_blank" rel="noreferrer" aria-label="Contactar por WhatsApp">
            <MessageCircle size={20} />
          </a>
          <button className="cart-button" onClick={onCartOpen} type="button" aria-label={`Abrir carrito con ${cartCount} productos`}>
            <ShoppingBag size={19} />
            <span>Carrito</span>
            <b>{cartCount}</b>
          </button>
          <button className="menu-button" onClick={() => setMenuOpen((value) => !value)} type="button" aria-label="Abrir menú" aria-expanded={menuOpen}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </header>
  );
}
