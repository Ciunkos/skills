/* i18n.mjs — labels for reports in English and Polish. Pure ESM, no Node APIs:
   the online worker bundles this file as-is. The rubric *instructions* stay in
   English (references/rubrics); only what the reader sees is translated here. */

export const LANGS = ['en', 'pl'];

export const RUBRIC_ORDER = ['problem', 'customer', 'market', 'alternatives', 'monetization', 'distribution', 'feasibility', 'moat', 'founder', 'risks'];

/* The four rubrics that decide Stop and Pivot. */
export const CORE = ['problem', 'customer', 'alternatives', 'monetization'];

export const LABELS = {
  en: {
    rubric: {
      problem: { name: 'Problem', question: 'Is the problem painful, frequent and urgent?' },
      customer: { name: 'Customer', question: 'Who exactly buys, can you reach them, do they have budget?' },
      market: { name: 'Market and timing', question: 'How big is the market and why now?' },
      alternatives: { name: 'Alternatives', question: 'What do people do today and why would they switch?' },
      monetization: { name: 'Monetization', question: 'Will they pay, how, and do the numbers work?' },
      distribution: { name: 'Distribution', question: 'How do the first customers find you?' },
      feasibility: { name: 'Feasibility', question: 'Can it be built, how fast, and what is risky?' },
      moat: { name: 'Defensibility', question: 'What stops a copy from winning?' },
      founder: { name: 'Founder fit', question: 'Why you, and do you have the time and runway?' },
      risks: { name: 'Risks', question: 'Legal, regulatory, platform and ethical exposure?' }
    },
    band: { 1: 'Red flag', 2: 'Weak', 3: 'Unclear', 4: 'Solid', 5: 'Strong' },
    confidence: { low: 'low confidence', medium: 'medium confidence', high: 'high confidence' },
    verdict: {
      build: { label: 'Build', line: 'The idea holds up on every rubric. Start building a first slice and keep measuring.' },
      validate: { label: 'Validate first', line: 'Do not build yet. Run the experiments below and come back with answers.' },
      pivot: { label: 'Pivot', line: 'The core does not hold, but a neighboring problem or segment looks better. Reframe before building.' },
      stop: { label: 'Stop', line: 'The core rubrics fail with high confidence. Spend the time on a different idea.' }
    },
    rule: {
      'stop-core': 'Rule: {n} of the 4 core rubrics scored 2 or lower with high confidence ({ids}), and the synthesis found no pivot worth more than the original.',
      'pivot-core': 'Rule: {n} core rubrics scored 2 or lower with high confidence ({ids}) and the synthesis names a pivot.',
      'validate-low': 'Rule: {n} rubric(s) scored 2 or lower ({ids}). Each one needs an answer or a change to the idea before building.',
      'validate-uncertain': 'Rule: no red flags, but core rubrics are not rated with high confidence ({ids}). The idea text leaves them open.',
      'validate-default': 'Rule: no red flags, but fewer than 6 rubrics scored 4 or higher. The idea is not yet strong enough to build on.',
      'build-strong': 'Rule: no rubric at 2 or lower and {n} rubrics at 4 or higher, core rated with high confidence.'
    },
    section: {
      title: 'Business idea validation',
      idea: 'The idea',
      answers: 'Additional answers',
      scorecard: 'Scorecard',
      verdict: 'Verdict',
      why: 'Why this verdict',
      summary: 'Summary',
      notes: 'Notes',
      riskiest: 'Riskiest assumption',
      experiments: 'Cheapest experiments (next two weeks)',
      pivots: 'Pivot options',
      questions: 'Open questions',
      rubrics: 'Rubric by rubric',
      evidence: 'Evidence from the idea text',
      assumptions: 'Assumptions made',
      reasoning: 'Reasoning',
      improve: 'What would raise the score',
      ask: 'Questions to answer',
      critic: 'Critic pass',
      criticNone: 'The critic reviewed all ten scores and changed none.',
      criticChange: '{id}: {from} to {to}. {why}',
      metric: 'Success metric',
      days: 'days',
      score: 'Score',
      cols: { rubric: 'Rubric', band: 'Band', confidence: 'Confidence' },
      meta: 'Generated with AI on {date}. AI can make mistakes, so read the scores as a starting point, not the final word. The verdict follows a fixed rule applied to those scores.',
      answerKeys: { for: 'Who it is for', money: 'How it makes money', today: 'What they use today', advantage: 'Unfair advantage', stage: 'Stage' },
      scan: 'Who already does this',
      scanLead: 'Web scan of {date}. Each row links to the page it was read from. Prices are as published that day; check them before you rely on them.',
      statusQuo: 'What customers do without a product',
      scanNone: 'The scan found no product that solves this for the same customer. Treat that as a question, not as good news.',
      scanCols: { name: 'Product', forWhom: 'For whom', price: 'Entry price', free: 'Free plan', difference: 'How you differ' },
      free: { yes: 'yes', no: 'no', unknown: 'not found' },
      priceSource: 'pricing',
      priceUnknown: 'not published',
      adjacent: 'adjacent tool',
      communities: 'Where to find your first ten conversations',
      scanNotes: 'What the scan could not settle',
      communitiesLead: 'Public places where your customers gather. Ask about the problem; do not pitch the product.'
    }
  },
  pl: {
    rubric: {
      problem: { name: 'Problem', question: 'Czy problem jest bolesny, częsty i pilny?' },
      customer: { name: 'Klient', question: 'Kto dokładnie kupuje, czy da się do niego dotrzeć, czy ma budżet?' },
      market: { name: 'Rynek i moment', question: 'Jak duży jest rynek i dlaczego teraz?' },
      alternatives: { name: 'Alternatywy', question: 'Co ludzie robią dziś i dlaczego mieliby zmienić?' },
      monetization: { name: 'Monetyzacja', question: 'Czy zapłacą, jak, i czy liczby się spinają?' },
      distribution: { name: 'Dystrybucja', question: 'Jak pierwsi klienci mają Cię znaleźć?' },
      feasibility: { name: 'Wykonalność', question: 'Czy da się to zbudować, jak szybko i co jest ryzykowne?' },
      moat: { name: 'Trwałość przewagi', question: 'Co powstrzyma kopię przed wygraną?' },
      founder: { name: 'Dopasowanie założyciela', question: 'Dlaczego Ty, i czy masz czas oraz runway?' },
      risks: { name: 'Ryzyka', question: 'Prawo, regulacje, platformy, etyka?' }
    },
    band: { 1: 'Czerwona flaga', 2: 'Słabo', 3: 'Niejasno', 4: 'Solidnie', 5: 'Mocno' },
    confidence: { low: 'niska pewność', medium: 'średnia pewność', high: 'wysoka pewność' },
    verdict: {
      build: { label: 'Buduj', line: 'Pomysł trzyma się w każdej rubryce. Zbuduj pierwszy wycinek i mierz dalej.' },
      validate: { label: 'Najpierw sprawdź', line: 'Jeszcze nie buduj. Zrób eksperymenty poniżej i wróć z odpowiedziami.' },
      pivot: { label: 'Zmień kierunek', line: 'Rdzeń się nie trzyma, ale sąsiedni problem albo segment wygląda lepiej. Przeformułuj przed budową.' },
      stop: { label: 'Stop', line: 'Rubryki rdzenia padają z wysoką pewnością. Poświęć ten czas innemu pomysłowi.' }
    },
    rule: {
      'stop-core': 'Reguła: rubryki rdzenia z oceną 2 lub niższą przy wysokiej pewności: {ids} ({n} z 4), a synteza nie widzi kierunku wartego więcej niż oryginał.',
      'pivot-core': 'Reguła: rubryki rdzenia z oceną 2 lub niższą przy wysokiej pewności: {ids} ({n} z 4), a synteza wskazuje zmianę kierunku.',
      'validate-low': 'Reguła: rubryki z oceną 2 lub niższą: {ids} ({n}). Każda wymaga odpowiedzi albo zmiany w pomyśle przed budową.',
      'validate-uncertain': 'Reguła: bez czerwonych flag, ale rubryki rdzenia bez wysokiej pewności: {ids}. Tekst pomysłu zostawia je otwarte.',
      'validate-default': 'Reguła: bez czerwonych flag, ale mniej niż 6 rubryk ma ocenę 4 lub wyższą. Pomysł nie jest jeszcze dość mocny, żeby na nim budować.',
      'build-strong': 'Reguła: żadna rubryka nie ma oceny 2 lub niższej, rubryki z oceną 4 lub wyższą: {ids} ({n}), rdzeń oceniony z wysoką pewnością.'
    },
    section: {
      title: 'Walidacja pomysłu na biznes',
      idea: 'Pomysł',
      answers: 'Dodatkowe odpowiedzi',
      scorecard: 'Tablica ocen',
      verdict: 'Werdykt',
      why: 'Skąd ten werdykt',
      summary: 'Podsumowanie',
      notes: 'Uwagi',
      riskiest: 'Najbardziej ryzykowne założenie',
      experiments: 'Najtańsze eksperymenty (najbliższe dwa tygodnie)',
      pivots: 'Opcje zmiany kierunku',
      questions: 'Pytania bez odpowiedzi',
      rubrics: 'Rubryka po rubryce',
      evidence: 'Dowody z tekstu pomysłu',
      assumptions: 'Przyjęte założenia',
      reasoning: 'Uzasadnienie',
      improve: 'Co podniosłoby ocenę',
      ask: 'Pytania do odpowiedzi',
      critic: 'Przegląd krytyka',
      criticNone: 'Krytyk przejrzał wszystkie dziesięć ocen i żadnej nie zmienił.',
      criticChange: '{id}: z {from} na {to}. {why}',
      metric: 'Miara sukcesu',
      days: 'dni',
      score: 'Ocena',
      cols: { rubric: 'Rubryka', band: 'Poziom', confidence: 'Pewność' },
      meta: 'Wygenerowane przez AI {date}. AI może się mylić, więc traktuj oceny jako punkt wyjścia, nie ostatnie słowo. Werdykt wynika ze stałej reguły nałożonej na te oceny.',
      answerKeys: { for: 'Dla kogo', money: 'Jak zarabia', today: 'Czego używają dziś', advantage: 'Nieuczciwa przewaga', stage: 'Etap' },
      scan: 'Kto już to robi',
      scanLead: 'Przegląd sieci z {date}. Każdy wiersz prowadzi do strony, z której go odczytano. Ceny są z tego dnia; sprawdź je, zanim na nich oprzesz decyzję.',
      statusQuo: 'Co klienci robią bez produktu',
      scanNone: 'Przegląd nie znalazł produktu, który rozwiązuje to dla tego samego klienta. Traktuj to jako pytanie, nie jako dobrą wiadomość.',
      scanCols: { name: 'Produkt', forWhom: 'Dla kogo', price: 'Cena wejściowa', free: 'Darmowy plan', difference: 'Czym się różnisz' },
      free: { yes: 'tak', no: 'nie', unknown: 'nie znaleziono' },
      priceSource: 'cennik',
      priceUnknown: 'brak publicznej ceny',
      adjacent: 'narzędzie z sąsiedniej kategorii',
      communities: 'Gdzie znaleźć pierwsze dziesięć rozmów',
      scanNotes: 'Czego przegląd nie rozstrzygnął',
      communitiesLead: 'Publiczne miejsca, w których bywają Twoi klienci. Pytaj o problem, nie sprzedawaj produktu.'
    }
  }
};

export const labels = (lang) => LABELS[lang] || LABELS.en;

/* "{n} of {ids}" style templates. */
export const fill = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k])));
