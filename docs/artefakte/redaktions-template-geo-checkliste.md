# Redaktions-Template & GEO-Checkliste
## Wissens-Zone, Vergleichs-Zone, Episoden- und Datenseiten

Version 1.0 · Arbeitsdokument für Redaktion (inhaltlich) und Entwicklung (Payload-Felder, JSON-LD-Rendering)

Grundprinzip: KI-Systeme extrahieren auf Chunk-Ebene. Jeder Abschnitt muss
ohne den Rest des Artikels verständlich, zitierbar und einer Quelle
zuordenbar sein. Alles, was hier als "Feld" markiert ist, wird als
strukturiertes Payload-Feld gepflegt — nicht als Konvention im Fließtext.

---

## Teil 1 — Artikel-Template Wissens-Zone

Reihenfolge und Funktion der Bausteine. Felder in [eckigen Klammern]
sind Payload-Felder, die das Frontend an fester Position rendert.

### 1.1 Aufbau

**H1** — Formulierung als Frage oder klare Themennennung, wie Nutzer sie
einer KI stellen würden. Gut: "Vitamin D supplementieren: Was sagt die
Studienlage?" Schlecht: "Das Sonnenvitamin unter der Lupe".

**[kernaussage]** — Pflichtfeld, 2–4 Sätze, max. 80 Wörter. Wird als
optisch abgesetzte Box direkt unter der H1 gerendert (erste 200 Wörter
der Seite!). Regeln:
- In sich geschlossen: verständlich ohne jeden weiteren Kontext
- Enthält mindestens eine Zahl mit Einheit und ein Datum
- Enthält den Evidenzgrad in Worten
- Kein "wir", kein Marketing, keine Cliffhanger

Beispiel:
> Bei einem gemessenen 25(OH)D-Spiegel unter 20 ng/ml gilt eine
> Vitamin-D-Supplementierung als evidenzbasiert sinnvoll; oberhalb von
> 30 ng/ml zeigt die Studienlage keinen belegten Zusatznutzen weiterer
> Zufuhr. Ohne Messung ist eine Hochdosis-Supplementierung nicht
> empfehlenswert. Stand: Juli 2026, Evidenzgrad: hoch (Meta-Analysen).

**[evidenzgrad]** — Select-Feld: `hoch` (Meta-Analysen/RCTs) ·
`mittel` (einzelne RCTs, große Kohorten) · `niedrig` (Beobachtung,
Mechanistik) · `unklar` (widersprüchlich). Wird in der Kernaussage-Box
und im Artikel-Kopf angezeigt. Redaktionelle Signatur des Formats.

**Abschnitt "Für wen ist das relevant?"** — 3–5 Sätze, benennt
Zielgruppen und Ausschlüsse explizit (Schwangere, Medikamenten-
Wechselwirkungen → Arztverweis). HWG-Schutzfunktion und
Extraktionsnutzen zugleich.

**Hauptteil** — H2-Abschnitte, jede H2 als Frage formuliert. Die H2s
sind die Fan-out-Sub-Queries des Themas. Pro Thema vorab 8–12
Sub-Queries sammeln (SEMrush/Search Console "People also ask" +
manuell ChatGPT/Perplexity fragen: "Was würdest du zu X nachschlagen?")
und auf Artikel des Clusters verteilen — nicht alle in einen Artikel.

Schreibregeln pro Abschnitt:
- Erster Satz beantwortet die H2-Frage vollständig (Definition Lead).
  Der Rest des Abschnitts vertieft.
- Max. ~300 Wörter pro Abschnitt, dann neue H2/H3.
- Keine Pronomen-Bezüge über Abschnittsgrenzen ("diese Methode" →
  Methode beim Namen nennen).
- Jede Zahl mit Einheit, Quelle und Jahr im selben Satz oder
  unmittelbar dahinter.
- 3–5 externe Autoritätsquellen pro Artikel im Fließtext benannt
  (nicht nur im Quellenapparat): "Eine Meta-Analyse von 2024
  (n=41 Studien) zeigt …"

**Evidenz-Tabelle** — Pflicht bei Maßnahmen-Artikeln: Endpunkt |
Effektstärke | Studienlage | Evidenzgrad. Als echtes HTML-`<table>`
rendern, nie als Bild oder JS-Komponente.

**[faq]** — Array-Feld, 3–6 Einträge {frage, antwort}. Antworten
2–4 Sätze, in sich geschlossen. Kein Duplikat der H2s — hier gehören
die Rand-Sub-Queries hin ("Kann man Vitamin D überdosieren?",
"Wechselwirkung mit Kortison?"). Wird am Artikelende gerendert und
speist das FAQPage-Markup.

**Messgrößen-Block** — fester Abschluss jedes Maßnahmen-Artikels:
"Woran erkenne ich, ob das bei mir wirkt?" → relevanter Biomarker,
Referenzbereich, Messintervall. Einziger zulässiger Übergang Richtung
Aktions-Zone, neutral formuliert.

**[sources]** — bestehendes Array-Feld (citation, refType, ref).
Nummeriert gerendert, DOI/PubMed verlinkt. Mindestens 5 Quellen,
davon mindestens 2 Meta-Analysen oder Leitlinien, wenn vorhanden.

**Meta-Block (gerendert, sichtbar)** — Autor mit Kurzqualifikation ·
"Medizinisch geprüft von [Titel Name, Facharztbezeichnung] am [Datum]" ·
Veröffentlicht am · Zuletzt aktualisiert am. Alle vier Angaben sichtbar
auf der Seite UND im Markup — Sichtbarkeit ist Teil des Signals.

### 1.2 Neue Payload-Felder (Delta zur bestehenden Articles-Collection)

| Feld | Typ | Pflicht |
|---|---|---|
| kernaussage | textarea, max 500 Zeichen | ja |
| evidenzgrad | select (hoch/mittel/niedrig/unklar) | ja |
| faq | array {frage: text, antwort: textarea} | ja (min. 3) |
| messgroesse | group {biomarker, referenzbereich, intervall} | bei Maßnahmen |
| lastFactCheck | date, readOnly, per Hook gesetzt | automatisch |

`kernaussage`, `faq` und `messgroesse` gehören in den contentHash —
Änderung invalidiert die Arztfreigabe.

---

## Teil 2 — JSON-LD pro Seitentyp

Alle Seiten: ein `@graph` pro Seite, gerendert aus CMS-Feldern —
nie manuell gepflegt. Sitewide-Knoten (Organization, WebSite) werden
per @id referenziert, nicht dupliziert.

### 2.1 Sitewide (in jedem Graph referenziert)

```json
{
  "@type": "Organization",
  "@id": "https://portal.example/#org",
  "name": "PORTALNAME",
  "url": "https://portal.example/",
  "logo": { "@type": "ImageObject", "url": "…/logo.png" },
  "sameAs": [
    "https://www.wikidata.org/wiki/…",
    "https://www.linkedin.com/company/…",
    "https://open.spotify.com/show/…"
  ],
  "publishingPrinciples": "https://portal.example/methodik/redaktionelle-leitlinien"
}
```

`publishingPrinciples` zeigt auf die öffentliche Redaktions- und
Methodikseite — unterschätztes Vertrauenssignal. `sameAs`-Liste
überall identisch halten (Entitätskonsistenz). Wikidata-Eintrag
anlegen, sobald ausreichend unabhängige Belege existieren
(Presseerwähnungen, Podcast-Verzeichnisse).

### 2.2 Wissensartikel (MedicalWebPage + Article + FAQPage)

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "MedicalWebPage",
      "@id": "https://portal.example/wissen/vitamin-d/#page",
      "url": "https://portal.example/wissen/vitamin-d/",
      "name": "Vitamin D supplementieren: Was sagt die Studienlage?",
      "lastReviewed": "2026-07-02",
      "reviewedBy": { "@id": "#reviewer" },
      "about": { "@type": "MedicalEntity", "name": "Vitamin D (Cholecalciferol)" },
      "isPartOf": { "@id": "https://portal.example/#website" }
    },
    {
      "@type": "Article",
      "headline": "Vitamin D supplementieren: Was sagt die Studienlage?",
      "description": "KERNAUSSAGE-Feld hier einsetzen",
      "author": {
        "@type": "Person",
        "name": "AUTORNAME",
        "url": "https://portal.example/team/autorname/"
      },
      "publisher": { "@id": "https://portal.example/#org" },
      "datePublished": "2026-05-10",
      "dateModified": "2026-07-02",
      "citation": [
        { "@type": "ScholarlyArticle", "name": "TITEL", "identifier": "doi:10.xxxx/…" }
      ],
      "mainEntityOfPage": { "@id": "…/#page" }
    },
    {
      "@type": "Person",
      "@id": "#reviewer",
      "name": "Dr. med. NAME",
      "jobTitle": "Facharzt für Laboratoriumsmedizin",
      "url": "https://portal.example/beirat/name/"
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "FAQ-Frage aus dem faq-Feld",
          "acceptedAnswer": { "@type": "Answer", "text": "FAQ-Antwort" }
        }
      ]
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Wissen", "item": "…/wissen/" },
        { "@type": "ListItem", "position": 2, "name": "Vitamin D", "item": "…/wissen/vitamin-d/" }
      ]
    }
  ]
}
```

Hinweise:
- `citation` aus dem sources-Array generieren (nur DOI/PubMed-Einträge).
- FAQ-Rich-Results zeigt Google seit 2023 fast nur noch für Behörden-
  und Gesundheitsautoritäten — das Markup bleibt trotzdem drin: Es
  strukturiert den Content für KI-Extraktion, nicht für Snippets.
- `dateModified` nur bei inhaltlichen Änderungen anfassen, nicht bei
  Tippfehlern — sonst entwertet ihr das Signal.

### 2.3 Vergleichsseite (ItemList + Product + Review)

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ItemList",
      "name": "Vitamin-D-Präparate im Vergleich",
      "itemListOrder": "https://schema.org/ItemListOrderDescending",
      "numberOfItems": 34,
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "item": {
            "@type": "Product",
            "name": "PRODUKTNAME",
            "brand": { "@type": "Brand", "name": "HERSTELLER" },
            "gtin13": "…",
            "review": {
              "@type": "Review",
              "author": { "@id": "https://portal.example/#org" },
              "datePublished": "2026-07-01",
              "reviewRating": {
                "@type": "Rating",
                "ratingValue": 86.5,
                "bestRating": 100,
                "worstRating": 0
              },
              "reviewBody": "Kurzfazit aus der Bewertung, 1–2 Sätze"
            }
          }
        }
      ]
    }
  ]
}
```

Bewusste Zurückhaltung:
- KEIN AggregateRating (das wären aggregierte Nutzerbewertungen —
  habt ihr nicht). Ein Review pro Produkt, Autor = Organization.
- ratingValue = total_score aus der Vergleichs-Engine, bestRating = 100.
  Kopplung an die Engine, nie manuell.
- Auf der Seite sichtbar verlinken: "Bewertet nach Methodik v1" →
  Methodikseite. Markup ohne sichtbare, begründete Bewertung auf der
  Seite ist ein Spam-Signal.
- KEIN offers-Markup mit Affiliate-Preisen (Preisänderungs-/
  Haftungsthema); Preise als Text mit Stand-Datum.

### 2.4 Methodikseite

Article-Markup, gerendert aus criteria_schemas.methodology_md, plus:
`version`-Angabe im Text und `dateModified` = activated_at der
Schema-Version. Alte Versionen bleiben unter /methodik/vitamin-d/v1/
erreichbar (Beweiskette, und KIs zitieren gern "laut Methodik v2…").

### 2.5 Podcast-Episodenseite (PodcastEpisode + Transkript)

```json
{
  "@context": "https://schema.org",
  "@type": "PodcastEpisode",
  "name": "Was ist dran an Vitamin D?",
  "episodeNumber": 12,
  "datePublished": "2026-06-15",
  "partOfSeries": {
    "@type": "PodcastSeries",
    "name": "SERIENNAME",
    "url": "https://portal.example/podcast/"
  },
  "associatedMedia": {
    "@type": "AudioObject",
    "contentUrl": "PODIGEE-AUDIO-URL"
  },
  "transcript": "VOLLTRANSKRIPT oder URL zur Transkript-Sektion"
}
```

Transkript immer als HTML auf der Episodenseite (aufklappbar ist ok,
aber im DOM, nicht nachgeladen). Sprecherwechsel auszeichnen
("MATTHIAS:", "RUTH:") — verdoppelt den zitierbaren Korpus und macht
Aussagen Personen zuordenbar.

### 2.6 Daten-/Statistikseite (Dataset) — der unterschätzte Typ

Für die Quartalspublikationen aus der eigenen Datenbasis
(Preis-Mediane, Transparenz-Korrelation, anonymisierte Aggregate):

```json
{
  "@context": "https://schema.org",
  "@type": "Dataset",
  "name": "Preisanalyse Vitamin-D-Präparate Q3/2026",
  "description": "Medianpreis pro 1.000 I.E. über 34 in Deutschland erhältliche Präparate, erhoben Juli 2026.",
  "creator": { "@id": "https://portal.example/#org" },
  "datePublished": "2026-07-15",
  "temporalCoverage": "2026-07",
  "spatialCoverage": "Deutschland",
  "license": "https://creativecommons.org/licenses/by/4.0/",
  "distribution": {
    "@type": "DataDownload",
    "encodingFormat": "text/csv",
    "contentUrl": "https://portal.example/daten/vitamin-d-preise-q3-2026.csv"
  }
}
```

CC-BY-Lizenz + CSV-Download sind Absicht: maximale Zitier- und
Weiterverwendungsfähigkeit, jede Nennung trägt den Portalnamen.
Kernzahlen zusätzlich als Klartextsatz auf der Seite ("Der Medianpreis
lag im Juli 2026 bei X € pro 1.000 I.E., n=34").

### 2.7 Beirats-/Autorenseiten (Person)

Pro Arzt und Autor eine eigene URL mit Person-Markup: name, honorificPrefix,
jobTitle (Facharztbezeichnung), affiliation, sameAs (Praxis-Website,
Publikationsprofile). Diese Seiten sind die Entitäts-Anker, auf die
reviewedBy/author zeigen — ohne sie hängen die Referenzen im Leeren.

---

## Teil 3 — Pre-Publish-Checkliste

Vor jedem Statuswechsel auf "redaktionell fertig":

**Struktur & Extraktion**
- [ ] H1 als Frage/Nutzerformulierung
- [ ] Kernaussage-Box: in sich geschlossen, Zahl + Datum + Evidenzgrad, ≤ 80 Wörter
- [ ] Alle H2 als Fragen, decken die geplanten Sub-Queries des Clusters ab
- [ ] Jeder Abschnitt: erster Satz beantwortet die H2 vollständig
- [ ] Kein Abschnitt > 300 Wörter, keine Pronomen-Bezüge über Abschnitte
- [ ] Evidenz-Tabelle vorhanden (bei Maßnahmen-Artikeln), als HTML-Tabelle
- [ ] FAQ: min. 3 Einträge, keine H2-Duplikate, Antworten in sich geschlossen
- [ ] Messgrößen-Block vorhanden, neutral formuliert

**Evidenz & Quellen**
- [ ] Jede Zahl mit Einheit, Quelle, Jahr
- [ ] 3–5 Autoritätsquellen im Fließtext benannt
- [ ] Quellenapparat ≥ 5 Einträge, DOI/PubMed wo verfügbar
- [ ] Evidenzgrad-Feld gesetzt und im Text konsistent

**Recht & Ton (Wissens-Zone)**
- [ ] Keine Heilversprechen, keine Produktnennung, kein Affiliate-Link
- [ ] Kontraindikationen/Arztverweis im "Für wen relevant"-Block
- [ ] Keine Werbesprache, kein "wir empfehlen kaufen"

**Technik (stichprobenartig, Verantwortung Dev)**
- [ ] Vollständiger Content im Initial-HTML (curl-Test ohne JS)
- [ ] JSON-LD validiert (Rich-Results-Test + schema.org-Validator)
- [ ] dateModified korrekt, Meta-Block sichtbar gerendert
- [ ] Interne Links: min. 2 in den eigenen Cluster, 1 zur Messgröße

Vor "publiziert": Arztfreigabe liegt vor (erzwingt das System ohnehin).

---

## Teil 4 — Laufende Pflege

**Quartalsweise pro Artikel** (Payload-Report auf lastFactCheck > 90 Tage):
Zahlen und Studienlage prüfen, bei Änderung: Update + dateModified +
ggf. erneute Arztfreigabe (macht der contentHash automatisch nötig).
Bei "keine Änderung": lastFactCheck aktualisieren, dateModified NICHT.

**Monatlich, 1 Stunde:** Prompt-Set (10–15 Zielfragen) durch ChatGPT,
Perplexity, Gemini und Google AI Mode laufen lassen. Dokumentieren:
erwähnt? zitiert? welche Wettbewerber? Faktisch korrekt wiedergegeben?
Falsche Wiedergaben sind ein Signal, dass die Kernaussage-Box des
betroffenen Artikels unklar formuliert ist — dort nachschärfen.

**Quartalsweise:** eine neue Daten-/Statistikseite (Dataset) aus der
eigenen Datenbasis publizieren. Das ist der planbare
Zitierfähigkeits-Motor des Portals.
