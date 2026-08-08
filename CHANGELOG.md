# Muutosloki

Versiointi on CalVer: `vVV.KK.PP.build`. Jokaisesta merkittävästä muutoksesta
kirjataan **mitä** tehtiin ja **miksi** — perustelu on tässä yhtä tärkeä kuin
muutos itse, koska se on myös se todiste siitä mistä mikäkin on peräisin.
Alkuperää ja tekijänoikeuksia koskevat periaatteet ovat [DESIGN.md](DESIGN.md):ssä.

---

## v26.08.08.9 — syöteviive, kartan animaatiot, dokumenttien tarkistus

### Korjattu
- **Syöte jumitti sekunneiksi.** Syy ei ollut näppäimistökoodissa vaan
  musiikkisekvensserissä: taustavälilehdessä `setTimeout` kuristetaan, jolloin
  sekvensseri heräsi kymmeniä sekunteja jäljessä ja yritti rakentaa koko
  rästilistan nuotteja yhdellä kertaa. Tuhansien oskillaattorien luonti jumittaa
  pääsäikeen, ja peli lakkaa vastaamasta näppäimistöön. Nyt mennyt musiikki
  hypätään yli ja synkataan seuraavaan tahtiin; yhdessä heräämisessä ajoitetaan
  enintään 32 askelta, eikä ajastimelle anneta koskaan mennyttä aikaa.
  Mitattu jälkeenpäin: kehystyö 0,3 ms mediaani, 60 fps, hypyn vaste 14 ms.
- **Nopea näppäinpainallus saattoi kadota.** Jos näppäin painettiin ja
  vapautettiin saman framen sisällä, kysely näki jo vapautetun näppäimen. Nyt
  painallus salpautuu tapahtumakäsittelijässä.
- **Alkuruudun valikko ja ohjeteksti menivät päällekkäin** kun valikkoon tuli
  kolmas rivi. Laatikon korkeus lasketaan nyt riveistä.

### Lisätty
- **Maailmankartta elää**: puut, männyt, pensaat ja kaktukset huojuvat kukin
  omassa vaiheessaan, pilvet ajelehtivat kartan yli, linnut lentävät ruohomaalla
  ja tehtaan venttiilipyörä pyörii.
- **Musiikin osiot kestävät useamman kierroksen** (2–3) yhden sijaan, ja
  vaihdosta edeltää kokonaisen tahdin lead-in: virveli tihenee, ja jos tempo on
  vaihtumassa, askelpituus liukuu uuteen tempoon sen sijaan että se leikkautuisi.
  *Miksi:* yhden kierroksen mittainen muutos kuulostaa virheeltä, kahden tai
  kolmen harkitulta.

### Muutettu
- Dokumentit tarkistettiin koodia vasten ja korjattiin: kilpikonnan pisteet
  (100 ei 200), tehostuksen pisteet, kaasulehden tasovaikutus, P-mittarin
  käytös lennon aikana, generaattorin samankaltaisuustarkistuksen ehdollisuus,
  hyppybudjetin marginaalit ja se että kenttäsäännöt tarkistetaan vain
  generoiduille kentille.
- **HANDOFF.md poistettiin.** Sen tilannekatsaus oli vanhentunut (väärä haara,
  neljä maailmaa, vanha hyppybudjetti), ja ainoa ainutlaatuinen sisältö —
  moottorin kompastuskivet — siirrettiin [DESIGN.md](DESIGN.md):n kohtaan 6.

---

## v26.08.08.8 — eloa animaatioihin

### Lisätty
- **Pelaajalle idle-esitys.** Paikallaan seisova hahmo hengittää (vartalo nousee
  ja laskee pikselin noin puolentoista sekunnin välein) ja räpäyttää silmää pari
  sekunnin välein. Kolmen sekunnin seisoskelun jälkeen se alkaa viihdyttää
  itseään: katsoo ylös, raapii takamustaan, katsoo alas, naputtaa jalkaa.
  *Miksi:* liikkumaton seisova sprite lukeutuu pysähtyneeksi peliksi.
- **Kävelijöille oma nytkähdys**, jotta nekään eivät ole pelkkiä liukuvia kuvia.

Kaikki tämä on puhdas funktio tickistä ja paikallaanoloajasta, joten ääriviivan
piirtokierros toistaa saman asennon ja tilatallennus palauttaa saman ruudun.
Testi varmistaa että hengitys ja idle-asennot todella eroavat toisistaan.

---

## v26.08.08.7 — kenttäsuunnittelun säännöt, ohjaimet molemmille käsille

### Lisätty
- **Kenttäsääntöjä tarkistetaan koneellisesti** (`tools/gen-levels.mjs`):
  - maareitti on läpäistävä ilman tehostusta — pieruhyppy avaa vain korkeat
    reitit, ei kulkua maaliin
  - jokaisessa kentässä on tehostuspalikka ensimmäisessä neljänneksessä
  - laattapolun päässä on aina jotain saatavaa ("ei portaita tyhjään")
  Perustelut: [DESIGN.md](DESIGN.md) kohta 5.
- **Uusi palikka `highReward`**: korkea taso, jonne yltää vain pieruhypyllä, ja
  siellä on palkinto. Tämä on se kauppa jonka tehostus tarjoaa.
- **Ohjaimet molemmille käsille yhtä aikaa**, ilman tilanvalintaa: nuolet + Z/X
  (ohjaus oikealla) tai WASD + L/K tai piste/pilkku (ohjaus vasemmalla), ja väli
  hyppää kummin päin tahansa. Näppäimet ovat `event.code`-arvoja eli fyysisiä
  paikkoja, joten näppäimistöasettelu ei siirrä niitä.

---

## v26.08.08.6 — pistetaulu, putkikasvi, näppäimet

### Lisätty
- **Pistetaulu** (`src/core/scores.js`, `src/scenes/scores.js`). Kymmenen parasta
  selaimen localStorageen, arcade-tyylinen nimensyöttö (ylös/alas kirjain,
  vasen/oikea paikka, X pyyhkii, Enter valmis). Näkyy alkuvalikossa
  "PARHAAT PIERUT" ja pelin päätyttyä.
  *Miksi:* useampi pelaaja samalla koneella halusi verrata tuloksia.
- **Savescum-merkintä.** Tilatallennuksen lataaminen merkitsee ajon, ja
  pistetaulussa nimen perässä on tähti.
  *Miksi:* kelattu ja kelaamaton suoritus eivät kuulu samaan sarakkeeseen ilman
  merkintää. Pelkkä tallentaminen ei merkitse — vasta lataaminen, koska se on
  se kohta jossa aikaa kelataan taaksepäin.

### Korjattu
- **Putkikasvi satutti näkymättömänä.** Kaksi erillistä syytä:
  1. Piiloutuneen kasvin osumalaatikko kutistuu nollakorkuiseksi, mutta
     nollakorkuinen laatikko *osuu silti* jos pelaajan laatikko ylittää sen
     y-linjan (`a.y < b.y + 0 && a.y + a.h > b.y` voi olla tosi). Kasvi on nyt
     eksplisiittisesti vaaraton piilossa, ja tyhjä laatikko ohitetaan.
  2. Vaikka geometria oli muuten oikein, 2–7 pikselin siivu putken suulla ehti
     satuttaa. Nyt sama vakio (`Plant.HIDDEN_OFFSET`) ohjaa sekä piirtoa että
     vaarallisuutta: **mikä voi satuttaa, sen myös näkee**.
  Invarianttitesti käy läpi jokaisen animaation vaiheen.

### Muutettu
- **Putkikasveilta poistettiin silmät** (pääsuunnittelijan päätös). Tilalla
  epäsymmetriset valkoiset pilkut. *Miksi:* kasvot saivat sen lukeutumaan
  hahmoksi eikä vaaraksi.
- **Pikanäppäimet numeroriville**: 1 tallenna, 2 lataa, 3 paikka, 9 debug,
  0 mykistys. *Miksi:* macOS varaa F-rivin (Mission Control ym.), ja kirjaimet
  ovat liian lähellä pelinäppäimiä. `event.code` on layout-riippumaton, joten
  numerot osuvat samaan fyysiseen paikkaan näppäimistöasettelusta riippumatta.

---

## v26.08.08.5 — SMB3-tarkka fysiikka (haara `smb3-fysiikka`, mergattu)

### Muutettu
- Liikkeen vakiot johdettu julkaistusta disassemblysta. Isoin ero: nousun
  painovoima napin ollessa pohjassa on 1/5 laskun painovoimasta (ei 1/2), ja se
  pätee vain kun nousuvauhti ylittää 2 px/framea. Ilmakitkaa ei ole, juoksunappi
  ei kiihdytä vaan nostaa vain nopeuskattoa, hypyn lisänoste tulee neljänä
  portaana. Coyote time 0.
  *Miksi:* haluttiin selvittää miltä alkuperäinen liikemalli tuntuu tässä
  pelissä. Kaikki numerot ja perustelut: [PHYSICS.md](PHYSICS.md).

### Lisätty
- `tools/measure-jump.mjs` mittaa hyppybudjetin ajamalla hypyt oikeassa
  moottorissa ja kirjoittaa `tools/jump-budget.json`:n.
  *Miksi:* kenttägeometria riippuu fysiikasta. Käsin kirjattu "hyppy yltää 7,5
  ruutua" vanhenee ensimmäisellä vakiomuutoksella; mitattu ei vanhene.
  Kuilubudjetti on 70 % mitatusta juoksuhypystä — täydellä rajalla hyppiminen
  ei ole vaikeutta vaan veroa.

---

## v26.08.08.4 — jatsi ja teoriapohjaiset modulaatiot

### Muutettu
- **Polyrytmit**: äänet ovat eri mittaisia (lead 30 askelta, komppi 24,
  basso 16), joten ne kohtaavat vasta joka neljäs kierros. Ride kulkee 12
  askelen kuviolla 16:n tahtia vasten (3 vastaan 4).
- **Basso ei koskaan putoa** mistään variaatiosta, on aksentoitu ja staccato.
  *Miksi:* kaiken muun saa purkaa jos groove pitää.
- **Modulaatioille teoriapohja**: kierto I–I–IV–I–V–I–II–I. Liikutaan vain
  kvinttiympyrän naapureihin (subdominantti ja dominantti ovat yhden etumerkin
  päässä, eli sävellajit jakavat kaikki nuotit yhtä lukuun ottamatta),
  palataan aina toonikaan eikä kahta modulaatiota tule peräkkäin. Ainoa kauempi
  siirto on kokosävelaskel ylös, ja se kestää yhden kierroksen. Vaihtoa
  edeltävä fillitahti soittaa **kohdesävellajin dominantin**.
  *Miksi:* satunnainen transponointi kuulostaa virheeltä, valmisteltu ei.

---

## v26.08.08.3 — tilastopohjainen kenttägenerointi, maailma 5

### Lisätty
- `tools/mine-pacing.mjs` louhii **rytmitilastot** ulkoisesta kenttäkorpuksesta
  → `tools/pacing-stats.json`.
- `tools/gen-levels.mjs` rakentaa niistä kentät → `src/data/generated.js`.
- **Maailma 5 "JÄLKIPYYKKI"**: 5-1…5-3 generoitu, 5-F käsintehty.
- Kenttäaika lasketaan kentän pituudesta (`defaultTime`). *Miksi:* kentät olivat
  klassiseen tikitykseen nähden pitkiä, eli sekuntia per ruutu oli noin
  kaksinkertaisen tiukka.

### Perustelu ja rajat
Korpuksesta otetaan **vain rytmi** — haasteiden väli, tiheyskäyrä, kuilun leveys
suhteessa hyppybudjettiin, vihollisten ryhmittely, palikkarivien korkeus.
Palikat, viholliset ja mekaniikat ovat tämän pelin omia. Korpusta ei committata
eikä julkaista, ja generaattori hylkää kentän jos yksikään 8 sarakkeen pätkä
osuu korpukseen. Tarkemmin: [DESIGN.md](DESIGN.md).

### Korjattu
- **Kahden vihollisen tallaaminen kerralla tappoi.** Törmäyskierros luki
  `p.vy`:tä kesken silmukan, ja ensimmäisen tallauksen pomppu käänsi sen
  ylöspäin — jolloin samalla framella osuva toinen vihollinen tulkittiin
  kylkiosumaksi. Nyt käytetään nopeutta jolla pelaaja *saapui*. Lisäksi
  litistynyt vihollinen jäi 22 framen ajaksi vahingoittavaksi; vihollisilla on
  nyt `harmless`-tila.

---

## v26.08.08.2 — grafiikka ja äänet

### Muutettu
- **Taustat** kolmeen välimuistitettuun parallax-kerrokseen, teemakohtainen sää
  (lumi, hiekka, kipinät, siitepöly), aurinko/kuu, tähdet, linnakkeen kiviseinä
  soihtuineen, tehtaan piiput ja varoitusvalot.
- **Tiilet**: teemakohtainen pinta, halkeamat, kiillot, laavan kuplat.
- **Hahmoille ääriviivat** luettavuuden vuoksi, kameran tärinä iskuista.
- **Äänet**: master-ketju limiterillä, erilliset väylät, kerroksellinen
  pierusynteesi satunnaisvaihtelulla (sama ääni ei toistu identtisenä),
  rummut ja lookahead-sekvensseri, kahdeksan vuorottelevaa sovitusta,
  kiiretempo kun aikaa on alle 100.

### Lisätty
- Debug-ruutu (9 tai `): fps, framebudjetti, entiteetit, pelaajan tila, kamera,
  soiva raita ja variaatio.
- `tools/verify.mjs`:ään regressiotarkistukset: taustat piirtyvät ja
  parallaksoivat, tiilet piirtyvät joka teemassa, jokainen koodin pyytämä ääni
  on olemassa.

---

## v26.08.08.1 — julkaisu

- Peli tuotantoon osoitteeseen <https://sfb3.vercel.app>.
- `vercel.json` ohittaa asennusvaiheen: `package.json` on olemassa vain
  kehitystyökaluja (playwright) varten, eikä pelillä ole ajonaikaisia
  riippuvuuksia.
