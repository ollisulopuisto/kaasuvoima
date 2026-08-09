# Muutosloki

Versiointi on CalVer: `vVV.KK.PP.build`. Jokaisesta merkittävästä muutoksesta
kirjataan **mitä** tehtiin ja **miksi** — perustelu on tässä yhtä tärkeä kuin
muutos itse, koska se on myös se todiste siitä mistä mikäkin on peräisin.
Alkuperää ja tekijänoikeuksia koskevat periaatteet ovat [DESIGN.md](DESIGN.md):ssä.

---

## v26.08.09.8 — mekaniikat kaikkiin maailmoihin, jakoruutu, mobiiliohjaus ja yksi fysiikkabugi

Iso erä, ja pääosin rinnakkaisten alaagenttien tekemä: kuusi työtä omissa
työkopioissaan, yhdistettynä ja portti ajettuna kerran kaikelle yhdessä.

### Mekaniikat maailmoihin 2, 3 ja 4

Uudet ominaisuudet olivat yhdessä kentässä kutakin. Se on oikein valmiissa
pelissä ja väärin nyt, koska niitä ei pääse näkemään — ja se esti pelitestauksen.

- **Maailma 2**: tähti 2-1:een (aavikko omistaa sen vihollisen jota tallaus ei
  kaada — aurinko herää ja seuraa, ja tähti sammuttaa sen), salainen alue
  2-2:een, mureneva lava 2-N:ään, kytkin 2-3:een. 2-N sai murenevan lavan
  siksi että **yön paletissa tiili ja maa ovat lähes sama ruskea**, joten
  sinne kuuluu se mekaniikka joka luetaan liikkeestä eikä väristä: tärinä,
  halkeama, pudotus. Hiekkaa jokaisen lankun alla — lampun valossa ei näe
  kuinka pitkä pudotus on, joten pudotus ei saa olla rangaistus.
- **Maailma 3**: tähti 3-1:een, salaisuus 3-2:een, mureneva lattia 3-3:een.
  **Oletus että jää tekee murenevasta lattiasta julmemman osoittautui
  vääräksi**: mureneva lattia tappaa vain sen joka jää seisomaan, ja seisominen
  on juuri se mitä tämä maailma ei salli. Vaara on kokonaan toisessa päässä,
  josta lähdetään vauhdilla jota ei saa pysäytettyä. Sitova tapaus on **pienin**
  pelaaja, koska pienellä on *vähemmän* kitkaa (0,0391 vs 0,0547) — ensimmäinen
  versio mitoitti loppusuoran isolla vakiolla ja olisi jäänyt kaksi kolmasosaa
  ruudusta lyhyeksi. Mitattuna moottorista: 154,9 px liukua, loppusuora 12 ruutua.
- **Maailma 4**: tähti 4-1:een, salaisuus 4-2:een, kytkin 4-3:een.
  **Tehtaan salaisuus ei voinut olla pavunvarsi**: `world4.js` sanoo että tehdas
  on sisätila ensimmäisestä ruudusta viimeiseen, ja `drawVine` maalaa lehdet
  kovakoodatun ruohonvihreinä ilman teemaparametria — se olisi reikä katossa,
  ja lehtiä reiässä. Ratkaisu on **putki ylöspäin** tehtaan omalle katolle
  suljettuun konehuoneeseen: `tryWarp` osaa jo `dir = -1`, huoneen lattia *on*
  tehtaan katto, ja tehtaan taustakuva palaa ennen kaistasiirtymää, joten
  näkymä ylhäältä on oikea ilmaiseksi. Suljettu huone eikä avoin kattotaso,
  koska kattotasoa pitkin juokseminen olisi oikotie kentän ohi.

Vaikeuskäyrä nousee yhä joka maailmassa (103,7 → 123,5 → 151,9 → 174,7 → 193,8)
ja jokaisessa on tasan yksi notko. Keskiarvot laskivat 4–5 pistettä, ja se on
laimennusta eikä helpotusta: mittari on saraketta kohti, ja palkintohuone on
määritelmällisesti se osa kenttää joka ei ole haaste. **Yksikään agentti ei
kuroa lukua takaisin lisäämällä vihollisia palkintohuoneisiin** — se olisi
mittarin virittämistä väärästä päästä.

### Liu'un jarrutus ei ole maan sääntö

Omistajan raportti: "laskeutuessa liikkuu vielä sivuttain, eikä ehdi väistää
vihollista jota kohti on menossa". Mitattuna oire osoitti väärään paikkaan:
**maassa jarruttaminen maksaa 24 px 179 pikselin reaktiomatkasta — 87 %
tapahtuu ilmassa.** Osumalaatikko on kapeampi kuin piirros joka voimatasolla,
ja tallausikkuna on 40 px eli 16 framea.

Syy oli `player.js`:n ehto `const skidding = this.onGround && …`. Lähteen
(`PRG008_ABB8`) haara joka valitsee jarrutusnopeuden **ei lue `Player_InAir`ia
lainkaan**; ilmassa oleva suunnanvaihto jarrutti siis 0,0547:llä kun sen pitää
olla 0,125 — alle puolet siitä auktoriteetista joka samalla pelaajalla on
maassa, juuri siinä vaiheessa jossa koko reaktio tapahtuu. Vakiot olivat siis
uskollisia, yksi ehto ei ollut.

Vaikutus: P-vauhdissa ilmassa tehty käännös vaatii 183 px sijaan 154 px, eli
102 %:sta näkyvästä 86 %:iin — mahdottomasta mahdolliseksi. Hyppybudjettiin ja
vaikeuskäyrään ei vaikutusta, koska hyppy pitää suuntaa eikä liu'un nopeus
kytkeydy.

### Jakoruutu

Peliä ollaan antamassa kavereille, joten linkki pitää saada eteenpäin
puhelimesta. `navigator.share` → leikepöytä → osoite ruudulla, **eikä mitään
muuta**: uudessa tiedostossa ei ole yhtään verkkokutsua, ja testi väittää sen
lukemalla tiedoston lähdekoodin. Sama peruste kuin telemetrian palvelinkohdassa,
ja täällä painavampi, koska pelaajat ovat lapsia.

Jaettava osoite luetaan `og:url`-tagista eikä `location.href`istä: sivun oma
osoite voi olla localhost tai esikatselu, ja vain `og:url` avautuu
esikatselukortin kanssa.

Yksi epäilyttävän näköinen ratkaisu, joka on oikea: **jako laukeaa napin
noustessa eikä painuessa** — ainoana asiana pelissä. `navigator.share` vaatii
tuoreen käyttäjäeleen, ja kosketuksella se kirjataan `pointerup`issa; peli
lukee syötteen omassa 60 Hz askeleessaan, joten ainoa frame joka on varmasti
eleen sisällä on se joka seuraa sormen nostoa. Painalluksesta laukaistuna jako
hylättäisiin juuri puhelimessa, eli siinä laitteessa jota varten ruutu on.

Peruutettu jako ei ole virhe eikä valu leikepöydälle. Jos kumpaakaan rajapintaa
ei ole, ruutu aukeaa valmiiksi osoite näkyvissä eikä tarjoa nappia — nappi joka
lupaa jotain mitä se ei voi tehdä on huonompi kuin ei nappia.

### Kosketusohjaus: kolmas malli, ja zoomiloukku

**Zoomiloukun pahempi puoli oli meidän eikä Safarin.** Sisään pääsi koska
`user-scalable=no` ei ole tehonnut iOS 10:n jälkeen. Ulos ei päässyt koska
`#touch.on` on `position: fixed; inset: 0; touch-action: none` — ensimmäisen
kosketuksen jälkeen ohjainpeite kattaa koko näkymän ja kieltää kaikki eleet,
myös sen nipistyksen jolla olisi päässyt takaisin. **Ohjaimet olivat lukko.**

Korjaus on ehdollinen eikä yleinen: `touch-action: manipulation` juuressa
tappaa kaksoisnapautuksen mutta jättää nipistyksen, ja `visualViewport.scale`in
ohjaama `.zoomed` antaa zoomatussa tilassa kaikki eleet takaisin myös peitteen
yli. `maximum-scale`ia ei lisätty: selaimissa jotka sitä tottelevat se veisi
nipistyksen, eli tekisi loukusta pahemman kuin bugi.

Ohjainten asettelusta: **kumpikaan ehdotetuista ratkaisuista ei toimi.**
Peukalon rullaaminen napilta toiselle vapauttaa juoksun, koska näyttö raportoi
sormen yhtenä pisteenä — sama koodipolku joka tekee ristiohjaimesta
ristiohjaimen. Yhdistelmänappi taas antaisi paikaltaan hypyn, koska juoksu
nostaa nopeuskattoa ja vauhti kertyy juostessa, eli juoksua pitää pitää pohjassa
*ennen* hyppyä. Uusi `rulla`-malli ottaa idean ja jättää mekanismin: oikealla on
**yksi kenttä kahden napin sijaan**, ja hyppyympyrä on kokonaan pierukentän
sisällä. Piste osuu molempiin suorakulmioihin yhtä aikaa, eikä moottoriin
tarvittu riviäkään. Hinta sanottuna ääneen: tässä mallissa ei voi hypätä ilman
juoksua. Vanhat mallit ovat koskematta, eikä kenenkään tallennettua valintaa
hylätty — vain oletus vaihtui.

Automaattinen juoksu hylättiin vaikka se olisi halvin: kuilut on mitoitettu
mitattuun hyppybudjettiin, joten aina päällä oleva juoksu on kenttäsuunnittelua
ohjausvalikon kautta.

### Piikkiukko maksaa vihdoin jotain

`ENEMY_CHARS`issa on `x` (piikkiukko) mutta `difficulty.mjs`:n `ENEMY_COST`issa
ei ollut, joten **jokainen piikkiukko koko pelissä oli painanut nollan**. Siksi
3-1 saattoi saada tallaamattoman vihollisen ja piikkipedin ja mittari kirjasi
laskun. Hinta 1,4: kävelee kuten yksikkö, mutta oletusvastaus ei toimi — ja
toisin kuin putkikasvi (1,1), joka on toinen tallaamaton, se ei pysy paikallaan.

## v26.08.09.7 — uusi kuvakieli vuorovaikutteisille ruuduille, ja valojärjestelmä

Kaksi muutosta jotka koskevat sitä miltä peli näyttää, eivät sitä miten se
toimii. Kumpikin oli tehty koodiin ennen kuin ne olivat tässä; tämä merkintä
on jälkikäteen kirjoitettu, ja se on juuri se laji velkaa jota tämä tiedosto
on olemassa estämään.

### Tiili, `?`-lohko ja putki omalla kuvakielellään

Ne olivat viimeiset kohdat joissa peli lainasi muotokieltä eikä pelkkää
lajityyppiä.

**Tiilestä naulattu laudoitus:** pystysuorat laudat, poikkirima ja
naulankannat. Pystysyy on luettavuuden kannalta se ratkaiseva valinta — pelin
jokainen muu kiinteä pinta kulkee vaakasuunnassa, joten pelkkä syyn suunta
erottaa rikottavan kiinteästä täydessä vauhdissa. Maa ja kova maa saumautuvat
toisiinsa, tiili on kehystetty: kehystetty laatikko lukee esineenä seinällä
eikä lisää seinää.

**`?`-lohkosta paineastia mittarilla.** Kysymysmerkki on poissa kokonaan, ja se
on tarkoituksellista: symboli on aina jonkun toisen symboli, kun taas näkyvästi
paineen alla oleva säiliö sanoo "tässä on jotain" ilman symbolia. Vilkkuva
mittari on se "lyö minua" — mikään muu pelissä ei vilku. Käytetty lohko on sama
astia sisäänpäin painettuna: kupera-kirkas-vilkkuva vastaan
kovera-tumma-kuollut.

**Putkesta peltinen hormi:** taitetut tasopinnat, niitattu sauma, laippa joka
istuu tasan eikä ulkone. Kaksi versiota heitettiin pois matkalla; hieno
poimutus mittasi hyvin mutta luki ikkunaluukkuna, eikä luukkuun mennä sisään.

**Rikkoutuminen:** neljä identtistä neliötä korvattu kahdellatoista vaihtelevalla
sirpaleella, omat painovoimat ja pyörimisnopeudet. Ensimmäinen versio oli kaunis
ja putosi 144 pikselistä 53:een framea kohti — juuri se virhe jota vastaan
varoitettiin. Nyt 145, mutta kahtenatoista muotona neljän sijaan.

Mitattuna: tiilen ero maahan parani kaikissa kuudessa teemassa. Heikoin pari on
yhä yö (27,8 / 34 %) ja **se on paletti eikä muoto** — `night.brick` ja
`night.ground` ovat lähes sama ruskea. Se jää auki tähän kirjattuna.

### Valojärjestelmä: maailma kantaa omia valojaan

Valokeila oli yksi lamppu pelaajassa kiinni. Nyt valoja on kahdeksan, joista
yksi on pelaajan lamppu ja seitsemän maailman omia. Pierupallo valaisee maata
jota pitkin se pomppii, joten pimeään voi ampua ja seurata omaa kaasuaan
nähdäkseen mitä siellä on.

Valonlähdevihollinen on närästys, ja valinta on se kiinnostava laji: **se mikä
näyttää lattian on se mikä tappaa sen päällä seistessä.** Liekin valo seuraa
täsmälleen sen omia vaiheita, joten se ei ole toinen opeteltava signaali liekin
päälle. 2-N sai yhden liekin toisen dyynipalikan tilalle — sama leveys ja sama
maasto, joten `playable` on tavulleen ennallaan.

Pelaajan lamppu **ei** ole yksi niistä seitsemästä: seitsemän palloa ilmassa ei
saa voida äänestää ulos sitä valoa jonka varassa kävellään.

Valot yhdistyvät kertomalla sen minkä kukin jättää pimeäksi, ei maksimilla. Niin
valo käyttäytyy, ja se on ainoa yhdistely jonka Canvas 2D toistaa tarkalleen —
pelkkä lamppu tuottaa pikselilleen saman kuvan kuin ennen.

Mitattuna: vaaran luettavuus keilojen ulkopuolella 35,5 luminanssia, sama kuin
ennen muutosta, ja sama myös kun kaikki seitsemän paikkaa on käytetty muualla.
Rakenteellisesti se ei voi taantua, koska valot vain kertovat kohti ykköstä.
Framebudjetti 1,33 ms kahdeksalla valolla, katto 2,5.

---

## v26.08.09.6 — kuplaloukku, esittelytila, kaksoisovi ja jäätikkö

Iso erä. Kaksi näistä teki alaagentti.

### Kuplaloukku (Bubble Bobble -tyyliin)
Pierupallo ei enää tapa vihollista vaan **sulkee sen kuplaan**. Kuplassa oleva
vihollinen leijuu, on vaaraton, ja **kuplan puhkaiseminen on se mikä tappaa** —
ja maksaa kaksinkertaiset pisteet, jottei muutos tunnu heikennykseltä. Neljän
sekunnin jälkeen kupla puhkeaa itsestään ja vihollinen **vapautuu vihaisena:
1,6-kertainen vauhti ja välkkyvä väritys.**

Ratkaiseva rakennepäätös: kupla on **tila vihollisessa**, ei erillinen olio joka
pitää vankia sisällään. Vanki-olio olisi vetänyt mukaansa takaisinviittauksen
kohtaukseen ja tehnyt tilatallennuksesta syklisen, ja sen kiertäminen olisi
vaatinut moduulisyklin `savestate.js`:n kanssa. Tilana koko `REGISTRY` ei
tarvinnut mitään, vanhat tallennukset lukevat puuttuvan kentän "ei kuplassa"
-tilaksi, ja jokainen olemassa oleva tappotapa — kuori, häntä, alta puhkaistu
lohko — puhkaisee kuplan ilmaiseksi.

Kuplaan menevät vain vaeltavat viholliset. Putkikasvi ei: se on pultattu
putkeensa, ja leijumaan lähtenyt kasvi jättäisi putken vaarattomaksi lopuksi
kenttää. Aurinko, pomo ja iskuaalto hoitavat osumansa itse.

### Esittelytila
Alkuruudun oltua rauhassa 20 sekuntia peli alkaa pelata itseään kentässä 1-1,
kuten kolikkopelit. **Mikä tahansa näppäin lopettaa sen yhdessä framessa** —
pelaaja ei saa koskaan joutua tappelemaan botin kanssa ohjauksesta.

Demo ei voi koskea tallennukseen, pistetauluun eikä telemetriaan, eikä siksi
että olisimme varovaisia vaan **rakenteen takia**: kenttä saa sijaispelioliona
`Object.create(game)`:n omalla tilallaan, joten jokainen kirjoitus osuu
kertakäyttöiseen olioon. `finishLevel` on ainoa ovi tallennukseen ja
pistetauluun, ja sijaisen versio vain asettaa lipun. Koko localStorage on
tavulleen sama demon jälkeen.

### Kaksoisovi
Ovi oli yksi 16 pikselin ruutu; isoin hahmo on 43 pikseliä korkea, eli hän ei
kävellyt siitä läpi vaan astui sen yli. Ovi on nyt 2×3 ruutua ja jokainen ruutu
piirtää oman viipaleensa naapuritiedon perusteella.

### Jäätikkö laavan tilalle
Jäämaailmassa ei ole enää laavaa. Sama ruutu, sama kuolema, eri kuva:
sulavesi sinivalkoisen jään alla ja rikkonainen hyllynreuna. Sulanut kivi
jäätikössä oli vitsi jota kenttä ei tarkoittanut.

### Piikeille ennakkovaroitus
Piikkipedin viereiseen maaruutuun piirtyy **vaararaidoitus** sille reunalle
jonka yli ollaan menossa. Piikit ovat lattian tasossa ja samanväriset kuin puolet
ruutusarjoista, joten juoksuvauhdissa ensimmäinen merkki niistä oli voimatason
menettäminen. Vaara jonka voi oppia vain kuolemalla on juuri se laji jota tässä
pelissä ei pitäisi olla.

### Kartan polut ja pistetaulun päiväys
Ks. edelliset commitit: polkupisteillä on oma tumma reuna (jäämaailmassa polun
ja maaston luminanssiero oli **kaksi yksikköä 255:stä**), ja pistetaulu näyttää
päivän muodossa 2026-08-09.

---

## v26.08.09.5 — supertähti, nyrkkeilijäpomo, salaiset tiilet ja jalat takaisin

Neljä pääsuunnittelijan toivetta ja yksi bugiraportti.

### Supertähti
Kerättävä tähti (`*`-lohko kentässä 1-3) tekee **kuolemattomaksi vihollisille
noin 12 sekunniksi**, ja hahmo vaihtaa väriä neljän sävyn kierrossa hehkun
kanssa, jotta yhdellä silmäyksellä näkee että se on päällä.

**Putoaminen tappaa yhä.** Niin tappaa laava, piikit, närästys ja ajan
loppuminen. Tämä oli toiveen toinen puoli eikä yksityiskohta, joten ohitus ei
ole `hurt()`:ssa eikä `die()`:ssä — ne ovat koskemattomat — vaan yhdessä
haarassa `collisions()`:ssa. Testi kysyy jokaista kuolintietä erikseen, koska
jokainen niistä on eri koodia.

### Nyrkkeilijäpomo
Maailman 1 linnakkeen pomo on nyt nyrkkeilijä: isot punaiset hanskat, joista
toinen suojaa leukaa ja toinen on koukussa lyötäväksi, mestaruusvyö, suojakumi ja
teipatut ranteet. Ei kruunua — tämä tappelee siitä. Hanskat ovat hahmon koko
idea, joten ne piirretään suurimpina ja kirkkaimpina; kaikki muu on siellä jotta
hanskat lukisivat hanskoina eikä punaisina möykkyinä.

### Salaisuuksia tavallisissa tiilissä
Osa tavallisista tiilistä kätkee kolikon tai tehostuksen. **Mikä tiili, lasketaan
ruudun sijainnista** — se on siis sama tiili joka kerta kaikille, salaisuus jonka
voi opetella ja näyttää kaverille eikä arpajaiset. Ei vaadi kenttädataa eikä
tallennuskenttää, ja toimii kaikissa maailmoissa kerralla, myös generoiduissa.

Taajuus on tahallaan nuuka (noin 1/40 kolikko, 1/300 tehostus): jokaisen tiilen
hakkaaminen on silti ajanhukkaa, mikä on juuri se mikä pitää nämä yllätyksinä
eikä rutiinina. Salainen tiili ei myöskään hajoa isolla koolla, joten palkintoa
ei voi menettää olemalla liian vahva.

### Bugi: pienen hahmon jalat katosivat paikallaan
Raportti oli tarkka ja oikea. Syy ei ollut animaatio vaan se että **seisonta
piirtyi eri koodilla kuin kävely**: kävelyssä jalat ovat viisi pikseliä korkeat
ja päättyvät tummaan pohjaan, seisonnassa ne olivat kaksi 2×2 housunväristä
tönköä ilman pohjaa. Pienimmässä koossa kaksi pikseliä on koko jalka, joten ne
katosivat sillä hetkellä kun pysähtyi. Seisonta käyttää nyt kävelysyklin
suljettua ruutua.

### Suorituskyky
Debug-ruutu laski telemetrian yhteenvedon **joka framessa**, eli skannasi koko
lokin 60 kertaa sekunnissa. Nyt se on välimuistissa. Debug-ruutu on viimeinen
asia joka saa olla syy hitaaseen frameen.

---

## v26.08.09.4 — maailma 5 uusiksi, siemen valittu mittaamalla

Kentät 5-1…5-3 on generoitu uudelleen siemenellä **60606**. Vanhat korvattiin,
eli maailma 5 on kokonaan uutta pelattavaa.

**Siementä ei valittu katsomalla vaan mittaamalla.** Ensimmäinen kokeiltu siemen
(päivämäärä, 20260809) tuotti kentät joista jokainen vaati tuplahypyn ja 5-1
kaatui jo sarakkeessa 21 — mitattuna huonompia kuin ne jotka korvattiin. Sen
jälkeen ajettiin kolmetoista siementä läpi `tools/playable.mjs`:llä ja
pysähdyttiin ensimmäiseen jolla **kaikki kolme kenttää menevät läpi voimatasolla
0**. Tulos: 60606, 100 % eteneminen kaikissa kolmessa.

Tämä on työkalun oikea käyttö: generaattori tuottaa ehdotuksia, ja läpäisytesti
päättää mikä niistä kelpaa. Ilman sitä "uudet kentät" tarkoittaisi käytännössä
"tuntemattoman laatuisia kentät".

Originaalisuustarkistus ajettiin päälle (`VGLC_DIR`): **0 korpusosumaa**
jokaisessa kolmessa. README kehottaa ajamaan generaattorin aina se asetettuna, ja
tämä on syy — ilman sitä tarkistus vain ohitetaan hiljaa.

---

## v26.08.09.3 — bloom hiljaisemmaksi

Palaute: teksti oli osin lukukelvotonta ja kirkkaat kohdat paloivat puhki.
Kolme muutosta, joista kaksi ensimmäistä ovat sävyä ja kolmas periaate:

- Kynnys 168 → **206**. Kolikot hehkuivat, mutta niin hehkui jokainen valkoinen
  kirjain ruudulla. Lukukelvoton pistelaskuri on huonompi vaihtokauppa kuin
  kolikko joka ei kimallla. Nyt hehkuu vain se mikä on aidosti kirkasta:
  aurinko, tulipallo, tähti.
- Voimakkuus 0,45 → **0,24**, eli puhkipalaminen loppuu.
- **HUD-palkki jätetään passin ulkopuolelle kokonaan.** Se on tekstiä tasaisella
  tummalla nauhalla, ja additiivinen valo pienten valkoisten kirjainten päällä on
  nopein tapa tehdä pelistä lukukelvoton. Pistelaskuri ei ole maisemaa.

Mitattuna: taivas ja maa pikselilleen ennallaan, HUD terävä, aurinko hehkuu.

---

## v26.08.09.2 — kytkinruudut

Painikelohko (`S`) kentässä 3-2. Osuma siihen muuttaa kentän **tiilet kolikoiksi
kymmeneksi sekunniksi**, ja HUD laskee aikaa. Viimeisen kahden ja puolen sekunnin
ajan tiilet välkkyvät kolikoiden ja tiilien välillä, joten loppu ei tule
yllätyksenä.

### Ruudukkoa ei kirjoiteta uusiksi
Kytkin on **yksi luku**, ei muunneltu kartta: `tileAt()` kääntää merkin lennossa
kun ajastin käy. Siksi vanheneva kytkin ei voi jättää kenttää rikkinäiseen
välitilaan, tilatallennus tarvitsee yhden kentän eikä toista kopiota ruudukosta,
ja `rawTileAt()` kertoo yhä mitä kartassa oikeasti lukee.

**Käännös menee vain yhteen suuntaan: tiili → kolikko.** Kaksisuuntainen vaihto
on se klassinen temppu, mutta se voi muuttaa ruudun jossa pelaaja seisoo
seinäksi, ja ajastimen sinetöimäksi joutuminen kiinteään kiveen ei ole pulma.
Nyt jokainen tila jonka kytkin tuottaa on **vähemmän** kiinteä kuin lähtötila.

### Kytkin avaa palkinnon, ei reittiä
Ensimmäinen versio oli tiiliseinä jonka läpi pääsi vain kytkimellä. Se kaatui
heti validaattoriin, ja aivan oikein: se rikkoo saman lupauksen kuin pakollinen
tehostus. Sen lisäksi **kumpikaan koneemme ei osaa mallintaa painiketta** —
validaattori näkee raa'an ruudukon ja botti osaa juosta ja hypätä — joten portti
olisi tarkoittanut valehtelua molemmille. Nyt tiililautta on katossa: sen ali
kävelee huomaamatta, ja kytkin muuttaa sen kolikkosateeksi johon ehtii hypätä.

### Ansaa ei ole, mutta ei siitä syystä kuin luulin
Kirjoitin `updateSwitch`iin vartijan joka kieltäytyy päättämästä ajastinta jos
pelaaja on palautuvan ruudun sisällä. Testi paljasti että tilanne on
saavuttamaton: **tiili joka luetaan kolikkona kerätään heti kosketuksesta**, mikä
tyhjentää sen solun ruudukosta pysyvästi — mitään ei ole palaamassa. Vartija jäi
paikalleen tulevien, ei-kerättävien käännösten varalta, mutta testi väittää nyt
sitä ominaisuutta joka pelaajaa oikeasti suojaa.

### Testit
Kuusi uutta: kytkin ja tiilet löytyvät kentästä, käynnissä oleva kytkin muuttaa
tiilen kolikoksi **ruudukkoa muuttamatta**, ajastin loppuu ja tiilet palaavat,
kytketty tiili kerätään pois, lohkon osuma käynnistää kytkimen ja kuluttaa
lohkon, ja tilatallennus muistaa käynnissä olevan kytkimen.

---

## v26.08.09.1 — pavunvarret ja piilotetut alueet

Kenttä 1-2 on nyt **45 riviä korkea**: taivaskaista pilvien yllä, tavallinen
reitti keskellä ja suljettu luolahuone alla. Sarakkeessa 150 kasvaa pavunvarsi,
sarakkeessa 229 on putki joka näyttää tavalliselta putkelta. Kumpikaan ei ole
matkalla maaliin — löytö lakkaa olemasta löytö jos se on joka nurkassa, ja
`playable.mjs` vahvistaa että 1-2 menee yhä läpi voimatasolla 0.

Uudet ruudut: `v` (köynnös, kiipeiltävä, **ei kiinteä**) ja `(` `)` (putki jonka
kurkusta käy hidas kiilto). Kiipeäminen kytkee painovoiman pois; hyppy irrottaa
luovuttamalla hypyn tavalliselle hyppykoodille, jottei varresta tule toista
hyppymekaniikkaa.

### Se mitä tässä oikeasti löytyi
Roadmap sanoi että validaattori lukisi taivaskaistan yhdeksi valtavaksi kuiluksi
ja hylkäisi jokaisen kentän. **Se teki päinvastoin, ja se on pahempi.** Vanha
`validateLevel` palautti uudesta 45-rivisestä 1-2:sta *nolla ongelmaa* — se luki
taivaskaistan lattiarivit, ei löytänyt maata mistään, eikä kuilulaskuria koskaan
tyhjennetty, joten yksikään geometriasääntö ei ollut päällä eikä mikään kertonut
siitä. Todistettu punaisella: kun pääkaistan lattiaan puhkaistiin 20 ruudun
reikä, vanhat säännöt raportoivat vain yhden vihollisen leijuvan ilmassa.

Korjaus jakaa säännöt kysymyksen mukaan, ei sijainnin: **jalansijakysymykset**
(leijuva vihollinen) katsovat koko ruudukkoa, **reittikysymykset** (kuilut,
seinät, pääntila, tehostus, portaat tyhjään) katsovat sitä 15 rivin kaistaa
**jossa pelaajan aloitusmerkki `1` on**. Se on sama lause kuin lupaus itse —
reitin alusta maaliin pitää aueta pienimmällä koolla — joten validaattori ja
suunnittelusääntö eivät voi ajautua erilleen. Korkea kenttä ilman aloitusmerkkiä
on siis aito virhe, ja se raportoidaan sellaisena eikä arvailla ympäri.

### Kaksi muuta asiaa jotka kaistojen pinoaminen rikkoi
- **Kuilu lakkasi olemasta kuilu.** Pohjaton sarake pääkaistalla sai kellarin
  alleen, eli putoaminen olisi ollut kahden sekunnin maisemakierros salaisuuden
  läpi. `assembleTall` kansittaa jokaisen pohjattoman sarakkeen laavalla
  luolakaistan yläreunaan; putoaminen tappaa yhä 19 framessa, kuten ennenkin.
- **Pystykamera oli oikeassa mutta ei riittävä.** 15 rivin kentässä `cam.y`
  liikkuu 32 pikseliä; 45 rivissä se olisi 512 pikseliä 1:1-seurantaa, eli
  jokainen hyppy vierittäisi ruutua — juuri sitä merenkäyntiä jota vaakakamera
  välttää. Kamera pysyy nyt siinä kaistassa jossa pelaajan **jalat** ovat
  (jalat eikä keskipiste: kuiluun pudotessa vartalo on hetken alemmassa
  kaistassa), siirtyy pehmeästi kaistan vaihtuessa ja jäätyy kuollessa.

### Bugi joka jäi kiinni vasta testissä
**Isoin voimataso ei mahtunut ulos luolasta.** Hahmo on tasolla 5 kokoa 21×43
pikseliä, eli kolme ruutua leveä, ja poistumisputken yläpuolella pinnalla oli
tiilirivi kahden sarakkeen päässä. `tryWarp` kieltäytyi aivan oikein — ja
lopputulos olisi ollut isoin pelaaja sinetöitynä bonushuoneeseen. Putki
siirrettiin sarakkeeseen jonka **pinta** on auki, ei siihen joka näytti luolassa
siistimmältä. Testi ajaa nyt sekä voimatason 0 että 5 läpi molemmista
salaisuuksista, koska juuri tällainen menee muuten huomaamatta tuotantoon.

### Testit
Kahdeksan uutta: varsi ylös ja takaisin (tasot 0 ja 5), putki alas ja luolasta
ulos (tasot 0 ja 5), putki ei heitä tyhjään taivaalle, kuilu tappaa yhä 19
framessa eikä esittele salaisuutta, maareitti ei koskaan näytä toista kaistaa,
ja korkea kenttä ilman aloitusmerkkiä raportoidaan.

---

## v26.08.08.24 — murenevat lavat, spritetehosteet ja datalla ohjattu generaattori

Kolme rinnakkaista työtä, joista kaksi teki alaagentti. Osa tiedostoista tuli
mukaan jo edelliseen committiin `git add -A`:n kautta kesken agenttien työn —
tässä ne on kuvattu kokonaisuutena.

### Murenevat lavat (`%`)
Uusi ruututyyppi: kiinteä kunnes sen päälle astuu, sitten se tärisee, halkeaa ja
putoaa pois 52 framessa. Käytössä tehtaan uudessa `fac_crumble`-palikassa (4-1):
kolikot ovat murenevien ruutujen **päällä** eikä turvallisissa päissä, jotta
ahne reitti ja turvallinen reitti ovat sama reitti — jännite on tahdissa, ei
valinnassa jonka tekee ennen kuin lähtee.

Kolme päätöstä joita ei kannata purkaa myöhemmin:
- **Ajastin on `scene.crumbles`, samanmuotoinen kuin `bumps`.** Tilatallennus
  osasi jo tallentaa ruutukohtaisen ajastinkartan, joten tämä maksoi siellä
  yhden rivin eikä uutta suunnittelua.
- **Ruutu kasvaa takaisin 220 framen jälkeen.** Ilman sitä kuolema puolivälissä
  jättäisi kentän lopullisesti mahdottomaksi loppuyritykseksi, eikä ruudulla
  olisi mitään mikä kertoisi miksi. Ruutua ei koskaan palauteta pelaajan sisään.
- **`%` on `rules.js`:n `SOLID`-joukossa.** Se kantaa tarpeeksi kauan että sen yli
  kulkeva reitti on oikea reitti; ilman tätä validaattori lukisi jokaisen
  kulkusillan pohjattomaksi kuiluksi ja hylkäisi kelvolliset kentät.

### Spritekohtaiset tehosteet
`tint`-parametri ja hehkukehä. Spritet ovat proseduraalisia, joten värjäys on
**väritaulun korvaus piirron aikana**, ei kuvankäsittelyä: alfakanava on
tavulleen sama värjätyssä ja värjäämättömässä. Käyttöön otettu siellä missä
pelitilalla ei ollut omaa kuvakieltä: jäätynyt hahmo, vahingoittumattomuuden
välähdys (joka ennen vain katosi joka toinen frame) ja sammumassa oleva
pierupallo. `ctx.filter`-varjoja ei käytetä — ne maksavat moninkertaisesti sen
mitä koko jälkikäsittelypassi.

### Generaattori lukee telemetriaa
`node tools/gen-levels.mjs --telemetry loki.json`. Kuolemakeskittymä leventää
edeltävää lepotasannetta, jumikeskittymä madaltaa seuraavaa estettä — mutta
vain jos dataa on tarpeeksi: **5 tapahtumaa samassa kohdassa JA 3 yritystä jotka
päättyivät muualla.** Jälkimmäinen on se joka erottaa harjoittelun ongelmasta:
kaksikymmentä kuolemaa yhdessä hypyssä eikä mitään muuta lokissa tarkoittaa että
pelaaja valitsi sen hypyn.

Kolme asiaa jotka roadmap oletti väärin ja jotka toteutus paljasti:
1. **Lokin sarakenumerot eivät tarkoita mitään muutoksen jälkeen.** Generaattori
   latoo palikat vasemmalta oikealle, joten minkä tahansa levennys numeroi
   uudelleen kaiken sen jälkeen. Siksi kenttä rakennetaan kahdesti: ensimmäinen
   on kartta, toinen se joka muuttuu.
2. **Kaikilla esteillä ei ole korkeutta.** Suurimmalla osalla sanastoa ei ole
   nuppia jolla siitä tulisi helpompi olematta jotain muuta. Rehellinen vastaus
   on kirjattu "jätettiin rauhaan", ei keksitty säätö.
3. **Säädetyt kentät lyhenevät.** Rakennussilmukka lopettaa samaan leveyteen,
   joten levennetty lepo syö sisältöä. Puolustettavaa, muttei sitä miltä sana
   "leventää" kuulostaa.

### Testit
Neljä uutta murenevalle lavalle (kantaa, varoittaa, putoaa, kasvaa takaisin,
tilatallennus muistaa ajastimet) ja yksi spriteille: piirto ei saa jättää
`globalCompositeOperation`ia tai `globalAlpha`ia jälkeensä. Kaksi ensimmäistä
versiota murenemistestistä olivat itse rikki — pelaaja putosi kuoppaan ja kuoli,
ja kuollut kohtaus lakkaa päivittämästä 140 framen jälkeen, joten testi mittasi
sitä eikä ruutua.

---

## v26.08.08.23 — kenttäkohtainen tunnelma ja oikeampi kuvaputki

### Lisätty
- **Kenttäkohtaiset tunnelmaefektit** teeman mukaan: aavikossa ja tehtaassa
  **kuumuuden väreily**, jäämaailmassa **huurre** joka kasvaa ruudun ylä- ja
  alareunasta sahalaitaisina piikkeinä. *Miksi teemasta:* efekti joka kertoo
  missä ollaan on sisältöä, sama efekti kaikkialla on ruudunsäästäjä.
- **Kuvaputkesta oikeamman näköinen** (RetroArchin `crt-lottes`/`crt-royale`
  -periaatteilla): varjomaski, vaakasuuntainen vuoto ja kirkkaudesta riippuva
  juovan leveys.

### Miksi kuvaputki muuttui juuri näin
Kolme asiaa erottaa "tummat raidat kuvan päällä" siitä että kuva näyttää
kuvaputkelta, ja kaikki kolme puuttuivat:

1. **Lineaarinen valo.** Juovat kertovat, ja gamma-koodattujen arvojen kertominen
   on juuri se mikä tekee naiivista CRT-suotimesta mutaisen. Nyt beam ja maski
   lasketaan lineaarisessa avaruudessa ja tulos koodataan takaisin.
2. **Juova levenee kirkkauden mukaan.** Oikeassa putkessa kirkas juova vuotaa
   naapureidensa päälle ja rako sulkeutuu; vakiolevyinen juova vain himmentää
   kaiken tasaisesti.
3. **Vaakasuuntainen vuoto.** Yhtä johtoa pitkin syötetty kuva ei ehdi vaihtaa
   väriä yhtä nopeasti kuin pikselit vaihtuvat, joten vierekkäiset pikselit
   sekoittuvat — tämä on se "mössö" josta kuva alkaa näyttää televisiolta eikä
   ruudukolta. Vain vaakasuunnassa: pystysuunta on juovia, ei kaistanleveyttä.

**Varjomaski piirretään vain jos sille on oikeita pikseleitä.** Aukkomaski on
kolmen pikselin kuvio, joten se tarvitsee kolme laitepikseliä lähdepikseliä
kohti. Sen alle jäätäessä se ei olisi maski vaan kolmanneksen himmennys, jota
kutsuttaisiin autenttisuudeksi. Sama sääntö kuin juovilla. Beam ja maski vievät
valoa, joten `uGain` antaa takaisin suunnilleen sen mitä ne ottivat.

### Testit
- Tunnelma tulee teemasta ja nollautuu kun kentästä poistutaan.
- **Tunnelma ei kosketa HUD-palkkia.** Kuumuus väristi ajastinta ja huurre kasvoi
  pisteiden päälle — sellainen tunnelma tekee pelistä vaikealukuisen, ei
  kauniimman. Testi vertaa HUD-riviä samaan kuvaan ilman tunnelmaa, joten bloom
  ei sotke vertailua.
- 2D-polku testataan erikseen (`fx.mode = '2d'`), koska siellä pystysuunnan
  kääntäminen väärinpäin on helppoa — ja niin oli käynytkin.

---

## v26.08.08.22 — kosketusohjaus kahdella mallilla

### Lisätty
- **`src/core/touch.js`**: kosketusohjaus, kaksi mallia. `näppäimet` on näkyvä
  ristiohjain + Z/X, `peukalot` ei piirrä nappeja lainkaan — vasen puoli on
  sauva joka ilmestyy peukalon alle, oikean puolen alaosa hyppää. *Miksi kaksi:*
  kumpi on parempi ei ratkea pöydän ääressä, joten valinta on pelaajan.
- **Kuvaputki (`crt`) on nyt oletusefekti.** Se on se ilme joka pelillä on
  tarkoitus olla, ja pois saa yhdellä painalluksella.
- Näppäin **6** ja OHJAUS-painike vaihtavat mallia, `?touch=1` pakottaa
  ohjaimet esiin työpöydällä.

### Miksi näin
- **Ohjaimet ilmestyvät vasta ensimmäisestä oikeasta kosketuksesta.** Moni
  kannettava ilmoittaa kosketustuen jota kukaan ei käytä; pelkän tuen perusteella
  piirretty ristiohjain olisi niille pelkkää haittaa.
- **Osumatarkistus on omaa koodia, ei DOM-nappeja.** Selain ei lähetä
  `pointerleave`ia kun peukalo liukuu napilta toiselle, eikä ristiohjain jolla ei
  voi rullata peukaloa ole ristiohjain.
- **Jokainen sormi seurataan `pointerId`:llä**, koska ohjaus + juoksu + hyppy on
  kolme sormea ja yhdenkin pudottaminen tuntuu pelin jumittumiselta.
- **`touch-action: none`**, tai Android tekee hypystä sivun vierityksen.

### Korjattu samalla
- **Canvas jäi puhelimessa 1× kokoon.** Kokonaislukuskaalaus on oikein isolla
  ruudulla, mutta 844×390 vaakanäytöllä se tarkoitti postimerkkiä. Nyt
  kokonaisluku käytössä kun tilaa on 2×:lle, sen alle venytetään täyteen.
- **Skanviivat aliasoituivat moiré-verhoiksi** pienellä skaalalla. Esityscanvas
  mitoitetaan nyt *laitepikseleihin*, ja jos viivalle ei jää kahta oikeaa
  pikseliä, ne häivytetään pois sen sijaan että taisteltaisiin vastaan.
- Näppäimistövihjeet piiloon ja kuva ylös kun kosketusohjaus on käytössä.

### Testit
Yhdeksän uutta tarkistusta: painallus ja vapautus, peukalon liu'utus napilta
toiselle, kolme sormea yhtä aikaa, framea lyhyempi näpäytys, kelluva sauva
kaikkiin suuntiin, oikean puolen jako, mallin vaihto kesken painalluksen ja
valinnan muistaminen. Kaksi aitoa bugia jäi kiinni: liu'utus jätti edellisen
suunnan latch-puskuriin ja mallin vaihto jätti näppäimen pohjaan. Korjaus:
`clearTouch()` tyhjentää myös latchin.

---

## v26.08.08.21 — kuvaefektit (bloom, juovat, kuvaputki)

### Lisätty
- **`src/gfx/postfx.js`**: bloom, skanviivat, vinjetti ja WebGL:llä myös kaareva
  kuvaputki ja värivirhe. Näppäin **7** kiertää esiasetukset `pois → hehku →
  kuvaputki`, ja valinta muistetaan.
- **Efektit debug-ruudulla** (`FX WEBGL CRT`), ja tauko­ruutuun vihje näppäimestä.

### Miksi näin — ja miksi ei WebGL-uudelleenkirjoitusta
Peli **piirtää edelleen Canvas 2D:llä**; WebGL vain esittää valmiin
320×240-kuvan shaderin läpi. Koko renderöijän kirjoittaminen WebGL:llä
harkittiin ja hylättiin: `src/gfx/` on tuhansia rivejä suorakaiteita, se maksaa
mitatusti alle millisekunnin framessa, eikä uudelleenkirjoitus toisi muuta kuin
shaderit — jotka saa näinkin, yhdellä tiedostolla ja koskematta piirtokoodiin.

**Fallback on pakollinen, ei kohteliaisuus.** `getContext('webgl2')` palauttaa
nullin estolistatulla ajurilla, virtuaalikoneessa ja kun laitteistokiihdytys on
pois — täysin ajantasaisessakin selaimessa. Ilman WebGL:ää bloom, juovat ja
vinjetti piirretään Canvas 2D:llä; vain kaarevuus jää pois. `verify.mjs` tynkää
kontekstin pois ja tarkistaa tämän joka ajolla, samoin sen että heittävä ajuri ei
kaada peliä.

### Kaksi virhettä, jotka löytyivät vasta kuvakaappauksesta
Molemmat menivät testeistä läpi ja näkyivät heti silmällä — tästä syystä efektit
katsottiin oikeasta selaimesta eikä vain mitattu:
- **Kuva oli ylösalaisin.** Canvas on ylhäältä alas, GL-tekstuuri alhaalta ylös.
  Korjaus: `UNPACK_FLIP_Y_WEBGL`.
- **Skanviivat muodostivat moiré-renkaita.** Taajuus oli sidottu näytön
  pikselikokoon (720), jolloin se lähestyi pikseliruudukkoa. Nyt yksi viiva per
  **lähdekuvan** rivi (240), eli 3 px per viiva kolminkertaisella skaalalla.

### Bloomin kynnys on luminanssissa, ei kanavissa
Ensimmäinen versio käytti `ctx.filter = 'contrast()'`, joka kynnystää kanava
kerrallaan. Se ei erota kirkasta taivasta valkoisesta auringosta, koska taivaan
sininen kanava on jo 252 — koko kuva nousi ~45 tasoa ja muuttui maitomaiseksi
(taivas 104,158,252 → 151,224,255). Nyt kynnys lasketaan Rec. 709 -luminanssista
80×60-kopiosta: taivas on 153, kolikko 179, aurinko 251, joten kynnys 168
hehkuttaa kolikon ja jättää taivaan rauhaan. Mitattuna taivas ja maa ovat nyt
pikselilleen samat kuin ilman efektejä.

Luminanssikynnys vaatii pikselien lukemisen, mutta vain 4800 kpl: koko passi
mittaa 0,35 ms framessa. `verify.mjs` vahtii 2,5 ms:n budjettia, koska juuri
tällainen asia lakkaa huomaamatta olemasta halpa.

---

## v26.08.08.20 — pelidatan kirjaus ja lämpökartta

### Lisätty
- **Telemetria, vaihe 1 (`src/core/telemetry.js`)**: peli kirjaa kuolemat
  (paikka ruutuina, syy, voimataso, kesto), jumipaikat ja läpäisyt selaimen
  localStorageen. *Miksi:* omia kenttiään pelaamalla ei näe missä ne oikeasti
  kaatavat pelaajan — yksi ruutu voi syödä puolet yrityksistä, ja sen näkee vain
  datasta.
- **Lämpökartta debug-ruudussa** (näppäin 9): punainen pylväs per kuolemasarake,
  sininen viiva alalaidassa jumipaikoista. Piirretään entiteettien *alle*, jotta
  se ei koskaan peitä sitä mitä pitää nähdä, ja lasketaan 30 framen välein —
  debug-ruudulla ei ole asiaa syödä framebudjettia.
- **Jumin tunnistus**: 480 framea (8 s) ilman uutta maastoa = jumi. Kuolemat
  eivät riitä mittariksi, koska seinä jota ei pääse yli ei tuota yhtään kuolemaa.
  Kirjataan kerran per sarake, jotta paikalleen jäänyt pelaaja ei täytä lokia.
- **Vienti (vaihe 2)**: näppäin **8** kirjoittaa koko lokin JSON-tiedostoksi,
  jonka voi syöttää generaattorille.

### Periaatteet, joiden varaan tämä on rakennettu
- **Anonyymi rakenteeltaan, ei lupauksella.** Tallennettuna on kenttä, ruutu,
  syy ja voimataso — ei nimeä, ei kellonaikaa, ei tunnistetta. Kun dataa ei voi
  yhdistää kehenkään, ei tarvita suostumusikkunaa eikä tietosuojalupausta jota
  pitäisi valvoa.
- **Mikään ei lähde selaimesta.** Moduulissa ei ole yhtään verkkokutsua, ja
  `verify.mjs` tarkistaa lähdekoodista ettei sinne ilmesty `fetch`iä,
  `sendBeacon`ia tai WebSocketia. Lähettäminen on erillinen päätös (ROADMAP §1
  vaihe 3), ei sivutuote.
- **Loki on rajattu 800 tapahtumaan.** Vanhat putoavat edestä pois, jotta pitkään
  eläneessä selainprofiilissa `setItem` ei voi koskaan alkaa heittää.
- Koordinaatit ruutuina, ei pikseleinä: se on tarkkuus jolla kentät oikeasti
  tehdään, ämpärit osuvat kohdalleen ilmaiseksi ja loki on kertaluokkaa pienempi.

### Testit (punainen → vihreä)
Kahdeksan uutta tarkistusta `verify.mjs`:ssä, jotka kaikki oli ensin punaisia:
kuolinsyy ja -sarake, yksi kuolema per yritys (tilalataus ei saa kirjata samaa
kuolemaa kahdesti), kuilukuoleman syy, jumin kirjaus kerran, liikkuvaa pelaajaa
ei kirjata jumiin, läpäisyn yritysmäärä, viennin JSON ja verkkokutsuttomuus.

---

## v26.08.08.19 — linkin esikatselukortti

### Lisätty
- **Open Graph -kortti**: kun linkki jaetaan Slackiin, Discordiin tai someen,
  esikatselussa näkyy pelin alkuruutu otsikoineen.
- `node tools/make-card.mjs` **valokuvaa kortin pelistä itsestään** ja kirjoittaa
  `card.png`:n. *Miksi näin:* Slack ja muut eivät renderöi SVG:tä esikatselussa,
  joten yksi bittikartta on pakko olla — mutta käsin piirretty kortti vanhenee
  heti kun peli muuttuu, ja generoitu ei. Aja työkalu kun alkuruutu muuttuu.
- Metatiedoissa on absoluuttiset URL:t, koska esikatselun hakee palvelu omalta
  palvelimeltaan eikä suhteellinen polku tarkoita siellä mitään.

---

## v26.08.08.18 — aavikon yö

### Lisätty
- **Yökenttä aavikkomaailmaan** (2-N "AAVIKON YÖ", oma solmu maailmankartalla):
  uusi `night`-teema tummalla paletilla, tähtitaivas, kuu ja sinertävä
  hiekkapöly. Pääsuunnittelijan pyyntö.
- **Tuuli.** Pitkiä tyyniä jaksoja, jotka katkeaa puuska joka työntää sivuttain
  — voimakkaammin ilmassa kuin maassa. Puuskan pitää olla ajoittainen: jatkuva
  työntö on vain muutettu ohjaus, kun taas tuleva puuska on asia jonka ympärillä
  voi pelata. Kentän `wind: true` kytkee sen.
- **Kuu johon voi hypätä.** Roikkuu yötaivaalla, keinuu, eikä voi satuttaa —
  haaste on päästä sinne. Päälle hyppääminen antaa tehostuksen ja 1000 pistettä,
  ja käytetty kuu himmenee. Portaat sen alla tekevät siitä saavutettavan ilman
  pieruhyppyä.

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
