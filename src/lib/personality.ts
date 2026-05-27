import type { ContentPillar } from "./types";

export const PILLAR_LABELS: Record<ContentPillar, string> = {
  daily_scout: "Daily Scout",
  differential_radar: "Differential Goblin Hour",
  captaincy_chaos: "Captaincy Chaos Planner",
  lineup_news_watch: "Rotation Weather Report",
  template_panic_meter: "Template Panic Meter",
  mini_league_banter: "Mini-League Banter",
  built_with_tinyfish: "Built with TinyFish"
};

export const PILLAR_QUERIES: Record<ContentPillar, string[]> = {
  daily_scout: [
    '"FIFA World Cup Fantasy 2026" tips picks',
    '"World Cup Fantasy 2026" guide rules players'
  ],
  differential_radar: [
    '"World Cup Fantasy 2026" differential low owned',
    '"FIFA World Cup Fantasy" ownership differential'
  ],
  captaincy_chaos: [
    '"World Cup Fantasy 2026" captaincy captain',
    '"World Cup Fantasy" manual substitutions captain'
  ],
  lineup_news_watch: [
    '"World Cup Fantasy 2026" team news predicted lineup',
    '"World Cup 2026" fantasy lineup news'
  ],
  template_panic_meter: [
    '"World Cup Fantasy 2026" template team',
    '"FIFA World Cup Fantasy" rate my team'
  ],
  mini_league_banter: [
    '"World Cup Fantasy 2026" mini league',
    '"World Cup Fantasy" league code'
  ],
  built_with_tinyfish: [
    '"TinyFish" search fetch API',
    '"TinyFish" web search API docs'
  ]
};

export const HOOKS: Record<ContentPillar, string[]> = {
  daily_scout: [
    "The scout notebook is open and already judging everyone's life choices.",
    "Today's World Cup Fantasy soup contains one useful tip and three floating anxieties."
  ],
  differential_radar: [
    "Differential goblin hour has arrived wearing tiny boots and a questionable grin.",
    "The under-owned cupboard is open. Please do not lick the mystery asset."
  ],
  captaincy_chaos: [
    "Captaincy crimes court is now in session.",
    "Captaincy plan: start brave, pivot sober, avoid becoming the Joker by kickoff two."
  ],
  lineup_news_watch: [
    "Rotation weather report: scattered panic with a chance of bench regret.",
    "The lineup gremlins are tapping on the glass again."
  ],
  template_panic_meter: [
    "Template hydra status: one head grew back and it owns the same midfielder as everyone else.",
    "The template panic meter is humming like a haunted refrigerator."
  ],
  mini_league_banter: [
    "Mini-league diplomacy update: your group chat is one captain blank away from becoming a tribunal.",
    "Bench regret support group meets after the deadline. Bring screenshots and denial."
  ],
  built_with_tinyfish: [
    "TinyFish found the receipts, which is rude but useful.",
    "We sent TinyFish into the fantasy mines and it came back holding sources."
  ]
};

export const USEFULNESS_MARKERS = [
  "captain",
  "differential",
  "lineup",
  "ownership",
  "rotation",
  "deadline",
  "source",
  "guide",
  "rules",
  "watch",
  "if",
  "because"
];

export const FUNNY_MARKERS = [
  "goblin",
  "chaos",
  "crimes",
  "hydra",
  "panic",
  "roulette",
  "regret",
  "tiny hat",
  "gremlin",
  "tribunal",
  "haunted",
  "joker",
  "soup",
  "receipts"
];
