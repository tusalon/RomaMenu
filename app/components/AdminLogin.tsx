"use client";

import { ChefHat, CircleAlert, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { isSupabaseConfigured, signInAdmin } from "@/app/lib/repository";

export function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInAdmin(email, password);
      window.location.href = "/admin";
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No pudimos iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-art">
        <Link className="brand" href="/">
          <span className="brand-mark"><ChefHat size={25} /></span>
          <span><strong>La Cocina</strong><small>de Miguelón</small></span>
        </Link>
        <div>
          <h1>Todo bajo control, desde una sola cocina.</h1>
          <p>Gestiona pedidos, productos, entregas y la información del negocio desde tu panel privado.</p>
        </div>
        <small>Panel administrativo · Acceso protegido</small>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <span className="brand-mark"><LockKeyhole size={22} /></span>
          <h2>Bienvenido de vuelta</h2>
          <p>Inicia sesión con el correo autorizado para administrar La Cocina de Miguelón.</p>
          <form onSubmit={handleSubmit}>
            <label className="field"><span>Correo electrónico</span><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="administrador@correo.com" /></label>
            <label className="field"><span>Contraseña</span><input type="password" required minLength={6} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" /></label>
            {error && <div className="form-error"><CircleAlert size={17} /> {error}</div>}
            {!isSupabaseConfigured() && <div className="login-help">Modo demostración: usa cualquier correo y una contraseña de 6 caracteres o más. Con Supabase conectado, solo funcionarán las cuentas administrativas reales.</div>}
            <button className="button button-primary button-block" type="submit" disabled={loading}>{loading ? "Verificando…" : "Entrar al panel"}</button>
            <Link className="button button-ghost button-block" href="/">Volver al catálogo</Link>
          </form>
        </div>
      </section>
    </main>
  );
}
