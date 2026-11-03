/* SPDX-License-Identifier: MIT
   Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia
   Lifted verbatim from the author's IMPAK v0.5 build (1 Oct 2026); only this header was added. */
/* Park Builder v0.3 — STP 100 engine.
 * Deterministic and event-sourced: a team's state at game time t (in months, 0..60) is rebuilt from
 * the scenario (derived from one seed), the team's order log and its event decisions. The same code runs
 * in Node (calibration) and in the browser (the game). No Math.random, no Date.
 */
(function (root) {
"use strict";

const CFG = {
  MONTHS: 60, START_CASH: 5, FUND: 30, FUND_SHARE: 0.8, FUND_END: 24,
  ALLOC_YR: [1, 1, 1, 0, 0], PARK_OFFICE: 0.6,
  AP_Q: 3, LOAN_CAP: 15, RATE: 0.10, EMERG: 0.20, EMERG_P3: 0.25,
  ZONES: {
    A: { name: "Gateway", acres: 8, plots: 0, svc: { road: 1, water: 1, power: 1, fibre: 1 } },
    B: { name: "Old Workshops", acres: 12, plots: 0, sheds: 3, svc: { road: 1, water: 1, power: 1, fibre: 0 } },
    C: { name: "Campus Edge", acres: 15, plots: 4, svc: { road: 0.5, water: 1, power: 1, fibre: 1 }, linkedBonus: 1 },
    D: { name: "Highway Frontage", acres: 10, plots: 3, svc: { road: 1, water: 0, power: 0, fibre: 0 }, boRent: 1.3 },
    E: { name: "Central Plateau", acres: 15, plots: 5, svc: { road: 0, water: 0, power: 0, fibre: 0 }, flood: true },
    F: { name: "Forest Ridge", acres: 15, plots: 4, svc: { road: 0, water: 0, power: 0, fibre: 0 }, forest: true },
    G: { name: "Wetland", acres: 10, plots: 2, svc: { road: 0, water: 0, power: 0, fibre: 0 }, wet: true, flood: true },
    H: { name: "University Reserve", acres: 15, plots: 4, svc: { road: 1, water: 1, power: 0, fibre: 0 }, release: 25, signBy: 36 },
  },
  // adjacency as drawn on the site plan (used for the shared-substation discount)
  ADJ: { A: ["B", "C"], B: ["A", "C", "D", "E"], C: ["A", "B", "E", "H"], D: ["B", "E", "F", "G"], E: ["B", "C", "D", "F", "H"], F: ["D", "E", "G"], G: ["D", "F"], H: ["C", "E"] },
  WORKS: {
    road: { cost: 1.5, months: 4, label: "Road link" }, roadHalf: { cost: 0.8, months: 2, label: "Complete road" },
    water: { cost: 1.0, months: 3, label: "Water connection" }, power: { cost: 2.0, months: 6, label: "Power connection" },
    powerShared: { cost: 1.0, months: 6, label: "Power (shared substation)" }, fibre: { cost: 0.5, months: 2, label: "Fibre" },
    clear: { cost: 2.0, months: 6, delay: 3, delayP: 1 / 3, label: "Forest clearance" },
    retention: { cost: 2.5, months: 6, label: "Retention works" },
  },
  BUILD: {
    retrofit: { cost: 3, months: 6, units: 3, upkeep: 1.0, label: "Retrofit shed" },
    modular: { cost: 4, months: 6, units: 4, upkeep: 1.2, label: "Modular block" },
    newbuild: { cost: 7, months: 12, units: 6, upkeep: 2.0, label: "New Build" },
    factory: { cost: 3, months: 3, units: 4, upkeep: 1.0, label: "Converted factory" },
  },
  SPEC: { gateOcc: 0.8, overrunP: 0.5, overrunCost: 2, overrunMonths: 3, gateDelayP: 1 / 6 },
  FAC: {
    lab: { cost: 3, upkeep: 1.0, units: 1, fibre: true, label: "Shared Prototyping Lab" },
    labaccess: { cost: 0.5, upkeep: 0.3, units: 0, label: "University Lab Access" },
    incubator: { cost: 1, upkeep: 0.8, units: 1, fibre: true, cap: 4, label: "Incubator" },
    liaison: { cost: 0.5, upkeep: 0.5, units: 0, label: "Industry Liaison Office" },
    covenant: { cost: 0, upkeep: 0.2, units: 0, label: "Engagement Covenant" },
    kpi: { cost: 0.5, upkeep: 0.2, units: 0, label: "KPI & Impact Reporting" },
    mgmt: { cost: 0, upkeep: 0.6, units: 0, label: "Park Management Team" },
    services: { cost: 0.5, upkeep: 0.4, units: 0, label: "Shared Services" },
  },
  TEN: {
    backoffice: { units: 1, rent: 1.0, ip: 0, linked: false, tech: false, exit: 1 / 6, label: "Back-office corporate" },
    sme: { units: 1, rent: 0.7, ip: 1, linked: true, tech: true, exit: 1 / 6, label: "Tech SME" },
    spinoff: { units: 1, rent: 0.4, ip: 2, linked: true, tech: true, exit: 1 / 3, exitSupported: 1 / 6, label: "University spin-off" },
    anchor: { units: 3, rent: 2.4, ip: 3, linked: true, tech: true, exit: 1 / 6, label: "R&D anchor" },
    bigAnchor: { units: 6, rent: 4.0, ip: 4, linked: true, tech: true, exit: 1 / 6, label: "R&D anchor (build-to-suit)" },
    agency: { units: 1, rent: 1.2, ip: 0, linked: false, tech: false, exit: 0, label: "Government agency" },
    agencyL: { units: 1, rent: 1.2, ip: 1 / 3, linked: true, tech: false, exit: 0, label: "Agency SME desk" },
    chem: { units: 2, rent: 2.0, ip: 0, linked: false, tech: false, exit: 0, label: "Chemicals firm" },
    chemC: { units: 2, rent: 1.5, ip: 0, linked: false, tech: false, exit: 0, label: "Chemicals firm (zero discharge)" },
  },
  STARTUP: { fee: 0.1, ip: 1, grad: 1 / 3, gradLab: 1 / 2, gradJV: 1 / 6, fail: 1 / 6, minAge: 12, maxAge: 36, gradIP: 3 },
  MIX: [["backoffice", 0.30], ["sme", 0.30], ["spinoff", 0.20], ["anchor", 0.05], ["startup", 0.15]],
  WAIT: 3,
  SEV: {
    mild: { w: 2, cap: 12, bo: 0.25, sme: 0, anc: 1 / 6, spin: 0, cut: 0.10, rate: 0.12, arr: 0.75, leaseDef: 0, label: "Mild" },
    severe: { w: 3, cap: 10, bo: 0.50, sme: 0.20, anc: 1 / 2, spin: 1 / 6, cut: 0.25, rate: 0.15, arr: 0.5, leaseDef: 1 / 3, label: "Severe" },
    crisis: { w: 1, cap: 8, bo: 0.75, sme: 0.34, anc: 2 / 3, spin: 1 / 6, cut: 0.40, rate: 0.20, arr: 0.35, leaseDef: 2 / 3, label: "Crisis" },
  },
  FLOOD: { month: 30, p: 0.5, repair: 1.5, lostMonths: 2 },
  PROG: { max: 6, ipPerCr: 1.2, label: "Innovation programmes" },
  RET: [0.5, 0.9],
  FCR_BANDS: [[1.3, 8], [1.0, 5], [0.8, 0]], FCR_LOW: -5, DRIFT_PEN: [[0.7, 10], [0.5, 5]],
  SCORE: { A: 25, B1: 10, B2: 10, B3: 15, C: 15, D: 15, E: 10, parkTarget: 250, fundIncomeTarget: 10 },
  MEDALS: { gold: 80, silver: 65, bronze: 50 },
  // ESG: a running score of environmental decisions. Part E = 10 x (esg - floor) / (target - floor), capped; Gold needs esg >= 0.
  ESG: { floor: -2, target: 6, clear: -3, buildWet: -1, buffer: 2, park: 2, retention: 1, drainage: 1, dcOffered: -2, dcCovenant: 0,
         siteF: -1, siteG: -1, chemT: -3, chemC: -1, spill: -2, solarT: 2, solarC: 1, cert: 2, certMin: 3, rain: 1, auditFail: -2, auditPass: 1, restore: 2 },
  // site rules for deals with a choice of plot: frontage premium, campus bonus, unserviced plots wait for road and power
  SITE: { frontage: 1.2, campusIP: 1, needSvc: ["road", "power"], svcThresh: 1, campusThresh: 1 },
};

/* ---------------------------------------------------------------- randomness */
function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
function U(seed, ...k) { return (hash(seed + "|" + k.join("|")) % 1000003) / 1000003; }
function D6(seed, ...k) { return 1 + Math.floor(U(seed, ...k) * 6); }

/* ---------------------------------------------------------------- the Deal Room */
const CARDS = {
  contractor: { phase: 1, title: "Contractor bulk deal", tone: "opportunity", site: { T: true, C: true },
    text: "A contractor offers two New Builds for 12 Cr at a fixed price, ready in 12 months, if you sign now.",
    T: "Sign for two New Builds (12 Cr; the fund pays 80% while it lasts).", C: "Ask for one building only, 6.5 Cr (the contractor accepts on 3–6).", L: "Decline.",
    dare: { T: 3, C: 2, L: 0 } },
  datacentre: { phase: 1, title: "Data-centre ground lease", tone: "opportunity", sdg: [7, 9], site: { C: true },
    text: "A data-centre operator wants a 30-year ground lease on a Highway Frontage plot. It will draw grid power around the clock.",
    T: "Lease as offered on Zone D: +1.5 Cr a year, 2 unlinked units, no energy conditions (−2 ESG); may default in a downturn.", C: "Lease a plot of your choice with a renewable-energy and research-use covenant: +1.0 Cr and +1 impact a year, linked. The operator accepts on 3–6; the plot changes the value.", L: "Keep the plot.",
    dare: { T: 1, C: 2, L: 0 } },
  donor: { phase: 1, title: "Donor offers equipment", tone: "opportunity",
    text: "An industrial donor offers prototyping equipment free of charge. The service contract is yours.",
    T: "Accept: 1.2 Cr upkeep a year; +1 impact a year while you have 2 or more linked tenants.", C: "Accept only if the donor pays the service contract to the end of Year 4 (donor agrees on 4–6).", L: "Decline.",
    dare: { T: 2, C: 1, L: 0 } },
  jv: { phase: 1, title: "Private incubator joint venture", tone: "opportunity",
    text: "A private accelerator will co-run incubation on its own premises and bring startups now. It wants to choose them.",
    T: "Accept as offered: +2 Cr and 3 startups now; they graduate half as often; in Year 4 the partner may exit with them.", C: "Accept with a joint selection panel: +1 Cr and 2 startups, normal graduation, no exit clause (partner agrees on 3–6).", L: "Decline.",
    dare: { T: 3, C: 2, L: 0 } },
  flood: { phase: 1, title: "Flood warning", tone: "threat", sdg: [11, 13],
    text: "Hydrologists warn that the low ground (Zones E and G) may flood in the middle of Year 3.",
    T: "Emergency drainage now: 1.5 Cr, protects Zones E and G for good.", C: "Buy flood insurance: 0.3 Cr a year, covers repairs.", L: "Take the risk.",
    dare: { T: 0, C: 1, L: 2 } },
  telecom: { phase: 1, title: "Telco fibre offer", tone: "opportunity",
    text: "A telco offers to lay fibre to every zone free of charge, in return for exclusivity and 5% of your rent.",
    T: "Accept: fibre everywhere in 2 months; 5% of rent to the telco from then on.", C: "Fibre to three zones with a road, no rent share (telco agrees on 3–6).", L: "Decline.",
    dare: { T: 1, C: 1, L: 0 } },
  inquiry: { phase: 1, title: "Anchor inquiry", tone: "opportunity", site: { T: true },
    text: "A multinational wants 6 units for an R&D centre in 12 months, if you start a New Build now.",
    T: "Start a New Build now (7 Cr, fund applies); the anchor pre-lets it, but may still withdraw (1 in 3).", C: "Offer 3 units in existing space when ready (needs a Lab or Lab Access; anchor agrees on 3–6).", L: "Decline.",
    dare: { T: 3, C: 1, L: 0 } },
  developer: { phase: 2, title: "Developer wants the reserve", tone: "opportunity", sdg: [11],
    text: "A property developer offers to lease two plots of the new University Reserve (Zone H).",
    T: "Lease two plots as offered: +1.5 Cr a year each, unlinked; may default in a downturn.", C: "Lease one plot with reversion and covenant: +1.2 Cr and +1 impact a year, linked (developer agrees on 3–6).", L: "Keep the land.",
    dare: { T: 1, C: 2, L: 0 } },
  bts: { phase: 2, title: "Anchor build-to-suit", tone: "opportunity",
    text: "An R&D anchor will rent a whole 6-unit building on Zone H if you build it, with exclusivity in its sector.",
    T: "Build it: 7 Cr from cash or loan; 4.0 Cr and +4 impact a year from completion; one linked admission a quarter.", C: "Offer 3 units in existing space, no exclusivity (needs a Lab or Lab Access; anchor agrees on 3–6).", L: "Decline.",
    dare: { T: 3, C: 2, L: 0 } },
  agency: { phase: 2, title: "Agency co-location", tone: "opportunity",
    text: "A government agency wants 3 units for five years. It never leaves and never haggles.",
    T: "Let 3 units: 1.2 Cr each a year, unlinked.", C: "Let 3 units if the agency runs an SME support desk: linked, +1 impact a year (agency agrees on 4–6).", L: "Decline.",
    dare: { T: 1, C: 1, L: 0 } },
  rector: { phase: 2, title: "Rector wants a share", tone: "threat",
    text: "The new rector asks the park to pay part of any surplus to the university.",
    T: "Accept: 20% of every monthly surplus.", C: "Negotiate a surplus rule: 10% on 3–6, 30% on 1–2.", L: "Refuse: the allocation stops and the relationship costs 2 impact.",
    dare: { T: 0, C: 1, L: 2 } },
  factory: { phase: 3, title: "Distressed factory", tone: "opportunity",
    text: "A neighbouring factory has closed. Its fully serviced building is for sale.",
    T: "Buy it: 3 Cr from cash or loan, 4 units ready in 3 months, upkeep 1.0 Cr a year.", C: "Buy it with a Tech SME signed to move in (seller agrees on 4–6).", L: "Decline.",
    dare: { T: 2, C: 1, L: 0 } },
  natlab: { phase: 3, title: "National lab relocation", tone: "opportunity", sdg: [9],
    text: "A national laboratory is relocating and needs a reserve plot next to a university.",
    T: "Offer your reserve plot in Zone H: +1.0 Cr and +3 impact a year, linked.", C: null, L: "Decline.",
    dare: { T: 1, C: 0, L: 0 } },
  holiday: { phase: 3, title: "Anchor asks for a rent holiday", tone: "threat",
    text: "Your anchor tenant is struggling and asks for a rent holiday until the downturn ends.",
    T: "Grant it: no rent from your anchors for the rest of the game, but they stay.", C: "Offer half rent: they stay on 3–6, leave on 1–2.", L: "Refuse: they leave on 1–4.",
    dare: { T: 0, C: 1, L: 2 } },
  restructure: { phase: 3, title: "Bank offers restructuring", tone: "opportunity",
    text: "Your bank offers to fix your loan rate at 10% for a 1 Cr fee.",
    T: "Pay 1 Cr and fix the rate.", C: null, L: "Decline.",
    dare: { T: 1, C: 0, L: 0 } },
  stimulus: { phase: 3, title: "Startup stimulus", tone: "opportunity", sdg: [8],
    text: "The government pays parks with an incubator to keep startups going through the downturn.",
    T: "Join: +0.5 Cr per startup now and one extra startup applicant a quarter.", C: null, L: "Decline.",
    dare: { T: 1, C: 0, L: 0 } },
  talent: { phase: 3, title: "Talent released", tone: "opportunity", sdg: [4, 8],
    text: "Closures have released experienced engineers who want to found companies.",
    T: "Fund a founders' programme: 1 Cr, three spin-off applicants now.", C: "Co-fund with the university: 0.5 Cr, two spin-off applicants (university agrees on 3–6).", L: "Decline.",
    dare: { T: 1, C: 1, L: 0 } },
  /* ---- ESG and SDG cards */
  solar: { phase: 1, title: "Solar canopy offer", tone: "opportunity", sdg: [7, 13],
    text: "An energy company offers solar canopies over the car parks and roofs of your buildings.",
    T: "Buy the system: 1.5 Cr; upkeep falls 0.3 Cr a year for good and ESG +2.", C: "Power-purchase agreement: no upfront cost, upkeep falls 0.1 Cr a year, ESG +1 (the company agrees on 3–6).", L: "Decline.",
    dare: { T: 1, C: 1, L: 0 } },
  chemical: { phase: 2, title: "Chemicals firm wants in", tone: "opportunity", sdg: [6, 12],
    text: "A speciality-chemicals firm offers the highest rent in the region for 2 units. Its process discharges to the creek.",
    T: "Let 2 units as offered: 2.0 Cr a year, unlinked, ESG −3, and a 1-in-6 chance each year of a spill (2 Cr fine, −2 ESG, −3 impact).", C: "Let 2 units with a zero-discharge covenant: 1.5 Cr a year, unlinked, ESG −1, no spill risk (the firm agrees on 4–6).", L: "Decline.",
    dare: { T: 3, C: 2, L: 0 } },
  greencert: { phase: 2, title: "Green park certification", tone: "opportunity", sdg: [9, 13],
    text: "A certification body offers to audit and certify the park as a green innovation district.",
    T: "Certify: 1 Cr and 0.2 Cr a year; ESG +2, and while ESG is 3 or more, one extra linked applicant a quarter.", C: null, L: "Decline.",
    dare: { T: 1, C: 0, L: 0 } },
  audit: { phase: 3, title: "Environmental audit", tone: "threat", sdg: [15, 16],
    text: "A community group has commissioned an environmental audit of the park. The result depends on your ESG record.",
    T: "Pass (ESG 2 or more): publish the report, 0.2 Cr, +2 impact and ESG +1. Fail: pay 1 Cr for restoration, ESG +2.", C: "Fail only: a joint restoration plan with the university, 0.5 Cr, ESG +2 (agreed on 3–6).", L: "Ignore it. If you fail: −3 impact and ESG −2.",
    dare: { T: 0, C: 1, L: 2 } },
  drought: { phase: 3, title: "Drought year", tone: "threat", sdg: [6, 13],
    text: "A dry year puts the region's water supply under stress. Parks without their own storage pay for tankered water.",
    T: "Rainwater harvesting: 0.8 Cr, ESG +1, immune now and later.", C: "Share a storage scheme with the university: 0.4 Cr, ESG +1 (agreed on 3–6).", L: "Pay the water surcharge: upkeep +0.4 Cr a year for 12 months (a retention park makes you immune).",
    dare: { T: 0, C: 1, L: 1 } },
};
const DECK = { 1: ["contractor", "datacentre", "donor", "jv", "flood", "telecom", "inquiry", "solar"], 2: ["developer", "bts", "agency", "rector", "chemical", "greencert"], 3: ["factory", "natlab", "holiday", "restructure", "stimulus", "talent", "audit", "drought"] };

/* ---------------------------------------------------------------- levels
 * rintis  (1) Open the gates: Zones A–C, 3 years, a generous fund that pays all capital, 5 friendly deals, no downturn.
 * bina    (2) Grow the park: adds the highway strip, the plateau and the reserve, 4 years, 12 deals, a forecast downturn.
 * lestari (3) The full game: all 8 zones including forest and wetland, 5 years, 15 deals, a secret downturn, ESG gate. */
const LEVELS = {
  rintis: { key: "rintis", n: 1, name: "Rintis", sub: "Open the gates", months: 36, zones: ["A", "B", "C"], fund: 20, fundShare: 1, fundEnd: 24, startCash: 5, apQ: 3,
    years: [[1, 2], [1, 2], [2, 1]], decks: { 1: ["telecom", "donor", "jv", "solar", "inquiry", "talent"], 2: ["agency", "rector", "stimulus", "greencert"] },
    dice: false, downturn: null, esgGate: false, coach: true,
    score: { A: 40, B1: 20, B2: 0, B3: 20, C: 20, D: 0, E: 0, parkTarget: 115, fundIncomeTarget: 8 }, medals: { gold: 80, silver: 65, bronze: 50 },
    labels: { B3: "Operations" } },
  bina: { key: "bina", n: 2, name: "Bina", sub: "Grow the park", months: 48, zones: ["A", "B", "C", "D", "E", "H"], fund: 30, fundShare: 0.8, fundEnd: 24, startCash: 5, apQ: 3,
    years: [[1, 3], [1, 3], [2, 3], [3, 3]], decks: { 1: ["contractor", "datacentre", "donor", "jv", "flood", "telecom", "inquiry", "solar"], 2: ["developer", "bts", "agency", "rector", "greencert"], 3: ["factory", "natlab", "holiday", "restructure", "stimulus", "talent"] },
    dice: true, downturn: { sevs: [["mild", 2], ["severe", 3]], startMin: 37, startSpan: 6, forecast: 6 }, esgGate: false, coach: true,
    score: { A: 30, B1: 10, B2: 10, B3: 15, C: 15, D: 15, E: 5, parkTarget: 170, fundIncomeTarget: 10 }, medals: { gold: 80, silver: 65, bronze: 50 },
    labels: {} },
  lestari: { key: "lestari", n: 3, name: "Lestari", sub: "Survive and sustain", months: 60, zones: ["A", "B", "C", "D", "E", "F", "G", "H"], fund: 30, fundShare: 0.8, fundEnd: 24, startCash: 5, apQ: 3,
    years: [[1, 3], [1, 3], [2, 3], [3, 3], [3, 3]], decks: DECK_FULL(), take: { 1: 6, 2: 3, 3: 6 },
    dice: true, downturn: { sevs: [["mild", 2], ["severe", 3], ["crisis", 1]], startMin: 37, startSpan: 6, forecast: 0 }, esgGate: true, coach: false,
    score: null, medals: null, labels: {} },
};
function DECK_FULL() { return { 1: ["contractor", "datacentre", "donor", "jv", "flood", "telecom", "inquiry", "solar"], 2: ["developer", "bts", "agency", "rector", "chemical", "greencert"], 3: ["factory", "natlab", "holiday", "restructure", "stimulus", "talent", "audit", "drought"] }; }
function levelOf(k) { const L = LEVELS[k] || LEVELS.lestari; return Object.assign({}, L, { score: L.score || CFG.SCORE, medals: L.medals || CFG.MEDALS }); }

const NAMES_A = ["Arus", "Beacon", "Cendana", "Delta", "Emerald", "Fusion", "Granit", "Helix", "Iris", "Jalur", "Kinetik", "Lumen", "Meridian", "Nadi", "Orbit", "Pelita", "Quanta", "Rimba", "Sinar", "Tera", "Unity", "Vektor", "Wira", "Xenon", "Yield", "Zenit"];
const NAMES_B = { backoffice: ["Shared Services", "Back Office", "Operations Hub", "Contact Centre"], sme: ["Robotics", "Analytics", "Sensors", "Systems", "Devices", "Automation"], spinoff: ["Bio", "Materials", "AgriTech", "MedTech", "Photonics", "Energy"], anchor: ["R&D Centre", "Innovation Lab", "Research Hub"], startup: ["Labs", "AI", "Health", "Mobility", "Foods", "Robotics"] };

/* ---------------------------------------------------------------- scenario */
function makeScenario(seed, level) {
  seed = String(seed); const lv = levelOf(level); const MONTHS = lv.months;
  const arrivals = {};
  for (let m = 1; m <= MONTHS; m++) {
    const u = U(seed, "arr", m); const n = u < 0.25 ? 0 : (u < 0.8 ? 1 : 2);
    arrivals[m] = [];
    for (let k = 0; k < n; k++) arrivals[m].push(applicant(seed, "a" + m + "-" + k, pickType(U(seed, "arrT", m, k)), m));
  }
  // event months: 3 a year, at least two months apart, never in month 1
  const events = []; const order = {};
  for (const ph in lv.decks) {
    const d = lv.decks[ph].slice(); d.sort((a, b) => U(seed, "deck", a) - U(seed, "deck", b)); order[ph] = d;
  }
  const used = {}; for (const ph in lv.decks) used[ph] = 0;
  const SLOTS = { 1: [[5, 8]], 2: [[3, 5], [8, 10]], 3: [[2, 4], [5, 8], [9, 12]] };
  lv.years.forEach(([ph, n], yi) => {
    const y = yi + 1, slots = SLOTS[n];
    for (let s = 0; s < n; s++) {
      const [lo, hi] = slots[s]; const mo = lo + Math.floor(U(seed, "evm", y, s) * (hi - lo + 1));
      const card = order[ph][used[ph]++]; if (!card || (lv.take && used[ph] > lv.take[ph])) continue;
      const m = (y - 1) * 12 + mo;
      events.push({ id: "e" + y + s, card, t: m - 1 + 0.45 + U(seed, "evd", y, s) * 0.1, month: m, phase: ph, deal: lv.dice ? D6(seed, "deal", y, s) : 6 });
    }
  });
  events.sort((a, b) => a.t - b.t);
  let downturn;
  if (lv.downturn) {
    const sr = U(seed, "sev"); const W = lv.downturn.sevs, tot = W.reduce((a, x) => a + x[1], 0); let acc = 0, sev = W[W.length - 1][0];
    for (const [k, w] of W) { acc += w / tot; if (sr < acc) { sev = k; break; } }
    const start = lv.downturn.startMin + Math.floor(U(seed, "dstart") * lv.downturn.startSpan);
    downturn = { start, sev, forecastAt: lv.downturn.forecast ? start - lv.downturn.forecast : null };
  } else downturn = { start: 9999, sev: "mild", none: true, forecastAt: null };
  return { seed, level: lv.key, lv, months: MONTHS, arrivals, events, downturn, flood: U(seed, "flood") < CFG.FLOOD.p, approvalLate: U(seed, "approval") < CFG.WORKS.clear.delayP,
           leaseDefaultU: U(seed, "leasedef"), jvExit: U(seed, "jvexit") < 0.5, inquiryWithdraw: U(seed, "inq") < 1 / 3 };
}
function pickType(u) { let a = 0; for (const [t, p] of CFG.MIX) { a += p; if (u < a) return t; } return "sme"; }
function applicant(seed, id, type, m) {
  const a = NAMES_A[Math.floor(U(seed, "nA", id) * NAMES_A.length)], bl = NAMES_B[type] || NAMES_B.sme;
  return { id, type, arrive: m, expire: m + CFG.WAIT - 1, name: a + " " + bl[Math.floor(U(seed, "nB", id) * bl.length)] };
}

/* ---------------------------------------------------------------- team state */
function newTeam(name, policy, lv) {
  lv = lv && lv.zones ? lv : levelOf(lv);
  const z = {};
  for (const k in CFG.ZONES) {
    const Z = CFG.ZONES[k];
    z[k] = { svc: Object.assign({}, Z.svc), works: [], plotsUsed: 0, mode: Z.forest ? "forest" : (Z.wet ? "wet" : "open"), protected: false, locked: !lv.zones.includes(k) };
  }
  const t = {
    name, policy: policy || "priority", level: lv.key, months: lv.months, cash: lv.startCash, fund: lv.fund, fund0: lv.fund, fundShare: lv.fundShare, fundEnd: lv.fundEnd, apQ: lv.apQ,
    fundUsed: 0, debt: 0, emerg: 0,
    ipv: 0, ipu: 0, ap: lv.apQ, apPenalty: 0, zones: z,
    buildings: [
      { id: "A1", zone: "A", kind: "block", label: "Rental block", units: 4, upkeep: 1.2, readyAt: 0, status: "ready" },
      { id: "B1", zone: "B", kind: "shed", label: "Shed 1", units: 0, upkeep: 0, readyAt: 0, status: "shed" },
      { id: "B2", zone: "B", kind: "shed", label: "Shed 2", units: 0, upkeep: 0, readyAt: 0, status: "shed" },
      { id: "B3", zone: "B", kind: "shed", label: "Shed 3", units: 0, upkeep: 0, readyAt: 0, status: "shed" },
    ],
    fac: {}, tenants: [
      { id: "i1", type: "backoffice", bid: "A1", since: 0, name: "Harbour Logistics Back Office" },
      { id: "i2", type: "backoffice", bid: "A1", since: 0, name: "Meridian Contact Centre" },
      { id: "i3", type: "backoffice", bid: "A1", since: 0, name: "Tera Shared Services" },
      { id: "i4", type: "sme", bid: "A1", since: 0, name: "Lumen Sensors" }],
    startups: [], applicants: [], leases: [], hplots: lv.zones.includes("H") ? [null, null, null, null] : [],
    flags: {}, decisions: {}, dlog: [], log: [], snap: {}, month: 0, bailouts: 0, bailP3: false, receiver: false, grads: 0, esg: 0, esgLog: [],
    seq: 0, lastNet: 0, netHist: [], cashHist: [], ipHist: [], pendingAnchor: null, jvStartups: 0,
  };
  t.snap.ci0 = committedIncome(t);
  return t;
}

/* ---------------------------------------------------------------- helpers */
const r1 = v => Math.round(v * 10) / 10;
function phaseOf(m) { return m <= 24 ? 1 : (m <= 36 ? 2 : 3); }
function inDownturn(sc, m) { return m >= sc.downturn.start; }
function bById(t, id) { return t.buildings.find(b => b.id === id); }
function svcOK(t, zone, tech) {
  if (zone === "X") return true;
  const s = t.zones[zone].svc; return s.road >= 1 && s.water >= 1 && s.power >= 1 && (!tech || s.fibre >= 1);
}
function usedUnits(t, b) {
  let u = 0; for (const x of t.tenants) if (x.bid === b.id) u += CFG.TEN[x.type].units;
  for (const k in t.fac) if (t.fac[k] && t.fac[k].bid === b.id) u += CFG.FAC[k].units;
  return u;
}
function freeUnits(t, b) { return b.status === "ready" ? b.units - usedUnits(t, b) : 0; }
function readyUnits(t) { return t.buildings.filter(b => b.status === "ready").reduce((a, b) => a + b.units, 0); }
function occUnits(t) { return t.buildings.filter(b => b.status === "ready").reduce((a, b) => a + usedUnits(t, b), 0); }
/* socio-economic indicators shown on the Impact tab and in the results: derived from the tenants, not scored (v0.5.4) */
const SOCIO = {
  // per let unit (or per startup / lease): jobs, student interns a year, annual output in Cr (wages, services and purchases, a multiple of rent), and the share of firms founded by alumni
  backoffice: { jobs: 14, interns: 0.5, out: 4, alumni: 0 }, sme: { jobs: 7, interns: 1.5, out: 3.5, alumni: 0.5 }, spinoff: { jobs: 5, interns: 2, out: 2.5, alumni: 1 },
  anchor: { jobs: 10, interns: 2, out: 5, alumni: 0 }, bigAnchor: { jobs: 10, interns: 2, out: 5, alumni: 0 }, agency: { jobs: 10, interns: 0.5, out: 2.5, alumni: 0 }, agencyL: { jobs: 8, interns: 1.5, out: 2.5, alumni: 0 },
  chem: { jobs: 12, interns: 0.5, out: 6, alumni: 0 }, chemC: { jobs: 12, interns: 1, out: 6, alumni: 0 },
  startup: { jobs: 3, interns: 1, out: 0.6, alumni: 0.7 }, lease: { jobs: 8, interns: 0, out: 8, alumni: 0 }, leaseC: { jobs: 8, interns: 1, out: 8, alumni: 0 },
  parkStaff: 6, mult: 1.6,   // park management staff; local multiplier on direct output for the economic-impact figure
};
function alumniFounded(id, p) { if (p >= 1) return true; if (p <= 0) return false; let h = 7; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 1000; return h / 1000 < p; }
function socio(t) {
  const S = SOCIO; let jobs = S.parkStaff, interns = 0, out = 0, firms = 0, alumni = 0, uniFirms = 0, uniOut = 0;
  const add = (k, n, id, linked) => { const c = S[k] || S.sme; jobs += c.jobs * n; interns += c.interns * n; out += c.out * n; firms++; const al = alumniFounded(id, c.alumni); if (al) alumni++; if (linked || al) { uniFirms++; uniOut += c.out * n; } };
  for (const x of t.tenants) { const T = CFG.TEN[x.type] || CFG.TEN.sme; add(x.type, T.units, x.id, T.linked || /graduate/.test(x.name || "")); }
  for (const s of t.startups) add("startup", 1, s.id, true);
  for (const l of t.leases) add(l.linked ? "leaseC" : "lease", 1, l.label, l.linked);
  for (const k in t.fac) if (t.fac[k]) jobs += 2;
  const econ = out * S.mult;
  return { jobs: Math.round(jobs), interns: Math.round(interns), output: r1(out), econ: r1(econ), firms, alumni, uniFirms, uniShare: firms ? uniFirms / firms : 0, uniOutShare: out ? uniOut / out : 0, graduates: t.tenants.filter(x => /graduate/.test(x.name || "")).length };
}
function occupancy(t) { const r = readyUnits(t); return r ? occUnits(t) / r : 1; }
function linkedCount(t) { return t.tenants.filter(x => CFG.TEN[x.type].linked).length; }
function hasLabLike(t) { return !!(t.fac.lab || t.fac.labaccess); }
function capUnits(t) { return t.buildings.filter(b => b.status === "ready" || b.status === "building").reduce((a, b) => a + b.units, 0); }
function tenantUnits(t) { return t.tenants.reduce((a, x) => a + CFG.TEN[x.type].units, 0); }
function driftOf(t, addUnl, addAll) {
  addUnl = addUnl || 0; addAll = addAll || 0;
  let unl = addUnl, all = addAll;
  for (const x of t.tenants) { const T = CFG.TEN[x.type]; all += T.units; if (!T.linked) unl += T.units; }
  for (const l of t.leases) { all += l.units; if (!l.linked) unl += l.units; }
  return all ? unl / all : 0;
}
function rentOf(t, x, m, sc) {
  const T = CFG.TEN[x.type]; let r = T.rent;
  const b = bById(t, x.bid);
  if (x.type === "backoffice" && b && b.zone === "D") r *= CFG.ZONES.D.boRent;
  if (sc && m && inDownturn(sc, m) && x.type !== "agency") r *= 1 - CFG.SEV[sc.downturn.sev].cut * (T.linked ? 0.5 : 1);
  if (x.reneg && m <= x.reneg) r *= 0.7;
  if ((x.type === "anchor" || x.type === "bigAnchor") && t.flags.holiday === "free") r = 0;
  if ((x.type === "anchor" || x.type === "bigAnchor") && t.flags.holiday === "half") r *= 0.5;
  if (x.noRentUntil && m <= x.noRentUntil) r = 0;
  return r;
}
function committedIncome(t) {
  let c = 0;
  for (const x of t.tenants) { const T = CFG.TEN[x.type]; const b = bById(t, x.bid); c += T.rent * (x.type === "backoffice" && b && b.zone === "D" ? CFG.ZONES.D.boRent : 1); }
  for (const l of t.leases) if (leaseActive(t, l)) c += l.income;
  return c;
}
function annualUpkeep(t, m) {
  let u = CFG.PARK_OFFICE;
  for (const b of t.buildings) { if (b.status === "ready") u += b.upkeep; if (b.leaseBack) u += b.leaseBack; }
  for (const k in t.fac) if (t.fac[k]) u += CFG.FAC[k].upkeep;
  if (t.flags.donor && m > (t.flags.donorFreeUntil || 0)) u += 1.2;
  if (t.flags.insured) u += 0.3;
  if (t.flags.solar) u -= t.flags.solar;
  if (t.flags.cert) u += 0.2;
  if (t.flags.droughtUntil && m <= t.flags.droughtUntil) u += 0.4;
  u += t.prog || 0;
  return u;
}
function rateOf(t, sc, m) { if (t.flags.fixedRate) return CFG.RATE; return inDownturn(sc, m) ? CFG.SEV[sc.downturn.sev].rate : CFG.RATE; }
function fcr(t, sc, m) {
  const need = annualUpkeep(t, m) + rateOf(t, sc, m) * t.debt + (CFG.EMERG) * t.emerg;
  return need > 0 ? committedIncome(t) / need : 9;
}
// credit crunch: during the downturn the bank lowers the total loan limit (existing loans are not called in)
function loanCap(t, sc, m) { return sc && m && inDownturn(sc, m) ? CFG.SEV[sc.downturn.sev].cap : CFG.LOAN_CAP; }
function headroom(t, sc, m) { return Math.max(0, loanCap(t, sc, m) - t.debt - t.emerg); }
function esg(t, m, delta, why) { if (!delta) return; t.esg = r1(t.esg + delta); t.esgLog.push({ m, d: delta, why }); note(t, m, "ESG " + (delta > 0 ? "+" : "") + delta + ": " + why + ".", delta > 0 ? "good" : "bad"); }
/* a ground lease on a plot without road and power pays nothing until the team services it */
function leaseActive(t, l) {
  if (!l.zone) return true; const s = t.zones[l.zone].svc;
  return CFG.SITE.needSvc.every(k => s[k] >= CFG.SITE.svcThresh);
}
/* zones where a plot can be offered to a counterparty (open land with a free plot) */
function siteOptions(t, m) {
  const out = [];
  for (const z of ["D", "C", "E", "H", "F", "G"]) {
    const Z = t.zones[z]; if (Z.locked || Z.mode !== "open") continue; if (z === "H" && m < CFG.ZONES.H.release) continue;
    if (plotsFree(t, z, m) > 0) out.push(z);
  }
  return out;
}
/* how a plot changes a ground lease: income multiplier, impact bonus, ESG cost, die threshold, whether income waits for services */
function siteTerms(t, zone, m, linked) {
  const s = t.zones[zone].svc; const serviced = CFG.SITE.needSvc.every(k => s[k] >= CFG.SITE.svcThresh);
  const T = { zone, mult: 1, ip: 0, esg: 0, thresh: 3, waits: !serviced, notes: [] };
  if (zone === "D") { T.mult = CFG.SITE.frontage; T.notes.push("frontage: income ×" + CFG.SITE.frontage); }
  if (zone === "C" && linked) { T.ip = CFG.SITE.campusIP; T.thresh += CFG.SITE.campusThresh; T.notes.push("campus edge: +" + CFG.SITE.campusIP + " impact a year, harder to agree (" + (T.thresh) + "–6)"); }
  if (zone === "F") { T.esg = CFG.ESG.siteF; T.notes.push("ridge site: ESG " + CFG.ESG.siteF); }
  if (zone === "G") { T.esg = CFG.ESG.siteG; T.thresh += 1; T.notes.push("former wetland: ESG " + CFG.ESG.siteG + ", harder to agree"); }
  if (!serviced) { T.thresh += 1; T.notes.push("no road and power yet: income starts when you service the zone; harder to agree"); }
  T.thresh = Math.max(2, Math.min(5, T.thresh));
  return T;
}
function note(t, m, text, kind) { t.log.push({ m, text, kind: kind || "info" }); if (t.log.length > 200) t.log.shift(); }

/* ---------------------------------------------------------------- orders */
// cost split: the fund pays 80% of capital while it lasts (Phase 1)
function capitalSplit(t, cost, m, capital) {
  if (!capital || m > (t.fundEnd || CFG.FUND_END) || t.fund <= 0) return { fund: 0, cash: cost };
  const f = Math.min(t.fund, (t.fundShare != null ? t.fundShare : CFG.FUND_SHARE) * cost); return { fund: f, cash: cost - f };
}
function worksOptions(t, zone, m) {
  const Z = t.zones[zone], opts = [];
  if (Z.locked) return opts;
  if (zone === "H" && m < CFG.ZONES.H.release) return opts;
  const busy = k => Z.works.some(w => w.kind === k || (k === "road" && w.kind === "roadHalf") || (k === "power" && w.kind === "powerShared"));
  if (Z.mode === "forest") { if (!busy("clear")) opts.push("clear"); return opts; }
  if (Z.mode === "wet") { if (!busy("retention")) opts.push("retention"); return opts; }
  if (Z.mode === "buffer" || Z.mode === "park") return opts;
  if (Z.svc.road < 1 && !busy("road")) opts.push(Z.svc.road === 0.5 ? "roadHalf" : "road");
  if (Z.svc.water < 1 && !busy("water")) opts.push("water");
  if (Z.svc.power < 1 && !busy("power")) opts.push(CFG.ADJ[zone].some(n => t.zones[n].svc.power >= 1) ? "powerShared" : "power");
  if (Z.svc.fibre < 1 && !busy("fibre")) opts.push("fibre");
  return opts;
}
function plotsFree(t, zone, m) {
  const Z = CFG.ZONES[zone]; if (!Z.plots || t.zones[zone].locked) return 0;
  if (zone === "H") { if (m < Z.release) return 0; return t.hplots.filter(p => p === null).length; }
  return Z.plots - t.zones[zone].plotsUsed;
}
function canBuildIn(t, zone, m) {
  const Z = t.zones[zone]; if (Z.locked) return false;
  if (zone === "H" && m < CFG.ZONES.H.release) return false;
  if (Z.mode === "forest" || Z.mode === "wet" || Z.mode === "buffer" || Z.mode === "park") return false;
  return Z.svc.road >= 0.5;
}
function gateMet(t) { return (readyUnits(t) > 0 && occupancy(t) >= CFG.SPEC.gateOcc) || t.tenants.some(x => x.type === "anchor" || x.type === "bigAnchor"); }
function findSpace(t, type, preferZone) {
  const T = CFG.TEN[type];
  const cands = t.buildings.filter(b => b.status === "ready" && svcOK(t, b.zone, T.tech) && freeUnits(t, b) >= T.units);
  if (!cands.length) return null;
  const score = b => (b.zone === preferZone ? -10 : 0) + (T.linked && b.zone === "C" ? -5 : 0) + (type === "backoffice" && b.zone === "D" ? -5 : 0) + b.units;
  cands.sort((a, b) => score(a) - score(b)); return cands[0];
}
function facSpace(t, kind) {
  const F = CFG.FAC[kind]; if (!F.units) return { bid: null };
  const cands = t.buildings.filter(b => b.status === "ready" && svcOK(t, b.zone, !!F.fibre) && freeUnits(t, b) >= F.units);
  if (!cands.length) return null;
  cands.sort((a, b) => (a.zone === "C" ? -1 : 0) - (b.zone === "C" ? -1 : 0)); return { bid: cands[0].id };
}
function admissionAllowed(t, type) {
  const T = CFG.TEN[type];
  if (type === "startup") return (t.fac.incubator ? CFG.FAC.incubator.cap : 0) + (t.flags.jv ? 3 : 0) > t.startups.length;
  if (type === "anchor" && !hasLabLike(t)) return false;
  if (T.linked && t.flags.exclusive && (t.flags.exclQ || 0) >= 1) return false;
  if (!T.linked) {
    if (t.policy === "linked") return false;
    if (t.policy === "priority") {
      let all = 0, unl = 0; for (const x of t.tenants) { const X = CFG.TEN[x.type]; all += X.units; if (!X.linked) unl += X.units; }
      if (unl + T.units > 0.5 * (all + T.units)) return false;
    }
  }
  return true;
}

/* validate returns {ok, why, ap, cost, cash, fund} without changing state */
function validate(t, sc, o, m) {
  if (t.receiver) return { ok: false, why: "The park is in receivership." };
  const ap = { work: 1, build: 1, facility: 1, policy: 1, reneg: 1, moth: 1, unmoth: 1, leaseback: 1, programme: 1 }[o.type] || 0;
  if (ap > t.ap) return { ok: false, why: "No action points left this quarter." };
  const need = (cost, capital) => { const s = capitalSplit(t, cost, m, capital); if (s.cash > t.cash + 1e-9) return { ok: false, why: "Not enough cash (" + r1(s.cash) + " Cr needed). Borrow first.", ap, cost, ...s }; return { ok: true, ap, cost, ...s }; };
  switch (o.type) {
    case "work": {
      if (!t.zones[o.zone] || t.zones[o.zone].locked) return { ok: false, why: "This zone is not part of this level." };
      const opts = worksOptions(t, o.zone, m); if (!opts.includes(o.kind)) return { ok: false, why: "That work is not available in this zone now." };
      return need(CFG.WORKS[o.kind].cost, true);
    }
    case "build": {
      const B = CFG.BUILD[o.kind];
      if (o.kind === "retrofit") { const b = bById(t, o.bid); if (!b || b.status !== "shed") return { ok: false, why: "Choose a shed to retrofit." }; return need(B.cost, true); }
      if (!canBuildIn(t, o.zone, m)) return { ok: false, why: "This zone needs a road (and clearance or retention works) before building." };
      if (plotsFree(t, o.zone, m) < 1) return { ok: false, why: "No free plot in this zone." };
      return need(B.cost, true);
    }
    case "facility": {
      if (t.fac[o.kind]) return { ok: false, why: "Already running." };
      if (o.kind === "incubator" && t.flags.jv) { /* allowed */ }
      if (CFG.FAC[o.kind].units && !facSpace(t, o.kind)) return { ok: false, why: "Needs a free unit in a ready building with fibre." };
      return need(CFG.FAC[o.kind].cost, true);
    }
    case "admit": {
      const a = t.applicants.find(x => x.id === o.aid); if (!a) return { ok: false, why: "That applicant has gone." };
      if (!admissionAllowed(t, a.type)) return { ok: false, why: a.type === "startup" ? "No free incubator place." : (a.type === "anchor" && !hasLabLike(t) ? "An anchor needs a Lab or Lab Access." : "Your admission policy does not allow this applicant.") };
      if (a.type !== "startup" && !findSpace(t, a.type)) return { ok: false, why: CFG.TEN[a.type].tech ? "No free unit with road, water, power and fibre." : "No free unit with road, water and power." };
      return { ok: true, ap: 0, cost: 0, cash: 0, fund: 0 };
    }
    case "reserve": if (m < CFG.ZONES.H.release || m > CFG.ZONES.H.signBy || !t.hplots.includes(null)) return { ok: false, why: "No unsigned Zone H plot." }; return { ok: true, ap: 0, cost: 0, cash: 0, fund: 0 };
    case "declare": {
      const Z = t.zones[o.zone]; if (!Z || Z.locked) return { ok: false, why: "This zone is not part of this level." };
      if (o.zone === "F" && Z.mode === "forest") return { ok: true, ap: 0, cost: 0, cash: 0, fund: 0 };
      if (o.zone === "G" && Z.mode === "open" && Z.protected && Z.plotsUsed === 0) return { ok: true, ap: 0, cost: 0, cash: 0, fund: 0 };
      return { ok: false, why: o.zone === "G" ? "Finish the retention works first; then the wetland can become a park." : "Only the untouched forest can be declared a green buffer." };
    }
    case "loan": if (!(o.amount > 0) || o.amount > headroom(t, sc, m) + 1e-9) return { ok: false, why: "Loan limit is " + loanCap(t, sc, m) + " Cr in total" + (inDownturn(sc, m) ? " during the downturn" : "") + "." }; return { ok: true, ap: 0, cost: 0, cash: 0, fund: 0 };
    case "repay": if (!(o.amount > 0) || o.amount > t.cash || o.amount > t.debt + t.emerg + 1e-9) return { ok: false, why: "Cannot repay that amount." }; return { ok: true, ap: 0, cost: 0, cash: 0, fund: 0 };
    case "policy": if (o.policy === t.policy) return { ok: false, why: "That is already your policy." }; return { ok: true, ap: 1, cost: 0, cash: 0, fund: 0 };
    case "reneg": if (!inDownturn(sc, m)) return { ok: false, why: "Only during the downturn." }; if (!t.tenants.some(x => x.type === "backoffice")) return { ok: false, why: "No back-office tenants." }; return { ok: true, ap: 1, cost: 0, cash: 0, fund: 0 };
    case "moth": { const b = bById(t, o.bid); if (!b || b.status !== "ready" || usedUnits(t, b) > 0) return { ok: false, why: "Only an empty, ready building can be mothballed." }; return { ok: true, ap: 1, cost: 0, cash: 0, fund: 0 }; }
    case "unmoth": { const b = bById(t, o.bid); if (!b || b.status !== "moth") return { ok: false, why: "Not mothballed." }; return need(1, false); }
    case "leaseback": { const b = bById(t, o.bid); if (!b || b.leaseBack || !(b.kind === "newbuild" || b.kind === "modular") || b.status === "building") return { ok: false, why: "Only a finished New Build or Modular block can be sold and leased back." }; return { ok: true, ap: 1, cost: 0, cash: 0, fund: 0 }; }
    case "cancel": if (!t.fac[o.kind]) return { ok: false, why: "Not running." }; return { ok: true, ap: 0, cost: 0, cash: 0, fund: 0 };
    case "programme": if (!(o.level >= 0 && o.level <= CFG.PROG.max) || o.level === (t.prog || 0)) return { ok: false, why: "Choose a new level from 0 to " + CFG.PROG.max + " Cr a year." }; return { ok: true, ap: 1, cost: 0, cash: 0, fund: 0 };
  }
  return { ok: false, why: "Unknown order." };
}

function applyOrder(t, sc, o, m) {
  const v = validate(t, sc, o, m);
  if (!v.ok) { note(t, m, "Order refused: " + v.why, "warn"); return false; }
  t.ap -= v.ap || 0;
  if (v.fund) { t.fund -= v.fund; t.fundUsed += v.fund; }
  if (v.cash) t.cash -= v.cash;
  switch (o.type) {
    case "work": {
      const W = CFG.WORKS[o.kind]; let months = W.months;
      if (o.kind === "clear" && sc.approvalLate) months += W.delay;
      t.zones[o.zone].works.push({ kind: o.kind, doneAt: m + months - 1, startAt: m });
      if (o.kind === "clear") esg(t, m, CFG.ESG.clear, "forest clearance on the ridge");
      note(t, m, W.label + " started in Zone " + o.zone + (o.kind === "clear" && sc.approvalLate ? " (approval delayed 3 months)" : "") + "; done end of " + monthName(m + months - 1) + ".");
      break;
    }
    case "build": {
      const B = CFG.BUILD[o.kind];
      if (o.kind === "retrofit") {
        const b = bById(t, o.bid); b.status = "building"; b.kind = "retrofit"; b.units = B.units; b.upkeep = B.upkeep; b.readyAt = m + B.months - 1; b.startAt = m; b.label = "Workshop " + b.id;
        note(t, m, "Retrofit of " + b.id + " started; ready end of " + monthName(b.readyAt) + "."); break;
      }
      let months = B.months, extra = 0; const spec = !gateMet(t);
      const u = U(sc.seed, "build", t.name, m, t.seq);
      if (spec && u < CFG.SPEC.overrunP) { months += CFG.SPEC.overrunMonths; extra = CFG.SPEC.overrunCost; }
      else if (!spec && u < CFG.SPEC.gateDelayP) months += CFG.SPEC.overrunMonths;
      if (extra) { t.cash -= extra; }
      const id = o.zone + (t.buildings.filter(b => b.zone === o.zone).length + 1);
      t.buildings.push({ id, zone: o.zone, kind: o.kind, label: B.label + " " + id, units: B.units, upkeep: B.upkeep, readyAt: m + months - 1, startAt: m, status: "building", spec });
      if (o.zone === "H") t.hplots[t.hplots.indexOf(null)] = "build"; else t.zones[o.zone].plotsUsed++;
      if (o.zone === "G") esg(t, m, CFG.ESG.buildWet, "building on the former wetland");
      note(t, m, B.label + " " + id + " started" + (spec ? " (speculative: no demand gate)" : "") + (extra ? "; overrun +" + extra + " Cr" : "") + "; ready end of " + monthName(m + months - 1) + ".", spec ? "warn" : "info");
      break;
    }
    case "facility": { const s = facSpace(t, o.kind); t.fac[o.kind] = { bid: s ? s.bid : null, since: m }; note(t, m, CFG.FAC[o.kind].label + " launched."); break; }
    case "admit": {
      const a = t.applicants.find(x => x.id === o.aid); t.applicants = t.applicants.filter(x => x.id !== o.aid);
      if (a.type === "startup") { t.startups.push({ id: a.id, name: a.name, since: m }); note(t, m, a.name + " joined the incubator."); }
      else {
        const b = findSpace(t, a.type); t.tenants.push({ id: a.id, type: a.type, bid: b.id, since: m, name: a.name });
        if (CFG.TEN[a.type].linked && t.flags.exclusive) t.flags.exclQ = (t.flags.exclQ || 0) + 1;
        note(t, m, a.name + " (" + CFG.TEN[a.type].label + ") moved into " + b.id + ".");
      }
      break;
    }
    case "reserve": { t.hplots[t.hplots.indexOf(null)] = "reserve"; note(t, m, "A Zone H plot was reserved for a named future user."); break; }
    case "declare": {
      const Z = t.zones[o.zone];
      if (o.zone === "F") { Z.mode = "buffer"; note(t, m, "Forest Ridge declared a green buffer (+1 impact a year)."); esg(t, m, CFG.ESG.buffer, "green buffer kept on the ridge"); }
      else { Z.mode = "park"; note(t, m, "Wetland made a retention park (+1 impact a year)."); esg(t, m, CFG.ESG.park, "wetland kept as a retention park"); }
      break;
    }
    case "loan": t.debt += o.amount; t.cash += o.amount; note(t, m, "Borrowed " + o.amount + " Cr."); break;
    case "repay": { let a = o.amount; const e = Math.min(a, t.emerg); t.emerg -= e; a -= e; t.debt -= a; t.cash -= o.amount; note(t, m, "Repaid " + o.amount + " Cr."); break; }
    case "policy": t.policy = o.policy; t.ipv -= 2; note(t, m, "Admission policy changed to " + o.policy + " (−2 impact).", "warn"); break;
    case "reneg": for (const x of t.tenants) if (x.type === "backoffice") x.reneg = m + 11; t.flags.renegUntil = m + 11; note(t, m, "Back-office rents renegotiated to 70% for 12 months."); break;
    case "moth": { const b = bById(t, o.bid); b.status = "moth"; note(t, m, b.id + " mothballed."); break; }
    case "unmoth": { const b = bById(t, o.bid); b.status = "ready"; note(t, m, b.id + " reopened."); break; }
    case "leaseback": { const b = bById(t, o.bid); const p = b.kind === "newbuild" ? 5 : 3; b.leaseBack = b.kind === "newbuild" ? 0.7 : 0.4; t.cash += p; note(t, m, b.id + " sold for " + p + " Cr and leased back."); break; }
    case "cancel": { const f = t.fac[o.kind]; delete t.fac[o.kind]; note(t, m, CFG.FAC[o.kind].label + " closed.", "warn"); break; }
    case "programme": t.prog = o.level; note(t, m, "Innovation programme budget set to " + o.level + " Cr a year."); break;
  }
  t.seq++;
  return true;
}

/* ---------------------------------------------------------------- events */
function eligible(card, t, m) {
  switch (card) {
    case "contractor": return plotsAvailableForBuild(t, m) >= 1;
    case "datacentre": return plotsFree(t, "D", m) >= 1 || siteOptions(t, m).length > 0;
    case "chemical": return !!findSpace(t, "chem");
    case "flood": return !(t.zones.E.locked && t.zones.G.locked);
    case "greencert": return true;
    case "audit": return true;
    case "drought": return true;
    case "inquiry": return plotsAvailableForBuild(t, m) >= 1;
    case "developer": return t.hplots.includes(null);
    case "bts": return t.hplots.includes(null) || hasLabLike(t);
    case "natlab": return t.hplots.includes("reserve");
    case "holiday": return t.tenants.some(x => x.type === "anchor" || x.type === "bigAnchor");
    case "stimulus": return !!(t.fac.incubator || t.flags.jv);
    default: return true;
  }
}
function plotsAvailableForBuild(t, m) { let n = 0; for (const z of ["C", "D", "E", "F", "G", "H"]) if (canBuildIn(t, z, m)) n += plotsFree(t, z, m); return n; }
function bestBuildZone(t, m) {
  const order = ["C", "E", "D", "H", "G", "F"].filter(z => canBuildIn(t, z, m) && plotsFree(t, z, m) > 0);
  order.sort((a, b) => svcScore(t, b) - svcScore(t, a)); return order[0] || null;
}
function svcScore(t, z) { const s = t.zones[z].svc; return s.road + s.water + s.power + s.fibre; }
function sound(card, opt, t, m) {
  switch (card) {
    case "contractor": return opt !== "T" || (occupancy(t) >= CFG.SPEC.gateOcc && t.fund >= 9.6);
    case "datacentre": return opt === "L" || (opt === "C" ? true : (driftOf(t, 2, 2) <= 0.5 && plotsFree(t, "D", m) >= 1 && t.esg + CFG.ESG.dcOffered >= 0));
    case "chemical": return opt !== "T" && (opt !== "C" || (driftOf(t, 2, 2) <= 0.5 && t.esg + CFG.ESG.chemC >= 0));
    case "greencert": return opt === "T" ? t.cash >= 2 : t.cash < 2;
    case "audit": return t.esg >= 2 ? true : opt !== "L";
    case "drought": return opt !== "L" || t.zones.G.mode === "park";
    case "donor": return (opt !== "T" || linkedCount(t) >= 2) && (opt !== "C" || linkedCount(t) >= 1);
    case "jv": return opt !== "T";
    case "flood": return opt !== "L" || !t.buildings.some(b => (b.zone === "E" || b.zone === "G") && b.status !== "shed");
    case "developer": return opt !== "T" || driftOf(t, 4, 4) <= 0.5;
    case "bts": return opt !== "T" || 6 / (capUnits(t) + 6) <= 0.4;
    case "agency": return opt !== "T" || driftOf(t, 3, 3) <= 0.5;
    case "rector": return opt !== "L";
    case "factory": return opt !== "T" || occupancy(t) >= CFG.SPEC.gateOcc;
    case "natlab": return opt !== "L";
    case "holiday": { const rent = t.tenants.filter(x => x.type === "anchor" || x.type === "bigAnchor").reduce((a, x) => a + CFG.TEN[x.type].rent, 0); return opt !== "L" || rent <= 0.3 * Math.max(0.1, committedIncome(t)); }
    case "restructure": return (opt === "T") === (t.debt + t.emerg >= 5);
    case "stimulus": return opt !== "L";
    default: return true;
  }
}
function applyEvent(t, sc, ev, opt, m) {
  const card = ev.card, C = CARDS[card];
  let site = null; if (opt && typeof opt === "object") { site = opt.zone || null; opt = opt.opt; }
  if (!eligible(card, t, m)) { t.dlog.push({ eid: ev.id, card, opt: null, eligible: false }); note(t, m, C.title + ": does not apply to your park."); return; }
  if (!opt || (opt === "C" && !C.C)) opt = opt === "C" ? "L" : (opt || "L");
  if (!(C.site && C.site[opt]) || !site || !t.zones[site]) site = null;
  const s = sound(card, opt, t, m);
  // leaving an opportunity when a sound way to engage existed earns half credit: a missed chance, not a mistake
  const missed = s && opt === "L" && C.tone === "opportunity" && (sound(card, "T", t, m) || (C.C && sound(card, "C", t, m)));
  t.dlog.push({ eid: ev.id, card, opt, site, sound: s, credit: s ? (missed ? 0.5 : 1) : 0, dare: C.dare[opt] || 0, eligible: true });
  const die = ev.deal, ok3 = die >= 3, ok4 = die >= 4;
  const say = txt => note(t, m, C.title + ": " + txt, "event");
  const payCap = cost => { const sp = capitalSplit(t, cost, m, true); t.fund -= sp.fund; t.fundUsed += sp.fund; t.cash -= sp.cash; };
  const pickZone = () => (site && canBuildIn(t, site, m) && plotsFree(t, site, m) > 0) ? site : bestBuildZone(t, m);
  const startBuild = (zone, kind, months, preLet) => {
    const B = CFG.BUILD[kind]; const id = zone + (t.buildings.filter(b => b.zone === zone).length + 1);
    t.buildings.push({ id, zone, kind, label: B.label + " " + id, units: B.units, upkeep: B.upkeep, readyAt: m + months - 1, startAt: m, status: "building", preLet });
    if (zone === "H") t.hplots[t.hplots.indexOf(null)] = "build"; else if (zone !== "X") t.zones[zone].plotsUsed++;
    return id;
  };
  switch (card) {
    case "contractor":
      if (opt === "T") { payCap(12); for (let i = 0; i < 2; i++) { const z = pickZone(); if (z) startBuild(z, "newbuild", 12); } say("two New Builds under way" + (site ? " in Zone " + site : "") + "."); }
      else if (opt === "C") { if (ok3) { payCap(6.5); const z = pickZone(); if (z) startBuild(z, "newbuild", 12); say("one New Build under way" + (z ? " in Zone " + z : "") + "."); } else say("the contractor walked away."); }
      break;
    case "datacentre":
      if (opt === "T") { if (plotsFree(t, "D", m) < 1) { say("no free plot on Zone D: the operator went elsewhere."); break; } t.zones.D.plotsUsed++; t.leases.push({ kind: "dc", label: "Data-centre lease (D)", income: 1.5, linked: false, units: 2, ip: 0, crisis: true }); esg(t, m, CFG.ESG.dcOffered, "data centre on grid power, no conditions"); say("lease signed as offered."); }
      else if (opt === "C") {
        const opts = siteOptions(t, m); const z = site && opts.includes(site) ? site : (opts.includes("D") ? "D" : opts[0]);
        if (!z) { say("no plot to offer."); break; }
        const ST = siteTerms(t, z, m, true);
        if (die >= ST.thresh) {
          if (z === "H") t.hplots[t.hplots.indexOf(null)] = "leaseC"; else t.zones[z].plotsUsed++;
          t.leases.push({ kind: "dcC", label: "Data-centre lease with covenant (" + z + ")", income: r1(1.0 * ST.mult), linked: true, units: 2, ip: 1 + ST.ip, crisis: false, zone: z });
          if (ST.esg) esg(t, m, ST.esg, "data centre sited on Zone " + z);
          say("lease signed with conditions on Zone " + z + (ST.waits ? "; income starts once the zone has road and power." : "."));
        } else say("the operator declined the plot on Zone " + z + " (needed " + ST.thresh + "–6).");
      }
      break;
    case "donor":
      if (opt === "T") { t.flags.donor = true; t.flags.donorFreeUntil = m - 1; say("equipment accepted."); }
      else if (opt === "C") { if (ok4) { t.flags.donor = true; t.flags.donorFreeUntil = 48; say("equipment accepted; donor pays the service contract to the end of Year 4."); } else say("the donor declined the condition."); }
      break;
    case "jv":
      if (opt === "T") { t.cash += 2; t.flags.jv = "offered"; for (let i = 0; i < 3; i++) t.startups.push({ id: ev.id + "s" + i, name: "JV startup " + (i + 1), since: m, jv: true }); say("+2 Cr and 3 startups."); }
      else if (opt === "C") { if (ok3) { t.cash += 1; t.flags.jv = "cond"; for (let i = 0; i < 2; i++) t.startups.push({ id: ev.id + "s" + i, name: "JV startup " + (i + 1), since: m }); say("+1 Cr and 2 startups, joint selection."); } else say("the partner declined joint selection."); }
      break;
    case "flood":
      if (opt === "T") { t.cash -= 1.5; t.zones.E.protected = true; t.zones.G.protected = true; say("drainage built; Zones E and G protected."); esg(t, m, CFG.ESG.drainage, "drainage protects the low ground"); }
      else if (opt === "C") { t.flags.insured = true; say("insurance bought (0.3 Cr a year)."); }
      break;
    case "telecom":
      if (opt === "T") { for (const z in t.zones) if (t.zones[z].svc.fibre < 1) t.zones[z].works.push({ kind: "fibre", doneAt: m + 1, startAt: m }); t.flags.telco = true; say("fibre coming to every zone; 5% of rent to the telco."); }
      else if (opt === "C") { if (ok3) { let n = 0; for (const z of ["B", "C", "D", "E", "H", "F", "G"]) if (n < 3 && t.zones[z].svc.fibre < 1 && t.zones[z].svc.road >= 0.5) { t.zones[z].works.push({ kind: "fibre", doneAt: m + 1, startAt: m }); n++; } say("fibre coming to " + n + " zones."); } else say("the telco declined."); }
      break;
    case "inquiry":
      if (opt === "T") { payCap(7); const z = pickZone(); if (z) { const id = startBuild(z, "newbuild", 12, !sc.inquiryWithdraw); say("New Build " + id + " started for the anchor."); } }
      else if (opt === "C") { if (ok3) { t.pendingAnchor = { type: "anchor", until: m + 12 }; say("the anchor will take 3 units when space is ready."); } else say("the anchor declined."); }
      break;
    case "developer":
      if (opt === "T") { for (let i = 0; i < 2 && t.hplots.includes(null); i++) { t.hplots[t.hplots.indexOf(null)] = "lease"; t.leases.push({ kind: "dev", label: "Developer ground lease (H)", income: 1.5, linked: false, units: 2, ip: 0, crisis: true }); } say("plots leased as offered."); }
      else if (opt === "C") { if (ok3 && t.hplots.includes(null)) { t.hplots[t.hplots.indexOf(null)] = "leaseC"; t.leases.push({ kind: "devC", label: "Conditional ground lease (H)", income: 1.2, linked: true, units: 2, ip: 1, crisis: false }); say("one plot leased with conditions."); } else say("the developer declined."); }
      break;
    case "bts":
      if (opt === "T") { if (t.hplots.includes(null)) { t.cash -= 7; startBuild("H", "newbuild", 12, true); t.flags.exclusive = true; say("build-to-suit started on Zone H."); } }
      else if (opt === "C") { if (ok3 && hasLabLike(t)) { t.pendingAnchor = { type: "anchor", until: m + 12 }; say("the anchor will take 3 units when space is ready."); } else say("the anchor declined."); }
      break;
    case "agency": {
      const kind = opt === "T" ? "agency" : (opt === "C" && ok4 ? "agencyL" : null);
      if (kind) { let n = 0; for (let i = 0; i < 3; i++) { const b = findSpace(t, kind); if (!b) break; t.tenants.push({ id: ev.id + "g" + i, type: kind, bid: b.id, since: m, name: "Agency office " + (i + 1) }); n++; } say(n + " agency units let" + (n < 3 ? " (not enough serviced space for all 3)" : "") + "."); }
      else if (opt === "C") say("the agency declined the SME desk.");
      break;
    }
    case "rector":
      if (opt === "T") { t.flags.share = 0.2; say("20% of surplus to the university."); }
      else if (opt === "C") { t.flags.share = ok3 ? 0.1 : 0.3; say((ok3 ? "10%" : "30%") + " of surplus agreed."); }
      else { t.flags.allocStop = true; t.ipv -= 2; say("refused; the allocation stops."); }
      break;
    case "factory":
      if (opt === "T" || (opt === "C" && ok4)) { t.cash -= 3; const id = startBuild("X", "factory", 3); if (opt === "C") bById(t, id).smeOnReady = true; say("factory bought; ready in 3 months."); }
      else if (opt === "C") say("the seller declined.");
      break;
    case "natlab":
      if (opt === "T") { t.hplots[t.hplots.indexOf("reserve")] = "natlab"; t.leases.push({ kind: "natlab", label: "National lab (H)", income: 1.0, linked: true, units: 2, ip: 3, crisis: false }); say("the national lab is coming to Zone H."); }
      break;
    case "holiday":
      if (opt === "T") { t.flags.holiday = "free"; say("rent holiday granted."); }
      else if (opt === "C") { if (ok3) { t.flags.holiday = "half"; say("anchors stay at half rent."); } else { t.tenants = t.tenants.filter(x => !(x.type === "anchor" || x.type === "bigAnchor")); say("the anchors left."); } }
      else { if (U(sc.seed, "holiday", t.name) < 2 / 3) { t.tenants = t.tenants.filter(x => !(x.type === "anchor" || x.type === "bigAnchor")); say("refused; the anchors left."); } else say("refused; the anchors stayed."); }
      break;
    case "restructure": if (opt === "T") { t.cash -= 1; t.flags.fixedRate = true; say("rate fixed at 10%."); } break;
    case "stimulus": if (opt === "T") { t.cash += 0.5 * t.startups.length; t.flags.stimulus = true; say("+" + r1(0.5 * t.startups.length) + " Cr; an extra startup applicant each quarter."); } break;
    case "solar":
      if (opt === "T") { t.cash -= 1.5; t.flags.solar = 0.3; esg(t, m, CFG.ESG.solarT, "solar canopies bought"); say("solar canopies installed; upkeep −0.3 Cr a year."); }
      else if (opt === "C") { if (ok3) { t.flags.solar = 0.1; esg(t, m, CFG.ESG.solarC, "solar power-purchase agreement"); say("PPA signed; upkeep −0.1 Cr a year."); } else say("the company declined."); }
      break;
    case "chemical": {
      const kind = opt === "T" ? "chem" : (opt === "C" && ok4 ? "chemC" : null);
      if (kind) { const b = findSpace(t, kind); if (b) { t.tenants.push({ id: ev.id + "ch", type: kind, bid: b.id, since: m, name: "Kimia Speciality Chemicals" }); esg(t, m, kind === "chem" ? CFG.ESG.chemT : CFG.ESG.chemC, kind === "chem" ? "chemicals firm discharging to the creek" : "chemicals firm under a zero-discharge covenant"); say("the firm moved into " + b.id + "."); } else say("no serviced 2-unit space free."); }
      else if (opt === "C") say("the firm refused the covenant.");
      break;
    }
    case "greencert": if (opt === "T") { t.cash -= 1; t.flags.cert = true; esg(t, m, CFG.ESG.cert, "park certified green"); say("certified."); } break;
    case "audit": {
      const pass = t.esg >= 2;
      if (pass) { if (opt === "T") { t.cash -= 0.2; t.ipv += 2; esg(t, m, CFG.ESG.auditPass, "audit passed and published"); say("passed; report published (+2 impact)."); } else say("passed; nothing published."); }
      else if (opt === "T") { t.cash -= 1; esg(t, m, CFG.ESG.restore, "restoration works after the audit"); say("failed; restoration paid."); }
      else if (opt === "C") { if (ok3) { t.cash -= 0.5; esg(t, m, CFG.ESG.restore, "joint restoration plan"); say("failed; joint plan agreed."); } else { t.ipv -= 3; esg(t, m, CFG.ESG.auditFail, "audit failure ignored"); say("failed; the university declined the plan (−3 impact)."); } }
      else { t.ipv -= 3; esg(t, m, CFG.ESG.auditFail, "audit failure ignored"); say("failed and ignored (−3 impact)."); }
      break;
    }
    case "drought":
      if (opt === "T") { t.cash -= 0.8; t.flags.rain = true; esg(t, m, CFG.ESG.rain, "rainwater harvesting"); say("storage built."); }
      else if (opt === "C") { if (ok3) { t.cash -= 0.4; t.flags.rain = true; esg(t, m, CFG.ESG.rain, "shared water storage"); say("shared scheme agreed."); } else { if (t.zones.G.mode !== "park") t.flags.droughtUntil = m + 11; say("the university declined; " + (t.zones.G.mode === "park" ? "your retention park covers you." : "water surcharge for 12 months.")); } }
      else { if (t.zones.G.mode !== "park" && !t.flags.rain) { t.flags.droughtUntil = m + 11; say("water surcharge for 12 months."); } else say("your storage covers you."); }
      break;
    case "talent": {
      const n = opt === "T" ? 3 : (opt === "C" && ok3 ? 2 : 0);
      if (opt === "T") t.cash -= 1; else if (opt === "C" && ok3) t.cash -= 0.5;
      for (let i = 0; i < n; i++) t.applicants.push({ id: ev.id + "t" + i, type: "spinoff", arrive: m, expire: m + CFG.WAIT - 1, name: NAMES_A[(i * 7 + m) % NAMES_A.length] + " " + NAMES_B.spinoff[i % 6] });
      if (opt !== "L") say(n ? n + " spin-off applicants." : "the university declined.");
      break;
    }
  }
}

/* this month's money at annual rates (Cr a year) and the month's net result (Cr) */
function money(t, sc, m) {
  const S = inDownturn(sc, m) ? CFG.SEV[sc.downturn.sev] : null;
  let rent = 0; for (const x of t.tenants) rent += rentOf(t, x, m, sc);
  const telco = t.flags.telco ? 0.05 * rent : 0; rent -= telco;
  const lease = t.leases.reduce((a, l) => a + (leaseActive(t, l) ? l.income : 0), 0);
  const lin = linkedCount(t);
  let facInc = 0; if (t.fac.lab) facInc += Math.min(2.0, 0.4 * lin); facInc += CFG.STARTUP.fee * t.startups.length;
  if (t.fac.services) facInc += 0.15 * t.tenants.length;
  const y = Math.ceil(m / 12); const alloc = t.flags.allocStop ? 0 : (CFG.ALLOC_YR[y - 1] || 0);
  const upkeep = annualUpkeep(t, m);
  const interest = rateOf(t, sc, m) * t.debt + (S ? CFG.EMERG_P3 : CFG.EMERG) * t.emerg;
  let net = (rent + lease + facInc + alloc - upkeep - interest) / 12, share = 0;
  if (net > 0 && t.flags.share) { share = t.flags.share * net; net -= share; }
  return { rent, telco, lease, facInc, alloc, upkeep, interest, share: share * 12, net };
}

/* ---------------------------------------------------------------- months */
function startMonth(t, sc, m) {
  if (m > 1 && (m - 1) % 12 === 0) { t.socioLog = t.socioLog || []; t.socioLog.push(Object.assign({ m: m - 1 }, socio(t))); }
  t.month = m;
  if ((m - 1) % 3 === 0) { t.ap = (t.apQ || CFG.AP_Q) + (t.fac.mgmt ? 1 : 0) - t.apPenalty; t.apPenalty = 0; t.flags.exclQ = 0; }
  // applicants
  t.applicants = t.applicants.filter(a => a.expire >= m);
  let arr = sc.arrivals[m] || [];
  if (inDownturn(sc, m)) { const keep = CFG.SEV[sc.downturn.sev].arr; arr = arr.filter((a, k) => U(sc.seed, "arrKeep", m, k) < keep); }
  for (const a of arr) t.applicants.push(Object.assign({}, a));
  if ((m - 1) % 3 === 0) {
    const extra = (t.fac.liaison ? 1 : 0) + (t.tenants.some(x => x.type === "anchor" || x.type === "bigAnchor") ? 1 : 0) + (t.flags.cert && t.esg >= CFG.ESG.certMin ? 1 : 0);
    for (let k = 0; k < extra; k++) t.applicants.push(applicant(sc.seed, "x" + m + "-" + k, pickType(U(sc.seed, "xT", m, k)), m));
    if (t.flags.stimulus) t.applicants.push(applicant(sc.seed, "st" + m, "startup", m));
  }
  if (sc.downturn.forecastAt && m === sc.downturn.forecastAt) note(t, m, "Forecast: economists expect a " + CFG.SEV[sc.downturn.sev].label.toLowerCase() + " downturn from " + monthName(sc.downturn.start) + ". Rates will rise and the bank will cut the loan limit to " + CFG.SEV[sc.downturn.sev].cap + " Cr.", "phase");
  if (m === CFG.ZONES.H.release && !t.zones.H.locked) note(t, m, "Land Grant: Zone H is released. Each plot needs a signed use by the end of Year 3.", "phase");
  if (m === sc.downturn.start) { note(t, m, "Downturn: " + CFG.SEV[sc.downturn.sev].label + ". Tenants are closing, rates are rising and the bank has cut the loan limit to " + CFG.SEV[sc.downturn.sev].cap + " Cr.", "phase"); t.snap.let0 = tenantUnits(t); t.snap.bailAtDown = t.bailouts; }
}

function endMonth(t, sc, m) {
  const S = inDownturn(sc, m) ? CFG.SEV[sc.downturn.sev] : null;
  // works and buildings complete
  for (const z in t.zones) {
    const Z = t.zones[z];
    for (const w of Z.works) if (w.doneAt === m) {
      if (w.kind === "clear") { Z.mode = "open"; note(t, m, "Zone F cleared."); }
      else if (w.kind === "retention") { Z.mode = "open"; Z.protected = true; t.zones.E.protected = true; note(t, m, "Retention works finished: Zones E and G protected."); esg(t, m, CFG.ESG.retention, "retention works finished"); }
      else { const k = w.kind === "roadHalf" ? "road" : (w.kind === "powerShared" ? "power" : w.kind); Z.svc[k] = 1; note(t, m, CFG.WORKS[w.kind].label + " finished in Zone " + z + "."); }
    }
    Z.works = Z.works.filter(w => w.doneAt > m);
  }
  for (const b of t.buildings) if (b.status === "building" && b.readyAt === m) {
    b.status = "ready"; note(t, m, b.label + " is ready (" + b.units + " units)" + (svcOK(t, b.zone, false) ? "." : ", but the zone lacks services: nobody can move in yet."), svcOK(t, b.zone, false) ? "info" : "warn");
    if (b.preLet === true) { t.tenants.push({ id: "pl" + b.id, type: "bigAnchor", bid: b.id, since: m, name: "Anchor R&D Centre" }); note(t, m, "The anchor moved into " + b.id + ".", "good"); }
    else if (b.preLet === false) note(t, m, "The anchor withdrew: " + b.id + " stands empty.", "warn");
    if (b.smeOnReady) t.tenants.push({ id: "fs" + b.id, type: "sme", bid: b.id, since: m, name: "Factory SME" });
  }
  if (t.pendingAnchor) {
    if (m > t.pendingAnchor.until) { t.pendingAnchor = null; note(t, m, "The anchor lost patience and went elsewhere.", "warn"); }
    else { const b = findSpace(t, "anchor"); if (b && hasLabLike(t)) { t.tenants.push({ id: "pa" + m, type: "anchor", bid: b.id, since: m, name: "Anchor R&D Lab" }); t.pendingAnchor = null; note(t, m, "The anchor moved into " + b.id + ".", "good"); } }
  }
  // H reclaim, fund lapse
  if (m === CFG.ZONES.H.signBy) { const n = t.hplots.filter(p => p === null).length; t.hplots = t.hplots.map(p => p === null ? "reclaimed" : p); if (n) note(t, m, n + " unsigned Zone H plot(s) reclaimed by the university.", "warn"); }
  // flood
  if (m === CFG.FLOOD.month && sc.flood) {
    let hit = 0;
    for (const b of t.buildings) if ((b.zone === "E" || b.zone === "G") && !t.zones[b.zone].protected && (b.status === "ready" || b.status === "building")) {
      hit++; if (!t.flags.insured) t.cash -= CFG.FLOOD.repair;
      for (const x of t.tenants) if (x.bid === b.id) x.noRentUntil = m + CFG.FLOOD.lostMonths;
    }
    note(t, m, hit ? "Flood: " + hit + " building(s) in Zones E and G damaged" + (t.flags.insured ? " (insured)." : " (" + r1(hit * CFG.FLOOD.repair) + " Cr repairs).") : "Flood: the low ground flooded, but none of your buildings was hit.", hit ? "bad" : "info");
  }
  // JV exit clause
  if (m === 42 && t.flags.jv === "offered" && sc.jvExit) { const n = t.startups.filter(s => s.jv).length; t.startups = t.startups.filter(s => !s.jv); t.ipv -= 2; t.flags.jv = null; note(t, m, "The JV partner exited and took " + n + " startups (−2 impact).", "bad"); }
  // downturn waves
  if (S && (m === sc.downturn.start || m === sc.downturn.start + 12)) {
    // the newest tenants close first; renegotiated rents halve the back-office share, Shared Services halves the SME share
    const closeN = (type, share) => {
      const list = t.tenants.filter(x => x.type === type).sort((a, b) => b.since - a.since);
      const n = Math.ceil(share * list.length - 1e-9); return list.slice(0, n);
    };
    const reneg = t.flags.renegUntil && m <= t.flags.renegUntil;
    const bo = closeN("backoffice", reneg ? S.bo / 2 : S.bo);
    const goneIds = new Set(bo.map(x => x.id));
    const smAll = closeN("sme", S.sme);
    const smGone = t.fac.services ? closeN("sme", S.sme / 2) : smAll;
    for (const x of smGone) goneIds.add(x.id);
    for (const x of smAll) if (!goneIds.has(x.id)) x.noRentUntil = m + 3;
    const n = goneIds.size; t.tenants = t.tenants.filter(x => !goneIds.has(x.id));
    if (n) note(t, m, "Downturn: " + n + " tenant(s) closed.", "bad");
    if (m === sc.downturn.start && sc.leaseDefaultU < S.leaseDef) {
      const d = t.leases.filter(l => l.crisis).length; t.leases = t.leases.filter(l => !l.crisis);
      if (d) note(t, m, "Downturn: " + d + " ground lease(s) defaulted.", "bad");
    }
  }
  // tenant exits (common random numbers by type and recency)
  const exits = new Set();
  for (const type of ["backoffice", "sme", "spinoff", "anchor", "bigAnchor"]) {
    const T = CFG.TEN[type];
    let yr = T.exit;
    if (type === "spinoff" && (t.fac.lab || t.fac.incubator || t.flags.jv)) yr = T.exitSupported;
    if (type === "spinoff" && S) yr += S.spin;
    if ((type === "anchor" || type === "bigAnchor") && S) yr = Math.max(yr, S.anc);
    if ((type === "anchor" || type === "bigAnchor") && (t.flags.holiday === "free" || t.flags.holiday === "half")) yr = 0;
    if (type === "backoffice" && t.flags.renegUntil && m <= t.flags.renegUntil) yr /= 2;
    const list = t.tenants.filter(x => x.type === type).sort((a, b) => b.since - a.since);
    list.forEach((x, k) => { if (U(sc.seed, "exit", type, m, k) < yr / 12) exits.add(x.id); });
  }
  if (exits.size) { for (const x of t.tenants) if (exits.has(x.id)) note(t, m, x.name + " left the park.", "bad"); t.tenants = t.tenants.filter(x => !exits.has(x.id)); }
  // startups
  const st = t.startups.slice().sort((a, b) => a.since - b.since), keep = []; let grads = 0, gradIP = 0;
  st.forEach((s, k) => {
    const age = m - s.since + 1;
    const gp = (s.jv ? CFG.STARTUP.gradJV : (t.fac.lab ? CFG.STARTUP.gradLab : CFG.STARTUP.grad)) / 12;
    if (age >= CFG.STARTUP.minAge && U(sc.seed, "grad", m, k) < gp) {
      grads++; t.grads++; gradIP += CFG.STARTUP.gradIP;
      const b = findSpace(t, "sme");
      if (b) { t.tenants.push({ id: "g" + s.id, type: "sme", bid: b.id, since: m, name: s.name + " (graduate)" }); note(t, m, s.name + " graduated and moved into " + b.id + ".", "good"); }
      else { gradIP += 1; note(t, m, s.name + " graduated and left for larger premises.", "good"); }
      return;
    }
    if (U(sc.seed, "fail", m, k) < CFG.STARTUP.fail / 12) { note(t, m, s.name + " closed.", "bad"); return; }
    if (age >= CFG.STARTUP.maxAge) { note(t, m, s.name + " reached the maximum stay and left.", "info"); return; }
    keep.push(s);
  });
  t.startups = keep;
  // chemical spill risk
  if (t.tenants.some(x => x.type === "chem") && U(sc.seed, "spill", m) < 1 / 6 / 12) { t.cash -= 2; t.ipv -= 3; esg(t, m, CFG.ESG.spill, "chemical spill into the creek"); note(t, m, "Spill at the chemicals plant: 2 Cr fine, −3 impact.", "bad"); }
  // covenant conversion: one back-office a year becomes linked (checked in June)
  if (t.fac.covenant && m % 12 === 6) { const x = t.tenants.find(y => y.type === "backoffice"); if (x) { x.type = "sme"; x.name += " (converted)"; note(t, m, x.name + " joined the engagement covenant.", "good"); } }
  // money
  const P = money(t, sc, m); const net = P.net; const lin = linkedCount(t);
  t.cash += net; t.lastNet = net;
  // impact
  let ip = 0;
  for (const x of t.tenants) { const T = CFG.TEN[x.type]; ip += T.ip; const b = bById(t, x.bid); if (T.linked && b && b.zone === "C") ip += CFG.ZONES.C.linkedBonus; }
  ip += t.leases.reduce((a, l) => a + l.ip, 0);
  ip += CFG.STARTUP.ip * t.startups.length;
  if (t.fac.lab) ip += lin >= 3 ? 2 : (lin >= 1 ? 1 : 0);
  if (t.fac.labaccess && lin >= 2) ip += 1;
  if (t.fac.liaison && lin >= 2) ip += 1;
  if (t.fac.covenant) ip += Math.floor(0.5 * lin);
  if (t.flags.donor && lin >= 2) ip += 1;
  if (t.zones.F.mode === "buffer") ip += 1;
  if (t.zones.G.mode === "park") ip += 1;
  ip += CFG.PROG.ipPerCr * (t.prog || 0);
  const monthIP = ip / 12 + gradIP;
  if (t.fac.kpi) t.ipv += monthIP; else t.ipu += monthIP;
  // solvency
  if (t.cash < 0) {
    const need = Math.ceil(-t.cash);
    if (need <= headroom(t, sc, m)) { t.emerg += need; t.cash += need; note(t, m, "Cash ran out: emergency loan of " + need + " Cr at " + Math.round((S ? CFG.EMERG_P3 : CFG.EMERG) * 100) + "%.", "bad"); }
    else {
      t.bailouts++; if (S) t.bailP3 = true;
      t.cash = 0; t.ipv -= 5; t.apPenalty = 1;
      if (t.bailouts >= 2) { t.receiver = true; note(t, m, "Second bankruptcy: the park is in receivership.", "bad"); }
      else note(t, m, "Bankrupt: the university bailed the park out (−5 impact, one action point fewer next quarter).", "bad");
    }
  }
  // snapshots
  if (m === CFG.FUND_END) { t.snap.ci24 = committedIncome(t); t.snap.fundUsed = t.fundUsed; if (t.fund > 0) note(t, m, r1(t.fund) + " Cr of the Development Fund lapsed.", "warn"); t.fund = 0; }
  if (m === CFG.ZONES.H.signBy) t.snap.hplots = t.hplots.slice();
  t.cashHist.push(r1(t.cash - t.debt - t.emerg)); t.netHist.push(r1(net)); t.ipHist.push(r1(t.ipv + 0.5 * t.ipu));
}

/* ---------------------------------------------------------------- replay */
/* log: [{t, seq, ...order}] ; dec: {eid: "T"|"C"|"L"} ; closed: {eid: true} ; tNow: game time in months */
function replay(sc, name, policy, log, dec, closed, tNow) {
  const t = newTeam(name, policy, sc.lv || sc.level);
  const L = (log || []).slice().sort((a, b) => a.t - b.t || a.seq - b.seq);
  let li = 0; const evs = sc.events;
  const endM = Math.min(sc.months || CFG.MONTHS, Math.floor(tNow + 1e-9) + 1);
  for (let m = 1; m <= endM; m++) {
    if (t.receiver) { if (m <= Math.floor(tNow + 1e-9)) { t.cashHist.push(r1(t.cash - t.debt - t.emerg)); t.netHist.push(0); t.ipHist.push(r1(t.ipv + 0.5 * t.ipu)); } continue; }
    startMonth(t, sc, m);
    const monthEnd = m, full = m <= Math.floor(tNow + 1e-9);
    const items = [];
    for (const e of evs) if (e.month === m && (closed ? closed[e.id] : e.t <= tNow)) items.push({ t: e.t, ev: e });
    while (li < L.length && L[li].t < m) { if (L[li].t <= tNow) items.push({ t: L[li].t, o: L[li] }); li++; }
    items.sort((a, b) => a.t - b.t || (a.ev ? -1 : 1) - (b.ev ? -1 : 1));
    for (const it of items) { if (it.ev) applyEvent(t, sc, it.ev, dec ? dec[it.ev.id] : null, m); else applyOrder(t, sc, it.o, m); }
    if (full) endMonth(t, sc, monthEnd);
  }
  t.now = tNow; return t;
}

/* ---------------------------------------------------------------- scoring */
function parkScore(t, sc, m) {
  const ip = t.ipv + 0.5 * t.ipu;
  const f = fcr(t, sc, m);
  let bonus = CFG.FCR_LOW; for (const [th, b] of CFG.FCR_BANDS) if (f >= th) { bonus = b; break; }
  const dr = driftOf(t); let pen = 0; for (const [th, p] of CFG.DRIFT_PEN) if (dr > th) { pen = p; break; }
  const debtPen = 0.5 * Math.max(0, t.debt + t.emerg - t.cash);
  const score = t.receiver ? 0.5 * ip : ip + bonus - pen - debtPen;
  return { ip, fcr: f, fcrBonus: t.receiver ? 0 : bonus, drift: dr, driftPen: t.receiver ? 0 : pen, debtPen: t.receiver ? 0 : debtPen, score };
}
function rubric(t, sc, defence, m) {
  const lv = sc.lv || levelOf(sc.level); m = m || sc.months || CFG.MONTHS; const W = lv.score;
  const p = parkScore(t, sc, m);
  const A = W.A * Math.max(0, Math.min(1, p.score / W.parkTarget));
  const ci24 = t.snap.ci24 != null ? t.snap.ci24 : committedIncome(t);
  const fu = t.snap.fundUsed != null ? t.snap.fundUsed : t.fundUsed;
  const B1 = (W.B1 / 10) * (4 * Math.min(1, fu / (t.fund0 || CFG.FUND)) + 6 * Math.max(0, Math.min(1, (ci24 - t.snap.ci0) / W.fundIncomeTarget)));
  const pts = { build: 2.5, leaseC: 2.5, reserve: 2.5, natlab: 2.5, lease: 1.5, reclaimed: 0 };
  const hp = t.snap.hplots || t.hplots; const B2 = (W.B2 / 10) * hp.reduce((a, x) => a + (pts[x] || 0), 0);
  let B3, ret;
  if (sc.downturn && sc.downturn.none) {
    // operations (no downturn in this level): never bailed out, FCR12 >= 1, occupancy from 50% to 90%
    ret = occupancy(t);
    B3 = (W.B3 / 3) * ((t.bailouts || t.receiver ? 0 : 1) + (p.fcr >= 1 && !t.receiver ? 1 : 0) + Math.max(0, Math.min(1, (ret - 0.5) / 0.4)));
  } else {
    const let0 = t.snap.let0 != null ? t.snap.let0 : tenantUnits(t);
    ret = let0 ? tenantUnits(t) / let0 : 1;
    B3 = (W.B3 / 15) * ((t.bailP3 || t.receiver ? 0 : 5) + (p.fcr >= 1 && !t.receiver ? 5 : 0) + 5 * Math.max(0, Math.min(1, (ret - CFG.RET[0]) / (CFG.RET[1] - CFG.RET[0]))));
  }
  const dl = t.dlog.filter(d => d.eligible);
  const C = W.C * (dl.length ? dl.reduce((a, d) => a + d.credit, 0) / dl.length : 1);
  const D = defence != null ? Math.max(0, Math.min(W.D, defence)) : 0;
  const G = CFG.ESG; const E = W.E * Math.max(0, Math.min(1, (t.esg - G.floor) / (G.target - G.floor)));
  const total = A + B1 + B2 + B3 + C + D + E;
  const M = lv.medals;
  const goldGates = t.bailouts === 0 && p.fcr >= 1 && p.drift <= 0.5 && (!lv.esgGate || t.esg >= 0);
  // Silver (and Gold) need a real park: at least half the level's park-score target. Without it, sound decisions alone earn Bronze at most.
  const parkGate = p.score >= 0.5 * W.parkTarget;
  const medal = total >= M.gold && goldGates && parkGate ? "gold" : (total >= M.silver && !t.receiver && parkGate ? "silver" : (total >= M.bronze ? "bronze" : "none"));
  const dare = dl.reduce((a, d) => a + (d.dare || 0), 0);
  return { A, B1, B2, B3, C, D, E, esg: t.esg, total, medal, goldGates, park: p, retention: ret, dare, soundShare: dl.length ? dl.filter(d => d.sound).length / dl.length : 1, decisions: dl.length, weights: W };
}
function monthName(m) {
  if (m < 1) m = 1; const y = Math.ceil(m / 12), mo = (m - 1) % 12;
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][mo] + " Y" + y;
}
function dateLabel(tm, months) {
  const mdays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  tm = Math.max(0, Math.min((months || CFG.MONTHS) - 1e-9, tm));
  const mi = Math.floor(tm), y = Math.floor(mi / 12) + 1, mo = mi % 12, d = Math.floor((tm - mi) * mdays[mo]) + 1;
  return { day: d, month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][mo], year: y, text: d + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][mo] + ", Year " + y };
}

const API = { CFG, CARDS, DECK, LEVELS, levelOf, U, D6, money, makeScenario, newTeam, replay, validate, applyOrder, applyEvent, startMonth, endMonth, rubric, parkScore,
  eligible, sound, occupancy, readyUnits, occUnits, freeUnits, usedUnits, driftOf, committedIncome, annualUpkeep, fcr, headroom, loanCap, worksOptions,
  plotsFree, canBuildIn, gateMet, findSpace, facSpace, admissionAllowed, svcOK, linkedCount, capitalSplit, phaseOf, inDownturn, monthName, dateLabel, r1, tenantUnits, rateOf,
  siteOptions, siteTerms, leaseActive, bestBuildZone, socio, SOCIO };
if (typeof module !== "undefined" && module.exports) module.exports = API; else root.PB = API;
})(typeof window !== "undefined" ? window : globalThis);

