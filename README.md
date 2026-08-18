# Kaasuvoima

Selaimessa pyörivä tasohyppely: oma **maailmankarttamoottori** (solmut, polut,
avautuvat reitit, hernetalot) ja oma **kenttämoottori** (ruutupohjainen kenttä,
alipikselifysiikka, viholliset, viisiportaiset tehostukset, maalikortti).

Ei riippuvuuksia, ei build-vaihetta, ei kuva- tai äänitiedostoja — kaikki
grafiikka piirretään ja kaikki äänet syntetisoidaan ajossa.

Grafiikka, kentät, hahmot ja nimet ovat omia. **Musiikki on omaa sävellystä tai
tekijänoikeudesta vapautunutta sävelmistöä**, ja vapautunut nimetään aina
säveltäjineen ja vuosineen — sävelet kirjoitetaan käsin nuotti kerrallaan, joten
mukaan ei tule äänitettä eikä nuottilaitosta, jotka ovat omine oikeuksineen eri
teoksia kuin vapautunut sävellys. Koko lista ja perustelu ovat
[DESIGN.md](DESIGN.md):n kohdassa 1 b.

**Pelattavissa: <https://kaasuvoima.vercel.app>**
(varareitti: <https://ollisulopuisto.github.io/kaasuvoima/>)

| Dokumentti | Sisältö |
| --- | --- |
| [DESIGN.md](DESIGN.md) | suunnitteluperiaatteet, kenttäsuunnittelun säännöt ja sisällön alkuperä |
| [CHANGELOG.md](CHANGELOG.md) | muutokset perusteluineen (CalVer) |
| [PHYSICS.md](PHYSICS.md) | liikkeen vakiot ja mitattu hyppybudjetti |
| [IDEAS.md](IDEAS.md) | lainattavia mekaniikkoja ja niistä johdettuja omia — harkittavaksi, ei päätettyä |

Moottorin kompastuskivet ovat [DESIGN.md](DESIGN.md):n kohdassa 6 — lue ne
ennen kuin muutat moottoria.

---

## Käynnistys

ES-moduulit vaativat http-palvelimen, eli `index.html` suoraan tiedostona ei riitä.

```bash
python3 -m http.server 8000    # tai npm start
# http://localhost:8000
```

## Näppäimet

Molemmat käsijärjestykset ovat käytössä yhtä aikaa, eli mitään tilaa ei tarvitse
valita. Näppäimet luetaan fyysisinä paikkoina (`event.code`), joten
näppäimistöasettelu ei siirrä niitä.

| Toiminto | Ohjaus oikealla kädellä | Ohjaus vasemmalla kädellä |
| --- | --- | --- |
| Liikkuminen | nuolet | W A S D |
| Hyppy | **Z** tai välilyönti | **L** tai **.** tai välilyönti |
| Juoksu / pieru | **X** tai vaihto | **K** tai **,** |

| Näppäin | Toiminto |
| --- | --- |
| hyppy ilmassa uudestaan | **pierupomppu** (pierusieni) |
| **alas + hyppy ilmassa** | **maahanisku** — toimii joka voimatasolla |
| juoksunäppäin | pierupallo (kukka) · häntäisku (lehti) |
| alas | kyykky · pudotus puulavan läpi |
| Enter | tauko kentässä · kartalla käytä varastoesine |
| juoksunäppäin (X/K) | alkuruudussa ja pistetaulussa: **kerro kaverille** (jakoruutu) |
| M tai 0 | äänet päälle/pois |
| 1 / 2 | tallenna tila / lataa tila |
| 3 | vaihda tallennuspaikkaa (1–3) |
| 6 | kosketusohjaus esiin / vaihda malli |
| 7 | kuvaefektit: ei efektejä → hehku → kuvaputki |
| 8 | vie pelidata tiedostoon (JSON) |
| 9 | debug-ruutu: fps, framebudjetti, entiteetit, pelaajan tila, soiva raita, lämpökartta |
| 5 | **aika-ajossa**: nollaa kentän ennätysajat (kysyy varmistuksen) |

F5 / F8 / F6 / F3 toimivat myös, jos käyttöjärjestelmä ei vie niitä — macOS vie.

Apuvälineet ovat numerorivillä eivätkä missään muualla. `event.code` on
fyysinen paikka, mutta **mikä fyysinen paikka riippuu siitä onko näppäimistö
ANSI vai ISO**, ja ne eroavat juuri vasemmasta alakulmasta jossa toimintonäppäimet
ovat. Debug oli aiemmin myös `Backquote`illa, joka on Macin ISO-näppäimistöllä
vasemman vaihdon ja Z:n välissä — yhden näppäimen päässä hypystä.
### Peliohjain

Standard-kuvauksen mukainen ohjain toimii yhtä aikaa näppäimistön kanssa, eikä
mitään tilaa tarvitse valita: napit 0 ja 1 ovat hyppy, 2 ja 3 juoksu, 9 start
(tauko), 12–15 ristiohjain ja vasen tatti ohjaa 0,4:n kuolleen alueen jälkeen.

**Ohjain ei kuitenkaan saa ääniä päälle.** Selain avaa äänen vain käyttäjän
eleestä, ja ohjaimen napin painallus ei ole sellainen — ei millään selaimella,
eikä sitä voi kiertää yrittämällä uudestaan. Jos siis nostat ohjaimen käteesi
etkä koske näppäimistöön, peli on hiljaa. Peli sanoo sen itse ruudun yläreunassa
(`OHJAIN EI AVAA ÄÄNTÄ - PAINA NÄPPÄINTÄ`) heti kun ohjaimelta tulee syötettä ja
ääni on silti kiinni. **Yksi näppäimen painallus tai ruudun kosketus riittää
lopullisesti.** Vihjeen saa pois yhdellä painalluksella, ohjaimenkin napilla —
silloin peli jää hiljaiseksi, ja se on kuitenkin oma valinta eikä yllätys.

**Apunäppäimet eivät ole ohjaimessa.** Tallennus, latauspaikka, kuvaefektit,
pelidatan vienti, mykistys ja debug-ruutu ovat numerorivillä, koska ohjaimessa
ei ole yhdeksää nappia joita peukalo ei osu kesken hypyn. Ohjaimella pelataan,
näppäimistöllä myös hallitaan.

**Ei-standardi ohjain** (`mapping !== 'standard'`) luetaan vain napeista: silloin
selain itse ilmoittaa ettei tiedä mitä akselit ovat, ja akseli 0 voi olla tatti,
hattukytkin tai liipaisin joka lepää arvossa -1 — jolloin hahmo kävelisi vasemmalle
ikuisesti ilman että kukaan koskee mihinkään. Väärä nappi on hiljaa kunnes sitä
painetaan, väärä akseli painaa itse itseään. Tukematta jäävät siis ei-standardin
ohjaimen tatit ja akselille ilmoitettu ristiohjain; uudelleenmäärittelyä ei ole
lainkaan.

## Pisteet, kolikot ja mittarit

Mistä pisteitä tulee ja mitä ne tekevät:

| Teko | Pisteet | Muu vaikutus |
| --- | --- | --- |
| Kolikko | 200 | **100 kolikkoa = lisäelämä**, laskuri nollautuu sadalla |
| Mönkijän tallaus | 100 | |
| Kilpikonna | 100 | jää kuoreksi, jonka voi potkaista |
| Lentäjä, ruskea pilvi, ummetuskorkki | 200 | |
| Tiilen rikkominen | 50 | |
| Tehostuksen poiminta | 1000 | täydellä voimalla se menee varastoon |
| Hernekeitto täydellä voimalla | 5000 | |
| Pomon kaato | 5000–8000 | avaa linnakkeen oven |
| Kentän läpäisy | jäljellä oleva **aika × 50** | eli nopeus palkitaan |

Pisteet näkyvät HUDissa, kartalla ja lopputekstissä, ja pelin päätyttyä ne
menevät **pistetauluun** (10 parasta, oma nimi). Jos ajon aikana on ladattu
tilatallennus, nimen perässä on tähti — kelattu suoritus ei kuulu samaan
sarakkeeseen kelaamattoman kanssa ilman merkintää.

**Maalikortit:** jokaisesta läpäistystä kentästä saa kortin. Kolme korttia
laukeaa: kolme samaa antaa 2 (sieni), 3 (kukka) tai 5 (tähti) lisäelämää,
sekalainen kolmikko yhden.

**Vauhtimittari (P)** täyttyy kun juokset maassa täydellä juoksuvauhdilla:
seitsemän pykälää, kukin kahdeksan framea, eli alle sekunnissa. Ilmassa mittari
jäätyy — paitsi lehden lennon aikana, jolloin se valuu ja lento loppuu kun se
tyhjenee. Maassa se valuu hitaammin kuin täyttyy (24 framea per pykälä). Täysi
mittari tekee kaksi asiaa:

1. **Nopeuskatto nousee** juoksuvauhdista 2,5 → 3,5 pikseliin per frame.
2. **Kaasulehdellä se avaa lennon** — täydellä mittarilla hyppy lähtee lentoon.

Mittari ei vaikuta pierupomppuun: se tulee voimatasosta, ei vauhdista.

**Aika** kuluu yhden yksikön 24 framessa. Kentän kello lasketaan kentän
pituudesta, joten pitkä kenttä saa pidemmän ajan. Alle sadassa musiikki alkaa
kiirehtiä.

## Voimatasot 1–5

Tehostukset kasautuvat: jokainen kerätty tehostus nostaa tasoa yhdellä (max 5),
ja **jokainen taso kasvattaa hahmoa ja vahvistaa sitä ominaisuutta**, jonka
tehostus antaa. Osuma pudottaa yhden tason — tasolla 0 osuma tappaa.

| Tehostus | Ominaisuus | Mitä taso tekee |
| --- | --- | --- |
| **Pierusieni** | tuplahyppy: hyppää ilmassa uudelleen ja pieru nostaa ylemmäs | tasoja vastaava määrä ilmahyppyjä (taso 5 = 5 kpl) |
| **Pierukukka** | ammu pierupalloja | enemmän palloja kerralla ja yhtä aikaa ilmassa |
| **Kaasulehti** | häntäisku, liito ja lento täydellä vauhtimittarilla | pidempi lento, pidempi häntäisku |
| **Hernekeitto** | +1 taso nykyiseen voimaan | parantaa myös ummetuksen |

Ilmapierun purkaus kaataa alapuolella olevat viholliset, ja tasolta 4 ylöspäin
hahmo jyrää tiiliä juoksemalla niiden läpi.

**Kolme liikettä rikkoo tiilen**, ja niillä on sama sopimus: vain tavallinen
tiili, eikä tiili joka piilottaa jotain — sen palkinto kuuluu sille joka puskee
sen alta.

| Liike | Mistä suunnasta | Ehto |
| --- | --- | --- |
| pusku (ummetuspurkka) | kyljestä juosten | tehostus |
| **häntäisku** | kyljestä, siltä puolelta jonne häntä osoittaa | kaasulehti |
| **maahanisku** | jalkojen alta | voimataso 3 ja pudotus vähintään puolet huoneesta |

Maahaniskun tiilireikä on tasan iskun oman säteen levyinen, eli sen kokoinen
kuin isku näytti olevan — ja siitä putoaa läpi, mikä on liikkeen paras palkinto
ja samalla sen hinta.

Tehostus ei ole koskaan pakollinen: **maareitti on läpäistävissä pienimmällä
koolla**, ja pierupomppu avaa korkeat reitit ja palkinnot. Generoiduissa
kentissä tämä on koneellisesti tarkistettu; käsintehdyissä se on
suunnitteluperiaate, ei automaattinen takuu. Ks. [DESIGN.md](DESIGN.md) kohta 5.

## Vaarat

* **Ummetuskorkki** ei vahingoita vaan **korkkaa**: kaikki kaasuvoimat
  (tuplahyppy, pierupallot, lento, häntä) menevät poikki muutamaksi sekunniksi.
  HUD näyttää laskurin. Hernekeitto tai mikä tahansa tehostus avaa korkin heti.
* **Närästys** on lattiasta purkautuva liekkisuihku. Se varoittaa välähdyksellä
  ennen syöksyä, joten se on ajoituspulma — osuma polttaa yhden voimatason.
* **Ruskeat pilvet** leijuvat ilmassa ja ajelehtivat pelaajaa kohti.
* **Vihainen aurinko** roikkuu aavikon taivaalla ja syöksyy kaaressa pelaajan
  lävitse. Sitä ei voi tömäyttää; kolme pierupalloa tai häntäiskua sammuttaa sen.
* **Putkikasvi** nousee putkesta. Se ei nouse jos seisot putken päällä, ja se voi
  satuttaa vasta kun siitä on vähintään puoli ruutua näkyvissä.
* **Kurnuttaja** asuu kuilun pohjalla ja loikkaa sieltä suoraan ylös. Sitä ei voi
  tallata — päälle laskeutuminen tarkoittaisi kuilun ylle laskeutumista — mutta
  pierupallo, häntäisku ja liukuva kuori kaatavat sen, ja supertähti kantaa sen
  yli. Se varoittaa ensin: kolosta nousee kuplapatsas ja kuuluu kiihtyvä
  kurnutus **puolitoista sekuntia** ennen loikkaa, mikä on pidempään kuin pisin
  hyppy on ilmassa — eli varoitus ehtii aina ennen kuin lähdet maasta. Loikka
  pysyy oman kuilunsa sarakkeessa, joten reunalla seisominen on turvallista.

## Maailmat

| Maailma | Teema | Pomo |
| --- | --- | --- |
| 1 PAPULAAKSO | niityt | linnakkeen pomo: kävelee ja hyppii |
| 2 HIKIHIEKKA | aavikko | sama pomo uutena versiona: laskeutuminen synnyttää maa-aaltoja |
| 3 JÄÄTÄVÄ VETO | jää | nopeampi versio, joka syöksyy pelaajaa kohti |
| 4 PIERUTEHDAS | tehdas | **PIERUPRINSSI**, joka pullistuu jokaisesta osumasta 3-kertaiseksi |
| 5 JÄLKIPYYKKI | sekateema | uusintaottelu prinssin kanssa |
| 6 LUULAAKSO | hautausmaa keskiyöllä | **LUURANKO**, joka hajoaa jokaisesta osumasta ja kokoaa itsensä |
| 7 KAASUKEHÄ | pilvikerroksen päällä | **SÄÄHERRA**, joka nousee ilmaan jokaisesta osumasta |
| 8 VIIMEINEN LINNAKE | linnake, ei ulkopuolta | seitsemän uusintaa ja **PIERUKUNINGAS**, joka vastaa osumaan ottamalla seuraavan linnakkeen liikesarjan |

Maailmassa on hernetalo, linnake ja **seitsemän kenttää**: kaikki kahdeksan
maailmaa ovat kahdeksan kentän mittaisia, eli peli on 64 kenttää. Kentän
läpäisy avaa siitä lähtevät polut; linnakkeen pomon kaato avaa seuraavan
maailman.

**Maailma 2 haarautuu, ja siellä kahdeksan kenttää tarkoittaa kahta asiaa.**
Kartalla on kahdeksan solmua kuten muissakin, mutta `2-2` on risteys: HIEKKATIE
ja LAAVATIE yhtyvät vasta kentässä `2-4`, joten yhtä reittiä kulkeva pelaaja
kävelee kuusi kenttää ja toista seitsemän. Molemmat luvut ovat portissa
(`tools/verify.mjs`): jokainen reitti kävelee vähintään kuusi maailman
kahdeksasta kentästä eikä reittien ero ole yhtä suurempi, eli valinta saa
piilottaa neljänneksen maailmasta muttei enempää.

**Maailma 8 on eri muotoinen kuin muut, ja se on tarkoitus.** Siinä ei ole
yhtään lippua: jokainen kahdeksasta kentästä päättyy oveen, ja seitsemän
ensimmäistä ovat uusintoja maailmojen 1–7 linnakepomoja vastaan siinä
järjestyksessä kuin ne tulivat — jättiläinen kahdesti, koska linna lähetti
hänet kahdesti. Kahdeksas on pelin ainoa megapomo, eikä hän ole isompi vaan
**eri**: jokainen muu pomo vastaa osumaan kasvattamalla yhtä omaa lukuaan,
kuningas vaihtamalla itsensä joksikin toiseksi.

Kahdeksan kentän maailman muoto on `W-1`…`W-7` ja `W-F`, ja sen
vaikeuskäyrässä on **kaksi hengähdyskenttää** yhden sijaan — perustelu on
[CHANGELOG.md](CHANGELOG.md):ssä ja sääntö on `tools/verify.mjs`:ssä.

Kentät **1-4…1-7, 3-4…3-7, 4-4…4-7, 5-1…5-7, 6-4…6-7 ja 7-4…7-7 ovat
generoituja** — 27 kenttää kuudestakymmenestäneljästä: rytmi tulee mitatuista
tilastoista, palikat pelin omasta sanastosta, ja jokainen kantaa merkinnän siitä
onko sen alkuperäisyys tarkistettu korpusta vasten (kaikki 27 on, osumia 0).
Linnakkeet ja maailman opettavat kentät ovat käsintehtyjä. Ks. [DESIGN.md](DESIGN.md) kohta 3.

## Vaikeustasot

Alkuruudun **UUSI PELI** kysyy ensin, ja valinta kulkee tallennuksen mukana:
JATKA PELIÄ jatkaa sitä peliä jota oltiin pelaamassa eikä kysy uudestaan.

| Taso | Kentän pituus | Vihollisia |
| --- | --- | --- |
| **HELPPO** | kuten ennen | kuten ennen |
| **NORMAALI** | kaksinkertainen | kolminkertaisesti |
| **VAIKEA** | kolminkertainen | noin viisinkertaisesti |

**HELPPO on merkilleen se peli joka datatiedostoissa lukee** — ei yhtä laattaa,
ei yhtä vihollista eroa. Se on ehto eikä tyylivalinta: kaikki mitattu
(`src/data/difficulty.js`, `tools/curriculum.mjs`, `tools/variety.mjs`) koskee
sitä kenttää, ja portti vertaa rivi riviltä että näin on.

Pidempi kenttä **toistaa omia tahtejaan**: ruudukosta etsitään sarakkeet joissa
on pelkkää maata ja tyhjää ja joiden kummallakin puolella on kuusi saraketta
samaa maastoa — ensimmäinen ehto pitää liitoksen ehjänä, toinen jättää kuilun
eteen vauhdinoton — ja niiden väliset pätkät monistetaan paikalleen.
Uutta maastoa ei generoida — käsintehdyn kentän jatkaminen arvotulla maastolla
tekisi siitä kaksi kenttää joilla on sama nimi. Rajaukset ovat
[src/data/scale.js](src/data/scale.js):ssä ja lyhyesti: avausneljännestä ei
toisteta, ainutkertaista (aloitus, lippu, pomo, ovi, kytkin, papuvarsi,
lämpöputki, tähtilaatta) ei monisteta, järjestys ei muutu, eivätkä
kiipeilykentät (6-K, 7-T) veny lainkaan.

Lisäviholliset ovat **niitä lajeja jotka kentässä jo ovat**, eli jäämaailmaan ei
ilmesty aavikon otusta. Arvonta on siemenetty kentän tunnuksesta ja tason
nimestä: sama kenttä samalla tasolla on joka kerta sama kenttä.

Kello venyy pituuden mukana (katto 999 aikayksikköä), aika-ajon ennätykset
kirjataan tasoittain — NORMAALIn 2-3 on eri rata kuin HELPON 2-3 — ja **päivän
pieru ei veny**: yksi yritys päivässä ja sama kenttä kaikille on eri lupaus kuin
vaikeustaso.

Jokainen kenttä jokaisella tasolla ajetaan portin läpi samoilla
kenttäsuunnittelun säännöillä kuin käsintehdyt: `npm run verify`. Maaston
läpäisyn mittaa erikseen botti, joka ei osaa muuta kuin juosta oikealle ja
hypätä:

```bash
node tools/playable.mjs --mode hard   --frames 26000
node tools/playable.mjs --mode normal --frames 18000
```

Kolme linnakekäytävää (6-F, 7-F, 8-5) ei veny: niissä ei ole kahtatoista
saraketta samaa maastoa ennen pomoareenaa. Ne saavat silti lisää vihollisia.

## Päivän pieru

Alkuruudun kolmas valinta: **yksi generoitu kenttä vuorokaudessa, yksi yritys,
sama kenttä kaikille.** Kenttä rakennetaan selaimessa samasta generaattorista ja
samoista mitatuista rytmiluvuista kuin pelin 27 generoitua kenttää — siemen on
päivämäärä, ei satunnaisluku.

- **Päivä on UTC-vuorokausi**, myös ruudulla lukeva päiväys. Yksi kello on koko
  tilan ehto: eri kello Helsingissä ja Kaliforniassa tarkoittaisi eri kenttää
  samalla päivämäärällä.
- **Yritys kuluu kun kenttä alkaa.** Sivun lataus kesken kentän ei anna uutta
  yritystä eikä nollaa tulosta: se on luovutus siihen kohtaan johon pääsit.
  Tulos on `sfb3.daily.v1`, oma avaimensa eikä osa pelin tallennusta — päivän
  yritys ei koske pelaajan elämiin, pisteisiin eikä maailmoihin.
- **Jaettava rivi ei paljasta kentästä mitään**: päivä ja tulos, ei teemaa eikä
  sitä mihin jäit kiinni. X avaa jakoruudun päivän tulosruudusta.
- **Jokainen päivän kenttä on tarkistettu etukäteen.** Selaimessa ei voi verrata
  korpukseen eikä ajaa bottia, joten koko ikkuna luetteloidaan Nodessa:
  `VGLC_DIR="…" node tools/daily-origin.mjs` generoi jokaisen päivän kentän,
  vertaa sen korpukseen ja pelaa sen läpi voimatasolla 0. Repoon jää pelkkä
  tuomio (`src/data/daily-origin.js`). Ikkunan ulkopuolella tila **ei tarjoa
  kenttää** — tarkistamaton päivän kenttä olisi huonompi kuin ei kenttää. Ks.
  [DESIGN.md](DESIGN.md) kohdat 3 ja 5.

## Työkalut

```bash
npm i -D playwright && npx playwright install chromium   # kerran

node tools/verify.mjs        # headless-tarkistus: kaikki kentät + mekaniikat
node tools/playable.mjs      # pelkkä geometria: onko kentät läpäistävissä ilman tehostuksia
node tools/playable.mjs --mode hard --frames 26000  # ...ja venytettynä (vaikeustaso)
node tools/measure-jump.mjs  # mittaa hyppybudjetin ajamalla hypyt moottorissa
node tools/gen-levels.mjs    # generoi kaikki generoidut kentät tilastoista
node tools/gen-levels.mjs --world w3               # ...vain yhden maailman
node tools/gen-levels.mjs --telemetry loki.json    # ...ja säätää niitä pelidatan mukaan
node tools/originality.mjs   # vertaa committoidut kentät korpukseen (vaatii VGLC_DIR)
node tools/daily-origin.mjs  # tarkistaa päivän pierun koko ikkunan (vaatii VGLC_DIR)
node tools/mirror-pacing.mjs # kantaa mitatut luvut selaimen luettaviksi (src/data/pacing.js)
node tools/difficulty.mjs    # vaikeuskäyrä; --write päivittää src/data/difficulty.js
node tools/curriculum.mjs    # opetusjärjestys: missä mikäkin asia kohdataan ensi kertaa
node tools/variety.mjs       # vaihtelu: sanooko maailma saman asian kahdesti (--raw lisää palikkatoiston)
node tools/make-card.mjs     # päivittää linkkien esikatselukuvan card.png
```

Kaksi viimeksi mainittua ovat **mittareita eivätkä portteja** — `verify.mjs` ei
lue niiden tuomiota, ja niiden luvut ovat vertailevia (peli itseensä nähden)
eivätkä absoluuttisia kuten vaikeusmittarin. Ne vastaavat kahteen eri
kysymykseen samasta datasta: curriculum kysyy *milloin* asia opetetaan, variety
*kuinka monesti se sanotaan uudelleen*.

**Generoi ennen kuin kytket kartalle.** `gen-levels.mjs` lataa vaikeusmittarin,
joka kävelee koko pelin, joten se kaatuu jos `src/data/worlds.js`:ssä on solmu
kenttään jota ei vielä ole. Järjestys on: generoi → levitä `levels/worldN.js`:ään
→ lisää solmut kartalle → `node tools/difficulty.mjs --write`.

`verify.mjs` tarjoilee sivuston itse, ajaa botin läpi jokaisen kentän ja
tarkistaa mekaniikat, tilatallennuksen, pistetaulun, grafiikan ja äänet. Se
palauttaa nollasta poikkeavan paluuarvon jos jokin menee rikki. Botti osaa vain
juosta ja hypätä, joten sen kuolemat vihollisiin ovat normaalia — merkitseviä
ovat FAILURES-listan rivit.

**Generoitujen kenttien siemen valitaan mittaamalla.** Aja generaattori usealla
siemenellä ja päästä läpi vain se jolla kaikki kentät menevät `playable.mjs`:ssä
läpi voimatasolla 0 — muuten "uudet kentät" tarkoittaa tuntemattoman laatuisia
kenttiä. Maailman 5 nykyinen siemen on **60606**, ja se valittiin näin.

Kentät joilla on `aim`-luku suunnitelmassa valitsevat siemenensä itse: haku
kokeilee 80 siementä, hylkää jokaisen joka rikkoo säännön, ja pitää niistä
kelvollisista sen jonka mitattu vaikeus on lähimpänä tavoitetta. Tavoite on
suunnittelupäätös joka tehdään ensin — haku ei voi ostaa lukua kentällä joka ei
kelpaa muutenkin.

**Alkuperäisyys on merkintä datassa.** Jokainen generoitu kenttä kantaa
`origin`-kentän: `'checked'` tarkoittaa että korpus luettiin ja osumia oli 0,
`'not checked'` että tarkistusta ei tehty. `verify.mjs` kaatuu jos merkintä ja
ympäristö ovat ristiriidassa kumpaan tahansa suuntaan. Ks. DESIGN.md kohta 3.

`playable.mjs` kysyy yhden asian: onko *maasto* läpäistävissä. Se poistaa kaikki
viholliset ja vaarat ja ajaa botin läpi kahdesti — kerran voimatasolla 0
(suunnittelulupaus: maareitin pitää aueta pienimmällä koolla) ja kerran
tuplahypyllä. Ero näiden välillä kertoo onko kenttä rikki vai vain vaativa.

`--mode` ajaa saman venytetylle kentälle, ja se on työkalun paras yksittäinen
saalis: vaikeustasojen ensimmäinen versio läpäisi `validateLevel`in jokaisella
tasolla ja **kaatui tässä viidessä kentässä**, koska ehjä sauma voi silti syödä
kuilun edestä vauhdinoton. Framebudjetti pitää nostaa mukana — 7000 framea
riittää 400 sarakkeen kenttään eikä 1200:n.

Se **ei kaada ajoa** ilman `--strict`-lippua, ja syy on tärkeä: botti osaa vain
juosta oikealle ja hypätä. Se ei osaa hypellä kelluvalta lavalta toiselle, mennä
kyykkyyn, käyttää putkia, potkia kuorta eikä odottaa liikkuvaa lavaa. Useampi
kenttä on rakennettu juuri niiden varaan, ja silloin botin "umpikuja" on botin
rajoitus. Heuristiikka joka kaataisi ajon johtaisi käsintehtyjen kenttien
korjaamiseen huonon botin mieliksi — se on väärinpäin.

Rytmitilastojen louhinta vaatii ulkoisen korpuksen, jota **ei säilytetä
repossa**:

```bash
git clone --depth 1 https://github.com/TheVGLC/TheVGLC /tmp/vglc
VGLC_DIR="/tmp/vglc/Super Mario Bros/Processed" node tools/mine-pacing.mjs
```

## Salaisuudet

Maailman 1 kenttä 1-2 on **48 riviä korkea**: pilvien yllä on taivaskaista ja
maan alla suljettu luolahuone. Kumpaankaan ei tarvita kohtausvaihtoja — sama
ruudukko, korkeampi kenttä, ja kamera pysyy siinä kaistassa jossa pelaajan jalat
ovat.

- **Pavunvarsi** (`v`) sarakkeessa 150: sitä ei ole siellä ennen kuin sen
  tavallisen näköinen `?`-lohko lyödään. Lohko pudottaa pavun, papu putoaa
  lattialle ja varsi kasvaa siitä ruutu kerrallaan taivaaseen. Sitten: pidä ylös
  pohjassa kiivetäksesi, hyppy irrottaa, ja takaisin pääsee kävelemällä lavan
  reunan yli. Kenttädatassa varsi on piirretty kokonaan — se on *kasvanut*
  kenttä, ja `src/data/rules.js` tarkistaa juuri sen, koska muuten mikään ei
  enää todistaisi että taivaskaistalle pääsee.
- **Lämpöputki** (`(` `)`) sarakkeessa 229: paina alas seistessäsi sen päällä.
  Luolan poistumisputkesta pääsee ylös painamalla ylös.

Kumpikaan ei ole matkalla maaliin, ja `tools/playable.mjs` vahvistaa että 1-2
menee yhä läpi pienimmällä koolla ilman kumpaakaan.

## Kosketusohjaus

Ohjaimet ilmestyvät **vasta ensimmäisestä oikeasta kosketuksesta** — moni
kannettava ilmoittaa kosketustuen jota kukaan ei käytä, eikä sellaiselle
koneelle kannata piirtää ristiohjainta pelin päälle. Työpöydällä ne saa esiin
näppäimellä **6** tai osoitteella `?touch=1`.

Kolme mallia, ja **6** (tai OHJAUS-painike) vaihtaa niiden välillä:

| Malli | Miten |
| --- | --- |
| `rulla` | **Oletus.** Sama ristiohjain kuin näppäimissä, mutta oikealla on kaksi nappia yhden kentän sijaan: pieru täyttää nurkan johon peukalon lapa asettuu, ja hyppy on ympyrä *sen sisällä* ylhäällä vasemmalla, jonne kärki yltää. Yksi peukalo pitää siis pierun pohjassa ja hyppää. Hinta: tässä mallissa ei voi hypätä ilman juoksua. |
| `näppäimet` | Näkyvä ristiohjain vasemmalla, Z ja X oikealla. Tarkka, mutta vie ruudun alaosan — ja ainoa malli jossa saa kävelyvauhtisen hypyn. |
| `peukalot` | Ei näkyviä nappeja. Vasen puoli on sauva joka ilmestyy siihen mihin peukalo osuu, oikean puolen alaosa hyppää ja yläosa pieruttaa. |

Kumpi on parempi, ei ratkea pöydän ääressä, joten kaikki ovat mukana ja valinta
muistetaan. Vain oletus vaihtui; kenenkään tallennettua valintaa ei hylätty.

**Miksi `rulla` on olemassa:** juoksunappia pitää pitää pohjassa *ennen* hyppyä
ja sen aikana, koska juoksu nostaa nopeuskattoa ja vauhti kertyy juostessa.
Kahdella erillisellä napilla se vaatii kaksi sormea. Peukalon rullaaminen napilta
toiselle ei auta, koska kosketusnäyttö raportoi sormen **yhtenä pisteenä**:
piste siirtyy, ja juoksu vapautuu. Sama koodipolku tekee ristiohjaimesta
ristiohjaimen. Siksi ratkaisu ei ole nappien siirtely vaan sisäkkäisyys — piste
osuu molempiin suorakulmioihin yhtä aikaa.

Toteutuksen neljä sääntöä, jotka säästävät eniten harmia:
- **Osumatarkistus on omaa koodia**, ei DOM-nappeja. Selain ei lähetä
  `pointerleave`ia kun peukalo liukuu napilta pois, eikä ristiohjain jolla ei
  voi rullata peukaloa ole ristiohjain.
- **Jokainen sormi seurataan `pointerId`:llä.** Ohjaus + juoksu + hyppy on kolme
  sormea, ja yhdenkin pudottaminen tuntuu pelin jumittumiselta.
- **`touch-action: none` peitteellä**, tai Android tekee hypystä sivun
  vierityksen — **mutta vain kun kuva ei ole zoomattuna.** Koko ruudun peittävä
  peite joka kieltää kaikki eleet kieltää myös nipistyksen, eli se lukitsee
  pelaajan siihen zoomiin johon hän vahingossa päätyi. Ks. alla.
- **Juoresta ei tehdä automaattista.** Se olisi halvin tapa korjata koko ongelma
  ja väärä: kuilut on mitoitettu mitattuun hyppybudjettiin, joten aina päällä
  oleva juoksu muuttaa hyppykaarta ja jokaisen kentän vaikeutta. Se on
  kenttäsuunnittelua ohjausvalikon kautta.

### Mobiili-Safari ja zoom

`user-scalable=no` ei ole tehonnut iOS-Safarissa sitten iOS 10:n, eikä
`maximum-scale` ole ratkaisu vaan pahennus: selaimissa jotka sitä tottelevat se
vie nipistyksen, eli poistaa tien takaisin. Zoomaus estetään siis
`touch-action: manipulation`illa juurielementissä, joka tappaa
kaksoisnapautuksen mutta jättää nipistyksen. Kun kuva *on* zoomattuna
(`visualViewport.scale`), juurielementti ja ohjainpeite antavat kaikki eleet
takaisin, jotta pelaaja pääsee aina ulos.

## Kuvaefektit

Näppäin **7** kiertää kolme esiasetusta:

| Esiasetus | Mitä tekee |
| --- | --- |
| `pois` | ei mitään — sama kuva kuin ennen efektejä |
| `hehku` | bloom: kirkkaat asiat (aurinko, kolikot, tulipallot) hehkuvat |
| `kuvaputki` | bloom + juovat + vinjetti, ja WebGL:llä myös kaareva ruutu ja värivirhe |

Peli **piirtää edelleen Canvas 2D:llä**. WebGL:ää käytetään vain valmiin
320×240-kuvan esittämiseen shaderin läpi, eikä `src/gfx/` tiedä siitä mitään.
Koko renderöijän kirjoittaminen WebGL:llä harkittiin ja hylättiin: piirtokoodi
maksaa alle millisekunnin framessa, joten uudelleenkirjoitus ei toisi muuta kuin
shaderit — ja shaderit saa näinkin.

**Jos WebGL ei ole käytettävissä, peli toimii silti.** `getContext('webgl2')`
palauttaa nullin estolistatulla näytönohjaimella, virtuaalikoneessa ja aina kun
laitteistokiihdytys on pois päältä — myös täysin ajantasaisessa selaimessa.
Silloin bloom, juovat ja vinjetti piirretään Canvas 2D:llä ja vain kaarevuus
jää pois. `verify.mjs` tynkää WebGL-kontekstin pois ja tarkistaa tämän joka
ajolla: fallback jota ei testata ei ole fallback.

Efektipassi mitataan samalla: budjetti on 2,5 ms framessa, toteuma ~0,35 ms.

## Pelidata ja yksityisyys

Peli kirjaa **selaimen omaan muistiin** (localStorage) sen mihin pelaaja kuolee,
missä hän jää jumiin ja kuinka kauan kenttä kesti. Tarkoitus on yksi: nähdä missä
kentät oikeasti kaatavat pelaajan — sitä ei näe pelaamalla omia kenttiään.

Kaksi asiaa, joiden varaan koko kirjaus on rakennettu:

- **Anonyymi rakenteeltaan.** Tallennettuna on kentän tunnus, ruutukoordinaatti,
  kuolinsyy ja voimataso. Ei nimeä, ei kellonaikaa, ei tunnistetta. Dataa ei siis
  voi yhdistää kehenkään, joten mitään lupausta ei tarvitse antaa eikä pitää.
- **Mikään ei lähde selaimesta.** `src/core/telemetry.js`:ssä ei ole yhtään
  verkkokutsua, ja `verify.mjs` tarkistaa sen jokaisella ajolla. Vienti on
  tiedosto, jonka pelaaja itse antaa eteenpäin.

Debug-ruudussa (**9**) kentän päälle piirtyy lämpökartta: punaiset pylväät ovat
kuolemia, siniset viivat alalaidassa jumipaikkoja. **8** vie datan JSON-tiedostoon.
Konsolista: `sfb3.telemetry.summary('1-1')` ja `sfb3.telemetry.clear()`.

## Julkaisu

Repo on staattinen sivusto ilman build-vaihetta. `main`-haaran push julkaisee
automaattisesti Verceliin; `vercel.json` asettaa frameworkin tyhjäksi ja ohittaa
asennusvaiheen, koska `package.json` on olemassa vain kehitystyökaluja varten.

```bash
vercel --prod   # käsin, jos automaattinen julkaisu ei ole käytössä
```

## Koodin rakenne

```
index.html          canvas 320x240, skaalataan kokonaisluvuilla
src/main.js         pelisilmukka (kiinteä 60 Hz askel), tilat, debug-ruutu
src/core/           syöte, kosketus, ääni (WebAudio), tallennus, tilatallennus, pistetaulu, telemetria
src/gfx/            bittikarttafontti, ruudut, spritet, taustat, kuvaefektit
src/data/           kenttäpalikat, kentät, generoidut kentät, maailmankartat
src/data/generator.js  kenttägeneraattorin ydin — sama koodi työkalulle ja selaimelle
src/data/scale.js   vaikeustasot: kentän venytys ja lisäviholliset
src/entities/       pelaaja, viholliset, esineet, efektit
src/level/          fysiikka ja törmäykset
src/scenes/         alkuruutu, maailmankartta, kenttä, välikortit, pistetaulu, päivän pieru
tools/              verify, hyppymittaus, tilastolouhinta, kenttägenerointi
```

**Generaattori on yksi eikä kaksi.** `src/data/generator.js` on se mitä kenttä
on — palikat, teemat, säännöt, `buildLevel` — ja `tools/gen-levels.mjs` se mitkä
kentät tehdään: `PLAN`, siemenhaku, telemetria, korpustarkistus ja tiedoston
kirjoittaminen. Jako on päivän pierun takia (se generoi selaimessa), ja sen
ainoa ehto on ettei mikään liikkunut: `src/data/generated.js` tulee siirron
jälkeen ulos tavulleen samana.

Mitatut luvut kulkevat selaimeen `src/data/pacing.js`:n kautta — kannettu kopio
`tools/pacing-stats.json`:sta ja `tools/jump-budget.json`:sta, jonka
`verify.mjs` vertaa alkuperäisiin. Jos ajat `measure-jump.mjs`:n tai
`mine-pacing.mjs`:n, aja perään `node tools/mirror-pacing.mjs`.

### Kenttien tekeminen

Kentät kootaan 15 rivin **palikoista** (`src/data/chunks.js`), jolloin sarakkeet
osuvat aina kohdalleen. Palikan lattia on riveillä 13-14, ja **koottu kenttä on
kuusitoista riviä**: kokoaja lisää päälle yhden taivasrivin (`SKY_PAD`), joka on
kopio palikan ylimmästä rivistä — niin katot ja pavunvarsi jatkuvat ylöspäin.
Kootussa kentässä lattia on siis riveillä 14-15, ja se yksi rivi on se mikä
antaa kameralle pystysuuntaista liikkumavaraa. Palikka kirjoitetaan harvana
rivikarttana:

```js
pipe_short: ck(16, {
  11: '     []',
  12: '     {}',
  13: '################',
  14: '################',
}),
```

Kenttä on lista palikoiden nimiä (`src/data/levels.js`). `time` on valinnainen —
ilman sitä kello lasketaan kentän pituudesta:

```js
'1-1': {
  theme: 'grass', bg: 'hills', music: 'level',
  chunks: ['start', 'flat', 'walker', 'qrow', /* ... */ 'goal', 'goal_end'],
},
```

Merkit: `#` maa, `X` kova palikka, `B` tiili, `?` kolikkolaatikko (antaa 1–5
kolikkoa, määrä hajautettu sijainnista), `!` tehostelaatikko, `o` kolikko, `-`
puulava, `[] {}` putki, `^` piikit, `W` laava, `N` nuottilaatikko, `F` maali,
`D` linnakkeen ovi, `/` `\` 45° rinne, `t` puu (maisemaa: ei kiinteä, ei
satuttava, mutta metsäpalo tarttuu siihen). Viholliset ja vaarat: `g`
mönkijä, `k` kilpikonna, `f` lentäjä, `p` putkikasvi, `r` ruskea pilvi, `c`
ummetuskorkki, `x` piikkiukko, `A` vihainen aurinko, `H` närästys, `U`
kurnuttaja (kuilun ensimmäiselle lattiariville, tyhjään sarakkeeseen), `O` kuu,
`P` papuparooni, `b` pomo, `T` törähdystorvi, `Z` paarma (ilmaan, ei lattialle),
`Y` yökki, `m` paukkupöhö. Aloituspaikka on `1`.

Linnakkeen pomon liikesarja tulee kentän `bossVariant`-kentästä (0–3).

Kentän muut liput: `terrain: true` antaa **maastopassin** (`src/data/terrain.js`)
— kokoaja päättää kullekin palikalle lattiatason ja kirjoittaa siirtymät
rinteinä. `wind`, `quake`, `twister`, `firestorm` ja `wildfire` ovat sää:
puuska, maanjäristys, pyörremyrsky, tulimyrsky ja metsäpalo. Kukin on
kenttäkohtainen tarkoituksella — uhka joka on joka kentässä on maastoa, ja
maasto ei ole uhka.

### Maailmankartan muokkaus

`src/data/worlds.js` sisältää jokaisen maailman maaston (20x9 ruutua), solmut
(`start`, `level`, `house`, `fortress`) ja niiden väliset polut. Polulle voi
antaa välipisteitä, jolloin siitä tulee kulmikas:

```js
{ a: 'w1-2', b: 'w1-3', path: [[10, 6]] },
```

Polku on kuljettavissa, kun jompikumpi pää on selvitetty.

Piirtoon polku saa loivan mutkan (`linkCurve`), joka lasketaan solmujen
tunnusten tiivisteestä — ei `Math.random()`ista, koska kartan pitää näyttää joka
framella ja joka latauksella samalta. Sama käyrä ohjaa myös kävelevää nappulaa,
joten kuva ja liike eivät voi erota toisistaan.

**Maastoon ei saa istuttaa mitä tahansa mihin tahansa.** Seitsemän merkkiä
(`T P M C R " E`) nousevat maasta ylös, eivätkä ne saa seisoa polun ruudussa
eivätkä sen neljässä sivunaapurissa (`clearZone`). `worldProblems` hylkää
kartan joka rikkoo tämän, ja `tools/verify.mjs` mittaa lisäksi piirretyistä
pikseleistä paljonko polun ja lähimmän kalusteen väliin jää tyhjää.

### Tilatallennus

`src/core/savestate.js` ottaa tilannevedoksen koko pelistä: kenttäruudukko,
kaikki entiteetit, pelaaja, kamera, kello ja pelitila. Entiteetit sarjallistuvat
yleisesti ja herätetään `REGISTRY`-taulun avulla — uusi vihollistyyppi tarvitsee
vain rivin siihen tauluun.
