# Age guide: sources and verification

The age bands on the For grown-ups page live in `src/content/age-guide.js`. They were compiled in October 2026 from developmental research and early-learning frameworks. Each band is a synthesis across sources, not a figure from a single study; most evidence comes from US/UK samples.

## How each reference was checked (October 2026)


| # | Reference | How verified (source located) | Claim used |
|---|---|---|---|
| 1 | NAEYC/NCTM 2002 | Full text read at naeyc.org/positionstatements/mathematics | Variation quotes; age 3 counting 1–4, sorting/comparing groups, copying patterns; age 6 pattern statements |
| 2 | CCSS K.CC / K.MD | Standards text read at thecorestandards.org/Math/Content/K/CC/ and /K/MD/ | K.CC.4 one-to-one; K.CC.6 compare groups by matching/counting; K.MD.3 classify |
| 3 | CCSS K.G.6 | thecorestandards.org/Math/Content/K/G/ | Compose simple shapes |
| 4 | Friedman 1990 | PubMed PMID 2245733 (abstract read); DOI from Wiley listing | By 5 y: backward order, multiple reference points; ages 4–9 |
| 5 | Zippert et al. 2020 | PubMed PMID 32889302 (abstract read) | Repeating patterning at 4–6 y predicts later maths |
| 6 | Harris et al. 2013 | Wiley DOI page located; abstract read on ERIC EJ1009646 | Mental folding appears ~5.5 y, marked individual differences |
| 7 | Siegler & Svetina 2002 | Author-hosted PDF read (Columbia) | ~20% (6 y), 48% (7 y), 78% (8 y) correct |
| 8 | CCSS 4.G.A.3 | thecorestandards.org/Math/Content/4/G/ | Line of symmetry in Grade 4 |
| 9 | Inhelder & Piaget 1964 | Routledge and PhilPapers/Google Books listings located | Classification develops through early school years (book's general thesis; specific page not checked) |
| 10 | Piaget 1952 | Google Books / library catalogue listings located | Original conservation tasks |
| 11 | McGarrigle & Donaldson 1974 | ScienceDirect abstract read (pii 0010027774900031) | 80 children 4;2–6;3; 50 conserved with "accidental" vs 13 with intentional change |
| 12 | Denison & Xu 2014 | PubMed PMID 24384147 (abstract read) | Infants <12 mo sensitive to probabilities |
| 13 | Fischbein et al. 1991 | Crossref record and Springer abstract read | Pupils show systematic errors in probability judgements |
| 14 | Outhred & Mitchelmore 2000 | Macquarie University repository record and abstract read | Grades 1–4 developing rectangular-covering principles |
| 15 | Warren & Cooper 2008 | Springer article URL for DOI located via search (title confirms 8-year-olds); QUT eprint listed | Growing-pattern research with ~8-year-olds. Abstract not read: Springer was rate-limited |
| 16 | Kazakoff & Bers 2014 | SAGE abstract page read | 34 children 4.5–6.5 y; sequencing gains after programming |
| 17 | CCSS K.OA.3 | thecorestandards.org/Math/Content/K/OA/ | Decompose numbers ≤10 into pairs |
| 18 | Klahr & Robinson 1981 | ScienceDirect abstract read (pii 0010028581900062) | 4–6 y; 1–7-move problems; older better |
| 19 | Welsh 1991 | ScienceDirect abstract read (pii 088520149190006Y) | 3–12 y; age gaps widen with difficulty |
| 20 | Boyer et al. 2008 | PubMed PMID 18793078 (abstract read) | Continuous proportions by 6 y; discrete until 10–12 y |
| 21 | English 1991 | Springer abstract read (doi 10.1007/BF00367908) | Ages 4;6–9;10; systematic "odometer" strategy from ~7 y |
| 22 | Mody & Carey 2016 | PubMed PMID 27239748 (abstract read) | 3–5 y use disjunctive syllogism; 2.5 y do not |

Checked but left out: Spinillo & Bryant (1991, Child Development 62(3), doi 10.2307/1131121; existence confirmed via Crossref, findings not readable); Bornstein & Stiles-Davis (1984, Developmental Psychology 20(4), 637–649; existence confirmed, abstract not readable); Rittle-Johnson et al. (2015, ECRQ 31, 101–112; existence confirmed, abstract not readable); Raven (2000, Cognitive Psychology 41, 1–48; abstract has no age norms for CPM); Clements & Sarama (2021, 3rd ed., Routledge; existence confirmed, age levels not readable online); Gelman & Gallistel (1978; existence confirmed, no specific claim used); Head Start ELOF (2015; goal titles confirmed but indicator text not readable); Dias, Roazzi & Harris (2005; about adults, not relevant).

Independent re-check (same month): PubMed records for Boyer et al. 2008, Mody & Carey 2016, Denison & Xu 2014, Friedman 1990 and Zippert et al. 2020; Crossref records for Klahr & Robinson 1981, Welsh 1991, Siegler & Svetina 2002, Outhred & Mitchelmore 2000, Harris et al. 2013, Kazakoff & Bers 2014, Warren & Cooper 2008 and Friedman 1990; the Siegler & Svetina percentages (20% / 48% / 78%) were read in the author-hosted PDF; the Harris et al. 5½-year finding in the ERIC abstract. Not read in full: the two Piaget books (catalogue entries only) and Warren & Cooper (title and DOI only).

## Updating the guide

- Cite only sources you have located and read (abstract at minimum). Record how in the table above.
- References are numbered by their position in `AGE_REFS`; `npm run check` fails if text cites a number that does not exist. If you insert a reference in the middle, renumber the [n] markers.
- Keep the parent-facing wording cautious: typical ranges, wide variation, not a test or screening tool.
