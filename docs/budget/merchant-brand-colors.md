# Markenfarben der Katalog-Händler

Die Farbe hinter dem Monogramm einer Händlerkachel. Sie steht in der Spalte `color` von
`budget.merchants` und kommt über die Migration dorthin; diese Datei sagt, woher jeder Wert
stammt. Ohne Farbe fällt die Kachel auf den Hash-Farbton zurück, der aus dem Namen berechnet
wird, also sieht sie nie kaputt aus.

Ein Hexwert ist eine Tatsache, keine geschützte Grafik. Eine Kachel in der echten Markenfarbe
ist deshalb der risikoärmste Weg, einen Händler auf 28 Pixeln erkennbar zu machen.

**Regel: kein Wert ohne Quelle.** Wenn für eine Marke keine belegbare Quelle zu finden ist,
bleibt die Zeile leer. Ein falscher Wert ist schlimmer als keiner, und aus dem Gedächtnis
getippte Farben sind in diesem Projekt schon einmal falsch gewesen.

## Aus dem Datensatz von Simple Icons

35 Werte stammen aus `data/simple-icons.json` von [Simple Icons](https://simpleicons.org)
(CC0-1.0, keine Abhängigkeiten). Jeder Eintrag dort führt ein `source`-Feld auf die Seite der
Marke. Übernommen wurde nur der Hexwert, keine Grafik.

REWE `#CC071E` · EDEKA `#1B66B3` · Lidl `#0050AA` · Kaufland `#E10915` · Penny `#CD1414` ·
Netto `#FFE500` · dm `#002878` · Rossmann `#C3002D` · Müller `#F46519` · eBay `#E53238` ·
Otto `#D4021D` · Zalando `#FF6900` · MediaMarkt `#DF0000` · Saturn `#EB680B` · IKEA `#0058A3` ·
H&M `#E50010` · KiK `#82BC23` · Aral `#0063CB` · Shell `#FFD500` · JET `#FBBA00` ·
McDonald's `#FBC817` · Burger King `#D62300` · Starbucks `#006241` · Netflix `#E50914` ·
Spotify `#1ED760` · Steam `#000000` · Apple `#000000` · Google `#4285F4` · Telekom `#E20074` ·
Vodafone `#E60000` · o2 `#0050FF` · 1&1 `#003D8F` · Deutsche Bahn `#F01414` · DHL `#FFCC00` ·
Hermes `#0091CD`

## Von der Marke selbst recherchiert

Diese 14 Werte stammen direkt aus einem Asset oder Design-Token der Marke.

| Händler | Hex | Quelle |
| --- | --- | --- |
| ALDI SÜD | `#00005F` | `dm.emea.cms.aldi.cx/is/content/aldiprodeu/brandsymbol-blue`, einziger Fill der Brandsymbol-SVG |
| Alnatura | `#B6CD35` | `alnatura.de/-/media/Images/Alnatura/Logo.svg`, Grünfläche des Logokreises |
| Amazon | `#FF9900` | Logo Usage Guidelines (PDF), Swatch „RGB Amazon Orange" 255/153/0 |
| Bauhaus | `#CC0000` | `bauhaus.se/.../images/logo.svg`, `header-logo__color--red`. bauhaus.info sperrt Abrufe |
| Conrad | `#4281FF` | `platform.conrad.de/etc/designs/platform/icons/conrad_logo.svg` |
| Decathlon | `#0082C3` | Design-System Vitamin, `--vtmn-color_brand` |
| Deichmann | `#008E54` | `corpsite.deichmann.com/logo-deichmann.svg`, Hauptpfad |
| DocMorris | `#00463D` | `docmorris.de/assets/svg/logo.svg`, Wortmarke |
| FlixBus | `#97D700` | Design-System Hive, `--flix-brand-primary-color` |
| Hornbach | `#F79E1C` | `media.hornbach.de/webshop-commons/650/images/logo.de-DE.v1.svg`, Orangefläche |
| Lieferando | `#FF8000` | Design-System PIE von Just Eat Takeaway, `color-orange-30` als Marken-Orange |
| Shop Apotheke | `#ED0334` | Logo-SVG aus dem Seitenkopf von `shop-apotheke.com` |
| Snipes | `#494B52` | `asset.snipes.com/image/upload/snipes_logo_dark.svg`, Wortmarke |
| toom | `#C90C0F` | Cross Channel Design Guide, `toom Rot` |

## Gefunden, aber bewusst nicht übernommen

| Händler | Wert | Warum nicht |
| --- | --- | --- |
| About You | `#E6E6E7` | Ist die PWA-Chromfarbe aus `manifest.json`, keine Markenfarbe. Fast weiß, als Kachel unbrauchbar. Das Logo selbst ist schwarz, dafür gibt es keinen Beleg. |
| Douglas | `#2F2F2F` | Gehört zur Dachmarke DOUGLAS Group, nicht zum Parfümeriegeschäft. `douglas.de` antwortet mit 403, Retail-Logos gibt es nur als EPS und PNG. |
| Microsoft | `#F25022` | Eines von vier Logoquadraten. Microsoft weist keines davon als Primärfarbe aus, ein Quadrat allein stellt die Marke falsch dar. |

## Ohne Beleg

Norma, Bio Company, Cyberport, OBI, Action, TEDi, C&A, Esso, TotalEnergies, Subway, Disney+,
Fressnapf, Thalia.

Gescheitert ist es meist an einem der drei Gründe: die Seite sperrt automatisierte Abrufe
(Cyberport, C&A, OBI), das Logo liegt nur als PNG oder ZIP vor (Norma, Bio Company), oder das
Markenportal steht hinter einem Login (Esso, TotalEnergies). Wer den Wert von Hand findet,
trägt ihn hier mit Quelle nach und ergänzt ihn per Migration.
