import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <p className="eyebrow">PRIVATE ACCESS // 01</p>
        <h1 id="login-title">Market<br /><em>Briefing.</em></h1>
        <p className="login-copy">Ruang briefing pribadi untuk membaca konteks makro dan crypto sebelum sesi trading dimulai.</p>
        <LoginForm />
        <p className="login-footnote">Akses terbatas untuk pengguna terotorisasi.</p>
      </section>
      <aside className="login-aside" aria-hidden="true">
        <p>DAILY INTELLIGENCE</p>
        <div className="grid-mark" />
        <span>MACRO / CRYPTO / CALENDAR</span>
      </aside>
    </main>
  );
}
