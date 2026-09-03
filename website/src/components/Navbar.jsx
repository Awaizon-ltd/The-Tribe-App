import { useEffect, useState } from "react";
import logo from "../assets/logo.png";

const LINKS = [
  { href: "#pillars", label: "How it works" },
  { href: "#ecosystems", label: "Ecosystems" },
];

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? "bg-ink/85 backdrop-blur-md border-b border-hair" : "bg-transparent"
      }`}
    >
      <nav className="wrap flex h-16 items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5">
          <img src={logo} alt="" className="h-7 w-7" />
          <span className="font-display text-sm font-bold tracking-[0.08em] text-text">
            TRIBE
          </span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-muted transition-colors hover:text-text"
            >
              {l.label}
            </a>
          ))}
        </div>

        <a
          href="#download"
          className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-black transition-transform hover:scale-[1.03] active:scale-[0.98]"
        >
          Get Tribe
        </a>
      </nav>
    </header>
  );
};

export default Navbar;
