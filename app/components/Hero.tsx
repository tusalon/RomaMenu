import { ArrowDown, Bike, Clock3, Leaf, MessageCircle } from "lucide-react";
import type { BusinessSettings } from "@/app/lib/types";

export function Hero({ settings, onOrder }: { settings: BusinessSettings; onOrder: () => void }) {
  return (
    <section className="hero shell" id="inicio">
      <div className="hero-copy">
        <div className="eyebrow"><span /> Sabor casero, directo a tu puerta</div>
        <h1>Hoy cocinamos.<br /><em>Tú solo disfrutas.</em></h1>
        <p>{settings.texto_bienvenida}</p>
        <div className="hero-actions">
          <a className="button button-primary" href="#menu">Ver el menú <ArrowDown size={18} /></a>
          <button className="button button-secondary" onClick={onOrder} type="button"><MessageCircle size={18} /> Pedir ahora</button>
        </div>
        <div className="hero-trust">
          <span><Clock3 size={18} /><b>{settings.tiempo_entrega}</b><small>Entrega estimada</small></span>
          <span><Leaf size={18} /><b>Ingredientes frescos</b><small>Cocinado cada día</small></span>
          <span><Bike size={18} /><b>Solo domicilio</b><small>Rápido y seguro</small></span>
        </div>
      </div>
      <div className="hero-visual">
        <div className="hero-image-wrap">
          <img src={settings.portada_url} alt="Mesa con comida casera recién preparada" />
          <span className="hero-stamp"><ChefStamp /></span>
        </div>
        <div className="hero-note">
          <span>★</span>
          <div><strong>El favorito de la familia</strong><small>Recetas de siempre, hechas con cariño</small></div>
        </div>
      </div>
    </section>
  );
}

function ChefStamp() {
  return <><b>Hecho</b><small>en casa</small></>;
}

