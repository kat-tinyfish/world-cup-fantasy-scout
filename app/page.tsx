import { PILLAR_LABELS } from "@/lib/personality";

export default function LandingPage() {
  return (
    <main>
      <section className="hero">
        <div className="eyebrow">World Cup Fantasy chaos desk</div>
        <h1>The fantasy scout with jokes, receipts, and deadline-chaos instincts.</h1>
        <p className="hero-copy">
          TinyFish Scout turns the noisy World Cup Fantasy research swamp into funny, source-backed daily
          notes for captains, differentials, lineup chaos, and mini-league banter.
        </p>
        <div className="hero-actions">
          <a className="button primary" href="#signup">
            Get daily scout drops
          </a>
          <a className="button secondary" href="https://docs.tinyfish.ai/search-api">
            See the TinyFish API
          </a>
        </div>
      </section>

      <section className="proof-grid" aria-label="Campaign pillars">
        {Object.entries(PILLAR_LABELS).map(([key, label]) => (
          <article className="card" key={key}>
            <span>{label}</span>
            <p>{pillarCopy[key as keyof typeof PILLAR_LABELS]}</p>
          </article>
        ))}
      </section>

      <section className="receipt-panel">
        <div>
          <p className="eyebrow">How it works</p>
          <h2>Funny wrapper. Serious sourcing. No vibes in a trench coat.</h2>
        </div>
        <ol>
          <li>TinyFish Search finds current fantasy chatter, guides, lineup notes, and creator posts.</li>
          <li>TinyFish Fetch extracts clean source text so posts can link back to receipts.</li>
          <li>The bot drafts jokes plus useful scout notes, then waits for human approval before posting.</li>
        </ol>
      </section>

      <section className="signup" id="signup">
        <div>
          <p className="eyebrow">Join the bench regret support group</p>
          <h2>Get the daily scout drop.</h2>
          <p>Useful before deadline. Funny enough to send to the friend who captained a center back.</p>
        </div>
        <form action="/api/leads" method="post">
          <label>
            Email
            <input name="email" type="email" required placeholder="you@example.com" />
          </label>
          <label>
            I am here as
            <select name="role" defaultValue="player">
              <option value="player">Fantasy player</option>
              <option value="creator">Creator or partner</option>
              <option value="developer">Developer</option>
            </select>
          </label>
          <input name="sourceUtm" type="hidden" value="landing-page" />
          <button className="button primary" type="submit">
            Put me on the list
          </button>
        </form>
      </section>
    </main>
  );
}

const pillarCopy: Record<keyof typeof PILLAR_LABELS, string> = {
  daily_scout: "One useful read on the day, wrapped in enough personality to survive the timeline.",
  differential_radar: "Low-owned ideas get treated like suspicious treasure: tempting, inspected, sourced.",
  captaincy_chaos: "Captain pivots and manual-sub reminders before the deadline gremlins chew the wires.",
  lineup_news_watch: "Rotation risk, predicted lineups, and team news without pretending uncertainty is illegal.",
  template_panic_meter: "A gentle alarm for when everyone owns the same player and calls it independent thinking.",
  mini_league_banter: "Shareable prompts, little roasts, and receipts for group chats with too much confidence.",
  built_with_tinyfish: "Behind-the-scenes posts showing curious fantasy insiders how Search and Fetch power the scout."
};
