# Syng dictionary data notices

The generated dictionary bundle is an adapted database licensed under [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/). The creator software is separate and licensed under GPL-3.0-only.

**Changes made:** Syng Dictionary Creator parsed, normalized, filtered, structurally annotated, deduplicated exact matches, merged source material, assigned stable identities, and built search indexes. It excluded Wiktionary quotations.

No upstream project or contributor endorses Syng or this bundle. Source claims and data are provided without warranties.

## CcCedict — dictionary

- Revision: `cedict-mixed:4d12024cd9547789; 2026-09-12T14:59:30Z`
- Material: https://cc-cedict.org/editor/editor_export_cedict.php?c=gz&v=0
- License: [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- License evidence: https://cc-cedict.org/editor/editor.php?handler=Download
- Copyright notice: CC-CEDICT, published by MDBG. Referenced work: CEDICT, Copyright (C) 1997, 1998 Paul Andrew Denisowski.
- Attribution: CC-CEDICT: Community maintained free Chinese-English dictionary, published by MDBG. CEDICT originated with Paul Andrew Denisowski.
- Changes: Parsed, normalized, split into documented definition entries, structurally annotated through reviewed labels, merged with other sources, and indexed by Syng Dictionary Creator.

## ChineseNotes — dictionary

- Revision: `e98efc7424237890e8698d25e4f20d6a258253cc`
- Material: https://raw.githubusercontent.com/alexamies/chinesenotes.com/e98efc7424237890e8698d25e4f20d6a258253cc/data/cnotes_zh_en_dict.tsv
- License: [CC-BY-SA-3.0](https://creativecommons.org/licenses/by-sa/3.0/)
- License evidence: https://chinesenotes.com/about
- Copyright notice: Copyright Fo Guang Shan 佛光山 2013-2025.
- Attribution: Chinese Notes Chinese-English dictionary, Copyright Fo Guang Shan 佛光山 2013-2025; project maintained by Alex Amies with upstream contributors acknowledged by Chinese Notes.
- Changes: Used only to enrich exact pre-existing lexical identities and exact existing senses with whitelisted structured metadata; Chinese Notes does not establish identities or publish glosses.

## ChineseNotes — grammar-vocabulary

- Revision: `e98efc7424237890e8698d25e4f20d6a258253cc`
- Material: https://raw.githubusercontent.com/alexamies/chinesenotes.com/e98efc7424237890e8698d25e4f20d6a258253cc/data/grammar.txt
- License: [CC-BY-SA-3.0](https://creativecommons.org/licenses/by-sa/3.0/)
- License evidence: https://chinesenotes.com/about
- Copyright notice: Copyright Fo Guang Shan 佛光山 2013-2025.
- Attribution: Chinese Notes grammar vocabulary, Copyright Fo Guang Shan 佛光山 2013-2025; project maintained by Alex Amies with upstream contributors acknowledged by Chinese Notes.
- Changes: Used as a reviewed parsing vocabulary; normalized and mapped into Syng's closed grammatical enums.

## Wiktionary — filtered-chinese-jsonl

- Revision: `enwiktionary-20260902; wiktextract ccec6f120efedd84f57fe0f1631e89408e9cb62a`
- Material: https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz
- License: [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- License evidence: https://en.wiktionary.org/wiki/Wiktionary:Copyrights
- Copyright notice: English Wiktionary entry text is copyright its respective contributors.
- Attribution: English Wiktionary contributors; structured extraction by Tatu Ylonen's Wiktextract and distribution by Kaikki.org.
- Changes: Chinese records were retained from the Wiktextract snapshot, then Mandarin records and fields were conservatively selected, normalized, routed through exact CC-CEDICT pronunciation evidence, and indexed by Syng Dictionary Creator. Deterministic simplified/traditional examples were paired, and missing script counterparts were generated as canonical display fallbacks without replacing source-attested text; quotations were excluded.

## PrincetonWordNet — morphology

- Revision: `Princeton WordNet 3.1`
- Material: https://wordnetcode.princeton.edu/wn3.1.dict.tar.gz
- License: [WordNet](https://wordnet.princeton.edu/license-and-commercial-use)
- License evidence: https://wordnet.princeton.edu/license-and-commercial-use
- Copyright notice: WordNet 3.1, Copyright 2011 Princeton University.
- Attribution: Princeton University WordNet 3.1 lexical database.
- Changes: Noun and verb lemmas and exception lists were parsed, normalized, filtered to families intersecting the English gloss corpus, and encoded as morphology mappings.

For English Wiktionary material, `wiktionary-attribution.json` links each affected lexical identity to its entry page and contributor history. The same attribution resource is available at the permanent, version-specific URL [wiktionary-attribution-4.1.0.json](https://github.com/sotch-pr35mac/chinese_dictionary/releases/download/v4.1.0/wiktionary-attribution-4.1.0.json). Wiktionary is also offered upstream under the GFDL; this bundle uses the CC-BY-SA-4.0 option.

WordNet-derived morphology is included under the separate Princeton WordNet license. The complete license text is provided in `LICENSE-WORDNET.txt`, which must accompany any redistribution containing that material.
