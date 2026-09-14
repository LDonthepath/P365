import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand-lockup"><span className="brand-mark" aria-hidden="true">P</span><p className="eyebrow">PRIVATE ACCESS // 01</p></div>
        <h1 id="login-title">Market<br /><em>Briefing.</em></h1>
        <p className="login-copy">Ruang briefing pribadi untuk membaca konteks makro dan crypto sebelum sesi trading dimulai.</p>
        <LoginForm />
        <div className="login-footnote"><span className="secure-dot" aria-hidden="true" /><p>Akses terenkripsi untuk pengguna terotorisasi.</p></div>
      </section>
      <aside className="login-aside" aria-hidden="true">
        <div className="aside-topline"><span>DAILY INTELLIGENCE</span><span>09:30 WIB</span></div>
        <div className="grid-mark" />
        <div className="aside-content"><p>Read the signal,<br />not the noise.</p><span>MACRO / CRYPTO / CALENDAR</span></div>
      </aside>
    </main>
  );
}
