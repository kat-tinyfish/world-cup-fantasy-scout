import type { ContentPillar } from "./types";

export const PILLAR_LABELS: Record<ContentPillar, string> = {
  daily_scout: "Daily Scout",
  differential_radar: "Differential Radar",
  captaincy_chaos: "Captaincy Chaos Planner",
  lineup_news_watch: "Lineup News Watch",
  template_panic_meter: "Template Panic Meter",
  mini_league_banter: "Mini-League Ammo",
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
    "The scout note is short because kickoff waits for no spreadsheet.",
    "One useful read, zero homework cosplay."
  ],
  differential_radar: [
    "Tiny edge, big consequences.",
    "Differential shopping rule: if it feels too clever, check the minutes twice."
  ],
  captaincy_chaos: [
    "Captaincy plan before the group chat becomes a courtroom.",
    "Start brave, pivot sober."
  ],
  lineup_news_watch: [
    "Lineup watch, aka certainty wearing a fake mustache.",
    "Rotation risk remains undefeated and deeply annoying."
  ],
  template_panic_meter: [
    "Template panic check.",
    "If everyone owns him, that is not a scouting department. That is a queue."
  ],
  mini_league_banter: [
    "Mini-league ammo for the person already rehearsing excuses.",
    "Group chat peace was never an option."
  ],
  built_with_tinyfish: [
    "Receipts first, vibes on probation.",
    "Search found the mess. Fetch made it readable."
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
  "search",
  "fetch",
  "evidence",
  "fantasy",
  "template",
  "if",
  "because"
];

export const FUNNY_MARKERS = [
  "chaos",
  "crimes",
  "panic",
  "roulette",
  "regret",
  "group chat",
  "courtroom",
  "trench coat",
  "vibes",
  "fake mustache",
  "personality test",
  "astrology",
  "excuses",
  "sober",
  "homework cosplay",
  "queue",
  "probation",
  "mess",
  "receipts",
  "blank",
  "template"
];
