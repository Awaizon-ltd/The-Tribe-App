import { IconLayers, IconPeople, IconVote } from "./Icons";

const PILLARS = [
  {
    icon: IconLayers,
    tag: "Build",
    title: "Stand up a home for your holders",
    desc: "Chat, roles, and token-gated spaces — live for your community in minutes, not a sprint.",
  },
  {
    icon: IconPeople,
    tag: "Grow",
    title: "Bring your community to you",
    desc: "Invite links and open discovery do the work — no separate server to manage and moderate alone.",
  },
  {
    icon: IconVote,
    tag: "Own",
    title: "Put decisions on-chain",
    desc: "Every proposal and vote is recorded on-chain. What your community decides is what happens.",
  },
];

const Pillars = () => (
  <section id="pillars" className="hair-t border-hair py-24 md:py-32">
    <div className="wrap">
      <div className="max-w-lg">
        <p className="eyebrow">Build. Grow. Own.</p>
        <h2 className="mt-5 text-4xl font-bold text-text sm:text-5xl">
          Your token, as a community
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          Tribe is the layer between a token and the people who hold it —
          the tools to build a real community around it, on-chain.
        </p>
      </div>

      <div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-hair bg-hair md:grid-cols-3">
        {PILLARS.map(({ icon: Icon, tag, title, desc }) => (
          <div key={tag} className="bg-ink p-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-lime/10 text-lime">
              <Icon />
            </span>
            <p className="mt-6 font-mono text-xs uppercase tracking-[0.16em] text-lime">
              {tag}
            </p>
            <h3 className="mt-2 text-xl font-bold text-text">{title}</h3>
            <p className="mt-3 text-[14px] leading-relaxed text-muted">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Pillars;
