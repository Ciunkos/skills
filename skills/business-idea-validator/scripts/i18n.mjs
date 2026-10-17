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
      'stop-core': 'Rule: {n} of the 4 core rubrics scored 2 or lower with high confidence ({ids}).',
      'pivot-core': 'Rule: {n} core rubrics scored 2 or lower with high confidence ({ids}) and the synthesis names a pivot.',
      'validate-low': 'Rule: {n} rubric(s) scored 2 or lower ({ids}). Each one is a question an experiment can answer.',
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
      meta: 'Generated {date} with {model}. Scores are the model’s reading of the idea text; the verdict is a fixed rule applied to the scores. This is a structured opinion, not advice.',
      answerKeys: { for: 'Who it is for', money: 'How it makes money', today: 'What they use today', advantage: 'Unfair advantage', stage: 'Stage' }
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
      moat: { name: 'Obrona', question: 'Co powstrzyma kopię przed wygraną?' },
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
      'stop-core': 'Reguła: {n} z 4 rubryk rdzenia ma ocenę 2 lub niższą z wysoką pewnością ({ids}).',
      'pivot-core': 'Reguła: {n} rubryki rdzenia mają ocenę 2 lub niższą z wysoką pewnością ({ids}), a synteza wskazuje pivot.',
      'validate-low': 'Reguła: {n} rubryk ma ocenę 2 lub niższą ({ids}). Każda z nich to pytanie, na które odpowie eksperyment.',
      'validate-uncertain': 'Reguła: bez czerwonych flag, ale rubryki rdzenia nie są ocenione z wysoką pewnością ({ids}). Tekst pomysłu zostawia je otwarte.',
      'validate-default': 'Reguła: bez czerwonych flag, ale mniej niż 6 rubryk ma ocenę 4 lub wyższą. Pomysł nie jest jeszcze dość mocny, żeby na nim budować.',
      'build-strong': 'Reguła: żadna rubryka nie ma oceny 2 lub niższej, {n} rubryk ma 4 lub więcej, rdzeń oceniony z wysoką pewnością.'
    },
    section: {
      title: 'Walidacja pomysłu na biznes',
      idea: 'Pomysł',
      answers: 'Dodatkowe odpowiedzi',
      scorecard: 'Tablica ocen',
      verdict: 'Werdykt',
      why: 'Skąd ten werdykt',
      summary: 'Podsumowanie',
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
      cols: { rubric: 'Rubryka', band: 'Pasmo', confidence: 'Pewność' },
      meta: 'Wygenerowano {date} modelem {model}. Oceny to odczyt tekstu pomysłu przez model; werdykt to stała reguła nałożona na oceny. To ustrukturyzowana opinia, nie porada.',
      answerKeys: { for: 'Dla kogo', money: 'Jak zarabia', today: 'Czego używają dziś', advantage: 'Nieuczciwa przewaga', stage: 'Etap' }
    }
  }
};

export const labels = (lang) => LABELS[lang] || LABELS.en;

/* "{n} of {ids}" style templates. */
export const fill = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k])));
