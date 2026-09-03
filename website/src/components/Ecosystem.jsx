// The real mainnet chain list from constants/Chain.js — not a placeholder
// set, so this never claims support the app doesn't actually have.
const CHAINS = [
  "Ethereum",
  "Robinhood Chain",
  "Base",
  "Arbitrum",
  "Polygon",
  "Avalanche",
  "HyperEVM",
];

const track = [...CHAINS, ...CHAINS];

const Ecosystem = () => (
  <section id="ecosystems" className="hair-t border-hair py-20 md:py-24">
    <div className="wrap text-center">
      <p className="eyebrow mx-auto w-fit">Every ecosystem</p>
      <h2 className="mx-auto mt-5 max-w-xl text-3xl font-bold text-text sm:text-4xl">
        One utility layer, wherever your token lives
      </h2>
      <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted">
        Tribe isn't tied to one chain — it plugs into your token wherever
        your holders already are.
      </p>
    </div>

    <div className="mt-12 border-y border-hair bg-surface/50 py-5">
      <div className="flex overflow-hidden">
        <div className="flex shrink-0 animate-marquee items-center gap-12 pr-12">
          {track.map((c, i) => (
            <span
              key={`${c}-${i}`}
              className="whitespace-nowrap font-mono text-sm uppercase tracking-[0.14em] text-dim"
            >
              {c}
            </span>
          ))}
        </div>
        <div className="flex shrink-0 animate-marquee items-center gap-12 pr-12" aria-hidden="true">
          {track.map((c, i) => (
            <span
              key={`dup-${c}-${i}`}
              className="whitespace-nowrap font-mono text-sm uppercase tracking-[0.14em] text-dim"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default Ecosystem;
