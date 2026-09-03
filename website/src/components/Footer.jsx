import logo from "../assets/logo.png";

const Footer = () => (
  <footer className="hair-t border-hair py-12">
    <div className="wrap flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2.5">
        <img src={logo} alt="" className="h-6 w-6 opacity-90" />
        <span className="font-display text-xs font-bold tracking-[0.08em] text-text">
          TRIBE
        </span>
      </div>

      <nav className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-sm text-dim">
        <a href="#pillars" className="transition-colors hover:text-text">
          How it works
        </a>
        <a href="#ecosystems" className="transition-colors hover:text-text">
          Ecosystems
        </a>
      </nav>

      <p className="text-xs text-dim">© 2026 Tribe. All rights reserved.</p>
    </div>
  </footer>
);

export default Footer;
