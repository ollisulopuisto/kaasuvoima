# Liikkeen vakiot

Pelin liikemalli on johdettu Super Mario Bros. 3:n julkisesti dokumentoidusta
disassemblysta (`captainsouthbird/smb3`, `PRG/prg008.asm`). Vakiot **ovat
käytössä**: ne kehitettiin haarassa `smb3-fysiikka`, joka on mergattu `main`iin.

Alkuperää koskeva harkinta on [DESIGN.md](DESIGN.md) kohdassa 4.

## Mikä muuttui

Nopeudet ovat pikseliä per frame 60 Hz:llä, eli SMB3:n 4.4-kiintopistetavu
jaettuna 16:lla. Suluissa alkuperäinen tavu.

| vakio | ennen | nyt | vaikutus |
| --- | --- | --- | --- |
| painovoima laskussa | 0.42 | **0.3125** (`$05`) | kellunta pitenee |
| painovoima nousussa, nappi pohjassa | 0.20 | **0.0625** (`$01`) | tämä on se iso: 1/5 laskusta, ei 1/2 |
| — ja se pätee vain kun `vy < -2.0` | ei rajaa | **`-$20`** | hypyn huippu terävöityy |
| putoamisen maksimi | 7.0 | **4.0** (`$40`) | putoaminen hidastuu roimasti |
| kävelykatto | 1.55 | 1.5 (`$18`) | — |
| juoksukatto | 2.70 | 2.5 (`$28`) | — |
| P-nopeus | 3.30 | 3.5 (`$38`) | — |
| kiihtyvyys | 0.085 / 0.125 | **0.0547** molemmille | B ei enää kiihdytä, se vain nostaa kattoa |
| kitka | 0.10 | 0.0391 pieni / 0.0547 iso | pysähtyminen liukuu |
| liu'un jarrutus | 0.30 | **0.125** (`$02`) | suunnanvaihto kestää |
| hypyn lähtönopeus | −4.75 − \|vx\|·0.28 | **−3.5** (`-$38`) + porras | neljä hyppykorkeutta, ei liukuva |
| ilmakitka | 0.75× kiihtyvyys | **ei mitään** | vauhti kantaa koko kaaren |
| tallauspomppu | −5.4 / −3.6 | **−4.0** (`-$40`) | — |
| hännän liito | 0.6…1.2 | **1.0** (`$10`) | — |
| lennon nousu | −3.0…−3.5 | **−1.5** (`-$18`) | — |
| P-mittarin tyhjennys | 1.6/frame | **24 framea per pykälä** | ja jäätyy ilmassa |
| coyote time | 5 framea | **0** | SMB3:ssa sitä ei ole |

Coyote time on `COYOTE_FRAMES` tiedostossa `src/entities/player.js`. Jos haara
tuntuu liian ankaralta, se on ensimmäinen numero jota kannattaa nostaa — se on
ainoa kohta jossa poikettiin tarkoituksella pelituntuman puolelle.

## Mitattu hyppybudjetti

`node tools/measure-jump.mjs` ajaa hypyt oikeassa moottorissa ja kirjoittaa
`tools/jump-budget.json`:n, jota `tools/gen-levels.mjs` käyttää. Numerot eivät
siis vanhene fysiikan mukana.

| tapaus | vauhti | nousu | kantama |
| --- | --- | --- | --- |
| paikaltaan, näpäytys | 0 | 31 px (1.9 ruutua) | 0 |
| paikaltaan, pohjassa | 0 | 121 px (7.6) | 0 |
| kävellen | 1.5 | 121 px (7.6) | 120 px (7.5) |
| juosten | 2.5 | 121 px (7.6) | 200 px (12.5) |
| P-nopeudella | 3.5 | 100 px (6.3) | 245 px (15.3) |
| juosten + pieruhyppy | 2.5 | 240 px (15.0) | 387 px (24.2) |

Suunnittelubudjetti jättää varaa mitattuun maksimiin: **kuilu 8 ruutua** (70 %
juoksuhypyn kantamasta), pieruhypyllä 13 (55 % sen kantamasta) ja seinä 6 (80 %
nousukorkeudesta). Aiempi budjetti oli 6 / 8 / 4, eli kentistä tuli väljempiä.

Huomaa että P-nopeus **madaltaa** hyppyä (kaari litistyy) mutta pidentää sitä —
juuri kuten alkuperäisessä.

## Mitä tämä teki vanhoille kentille

Maailmat 1–4 on suunniteltu vanhalle budjetille, joten ne ovat nyt
**helpompia**: kaikki kuilut ovat hyvin hypättävissä ja seinät matalia.
Maailma 5 on generoitu uudella budjetilla.

Tämä on tiedossa oleva avoin asia: maailmat 1–4 kannattaa joko käydä läpi käsin
tai generoida uudelleen samalla työkalulla.

## Säätäminen

```bash
python3 -m http.server 8000
node tools/measure-jump.mjs     # budjetti uusiksi jos säädät vakioita
node tools/gen-levels.mjs       # kentät uusiksi budjetin mukaan
node tools/verify.mjs
```
