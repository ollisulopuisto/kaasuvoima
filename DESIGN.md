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
| Grafiikka | Piirretään ajonaikaisesti kokonaislukusuorakulmioina canvasille (`src/gfx/`). Repossa ei ole yhtään kuvatiedostoa. | Ei sprite-ripejä, ei tileset-kuvia, ei skannattua pikselitaidetta mistään pelistä. |
| Äänet ja musiikki | Syntetisoidaan WebAudiolla ajonaikaisesti (`src/core/audio.js`). Repossa ei ole yhtään äänitiedostoa. | Ei sampleja, ei NSF/MIDI-rippejä, ei transkriptioita olemassa olevista sävelmistä. |
| Kentät | Käsin kirjoitettuja ASCII-palikoita (`src/data/chunks.js`) ja niistä koottuja kenttiä, sekä generoituja kenttiä (kohta 3). | Ei yhdenkään olemassa olevan pelin kenttäkarttoja. |
| Nimet ja hahmot | Omia: Super Fart Bros, Pieruprinssi, ummetuskorkki, hernekeitto, närästysliekki, ruskea pilvi, kaasulehti. | Ei Nintendon hahmonnimiä, hahmoja, logoja eikä tunnuksia. |

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
4. **Automaattinen samankaltaisuustarkistus.** Generaattori kanonisoi sekä oman
   tuotoksensa että korpuksen samaan aakkostoon ja hylkää kentän, jos yksikään
   **8 sarakkeen ikkuna** osuu korpukseen. Nykyisillä kentillä osumia on 0.
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
hylkää kentän joka rikkoo niitä.

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
palkinto. Sääntö tarkistetaan takaperin: jokaisesta laattarykelmästä katsotaan
onko sen yläpuolella neljän ruudun sisällä jotain saatavaa, ja jos ei ole,
kenttä hylätään.

Syy: pelaaja oppii nopeasti mitä kannattaa tutkia. Yksikin tyhjä kiipeäminen
opettaa ohittamaan seuraavatkin.

## 6. Työskentelyperiaatteet

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
