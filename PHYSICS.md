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
| liu'un jarrutus | 0.30 | **0.125** (`$02`) | suunnanvaihto kestää, myös ilmassa |
| hypyn lähtönopeus | −4.75 − \|vx\|·0.28 | **−3.5** (`-$38`) + porras | neljä hyppykorkeutta, ei liukuva |
| ilmakitka | 0.75× kiihtyvyys | **ei mitään** | vauhti kantaa koko kaaren |
| tallauspomppu | −5.4 / −3.6 | **−4.0** (`-$40`) | — |
| hännän liito | 0.6…1.2 | **1.0** (`$10`) | — |
| lennon nousu | −3.0…−3.5 | **−1.5** (`-$18`) | — |
| P-mittarin tyhjennys | 1.6/frame | **24 framea per pykälä** | ja jäätyy ilmassa |
| coyote time | 5 framea | **5** | SMB3:ssa ei ole; pidetty tarkoituksella |
| hyppypuskuri | ei ollut | **6 framea** | SMB3:ssa ei ole; pidetty tarkoituksella |

**Kaksi tietoista poikkeamaa alkuperäisestä**, molemmat `src/entities/player.js`:ssä:
`COYOTE_FRAMES` (5) ja `JUMP_BUFFER_FRAMES` (6). SMB3:ssa kumpaakaan ei ole —
painallus framen etuajassa tai jäljessä katoaa. Se on aito, mutta langattomalla
näppäimistöllä ja modernilla näytöllä se tuntuu siltä että peli ei kuuntele.
Molemmat ovat niin pieniä ettei framen tarkkuudella pelaava huomaa niitä.

## Mikä on maan sääntö ja mikä ei

Kolme asiaa riippuu siitä onko jalat maassa. Alkuperäisessä
(`PRG/prg008.asm`, `Player_XAccelMain`-taulukon valinta) niitä on **kaksi**, ja
molemmat lukevat `Player_InAir`-lipun:

1. **Pelkkä kitka**, kun suuntaa ei paineta lainkaan. Ilmassa nopeus ei muutu:
   siitä syntyy "ei ilmakitkaa" -rivi yllä ja se on hypyn sitoutuminen.
2. **Kattoon palautuminen**, kun ollaan yli valitun huippunopeuden. Ilmassa
   ylinopeus säilyy.

Kolmas — **liu'un jarrutus** — ei ole maan sääntö. Haara joka valitsee sen
(`PRG008_ABB8`: "Player is pressing left/right", `INY INY`, sitten
`AND Player_MoveLR` → "suddenly reversed direction") ei katso `Player_InAir`ia
kertaakaan. Suunnan vaihtaminen kesken hypyn jarruttaa **samalla 0.125:llä**
kuin maassa.

Tässä moottorissa oli ylimääräinen `onGround`-ehto juuri siinä kohdassa, eli
ilmassa käännös jarrutti 0.0547:llä — vähemmän kuin puolet siitä mitä samalla
pelaajalla on jalat maassa. Se on korjattu (`src/entities/player.js`,
`skidding`). Mitattu vaikutus on alempana; hyppybudjettiin se ei koske
lainkaan, koska hyppy mitataan suunta pohjassa eikä liu'un jarrutus silloin
käynnisty.

Huom: nollattu coyote time paljasti aidon vian törmäyskoodissa — `onGround`
välkkyi paikallaan seistessä, koska laskeutumisen jälkeen jalat jäävät
lattiaruudun rajalle eikä sub-pikselin painovoima ylitä sitä. Se on korjattu
(`footingBelow` tiedostossa `src/level/physics.js`); jos coyote joskus nollataan
uudelleen, tuo korjaus on se joka pitää hypyt toimivina.

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

### Yllä oleva taulukko on vanhentunut — ja se on tarkoituksella jätetty

Sama komento ajettuna tässä puussa antaa muut luvut:

| tapaus | vauhti | nousu | kantama |
| --- | --- | --- | --- |
| paikaltaan, näpäytys | 0 | 21 px | 0 |
| paikaltaan, pohjassa | 0 | 71 px | 0 |
| kävellen | 1.5 | 78 px | 87 px |
| juosten | 2.5 | 85 px | 155 px |
| P-nopeudella | 3.5 | 100 px | 245 px |
| juosten + pieruhyppy | 2.5 | 174 px | 285 px |

Suunnittelubudjetiksi tuosta tulisi **6 / 9 / 4** eikä 8 / 13 / 6.

121 px ei ole nykyisillä vakioilla mahdollinen: lähtönopeudesta −3.5 päästään
0.0625:n painovoimalla arvoon −2.0 kahdessakymmenessäneljässä framessa (~66 px)
ja loput 0.3125 syö parissa kuudessa (~6 px). Eli **noin 72 px, ei 121.**
Jotain hypyssä on muutettu sen jälkeen kun budjetti viimeksi mitattiin.

Vanhoja lukuja ei ole korvattu tässä, koska **maailman 5 kentät on generoitu
niillä**: 8 / 13 / 6 on se mitta joka selittää nykyiset kuilut. Jos budjetti
mitataan uudelleen, `src/data/generated.js` pitää generoida samalla — muuten
kentät on suunniteltu mitalle jota ei enää ole. `tools/jump-budget.json` on
tästä syystä jätetty koskematta.

## Reaktiobudjetti — paljonko tilaa väistämiseen jää

`node tools/measure-braking.mjs` mittaa vastakkaisen kysymyksen kuin
`measure-jump`: en kysy pääsenkö sinne, vaan ehdinkö vielä olla menemättä.

**Jarrutus maassa** (kaikki voimatasot 1–5 käyttäytyvät samoin, taso 0 liukuu
pisimpään koska sen kitka on pienempi):

| vauhti | irrota ote | käänny vastaan | kyykky |
| --- | --- | --- | --- |
| 1.5 kävely | 28 f / 20 px | 14 f / 8 px | 20 f / 14 px |
| 2.5 juoksu | 46 f / 56 px | 20 f / 19 px | 33 f / 40 px |
| 3.5 P | 64 f / 110 px | 25 f / 36 px | 46 f / 78 px |

Taso 0 samoilla riveillä: 39 f / 28 px, 46 f / 56 px, 90 f / 155 px. Kyykky ei
ole pienelle mahdollinen.

**Missä matka oikeasti kuluu.** Juoksuvauhdilla hyppy kantaa 155 px ilmassa ja
laskeutumisen jälkeen jarrutukseen menee 24 px. Eli **87 % reaktiomatkasta on
ilmassa** — "maahantulon jälkeinen liuku" ei ole se mikä maksaa, vaan se ettei
kaaren aikana saanut tehdä mitään.

**Näkyvyys.** 320 px:n ikkuna, pelaaja hieman keskustan takana, katse kallistuu
vauhdissa 31–34 px eteenpäin: eteen näkyy **~176 px juostessa** ja ~179 px
P-nopeudella. Vihollinen ilmestyy ruudun reunaan sillä etäisyydellä.

**Paljonko tilaa väistäminen vaatii** (taso 1, käännös eri hetkillä):

| päätös | juosten 2.5 | P-nopeus 3.5 |
| --- | --- | --- |
| ponnistaessa | 12 px (7 % näkyvästä) | 19 px (11 %) |
| huipulla | 81 px (46 %) | 154 px (86 %) |
| vasta maassa | 116 px (66 %) | 202 px (**113 %**) |

Ennen liu'un jarrutuksen korjausta huipulla tehty päätös vaati 100 px
juostessa ja **183 px P-nopeudella eli 102 % siitä mitä ruudulle mahtuu** —
vihollinen oli väistämätön sillä hetkellä kun sen ehti nähdä. Nyt sama on
86 %.

Viimeinen rivi on yhä yli sadan, ja se on tarkoituksella: se on pelaaja joka ei
tehnyt mitään ennen kuin jalat osuivat maahan, P-nopeudella. P-nopeus on
pyydetty tila, ja sen hinta on että päätös on tehtävä ilmassa.

**Tallausikkuna** ei ole se ongelma. Juoksuvauhdilla ponnistusetäisyydet
15–54 px tuottavat tallauksen: **40 px eli 16 framea**. Alle 15 px törmää
kylkeen, yli 55 px laskeutuu ennen vihollista. P-nopeudella ikkuna on 40–47 px
eli 11–13 framea, ja se **levenee** voimatason mukana (taso 0: 38 px, taso 5:
47 px), koska isompi vartalo osuu aikaisemmin. Neljäsosasekunti ei ole tiukka.

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
node tools/measure-braking.mjs  # jarrutus, näkyvyys ja tallausikkuna
node tools/verify.mjs
```
