import { IconVote, IconChat } from "./Icons";

// A hand-built stand-in for the app's real tribe UI — a live proposal
// with an on-chain vote in progress, grounded in the real proposal
// lifecycle (proposal.routes.js: active → passed/executed, votes tallied
// per address) rather than an abstract illustration.
const AVATAR_COLORS = ["#d6ff00", "#8a9dff", "#c9a8ff", "#ffb17a"];

const CommunityMock = () => (
  <div className="relative">
    {/* Radar pulse — echoes ModeSwitchSplash's own pulse ring animation */}
    <div className="pointer-events-none absolute -inset-10 -z-10 hidden md:block">
      <div className="absolute inset-0 animate-ping-slow rounded-full border border-lime/20" />
    </div>

    <div className="w-[320px] rounded-3xl border border-hair bg-card/90 p-1.5 shadow-[0_40px_120px_-40px_rgba(214,255,0,0.15)] backdrop-blur sm:w-[360px]">
      <div className="rounded-[20px] border border-hair/60 bg-surface/60 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime/15 text-[13px] font-bold text-lime">
              SR
            </div>
            <div>
              <p className="text-[13px] font-semibold text-text">Sunset Riders Tribe</p>
              <p className="text-[11px] text-dim">248 members · token-gated</p>
            </div>
          </div>
          <div className="flex -space-x-2">
            {AVATAR_COLORS.map((c) => (
              <span
                key={c}
                className="h-6 w-6 rounded-full border-2 border-surface"
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-hair/70 bg-card2/60 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-lime">
              <IconVote className="h-3.5 w-3.5" />
              Active proposal
            </span>
            <span className="tabular text-[10px] text-dim">#42</span>
          </div>
          <p className="text-[13px] font-semibold leading-snug text-text">
            Fund the community art program for Q1
          </p>

          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[74%] rounded-full bg-lime" />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-dim">
            <span className="tabular">
              <span className="font-semibold text-text">74%</span> yes
            </span>
            <span className="tabular">183 votes on-chain</span>
          </div>
        </div>
      </div>
    </div>

    {/* Floating tribe chat chip — a real feature (chat.sendMessage) */}
    <div className="absolute -left-6 -bottom-6 hidden w-[220px] rounded-2xl border border-hair bg-card p-3.5 shadow-2xl sm:block">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-dim">
        <IconChat className="h-3.5 w-3.5 text-lime" />
        Tribe chat
      </div>
      <p className="text-[13px] leading-snug text-text">
        "proposal passed — art program is funded 🎨"
      </p>
      <p className="mt-1 text-[11px] text-dim">— posted by a member, just now</p>
    </div>
  </div>
);

export default CommunityMock;
