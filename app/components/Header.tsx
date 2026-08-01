"use client";

import { ChefHat, Menu, MessageCircle, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import type { BusinessSettings } from "@/app/lib/types";

type HeaderProps = {
  settings: BusinessSettings;
  cartCount: number;
  onCartOpen: () => void;
};

export function Header({ settings, cartCount, onCartOpen }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const whatsappUrl = `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`;

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const closeOnHashChange = () => setMenuOpen(false);

    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("hashchange", closeOnHashChange);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("hashchange", closeOnHashChange);
    };
  }, [menuOpen]);

  function goToSection(event: MouseEvent<HTMLAnchorElement>, sectionId: string) {
    const section = document.getElementById(sectionId);
    setMenuOpen(false);
    if (!section) return;

    event.preventDefault();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    window.requestAnimationFrame(() => {
      section.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });

      const nextHash = `#${sectionId}`;
      if (window.location.hash === nextHash) {
        window.history.replaceState(null, "", nextHash);
      } else {
        window.history.pushState(null, "", nextHash);
      }
    });
  }

  return (
    <header className="site-header">
      <div className="header-inner shell">
        <a className="brand" href="#inicio" aria-label="Ir al inicio" onClick={(event) => goToSection(event, "inicio")}>
          <span className="brand-mark" aria-hidden="true">
            <ChefHat size={25} strokeWidth={1.8} />
          </span>
          <span>
            <strong>La Cocina</strong>
            <small>de Miguelón</small>
          </span>
        </a>

        <nav id="main-navigation" className={menuOpen ? "main-nav is-open" : "main-nav"} aria-label="Navegación principal">
          <a href="#menu" onClick={(event) => goToSection(event, "menu")}>Menú</a>
          <a href="#recomendados" onClick={(event) => goToSection(event, "recomendados")}>Recomendados</a>
          <a href="#como-pedir" onClick={(event) => goToSection(event, "como-pedir")}>Cómo pedir</a>
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
          <button className="menu-button" onClick={() => setMenuOpen((value) => !value)} type="button" aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"} aria-controls="main-navigation" aria-expanded={menuOpen}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </header>
  );
}
