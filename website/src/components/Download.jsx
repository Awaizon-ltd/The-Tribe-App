const Download = () => (
  <section id="download" className="hair-t border-hair py-24 md:py-32">
    <div className="wrap">
      <div className="relative overflow-hidden rounded-[32px] border border-hair bg-card px-8 py-16 text-center sm:px-16">
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-72 w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(214,255,0,0.18), transparent 70%)" }}
        />
        <h2 className="relative mx-auto max-w-lg text-4xl font-bold leading-tight text-text sm:text-5xl">
          Give your community the power.
        </h2>
        <p className="relative mx-auto mt-4 max-w-sm text-[15px] text-muted">
          Bring Tribe to your token — iOS and Android apps are on their way.
        </p>

        <div className="relative mt-9 flex flex-wrap items-center justify-center gap-3">
          <span className="rounded-full border border-hair px-4 py-2 font-mono text-xs uppercase tracking-[0.12em] text-dim">
            App Store · Coming soon
          </span>
          <span className="rounded-full border border-hair px-4 py-2 font-mono text-xs uppercase tracking-[0.12em] text-dim">
            Google Play · Coming soon
          </span>
        </div>
      </div>
    </div>
  </section>
);

export default Download;
