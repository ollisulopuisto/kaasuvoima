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
| Grafiikka | Piirretään ajonaikaisesti kokonaislukusuorakulmioina canvasille (`src/gfx/`). Peli ei lataa yhtään kuvatiedostoa. **Myös muodot ovat omia, eivät vain pikselit** (kohta 1 c). | Ei sprite-ripejä, ei tileset-kuvia, ei skannattua pikselitaidetta mistään pelistä — eikä käsin piirrettyä kopiota sellaisesta. |
| Äänet ja musiikki | Syntetisoidaan WebAudiolla ajonaikaisesti (`src/core/audio.js`). Repossa ei ole yhtään äänitiedostoa. Melodiat ovat omia **tai** tekijänoikeudesta vapaata sävelmistöä, nimettynä (kohta 1 b). | Ei sampleja, ei NSF/MIDI-rippejä, ei transkriptioita **suojatuista** sävelmistä. |
| Kentät | Käsin kirjoitettuja ASCII-palikoita (`src/data/chunks.js`) ja niistä koottuja kenttiä, sekä generoituja kenttiä (kohta 3). | Ei yhdenkään olemassa olevan pelin kenttäkarttoja. |
| Nimet ja hahmot | Omia: Super Fart Bros, Pieruprinssi, ummetuskorkki, hernekeitto, närästysliekki, ruskea pilvi, kaasulehti, paukkupapu, piikkiukko, papuparooni, kurnuttaja, sääherra, luuranko, **pöhö**, **pönttö**, **nielu**, **virvatuli**, **varapallo**. | Ei Nintendon hahmonnimiä, hahmoja, logoja eikä tunnuksia. |

Repon ainoa binääri on `card.png`, linkkien esikatselukuva. Sekin on generoitu
**pelistä itsestään** (`node tools/make-card.mjs` valokuvaa alkuruudun), koska
Slack ja muut eivät renderöi SVG:tä esikatselussa. Se ei ole ulkopuolista
materiaalia eikä sitä piirretty käsin.

Melodiat on sävelletty tätä peliä varten. Jos joskus lisätään sävelmä joka
muistuttaa jotain **suojattua**, se ei mene sisään — samankaltaisuus on
sävellyksessä eri asia kuin tyylilajissa. Tämä sääntö ei muuttunut.

## 1 b. Vapautunut sävelmistö saa tulla sisään, nimettynä

Päätetty 9.8.2026. Aiemmin tämä dokumentti sanoi että kaikki melodiat ovat
omia, piste. Sääntö oli tarpeettoman tiukka: **tekijänoikeus vanhenee**, ja
vanhentunut sävellys on yhtä vapaata materiaalia kuin genrekonventio kohdassa 2.

Ehto on että lähde **nimetään**, eikä sitä oteta hiljaa. Se on tarkoituksella
ankarampi kuin vanha sääntö eikä löysempi: "kaikki on itse tehtyä" on väite jota
kukaan ei voi tarkistaa, kun taas "Camille Saint-Saëns (1835–1921), *Danse
macabre* op. 40, 1874" on lause jonka kuka tahansa voi käydä todentamassa
kymmenessä sekunnissa. Nimeäminen menee sekä tähän kohtaan että
[CHANGELOG.md](CHANGELOG.md):hen, joka on jo olemassa osittain juuri tätä varten
— "todiste siitä mistä mikäkin on peräisin".

**Miksi tämä on turvallista juuri tässä pelissä.** Vapautuminen koskee
*sävellystä*. Yksittäinen äänite ja yksittäinen nuottilaitos ovat eri teoksia
omine oikeuksineen, ja niihin useimmat kompastuvat. Me emme koske kumpaankaan:
sävelet kirjoitetaan käsin `TRACKS`-taulukkoon ja syntetisoidaan ajossa, joten
repoon ei tule sampleja, MIDI-rippiä eikä skannattua nuottia. Suojan kesto on
Suomessa ja EU:ssa **tekijän elinaika + 70 vuotta**, laskettuna kuolinvuoden
lopusta.

Käytetty sävelmistö, tässä on koko lista:

| teos | säveltäjä | vapautui | missä |
| --- | --- | --- | --- |
| *Vuorenkuninkaan luolassa* (Peer Gynt, 1875) | Edvard Grieg, k. 1907 | 1.1.1978 | luolakaista (`cave`) |
| *Danse macabre* op. 40 (1874) | Camille Saint-Saëns, k. 1921 | 1.1.1992 | luumaailma (`bone`, maailma 6) |
| *Yö Autiovuorella* (1867), Rimski-Korsakovin sovitus 1886 | Modest Mussorgski, k. 1881; Nikolai Rimski-Korsakov, k. 1908 | 1.1.1952 / 1.1.1979 | viimeinen linnake (`autiovuori`, maailma 8) |

**Kaksi säveltäjää yhdellä rivillä ei ole huolimattomuutta.** *Yö
Autiovuorella* tunnetaan lähes yksinomaan Rimski-Korsakovin sovituksena, ja
**sovitus on oma teoksensa omine suoja-aikoineen** — juuri se on se kohta jossa
"tämähän on vanhaa musiikkia" menee useimmiten pieleen. Molemmat ovat vapaita,
mutta se on kaksi tarkistusta eikä yksi, ja siksi molemmat lukevat tässä.

Ja koska kaksi tarkistusta ei ole sama asia kuin kaksi *muistettua* tarkistusta,
portti lukee nyt raidan `source`-kentät kaikki eikä kahta nimettyä
(v26.08.09.42). Sovittajan nimi oli aiemmin kenttä jonka olisi voinut kirjoittaa
koodiin ilman että se olisi joutunut kumpaankaan dokumenttiin — eli täsmälleen
se puoliksi kattava portti jota tämä kohta pelkää. Sukunimi ei myöskään riitä:
taulukossa lukee **Nikolai** Rimski-Korsakov, ja portti vaatii sen merkkijonon
sellaisenaan.

**Varoitus joka kannattaa lukea ennen kuin innostuu:** Jean Sibelius kuoli
20.9.1957, joten hänen teoksensa vapautuvat vasta **1.1.2028**. *Finlandia* ja
*Karelia* ovat juuri se hylly johon suomalaisessa pelissä ensimmäisenä
kurkotetaan, ja se on ainoa hylly josta ei vielä saa ottaa.

**Nimeäminen on nyt portti eikä lupaus.** Raita kantaa lähteensä mukanaan
(`source` `TRACKS`-taulussa, ks. `TRACK_SOURCES`), ja `tools/verify.mjs` vaatii
että sekä säveltäjän nimi että teoksen nimi lukevat **sekä tässä tiedostossa
että muutoslokissa**. Ehto oli tarkoituksella ankarampi kuin vanha sääntö, ja
ankaran säännön ainoa vika on että se unohtuu kolmannella kerralla — nyt ei
unohdu. Raita ilman `source`-kenttää on tätä peliä varten sävelletty eikä sitä
kysytä miltään: sääntö koskee lainattua, ei kaikkea.

> Kohta 1 b kuvaa miten ratkaisut on tehty. Se ei ole oikeudellinen neuvo, ja
> suoja-ajat lasketaan maakohtaisesti.

## 1 c. Muoto on ilmaisua siinä missä pikselikin

Päätetty 9.8.2026. Yllä oleva taulukko on aina väittänyt että grafiikka on
itse tehtyä, ja teknisesti se on ollut totta koko ajan: jokainen pikseli
piirretään ajossa `fillRect`-kutsuilla eikä repossa ole yhtään kuvatiedostoa.
Väite oli silti **puoliksi katettu**, ja kohta 2 sanoo miksi: suojattua on
*nimenomainen ilmaisu*, ja ilmaisu on se mitä kuva esittää — ei se millä
työkalulla se on maalattu. Käsin kirjoitettu `fillRect` joka piirtää jonkun
toisen pelin tunnistettavan esineen on kopio, ei omaa työtä.

Poimittavat esineet (`src/gfx/sprites/items.js`) olivat juuri sitä. Nimet olivat
omia — pierusieni, kaasulehti — mutta muodot eivät: lakillinen sieni valkoisine
täplineen, silmällinen kukka varressa, vaahteranlehti, tähti. Ne on piirretty
uudelleen. Konventio jää, koska konventio on vapaa: peli saa yhä olla peli jossa
yksi esine kasvattaa, toinen antaa heitettävän ja kolmas tekee hetkeksi
haavoittumattomaksi. Muoto on nyt tämän pelin omaa aihepiiriä — kaasua,
ruoansulatusta, sisuskaluja — samasta rekisteristä kuin ummetuskorkki ja
kurnuttaja:

| esine | mikä se on nyt |
| --- | --- |
| pierusieni | tuhkelo: pelkkä itiöpussi ja reikä päällä, ei lakkia eikä jalkaa |
| varapallo (1-up) | solmittu ilmapallo, eli varakaasu taskussa |
| pierukukka | torvimainen kukka, aukko osoittaa jonnekin |
| kaasulehti | pavun parilehti, kaksi lehdykkää kuin siivet |
| hernekeitto | pata ja kauha, kasa keittoa reunan yli |
| paukkupapu | halkeava papu, vihreä maltopinta esillä |
| virvatuli | suokaasun sininen liekki (metaani palaa sinisenä) |

**Miksi tämä on portti eikä lupaus.** Sama vika voi tulla takaisin ensi kerralla
kun joku piirtää uuden esineen, ja "näyttääkö tämä liikaa joltakin" on
mielipide. Siksi `tools/verify.mjs` mittaa neljä asiaa numeroina:

1. **Laatikko.** Piirros pysyy 16x16 poimintalaatikossaan, koskettaa jokaista
   riviä ja saraketta eikä vuoda yli. (Vanha: kuudessa esineessä oli tyhjää
   laatikkoa, sienen kaasu vuoti maalikortin kehyksen yli.)
2. **Kaksi esinettä eivät ole sama kuva.** Mitataan se osuus laatikosta joka
   *näyttää* erilaiselta. Raja 40 % on kalibroitu pelin omaan grafiikkaan:
   vihollislajeista tiukin pari on piikikäs ja kurnuttaja **43,8 %**. Vanhoista
   esineistä kahdeksan paria alitti rajan, huonoimpana kukka ja lehti 29,7 % —
   ja sieni ja 1-up olivat sama piirros kahdella värillä, 35,9 %.
3. **Tausta.** Esine ei katoa yhteenkään kahdeksasta teemasta eikä HUDin
   lokeroon tai maalikorttiin. (Vanha: lehti erottui aavikon maasta **nollalla**
   pikselillä, tähti ruohon tiilestä nollalla.)
4. **Hengitys.** Jokainen esine liikkuu pelin jaetulla hengityskellolla.
   (Vanha: nolla seitsemästä.)

Mitattu, ei muistettu — ja mittaus on tässä nimenomaan se osa joka tekee
taulukon ensimmäisestä rivistä tarkistettavan eikä uskonasian.

### Kolme vanhinta vihollista

Päätetty 9.8.2026. Yllä oleva taulukko sanoi jo että grafiikka on itse tehtyä,
ja se piti paikkansa siinä mielessä että jokainen suorakulmio oli kirjoitettu
tähän repoon käsin. Kolme vanhinta vihollista oli silti *piirretty jonkin
toisen pelin hahmojen näköisiksi*, ja se on eri asia: kohta 2 sanoo että
suojattua on nimenomainen ilmaisu, ja tietty hahmo on juuri sitä. Ne on nyt
korvattu tämän pelin omilla:

| oli | on nyt | mikä se on |
| --- | --- | --- |
| ruskea mönkijä | **pöhö** | kaasusta pullistunut suolipussi, solmittu kiinni päältä, vuotaa takaa |
| kilpikonna ja sen kuori | **pönttö** | kalpea toukka joka asuu teräksisessä painesäiliössä — tallattuna se vetäytyy säiliöön, potkaistuna säiliö suihkuaa venttiilistään |
| putkesta nouseva kasvi | **nielu** | märkä, luuhampainen kurkku — putki on suoli, ja suolessa asuu nielu |

**Mekaniikkaan ei koskettu, ja se on tarkoituksellista.** Päälle hyppääminen,
kuoreksi litistyminen ja kuoren potkiminen ovat genrekonventioita eivätkä
suojattua ilmaisua (kohta 2), ja ne ovat myös se osa jonka varassa puolet pelin
kentistä lepää: `hitByShell`, liukuva kuori ja `shellSweep` ovat ennallaan
riviltä riviltä. Vaihdettiin **substantiivi, ei verbi**.

Samalla käyttöön tuli kaksi mittaa jotka pitävät tämän voimassa
(`tools/verify.mjs`), koska "näyttää omalta" ei ole tarkistettavissa mutta nämä
ovat:

- **Ylälaita kertoo saako päälle hypätä.** Tallattavien ja tallaamattomien
  ylälaidat eivät saa mennä päällekkäin. Vanha kasvi tarjosi 14 pikseliä
  tasaista laskeutumispintaa 16 pikselin laatikossa — koko vihollisjoukon
  levein, leveämpi kuin kävelijän 10 — eikä sen päälle ole koskaan saanut
  hypätä. Nielu mittaa 1 ja kantaa kolmea luupiikkiä, samasta `drawSpines`
  -funktiosta jolla piikkiukko on merkitty: peli saa yhden sanaston sille että
  tähän ei lasketa.
- **Vihollinen erottuu siitä maasta jolla se seisoo, kaikissa kahdeksassa
  teemassa.** Sama mitta kuin ruutujen teemaportilla ja kynnys laskettuna
  aavikon omasta maa/tiili-parista. Vanha kävelijä mittasi 5,7 % yön maata
  vasten ja 6,0 % ruohoa vasten eli oli pelin ensimmäinen vihollinen ja samalla
  sen huonoiten näkyvä.

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

Generoidut kentät rakentaa `tools/gen-levels.mjs` tilastoista, jotka
`tools/mine-pacing.mjs` louhii ulkoisesta kenttäkorpuksesta. Aluksi se koski
maailmaa 5; 9.8.2026 alkaen se on **se tapa jolla uudet kentät tehdään**
(v26.08.09.43, maailmat 1 ja 3 ensimmäisinä), joten tämän kohdan raja ei ole
enää bonusmaailman erikoisjärjestely vaan koko sisällöntuotannon raja. Se on
vedetty näin:

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
4. **Samankaltaisuustarkistus, ja se on nyt merkintä datassa eikä ohje.**
   Kun `VGLC_DIR` on asetettu, `tools/originality.mjs` kanonisoi sekä oman
   tuotoksemme että korpuksen samaan aakkostoon ja hylkää kentän, jos yksikään
   **8 sarakkeen ikkuna** osuu korpukseen. Ilman `VGLC_DIR`:iä tarkistusta ei voi
   tehdä, eikä sitä teeskennellä.

   Tässä luki pitkään *"nykyiset kentät on generoitu tarkistus päällä, osumia 0 —
   aja generaattori aina `VGLC_DIR` asetettuna"*, ja se lause on juuri se muoto
   jonka kolmas tekijä unohtaa: korpus ei ole repossa (kohta 1), joten
   tarkistamatta jättäminen ei maksanut mitään eikä näkynyt missään. Nyt näkyy,
   kolmella tavalla:

   - **Jokainen generoitu kenttä kantaa merkintänsä.** `src/data/generated.js`:n
     jokaisella kentällä on `origin`, generaattorin kirjoittamana:
     `'checked'` (korpus luettiin, osumia 0) tai `'not checked'` (tarkistusta ei
     tehty — mikä ei ole "ei osumia" vaan vastauksen puuttuminen).
   - **Yksi komento vastaa kysymykseen ilman että se korvaa vastauksen.**
     `VGLC_DIR="…" node tools/originality.mjs` lukee committoidun datan
     sellaisenaan, tulostaa rivin per kenttä ja palaa nollasta poikkeavalla
     koodilla jos yksikin ikkuna osuu. Ennen tarkistuksen saattoi ajaa vain
     generoimalla uudestaan, eli kysymys "onko tämä alkuperäistä" ei ollut
     esitettävissä ilman että sisältö samalla vaihtui.
   - **`tools/verify.mjs` väittää ympäristöstä ja tallenteesta yhdessä.**
     `VGLC_DIR` asetettuna: korpus luetaan ja jokainen ikkuna verrataan, ja ajo
     kaatuu sekä osumasta että kentästä joka on merkitty `not checked`
     ympäristössä jossa tarkistus olisi ollut mahdollinen. `VGLC_DIR`
     asettamatta: ajo lukee merkinnät ja tulostaa ne, ja kaatuu vain kentästä
     jolla ei ole merkintää lainkaan tai jonka merkintä ei ole kumpikaan
     kahdesta sanasta.

     **Jälkimmäinen puolisko oli 10.8.2026 asti toisin päin, ja se korjattiin
     sinä päivänä jona tarkistus ensimmäisen kerran ajettiin oikeasti.** Ehto
     oli *"ajo kaatuu jos jokin kenttä väittää olevansa tarkistettu"*, ja sen
     perustelu oli että tarkistusta ei ole tehty. Kun korpus saapui ja kaikki
     27 generoitua kenttää generoitiin `VGLC_DIR` asetettuna, tuo perustelu
     muuttui epätodeksi: `origin` on **tallenne siitä mitä generointiajossa
     tapahtui**, ei väite siitä ajosta joka lukee sen. Vanha ehto teki repostä
     punaisen jokaiselle jolla ei ole korpusta — 27 kaatavaa riviä, eikä
     yksikään niistä ollut valhe — eli se rankaisi työn tekemisestä ja kumosi
     tämän saman kohdan oman lauseen "repo saa olla vihreä ilman korpusta".
     Portti mittaa nyt sen mitä se voi mitata ilman korpusta (merkintä on
     olemassa ja se on tunnettu sana) eikä sitä mitä se ei voi (onko merkintä
     ansaittu).

   Kaatavaa porttia "tarkistamattomalle sisällölle" ei ole, ja se on harkittu:
   sellainen olisi punainen jokaisessa ympäristössä jossa korpusta ei ole, ja
   pysyvästi punainen portti sammutetaan — tai pahempaa, se painostaisi
   merkitsemään kentän tarkistetuksi jotta ajo menisi läpi. Sääntö on siksi
   toisin päin: **repo saa olla vihreä ilman korpusta, mutta se ei saa väittää
   mitään ilman korpusta.**

   Ohje pysyy: **aja generaattori aina `VGLC_DIR` asetettuna.** Erona vain se,
   että sen laiminlyönti lukee nyt datassa.
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
(1-4…1-7, 3-4…3-7, 4-4…4-7, 5-1…5-7, 6-4…6-7, 7-4…7-7 — 27 kenttää 60:stä);
käsintehdyissä säännöt ovat suunnitteluohje, ja jos ne joskus halutaan taata
koko pelille, sama validaattori pitää ajaa `tools/verify.mjs`:stä.

Sen lisäksi jokainen generoitu kenttä on **oman teemansa mittainen**: luussa
taivas on auki eikä mikään roiku, pilvessä mikään ei seiso maassa eikä lauta
silloita kuoppaa, tehtaassa on katto, linnakkeessa ei ole ulkopuolta eikä lippua.
Nuo ehdot kirjoitettiin maailmoille 6–8 palikkatiedostoja vasten, mikä riitti
niin kauan kuin ne maailmat tehtiin käsin; generoitu kenttä ei kokoa palikoita,
joten `THEME_RULES` sanoo saman valmiista ruudukosta ja `verify.mjs` todistaa
jokaisen ehdon rikkinäisellä koekentällä.

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
  (pikatallennukset), `sfb3.scores.v1` (pistetaulu), `sfb3.telemetry.v1`
  (pelidata), `sfb3.fx.v1` (kuvaefektit) ja `sfb3.touch.v1` (ohjausmalli). Jos muutat tallennuksen
  muotoa, nosta versionumeroa.
- **Kuollut kohtaus lakkaa päivittämästä.** `LevelScene.update` palaa aikaisin
  140 framea kuoleman jälkeen. Testi joka haluaa ajaa kohtausta pitkään pitää
  pitää pelaaja hengissä — muuten se mittaa kuolemanimation pituutta eikä sitä
  mitä luulee. Kaksi murenemistestin versiota kaatui juuri tähän.
- **Canvas on ylhäältä alas, GL-tekstuuri alhaalta ylös.** Ilman
  `UNPACK_FLIP_Y_WEBGL`-asetusta koko peli tulee ruudulle ylösalaisin.
  (`src/gfx/postfx.js`)
- **Kuviotehosteiden taajuus sidotaan lähdekuvaan, ei näyttöön.** Skanviiva per
  *näyttöpikseli* lähestyy pikseliruudukkoa ja hajoaa moiré-renkaiksi; skanviiva
  per *lähderivi* (240) on skanviiva. Sama koskee varjomaskia, joka lisäksi
  tarvitsee kolme oikeaa laitepikseliä ollakseen kuvio eikä himmennys.
- **Piirtokoodi ei saa jättää canvasin tilaa jälkeensä.** `globalAlpha`,
  `globalCompositeOperation`, `filter` ja `imageSmoothingEnabled` palautetaan
  aina. Vuotanut yhdistelytila sotkee seuraavan framen ruudut ja näyttää
  grafiikkabugilta, ei vuodolta. `verify.mjs` tarkistaa tämän sekä spriteiltä
  että jälkikäsittelyltä.
- **Kosketuksen `clearTouch()` tyhjentää myös painalluslatchin.** Latch on siksi
  että framea lyhyempi näpäytys rekisteröityy; ilman tyhjennystä ohjausmallin
  vaihto kesken painalluksen syöttää haamupainalluksen seuraavalle framelle.
- **Kirkkauden kynnystys tehdään luminanssista, ei kanavista.** Kanavakohtainen
  kynnys ei erota kirkasta sinistä taivasta valkoisesta auringosta, koska
  taivaan sininen kanava on jo 252.
- **`window.sfb3` on elävä Game-olio.** Konsolista pääsee käsiksi kaikkeen, ja
  `tools/verify.mjs` ajaa koko testistön juuri sen kautta.

## 8. Diegeettinen ja ei-diegeettinen

Tämä jako ratkaisee useimmat "pitäisikö tämän efektin koskea tuohon" -kysymykset
ilman että niistä tarvitsee väitellä erikseen.

- **Diegeettinen** on maailman sisällä: kolikon kilahdus, pomon askel, aavikon
  tuuli, jään rätinä, kuumuuden väreily, huurre ruudun reunoilla. Nämä syntyvät
  jostakin mikä on siinä huoneessa.
- **Ei-diegeettinen** on kertojan puolella: musiikki, HUD, pistelaskuri,
  välikortit, esittelytilan teksti. Mikään kentässä ei soita musiikkia.

**Sääntö: huone värittää sen mikä on huoneessa, ei sitä mikä ei ole.**

Siitä seuraa suoraan mitä on jo tehty:
- Linnakkeen kaiku roikkuu `sfxBus`issa eikä masterissa. Elokuvamusiikki ei kaiu
  kun kohtaus siirtyy luolaan, mutta askeleet kaikuvat. Mitattu: sama
  musiikkipätkä vaimenee identtisesti linnakkeessa ja niityllä (634 vs 642 ms),
  sama tömäytys 91 ms → 367 ms.
- Kuumuus ja huurre eivät kosketa HUD-palkkia. HUD ei ole ikkuna maailmaan.
- Bloom ei kosketa HUD-palkkia samasta syystä.
- Tuuli ja jään rätinä ovat diegeettisiä: ne **ovat** se paikka, joten ne
  menevät ääniefektien puolelle ja huoneen läpi.

### Työkalu, ei vain sääntö

Rajan voi myös **rikkoa tarkoituksella**, ja silloin se on tehokas. Ei-diegeettinen
kerros voi reagoida maailmaan, kun se on dramaattinen valinta eikä vahinko:

- musiikki vaimenee tai ohenee ennen pomotaistelua — kertoja hiljenee
- musiikki kääntyy nurin tai vinoon määräaikaisen tehostuksen ajaksi
- koko ruutu sykkii kun P-mittari täyttyy

**Kumpikin puoli aina yhdessä.** Ääni ilman kuvaa jää huomaamatta melussa, kuva
ilman ääntä tuntuu tekniseltä häiriöltä. Ja jokaisen tällaisen efektin pitää
erottua pomon omista efekteistä eri värillä ja eri rytmillä, tai pelaaja oppii
lukemaan väärää signaalia.

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
