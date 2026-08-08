# Suunnitteluperiaatteet ja alkuperä

Tämä dokumentti kertoo mistä pelin sisältö on peräisin ja millä säännöillä sitä
tehdään. Kaksi syytä: uusi tekijä näkee mitä saa ja ei saa tehdä, ja jos joku
joskus kysyy, tässä on kirjattuna mitä on käytetty ja mitä ei.

> Tämä ei ole juridinen lausunto eikä sitä ole laatinut lakimies. Se on kuvaus
> siitä miten peli on tehty ja millä perusteilla ratkaisut on tehty.

---

## 1. Kaikki sisältö on itse tuotettua

| osa-alue | miten tehty | mitä *ei* ole käytetty |
| --- | --- | --- |
| Grafiikka | Piirretään ajonaikaisesti kokonaislukusuorakulmioina canvasille (`src/gfx/`). Peli ei lataa yhtään kuvatiedostoa. | Ei sprite-ripejä, ei tileset-kuvia, ei skannattua pikselitaidetta mistään pelistä. |
| Äänet ja musiikki | Syntetisoidaan WebAudiolla ajonaikaisesti (`src/core/audio.js`). Repossa ei ole yhtään äänitiedostoa. | Ei sampleja, ei NSF/MIDI-rippejä, ei transkriptioita olemassa olevista sävelmistä. |
| Kentät | Käsin kirjoitettuja ASCII-palikoita (`src/data/chunks.js`) ja niistä koottuja kenttiä, sekä generoituja kenttiä (kohta 3). | Ei yhdenkään olemassa olevan pelin kenttäkarttoja. |
| Nimet ja hahmot | Omia: Super Fart Bros, Pieruprinssi, ummetuskorkki, hernekeitto, närästysliekki, ruskea pilvi, kaasulehti. | Ei Nintendon hahmonnimiä, hahmoja, logoja eikä tunnuksia. |

Repon ainoa binääri on `card.png`, linkkien esikatselukuva. Sekin on generoitu
**pelistä itsestään** (`node tools/make-card.mjs` valokuvaa alkuruudun), koska
Slack ja muut eivät renderöi SVG:tä esikatselussa. Se ei ole ulkopuolista
materiaalia eikä sitä piirretty käsin.

Melodiat on sävelletty tätä peliä varten. Jos joskus lisätään sävelmä joka
muistuttaa jotain olemassa olevaa, se ei mene sisään — samankaltaisuus on
sävellyksessä eri asia kuin tyylilajissa.

## 2. Genre on vapaa, ilmaisu ei

Peli on tarkoituksella 2D-tasohyppely samassa perinteessä kuin 80–90-lukujen
konsolitasohyppelyt: kulkeminen vasemmalta oikealle, vihollisten päälle
hyppiminen, tehostepalikat, maali kentän lopussa. **Pelin säännöt, mekaniikat ja
genrekonventiot eivät ole tekijänoikeuden suojaamia** — suojattua on nimenomainen
ilmaisu: tietty hahmo, tietty grafiikka, tietty sävelmä, tietty kenttäkartta.
Siksi kaikki neljä yllä olevaa riviä on tehty itse.

**Tunnistettu riski, joka on syytä sanoa ääneen:** pelin nimi on sanaleikki
tunnetusta tavaramerkistä. Tekijänoikeuden puolella tilanne on siisti, mutta
tavaramerkki on eri asia kuin tekijänoikeus, ja parodia suojaa nimeä
epävarmemmin kuin sisältöä. Jos peli joskus julkaistaan laajemmin tai siitä
otetaan rahaa, nimi on ensimmäinen asia joka kannattaa harkita uudelleen.

## 3. Kenttägenerointi: rytmi kyllä, layout ei

Maailman 5 kentät rakentaa `tools/gen-levels.mjs` tilastoista, jotka
`tools/mine-pacing.mjs` louhii ulkoisesta kenttäkorpuksesta. Raja on vedetty
näin:

**Otetaan** (`tools/pacing-stats.json`, pelkkiä aggregaattilukuja):
- montako saraketta rauhaa on haasteiden välissä (mediaani, p90, jakauma)
- miten haastetiheys nousee ja laskee kentän mitassa
- kuinka leveitä kuilut ovat **suhteessa siihen mitä hyppy kantaa**
- miten viholliset ryhmittyvät ja kuinka tiheässä ne ovat
- palikkarivien pituus ja korkeus lattiasta, kolikkoryhmien koko

**Ei oteta:** yhtään kenttäkarttaa, palikkasommitelmaa eikä pätkää mistään
kentästä.

Miksi tämä raja on oikea: yksittäinen kenttäkartta on suojattua ilmaisua, mutta
sen taustalla oleva suunnittelumenetelmä ja tilastollinen muoto ovat ideoita ja
faktoja. "Kuilun leveyden mediaani on kaksi ruutua" on mittaustulos, ei teos.

Käytännön suojatoimet:

1. **Korpus ei ole repossa eikä julkaisussa.** `mine-pacing.mjs` vaatii
   `VGLC_DIR`-ympäristömuuttujan ja lukee datan sen takaa. Mitään ei kopioida
   projektiin.
2. **Vain aggregaatit tallennetaan.** `tools/pacing-stats.json` sisältää
   jakaumia ja keskilukuja, joista ei voi rekonstruoida yhtäkään kenttää.
3. **Palikat ovat omia.** Generaattorin sanasto on tämän pelin mekaniikkoja:
   ummetusportti, kaasupilvikuilu, närästyssuihkut, nuottipalikat,
   hyppyradan piirtävä kolikkokaari.
4. **Samankaltaisuustarkistus.** Kun `VGLC_DIR` on asetettu, generaattori
   kanonisoi sekä oman tuotoksensa että korpuksen samaan aakkostoon ja hylkää
   kentän, jos yksikään **8 sarakkeen ikkuna** osuu korpukseen. Ilman
   `VGLC_DIR`:iä tarkistusta ei voi tehdä, ja generaattori sanoo sen suoraan
   (`not checked`). Nykyiset kentät on generoitu tarkistus päällä, osumia 0 —
   **aja generaattori aina `VGLC_DIR` asetettuna.**
5. **Skaalaus omaan hyppybudjettiin.** Kuilut mitoitetaan mitattuun
   hyppybudjettiin (`tools/jump-budget.json`), ei lähdepelin ruutuihin. Sama
   *vaikeus*, eri *mitat*.

Emme myöskään kouluta generatiivista mallia korpuksella. Generaattori on
sääntöpohjainen ja lukee vain numerotaulukon; koneoppimismallin tuotos voi
toistaa opetusdataa lähes sanatarkasti, sääntögeneraattori ei voi.

## 4. Fysiikan vakiot

`PHYSICS.md` listaa liikkeen vakiot ja kertoo mistä ne on johdettu: julkisesti
dokumentoiduista disassembly-projekteista. Vakiot ovat lukuja, jotka kuvaavat
miten kappale liikkuu — funktionaalista tietoa, ei ilmaisua, eikä mitään
lähdekoodia ole kopioitu. Toteutus on kirjoitettu tähän moottoriin alusta asti.

Rehellisyyden nimissä: tämä on ohuempi jää kuin kohdat 1–3. Yksittäinen luku ei
ole teos, mutta laaja ja järjestelmällinen poiminta jonkun toisen työstä on aina
harkinnan paikka. Siksi vakiot ovat omassa dokumentissaan, merkittynä
lähteineen, eikä niitä esitetä omana keksintönä. Jos tämä joskus tuntuu
ongelmalta, ne voi korvata itse viritetyillä arvoilla — `PHYSICS.md`:n taulukko
kertoo tarkalleen mitä pitäisi säätää.

## 5. Kenttäsuunnittelun säännöt

Nämä eivät ole tyylivalintoja vaan tarkistettavia sääntöjä: `tools/gen-levels.mjs`
hylkää kentän joka rikkoo niitä. **Tarkistus koskee vain generoituja kenttiä**
(5-1…5-3); käsintehdyissä säännöt ovat suunnitteluohje, ja jos ne joskus halutaan
taata koko pelille, sama validaattori pitää ajaa `tools/verify.mjs`:stä.

### Tehostus avaa paikkoja, ei kenttää

Maareitin on oltava läpäistävissä pienimmällä koolla ja yhdellä hypyllä. Siksi
jokainen kuilu mahtuu mitattuun juoksuhyppybudjettiin tai siinä on astinkivi.
Pieruhyppy — ja muut tehostukset — avaavat **korkeat reitit ja palkinnot**,
eivät kulkua maaliin.

Syy on pelaajan kannalta yksinkertainen: jos tehostus on pakollinen, sen
menettäminen kesken kentän muuttaa kentän mahdottomaksi, ja peli rankaisee
osumasta kahdesti. Jos tehostus on valinnainen, sen menettäminen maksaa vain
palkinnot — ja silloin sen hankkiminen on houkutus eikä velvollisuus.

### Perustehostus on aina lähellä alkua

Jokaisessa kentässä on tehostuspalikka ensimmäisen neljänneksen sisällä. Jos
menetät voimasi heti, korjaus on lähellä, eikä loppukenttää tarvitse pelata
pienimmällä koolla.

### Ei portaita tyhjään

Jos rakennat palikkapolun ylöspäin, sen päässä on jotain: kolikoita, tehostus
tai nuottipalikka. Poikkeus on kuilun yli vievä astinkivi — ylipääsy on itsessään
palkinto. Sääntö tarkistetaan takaperin: jokaisesta **puulavarivistä** (`-`)
katsotaan onko sen yläpuolella neljän ruudun sisällä jotain saatavaa, ja jos ei
ole, kenttä hylätään. Tiilipinot eivät kuulu tarkistuksen piiriin.

Syy: pelaaja oppii nopeasti mitä kannattaa tutkia. Yksikin tyhjä kiipeäminen
opettaa ohittamaan seuraavatkin.

## 6. Moottorin kompastuskivet

Nämä on opittu kantapään kautta. Lue ennen kuin muutat moottoria.

- **`entity.level` on LevelScene, ei voimataso.** Pelaajan voimataso on
  `player.power.level` / `player.powerLevel`. Jos lisäät `Player`-luokkaan
  `level`-getterin, `Entity`-konstruktorin `this.level = level` heittää strict
  modessa ja koko peli hajoaa.
- **Uusi entiteettiluokka pitää lisätä `REGISTRY`-tauluun**
  (`src/core/savestate.js`), muuten tilatallennus pudottaa sen hiljaa pois.
- **Uusi spawn-merkki** lisätään `ENEMY_CHARS`-tauluun
  (`src/entities/enemies.js`) eikä se saa törmätä ruutumerkkeihin
  (`T` tiedostossa `src/gfx/tiles.js`).
- **Palikan rivi ei saa ylittää ilmoitettua leveyttä** — `ck()` heittää heti
  latauksessa. Se on tarkoituksellista: se pitää sarakkeet kohdallaan.
- **Leijuvia vihollisia ei saa asettaa maahan.** `r` (ruskea pilvi) ja `f`
  keinuvat spawn-korkeutensa ympärillä, joten maantasolla ne uppoavat lattiaan.
  Ks. `ENEMY_ROW` tiedostossa `tools/gen-levels.mjs`.
- **Taustakerrokset piirretään kerran välimuistiin.** `src/gfx/backdrop.js`
  maalaa vuoret, kukkulat ja linnakkeen seinän offscreen-nauhoiksi ja toistaa
  ne. Jos muutat nauhan sisältöä, muuta myös sen **avainta** — muuten vanha kuva
  jää elämään.
- **Sään hiukkasilla pitää olla eri siemen x- ja y-akselille.** Sama siemen
  molempiin latoo hiukkaset siistiin diagonaaliin ruudun poikki.
- **Kaikki nopeudet ovat pikseliä per frame** 60 Hz askeleella, eivät sekunnissa.
- **ES-moduulit vaativat http-palvelimen**, `file://` ei toimi.
- **localStorage-avaimet**: `sfb3.save.v2` (edistyminen), `sfb3.savestate.1..3`
  (pikatallennukset) ja `sfb3.scores.v1` (pistetaulu). Jos muutat tallennuksen
  muotoa, nosta versionumeroa.
- **`window.sfb3` on elävä Game-olio.** Konsolista pääsee käsiksi kaikkeen, ja
  `tools/verify.mjs` ajaa koko testistön juuri sen kautta.

## 7. Työskentelyperiaatteet

- **Muutosloki on osa työtä.** Jokainen merkittävä muutos kirjataan
  [CHANGELOG.md](CHANGELOG.md):hen *perusteluineen*. Perustelu on se osa joka
  vanhenee hitaimmin ja jota diff ei kerro.
- **Punainen ennen vihreää.** Bugikorjaus alkaa testistä joka toistaa bugin ja
  epäonnistuu nykyisellä koodilla. `tools/verify.mjs` ajaa kaikki.
- **Mitattu, ei muistettu.** Hyppybudjetti mitataan (`tools/measure-jump.mjs`),
  ei kirjata muistiin. Käsin kirjattu luku vanhenee ensimmäisessä muutoksessa.
- **Ei build-vaihetta, ei ajonaikaisia riippuvuuksia.** Kaikki grafiikka
  piirretään ja äänet syntetisoidaan ajonaikaisesti. Se on myös syy miksi repo
  deployautuu staattisena.
- **Mikä voi satuttaa, sen pitää näkyä.** Osumalaatikko ja piirros ohjataan
  samasta vakiosta silloin kun se on mahdollista.
