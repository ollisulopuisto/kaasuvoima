# Roadmap ja työlista

Tämä tiedosto on työn muisti: mitä on kesken, mitä seuraavaksi ja miksi.
Päivitä se kun tila muuttuu — älä luota siihen että konteksti muistaa.
Valmistuneet asiat siirtyvät [CHANGELOG.md](CHANGELOG.md):hen perusteluineen.

**Työtapa:** deployaa jokaisen pienenkin korjauksen jälkeen. Peliä pelataan
tuotannosta, joten korjaus joka odottaa committia ei hyödytä ketään. Portti
ennen pushia on `node tools/verify.mjs`.

---

## Tila 9.8.2026

Kaikki alla oleva on tuotannossa ja testattu: **5 maailmaa, 22 kenttää.**
`node tools/verify.mjs` on portti, `node tools/playable.mjs` tarkistaa geometrian
ja `node tools/difficulty.mjs` vaikeuskäyrän.

**Mekaniikat:** kuplaloukku (pallo vangitsee, puhkaisu tappaa, karkaava vihu
vihastuu) · supertähti (kuolemattomuus vihollisille ja maan piikeille, ei
kuopalle/laavalle/kellolle) · kytkinruudut · murenevat lavat · murtava tehostus
PAUKKUPAPU, joka rikkoo tiilen ja **vain** tiilen (v26.08.09.14) · pavunvarsi ja
warp-putki (45 rivin kenttä maailmoissa 1–4) · salaisuudet tavallisissa tiilissä
(39 kpl) · piikkiukko · pomon deterministinen piikkisykli.

**Sisältö:** haarautuva kartta maailmassa 2 — `2-2` on risteys, `HIEKKATIE` ja
`LAAVATIE` päätyvät molemmat linnakkeeseen, ja haaran vaikeus ja palkinto lukevat
kartalla ennen valintaa (v26.08.09.13) · minipomo `2-M`, papuparoonit laavatien
varrella, murtavan tehostuksen ainoa lähde (v26.08.09.14) · maailma 5 generoitu
uusiksi niin että aamun mekaniikat näkyvät myös siellä, siemen valittu
mittaamalla (v26.08.09.12) · vaikeuskäyrä nousee joka maailmassa, tasan yksi
notko per maailma · nyrkkeilijäpomo · jäätikkö laavan tilalle jäämaailmassa ·
kaksoisovet · voittoruutu hernekeitolla · sirppikuu.

**Esitys:** kuvaputki varjomaskilla ja vaakavuodolla · kenttäkohtainen tunnelma ·
esittelytila · teemakohtaiset seisonta-animaatiot kentissä ja kartalla · oma
kuvakieli tiilelle, `?`-lohkolle ja putkelle · valojärjestelmä, jossa maailma
kantaa omat valonsa · kosketusohjaus kolmella mallilla · jakoruutu
(`navigator.share`, ei palvelinta) ja tulos jakolinkissä.

**Portit ja työkalut:** playable.mjs · difficulty.mjs, joka kirjoittaa
`src/data/difficulty.js`:n vain lipun takana ja jonka vanhentumisen `verify.mjs`
huomaa johtamalla luvut uudelleen · kaistavalidointi, joka kattaa kaikki kolme
kaistaa ja siis myös bonushuoneet (v26.08.09.11) · hyppybudjetin
toistettavuustesti · debug-warp (näppäin 4, kaataa pistetaulun) ·
salaisuuslaskuri debug-ruudussa · telemetria ja sitä lukeva generaattori.

### Seuraava työ, tässä järjestyksessä

1. **Pavunvarsi kasvamaan `?`-lohkosta.** Nyt se on pysyvästi näkyvissä.
   Tekotapa on kirjattu jo silloin kun kaistat tehtiin: lohko pudottaa pavun, ja
   pavusta kasvaa varsi ruutu kerrallaan ylöspäin (`setTile` animoituna).
2. ✔ **Kiipeilyanimaatio** — tehty (v26.08.09.22). `state()` palauttaa nyt
   `'climb'`, ja se kahden framen sykli jota köydelle jo laskettiin on vihdoin
   käytössä.
3. ✔ **Spritejen animaatiokierrokset** käyty läpi kaikilla viidellä
   voimatasolla (v26.08.09.18) ja loputkin korjattu (v26.08.09.22): kävely
   kulkee nyt ohitusasennon kautta, ja tarkistus on portissa.
4. **Minipomot muihin maailmoihin**, jos niitä halutaan. Koneisto on olemassa
   (`2-M`, v26.08.09.14), joten tämä on kenttädataa ja karttasolmuja.
5. **Luumaailma** ja luurankopomo tehtaan jälkeen.
6. **Salaisuuksien löydettävyys** — kolmesta osasta yksi tehty:
   ✔ kartta kertoo *että* kentässä on salaisuuksia ja montako niistä on
   löytynyt, **ei koskaan missä** (v26.08.09.17). Jäljellä: demo näyttää
   tempun, ja kolikkojonot osoittavat.

## Jonossa

### Ruutuefektit ja neljännen seinän rikkominen

Neljä erillistä ideaa, tahallaan erillään — ne jakavat teeman muttei toteutusta.

**1. Voimakkaampi ruudun tärinä (halpa).** `scene.shake(amount)` on jo olemassa,
katto 6 px, ja linnakkeissa siitä on viitteitä. Pomon laskeutuminen, jättiläisen
askel ja iskuaalto ansaitsevat oman voimakkuutensa, ja tärinän pitäisi olla
*suunnattua* (pystyisku tärisyttää pystyyn) eikä aina samaa ympyrää. Kuvaputken
jälkikäsittely voi vahvistaa sen — se näkee jo valmiin kuvan.

**2. ✔ Auringon palava jälki — tehty** (v26.08.09.18), ja sääntö piti: se meni
`sprites/enemies.js`:ään eikä `postfx.js`:ään, koska jälkikäsittely ei tiedä
mikä pikseli oli aurinko. Samalla korjautui räikkä joka piti auringon
näkymättömissä 2-1:ssä (kokonaan näkyvissä 21,5 % → 98,3 %), sukellus sai
näkyvän ennakkovaroituksen, ja aurinko luovuttaa lipulla eikä seuraa maan alle.

**3. Pomo hyökkää pelikentän kimppuun (keskihintainen).** Iskuaalto irrottaa
laattoja, halkeamat leviävät lattiassa. **Tämä on halpa vain siksi että ruudukko
on jo osoitettu muunneltavaksi ja tallennusturvalliseksi**: murenevat lavat ja
kytkinruudut tekivät sen työn, ja tilatallennus tallentaa koko ruudukon.
Riski jonka tiedämme etukäteen: `rules.js` validoi kentän *lähtötilan*, joten
pomo joka rikkoo lattian voi tehdä areenasta läpäisemättömän. Vaatii saman
takaisinkasvun kuin mureneva lava, ja samasta syystä.

**4. Pomo järjestää kentän uusiksi — PÄÄTETTY TEHDÄ 9.8.2026.** Omistaja valitsi
tämän eikä halvempaa kohtaa 3:a. Kolme ehtoa alla eivät ole toiveita vaan
hyväksymiskriteerit, ja niistä **validointi on se joka pitää ratkaista ensin**:
`rules.js` tarkistaa kentän *lähtötilan*, joten areena joka muuttuu kesken
taistelun on juuri se tapaus jota mikään portti ei tällä hetkellä katso.
Kaistavalidointi (v26.08.09.11) antaa siihen mallin — yleiset vs. tilannekohtaiset
säännöt — mutta muuttuvan ruudukon tarkistaminen on uusi asia: jokaisen
*mahdollisen* järjestelyn on kelvattava, ei vain sen jossa taistelu alkaa.

Itse idea: vaihe jossa pomo muokkaa areenaa — nostaa pilareita, avaa kuiluja —
ja pelaajan pitää sopeutua.
Tämä on aito neljännen seinän rikkominen siinä mielessä että vihollinen koskee
siihen mitä pelaaja luuli vakioksi. Vaatii että muutos on **ennakoitu, palautuva
ja validoitu**: pelaaja näkee sen tulevan, areena palautuu jos pomo kaatuu, ja
mikään järjestely ei saa tehdä ovea saavuttamattomaksi. Ilman noita kolmea se on
epäreiluuden generaattori.

### Ruututyypit teemakohtaisiksi muodoltaan, ei vain väriltään

Toiminta pysyy samana, ulkonäkö vaihtuu maailman mukaan: aavikossa toisenlaiset
lohkot kuin linnakkeessa, jäässä toisenlaiset kuin tehtaassa.

**Mikä on jo olemassa:** `THEMES` antaa jokaiselle teemalle oman palettinsa, ja
`drawTile` saa teeman nimen, joten ruudut ovat jo teemakohtaisia **väriltään**.
`drawGround`illa on lisäksi `surface`-vaihtelu (korret, aallot, niitit).

**Mikä puuttuu:** muoto. Tiili on sama tiili joka maailmassa, vain eri värisenä,
ja sama koskee `?`-lohkoa ja putkea. Tämä kohta on siis "eri piirtofunktio per
teema" eikä "eri paletti per teema".

**Este on poissa:** uusi kuvakieli tiilelle, `?`-lohkolle, putkelle ja
rikkoutumiselle on paikallaan (v26.08.09.7), eli tämä on aloitettavissa. Jäljellä
on vain kaksi ehtoa, ja ne koskevat tekotapaa eivätkä ole esteitä:

1. **Kaikkien pitää lukea samaksi asiaksi.** Pelaaja oppii maailmassa 1 että
   tuo on rikottava lohko, ja maailmassa 4 sen pitää olla tunnistettavissa
   ilman uutta opettelua. Vaihtelu saa olla materiaalissa, ei siluetissa.
   Mitattava sama tapa kuin nyt: uusi ruutu maan ja kovan maan vieressä, ja
   pikseliero raportoituna jokaisessa teemassa.
2. **Kustannus on kuusi kertaa suurempi kuin miltä näyttää.** Kuusi teemaa
   kertaa neljä ruutua on 24 piirtofunktiota ylläpidettäväksi. Halvempi malli
   on yksi funktio joka ottaa muotoparametrit teemataulusta — sama tapa jolla
   `THEMES` hoitaa jo värit.

### Maahanisku (ground pound)

Ilmassa alas + hyppy syöksee hahmon maahan pierun voimalla. Osuma tainnuttaa tai
tappaa lähellä olevat viholliset, ja **mitä korkeammalta pudotaan, sitä kovempaa
se osuu** — sekä vahingoltaan että ruudulla. Ylimmästä mahdollisesta hypystä
tehtynä se on äänivallin rikkominen: pieru työntää alas, ympärille syntyy
iskuaalto.

Ohjaus on jo vapaana: `down` + `jump` yhdessä ei tarkoita ilmassa mitään.
`jumpBuffer` ja `airJumps` ovat pelaajassa, iskuaalto on olemassa (`Shockwave`,
pomon hyökkäys), ja `scene.shake` on olemassa. Suurin osa palasista on siis
paikallaan.

Neljä asiaa jotka pitää ratkaista, ja kaksi niistä on tasapainoa:

**Päätetty 9.8.2026: tehdään, ja kohdat 1 ja 3 alla ovat päätettyjä eivätkä
avoimia.** Maahanisku maksaa ohjaamattoman putoamisajan ja haavoittuvan hetken
maassa, ja **piikit voittavat sen** — muuten piikikkyys lakkaa tarkoittamasta
mitään ja juuri rakennettu pomon piikkisykli menettää merkityksensä.

1. **Se ei saa korvata tallausta.** Tallaus on pelin perusliike. Maahanisku saa
   olla laajempi ja kovempi mutta sen pitää maksaa jotain — putoamisaika jonka
   aikana ei voi ohjata, ja hetki maassa jonka aikana on haavoittuvainen. Ilman
   hintaa siitä tulee ainoa liike jota kukaan käyttää.
2. **Voimataso saa vahvistaa sitä, ei avata sitä.** Sama lupaus kuin muualla:
   tehostus avaa paikkoja, ei kenttää. Perusliikkeen pitää toimia voimatasolla 0,
   ja korkeampi taso saa laajentaa sädettä tai lisätä iskuaallon.
3. **Piikikkäät viholliset.** Maahanisku ei ole tallaus, joten piikkiukkoon ja
   piikikkääseen pomoon osuminen pitää päättää erikseen. Suositus: **piikit
   voittavat senkin** — muuten piikikkyys lakkaa tarkoittamasta mitään ja juuri
   rakennettu pomosykli menettää merkityksensä.
4. **Korkeuden mittaaminen.** "Mitä korkeammalta, sitä kovempaa" tarvitsee
   lähtökorkeuden muistiin syöksyn alkaessa, ja katon (`ty < 0` on kiinteä)
   takia ylin mahdollinen korkeus on tiedossa — eli asteikko voidaan normalisoida
   eikä arvata.

Audiovisuaalinen puoli kuuluu tähän kokonaan eikä erikseen (DESIGN.md kohta 8):
syöksyn ääni, osuman ääni, tärinä jonka voimakkuus seuraa korkeutta, ja
iskuaalto joka on **eri väriä ja eri rytmiä kuin pomon iskuaalto** — kaksi
samannäköistä "jotain tapahtui" -signaalia opettavat lukemaan väärää.

### Kahdeksan maailmaa, kahdeksan kenttää kussakin

Nyt on 5 maailmaa ja 22 kenttää. Tavoite on 64, eli **kolminkertainen määrä
sisältöä** — ja se on se luku josta tämän kohdan suunnittelu pitää aloittaa,
koska kaikki muu seuraa siitä.

**Tilanne muuttui 9.8.2026: neljästä esteestä kaksi on poissa ja yksi halpeni.**
Kohta 3 (vaikeuskäyrän mittari) on tehty — muototarkistus lukee nyt tasoja eikä
jonoa, koska haarautuva kartta vaati saman. Kohta 4:n edellyttämät palaset ovat
olemassa: minipomo ja haarautuva kartta ovat tuotannossa, eli kahdeksan kentän
maailmalle on nyt oikeasti jotain laitettavaksi. Ja kohta 1 halpeni, koska
generaattori osaa nyt koko ruutusanaston (`%`, `S`, `*`, salaisuudet) eikä enää
tuota mekaniikattomia kenttiä.

**Jäljellä on siis kaksi:** paljonko tehdään käsin, ja kaksi puuttuvaa teemaa.

Alkuperäiset neljä, tila merkittynä:

1. **Käsin ei tehdä 42 uutta kenttää.** Nykyiset käsintehdyt ovat maailman
   parasta sisältöä, mutta ne ovat myös hidas tapa. Generaattori on olemassa
   ja tekee jo maailman 5:n, telemetria syöttää sitä, ja tässä mittakaavassa
   se lakkaa olemasta bonusmaailman kikka ja alkaa olla se tapa jolla peli
   tehdään. Päätös jota tämä vaatii: **mikä osuus tehdään käsin.** Suositus:
   maailman ensimmäinen ja viimeinen kenttä käsin, väli generoiden ja käsin
   viimeistellen — käsi opettaa ja päättää, generaattori täyttää.
2. **Kuusi teemaa ei riitä kahdeksalle maailmalle.** Nyt: ruoho, aavikko, yö,
   jää, tehdas, linnake. Luumaailma on jo jonossa. Kaksi maailmaa tarvitsee
   siis vielä oman teemansa, ja teema on paletti + taustat + palikat +
   musiikki, ei pelkkä väri.
3. **Vaikeuskäyrä on viritetty viidelle maailmalle.** Kahdeksan porrasta samaan
   väliin tarkoittaa loivempaa nousua tai korkeampaa kattoa, ja se on yhä
   päättämättä. Mittarin puoli on sen sijaan tehty: `difficulty.mjs`:n
   muototarkistus lukee nyt tasoja eikä jonoa (v26.08.09.13), koska haarautuva
   kartta vaati saman uudelleenkirjoituksen. Ennuste piti paikkansa — kaksi
   kohtaa, yksi työ.
4. **Kahdeksan kenttää maailmassa on eri muoto kuin neljä.** Nykyinen kaava on
   kolme kenttää ja linnake. Kahdeksan ei ole "sama kaksi kertaa" vaan tila
   välipomolle, haaralle ja hengähdyskentälle — ja **ne kolme ovat nyt
   rakennettavissa kenttädatana**, koska minipomo ja haarautuva kartta ovat
   tuotannossa. Tämä kohta on siis se joka antaa niille tilan, ei kilpaile
   niiden kanssa. Jäljellä on muodon päättäminen.

### Salainen alue maailmaan 5

Yksi kenttä per maailma saa salaisen alueen: pavunvarsi ylös taivaalle ja putki
alas maan alle. Ei joka kenttään — löytö lakkaa olemasta löytö jos sellainen on
joka nurkassa. Maailmoissa 1–4 se on tehty (`1-2`, `2-2`, `3-2`, `4-2`;
v26.08.09.1 ja v26.08.09.8), ja `assembleTall`, kaistajako ja kaistojen
validointi ovat valmiina.

Jäljellä on maailma 5, ja se on eri työ kuin muut: sen numeroidut kentät tulevat
generaattorista, joten kaista syntyy sinne vain opettamalla `gen-levels.mjs`:lle
kolmikerroksinen kokoonpano — ja uusi generointiajo arpoo maailman uusiksi, eli
kolmen kentän mitattu vaikeus muuttuu kerralla. Oma päätöksensä.

### ✔ Tehty (v26.08.09.21): kaikki elävä hengittää

**Tehty.** Maasta kävelevät viholliset hengittävät nyt 163 framen jaksolla,
vaihesiirto oliokohtaisesti, 1 px:n amplitudi laatikon sisällä. Kuvaus alla on
jätetty siksi että se kertoo *miksi* luvut ovat mitä ovat.

#### Alkuperäinen kuvaus

Omistajan pyyntö, hänen sanoinaan: *yleinen läpikäynti joka saa kaiken elävän
hengittämään vähän, samaan tapaan kuin karttasolmut jo tekevät — niin että
spritet eivät liiku pelkästään sivusuunnassa vaan niissä on hitunen
pystyliikettä.*

Pyyntö on vanha, sitä ei kirjattu mihinkään, ja tänään se piti kysyä toista
kertaa. Se on toinen kerta kun kirjaamaton pyyntö ajelehtii — jakoruutu oli
ensimmäinen. Tämän tiedoston oma otsikko sanoo miksi se sattuu: älä luota siihen
että konteksti muistaa.

**Malli on jo olemassa, eikä sitä tarvitse keksiä.** `src/scenes/worldmap.js`
huojuttaa kaikkea kasvavaa yhdellä yhteisellä huojunnalla, jonka vaihe on
siirretty ruutukohtaisesti *"jotta naapurit eivät liiku tahdissa"*. Juuri se
siirtymä on koko temppu. Ilman sitä rivi kävelijöitä sykkii kuin tanssikuoro, ja
se ei lue elämänä vaan piirtovirheenä.

**Mikä hengittää jo, jottei sama tehdä kahdesti:** pelaajan seisonta-animaatio,
ummetuskorkki, hajupilven vaiheen ja voimakkuuden ajelehtiminen, vihaisen
auringon leijunta, kuun huojunta, esineiden huojunta ja kolikon ja tähden syke,
kuplaan vangittu vihollinen, ja karttasolmut. **Mikä ei:** kävelijät, kuoriukot,
korkkiukot, piikkiukot ja kasvit — eli juuri ne maanpinnan viholliset joita
omistaja katsoo kun hän sanoo että spritet liikkuvat vain sivuttain.

Neljä asiaa jotka tekevät tästä muuta kuin `Math.sin`in lisäämisen:

1. **Pikseliruudukko on kova reunaehto.** Spritet piirretään
   kokonaislukusuorakaiteina 320×240-ruudukolle. Alle pikselin huojunta joko
   pyöristyy — jolloin se on 1 px:n napsahdus, ja nopea napsahdus lukee
   tärinänä eikä hengityksenä — tai rikkoo sen pikseliruudukon jonka varassa
   koko kuvakieli on. Amplitudi on siis 1 px, ja **käsityö on jaksonpituudessa**:
   tarpeeksi hidas että napsahdus lukee vartalon asettumisena, tarpeeksi nopea
   että olio on elossa. Se luku löydetään katsomalla, ei valitsemalla.
2. **Se ei saa valehdella osumalaatikoista.** DESIGN.md kohta 7: mikä voi
   satuttaa, sen pitää näkyä. Jos vihollisen piirros huojuu eikä laatikko, ne
   ovat eri mieltä — ja se on täsmälleen se vika joka `Walker`ista tänään
   päätettiin korjata **kasvattamalla piirros laatikkoon eikä kutistamalla
   laatikkoa piirrokseen**. Hengitys ei saa tuoda sitä takaisin. Vaihtoehtoja on
   kaksi: huojunta pysyy laatikon sisällä, tai laatikko liikkuu mukana ja
   **jokainen törmäys pelissä muuttuu**. Ensimmäinen on lähes varmasti oikein,
   ja syy on sama kuin `Walker`in kohdalla: kävelijä on se olio jonka
   muunnelmia kaikki muut ovat, joten sen laatikon liikuttaminen mitoittaa
   tallauksen uusiksi kaikkialla.
3. **Yhteinen huojunta, siirretty vaihe.** Sama funktio kaikille, olion
   sijainnista tai id:stä johdettu vaihesiirto. Kaksi vierekkäistä kävelijää ei
   saa olla samassa vaiheessa, ja saman olion vaihe ei saa hypätä kun se
   liikkuu.
4. **Kaikki elävä ei ole vihollinen, eikä kaikki liikkuva ole elävää.** Tiili ei
   hengitä. Raja vedetään siihen: hengitys kuuluu olioille jotka esittävät
   elävää — vihollisille, kasveille, pelaajalle — eikä ruuduille, lavoille tai
   koneille. Tehtaan koneisto saa liikkua, mutta se on mekanismi eikä henki, ja
   sen liike kuuluu palikan omaan animaatioon.

Suositus: yksi jaettu apufunktio piirtokoodin puolelle (`src/gfx/sprites.js`),
1 px:n amplitudi, vaihesiirto oliokohtaisesti, laatikot koskematta — ja
jaksonpituus säädettynä silmällä ennen kuin se kirjataan vakioksi.

### ✔ Tehty (v26.08.09.22): toisen tason seisonta-animaatiot

**Tehty.** Nukahtaminen, jääpuikkohengitys ja palava tukka, laukeavat 1200
framen jälkeen (sama kuollut aika kuin esittelytilalla) ja katkeavat yhdessä
framessa. ZZZ:n symboliluonne ratkaistiin: se kuuluu samaan kerrokseen kuin
`addScorePop`, eikä skaalaudu voimatason mukana.

#### Alkuperäinen kuvaus

Pelaajalla on jo seisonta-animaatio (hengitys) ja teemakohtaiset lisät
(väristys jäässä, hiki aavikossa). Omistaja haluaa **toisen tason**: isomman,
hitaammin laukeavan ja hauskan.

| teema | mitä tapahtuu |
| --- | --- |
| tavallinen | hahmo **nukahtaa**: pää nyökkii, animoitu ZZZ nousee |
| jää | hahmo **hengittää ulos jääpuikkoja** |
| aavikko | hahmon **tukka syttyy**, ja hän sammuttaa sen paniikissa |

Viisi asiaa jotka ratkaisevat onko tästä hauska vai rasittava:

1. **Kuollut aika ennen laukeamista on koko vitsi.** Lyhyellä silmukalla gägi
   lakkaa olemasta gägi ensimmäisen tunnin jälkeen. Mittatikku on jo olemassa:
   esittelytila odottaa alkuruudulla **20 sekuntia** ennen kuin kone alkaa
   pelata itselleen. Toisen tason seisonta saa olla vähintään sitä luokkaa, ja
   nykyinen hengitys jää ensimmäiseksi tasoksi joka alkaa heti.
2. **Sen pitää katketa yhdessä framessa.** Nämä lisäävät hiukkasia ja vievät
   katseen; jos vihollinen lähestyy nukkuvaa pelaajaa, animaation pitää loppua
   *heti* eikä sykliään loppuun. Sama vaatimus kuin esittelytilalla, joka antaa
   koneen takaisin yhdessä framessa, ja samasta syystä: pelaaja ei saa koskaan
   joutua tappelemaan animaation kanssa.
3. **Kolme ideaa eivät ole samaa lajia, ja se pitää päättää.** Jääpuikkohengitys
   ja syttyvä tukka ovat **huoneen tekoja hahmolle** — kylmä ja kuumuus
   toimivat, eli ne ovat diegeettisiä siinä merkityksessä jonka DESIGN.md kohta
   8 antaa. **ZZZ on symboli**, sarjakuvan konventio jota tämä peli ei ole
   toistaiseksi käyttänyt kertaakaan. Se on hyvä idea, mutta se on *uusi
   kuvakielen laji*, ei uusi animaatio — päätä se tietoisesti äläkä vahingossa.
4. **Ei saa vaikuttaa pelattavuuteen.** Osumalaatikko ei muutu, haavoittuvuus ei
   muutu, tukan palaminen ei vahingoita. Se on esitystä ja vain esitystä.
5. **Toimittava kaikilla viidellä voimatasolla ja neljällä tehostustyypillä.**
   Sama vaatimus jonka takia animaatiokierrokset ylipäätään käydään läpi: mikä
   näyttää oikealta yhdessä koossa hajoaa toisessa.

## Seuraavaksi

### 1. Kuvaefektit: jäljellä olevat efektit

Jälkikäsittely on tuotannossa (`src/gfx/postfx.js`, v26.08.08.21): bloom
luminanssikynnyksellä, skanviivat, vinjetti, kaareva kuvaputki ja värivirhe
shaderissa, esiasetukset näppäimessä 7, fallback testattuna ja efektipassin
aikabudjetti vahdittuna (2,5 ms, toteuma 0,35 ms). Miksi hybridi eikä koko
renderöijän uudelleenkirjoitus WebGL:llä, ks. muutosloki.

Jäljellä on makuasioita ja kohdistettuja efektejä:

1. **Palettisiirto tapahtumiin**: vahinkovälähdys, pomon huoneen sävy, tähden
   välkyntä. Shaderiin yksi uniform lisää; 2D-tilassa `globalCompositeOperation`.
   Vaatii että efekti voidaan ajastaa framen tarkkuudella pelilogiikasta.
2. **Aaltoilu veden alla** odottaa vedenalaisia kenttiä. Kuumuuden väreily ja
   huurre on tehty teemakohtaisina (v26.08.08.23), ja molemmat toimivat myös
   ilman WebGL:ää.
3. **Spritekohtaiset efektit eivät kuulu tähän tiedostoon.** Jälkikäsittely näkee
   vain valmiin kuvan eikä tiedä mikä pikseli oli mikäkin olio, joten kaikki
   "vain tämä sprite" -efektit tehdään piirtokoodissa. Meillä on tähän
   epätavallisen hyvä lähtökohta: spritet ovat proseduraalisia, eli ne piirretään
   kokonaislukusuorakaiteina nimetyillä väreillä eikä bittikartoista, joten värin
   vaihtaminen on parametri eikä kuvankäsittelyä.

   Sääntö: jos efekti koskee **yhtä oliota**, se kuuluu `src/gfx/sprites.js`:ään;
   jos se koskee **koko ruutua**, se kuuluu `postfx.js`:ään. Väliin ei jää mitään.

### 2. Telemetria ja palautesilmukka

Kerätään **vain anonyymiä**: kuolinpaikat, jumipaikat, ajat per kenttä, voimataso
kuollessa. Ei nimeä, ei pistetaulun nimimerkkiä — silloin yksityisyyslupauksia ei
tarvitse kirjoittaa, koska dataa ei voi yhdistää kehenkään.

Vaiheet:
1. ✔ Paikallinen kirjaus localStorageen + lämpökartta debug-ruutuun. Nolla infraa.
2. ✔ Vienti (näppäin 8) JSON-tiedostoksi, jonka voi syöttää generaattorille.
3. ✔ Generaattori lukee viedyn lokin: `--telemetry loki.json`. Kynnys on 5
   tapahtumaa samassa kohdassa JA 3 yritystä jotka päättyivät muualla.
4. **Palvelinlähetys: päätetty jättää tekemättä toistaiseksi** (9.8.2026).

   Kaksi syytä, joista jälkimmäinen on painavampi. Se rikkoisi "ei ajonaikaisia
   riippuvuuksia" -periaatteen: peli on staattinen sivusto, ja lähetys tarkoittaa
   funktiota ja tallennusta. Ja **oletuksena päällä oleva lähetys ei kelpaa
   tässä tapauksessa**: koko syy siihen ettei nykyinen keräys tarvitse
   suostumusikkunaa on se että data ei poistu selaimesta eikä sitä voi yhdistää
   kehenkään. Siirto palvelimelle muuttaa sen, EU:ssa valmiiksi rastitettu ruutu
   ei ole pätevä suostumus, ja peliä pelaa lapsi kavereineen.

   Käytännön puoli ratkaisi asian: **data ei ole pullonkaula.** Kourallinen
   pelaajia tuottaa generaattorin kynnyksen ylittävän aineiston paikallisesti
   muutamassa illassa, ja näppäin 8 saa sen ulos tiedostona ilman infraa ja
   ilman kysymystä. Jos peli leviää perheen ulkopuolelle, tämä harkitaan
   uudelleen — ja silloin **kysyen, oletus ei**.

Vaiheet 1–3 ovat käytössä ja riittävät: kirjaus, vienti ja generaattorin
luenta toimivat ilman että mitään lähtee selaimesta.

## Päätökset jotka sitovat

Nämä eivät ole tehtäviä vaan rajoja. Ne ovat täällä siksi että ne koskevat työtä
jota ei ole vielä tehty: jos joku ehdottaa ensi kuussa globaalia pistetaulua tai
kuilujen levennystä, perustelu löytyy täältä eikä muutoslokin arkistosta.

### Päätetty: haarautuva kartta, eriarvoiset haarat

Omistajan päätös 9.8.2026: **haarat ovat eriarvoisia ja vaikeudesta palkitaan.**
Ei siis makuvalintaa samalla vaikeudella, vaan helpompi ja vaikeampi reitti,
joista vaikeampi antaa jotain jota helpommalta ei saa.

Neljä ehtoa, joita ilman tästä tulee ansa eikä valinta:

1. **Vaikeus pitää näkyä kartalla ennen sitoutumista.** Pelaaja ei voi valita
   vaikeampaa reittiä jos hän saa tietää sen vasta kuoltuaan siihen. Meillä on
   `tools/difficulty.mjs`, joka antaa jokaiselle kentälle luvun — kartta voi
   näyttää sen tähtinä tai värinä, ja se on **mitattu eikä käsin arvattu**.
2. **Palkinnon pitää olla tiedossa etukäteen.** "Vaikeampi reitti antaa jotain"
   ei riitä; sen pitää lukea kartalla. Muuten kukaan ei valitse sitä toista
   kertaa.
3. **Helpon reitin pitää viedä läpi peliin.** Vaikeampi reitti saa antaa
   voimaa, oikoteitä ja sisältöä, mutta se ei saa olla ainoa tie loppuun.
   Sama lupaus kuin tehostuksilla: ne avaavat paikkoja, eivät kenttää.
4. **Palkinnon pitää olla sellainen jota ei saa muualta.** Lisäelämä on
   laimea. Murtava tehostus, tähtilohko tai oma kenttä on palkinto.

**Ehdot 1–3 ovat nyt graafin ominaisuuksia eivätkä muistettavia** (v26.08.09.13):
`worldProblems` hylkää kartan jossa jokin kenttä ei ole millään reitillä, jossa
haara on ilmoittamatta, jossa palkitsematon reitti ei vie läpi, tai jossa
palkinto ei ole mitatusti vaikeammalla reitillä.

**Jäljellä:** muut maailmat ovat yhä haarattomia. Koneisto on yleinen, ja rakenne
oli jo valmiiksi lähellä — kartta on solmuja ja linkkejä, ja `isLinkOpen` päättää
polun avoimuuden — joten lukitut polut ja oikoreitit ovat muuallakin pääosin
kenttädataa.

### Päätetty 9.8.2026: haaran palkinto ja vaikeuden näyttäminen

Vastaukset ehtoihin yllä, ja ne kytkevät kolme roadmapin kohtaa yhdeksi työksi:

- **Palkinto on murtava tehostus, jonka pudottaa minipomotaistelu**, ja
  **minipomo on sen ainoa lähde.** Taistelun sijoittaminen vaikeampaan haaraan ei
  siis luo ristiriitaa vaan poistaa sen: murtava tehostus, minipomo ja haarautuva
  kartta ovat yksi työ kolmen kilpailevan sijaan. Taistelu on myös helppo näyttää
  kartalla ennen sitoutumista.
- **Vaikeus näytetään kahdella tavalla yhtä aikaa:** haaran polku värjätään ja
  jokainen kenttäsolmu saa pisteet. Polku vastaa kysymykseen "kumpi on
  vaikeampi" siinä hetkessä kun valinta tehdään, pisteet kysymykseen "kuinka
  vaikea tämä on" kun perille tullaan. Väri yksin on heikoin kanava, joten
  pisteet ovat se mikä tekee värin turvalliseksi.
- **Haaran vaikeus on sen vaikein kenttä**, ei keskiarvo: kierroksen kaataa
  reitin pahin kenttä eikä sen keskiarvo. Haaran oma luku on sen sijaan helpoimman
  reitin luku — perustelut molemmille suunnille v26.08.09.13.

### Päätetty: pistetaulu ei mene palvelimelle, tulos menee linkkiin

Kysymys 9.8.2026: voisiko pistetaulu olla globaali? **Ei — tulos kulkee
jakolinkissä.** Tekninen puoli on helppo (Vercel on jo alla), eli päätös
tehdään muilla perusteilla, ja niitä on kolme:

1. **Pistetaulussa on nimi.** `NameEntryScene` kysyy sen, ja lapsi kirjoittaa
   siihen etunimensä. Globaali taulu lähettäisi sen ulos ja **näyttäisi sen
   vieraille** — eli sama päätös kuin telemetrian kohdassa 4, mutta raskaampi,
   koska julkisuus on tässä koko idea. Korjaus on sanalistasta valittava nimi,
   ja se on isompi työ kuin palvelin.
2. **Pisteet laskee selain**, joten globaali taulu on kunniajärjestelmä jossa
   on POST-osoite. Peli välittää taulun rehellisyydestä jo nyt: tilatallennus
   antaa tähden ja warpattu kierros ei pääse taululle lainkaan. Globaali taulu
   tekisi noista tarkistuksista koristeita.
3. **Se olisi ensimmäinen ajonaikainen riippuvuus** (DESIGN.md kohta 7) — eli
   ensimmäinen tapa jolla peli voi olla rikki ilman että kukaan koski koodiin.

**Tehdään sen sijaan:** tulos jakolinkin osoiteparametreihin
(`?s=45200&n=OLLI&l=2-3`), ja vastaanottajan alkuruutu kertoo mihin pitää yltää.
Ei palvelinta, ei tallennettuja nimiä, eikä huijaaminen ole ongelma jota
kannattaisi ratkaista — oman kehulinkin väärentäminen on itseään vastaan.
Jakoruutu on jo olemassa ja lukee osoitteen `og:url`-tagista, joten tämä on
laajennus eikä uusi ruutu. Jos globaali taulu joskus tehdään, se tehdään tämän
jälkeen ja paremmin tiedoin. Toteutettu v26.08.09.10.

### Peruttu 9.8.2026: kuilujen levennys uudelle hyppybudjetille

Maailmojen 1–4 uudistuksessa oli neljäs kohta, kuilujen levennys, ja se
peruttiin. Peruste oli lause "kuilut on mitoitettu vanhalle budjetille (6
ruutua), kun juoksuhyppy kantaa nyt 12,5". **Juoksuhyppy kantaa 9,7 ruutua.**
Luku 12,5 tuli `tools/jump-budget.json`ista, joka oli väärässä siitä commitista
asti joka sen kirjoitti.

Kentät eivät siis ole liian helppoja sillä perusteella jonka tämä kohta esitti,
eikä 22 kentän kuilujen levennys ole tasapainotusta vaan tuntemattoman suuruinen
muutos tuntemattomaan suuntaan. **Jos kentät joskus tuntuvat helpoilta, se
korjataan pelaamalla ja mittaamalla eikä laskutoimituksella joka on jo kerran
osoittautunut vääräksi.**

Muut kolme kohtaa on tehty (tehtaan pääntila, tehostuspalikka jokaisen kentän
alkuun, tyhjät laattapolut; v26.08.08.15), ja validaattori on puhdas kaikille
kentille — tästä eteenpäin sääntörikkeen ilmestyminen on regressio.

### Päätetty 9.8.2026: kuvaputki on oletusefekti

Pääsuunnittelijan valinta, ja **se oli jo oletus** (`postfx.js:333`, sama varalla
rivillä 387) — eli koodiin ei tarvittu muutosta, mutta valinta on nyt tehty eikä
peritty. Ero on se että sitä ei enää muuteta vahingossa.

### Omistajan palaute 9.8.2026

Kuusi asiaa kerralla, omistajan omin sanoin puhelimella pelatessa. Kirjattu
tähän kokonaisuutena, koska ne kertovat yhdessä jotain mitä yksikään niistä ei
kerro yksin: **peli on menossa muiden käsiin.** Jakoruutu, kosketusohjaus ja
törmäystuntuma ovat kaikki sitä samaa — ne eivät haittaa tekijää, joka osaa
pelinsä, vaan sitä joka saa linkin.

1. ✔ **Tauko jäi jumiin** debug-warpin jälkeen. Korjattu (`setScene` nollaa
   tauon). Diagnoosi ei ollut se mitä oire lupasi: tauko- ja debug-ruutu eivät
   kilpailleet mistään, vaan tauko jäi päälle kohtaukseen jossa sitä ei voi
   ottaa pois.
2. ✔ **Mobiili-Safari, kaksi vikaa.** Zoomiloukku ja ohjainten asettelu,
   molemmat korjattu (v26.08.09.8): kaksoisnapautuksen zoom kiinni ilman että
   nipistys menee mukana, ja uusi `rulla`-malli. **Kumpikaan omistajan
   ehdotuksista ei toiminut sellaisenaan**, ja jälkimmäisestä jää sääntö
   voimaan: kolmas virtuaalinappi olisi lisännyt tilan, ja tila on asia joka
   pitää oppia ja johon voi jäädä jumiin.
3. ✔ **Jakoruutu, kevyt toteutus** (v26.08.09.8). Kevyt tarkoitti tässä
   **selainpuolta ja vain sitä** — `navigator.share` ja leikepöytä, ei
   palvelinta. Sama peruste kuin telemetrian kohdassa 4, ja täällä vielä
   painavampi: pelaajat ovat lapsia.
4. ✔ **Törmäystuntuma.** "Laskeutuessa liikkuu vielä sivuttain, eikä ehdi
   väistää vihollista jota kohti on menossa." Mitattiin ennen kuin korjattiin,
   ja mittaus osoitti muualle kuin oire: syy oli ilmassa jarruttamisen ehto
   (v26.08.09.8). Sääntö joka jää voimaan: `PHYSICS.md`:n vakiot eivät ole
   vapaasti säädettävissä — ne mitoittavat koko pelin vaikeuskäyrän — joten
   "toimii kuten suunniteltu, tässä luku" on kelvollinen lopputulos
   pelituntumaa koskevaan valitukseen.
5. **Kahdeksan maailmaa ja kahdeksan kenttää kussakin.** Ks. *Kahdeksan
   maailmaa, kahdeksan kenttää kussakin* kohdassa Jonossa.

### Muut sitovat päätökset ovat omissa kohdissaan

- **Maahanisku tehdään, ja piikit voittavat sen** — ks. *Maahanisku* kohdassa
  Jonossa.
- **Pomo järjestää areenan uusiksi**, ei halvempaa laattojen irrottamista — ks.
  *Ruutuefektit ja neljännen seinän rikkominen*, kohta 4.
- **Telemetriaa ei lähetetä palvelimelle** — ks. kohta 2, vaihe 4.
- **Jokaiselle pomolle oma ääni, jaetut toimintaäänet** — ks. Myöhemmin.

## Kuolleiden lippujen auditointi 9.8.2026

Kolme kuollutta lippua löytyi päivän mittaan vahingossa, joten koko koodi
käytiin läpi (commit `1353654`). Työkalut jäivät istunnon mukana, mutta
löydökset ovat tässä.

**Oikaisu ensin, koska se oli minun virheeni:** `note`-lippu on kuollut, mutta
**nuottipalikka ei ole**. `bumpTile` kysyy `ch === T.NOTE` pitkin kirjaimin ja
asettaa `vy = -6.2` sekä soittaa `kick`in — palikka siis **pomppauttaa**.
Todennettu pomppaamalla kaikki neljä selaimessa. Se on sama tarina kuin ovella:
ilmoitettu lippu, pitkin kirjaimin kysytty kysymys, toimiva mekaniikka. Aiempi
väite "ei tee mitään" oli väärä.

### Taso A — kyky joka koodissa on ja jota peli ei koskaan pyydä

1. ✔ **Korjattu (v26.08.09.24): ruskea pilvi oli pysyvästi vihainen.**
   `drawStinkCloud(…, angry)` sai molemmilta kutsupaikoilta kirjaimellisen
   `true`:n, joten rauhallista naamaa ei piirretty koskaan eikä olion *oikea*
   `angry`-tila (kuplasta karannut, `ANGRY_SPEED` 1,6×) ohjannut sitä. Naama
   seuraa nyt oliota, ja kuolevakin pilvi piirtyy omalla tilallaan — §8, ei
   siisteys: kaksi samannäköistä merkkiä opettaa lukemaan väärin. Mitattu ero
   kahden muuten identtisen pilven välillä **0 px → 8 px**.
2. `drawNote(…, bumped)` saa kovakoodatun `false`:n. Kuollut haara elävän
   mekanismin takana — `drawTiles` siirtää palikkaa yleisellä bump-siirtymällä,
   joten liike näkyy silti.
3. `drawItem(…, opts)`:n `tint` ei tule yhdeltäkään pelin 11 kutsupaikasta,
   vain `verify.mjs`:stä.

### Taso B — seitsemän lippua lisää oven kaavassa

`TILE_INFO`:n oikeat kuluttajat ovat `solid, semi, climb, warp, door, bumpable,
question, switch`. Kuolleita: `note`, `breakable`, `pipe` (×6), `crumble`,
`coin`, `hazard` (×2), `goal`. Jokainen niiden nimeämä käyttäytyminen on
olemassa `ch === T.X`:nä. Pelaajaan ei vaikuta; hinta on se että ne näyttävät
elävältä.

### Taso C — siivousta (16 kpl)

`Game.pauseBlink`, tilatallennuksen `stamp`, `slotLabel` (ei yhtään kutsujaa),
`Music._section`, `KEY_PLAN`, `PostFX._program`, `Touch._zones`, `C.purple`,
`flat8` (ainoa kuollut palikka 88:sta), `CAUSES`, `RULE_CONSTANTS`, `MAP_W`,
`TRACK_NAMES`, `drawCrumble`in `tx/ty`, `warpLands`in `w`, `Sfx.oof`.

**Koe:** kaikki 34 ehdokasta poistettiin kerralla ja portti pysyi vihreänä.

### Mitä tällainen auditointi ei voi tietää

Repossa on 736 dynaamisen avaimen käyttöä ja `savestate.js` käy läpi jokaisen
olion jokaisen oman kentän, joten nimien törmäys eri olioiden välillä on se
vaikea osa — juuri se piilotti `note`n. Vihreä portti ei ole kattavuus, eikä
lukemalla erota "hylättyä" ja "ei vielä kytkettyä".

Ja auditointi teki itse sen virheen jota vastaan se varoitti: ensimmäinen
versio työkalusta luuli `this.life / this.maxLife`-lauseketta sijoitukseksi,
eikä käynyt oikeaa puolta läpi — kuusi itsevarmaa väärää löydöstä, kaikki
kenttiä joita luetaan joka framessa.

## Avoimet kysymykset

- ✔ **Putken suunta korjattu kenttiin asti 9.8.2026** (v26.08.09.23).
  `WARP_COMPAT` on poistettu; kaikki suut ovat rivillä 9, koska kolme tyhjää
  riviä lattian yllä on ainoa korkeus jota jokainen kuudesta koosta voi käyttää.
  `rules.js` osaa nyt suunnan ja kattoputki piirtyy oikein päin. Viisi
  bonushuonetta × kuusi kokoa todistettu ajamalla.


- **Vaikeusheuristiikka ei näe pomon liikesarjaa** (`b` on aina 5,0) eikä
  rytmiä. Suurin mallintamaton termi.
- **Kuusi kohtaa joissa isoin koko ei mahdu seisomaan**, kaikki samaa muotoa:
  `fort_blocks`in tiilihylly (rivi 9) ja sen yllä oleva holvi (rivi 6) jättävät
  väliin kaksi riviä kun tarvitaan kolme. Osuu kenttiin 1-F, 2-F ja 3-F.
  Validaattori ei huomauta siitä syystä joka on myös vastaus siihen onko se
  bugi: **hylly ei ole maareitillä**, alla oleva lattia on kuljettava, eikä
  kenttä ole missään koossa mahdoton. Isoin pelaaja vain törmää näkymättömään
  kattoon jos kiipeää sinne.
- **Yön paletissa tiili ja maa ovat lähes sama ruskea** (27,8 / 34 %, heikoin
  pari kaikista kuudesta teemasta). Uusi kuvakieli paransi eron joka teemassa,
  mutta tämä jäljelle jäänyt on **paletti eikä muoto**, joten se ei korjaannu
  teemakohtaisilla muodoilla vaan `night.brick`in ja `night.ground`in väreillä.

## Myöhemmin

- **Päätetty 9.8.2026: jokaiselle pomolle oma ääni.** Nyt niitä on yksi:
  `Sfx.play('boss')` soi kaikille neljälle linnakevariantille, nyrkkeilijälle ja
  jättiläiselle.

  **Ääni voi kertoa kuka tämä on tai mitä juuri tapahtui, ja ne ovat eri työt.**
  Päätös: **oma ääni, jaetut toimintaäänet.** Jokainen pomo saa oman äänensä —
  tulon huudon, murahduksen osumasta, kuolinparkaisun — omalla korkeudellaan,
  omilla formanteillaan ja omilla sanoillaan. Mutta iskuaalto, laskeutuminen ja
  piikit kuulostavat samalta joka pomolla, jotta "tuo tarkoittaa iskuaaltoa"
  opitaan kerran eikä kuutta kertaa. Tämä on sama sääntö joka on jo kirjattu
  maahaniskun kohdalla: kaksi samannäköistä "jotain tapahtui" -signaalia
  opettavat lukemaan väärää.

  Rakentuu konsonanttien päälle (ks. muutosloki): puheääni jolla on vain
  vokaaleja ei voi sanoa eri asioita, se voi vain huutaa eri korkeuksilla.
- **Lisää pomovariaatioita** — nyt neljä, ja 5-F on uusinta 4-F:stä.
- **Kenttäsäännöt käsintehdyille kentille pakollisiksi.** Nyt ne kaatavat ajon
  vain generoiduissa; kun maailmat 1–4 on korjattu, kytke sama koko peliin.
- **Nimen tavaramerkkiriski** ([DESIGN.md](DESIGN.md) kohta 2), jos peliä
  levitetään laajemmin tai siitä otetaan rahaa.

## Tiedossa olevat rajoitukset

- Botti `verify.mjs`:ssä osaa vain juosta ja hypätä, joten sen kuolemat
  vihollisiin ovat normaalia. Vain FAILURES-rivit merkitsevät.
- Pistetaulu on selainkohtainen (localStorage), ei jaettu laitteiden kesken.
- Rytmitilastojen louhinta vaatii ulkoisen korpuksen (`VGLC_DIR`), jota ei
  säilytetä repossa. Aja generaattori aina `VGLC_DIR` asetettuna, jotta
  samankaltaisuustarkistus on päällä.
- **Uusi ruutumerkki on kolme paikkaa eikä yksi.** `TILE_INFO`in lisäksi se pitää
  lisätä `src/data/rules.js`:n `SOLID`-joukkoon ja generaattorin sanastoon, tai
  validaattori lukee esimerkiksi murenevan lavan kuiluna ja generoi mahdottomia
  kenttiä.
