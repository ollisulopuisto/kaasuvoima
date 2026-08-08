# Muutosloki

Versiointi on CalVer: `vVV.KK.PP.build`. Jokaisesta merkittävästä muutoksesta
kirjataan **mitä** tehtiin ja **miksi** — perustelu on tässä yhtä tärkeä kuin
muutos itse, koska se on myös se todiste siitä mistä mikäkin on peräisin.
Alkuperää ja tekijänoikeuksia koskevat periaatteet ovat [DESIGN.md](DESIGN.md):ssä.

---

## v26.08.08.17 — näyttötekstit

### Muutettu
- **Pistenumerot eivät enää mene päällekkäin.** Uusi pomppu siirtyy ylemmäs jos
  samassa kohdassa on jo toinen — kaksi numeroa samassa paikassa lukeutuu yhdeksi
  lukukelvottomaksi tahraksi, ja tuplakokoinen isolla palkinnolla piirtyi pienen
  päälle.
- **"KENTTÄ SELVÄ!" ja "VOI EI!" saivat ryhtiä**: isku sisään ylikokoisena,
  keinunta, värikierto ja kehystetty tausta. Litteä valkoinen teksti lukeutuu
  virheilmoitukseksi, ei hetkeksi.

### Tarkistettu
- **Tehostuksen vaihto vahingon yhteydessä** epäiltiin rikkinäiseksi. Testi
  osoitti sen ehjäksi: osuma vie yhden voimatason eikä vaihda tyyppiä. Tyyppi
  vaihtuu vasta jos pelaaja nappaa pudonneen varastoesineen, mikä on tarkoitus.
  Testi jäi paikalleen suojaamaan tätä.

---

## v26.08.08.16 — lead alemmas

### Muutettu
- **Lead-melodia laskettiin oktaavilla.** Neliö- ja kolmioaalto C6:n tienoilla
  on pienestä kaiuttimesta aidosti kirskuva, ja sävelmä asui siellä pysyvästi.
  Nyt kaksi "oktaavi ylös" -osiota käyvät siinä rekisterissä pariksi
  kierrokseksi sen sijaan että se olisi oletus.
- **Musiikkiväylälle alipäästösuodin** 4,8 kHz:iin. Neliö- ja saha-aalto
  kantavat yläsäveliä loputtomiin; huipun pyöristäminen vie kirskunnan pois
  ilman että mikään kuulostaa vaimennetulta.
- Kellon tikitys jätettiin klassiseen 24 framen yksikköön (0,4 s) pyynnöstä.

---

## v26.08.08.15 — värisevä hahmo, tehtaan pääntila, laattapolkujen palkinnot

### Korjattu
- **Paikallaan seisova hahmo värisi ylös ja alas.** Sama juurisyy kuin kadonneissa
  hypyissä, mutta sen näkyvä puoli: laskeutumistesti tutki ruutua `bottom - 1`,
  joten lepäävä hahmo istui pikselin lattiaruudun yläpuolella eikä sub-pikselin
  painovoima yltänyt siihen. Hahmo vajosi kolme framea ja napsahti takaisin
  neljännellä. Testi laski **3 eri y-arvoa** paikallaan seistessä, nyt 1.
  Nyt tutkitaan ruutua jota jalat *koskettavat*, jolloin lepo on aitoa lepoa.
- **Tehtaan pääntila**: `fac_shaft`-palikan tiilirivi istui pilarien päällä ja
  jätti niiden ylle kaksi ruutua tilaa. Isoin voimataso on 2,7 ruutua korkea.
- **Kelluva ummetuskorkki** `cork_gap`-palikassa seisoi kuilun päällä ilmassa.

### Muutettu
- **Jokaisessa kentässä on tehostuspalikka ensimmäisten palikoiden joukossa.**
- **Laattapolkujen palkinnot siirrettiin lavojen yläpuolelle**, jonne pelaaja
  päätyy — osa kolikoista oli lavan alla, missä ne eivät palkitse kiipeämistä.

Validaattorin työlista: pääntilarikkeet 24 → 0, tehostusrikkeet 17 → 0,
tyhjät laattapolut 49 → 0 (kaikki 20 kenttää läpäisevät validaattorin).

---

## v26.08.08.14 — ääkköset

### Korjattu
- **Tekstit kirjoitetaan nyt oikein suomeksi**: "PÄÄSIT LISTALLE", "JATKA PELIÄ",
  "ÄÄNI PÄÄLLE", "KENTTÄ SELVÄ", "TILATALLENNUS KÄYTÖSSÄ", "EI VIELÄ TULOKSIA".
  Fontissa oli Ä ja Ö koko ajan, mutta pisteet olivat epäkeskellä ja kirjaimet
  oli kirjoitettu ilman niitä. Umlautit ovat nyt keskitetyt ja kirjain on
  puristettu viidelle riville niiden alle.
- Testi varmistaa että jokainen pelin käyttämä merkki todella piirtyy — puuttuva
  glyfi näkyy pelkkänä aukkona eikä sitä huomaa koodia lukemalla.

---

## v26.08.08.13 — uudet melodiat, pistepompahdukset, versio pistetauluun

### Muutettu
- **Neljä lead-fraasia raidan sijaan yhden.** Osio valitsee kumpi melodia
  soi, joten sävelmä itse vaihtuu eikä vain sen puku. Yksikään
  (fraasi, sävellaji, sovitus) -yhdistelmä ei toistu kierrossa kahta kertaa
  useammin, eikä fraasi soi kahta peräkkäistä kierrosta pidempään.
- **Lead putoaa pois enää yhdessä osiossa** (breakdown) aiemman kahden sijaan.
  Sävelmä joka katoaa jatkuvasti lakkaa olemasta sävelmä.
- **Harmonia suoraksi.** Kehys on kaksi tahtia: i (Am7) → iv (Dm7) → V7 (E7),
  ja **basso ja komppi jakavat nyt saman 32 askeleen syklin**. Aiemmin ne
  kulkivat eri mittaisina, jolloin soinnut osuivat väärien bassosävelien päälle
  — vaiheistuva melodia on eri kappale kuin svengaava. Polyrytmi siirtyi sinne
  minne se kuuluu: 12 askelen ride 16 askelen tahtia vasten. Jokaisen neljännen
  tahdin G# on E7:n johtosävel, ja se yksi nuotti on suurin ero tämän ja
  ratkaisemattoman modaalivampin välillä.
- **Pistepompahdukset elävät**: valkoinen tuplakokoinen isku ensimmäisillä
  frameilla, kipinäsuihku tuhannen pisteen arvoisista ja 1UP:sta, ja nousu
  hidastuu loppua kohti. Aiemmin ne liukuivat ylös huomaamattomasti.

### Lisätty
- **Pistetauluun pelin versio.** Tuloksia **ei** nollata version vaihtuessa —
  taulun pyyhkiminen aina kun peliä viritetään rankaisisi pelaajaa meidän
  muutoksistamme. Versio kertoo millä buildilla tulos on tehty, mikä on
  rehellistä ilman että se tuhoaa mitään.

---

## v26.08.08.12 — kamera, vokaalit, tehostusten vaihto

### Lisätty
- **Kameraan kuollut alue ja katse eteenpäin.** Näkymä nojaa juoksusuuntaan ja
  rauhoittuu pysähtyessä; keskellä on 8 pikselin kuollut alue jottei hyppy
  tärisytä ruutua. *Miksi ei inertiaa:* kamera joka jatkaa liikettä kun pelaaja
  pysähtyy on juuri se mikä tekee 2D-tasohyppelystä pahoinvoivan — kuva liikkuu
  vaikka ohjattava ei.
- **Vokaalit** ("jee!", "hup", "oof") — syntetisoituna, ei tiedostoina.
  Formanttisuodattimet pulssiaallon päällä: kaksi resonanssihuippua joiden
  paikka tekee "ee":stä ee:n ja "aa":sta aa:n, ja niiden liu'utus vokaalista
  toiseen antaa tunnistettavan sanan. Hyppyäänet arvotaan (18 %), koska
  murahdus joka hypyllä kävisi hermoille kolmannella kerralla.
- **ROADMAP.md**: työlista ja perustelut talteen repoon, jottei tila elä vain
  keskustelussa.

### Korjattu
- **Tehostuksen vaihto hukkasi vanhan voiman.** Jos päällä oli kaasulehti ja
  poimi sienen, lehti katosi kokonaan. Nyt vanha voima menee varastolaatikkoon
  ja uusi aktivoituu. *Miksi:* hännän menettäminen siksi että käveli sienen
  päälle tuntuu siltä että peli huijasi.

---

## v26.08.08.11 — linnakkeen ovi ja säännöt koko pelille

### Korjattu
- **Linnakkeen ovi oli mahdoton ohittaa.** Pomo seuraa pelaajaa, ja koska
  areenan sivut ovat auki, se käveli ulos käytävään ja **putosi kuiluun**.
  Instrumentoitu läpipeluu: pomon y kasvoi 144 → 1650 → 2458 (kentän korkeus on
  240), ja se poistettiin framella 1002 kaatamattomana. Silloin `bossDefeated`
  jää epätodeksi eikä ovi aukea koskaan — kenttä on läpäisemätön eikä pelaaja
  näe miksi.
  Pomo kääntyy nyt jyrkänteillä kuten kilpikonnatkin, `alwaysActive`-entiteettiä
  ei koskaan siivota kameran taakse jäämisen takia, ja jos pomo jostain syystä
  silti tipahtaa, se palautetaan aloituspaikalleen.

### Lisätty
- **Kenttäsäännöt omaan moduuliinsa** (`src/data/rules.js`), jota sekä
  generaattori että `tools/verify.mjs` käyttävät — säännöt eivät voi enää
  erkaantua toisistaan.
- **Säännöt ajetaan nyt kaikille 20 kentälle**, ei vain generoiduille. Käsin
  tehtyjen rikkeet raportoidaan työlistana (ne on tehty vanhalle
  hyppybudjetille), generoitujen rikkeet kaatavat ajon.

---

## v26.08.08.10 — kadonneet hypyt ja mykkä ääni

### Korjattu
- **Suurin osa hyppypainalluksista katosi.** Juurisyy oli `moveY`:ssä: kun
  laskeutuminen ratkaistaan, jalat asetetaan täsmälleen ruudun rajalle, jolloin
  vartalon viimeinen pikseli jää *lattiaruudun yläpuolelle*. Yksi frame
  painovoimaa liikuttaa alle pikselin, joten törmäystesti raportoi "ilmassa"
  kolmella framella neljästä paikallaan seistessä — ja jokainen niille framille
  osunut hyppy katosi äänettömästi. Mitattu ennen korjausta: **40/60 framea
  ilmassa** paikallaan, 4/12 hyppyä ohitettu.
  Maassa olo on nyt sijaintikysymys eikä tapahtuma: katsotaan onko jalkojen alla
  oleva ruuturivi seisottava.
  *Miksi tämä ilmeni vasta nyt:* vika on ollut olemassa aina, mutta viiden
  framen coyote time peitti sen. SMB3-fysiikan myötä coyote meni nollaan ja vika
  paljastui.
- **Coyote time takaisin (5 framea) ja hyppypuskuri (6 framea).** SMB3:ssa
  kumpaakaan ei ole, ja se on aito — mutta langattomalla näppäimistöllä ja
  modernilla näytöllä sama sääntö tarkoittaa "peli ei kuunnellut minua".
  Tietoinen poikkeama alkuperäisestä, kirjattu myös PHYSICS.md:hen.
- **Ääni saattoi jäädä kokonaan pois.** Selain päästää äänen läpi vain
  käyttäjän eleen sisällä, ja jos se yksi ele meni ohi tai torjuttiin, peli
  pysyi mykkänä koko session. Nyt lupaa pyydetään uudelleen jokaisella
  syötteellä kunnes konteksti on käynnissä.
- **Debug-ruutu näyttää nyt äänen tilan** (`AUDIO RUNNING/SUSPENDED  GAIN`),
  jotta mykkyyden syyn näkee suoraan ruudulta.
- **index.html:n ohjeteksti** näytti yhä vanhat F-näppäimet.

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
