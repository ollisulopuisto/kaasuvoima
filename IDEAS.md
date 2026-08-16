# Lainattavat mekaniikat, ja mitä niistä syntyy

Ostoslista harkittavaksi. **Mikään tässä ei ole päätetty** — [ROADMAP.md](ROADMAP.md)
on se tiedosto joka kertoo mitä tehdään, ja tämä on se josta sinne poimitaan.

## Miksi tämä on sallittua, ja missä raja menee

[DESIGN.md](DESIGN.md) kohta 2 sanoo sen jo: **pelin säännöt, mekaniikat ja
genrekonventiot eivät ole tekijänoikeuden suojaamia — suojattua on nimenomainen
ilmaisu.** Eli:

| saa ottaa | ei saa ottaa |
| --- | --- |
| verbi: "ammu jotain jonka päällä voi seistä" | hahmon nimi, ulkonäkö, sävelmä, kenttäkartta |
| rakenne: "vahinko muuttaa muotoa, ei tapa" | se miltä *heidän* toteutuksensa näyttää |
| resurssi: "vauhti on valuutta jolla ostetaan korkeutta" | grafiikka, ääni, teksti |

Sama raja kuin kohdassa 3 kenttägeneroinnissa: **rytmi kyllä, layout ei.**

Ja yksi lisäsääntö joka on tämän pelin oma: **lainattu verbi on käännettävä
tämän pelin sanastolle.** Kaasu, ruoansulatus, ummetus, viisi voimatasoa,
vauhtimittari. Mekaniikka joka voisi olla missä tahansa pelissä ei ole vielä
meidän — se on vasta lainassa.

---

## Ostoslista: kaksitoista verbiä

Hinta-arvio on suhteessa tähän moottoriin, ei yleisesti.

### 1. Vauhti korkeudeksi (Sonic)
Rinteet muuttavat vaakavauhdin nousuksi. Nopeampi reitti on *ylempi* reitti,
eli kenttä kerrostuu itsestään.
**Meillä on jo puolet:** vauhtimittari nostaa nopeuskaton 2,5 → 3,5 ja avaa
lennon. Tämä tekisi siitä kulkuvälineen eikä pelkkää lentonappia.
**Hinta: korkea.** Moottorissa ei ole rinteitä lainkaan — `moveX`/`moveY` ovat
ruudukkotörmäystä. Tämä on fysiikkamuutos, ei kenttädataa.

### 2. Ammus joka on myös lava (Rainbow Islands)
Ammuttu kaari on sekä ase että porras: sen päälle voi hypätä, ja se katoaa.
**Hinta: keskitasoa.** `FartBall` on olemassa; tarvitaan osuma-kohtainen
lyhytikäinen puolikiinteä ruutu. Semi-solid (`-`) on jo olemassa.

### 3. Maailman vaihto lennossa (Giana Sisters: Twisted Dreams)
Sama kenttä kahtena versiona, vaihto napista kesken hypyn; eri lavat, eri
viholliset.
**Hinta: erittäin korkea.** Kaksi layoutia per kenttä ja **kaksinkertainen
validointi** — `rules.js`:n pitäisi todistaa jokainen vaihtohetki, ei vain
lähtötila. Sama ongelma kuin areenaa muokkaavalla pomolla, jonka roadmap on jo
tunnistanut vaikeimmaksi kohdaksi.

### 4. Litteä maailma käännetään (Super Paper Mario)
Hetkeksi näet saman paikan toisesta suunnasta: seinä osoittautuu ohueksi,
kuilun yli onkin silta.
**Meillä on jo infrastruktuuri:** kolme kaistaa (taivas/reitti/luola) ovat
olemassa ja validoituja, ja `bandAt` osaa kertoa missä jalat ovat.
**Hinta: keskitasoa**, jos se on "näytä hetkeksi viereinen kaista ja salli
astua läpi siellä missä ne osuvat kohdakkain" eikä oikeaa 3D:tä.

### 5. Vahinko muuttaa muotoa, ei tapa (Wario Land)
Et kuole — palat, litistyt, turpoat, ja **jokainen muoto avaa reitin** jota
terve hahmo ei pääse.
**Hinta: keskitasoa.** Viisi voimatasoa on jo muodonmuutosjärjestelmä;
tämä kääntäisi vahingon sisäänpäin sen sijaan että se vain vähentää.

### 6. Syö vihollinen, saat sen kyvyn (Kirby)
**Hinta: keskitasoa.** Kuplaloukku on jo puolet mekaniikasta: kuplassa oleva
vihollinen on jo "pidossa". Nieleminen olisi toinen tapa käyttää sitä.

### 7. Syöksy jolla on lataus (Celeste)
Vaakasyöksy ilmassa, latautuu maahan osuessa.
**Varoitus:** maahanisku tehtiin tänään ja se maksaa 47 framea ohjaamatonta
aikaa. Toinen ilmaverbi kilpailisi siitä samasta hetkestä. Jos tämä otetaan,
jommankumman pitää menettää jotain.

### 8. Tartu ja heilahda (Bionic Commando, Umihara Kawase)
Koukku joka korvaa hypyn tai täydentää sitä.
**Meillä on jo puolet:** kaasulehden häntäisku on ulottuva liike.
**Hinta: korkea.** Köysifysiikka on oma maailmansa.

### 9. Painovoiman kääntö (VVVVVV)
Ei hyppyä lainkaan — vaihdat vain kumpaan suuntaan putoat.
**Hinta: keskitasoa** mekaniikkana, **korkea** kenttäsuunnitteluna: jokainen
kenttä pitäisi tehdä sitä varten. Sopisi paremmin yhdelle bonuskaistalle kuin
koko peliin.

### 10. Putoavat lohkot ja ketjureaktiot (Boulder Dash)
Ruudut tottelevat painovoimaa: pura alta, ja pino tulee alas.
**Hinta: matala.** Ruudukko on jo osoitettu muunneltavaksi ja
tallennusturvalliseksi (murenevat lavat, kytkinruudut, pavunvarsi).

### 11. Ammuksen voi ratsastaa (Mr. Gimmick)
Heitä jotain, hyppää sen päälle, ohjaa sitä.
**Hinta: keskitasoa.** Lähisukua kohdalle 2, mutta eri verbi: tuo rakentaa
portaan, tämä on kulkuneuvo.

### 12. Kaikki reagoi kaikkeen (Spelunky)
Ei uusi verbi vaan sääntö: jokainen olio noudattaa samoja lakeja, ja hauskuus
syntyy törmäyksistä joita kukaan ei suunnitellut.
**Meillä on jo alku:** viholliset uppoavat juoksuhiekkaan (v26.08.09.41), ja
potkaistu kuori päätyy lammikkoon. Se oli hauskin yksittäinen löydös koko
päivästä. **Tämä on halvin kohta listalla, koska se on suunta eikä ominaisuus.**

---

## Omistajan tuomiot, 10.8.2026

Kaikki kaksitoista käytiin läpi yksitellen. **Tämä taulukko on se mikä tässä
tiedostossa on nyt päätettyä** — loput on yhä harkintaa, ja se mikä etenee
siirtyy [ROADMAP.md](ROADMAP.md):hen.

| # | verbi | lähde | tuomio |
| --- | --- | --- | --- |
| 1 | vauhti korkeudeksi | Sonic | **kyllä, vahvin** |
| 2 | ammus joka on lava | Rainbow Islands | ei |
| 3 | maailman vaihto lennossa | Giana Sisters | ei |
| 4 | litteä maailma käännetään | Super Paper Mario | **päätetty 10.8.** → ROADMAP |
| 5 | vahinko muuttaa muotoa | Wario Land | epävarma |
| 6 | syö vihollinen, saat kyvyn | Kirby | **kyllä** |
| 7 | syöksy jolla on lataus | Celeste | ehkä |
| 8 | tartu ja heilahda | Bionic Commando | **harkittu, ei oteta** |
| 9 | painovoiman kääntö | VVVVVV | ei |
| 10 | putoavat lohkot | Boulder Dash | **kyllä, yhdelle laattatyypille** |
| 11 | ammuksen voi ratsastaa | Mr. Gimmick | harkintaan |
| 12 | kaikki reagoi kaikkeen | Spelunky | **päätetty 10.8.** → ROADMAP |

### Miksi kohta 1 on vahvin, omistajan sanoin

*"Slopes turn into speed is a VERY good idea, because Mario does sliding on
slopes and this would be different."*

Se on tarkka erottelu ja se kannattaa kirjata, koska se ratkaisee koko idean.
Mariossa rinne on **liikkeen laatu** — luiskahdus, jolla tapetaan vihollisia ja
joka on itsessään palkinto. Tässä rinne olisi **muunnin**: vaakavauhti
vaihdetaan korkeudeksi, ja korkeus on pääsy ylemmälle reitille. Sama laatta,
eri verbi, ja se ero on juuri se raja jonka [DESIGN.md](DESIGN.md) kohta 2
vetää — konventio on vapaa, toteutus on omaa.

Hinta ei muutu miksikään: moottorissa ei ole rinteitä lainkaan, `moveX`/`moveY`
ovat ruudukkotörmäystä, ja tämä on fysiikkamuutos eikä kenttädataa. Se on
kuitenkin nyt tiedossa oleva hinta tunnetusta syystä, mikä on eri asia kuin
epämääräinen "korkea".

---

## Synteesit: kahdeksan jotka olisivat meidän

Lainattu verbi + tämän pelin sanasto. Nämä ovat se osa jota ei voi googlata.

### A. PIERUHYLLY — ammus joka on lava (2 + kaasu)
Pierupallo joka osuu seinään tai kattoon **litistyy kaasuhyllyksi**: kolmen
ruudun puolikiinteä lava, joka haihtuu kahdessa sekunnissa.

Kaksi asiaa tekee tästä meidän eikä lainaa:
- **Sama nappi, kaksi tarkoitusta, ei tilaa.** Ammu tappaaksesi tai ammu
  rakentaaksesi — ero on siinä *mihin* osut, ei siinä mitä painat.
- **§5 hoituu itsestään.** "Ei portaita tyhjään" on huoli pysyvistä portaista;
  hylly joka haihtuu ei voi olla reitti, vain oikaisu.

Voimataso vahvistaa: enemmän palloja = pidempi hylly. Perusliike toimii
tasolla 1.

### B. KAASUKUPLA JOKA KANTAA — kuplaloukku ylösalaisin (6 + kuplaloukku)
Kuplaan vangittu vihollinen leijuu jo. **Hyppää sen päälle.** Kupla kestää
painon hetken ja puhkeaa — vihollinen kuolee, sinä olet ruutua ylempänä.

Tämä on suoraan olemassa olevasta koodista: `bubbled`-vihollinen on jo
vaaraton ja leijuva. Se antaa kuplalle kolmannen käyttötavan sen kahden
lisäksi (odota / puhkaise) ja tekee "ammu vihollinen ja käytä sitä" -silmukan
ilman uutta olioluokkaa.

### C. UMMETUS ON MUOTO EIKÄ RANGAISTUS (5 + ummetuskorkki)
Korkki tukkii nyt maahaniskun. Käännä se ympäri: **tukossa oleva hahmo on
raskas** — uppoaa puulavojen läpi, ei lennä tuulessa, rikkoo murenevan lavan
alle asti. Hernekeitto avaa sen.

Vahingosta tulee verbi. Kaasulehden kevyt liito ja ummetuksen paino ovat
saman akselin päät, ja se akseli on jo pelin aihe.

### D. HAJU JOKA VÄÄNTÄÄ TODELLISUUTTA (4 + kaistat)
Täysi vauhtimittari + alas: **viereinen kaista näkyy hetken läpikuultavana**,
ja siellä missä molemmissa on lattia, voit astua läpi.

Tämä ei ole 3D-käännös vaan sen halpa ja rehellinen serkku, ja se käyttää
kolmea kaistaa jotka on jo rakennettu ja validoitu. Salaisuuksien
löydettävyyden kolmas osa ("demo näyttää tempun") on yhä auki — tämä olisi
toinen vastaus samaan kysymykseen.

**Riski joka pitää mitata ensin:** tämä tekee piilokaistoista näkyviä, ja koko
salaisuusrakenne perustuu siihen että kartta kertoo *että* niitä on muttei
*missä*. Jos tämä tulee, sen pitää maksaa jotain — vauhtimittari, tai
näkyminen vain siellä missä seisot.

### E. HIEKKA TOTTELEE PAINOVOIMAA (10 + juoksuhiekka)
Juoksuhiekka on jo oma ruutujoukkonsa `SINK`. Anna sille painovoima: riko
lohko lammikon alta ja **hiekka valuu alas** ja täyttää sen mihin se putoaa.

Aavikko saa ketjureaktion joka ei ole kenenkään muun, ja `checkQuicksand`
(pohja + reuna) on jo se validaattori jota tämä tarvitsee — se pitäisi vain
ajaa lopputilalle eikä lähtötilalle. **Sama ongelma kuin areenaa muokkaavalla
pomolla**, eli tämä kannattaa tehdä *ennen* sitä, halvempana harjoituksena.

### F. KURNUTTAJAN KYYTI (11 + kurnuttaja)
Kurnuttaja loikkaa kuilusta 90 framen varoituksella. **Hyppää sen selkään**
ylöspäin matkalla: se ei kuole (piikit eivät ole sen juttu, mutta tallaus ei
tepsi), mutta kantaa sinut ylemmäs kuin oma hyppy.

Vihollisesta tulee kulkuneuvo ilman uutta olioluokkaa, ja se palkitsee
juuri sen taidon jota 90 framen varoitus opettaa: ajoituksen.

### G. LOPPUKENTÄN VOI SYÖDÄ (6 + maailma 8)
Maailma 8 on kuusi pomoa peräkkäin ilman lippua. Anna nieleminen: **kaadettu
pomo jättää yhden kertakäyttöisen kyvyn**, ja seuraava tappelu alkaa se
kädessä.

Tekee finaalista kumuloituvan sen sijaan että se on kuusi erillistä ottelua, ja
se on Mega Manin rakenne ilman Mega Manin mitään muuta.

### H. VAUHTI ON VALUUTTA (1 + vauhtimittari, halpa versio)
Rinteitä ei ole eikä niitä kannata rakentaa. Mutta **täysi mittari voisi ostaa
korkeutta ponnahduslaudalta**: kaasusuihku lattiassa joka nostaa sitä
korkeammalle mitä täydempi mittari on.

Se on Sonicin idea — nopeus on pääsylippu ylemmälle reitille — ilman
fysiikkaremonttia. Ja se antaa mittarille kolmannen käyttötavan.

### I. KAIVAUTUMINEN — pystykenttä joka menee alas (odottaa pystytukea)
Pystykenttä rakennetaan nyt pilvimaailmaa varten, ja siellä suunta on ylös:
lava lavalta, putoaminen ei tapa. **Sama kamera osaa saman tempun ylösalaisin.**
Luumaailmaan kenttä jossa lähdetään pinnalta ja kaivaudutaan alas.

Miksi tämä on eri kenttä eikä sama peilattuna:
- **Ylöspäin virhe maksaa etenemisen, alaspäin se maksaa vain nopeutta.**
  Pilvikentässä pudotus vie takaisin edelliselle sivulle; kaivauduttaessa
  pudotus vie *eteenpäin*, väärään paikkaan. Rangaistus pitää siis rakentaa
  maastoon (piikkipohjat, umpikujat) eikä putoamiseen.
- **Sivutus lukee toisin päin.** Ylöspäin mentäessä kamera näyttää minne olet
  menossa; alaspäin se näyttää minne olet putoamassa, mikä on sama tieto mutta
  kiireellisempänä. Se on syy tehdä tämä *jälkeen* pilvikentän, ei sen sijasta.
- **Luumaailmalla on jo sanasto tähän:** murenevat lavat ja kuilut. Alaspäin
  murenee lava on portaali eikä ansa.

**Riippuvuus, ei arvio:** tämä ei maksa mitään uutta kameratyötä jos pystytuki
tehdään suuntaneutraalisti — ja juuri siksi se kannattaa kirjata nyt, kun
pystytukea vasta rakennetaan.

---

## Mukautuva maailma — suunnitelma, ei päätös (16.8.2026)

Omistajan kysymys: *"onko tää hullu idea: kenttä joka mukautuu siihen miten
vahva pelaaja on… entä jos skaalaamme vihujen määrää/nopeutta ja hyppyjen/
aukkojen mittaa jossain suhteessa powerupien kertymisen kanssa?"* — ja heti
perään se lause joka ratkaisee koko asian: *"kaikkein siisteintä tietysti
olisi, jos pelaaja näkisi maailman muuttuvan suoraan silmien edessä."*

Tämä osio on se suunnittelu jota omistaja pyysi tehtäväksi ennen kuin mitään
rakennetaan. Se ei päätä mitään.

### 1. Ongelma, mitattuna

Palkinto ei tee hypystä parempaa. Se tekee hyppyjä **lisää**:
`airJumpsMax` on pierusienellä sama kuin voimataso, eli tasolla 5 ilmassa on
viisi ylimääräistä ponnistusta.

Kenttägeometria on mitoitettu yhtä hyppyä vasten. [PHYSICS.md](PHYSICS.md):n
mitatut luvut ovat juoksuhyppy 85 px nousua ja 155 px kantamaa, pieruhypyllä
174 ja 285, ja suunnittelubudjetti on kuilu 6 ruutua eli 96 px — 70 % siitä
mitä juoksuhyppy kantaa. Viidellä ilmahypyllä vaakasuora ulottuvuus ei ole
enää rajallinen suure lainkaan, joten **pelin levein kuilu (softGap 9) on
täydellä kaasulla lyhyempi kuin yksi ponnistus.**

Se on talouden vika eikä kenttien: kentät on hinnoiteltu hypyn *pituudella*, ja
palkinto myy hyppyjen *määrää*. Mikään kuilu ei voi hinnoitella sitä.

### 2. Se sääntö joka erottaa hyvän mukautumisen huonosta

**Maailma saa reagoida siihen mitä pelaaja tekee, ei siihen mitä hänellä on.**

Molemmat ovat "mukautumista", ja ne ovat eri asioita:

- **Reagointi omistamiseen** (voimataso, kerätyt esineet) on näkymätöntä. Se
  kumoaa palkinnon — kerätty sieni ei anna mitään jos kuilu levenee sen mukana
  — ja pelaaja lukee sen huijaukseksi heti kun huomaa sen. Se myös tekee
  jokaisesta mitatusta luvusta epätoden: `DIFFICULTY`-taulu, aika-ajon
  ennätykset, opetusjärjestys ja päivän pierun sormenjälki kuvaavat *sitä yhtä
  kenttää*, ja kuudessa versiossa jokainen niistä joutuu kysymään "minkä
  version?".
- **Reagointi tekemiseen** on mekaniikka. Sillä on syy jonka näkee, seuraus
  jonka voi ennustaa, ja hinta jonka pelaaja valitsee.

Omistajan oma lause on tämän testi: **jos pelaaja ei näe syytä, se on väärä
laji mukautumista.** "Näkee maailman muuttuvan" ei ole koriste tämän idean
päällä — se on ainoa asia joka tekee ideasta kelvollisen.

### 3. Kolme ehdokasta sille mikä näkyvästi muuttuu

**V1 — geometria liikkuu.** Kuilut levenevät, lavat vetäytyvät.
*Näkyvyys:* paras. *Hinta:* korkein, ja yksi sen muodoista on se ainoa asia
jota tasohyppely ei saa tehdä: maasto joka liikkuu sitoutuneen hypyn alla.
Lisäksi jokainen validaattorin sääntö (`checkGaps`, `checkWalls`), voimatason 0
todistus ja tallennus koskisivat versiota eikä kenttää. **Ei** — paitsi
kapeana muotona jossa muutos tapahtuu vain siellä missä pelaaja ei ole ja vain
ennen sinne tuloa, ja sekin on kallis.

**V2 — aine nousee.** Kaasu (tai hiekka) nousee huoneessa ruutu kerrallaan.
*Näkyvyys:* erinomainen — nouseva pintaviiva on luettavin maailmanmuutos mitä
on. *Se ei siirrä geometriaa*, se poistaa alareitin ja jättää yläreitin, ja
yläreitti on jo olemassa: lankut ja hyppysarjat. Moottorissa on ennakkotapaus
kolmesti — juoksuhiekalla on kirjattu sopimus ("hidas veto, sekunteja aikaa
reagoida"), laava on kuoppien kansi, ja kytkin kirjoittaa laattoja koko
kentässä ajastimen ajan. *Hinta:* keskitaso. **Ja se lahja jonka vain tämä
vaihtoehto antaa: pelaajan voima muuttuu siksi mikä hänet pelastaa** — yläreitti
on hyppyjä, ja hyppyjä hän juuri osti.

**V3 — asukkaat heräävät.** Vihollisia enemmän ja nopeammin.
*Näkyvyys:* puolittainen: enemmän vihollisia näkyy, mutta *miksi* ei näy. Tämän
akselin omistaa jo `scale.js` vaikeustasovalinnan kautta, ja toinen piilotettu
säädin samalle akselille tekee näkyvästä valinnasta valheen. *Hinta:* matala,
*arvo:* matala.

### 4. Suositus: PAINEVENTTIILI

V2 yhdistettynä kohdan 2 sääntöön.

Kentässä on **venttiili**, ja sen saa auki **maahaniskulla** — pelin oma
tahallinen, ennakoitu ja aikaa maksava maailmaan vaikuttava verbi, joka jo
rikkoo lattian. Iskusta **paine nousee yhden askeleen, näkyvästi**: kaasupinta
nousee ruudun, huone saa sävynsä (palettisiirto on jo olemassa), nukkuvat
heräävät.

Askelia on 0–3. Jokainen askel vie alareitin ja nostaa palkkiota. **Pelaaja
valitsee.** Nolla askelta on se kenttä joka on mitattu ja todistettu; kolme on
vaikeampi kenttä jonka hän pyysi ja josta hänelle maksetaan.

Miksi tämä on meidän eikä lainaa (kohdan 2 lisäsääntö):

- **Hahmolla on vyöllään messinkinen paineventtiili**, ja se on ollut siinä
  siitä asti kun puku piirrettiin — `sprites/player.js` sanoo sen omin sanoin:
  mies joka menee alas suolistojen maailmaan mukanaan jotain jolla päästää
  paine ulos. Mekaniikka on jo piirretty; sitä ei ole vielä ollut olemassa.
- Maailma on suoli. Paineen nousu suolessa ei ole vertauskuva vaan juoni.
- Verbi on maahanisku, jolle juuri annettiin kyykky ja lattian rikkominen.

Ja miksi se korjaa kohdan 1: **paine ei ohita pelaajan voimaa vaan kuluttaa
sen.** Yläreitti pyytää tasan niitä ylimääräisiä hyppyjä jotka sieni antoi.

### 5. Mitä tämä rikkoisi, ja miten kukin pidetään

| mikä | miten se pidetään |
| --- | --- |
| DESIGN.md 5: tehostus avaa paikkoja, ei kenttää | paine 0 on kenttä sellaisena kuin se on todistettu; venttiili on valinnainen |
| voimatason 0 todistus (botti + ratkaisija) | **sääntö geometriana, ei N ajoa:** kaasu ei saa koskaan nousta niille riveille joilla todistettu maareitti kulkee. Se on `rules.js`:n tarkistettavissa |
| `DIFFICULTY`, aika-ajo, pistetaulu | mitattu luku on paineen 0 luku; paine on modifikaattori kuten vaikeustasokin. Aika-ajon ennätys kantaa paineen mukanaan — kolmella paineella ajettu aika on eri ja parempi suoritus |
| päivän pieru, generoidut kentät | ei kosketa: generaattori ei aseta venttiilejä |
| tallennus | yksi kokonaisluku (`pressure`) ja ruudukko, joka tallennetaan jo |
| DESIGN.md 8: yksi merkki, yksi merkitys | askel on **yksi** tapahtuma: yksi kuva, yksi ääni. Koko ruudun väri vaatii saman välähdysmittauksen kuin tähti (ROADMAP 16.8.) |

### 6. Ja se mikä on tehtävä ensin, riippumatta tästä

**Ilmahyppyjen määrä on korjattava ennen kuin venttiili kannattaa rakentaa.**
Viisi ilmahyppyä trivialisoi myös yläreitin, eli paine nostaisi kaasua ja
pelaaja lentäisi sen yli. Venttiili ei siis ole vaihtoehto ilmahyppyjen
rajaamiselle vaan asia joka vaatii sen ensin.

Se on yhden luvun muutos eikä riko mitään: kaikki on todistettu voimatasolla 0,
joten kyvyn vähentäminen ei voi tehdä yhdestäkään kentästä mahdotonta.

### 7. Yksi mittaus, joka pitää ajaa ennen päätöstä

Koko suositus lepää väitteellä **"tarkkuus ei skaalaudu kaasulla, kantama
skaalautuu"**: yhden ruudun laskeutuminen on 16 px olitpa miten vahva tahansa.
Väite on mitattavissa, joten sitä ei pidä uskoa.

`tools/jump-solver.js` ajetaan kolmelle toimitetulle sarjalle voimatasolla 5
pierusienellä ja ilmahypyt sallittuna, ja ikkunoita verrataan voimatason 0
lukuihin (49/48/40/47/49 · 33/33/28/33/36/49 · 18/17/15/9/17/33 px):

- **Jos ikkunat avautuvat vähän**, tarkkuus on voimasta riippumaton, yläreitti
  toimii suunnitellusti ja tämä osio seisoo mitatulla pohjalla.
- **Jos ne avautuvat rajusti**, yläreitti on täydellä kaasulla yhtä helppo kuin
  alareitti, ja silloin venttiili ei muuta kysymystä vaan vain maisemaa — ja
  koko suunta on väärä ennen kuin kohta 6 on tehty.

### 8. Avoimet kysymykset omistajalle

1. **Venttiili vai automaatti** — nostaako paineen pelaaja vai voimataso? (Tämä
   osio suosittelee venttiiliä, ja kohta 2 on se perustelu.)
2. **Kuinka kauas paine kantaa** — kenttä vai maailma?
3. **Mikä on palkkio** — pisteet, kortti, salaisuus vai oikotie?
4. **Missä tämä on** — kaikkialla, vai maailma 8:n oma asia?

## Kaksi läpiajoa, koska niitä pyydettiin

### Kohta 4 tarkemmin: mitä "litteä maailma käännetään" olisi täällä

**Se ei ole 3D eikä sen pitäisi olla.** Tämä peli on kolmessa kaistassa —
taivas, reitti, luola — jotka ovat 15 riviä kukin, päällekkäin, ja `bandAt`
kertoo jo kumpaan jalat osuvat. Käännös on siis **naapurikaista**, ei kolmas
ulottuvuus, ja se on ainoa versio jonka tämä moottori voi tehdä rehellisesti.

**Mitä pelaaja tekee.** Täysi vauhtimittari + alas: viereinen kaista näkyy
hetken läpikuultavana, ja **niissä sarakkeissa joissa molemmissa on lattia**
voit astua läpi. Ei ovea, ei putkea, ei animaatiota — pelkkä hetki jolloin
maailma on kaksikerroksinen.

Neljä asiaa jotka pitää ratkaista ennen kuin tämän voi luvata:

1. **Ylös vai alas?** Kolme kaistaa tarkoittaa että reittikaistalta on kaksi
   naapuria. Yksi nappi ei voi tarkoittaa kahta paikkaa — sama ongelma kuin
   kartan nuolissa, joka juuri tänään jätti pelaajan jumiin. Vaihtoehdot ovat
   *aina alas* (yksinkertainen, ja luolakaista on se jossa salaisuudet ovat),
   tai *sen mukaan mitä painat*, jolloin ylös ja alas ovat eri liikkeitä.
   Suositus: **aina alas**, ja jos se osoittautuu liian rajaavaksi, se on
   halvempi laajentaa kuin peruuttaa.

2. **Mikä sen maksaa.** Tämä on se kohta joka tekee tai kaataa idean.
   Salaisuusrakenne perustuu siihen että kartta kertoo *että* salaisuuksia on
   muttei *missä*; läpinäkyvä naapurikaista kertoo missä. Jos tämä ei maksa
   mitään, se ei ole kyky vaan tutka, ja koko löytämisen ilo katoaa
   kertakäytöllä. Vauhtimittari on oikea hinta juuri siksi että se on jo
   varattu kahteen asiaan (nopeuskatto, kaasulehden lento) — sen polttaminen
   näkemiseen on aito valinta eikä ilmainen lisä.

3. **Validointi on tämän oikea hinta, ei piirtäminen.** Läpikuultavan kaistan
   piirtäminen on tunnin työ. Sen todistaminen ettei läpiastuminen riko kenttää
   ei ole. Tällä hetkellä `rules.js` todistaa **reittikaistan**: että maareitti
   on läpäistävissä voimatasolla 0. Jos jokainen sarake jossa molemmissa
   kaistoissa on lattia on ovi, validaattorin pitää yhtäkkiä todistaa
   **kaistojen välinen graafi**, ei yhtä kaistaa — ja vastata kysymykseen
   "voiko pelaaja pudota paikkaan josta ei pääse pois". Se on sama ongelma kuin
   areenaa muokkaavalla pomolla, jonka roadmap on jo merkinnyt vaikeimmaksi
   kohdaksi.

4. **Kohta 5 pysyy voimassa.** Maareitin on oltava läpäistävissä voimatasolla 0
   **ilman käännöstä**. Käännös saa siis olla oikaisu, ei reitti — täsmälleen
   sama ehto kuin synteesin A pieruhyllyllä, ja samasta syystä.

**Hinta-arvio tarkennettuna:** piirto ja syöte matala, validointi korkea. Ja
juuri siksi tämä kannattaa tehdä *jälkeen* kohdan 10, joka on pienempi versio
samasta validointiongelmasta — kenttä joka muuttuu pelin aikana.

### Kohta 12 läpiajettuna: mitä "kaikki reagoi kaikkeen" tarkoittaisi, ja mikä siinä on vaarallista

Tämä ei ole ominaisuus vaan **suunta**, ja siksi se on sekä halvin että
vaarallisin listalla. Läpiajo neljässä osassa.

**1. Mitä se konkreettisesti on.** Erikoistapausten korvaaminen laeilla joita
jokainen olio noudattaa. Meillä on jo kaksi lakia joita ei kirjoitettu laeiksi
vaan jotka syntyivät jaetusta koodista, ja ne ovat parasta mitä tässä pelissä
on tapahtunut: **viholliset uppoavat juoksuhiekkaan**, ja **potkaistu kuori
päätyy lammikkoon**. Kumpaakaan ei suunniteltu. Molemmat ovat hauskempia kuin
mikään suunniteltu vuorovaikutus samassa kentässä.

**2. Mistä jatkaa, halvimmasta päästä.** Maasto vaikuttaa kaikkeen, ei vain
pelaajaan. Jää on liukas myös kävelijälle. Tuuli kantaa myös kuorta. Murenevat
lavat murenevat myös vihollisen alta. Laava tappaa myös sen mikä siihen putoaa.
Nämä ovat **yksisuuntaisia** (maasto → olio) ja siksi testattavia yksi
laattatyyppi kerrallaan. Kohta 10 on tämän ensimmäinen askel eikä erillinen
idea: putoava laatta on maasto joka tottelee samaa painovoimaa kuin oliot.

**3. Missä se kaatuu, ja tämä on koko asian ydin.** Spelunky voi antaa
kaiken vaikuttaa kaikkeen koska **Spelunky on roguelike**: jos ketjureaktio
tekee kentästä läpäisemättömän, se on tarina, ja seuraava ajo on uusi. Tämä
peli on kiinteiden kenttien tasohyppely, jossa **kentän on aina oltava
läpäistävissä** — se on kohta 5, se on `playable.mjs`, ja se on ainoa lupaus
jonka tämä projekti on antanut pelaajalle joka ei ole hyvä.

Emergenssi ja tuo lupaus ovat suoraan ristiriidassa, ja ristiriita on
täsmällinen: **kaikki nykyiset portit olettavat että kenttä on staattinen.**
`playable.mjs` ajaa botin läpi lähtötilan. `validateLevel` lukee ruudukkoa.
`difficulty.mjs` mittaa layoutin. Jos vihollinen voi rikkoa lohkon jota reitti
tarvitsee, jokainen näistä mittaa kenttää jota ei enää ole.

**4. Ehto jolla tämän voi ottaa.** Yksi sääntö, ja se on kirjoitettavissa
portiksi:

> **Emergenssi saa koskea vain sitä mikä ei ole reitti.**
> Vuorovaikutus joka voi poistaa maareitin osan on kielletty, ellei se ole
> palautuva (lohko kasvaa takaisin, olio syntyy uudelleen) tai ellei poistettu
> osa ole valinnainen.

Se on testattavissa samalla tavalla kuin kohta 5 nyt: aja kenttä, anna
emergenssin tapahtua, aja `playable.mjs` **lopputilalle** eikä lähtötilalle.
Sama korjaus jota synteesi E (hiekka tottelee painovoimaa) jo tarvitsee, mikä
tarkoittaa että molemmat kannattaa tehdä yhdessä.

**Suositus:** ottakaa suunta, älkää ottako lupausta. Konkreettisesti: laajenna
maasto→olio-lakeja laattatyyppi kerrallaan, jokainen omalla punaisellaan, ja
kirjoita yllä oleva ehto porttiin **ennen** ensimmäistä olio→maasto-lakia.
Järjestys on tässä koko riski: yksisuuntaiset lait ovat ilmaista hauskuutta,
ja kaksisuuntaiset ovat se kohta jossa peli voi rikkoutua tavalla jota mikään
nykyinen mittari ei näe.

---

## Kolme jotka pitää hylätä, ja miksi

Nämä ovat tässä siksi että perustelu on arvokkaampi kuin idea.

### ✘ Tartu ja heilahda (Bionic Commando, Umihara Kawase)
Koukku joka korvaa hypyn tai täydentää sitä. **Omistaja: "very cool, but maybe
not — kirjaa se harkituksi mutta ei otetuksi."** Merkintä on tässä siksi että
hylkäys ilman perustelua palaa takaisin kuuden kuukauden päästä samana
ideana.

Perustelu on sama kuin kohdalla 7, ja se on tämän pelin oma eikä yleinen:
**ilmassa oleva hetki on jo varattu.** Pierupomppu, kaasulehden liito ja
maahanisku ovat kaikki ilmaverbejä, ja maahanisku yksin maksaa 47 framea
ohjaamatonta aikaa. Neljäs ilmaverbi ei kilpailisi napista vaan siitä
sekunnista, ja se tekisi kolmesta olemassa olevasta epäselvempiä. Köysifysiikka
olisi lisäksi oma maailmansa moottorissa jossa ei ole rinteitäkään.

Jos tämä joskus otetaan, ehto on kirjattu tässä: **jonkin kolmesta on
lähdettävä.**

### ✘ Nouseva vesi bonushuoneessa
Klassikko: luolaan tulee vettä, eli älä jää. **Mutta luolakaista sanoo sen jo**
— Griegin raita kiihtyy (v26.08.09.32), ja se valittiin nimenomaan siksi.
Kaksi samaa asiaa sanovaa merkkiä opettaa lukemaan väärin ([DESIGN.md](DESIGN.md)
kohta 8). Vesi olisi toinen kello samassa huoneessa.

### ✘ Renkaat vahinkopuskurina (Sonic)
Osuma sinkoaa kolikot ympäriinsä ja ne voi kerätä takaisin. Houkuttelevaa,
mutta se **purkaisi viisi voimatasoa**: nyt osuma maksaa muodon ja kyvyn, ja
se on koko tehostusjärjestelmän jännite. Puskuri tekisi vahingosta
kirjanpitoa.

---

## Jos yksi pitäisi valita

**A (pieruhylly)** on halvin oikeasti uusi verbi: se rakentuu olemassa olevasta
pallosta ja olemassa olevasta puolikiinteästä ruudusta, se ei vaadi uutta
nappia, ja §5 hoituu ilman erillistä sääntöä.

**E (valuva hiekka)** on paras seuraava askel *moottorille*, koska se pakottaa
validoimaan lopputilan eikä lähtötilaa — ja se on juuri se este joka seisoo
areenaa muokkaavan pomon tiellä. Halpa harjoitus kalliista ongelmasta.

**C (ummetus on muoto)** on se joka tekee pelistä eniten itsensä näköisen.
