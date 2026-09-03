import { IconVote, IconKey, IconGlobe } from "./Icons";
import CommunityMock from "./CommunityMock";

const TRUST = [
  { icon: IconVote, label: "On-chain governance" },
  { icon: IconKey, label: "Token-gated access" },
  { icon: IconGlobe, label: "Every ecosystem" },
];

const Hero = () => (
  <section id="top" className="relative overflow-hidden pt-40 pb-24 md:pt-48 md:pb-32">
    {/* Corner wash — same restrained black-on-brand-color idea the app's own
        ModeSwitchSplash uses, inverted for a dark ground. */}
    <div
      className="pointer-events-none absolute -top-32 right-[-10%] h-[560px] w-[560px] rounded-full blur-3xl"
      style={{ background: "radial-gradient(circle, rgba(214,255,0,0.14), transparent 70%)" }}
    />

    <div className="wrap relative grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
      <div>
        <div className="eyebrow">
          <span className="h-1.5 w-1.5 rounded-full bg-lime" />
          A utility layer for your token
        </div>

        <h1 className="mt-6 text-[42px] font-extrabold leading-[1.05] tracking-tight text-text sm:text-6xl lg:text-[60px]">
          Add a utility layer
          <br />
          to your token.
          <br />
          Give your community{" "}
          <span className="text-lime">the power.</span>
        </h1>

        <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
          Tribe turns any token into a living, on-chain community —
          build it, grow it, and let your holders own it.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-4">
          <a
            href="#download"
            className="rounded-full bg-lime px-7 py-3.5 text-[15px] font-semibold text-black transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            Get Tribe
          </a>
          <a
            href="#pillars"
            className="rounded-full border border-hair px-7 py-3.5 text-[15px] font-semibold text-text transition-colors hover:border-lime/40 hover:text-lime"
          >
            See how it works
          </a>
        </div>

        <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3">
          {TRUST.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-sm text-dim">
              <Icon className="h-4 w-4 text-lime/80" />
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center lg:justify-end">
        <CommunityMock />
      </div>
    </div>
  </section>
);

export default Hero;
