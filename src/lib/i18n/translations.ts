// EDOS Poultry360 localization (spec §10). SCOPE: this is not a
// full-app translation layer — it covers exactly the "Simple Farmer Mode"
// 60-second daily flow (spec §8): the bottom nav's farmer labels, the
// Home dashboard, and Record Today. That's the one journey the spec is
// most explicit a smallholder must be comfortable with, and doing it
// completely (every visible string, not a scattered handful) was judged
// more valuable than a shallow pass smeared across all ~50 components.
// Admin/network/CMS/report screens remain English-only for this pass —
// see README's "Deliberately deferred" note.
//
// All copy lives here, in components, with no business logic depending on
// display strings — exactly the architecture README already called out as
// not blocking this. Adding a third language later means adding one more
// key set here, nothing else.

export type Locale = "en" | "sw";

export interface Dictionary {
  nav: {
    home: string;
    record: string;
    flock: string;
    sales: string;
    advice: string;
    more: string;
  };
  home: {
    goodMorning: string;
    goodAfternoon: string;
    goodEvening: string;
    yourFarmToday: string;
    todayLabel: string; // "{batchCode} today"
    birdsAlive: string;
    eggsToday: string;
    feedUsed: string;
    salesToday: string;
    notRecordedYet: string;
    recordLink: string;
    birdsLostToday: string; // suffix after the count, e.g. "{n} <birdsLostToday>"
    upcomingVaccination: string;
    due: string;
    recordButton: string;
    noFlock: string;
    noFlockHint: string;
  };
  record: {
    title: string;
    noFlock: string;
    addFlock: string;
    deaths: string;
    eggs: string;
    feed: string;
    sales: string;
    notes: string;
    save: string;
    saving: string;
    savedTitle: string;
    savedBody: string;
    backHome: string;
  };
  language: {
    label: string;
  };
}

export const translations: Record<Locale, Dictionary> = {
  en: {
    nav: { home: "Home", record: "Record", flock: "Flock", sales: "Sales", advice: "Advice", more: "More" },
    home: {
      goodMorning: "Good morning",
      goodAfternoon: "Good afternoon",
      goodEvening: "Good evening",
      yourFarmToday: "Your farm today",
      todayLabel: "today",
      birdsAlive: "Birds alive",
      eggsToday: "Eggs today",
      feedUsed: "Feed used",
      salesToday: "Sales today",
      notRecordedYet: "You haven't recorded today yet.",
      recordLink: "Record today's numbers →",
      birdsLostToday: "bird(s) lost today.",
      upcomingVaccination: "Upcoming vaccination",
      due: "due",
      recordButton: "Record today's numbers",
      noFlock: "No active flock yet.",
      noFlockHint: "Add a flock to start recording production.",
    },
    record: {
      title: "Record today",
      noFlock: "No active flock to record against yet.",
      addFlock: "Add a flock →",
      deaths: "Deaths today",
      eggs: "Eggs collected",
      feed: "Feed used (kg)",
      sales: "Sales today (KES)",
      notes: "Notes (optional)",
      save: "Save today's record",
      saving: "Saving…",
      savedTitle: "Today's record is saved.",
      savedBody: "It will sync automatically if you were offline.",
      backHome: "Back to home",
    },
    language: { label: "Language" },
  },
  sw: {
    nav: { home: "Nyumbani", record: "Rekodi", flock: "Kuku", sales: "Mauzo", advice: "Ushauri", more: "Zaidi" },
    home: {
      goodMorning: "Habari za asubuhi",
      goodAfternoon: "Habari za mchana",
      goodEvening: "Habari za jioni",
      yourFarmToday: "Shamba lako leo",
      todayLabel: "leo",
      birdsAlive: "Kuku walio hai",
      eggsToday: "Mayai leo",
      feedUsed: "Chakula kilichotumika",
      salesToday: "Mauzo ya leo",
      notRecordedYet: "Bado hujarekodi leo.",
      recordLink: "Rekodi namba za leo →",
      birdsLostToday: "kuku wamekufa leo.",
      upcomingVaccination: "Chanjo inayokuja",
      due: "inatarajiwa",
      recordButton: "Rekodi namba za leo",
      noFlock: "Hakuna kundi la kuku bado.",
      noFlockHint: "Ongeza kundi la kuku ili kuanza kurekodi uzalishaji.",
    },
    record: {
      title: "Rekodi ya leo",
      noFlock: "Hakuna kundi la kuku linalotumika kwa sasa.",
      addFlock: "Ongeza kundi la kuku →",
      deaths: "Vifo vya leo",
      eggs: "Mayai yaliyokusanywa",
      feed: "Chakula kilichotumika (kg)",
      sales: "Mauzo ya leo (KES)",
      notes: "Maelezo (hiari)",
      save: "Hifadhi rekodi ya leo",
      saving: "Inahifadhi…",
      savedTitle: "Rekodi ya leo imehifadhiwa.",
      savedBody: "Itasawazishwa kiotomatiki ikiwa haukuwa mtandaoni.",
      backHome: "Rudi nyumbani",
    },
    language: { label: "Lugha" },
  },
};

export function getDictionary(locale: string | null | undefined): Dictionary {
  return translations[locale as Locale] ?? translations.en;
}
