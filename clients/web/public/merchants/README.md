# Händler-Logos

Eine Datei pro Händler, benannt nach dem `logo_key` aus `budget.merchants`, zum Beispiel
`rewe.svg` für den Katalogeintrag REWE. Nur SVG. Fehlt die Datei, zeigt die Kachel das
Monogramm auf der Markenfarbe. Ein Logo nachzureichen ist deshalb ein Dateicommit und
braucht keine Migration.

## Automatisch holen

```
make merchant-logos                      # alle
make merchant-logos MERCHANTS="rewe dm"  # nur diese
```

`scripts/merchant-logos.mjs` liest `catalog.json`, holt die Logos von Wikimedia Commons und
schreibt die Nachweise nach `logos.lock.json`. Das Skript läuft nur von Hand, nie im Build:
was ausgeliefert wird, ist im Repo geprüft und hängt an keinem fremden Dienst.

Jeder Händler wird über die **Domain** zugeordnet, nicht über den Namen. Gesucht wird nach
dem Namen, übrig bleibt nur ein Wikidata-Eintrag, dessen offizielle Webseite (P856) auf der
erwarteten Domain liegt. Eine Namenssuche allein liefert zu oft die falsche Firma, eine
falsche Domain findet dagegen einfach nichts.

Eine Datei wird nur abgelegt, wenn sie alle vier Hürden nimmt:

1. **Lizenz** erlaubt Weitergabe (Public Domain, CC0, CC BY, CC BY-SA). Deutsche
   Schriftzüge sind meist gemeinfrei, weil ihnen die Schöpfungshöhe fehlt. Das Markenrecht
   bleibt davon unberührt und erlaubt, die Marke zu benennen.
2. **Format** ist `image/svg+xml` und höchstens 512 KB.
3. **Inhalt** ist harmlos. SVG ist ausführbarer Inhalt, deshalb fliegt alles mit `<script>`,
   Event-Handler, `<foreignObject>`, Entity-Deklaration, `@import` oder einem Verweis auf
   einen anderen Server raus. Verworfen, nicht repariert: was durchkommt, hätte auch ein
   Mensch durchgewunken.
4. **Seitenverhältnis** höchstens 2,2 zu 1. Commons hält überwiegend Schriftzüge, und ein
   Schriftzug im Verhältnis 7:1 ist in einer 28 Pixel breiten Kachel vier Pixel hoch und
   unlesbar. Breitere bleiben beim Monogramm.

Was nicht durchkam, steht mit Grund und Quell-URL in `logos.rejected.json`. Da lohnt ein
Blick, bevor man ein Logo von Hand sucht.

## Von Hand ablegen

Geht jederzeit. Datei unter `<logo_key>.svg` ablegen, am besten quadratisch oder nah dran,
und in `logos.lock.json` eine Zeile mit Quelle und Lizenz ergänzen, damit nachvollziehbar
bleibt, woher sie kommt. Nur Logos ablegen, die wir weitergeben dürfen.

## Dateien hier

| Datei | Was drin steht |
| --- | --- |
| `catalog.json` | Händler, Schlüssel und Domain. Eingabe für das Skript. |
| `logos.lock.json` | Was ausgeliefert wird: Wikidata-ID, Commons-Datei, Lizenz, Quelle, SHA-256. |
| `logos.rejected.json` | Was gefunden, aber nicht genommen wurde, mit Grund. |
| `<key>.svg` | Das Logo selbst. |

Die Schlüssel des mitgelieferten Katalogs stehen in
`backend/src/Household.Api/Features/Budget/Merchants/MerchantPersistence.cs`.
