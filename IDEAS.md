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
| 1 | vauhti korkeudeksi | Sonic | **kyllä, vahvin** — tehty 17.8.2026 |
| 2 | ammus joka on lava | Rainbow Islands | ei |
| 3 | maailman vaihto lennossa | Giana Sisters | ei |
| 4 | litteä maailma käännetään | Super Paper Mario | **päätetty 10.8.** → ROADMAP |
| 5 | vahinko muuttaa muotoa | Wario Land | epävarma |
| 6 | syö vihollinen, saat kyvyn | Kirby | **kyllä** — tehty v26.08.18.8 |
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

**Tehty 17.8.2026, ja se maksoi sen minkä yllä lukee.** Rinteet ovat kaksi
uutta laattaa (`/` ja `\`), oma pystyratkaisunsa `physics.js`:ssä (rinne ei ole
kiinteä, vaan korkeuskäyrä jota kysytään kehon keskikohdasta), painovoiman
komponentti pintaa pitkin ja lähtö joka vaihtaa vauhdin korkeudeksi. Kaikki
neljä lukua ja niiden perustelut ovat [PHYSICS.md](PHYSICS.md):n omassa
kohdassaan. Erottelu jonka omistaja teki — muunnin eikä luiskahdus — säilyi
sellaisenaan: rinteessä ei liu'uta eikä siinä tapeta, siitä lähdetään.

Ja se yksi asia joka piti mitata ennen kuin luku oli oikea: **ylämäen veto on
oltava pienempi kuin kiihtyvyys.** 0.06 pysäytti kävelijän rinteeseen, 0.045 ei.
Portti löysi sen ennen kuin kukaan ehti pelata.

---

## Omistajan tuomiot 16.8.2026

Toinen läpikäynti, kohta kerrallaan. Ensimmäinen (10.8.) koski kahtatoista
lainattavaa verbiä; tämä koskee **synteesejä A–I**, niitä kolmea verbiä joille
jäi epäselvä tuomio, ja sitä yhtä verbiä joka oli hyväksytty ilman kotia.

| kohta | mitä se on | tuomio |
| --- | --- | --- |
| A | pieruhylly: ammuksesta tulee lava | ✔ tehty v26.08.16.91 |
| B | kaasukupla joka kantaa: kuplan päälle voi astua | ✔ tehty v26.08.16.86 |
| C | ummetus muodoksi: tukossa oleva on raskas | ei |
| D | kaistan vilkaisu | **tee rajattuna** — tehty v26.08.18.9 |
| E | hiekka tottelee painovoimaa | ✔ tehty v26.08.16.92 |
| F | kurnuttajan kyyti | ei |
| G | loppukentän voi syödä (maailma 8) | ei näin |
| H | vauhti on valuutta: ponnahduslauta lukee mittaria | ✔ tehty v26.08.16.87 |
| I | kaivautuminen | ✔ jo tehty (6-K) |
| verbi 5 | vahinko muuttaa muotoa (Wario Land) | ei |
| verbi 6 | syö vihollinen, saat kyvyn (Kirby) | **kyllä: väliaikainen kyky** |
| verbi 7 | syöksy jolla on lataus (Celeste) | ei |
| verbi 11 | ammuksen voi ratsastaa (Mr. Gimmick) | ei |
| — | ilmahyppyjen talous | **kuluva panos** |
| — | mukautuva maailma | ⏸ parkissa |

### Mitä hylkäyksissä on yhteistä, ja miksi se kannattaa lukea

Neljä ei:tä (C, F, verbi 5, verbi 11) eivät ole neljä erillistä makuarviota.
Niissä on kaksi linjaa, ja molemmat ovat sellaisia joita kannattaa soveltaa
seuraavaan ideaan ennen kuin se kirjoitetaan auki:

**Rangaistus jota joskus haluaa lakkaa olemasta rangaistus.** Se on C:n
peruste ja sama peruste kaatoi verbin 5. Ummetus ja osuma ovat molemmat
tappioita, ja tappio joka avaa reitin ei ole enää tappio vaan valinta —
jolloin peli menettää sen yhden asian jonka se sanoo osumalla.

**Ammuksesta tulee porras, ei kyyti.** A hyväksyttiin ja F ja verbi 11
hylättiin, ja ne kolme ovat sama kysymys kolmesti: saako pelaaja tehdä
liikkuvasta asiasta kulkuneuvon. Vastaus on ei — mutta *paikallaan pysyvästä*
asiasta saa tehdä askelman. Se on kapea raja ja se on nyt vedetty.

### Kolme kohtaa joilla on ehto mukanaan

**D tehdään rajattuna**, eli sellaisena kuin ROADMAP sen jo päätti: vain
näkeminen, hinta täysi vauhtimittari, aina luolakaista alaspäin. Rohkeampi
versio (läpi astuminen siellä missä molemmissa kaistoissa on lattia) jää
tekemättä, koska se tekisi piilokaistoista reitin eikä vihjeen.

**E tehdään**, ja se kirjattiin ensin tehtäväksi *ennen* areenapomoa halpana
harjoituksena muuttuvan ruudukon validoinnista. Areenapomo päätettiin samassa
läpikäynnissä tehtäväksi heti odottamatta sitä, joten järjestys jäi toiveeksi:
**kumpi tahansa niistä ensin ratkaisee sen saman validointiongelman**, ja
jälkimmäinen saa sen ilmaiseksi.

**Verbi 6 sai kodin muttei muotoa.** Nielaistu vihollinen antaa oman lajinsa
kyvyn hetkeksi — piikkiukko tekee piikikkääksi, lentäjä antaa hypyn — eli
jokaisesta lajista tulee työkalu. G hylättiin siksi että se olisi pannut verbin
maailmaan 8 kertakäyttöisenä pomopalkintona, mikä on sama verbi ilman sitä
osaa joka tekee siitä hauskan: valinnan siitä *mikä* syödään.

### Ilmahyppyjen talous: kuluva panos

Tämä ei ole synteesilistalta vaan mitattu vika. `airJumpsMax` on pierusienellä
sama kuin voimataso, eli tasolla 5 ilmassa on viisi ponnistusta — ja
kenttägeometria on hinnoiteltu **yhtä** hyppyä vasten (kuilubudjetti 6 ruutua
= 96 px, mitattu juoksuhypyn kantama 155 px). Viidellä hypyllä pelin levein
kuilu on lyhyempi kuin yksi ponnistus.

Päätös: **panokset kuluvat eikä niitä saa peräkkäin.** Määrä jää voimatasoon
kiinni, eli taso 5 on yhä enemmän kuin taso 1, mutta niitä ei voi ladata
yhdeksi kaareksi. Konkreettinen muoto — jäähdytys ponnistusten välissä vai
lataus vain maakosketuksesta — on auki, ja se on **mitattava eikä valittava**:
`tools/jump-solver.js` osaa jo mitata mitä ikkunalle tapahtuu, ja sama koe
kertoo kumpi muoto säilyttää hypyn kysymyksenä.

## Synteesit: yhdeksän jotka olisivat meidän

Lainattu verbi + tämän pelin sanasto. Nämä ovat se osa jota ei voi googlata.
**Tuomiot ovat yllä** (16.8.2026); alla on se mitä kukin on.

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

### I. ✔ TEHTY: KAIVAUTUMINEN — pystykenttä joka menee alas
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

**Tehty**, ja ennuste piti: `6-K KAIVAUTUMINEN` on tuotannossa (vaikeus 245,9)
ja se käyttää samaa kamera- ja validointitukea kuin pilvimaailman nousu, eli
suuntaneutraalius maksoi itsensä takaisin täsmälleen niin kuin tässä
arvattiin. Tämä merkintä luki *"odottaa pystytukea"* 16.8.2026 asti, mikä on
oma opetuksensa: **synteesilistan kohta ei poistu itsestään kun se tehdään.**

---

## ⏸ Parkissa 16.8.2026: mukautuva maailma — suunnitelma, ei päätös

**Omistajan tuomio 16.8.2026: *"kiinnostava, mutta liikaa juuri nyt."*** Koko
suunnitelma jää alle sellaisenaan — se ei ole hylätty vaan siirretty, ja siirto
on kirjattu tähän eikä poistettu, koska seuraava kerta kun joku kysyy
"pitäisikö kentän mukautua pelaajaan" ansaitsee tämän vastauksen valmiina.

Yksi asia siitä eteni silti erikseen: **ilmahyppyjen talous**, ks. tuomiot
alempana. Se oli suunnitelman kohta 6 eli sen edellytys, ja se on hyödyllinen
myös ilman muuta suunnitelmaa.

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
taivas, reitti, luola — jotka ovat 16 riviä kukin (15 riviä kenttädataa ja
yksi kokoajan lisäämä taivasrivi, ks. `data/chunks.js`), päällekkäin, ja `bandAt`
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

## ✔ Built 18.8.2026: fill the P-meter by rhythm, not by holding

*(Built the same day it was proposed — v26.08.18.33. The proposal below stands
as written; three things came out differently once measured, and they are
marked inline. The build's own reasoning lives next to `PUMP_PERIOD` in
`entities/player.js`.)*

**What changed against the proposal:**

- **The window is not the plume.** Riding the existing plume would have needed
  no new drawing, but the plume's rhythm accelerates as the gauge fills, so a
  fixed beat drifted against it. The metronome is its own puff.
- **Pumping is not gated on the plume either.** Gated at `PLUME_START` the
  technique got two beats and saved ten frames, because the gauge fills in
  about a hundred frames and the plume starts two thirds of the way up. It is
  gated on running instead.
- **Mashing punishes itself, and not by venting.** The proposal expected
  mashing to land a third of its presses and run at a loss. What happens is
  simpler: with the button up half the time the body never reaches running
  speed, so there is nothing to pump and the gauge drains. The vent punishes a
  *wrong rhythm*, which is the interesting case.

Measured: 100 frames holding, 78 on the beat, 491 off it.

---

## The proposal as written

*(Owner: "could a mechanic work where tapping run repeatedly gives you more
speed? Not continuous mashing — a meter where hitting the right moment in the
cooldown gives a boost, like the active reload in Gears of War." Written down
as a proposal; the numbers below are the ones that have to be measured before
any of it is built.)*

**Short answer: yes, and it fits this character better than it fits the game it
came from — but only as a new way to fill the meter that already exists.**

### The one thing that would sink it

A second meter. `DESIGN.md` §8 forbids two ways of saying the same thing, and
the P-meter already means exactly *"you have been running long enough to go
faster"*. A rhythm gauge next to it would be a second speed-earning system with
its own bar, its own sound and its own rules, and the player would have to read
both to answer one question.

So the shape is not "a new meter". It is: **the P-meter keeps its meaning and
gains a second way to fill.** Holding run fills it at `P_FILL` as it does now
and nothing that exists changes; releasing and re-pressing inside a window
fills it faster. One meter, one meaning, two techniques — the same relationship
the slope already has with speed.

### Why it suits this character

The active reload works in Gears because a rifle *has* a reload — the fiction
supplies the cooldown. Here the fiction supplies something better: the
character runs on gas. Pumping pressure rhythmically is what you would
literally do to a bellows, and the game already draws the pressure as a plume
(`PLUME_START`) rather than as a number. The mechanic would be reading the
thing the game already draws.

### Three design rules it would have to obey

1. **A miss has to cost something.** Gears jams the rifle; that punishment is
   the entire reason the choice is interesting. Without a cost, pressing early
   is free and the mechanic degenerates into mashing, which the owner already
   ruled out. The thematic cost here is exact: a mistimed pump **vents**, and
   the meter drops. Note the existing asymmetry to build on — `P_DRAIN` is a
   third of `P_FILL`, so the meter is already forgiving, and a vent would be
   the one thing that is not.
2. **The window is shown on the body, not in a bar.** The HUD strip was taken
   apart on purpose (17.8.2026) and every reading now lives in the world: coins
   in the tube, time in the sun, pressure in the plume. The window belongs in
   the plume — a flash on the beat — and nowhere else.
3. **It must degrade to holding.** Touch controls exist (`core/touch.js`), and
   rhythmic timing on glass is far harder than on a keyboard. Holding run must
   remain a complete way to play, not a worse one.

### The constraint that matters, and the good news about it

`DESIGN.md` §5: the ground route must be clearable at the smallest size with no
power-up. If speed becomes skill-gated, the temptation is to design levels
around the higher speed — and that would quietly break the promise for everyone
who does not have the rhythm.

**The existing gate already prevents this for free.** `tools/playable.mjs` and
the `verify.mjs` power-0 gate both drive a bot that only runs right and jumps —
it holds the button. So any level that came to *require* rhythm would fail the
gate the day it was written. Nothing new has to be built to protect the
promise; it is already protected by a bot that cannot play the mechanic.

### What to measure before building it

- **The ceiling.** `MAX_WALK` 1.5, `MAX_RUN` 2.5, `MAX_P` 3.5. Does perfect
  rhythm reach `MAX_P` faster, or go past it? Past it is a different game:
  `tools/measure-jump.mjs` would have to be re-run, because `gapTiles` 6 and
  `wallTiles` 4 are measured at P-speed and every level is validated against
  them. Reaching it *faster* changes nothing measured and is the safer
  proposal.
- **The window.** How wide, in frames, before it stops being a skill and starts
  being a coin flip — and how that reads at 60 Hz on a phone.
- **Whether the plume can carry it.** If the flash is not legible while
  running, the mechanic has no feedback and the rest does not matter.

My recommendation if it is built: **faster to `MAX_P`, not past it.** It gives
the technique a real payoff, keeps every measured number in the game valid, and
leaves the ground route exactly where it is.

## Pieru lähtee takaa — omistajan idea 20.8.2026, ei vielä päätetty

Omistaja: *"is this a dumb idea: the 'fireballs' are actually ejected from the
rear of the character… cos they're farts? Which means you can't just run and
gun, you need to turn around to hit enemies with projectiles."*

Ei tyhmä. Se **korjaa** jotain joka on jo koodissa väärin: ammusluokan nimi on
`FartBall` ja se lähtee edestä. Idea ei siis lisää rajoitusta vaan poistaa
epäjohdonmukaisuuden.

**Yksi oikea vastaväite.** Peli vierii oikealle, eli uhat tulevat oikealta. Ase
joka ampuu vain vasemmalle ei ole vaikeampi vaan hyödytön, ja pelaaja lakkaisi
poimimasta kukkaa — viisiportainen tehostustikas menisi hukkaan.

**Korjaus on Newton.** Kaasu taakse työntää pelaajan eteenpäin:

1. **Kasvot menosuuntaan, laukaus** → ammus suojaa selustan ja saat **työnnön**.
   Väärä suunta on se palkitseva.
2. **Kasvot taaksepäin, laukaus maassa** → ammus lähtee kohti sitä mikä on
   edessä, ja rekyyli työntää sinua siitä poispäin. Perääntyvä taistelu joka
   maksaa maata.

Jokainen laukaus on siis vaihtokauppa: **maata turvasta tai turvaa vauhdista**.
Se on parempi verbi kuin "juokse ja ammu", ja se on sama temppu jonka
ketjuhyppy jo tekee.

**Poikkeus on jo olemassa.** `sylky` on *lainattu* ammus, ja lainattu ammus
lähtee **suusta** eli eteenpäin. Sääntö kuuluu siis: *oma kaasu taakse, nielty
eteen.* Se kumoaa "en voi koskaan ampua oikealle" -ongelman fiktion sisällä
eikä poikkeuksena, ja antaa nielemismekaniikalle tehtävän jota sillä ei nyt ole.

**Ja kolmas porras, omistajan lisäys:** *"let's say this is where the PERFECT
TIMING comes in — if you execute this in the correct rhythm, there's no
velocity cost? Like you can jump, turn around, fart, turn back, and keep your
velocity."*

Tämä tekee vaikeasta liikkeestä nopean, ja se on juuri se muoto jota peli jo
puhuu: `CHAIN_WINDOW` ja `landingDrain` palauttavat laskeutumisen vuodon jos
lähdet ajoissa uudestaan. Sama kielioppi, sama vakioperhe:

| Porras | Teko | Osuu | Hinta |
| --- | --- | --- | --- |
| 1 | laukaus menosuuntaan | selustaan | ei mitään, saat työnnön |
| 2 | käänny maassa ja ammu | eteen | menetät maata |
| 3 | **hyppy, käännös, laukaus, käännös takaisin ikkunan sisällä** | eteen | **ei mitään** — rekyyli palautetaan |

Maassa kääntyminen maksaa vauhtia kuten nytkin. Ilmassa kääntyminen on ilmaista,
mutta laukauksella on rekyyli — **paitsi** jos koko sarja mahtuu yhteen
ilmalennon ikkunaan, jolloin rekyyli palautetaan täsmälleen niin kuin
ketjuhypyssä.

**Mitä pitää mitata ennen kuin tätä rakennetaan**, ja nämä ovat mittauksia
eivätkä makuasioita:

- **Hyppybudjetti** (`gapTiles` 6, `wallTiles` 4) on mitattu `MAX_P`-vauhdilla
  3,5. Jos laukaus lisää vauhtia, osa kuiluista muuttuu ilmaisiksi ja kukasta
  tulee liikkumishuijaus. Todennäköinen ratkaisu: työntö ei saa viedä yli
  `MAX_P`:n, se vain auttaa *saavuttamaan* sen — täsmälleen kuten hyppyketju.
- **64 kentän vaikeus** on pisteytetty eteenpäin ampuvalla aseella
  (`tools/difficulty.mjs`). Eteen sijoitetut viholliset muuttuvat
  ampumakelvottomiksi. Käyrän siirtymä on mitattavissa ennen kuin kenttädataan
  koskee.
- **Kääntyminen täydessä vauhdissa** joko tappaa vauhdin tai vaatii
  takaperinkävelyn. Animaatio on pieni kysymys; se että porras 3 tekee siitä
  taidon eikä veron on koko idean ydin.

Rakennusjärjestys jos tämä päätetään: rekyyli ja takaa lähtevä ammus ensin,
`sylky` eteenpäin, sitten porras 3 — ja hyppybudjetti mitataan **ennen** kuin
yhteenkään kenttään kosketaan.

