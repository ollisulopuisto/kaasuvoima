# Muutosloki

Versiointi on CalVer: `vVV.KK.PP.build`. Jokaisesta merkittävästä muutoksesta
kirjataan **mitä** tehtiin ja **miksi** — perustelu on tässä yhtä tärkeä kuin
muutos itse, koska se on myös se todiste siitä mistä mikäkin on peräisin.
Alkuperää ja tekijänoikeuksia koskevat periaatteet ovat [DESIGN.md](DESIGN.md):ssä.

---

## v26.08.10.48 — alkuperäistarkistus luki nolla tiedostoa ja tulosti puhtaan paperin

`tools/originality.mjs` on se tiedosto joka vastaa kysymykseen "onko se mitä
tässä repossa on nyt omaa". Ensimmäinen ajo oikealla korpuksella (TheVGLC,
omistajan pyynnöstä otettu vertailukohdaksi) tulosti **`0 osumaa`** — ja
samalla rivillä, pienemmällä, **`0 korpustiedostoa`**.

### Vika

Korpuksen luku oli `readdir(CORPUS_DIR)` ilman rekursiota. TheVGLC:n juuressa
ei ole yhtään `.txt`-tiedostoa: siellä on pelikohtaiset kansiot, ja kentät ovat
niiden sisällä (`Super Mario Bros/Processed/…`). Silmukka kävi siis läpi
kansionimiä, ei kenttiä, ja vertasi jokaista kenttäämme tyhjään joukkoon.

**Nolla osumaa nollaa tiedostoa vasten ei ole tulos vaan tuloksen puute.** Se
on vaarallisempi kuin punainen, koska se näyttää vihreältä: se vastaa
kysymykseen jota ei kysytty ("löytyikö osumia siitä mitä luin") sellaisella
sanamuodolla joka luetaan vastaukseksi siihen joka kysyttiin ("onko tämä
omaa").

Tiedoston oma yläkommentti oli kirjoitettu varoittamaan täsmälleen tästä:
tarkistus on olemassa siksi että ohje on *"the one kind of safeguard that
quietly stops being true"*. Varoitus toteutui varoittajaa itseään vastaan, ja
se on merkintänä arvokkaampi kuin korjaus.

### Korjaus, kaksi osaa

- `corpusFiles()` kävelee hakemistopuun läpi ja kerää jokaisen `.txt`:n
- olemassa oleva mutta kentätön `VGLC_DIR` **kaatuu** eikä palaa
  `checked: false`:na. Väärään paikkaan osoittava polku on eri asia kuin
  puuttuva korpus, ja se on virhe jonka tekijä haluaa kuulla heti — hiljainen
  "ei tarkistettu" luetaan siksi ettei korpusta ollut.

Toinen kohta on se joka estäisi tämän vian uusiutumisen. Ensimmäinen vain
korjaa sen.

### Mitattu tulos

**481 korpustiedostoa, 11 generoitua kenttää, 0 osumaa**, kahdeksan sarakkeen
ikkunalla. Sama luku kuin ennen korjausta, mutta nyt se on mittaus.

### Lisäksi

[IDEAS.md](IDEAS.md) sai kohdan **I. KAIVAUTUMINEN** — pystykenttä joka menee
alas, luumaailmaan. Kirjattu nyt eikä myöhemmin siksi että se on riippuvuus
eikä toive: pystykenttätukea rakennetaan parhaillaan pilvimaailmaa varten, ja
jos sivuttava kamera tehdään suuntaneutraalisti, alaspäin menevä kenttä ei
maksa uutta kameratyötä lainkaan.

---

## v26.08.09.47 — tehostukset piirretty uusiksi: muoto on ilmaisua

Poimittavat esineet (`src/gfx/sprites/items.js`) on piirretty kokonaan
uudelleen, ja mukana tuli neljä uutta porttia `tools/verify.mjs`:ään. Uusi
[DESIGN.md](DESIGN.md) kohta **1 c** kertoo säännön, tämä merkintä sen mitä
mitattiin.

### Ongelma: taulukon ensimmäinen rivi oli puoliksi katettu

DESIGN.md kohta 1 on aina sanonut että grafiikka on itse tuotettua, ja
teknisesti se piti paikkansa: jokainen pikseli piirretään ajossa
`fillRect`-kutsuilla eikä repossa ole kuvatiedostoja. Se ei silti ole koko
väite. Kohta 2 sanoo että suojattua on *nimenomainen ilmaisu* — ja ilmaisu on
se **mitä kuva esittää**, ei se millä työkalulla se maalattiin. Käsin
kirjoitettu `fillRect` joka piirtää jonkun toisen pelin tunnistettavan esineen
on kopio.

Esineiden nimet olivat omia (pierusieni, kaasulehti, hernekeitto); muodot eivät
olleet. `drawItem` piirsi lakillisen sienen valkoisine täplineen, silmällisen
kukan varressa, vaahteranlehden ja tähden. Konventio — yksi esine kasvattaa,
toinen antaa heitettävän, kolmas tekee hetkeksi haavoittumattomaksi — on vapaa
ja jää. Piirros vaihtui.

### Mitä tilalle, ja miksi juuri se

Rekisteri on pelin oma: kaasua, ruoansulatusta, sisuskaluja, samasta perheestä
kuin ummetuskorkki ja kurnuttaja. Jokainen muoto myös **selittää voimansa**:

- **pierusieni → tuhkelo.** Sieni joka on pelkkä itiöpussi ja reikä päällä; sitä
  puristamalla lähtee pilvi. Juuri sitä tämä tehostus tekee: sen antamat
  lisähypyt ovat puhalluksia venttiilistä. Ei lakkia, ei jalkaa, ei kasvoja —
  ja täplien tilalla **huokoset**, koska täplä on lakin päällä ja huokonen on
  reikä pussissa.
- **1-up → varapallo.** Solmittu ilmapallo. Vanha 1-up oli pierusieni vihreänä,
  eli sama piirros kahdella värillä; lisäelämä ja lisäosuma eivät ole sama asia.
- **pierukukka → torvikukka.** Kukka jonka terä on torven suu ja joka nojaa
  sivuun. Se on ainoa tehostus joka lähtee pelaajan kehosta ulos, joten esine
  on rakennettu aukon ympärille. Ei silmiä: silmät kuuluvat niille jotka
  kävelevät päälle.
- **kaasulehti → pavun parilehti.** Kaksi lehdykkää yhdessä varressa, kolme
  riviä eri korkeudella. Pari lukee siipinä, ja peli on jo täynnä papuja
  (pavunvarsi, paukkupapu, papuparooni).
- **hernekeitto → pata ja kauha.** Kulho oli ennestään oma keksintö mutta se
  jätti kahdeksan riviä laatikosta tyhjäksi ja oli vaalean taivaan väristä.
- **paukkupapu** säilyi — se oli jo tämän pelin muoto — mutta kasvoi laatikkoon
  ja sai halkeamaansa **läpinäkymättömän vihreän maltopinnan**.
- **tähti → virvatuli.** Suokaasu joka syttyy: sama aine kuin koko peli, ja
  suomalaista kansanperinnettä. **Metaani palaa sinisenä**, joten se on sininen
  — ainoa väri jota mikään muu tässä pelissä ei käytä. Neljä kärkeä ja tylpät:
  piikit tarkoittavat tässä pelissä muualla "tähän ei saa hypätä".

### Punainen ennen vihreää, ja mitä punainen sanoi

Testit kirjoitettiin ensin ja ne mittaavat kuvaa, eivät koodia. Vanhalla
grafiikalla:

| portti | vanha tulos |
| --- | --- |
| täyttää poimintalaatikkonsa (16x16, joka rivi ja sarake, ei ylivuotoa) | 6/7 esinettä rikki: keitto peitti 8/16 riviä, kukka 12/16 saraketta, lehti vuoti 1 px yli |
| kaksi esinettä eivät ole sama kuva | 8 paria alle rajan; kukka/lehti 29,7 %, **sieni/1-up 35,9 %** |
| ei katoa yhteenkään taustaan (8 teemaa + HUD + maalikortti) | lehti erottui aavikon maasta **0 pikselillä**, tähti ruohon tiilestä **0 pikselillä**, papu yön maasta 4 |
| hengittää pelin jaetulla kellolla | **0,00 px, seitsemän seitsemästä** |

Uudella: laatikko 44–61 % täynnä ja 16/16 joka framella, lähin pari
papu/virvatuli **50,4 %**, huonoin tausta keitto yön maata vasten **48 px**,
hengitys 0,31–0,63 px.

### Mistä raja 40 % tulee — kalibrointi pelin omaan grafiikkaan

"Näyttääkö tämä liikaa joltakin toiselta" on mielipide, joten se mitataan: kuinka
suuri osa 16x16 laatikosta **näyttää erilaiselta**, kun eri pikseliksi lasketaan
se jonka toinen maalaa ja toinen ei, ja se jonka molemmat maalaavat yli viidesosan
päässä toisistaan. Muoto ja väri yhtenä lukuna, koska pelaajalle ei kerrota
kumpi niistä kantaa eron.

Raja otettiin vihollisista, jotka pelaaja on jo osannut erottaa kentässä:
tiukin **laji**pari on piikikäs ja kurnuttaja **43,8 %**. Sama mittaus paljastaa
myös pelin löysimmän parin, eikä se ole virhe vaan tarkin mahdollinen kuvaus
siitä mitä tämä laatikko voi kantaa: **kävelijä ja lentäjä ovat 0,8 % erillään**,
koska laatikon sisällä lentäjä *on* kävelijä — siivet jotka erottavat ne on
piirretty laatikon ulkopuolelle. Portin raja 40 % on hiuksen verran sen alle
mitä peli jo puolustaa, ja vihollisluku mitataan joka ajolla uudestaan niin että
sen valuminen näkyy.

### Sivuvaikutus jonka piti tulla mukana

Maalikortti kasvoi 16x16:sta **20x20:een**. Esine on tasan 16 leveä, joten yhtä
leveä kortti jäi kokonaan piirroksen alle sillä hetkellä kun piirros lakkasi
olemasta pieni kuvio keskellä laatikkoaan. Neljä pikseliä marginaalia on sama
suhde joka HUDin varalokerolla on ollut alusta asti.

---

## v26.08.09.46 — kahdeksan kentän maailma: muoto päätetty, generaattori osaa kaikki teemat, maailmat 1 ja 3 tehty

Peli on nyt **8 maailmaa ja 44 kenttää** (oli 36). Maailmat 1 ja 3 ovat
kahdeksan kentän mittaisia, ja se muoto on päätös eikä kokeilu: se on kirjattu
tähän, se on portissa `tools/verify.mjs`:ssä, ja seitsemän puuttuvaa maailmaa
voidaan tehdä sen mukaan koskematta generaattoriin.

Tämä on **ensimmäinen vaihe kolmesta**: infrastruktuuri, muotopäätös ja kaksi
todistettua maailmaa. Maailmat 2 ja 4–8 (20 kenttää) ovat jäljellä ja ovat
tarkoituksella jäljellä — kahdeksan tekijää samassa generaattorissa yhtä aikaa
on se tapa jolla tästä tulee sotku.

### Päätös: kahdeksan kenttää on seitsemän numeroitua ja linnake, ja kävelyssä on kaksi hengähdystä

ROADMAP piti kysymystä auki näin: *"Kahdeksan kenttää maailmassa on eri muoto
kuin neljä. Nykyinen kaava on kolme kenttää ja linnake. Kahdeksan ei ole 'sama
kaksi kertaa' vaan tila välipomolle, haaralle ja hengähdyskentälle."*

**Muoto on: `W-1`…`W-7` ja `W-F`, ja seitsemän askelen kävelyssä on kaksi
notkoa.** Kolme perustelua, ja kaikki kolme ovat mitattavissa:

**Miksi ei kahta kaarta.** "Sama kaksi kertaa" tarkoittaisi kahta huippua, ja
kahden huipun maailma on kaksi maailmaa joiden välistä puuttuu linnake — pelaaja
lukee ensimmäisen huipun lopuksi ja saa jatkoa. Yksi maailma on yksi kaari
yhteen huippuun ja se huippu on linnake. Kahdeksan kenttää ei siis muuta kaarta
vaan venyttää sitä.

**Miksi kaksi hengähdystä eikä yksi.** Venytetty kaari on kuuden nousun putki.
Pelin pisin kiipeäminen tähän asti on **tasan kolme askelta** (maailma 8:
117 → 302 → 378 → 386), ja kaksi notkoa on pienin määrä joka pitää seitsemän
askelta sen mitan sisällä ilman että notkot ovat peräkkäin.

**Miksi ei haaraa ja välipomoa jokaiseen maailmaan**, vaikka ROADMAP ne
mainitsee. Molemmat ovat jo sidottuja päätöksiä: haaran pitää olla eriarvoinen ja
vaikeamman haaran pitää maksaa jotain jota ei saa muualta (omistajan päätös
9.8.2026), ja koko pelissä on **yksi** sellainen palkinto (`REWARDS.break`),
jonka **ainoa lähde on maailman 2 välipomo** — sekin omistajan päätös samalta
päivältä. Seitsemän uutta samanarvoista palkintoa keksittäisiin tässä vain muodon
täytteeksi. Haara ja välipomo pysyvät siis **maailman ominaisuutena eivätkä
muodon osana**: maailma 2 saa olla haarautuva myös kahdeksan kentän mitassa,
koska muoto puhuu askelista eikä kentistä (kahdeksan kenttää on seitsemän
askelta *jos* mikään niistä ei ole haara).

Uudet kentät tulivat **perään eivätkä väliin**, eli `1-4`…`1-7` ja `3-4`…`3-7`.
Se ei ole laiskuutta: `1-1`…`1-3` on pelin opetusjärjestys jota
`tools/curriculum.mjs` mittaa tunnisteittain, tallennus ja salaisuuslaskuri on
avainnettu tunnisteella, ja **piilotetut tiilet ovat sijainnin hajautus** — eli
kentän siirtäminen olisi arponut sen jokaisen salaisuuden uudelleen. Sama
peruste jolla `1-2`:ta korjattiin vaihtamalla eikä lisäämällä (v26.08.09.38).

### "Tasan yksi notko" ei sanonut kolmen askelen maailmasta mitään, ja se on nyt todistettu

Portti oli `dips !== 1`. Se vaihdettiin, ja **vaihto on tarkoituksellinen eikä
löysennys** — perustelu on todistus eikä maku:

> Kolmen askelen kävelyssä on **kaksi siirtymää**. Notkoja voi siis olla 0, 1 tai
> 2, ja kaksi notkoa tarkoittaa että molemmat siirtymät laskevat, eli viimeinen
> luku on ensimmäistä pienempi — jonka sama testin toinen puolisko (`rises`)
> hylkää jo. Maailmoissa 1–7 ehto `dips === 1` oli siis **merkki merkiltä sama
> ehto** kuin `dips >= 1`. Sana "tasan" ei kieltänyt mitään mitä `rises` ei jo
> kieltänyt.

Sanan ainoa oikea kohde oli maailma 8 (viisi askelta), jossa se sattui pitämään.
Ja seitsemän askelen maailmassa se olisi ollut **väärä** sääntö: se sallisi
täsmälleen yhden hengähdyksen kuuden nousun putkessa, kun ROADMAP pyytää
kahdeksalta kentältä nimenomaan tilaa hengähdyskentälle.

Tilalle neljä väitettä, ja jokainen luku on pelin oma:

| väite | mistä luku |
| --- | --- |
| käyrä nousee kokonaisuutena | ennallaan |
| vähintään yksi notko | vanhan sisältö kolmella askelella |
| ei kahta notkoa peräkkäin | pelissä **0** tapausta tänään |
| ei yli kolmen nousun putkea | pelin pisin on **tasan 3** (maailma 8) |

Sääntö kieltää sen mitä peli ei jo tee ja päästää läpi kaiken minkä se tekee.
Maailmoissa 1–7 se on merkki merkiltä sama kuin vanha; **maailmassa 8 se on
väljempi** (se sallisi toisen hengähdyksen), ja se on ainoa kohta jossa se on
väljempi. Sanottu tässä ääneen, koska hiljaa löysätty kynnys on juuri se asia
jota tämä repo ei tee.

Lisäksi oma porttinsa muodolle: **kahdeksan kentän maailmassa on kaksi
hengähdystä.** Se on tyhjä väite kunnes joku tekee tällaisen maailman, ja siksi
se on tässä — se sitoo maailmat 2 ja 4–8 ennen kuin niitä aletaan tehdä.

### Maailman 8 tunnistetesti oli epätosi rakenteeltaan, ja se vaihdettiin

`verify.mjs` väitti: *"viimeinen maailma on kuusi askelta, muut neljä"*. Väitteen
**toinen puolisko ei ollut maailman 8 ominaisuus lainkaan** vaan sen hetken
ominaisuus jolloin jokainen muu maailma oli kolme kenttää ja linnake. ROADMAPin
oma tavoite tekee siitä epätoden ensimmäisenä päivänä jona joku alkaa tehdä sitä
työtä, eikä maailmalle 8 tapahdu silloin mitään. Portti olisi kaatunut oikeasta
työstä, ja portti joka kaatuu oikeasta työstä sammutetaan.

Tilalle väite joka on **osuus eikä lukumäärä**: *viimeisessä maailmassa jokainen
askel on tappelu, muualla vain viimeinen.* Mitattuna w8 **6/6 = 100 %**, muut
1/n. Kun maailmat kasvavat kahdeksaan kenttään tämä väite **vahvistuu** eikä
heikkene — nimittäjä kasvaa, osuus pienenee, ja niin kävi jo tässä muutoksessa:
maailmat 1 ja 3 putosivat 25 %:sta 13 %:iin. Maailman 8 kolme muuta väitettä
(katto 100 %, 0 lippua / 6 ovea, jokainen pomovariantti) ovat koskemattomia,
koska ne eivät koskaan puhuneet muiden maailmojen kenttämäärästä.

### Generaattori tuntee kaikki kahdeksan teemaa, ja teeman ehto on portti eikä kommentti

`tools/gen-levels.mjs` osasi kolme palettia — ne kolme joita maailma 5 sattuu
käyttämään. Nyt se osaa kahdeksan teemaa, ja teema on tässä tiedostossa **kolme
eri asiaa**: mitä palikoita saa esiintyä (`weights`), mitkä lajit siellä asuvat
(`enemies`) ja **mitä valmiista ruudukosta on oltava totta** (`rules`).

Se kolmas on se joka puuttui. Maailmat 6, 7 ja 8 kirjoittivat itselleen
rakennesäännön ja jokainen niistä on portissa **palikkatiedostoa vasten** — mikä
riitti niin kauan kuin ne maailmat olivat käsintehtyjä, koska palikka on se
paikka jossa käsi tekee virheen. Generoitu kenttä ei kokoa palikoita vaan
kirjoittaa ruudukon, joten jokainen noista säännöistä olisi mennyt generaattorin
ohi ilman että mikään sanoo mitään.

| teema | ehto valmiille ruudukolle |
| --- | --- |
| ruoho, aavikko, yö, jää | taivas on auki: rivit 0–1 tyhjiä joka sarakkeessa |
| luu | taivas auki **viisi riviä** (kuu ja tähdet), ja jokainen `#`/`X` nojaa suoraan allaan olevaan |
| pilvi | mikään ei seiso maassa, eikä yksikään `-` ole tyhjän päällä (eli yksikään lauta ei silloita kuoppaa) |
| tehdas | katto joka sarakkeen yllä, riveillä 0–5 |
| linnake | kiveä joka sarakkeen yllä riveillä 0–1, eikä yhtään lippua |

Yksi noista riveistä on **mittaus eikä kopio**: tehtaan katto luetaan riveiltä
0–5 eikä 0–1, ja se on tahallista. Maailman 8 väite *"joka sarakkeen yllä on
kiveä"* mitataan riveiltä 0–1 ja sen lähin kilpailija on tehdas 57 %:lla.
Kattaisi generoitu tehdaskenttä rivin 0, maailman 4 osuus kiipeäisi kohti sataa
ja **finaalin väite lakkaisi erottamasta mitään** — ei siksi että maailma 8
muuttui vaan siksi että joku täytti maailman 4. Tehtaan kansi roikkuu siis
rivillä 2 ja alempana: sisätila jonka koneiston näkee.

Ja koska generaattori ei tällä hetkellä tuota yhtään luu-, pilvi-, tehdas- tai
linnakekenttää, **neljä ehtoa kuudesta olisi tarkistamaton lupaus**. Siksi
jokaisella teemalla on koekenttäpari: sama pohja, yksi ruutu eroa, ja portti
vaatii että ehto hyväksyy toisen ja hylkää toisen. Sääntö joka ei ole koskaan
hylännyt mitään ei ole sääntö.

### Kolme uutta säätönuppia, ja jokainen niistä on jonkin maailman oma mitattu luku

Ennen oli yksi, `intensity`, ja se liikutti kahta asiaa kerralla. Mittaus kertoo
miksi se ei riitä: maailman 1 käsintehdyt kentät kantavat **1,42 / 2,25 / 2,45
vihollismerkkiä sadalla sarakkeella** ja maailman 5 generoidut 12,2–13,6
*hintaa* sadalla — `intensity`llä ero olisi ollut jaettava viidellä, ja se jakaa
myös lepopituuteen, joten maailman 1 tiheydellä olisi tullut nelinkertainen määrä
tyhjää maata. Eri kenttä, ei loivempi kenttä.

- **`enemiesPer100`** on maailman oma mitattu tiheys, ja se osuu **molemmista
  suunnista**: generaattori täydentää alijäämän ja **karsii ylijäämän**.
  Karsiminen on uutta; ilman sitä luku olisi ollut lattia joka esittää tavoitetta,
  ja juuri niin maailma 1 olisi saanut maailman 5 vihollismäärän.
- **`maxGap`** on maailman levein hyppy ruutuina. Maailman 3 oma historia on
  perustelu: `3-1` oli maailmansa *vaikein* kenttä pelkästään siksi että kolme
  sen kuiluista oli budjetin reunalla, ja korjaus oli kenttä eikä mittari.
- **`minIntro`** on lattiaa ennen ensimmäistä haastetta, ja se on lattia siinä
  toisessakin merkityksessä. Louhittu luku (5–17 saraketta) on mitattu tavalliselta
  maalta. **Jää ei ole tavallista maata**, ja mittaus ei ole hienovarainen:
  ensimmäinen versio maailman 3 kentistä pani kuilun sarakkeeseen 17 ja seinän
  sarakkeeseen 22, ja voimatason 0 botti pääsi **5 % ja 7 %** läpi. Sama sanasto
  ruohikolla (maailman 1 neljä kenttää) meni läpi **100 %**.

Lisäksi `--world w1` ajaa yhden maailman kerrallaan, koska seuraavat tekijät
ovat eri maailmoissa eikä kenenkään pitäisi joutua generoimaan toisen työtä
uusiksi. Maailman 5 kolme kenttää ovat **tavu tavulta ennallaan**, ja se on
tarkistettu eikä toivottu: siemenen laskukaava, hiekkakuilujen astinkivet,
laavan sillat ja vihollisten karsinta on kaikki portitettu niin että vanha polku
kulkee entistä reittiä. Yksi asia melkein liikutti niitä — piikkikävelijä `x`
lisättiin jään lajilistaan, ja se yksin teki `5-3`:sta eri kentän. Poistettiin,
ja syy on kirjattu siihen listaan.

### Mitä `tools/playable.mjs` opetti, ja se on tämän päivän kallein oppi

Kahdeksan uutta kenttää eivät saa liittyä tunnettujen vikojen listaan
(DESIGN.md kohta 5). Ensimmäinen versio liittyi siihen kolmella kentällä, ja
korjaukset ovat kaikki yhtä ja samaa asiaa:

> **Botti ei osaa käyttää kelluvaa lautaa, joten lauta jota se ei osaa käyttää on
> huonompi kuin ei lautaa lainkaan.**

Kolme paikkaa joissa generaattori laski laudan puolitiehen:

1. **Astinkivi kuilun päällä.** DESIGN.md kohta 5 sallii sen sanatarkasti
   ("*tai siinä on astinkivi*"), mutta botille yhdeksän ruudun sillattu kuoppa on
   sama kuin ylittämätön. `3-7` kuoli sarakkeeseen 70. Maailma joka nimeää
   `maxGap`in ei enää silloita mitään — sama lause jonka maailma 7 jo maksoi.
2. **Ummetusportin astinkivi.** Se laskettiin aina, vaikka portin kuilu on
   rakenteeltaan hypättävissä. `1-4` kuoli sarakkeeseen 216 neljän ruudun
   kuoppaan jonka se ylittää ilman lautaa.
3. **Laavan silta.** Se oli kahden ruudun tynkiä joka kolmas sarake, mikä ei ole
   ylitys eikä sen puute: botti laskeutuu tyngälle, saa kaksi ruutua vauhtia ja
   putoaa laavaan. `3-6` kuoli sarakkeeseen 56 **kolme kertaa peräkkäin** — viiden
   ruudun altaalla, neljän ruudun altaalla, ja neljän ruudun altaalla ilman
   siltaa. Vastaus oli repossa jo: käsintehty `lava_gap` laskee **yhtenäisen**
   laudan koko altaan yli ja ruudun yli kummankin huulen, ja `3-3` — jossa niitä
   on kaksi, jäällä — menee läpi voimatasolla 0.

Ja yksi kokoluokkasääntö: **tappava ruutu rajataan ruutua tiukemmin kuin kuoppa.**
Kuopan kaukoreuna on huuli jolle voi raapaista hypyn jo mentyä, piikkirivin ja
laavalammikon kaukoreuna on lattiaa jonka *yli* on laskeuduttava. Mitattuna jäällä
tuo yksi ruutu on koko ero. Kumpikin oli ennen käsin valittu pari (3–5 piikkiä,
4–7 laavaa), mikä on juuri se mitä DESIGN.md kohta 3 kieltää — koko on tultava
mitatusta hyppybudjetista tai louhituista histogrammeista, ei mausta.

Lopputulos: **1-4…1-7 ja 3-4…3-7 menevät kaikki läpi voimatasolla 0, jokainen
100 %.** Tunnettu lista on ennallaan: `4-3` ei mene läpi edes tuplahypyllä, ja
`2-1`, `3-F` ja `5-F` vaativat sen.

### Maailman 1 sanasto on se minkä sen kolme ensimmäistä kenttää opettavat

Ensimmäinen versio neljästä uudesta kentästä käytti koko ruohopalettia, ja
`tools/curriculum.mjs` mittasi mitä se teki: **`1-4`:stä tuli pelin ensimmäinen
paikka jossa kohdataan kytkinruutu (sarake 119), lentäjä (130) ja ruskea pilvi
(108)** — kaksi paria niistä saman kahdenkymmenen laatan ruudun sisällä, mikä on
se yksi opetusjärjestyksen ehto joka on portti. `1-5`:stä tuli ensimmäinen
mureneva lava ja ensimmäinen nuottipalikka, `1-7`:stä ensimmäinen putkikasvi.

Kuusi mekaniikkaa siirtyi maailmaan 1 vahingossa, ja **neljä niistä on täsmälleen
ne neljä jotka `1-2`:sta oli samana päivänä tarkoituksella siirretty pois**
(v26.08.09.38), kappale perusteluineen kutakin. Generaattori joka purkaa päivän
toimitustyön hiljaa on huonompi kuin generaattori joka ei yllä niihin maailmoihin
lainkaan.

Maailma 1 pudottaa ne siis sanastostaan. Jäljelle jää se minkä `1-1`…`1-3` jo
opettivat. Mitattuna jälkeenpäin: **nolla uutta esittelyä kentissä 1-4…1-6**, ja
`1-7` esittelee yhden asian, paikan jossa maahaniskusta on hyötyä — mikä on
geometriaa jonka mittari löytää eikä mekaniikkaa jonka joku sijoitti. Koko pelin
turvaproxy palasi lukemaan **1/26** eli täsmälleen siihen mitä se oli ennen tätä
muutosta.

Pudotuslista on **vähentävä eikä salliva**, ja suunta on tarkoituksellinen:
salliva lista olisi jättänyt jokaisen uuden palikan hiljaa pois jokaisesta
maailmasta jolla lista on, eli sääntö rapautuisi siihen mitä palikoita sattui
olemaan olemassa sinä päivänä kun se kirjoitettiin.

### Kahdeksan solmua mahtuu kahteenkymmeneen sarakkeeseen, ja se on mitattu

Kysymys oli oikea. Laattapäivitys (v26.08.09.26) kasvatti kenttäsolmun leimaa
16×16:sta 20×21:een, ja hinta maksettiin sillä perusteella että kahden lähimmän
solmun väli millä tahansa kartalla on kaksi ruutua eli 32 px, josta 20 px:n leima
jättää **12 px** karttaa väliin.

Kymmenen solmua (alku, seitsemän kenttää, talo, linnake) ei muuta sitä lukua vaan
käyttää sen loppuun: molemmat uudet kartat on rakennettu niin että **jokainen
peräkkäinen pari on tasan ne kaksi ruutua**. Mitattuna piirretyistä pikseleistä,
`verify.mjs`:n omalla mittarilla: tiukin solmupari koko pelissä on yhä
`w2-3`/`w2-m` **12 px**:llä, eli uudet kartat eivät ole tiukempia kuin se joka jo
on tuotannossa — ne ovat yhtä väljiä koko pituudeltaan. Polun ja kaluston väli on
yhä **7 px** ja polun ja vieraan solmun **17 px**, kumpikin ennallaan.

Kartat eivät siis levenneet. Tie mutkittelee kahden rivin väliä, ja maailmojen 1
ja 3 tiet kulkevat eri korkeudella eri suuntaan — maailmassa 1 alhaalla ja
nousten, maailmassa 3 ylhäällä ja laskien — mikä on halvin tapa sanoa että nämä
ovat kaksi eri paikkaa. Kalusto istutettiin säännön 8 mukaan kuten maailmoissa
6–8: polun raivattu vyöhyke otettiin ensin pois. Maailmassa 1 **21 pyydettyä, 21
istutettua**, maailmassa 3 **14 ja 14**, nolla hylättyä kummassakin.

Yksi asia muuttui kasvamisen lisäksi: **maailman 3 hernetalo siirtyi tien varrelta
sivuun.** Ennen reitti kulki `3-2` → talo → `3-3`, eli talo oli pakko-osuus
keskellä maailmaa ja koko pelin ainoa sellainen; kahdeksan kentän mitassa se
olisi ollut pakko-osuus keskellä pidempää maailmaa. `tiersOf` kävelee talon läpi
kummassakin muodossa, joten vaikeuskäyrä ei liiku tästä lainkaan.

### Vaikeuskäyrä, ennen ja jälkeen

| maailma | ennen | nyt |
| --- | --- | --- |
| w1 | 125,6 | **111,3** |
| w2 | 148,7 | 148,7 |
| w3 | 174,6 | **171,8** |
| w4 | 189,4 | 189,4 |
| w5–w8 | 256,2 · 264,2 · 279,2 · 301,0 | ennallaan |

**Maailma 1 laski, ja se on tulos eikä vahinko.** Sen sanastolla — neljä
mekaniikkaa, kuiluja korkeintaan viisi ruutua kuudesta, ei murenevaa lavaa —
kenttä ei yllä yli **112**:n, kun sen oman linnakkeen luku on 220. Vaikeusmittarin
kaksi painavinta termiä ovat kuilut (0,30) ja tarkkuus (0,18), ja opetusmaailma
kattaa ensimmäisen ja jättää toisen ruokkimatta. Kahdeksan kentän maailma 1 on
siis **pidempi maailma 1 eikä kovempi**, ja se on oikea vastaus: se on yhä pelin
helpoin ja yhä maailman 2 alapuolella (111,3 < 148,7).

Muodot: w1 `70 → 115 → 98 → 104 → 77 → 95 → 112`, w3
`162 → 130 → 187 → 134 → 166 → 178 → 198`. Kaksi notkoa kummassakin, pisin nousu
kaksi ja kolme. Maailman 3 toinen hengähdys on `3-4` eikä myöhempi kenttä, ja
sekin on mittauksen seuraus: `3-3` on käsintehty huippu 186,5:ssä, eikä botin
kestävä jääsanasto voita sitä, joten hengähdys menee sinne missä pudotus jo on.

Kahdeksan kenttää osuivat tavoitteisiinsa **korkeintaan 1,8 pisteen päähän**
(104/78/96/112 ja 135/165/180/198 vastaan mitatut 104/77/95/112 ja
134/166/178/198). Tavoite on suunnittelupäätös joka tehdään ensin ja kirjoitetaan
tauluun; **siemen on ainoa asia jota haku liikuttaa**, ja jokainen ehdokas on
kenttä joka on jo läpäissyt kaikki säännöt — haku ei siis voi ostaa lukua
huonommalla kentällä.

### ALKUPERÄISYYSTARKISTUSTA EI VOITU AJAA, JA SE LUKEE NYT DATASSA

Tämä on tämän muutoksen tärkein varaus ja se on tässä ylhäällä eikä alaviitteessä.

`VGLC_DIR` ei ole asetettu tässä ympäristössä eikä korpus ole repossa — se on
DESIGN.md kohdan 3 alakohta 1 ja tarkoituksellista. Siitä seuraa että
generaattorin samankaltaisuustarkistus, joka hylkää kentän jos yksikään **8
sarakkeen ikkuna** osuu korpukseen, **ei voinut ajaa**. Kaikki yksitoista
generoitua kenttää — myös maailman 5 kolme, jotka aikanaan generoitiin tarkistus
päällä osumilla 0 — on kirjoitettu tässä ajossa merkinnällä `origin: 'not
checked'`. **Se ei tarkoita "ei osumia" vaan vastauksen puuttumista.**

Kolme asiaa tehtiin sen sijaan että olisi kirjoitettu kommentti:

1. **`tools/originality.mjs`**, oma moduulinsa ja oma komentonsa. Ennen tarkistus
   asui generaattorin sisällä, eli kysymykseen "onko se mikä on nyt committoituna
   alkuperäistä" ei voinut vastata **korvaamatta samalla vastausta** — piti
   generoida uusiksi. Nyt:
   `VGLC_DIR="…" node tools/originality.mjs` lukee `src/data/generated.js`:n
   sellaisenaan, tulostaa rivin per kenttä ja palaa nollasta poikkeavalla
   koodilla jos yksikin ikkuna osuu.
2. **Merkintä kulkee datassa.** Jokaisella generoidulla kentällä on
   `origin`-kenttä, generaattorin kirjoittamana eikä käsin.
3. **Portti joka väittää ympäristöstä ja tallenteesta yhdessä**, ja kaatuu
   molempiin suuntiin. Jos `VGLC_DIR` on asetettu kun `verify.mjs` ajetaan,
   korpus luetaan siinä ja siellä ja jokainen ikkuna verrataan — yksikin osuma
   kaataa, ja niin kaataa myös kenttä joka on merkitty `not checked` ympäristössä
   jossa tarkistuksen olisi voinut tehdä. Jos `VGLC_DIR` on asettamatta, portti
   vaatii että **jokainen kenttä kantaa merkinnän ettei sitä ole tarkistettu**, ja
   kaataa ajon jos jokin kenttä väittää olevansa tarkistettu.

**Miksi ei kaatavaa porttia tarkistamattomalle sisällölle.** Sellainen portti
olisi punainen jokaisessa ympäristössä jossa korpusta ei ole, eli tässä repossa
aina — ja tämä tiedosto sanoo muualla itse mitä pysyvästi punaiselle portille
tapahtuu: se sammutetaan. Pahempaa, se painostaisi merkitsemään kentän
tarkistetuksi jotta ajo menisi läpi, mikä on tasan se valhe jota vastaan koko
kohta 3 on kirjoitettu. Sen sijaan: **repo saa olla vihreä ilman korpusta, mutta
se ei saa väittää mitään ilman korpusta.**

**Omistajalle jäävä työ on yksi komento.** Aseta `VGLC_DIR` ja aja
`node tools/gen-levels.mjs`; jos se menee läpi, merkinnät vaihtuvat muotoon
`checked` ja `node tools/verify.mjs` samassa ympäristössä vahvistaa sen. Ennen
sitä yksikään tämän muutoksen väite ei koske alkuperäisyyttä.

### Mitä seuraava tekijä tarvitsee

- **Muoto on portissa.** Maailma jonka teet on seitsemän numeroitua kenttää ja
  linnake, ja kävelyssä kaksi notkoa. Älä keksi sitä uudestaan.
- **Järjestys on: generoi ensin, kytke kartalle vasta sitten.** `gen-levels.mjs`
  lataa `difficulty.mjs`:n, joka kävelee koko pelin — eli se kaatuu jos kartalla
  on solmu kenttään jota ei vielä ole. Generaattori sanoo sen suoraan.
- **Aja `--world wN`.** Muut maailmat jäävät koskematta, koska tiedosto
  kirjoitetaan kokonaan committoidun sisällön päälle.
- **Maailmojen 2 ja 8 muoto on eri kysymys.** Maailmassa 2 on haara, joten
  kahdeksan kenttää on siellä kuusi tai seitsemän askelta; maailma 8 tarvitsee
  neljä kenttää lisää ja jokaisen niistä pitää olla pomohuone — ja
  **generaattorissa ei ole areenapalikkaa**, mikä on nimetty puute eikä yllätys.
- **Kaksi lukua joita kannattaa varoa.** `w3 → w4` on nyt +17,5 ja `w4 → w5`
  +66,8; maailman 4 täyttäminen puristuu siis kapeaan väliin alhaalta.
  Ja maailman 4 katto-osuus (57 %) on maailman 8 väitteen lähin kilpailija —
  generoitu tehdaskenttä ei saa kattaa riviä 0.

---

## v26.08.09.45 — pöhö, pönttö ja nielu: kolme vanhinta vihollista omiksi

Pelin kolme ensimmäistä vihollista — ruskea mönkijä, kilpikonna kuorineen ja
putkesta nouseva kasvi — oli piirretty jonkin toisen pelin hahmojen näköisiksi.
Jokainen suorakulmio oli kyllä kirjoitettu tähän repoon käsin, mutta se ei ole
sama asia: [DESIGN.md](DESIGN.md):n kohta 2 sanoo että suojattua on nimenomainen
ilmaisu, ja tietty hahmo on juuri sitä. Ne on korvattu.

### Mitä ne nyt ovat

- **PÖHÖ** korvaa mönkijän. Kaasusta pullistunut suolipussi, solmittu kiinni
  päältä ja vuotava takaa. Se on pelin ensimmäinen vihollinen 1-1:ssä ja se
  ruumis jolla tallaaminen opetetaan, joten sen pitää näyttää siltä ettei se
  aio tehdä sinulle mitään: puolittain suljetut silmät, ei kulmakarvoja, ei
  kärkeä missään, ja kymmenen pikseliä tasaista solmua päällä. Solmu on myös se
  osa säkkiä joka on tarkoitettu avattavaksi.
- **PÖNTTÖ** korvaa kilpikonnan. Kalpea, sokea toukka joka asuu teräksisessä
  painesäiliössä. Tallattuna pää ja jalat menevät sisään ja jäljelle jää
  *esine* — kyljellään makaava tynnyri, ei kasvot missään, ja juuri se on koko
  "nosta minut ja heitä" -lukema. Potkaistuna se ei vieri koska joku työnsi
  sitä: se suihkuaa venttiilistään ja kylkiluut juoksevat ohi. Kahdeksan
  asentoa neljän sijaan, koska nelivaiheinen rullaus 3,4 px/frame -vauhdissa
  lukee välkkymisenä eikä ohi menevänä pintana.
- **NIELU** korvaa kasvin. Putki on tässä pelissä suoli, ja suolessa asuu
  kurkku: märkä, kylkiluinen, lähes musta tuubi jonka päällä on luuhampaiden
  kehä. Se ei ole kasvi eikä ollut koskaan.

### Mekaniikkaan ei koskettu, ja se on tarkoituksellista

Päälle hyppääminen, kuoreksi litistyminen ja kuoren potkiminen ovat
genrekonventioita eivätkä suojattua ilmaisua. Ne ovat myös se osa jonka varassa
puolet kentistä lepää — `hitByShell`, `shellSweep`, liukuvan kuoren
tiilenmurskaus ja `kickGrace` ovat ennallaan riviltä riviltä, eikä yhtään
osumalaatikkoa muutettu. Vaihdettiin substantiivi, ei verbi.

### Punainen ennen vihreää, ja se oli mitattava väite eikä makuasia

Kaksi uutta porttia `tools/verify.mjs`:ssä, molemmat kirjoitettu ja katsottu
punaisiksi ennen kuin yhtään pikseliä siirrettiin:

1. **"vihollisen ylälaita kertoo saako sen päälle hypätä."** Väite on että
   tallattavien ja tallaamattomien ylälaidat eivät mene päällekkäin, ja väliin
   jää vähintään neljä pikseliä. Punainen sanoi: **tallaamattomista levein oli
   kasvi 14 px** — koko vihollisjoukon levein tasainen laskeutumispinta 16
   pikselin laatikossa, leveämpi kuin kävelijän 10 ja yhtä leveä kuin se kuori
   jonka päälle nimenomaan kuuluu hypätä — kun taas tallattavista kapein oli 7.
   Populaatiot eivät olleet lähellä toisiaan vaan **nurin päin**, ja peli opetti
   1-2:ssa valheen niille jotka olivat juuri oppineet totuuden 1-1:ssä. Toinen
   tallaamaton, piikkiukko, mittasi 1. Nielu mittaa nyt 1 ja kolme kärkeä.

   Kärjet piirretään samalla `drawSpines`-funktiolla joka merkitsee piikkiukon
   ja pörhistyvän pomon — ei kopiolla siitä. Peli saa yhden sanaston sille että
   tähän ei lasketa, ja jokainen ylimääräinen murre maksaa yhden elämän.

   Kurnuttaja (6 px, 2 kärkeä) on **nimetty poikkeus eikä hiljainen aukko**: se
   elää kuopan pohjalla, pelaaja ei koskaan päädy sen yläpuolelle omasta
   tahdostaan, ja sen varoitus on `drawCroak`in kuplapatsas ilmassa kuopan yllä.
   Luku tulostetaan portin viestissä joka ajolla.

2. **"uudelleenpiirretty vihollinen erottuu jokaisen teeman maasta."** Ruuduilla
   on ollut teemakohtainen kontrastiportti pitkään, vihollisilla ei — väärin
   päin, koska maahan sulava tiili maksaa salaisuuden ja maahan sulava
   vihollinen maksaa voimatason. Sama mitta kuin ruuduilla (kanavakohtainen
   keskiero 255:stä), ja **kynnystä ei kirjoitettu käsin**: se lasketaan
   ajossa aavikon omasta maa/tiili-parista, eli heikoimmasta jonka peli jo
   hyväksyy (8,6 %). Punainen sanoi: **kävelijä 5,7 % yön maata ja 6,0 % ruohoa
   vasten, kasvi 6,9 % ruohoa vasten.** Pelin ensimmäinen vihollinen oli
   samalla sen huonoiten näkyvä, ruskeaa ruskealla, ensimmäisestä spritestä
   asti. Nyt pöhö 14,2 %, pönttö 11,8 / 14,6 %, nielu 12,1 %.

   Portti koskee toistaiseksi näitä kolmea (ja lentäjää, joka *on* pöhö
   siivillä), mutta mittaus koskee kaikkia ja loput tulostetaan pahimpine
   teemoineen: piikkiukko 3,3 % (tehdas), papuparooni 3,3 % (yö),
   ummetuskorkki 7,2 % (aavikko), ruskea pilvi 7,4 % (ruoho). Ne ovat
   löydöksiä joista joku päättää numero edessään, eivät asioita jotka portti
   siunaa.

Mittauksesta yksi asia kannattaa kirjata, koska se ohjasi väriä eikä toisin
päin: **keskiarvomitta rankaisee lämpimän ja kylmän sekoituksesta.** Säiliöllä
oli ensin messinkiset päädyt sinisellä rungolla, ja jokainen väri siinä oli
erikseen kunnossa — mutta puoliksi lämmintä ja puoliksi kylmää keskiarvoistuu
täsmälleen siksi harmaaksi jota tehtaan lattia on, ja luku oli **2,8 %**, pelin
huonoin. Teräs pitää koko spriten samalla puolella väriympyrää ja luku on 14,6.

### Mikä pysyi mitattavasti ennallaan

- **Osumalaatikot bitilleen.** Laatikkoauditointi tulostaa saman rivin kuin
  ennen: kattamatta walker 0, flyer 0, shell walking 1, shell 2, spikeguy 1,
  plant 1, corkguy 2, stink cloud 1, bean baron 0, kurnuttaja 0. Kävelijän
  nolla on se joka kasvatettiin sinne tarkoituksella, eikä uusi piirros
  kaventanut sitä.
- **Hengitys bitilleen.** naapurin ero / 4 px:n siirtymä: walker 19/8, shell
  walking 22/0, spikeguy 21/2, plant 22/2, corkguy 22/2, kurnuttaja 22/2 —
  samat luvut kuin ennen. Solmu on laatikon katto, tyngät sen lattia, ja
  hengitys liikkuu niiden välissä.
- Liukuva kuori pääsi laatikkoauditointiin, josta se oli puuttunut. Potkaistu
  kuori on se piirros jota pelaaja lukee kovimmassa vauhdissa.

### Löydetty, ei korjattu

Siluettien erottuvuus laatikon sisällä on **suorassa ristiriidassa**
laatikkokattavuuden kanssa: kun kaksi lajia jakavat 16×16-laatikon ja
molempien on täytettävä se joka framella, päällekkäisyys on pakotettu. Mitattu:
kävelijä vastaan kurnuttaja 87,5 % (IoU). Siitä ei siksi tehty porttia — se
olisi vaatinut toisen portin rikkomista. Ylälaita on se mitta joka jää
voimaan, ja se on myös se jonka pelaaja oikeasti lukee.

---

## v26.08.09.44 — sankarilta lähti lakki: haalari, kaasuletku ja viisi omaa asua

Pelaajahahmon ulkoasu on piirretty uusiksi. **Punainen pilkullinen lippalakki on
poissa**, ja sen mukana koko lainattu puvustus: paita ja housut, haalarin kaksi
kultaista nappia ja pesukarhun häntä korvineen. Tilalla on hiukset, yksiosainen
haalari, vyö jossa on messinkinen paineventtiili ja kaasulehden mukana tuleva
kaasuletku. [DESIGN.md](DESIGN.md):n kohta 1 kertoo saman lyhyesti.

### Miksi, ja mikä nimenomaan piti vaihtaa

Omistajan pyyntö oli poistaa lainatun näköiset spritet. Pelaaja on niistä isoin
ja se ainoa jota hän ei nimennyt, mikä on syy tehdä tämä huolella eikä varovasti.
Työ alkoi jaosta kolmeen, ja **vain ensimmäiseen ryhmään kosketaan**:

| ryhmä | mitä siihen kuului | tehtiin |
| --- | --- | --- |
| lainattua ilmaisua | lippalakki (lippa oli tasan vartalon levyinen), sienen punainen + valkoiset pilkut, paita/housut-jako, haalarin kaksi nappia, pesukarhunhäntä ja -korvat | vaihdettiin |
| genren kalustoa, ei kenenkään | ihminen jolla on pää, kädet ja jalat; kolmen framen kävely; kyykky; profiili | ei koskettu |
| jo tämän pelin omaa | syväseisonta (torkahdus + ZZZ, jääpuikkohengitys, palava tukka), hengitys, räpytys, raapiminen, hikipisara, värinä, ummetuskorkki, paukkupavun paletti | ei koskettu |

Hahmo tekee siis täsmälleen samat asiat kuin eilen ja näyttää samalta ihmiseltä
tekemässä niitä. Vaihtui se mitä hänellä on päällä ja minkä värinen hän on.

**Uusi asu tulee siitä mistä peli kertoo.** Hän laskeutuu suolistoon
Pieruprinssin perään, joten hänet on puettu työhön: haalari, vyö ja venttiili
josta paine pääsee ulos. Kaasulehti antaa häntäiskun, liidon ja lennon, ja
kaasupelissä se esine joka tekee kaikki kolme on **letku jonka päässä on
messinkisuutin** — sillä lyö ja siitä lentää. Eläimen häntä miehen takana on
puku, ja tässä genressä on tasan yksi puku joksi se luetaan.

Viisi voimatasoa ovat nyt viisi asua: haalari, vyö, housut ja hiukset vaihtuvat
kaikki. Perustelu on että **kaasu näkyy hänessä** — tasot eivät ole vaatekaappi
vaan se paljonko häntä on paineessa. Sienen valkoiset pilkut jäivät ideana
(tehostuksen merkintä näkyy kantajassaan on tämän pelin oma tapa) mutta
muuttuivat **kaasukupliksi haalarissa**.

### Punainen ennen vihreää, kahdella mittarilla

Taidemuutoksen rehellinen punainen on mitattava väite, ja tässä niitä on kaksi.
Molemmat kaatuivat vanhalla piirroksella:

1. **Pää saa olla enintään neljä pikseliä osumalaatikkoa kapeampi.** Lippa on se
   asia lakissa joka on leveämpi kuin kallo jonka päällä se on, ja tässä
   piirroksessa se oli tasan koko hahmon levyinen: **12 px 14:n vartalolla ja
   10 px 12:n vartalolla**, kruunun ollessa 9 ja 8. Sääntö on leveydestä eikä
   väristä, koska vihreäksi maalattu lippalakki on yhä lippalakki. Uudet luvut
   ovat **9 px ja 7 px**.
2. **Lähimmätkin kaksi voimatasoa eroavat vähintään 45 % hahmon omista
   pikseleistä.** Vanha taulukko vaihtoi sienestä vain lakin värin, eli kaksi
   viidestä tasosta oli sama piirros hattu maalattuna: **28 % pienimmällä koolla
   ja 23 % suurimmalla**. Uudet luvut ovat **53 % ja 57 %**.

Vanhat portit pysyivät vihreinä eivätkä ne ole tässä koristeena: sprite ei
hajoa palasiksi yhdessäkään asennossa millään voimatasolla (0 rikki), mikään
asento ei vuoda ulos laatikostaan (0 vuotoa), kävely kulkee edelleen
ohitusasennon kautta ja kaikki hengittää. Osumalaatikoihin ei koskettu yhtään
pikseliä — `PLAYER_SIZES` ja `PLAYER_DUCK_SIZES` ovat rivilleen samat.

### Yksi vanha virhe joka löytyi matkalla

Vanha `capSpots` piirsi kolme pilkkua joista **kaksi oli päällekkäin** ja kolmas
kruunun reunan ohi: pienellä koolla se roikkui kokonaan lakin sivulla ja
suurella yhden pikselin verran. Se oli ollut siellä niin kauan kuin pilkkuja on
ollut. Uusi merkintä lasketaan sen paneelin mitoista johon se piirretään, joten
sama kolme kuplaa osuu sekä seisovan 10x4-rinnuksen että kyykyn 12x3:n päälle.

---

## v26.08.09.43 — kartta saa vieriä, ja kamera joka ei keinuta

Maailmankartan maastoruudukko saa olla näkymää leveämpi, ja näkymä seuraa
pelinappulaa vaakasuunnassa. Tämä on **kyvykkyys eikä sisältömuutos**: yhtään
maailmaa ei levennetty tässä, ja jokaisen laivatun kartan kuva on pikselilleen
sama kuin ennen.

### Ongelma

Ruudukko on ollut tasan näkymän kokoinen — 20x9 laattaa eli 320x144 px — joten
kartta ei ole koskaan joutunut vierimään. Kun jokaiseen maailmaan halutaan
kahdeksan kenttää, kahdeksan solmua, niiden polut ja **säännön 8 raivaama
käytävä** (`worldProblems`: mitään korkeaa ei saa seisoa polulla eikä sen
neljällä naapuriruudulla) eivät mahdu kahteenkymmeneen sarakkeeseen. Este on
siis kartta eikä kenttädata, ja este poistetaan täältä.

### Kamera: mikä perittiin `level.js`:ltä ja mitä ei

Kenttäkameran perustelu on tämän repon harkituinta proosaa, ja siitä otettiin
kaksi kohtaa kolmesta:

| kenttäkameran sääntö | karttakamera | miksi |
| --- | --- | --- |
| **kuollut alue** | peritty, 96 px | pieni liike ei liikuta ruutua — ja se on myös se mikä estää mutkan heiluttaman nappulan keinuttamasta näkymää |
| **ei hitausmassaa** | peritty | siirtymä tehdään kokonaan sillä framella jolla se mitataan, joten näkymä pysähtyy samalla framella kuin nappula |
| **leikkaus saapumisessa** | peritty (`snapCamera`) | `centerCamera`in vastine: saapumisessa ei ole "mistä pehmentää" |
| **ennakointi (look-ahead)** | **hylätty** | kartalla ei tähdätä: siirto valitaan yhdellä painalluksella, kohde on jo piirretty, ja kahden laatan loikka kestää 23 framea. ~30 framessa rakentuva kallistus olisi yhä asettumassa kun nappula on jo perillä — se on hitausmassa toisella nimellä |
| **pystyakselin säännöt** | **hylätty** | pystyvieritys on eri ominaisuus omine kysymyksineen; `worldmap.js`:n yläkommentti luettelee ne kolme ehtoa jotka pitäisi ratkaista ensin |

96 px on mitattu eikä valittu: nappula pysyy 96 px:n sisällä 320 px:n ikkunan
keskeltä, eli menosuunnassa on aina vähintään 64 px karttaa näkyvissä. Pisin
loikka kahden solmun välillä on kolme laattaa (48 px) ja solmun leima ulottuu
11 px keskipisteestään — 59 px on siis se mitä seuraavan solmun näkeminen vaatii
ennen kuin siltä jolla seisoo lähtee pois.

### Vieritys ei ole tallennustiedostossa, ja se on päätös

Kameran paikka **johdetaan** nykyisestä solmusta (`snapCamera` `sync`istä), eikä
sitä kirjoiteta `sfb3.save.v2`:een eikä pikatallennukseen. Syy on että
tallennettu johdettu arvo on toinen totuus samasta asiasta: se voi olla eri
mieltä kuin `state.node`, ja silloin kartta saapuisi väärään kohtaan ja
liukuisi oikeaan. Nyt jokainen saapuminen — maailmaan tulo, kentästä paluu,
tallennuksen lataus, uuden pelin ensimmäinen frame — rakentaa kohtauksen
uudestaan ja saapuu suoraan oikeaan kohtaan.

### Mitattu

Punainen ennen vihreää (DESIGN.md 7). Testimaailma `wL` (30 saraketta, kahdeksan
kenttää, linnake sarakkeessa 28) lisättiin `verify.mjs`:ään, ja se sanoi:

| väite | ennen | jälkeen |
| --- | --- | --- |
| kaukaisin solmu näkyy | 0 px mustetta (leima x=400, näkymä 0..320) | 308 px, näkymä 160..480 |
| nappula pysyy ruudulla | 25.4..**459.0** px | 25.4..299.0 px |
| ulkopuolista ei piirretä | solmu 13 + linkki 27 fillRect-kutsua | 0 ja 0 |
| leveämpi maasto ei maksa | 30 saraketta 105, 60 saraketta 209 kutsua | 69 ja 69 |
| leima liikkuu vieritettäessä | vasen reuna 206 kaikilla vierityksillä | 206 / 169 / 110 / 46, muste 308 px joka kerta |

Kellotettuna, mediaani yhdeksästä 400 framen erästä, `drawTerrain`:

| sarakkeita | ennen | jälkeen |
| --- | --- | --- |
| 30 | 0.168 ms | 0.163 ms |
| 60 | 0.206 ms | 0.179 ms |
| 120 | 0.282 ms | 0.171 ms |

Eli piirtotyö oli kartan levyinen ja on nyt näkymän levyinen. Kapea kartta
maksaa 0.04 ms enemmän kuin ennen (16.7 ms:n framesta), koska muunnos tehdään
myös silloin kun se on nolla — se on tarkoituksellista, ks. `camX()`.

Ja se mikä ei muuttunut: **kaikkien kahdeksan maailman kaikkien solmujen kuva
kolmella eri tickillä on tavulleen sama** kuin ennen muutosta (52 hajautusta,
kaikki identtisiä). Kapea kartta ei vieri pikseliäkään, ja se on portissa.

---

## v26.08.09.42 — viimeinen linnake, ja finaali joka ei ole neljäs kenttä

Maailma 8, **VIIMEINEN LINNAKE**: kuusi kenttää, kuusi tappelua, ei yhtään
lippua. Peli on nyt **8 maailmaa ja 36 kenttää**, teemalista on täysi eikä
siihen tullut riviä, ja [ROADMAP.md](ROADMAP.md):n "kahdeksan maailmaa" -kohdan
viimeinen avoin asia — paljonko tehdään käsin — on tältä osin ratkaistu
tekemällä.

### Ongelma, ja se ei ole "tehdään linnakemaailma"

Omistaja pyysi finaalin joka **lukee finaalina eikä maailmana 7 eri paletilla**.
Se on ankarampi vaatimus kuin miltä kuulostaa, koska maailma 8 on ainoa maailma
tässä pelissä jolla ei ole omaa teemaa: linnake on ollut `THEMES.fortress`
alusta asti ja sitä on käytetty seitsemän maailman viimeisessä kentässä. Uusi
paletti ei ole vaihtoehto — se muuttaisi valmiiden kenttien ulkonäön — joten ero
on tehtävä jossain muualla tai sitä ei ole.

Se muu paikka on **muoto**, ja muoto on mitattavissa. Kaava on ollut seitsemän
kertaa kolme kenttää ja linnake. Tässä se rikotaan:

> **linnake lakkaa olemasta viimeinen kenttä ja alkaa olla koko maailma.**

Kuusi kenttää, jokainen sisätilaa, ja **jokainen niistä päättyy tappeluun**.
Ainoa ulospääsy joka huoneesta on se mikä siinä seisoo. Neljä väitettä, ja
jokainen niistä on `verify.mjs`:ssä numeroineen, koska väite muodosta on
täsmälleen sitä lajia joka voi olla väärässä kaiken näyttäessä valmiilta:

| väite | maailma 8 | muu peli |
| --- | --- | --- |
| askelia (`tiersOf`) | **6** | 4, myös haarautuvassa maailmassa 2 |
| kattoa sarakkeista | **100 %** | 10–57 %, lähimpänä tehdas |
| lippuja / ovia | **0 / 6** | 3 / 1 |
| eri pomoja | **6** | 1 |

Nollatestinä on joka kohdassa muu peli. Jos luku olisi sama kaikkialla, väite ei
erottaisi mitään ja testi olisi koriste — sama peruste jolla pilvimaailma
mittasi lattiansa bonushuonetta vasten.

### Miksi pomokierros, eikä esimerkiksi kaikkien mekaniikkojen kavalkadi

Kolme muotoa oli oikeasti tarjolla: gauntlet-kenttä joka lainaa jokaista
mekaniikkaa, neljä linnaketta vanhoissa mittasuhteissa, tai pomokierros.
Pomokierros valittiin siksi että se on niistä ainoa joka tekee finaalista
kertomuksen **edeltävästä pelistä** eikä itsestään. Jokainen tappelu on tappelu
jonka pelaaja on jo voittanut kerran, ja maailman lause on että linnakkeella ei
ole enää mitään uutta lähetettävää — se lähettää kaiken minkä on jo lähettänyt.

Järjestys on se jossa ne tavattiin (variantit 0, 1, 2, 4, 5) **paitsi jättiläinen,
joka siirrettiin viimeiseksi.** Hänet tavattiin neljäntenä (4-F) ja uudestaan
viidentenä (5-F), joten tiukka järjestys olisi jättänyt hänet keskelle ja
lopettanut sääherraan. Hän on lopussa koska hän on pelin ainoa pomo joka tarvitsee
eri huoneen: hän kasvaa puoli kokoa per tallaus, viimeiset kaksi osumaa ovat
voimatason 0 hypyn ulkopuolella, ja `boss_arena_big`in kannet ovat vastaus.
Finaali joka päättyisi tappeluun jonka vanha areena vetää, päättyisi pienempään
huoneeseen kuin se mistä tultiin.

### Kolme sääntöä, ja kaikki kolme ovat mittoja

**1. Ei ulkopuolta.** Luulaakson ehto oli "taivas on auki", pilvimaailman
"mikään ei seiso maassa"; tämä on niiden kolmas ja molempien vastakohta:
jokaisen sarakkeen yllä on kiveä, ensimmäisestä ruudusta viimeiseen. Siitä
seurasi yksi asia jota ei osannut odottaa: **pelin jokainen linnake on tähän
asti alkanut kuudellatoista sarakkeella taivasta**, koska jaettu `start`-palikka
jättää kaksi ylintä riviä tyhjäksi. Yhden kentän huoneessa sitä ei huomaa;
maailmassa joka väittää olevansa sisätila se on reikä väitteen läpi. Siksi
`keep_start`.

Vertailuluku sanoi toisenkin asian: **tehdas on 57 %.** Maailma 4 on sisätila
kolmessa kentässä neljästä, eli pelkkä katto ei erota mitään. Väite on siis sata
vastaan viisikymmentäseitsemän eikä sata vastaan nolla.

**2. Tiili ei kosketa kiveä.** Tämä on se velka jonka ROADMAP kirjasi maailmaa 8
varten: linnaketeeman tiilen ja maan ero on **7,9 %**, koko pelin toiseksi
huonoin heti yön 0,4 %:n jälkeen. Mitattuna uudestaan tässä työssä, samalla
koodilla kuin luuteeman oma testi: 7,9 %, ja sija on yhä toinen. Uusi paletti
ei ollut vaihtoehto, joten vastaus on rakenteellinen — kaksi lähes samanväristä
ruutua jotka eivät ole koskaan vierekkäin, ei tarvitse erottaa toisistaan. Tässä
maailmassa tiili leijuu ja kivi ei, ja ero luetaan paikasta eikä väristä.
Hinta on todellinen ja se on se mikä tekee tästä säännön: `brick_wall`in
kaltainen lattialta nouseva tiilipino on kielletty rakenne. Mitattuna
kosketuksia maailmassa 8 **0**, muualla pelissä **14**.

**3. Jokaisen kuilun edessä on yhdeksän saraketta lattiaa.** Luulaakso mittasi
syyn ja kirjoitti sen kommenttiin: seisova hyppy kantaa **0 px** sivusuunnassa,
joten laskeutuminen on täsmälleen niin hyvä kuin se vauhdinotto jonka se jättää.
Maailma jonka jokainen kenttä on käytävä ja jonka jokainen kuilu on laavaa on
juuri se paikka jossa tuo lakkaa olemasta ohje: jaettu `fort_gap` tuo mukanaan
vain neljä saraketta lattiaa ja `keep_forge` viisi, joten kumpikaan ei saa
seurata reikää eikä toista kuilua. Sääntö saneli kaikkien kuuden kentän
palikkajärjestyksen, ja se on portissa: ahtain kuilu maailmassa 8 on **9**,
muun pelin ahtain **0**.

### Mitä botti opetti, ja se on eri asia kuin mitä sääntö tiesi

`8-3` kaatui läpäisytestiin **sarakkeessa 105**, vaikka sääntö 3 luki sen
kohdalta yhtenäistä lattiaa kolmenkymmenen sarakkeen verran. Syy on se mitä
ruudukko ei kerro: edellinen palikka oli `keep_stair`, ja pelaaja tulee sen yli
**portaita pitkin** eikä lattiaa pitkin. Lattia oli ehjä, mutta kukaan ei
kävellyt sillä. Portailta pudotaan neljä saraketta ennen laavan huulta, ja se on
vauhdinotto jota ei ole.

Korjaus on kentän palikkajärjestys eikä palikka: porras siirrettiin kuilun
*jälkeen*. Kirjattu tänne siksi että sääntö 3 on nyt tiedettävästi vajaa —
**se lukee lattiaa eikä reittiä** — ja seuraava kenttä joka nostaa pelaajan
maasta juuri ennen kuilua kaatuu samalla tavalla ilman että mikään sanoo miksi.

### Musiikki: Mussorgski, Rimski-Korsakov, ja portti joka luki puolet

Raita `autiovuori` on **Modest Mussorgski** (1839–1881), *Yö Autiovuorella*
(1867), **Nikolai Rimski-Korsakov**in (1844–1908) sovituksena (1886). Sävellys
vapautui 1.1.1952 ja sovitus 1.1.1979 (tekijänoikeus = tekijän elinaika + 70
vuotta). [DESIGN.md](DESIGN.md):n kohta 1 b sanoo millä ehdoilla vapautunut
sävelmistö saa tulla sisään: **sävelet kirjoitetaan käsin** `TRACKS`-tauluun ja
syntetisoidaan ajossa — ei sampleja, ei MIDI-rippiä, ei skannattua nuottia,
koska vapautuminen koskee sävellystä ja yksittäinen äänite tai nuottilaitos on
eri teos omine oikeuksineen — ja **lähde nimetään** sekä siihen dokumenttiin
että tähän. Sama varaus kuin luulaaksossa: tämä on sovitus eikä transkriptio,
kolme ääntä ja rummut eivät ole orkesteri, ja aiheet on kirjoitettu
korvakuulolta eikä mistään laitoksesta.

Aihevalinta on ainoa peruste jolla tässä pelissä on lainattu, ja se pätee tässä
paremmin kuin kertaakaan aiemmin: teos *on* yksi yö pahojen vuorella, ja se
loppuu siihen että kello soi ja aamu tulee.

**Portti luki tähän asti puolet tapauksista.** `verify.mjs` vaati `composer`in
ja `work`in molempiin dokumentteihin — eli raita olisi voinut kantaa
`arranger`-kenttää jota mikään ei tarkista. Se on täsmälleen se vika joka
löytyi `cave`sta kerran jo (portti ei nähnyt raitaa lainkaan), eli kahdesti
tehtynä se ei ole huolimattomuutta vaan puuttuva tarkistus: portti lukee nyt
**jokaisen** `source`-kentän. Sukunimi ei riitä, koska DESIGN.md:n taulukossa
lukee nyt Nikolai Rimski-Korsakov ja portti vaatii sen merkkijonon.

**Ja yksi asia teoksesta on datassa eikä selityksessä: yö on mollissa, aamu on
duurissa.** Fraasit 0–2 ovat yö eikä yhdessäkään niistä ole duuriterssiä (F#);
fraasi 3 on aamu eikä siinä ole molliterssiä (F) kertaakaan. Yksi F# yössä ja
käänne on koriste, koska duuri oli jo käynyt; yksi F aamussa ja aamu on vain
hiljaisempi yö. Kumpikaan ei kuulostaisi rikkinäiseltä vaan latteammalta, mikä
on juuri se vika jota kukaan ei osaa etsiä. Mitattuna: yössä molliterssi 8
kertaa ja duuriterssi 0, aamussa duuriterssi 2 ja molliterssi 0.

Siitä seurasi säestys: **harmoniassa ei ole terssiä lainkaan.** Sekvensseri
vaihtaa fraasia joka kierroksella mutta soittaa saman `harm`in läpi koko raidan,
joten mollisointu aamun alla rikkoisi käänteen samalla nuotilla jolla se
tehdään. Paljas kvintti kantaa molemmat, ja se on lisäksi vanhempi ja karumpi
ääni kuin kolmisointu. Sekin on portissa.

**`bossMusic`, ja se on yksi rivi moottoria yhtä kenttää varten.** Peli soittaa
`boss`-raitaa niin kauan kuin tappelu on kesken, joten kuuden tappelun
maailmassa `music:`-rivi päättäisi lähes tyhjää — teos kuuluisi käytävillä ja ei
missään muualla. Siksi `8-F` kantaa `bossMusic: 'autiovuori'`: se on pelin ainoa
tappelu jota ei säestä pomoteema, ja samalla ainoa jonka musiikki ei vaihdu kun
se päättyy. Peruste on teoksessa itsessään — se on yö joka kovenee kunnes kello
soi ja aamu ottaa saman sävellajin suurena — ja sen katkaiseminen juuri
ratkaisuhetkellä olisi lopun heittämistä pois kahdesti.

### Kartta

Kuusi solmua eikä kolme, ja sen näkee ennen kuin yksikään kenttä latautuu.
**Hernetalo on portin ulkopuolella**, kiinni aloitussolmussa eikä ensimmäisessä
kentässä niin kuin joka toisessa maailmassa: tässä maailmassa ei ole ulkoilmaa
8-1:n jälkeen, joten mökki kahden huoneen välissä olisi ainoa asia kartalla joka
on eri mieltä kuin huoneet. Ota se ennen kuin menet sisään, tai älä ollenkaan.

Kaksi uutta karttamerkkiä: `w` kivilaatta (litteä, tien alle) ja `A`
rintavarustus, joka menee `TALL_TERRAIN`iin ja siis säännön 8 piiriin. Ruudukko
rakennettiin säännöstä ulospäin kuten maailmoissa 6 ja 7 — tien raivattu vyöhyke
otettiin ensin pois ja tornit istutettiin siihen mitä jäi: kuusitoista pyydettiin,
kuusitoista istutettiin, yhtään ei hylätty. Maan väri on koko pelin tummin, ja se
on tarkoitus: viimeinen kartta on ainoa jolla ei ole taivasta eikä maisemaa vaan
kivilattia soihtujen valossa, ja soihtu on kartan ainoa lämmin väri.

### Vaikeuskäyrä

`node tools/difficulty.mjs --write` ajettu. Maailmojen keskiarvo **w8 301,0**,
eli **+21,8** maailmaan 7 (279,2) — käyrä nousee yhä joka maailmassa. Kenttien
muoto linnake pois lukien: **245 → 117 → 302 → 378 → 386**, tasan yksi notko.

**Ja yksi jännite on kirjattava eikä siloteltava.** Notko on suhteessa syvempi
kuin missään aiemmassa maailmassa: 8-2 on 39 % maailmansa keskiarvosta, kun
luulaakson notko oli 56 % ja pilvimaailman 65 %. Syy on rakenteellinen eikä
huolimattomuutta — kuilut ovat 30 % mittarin painosta ja kuiluosuus vielä 9 %
lisää, joten maailmassa jonka vaikeus on lähes kokonaan kuiluissa hengähdys joka
poistaa kuilut putoaa väistämättä pidemmälle kuin maailmassa jonka vaikeus on
vihollisissa. Käsi ei ole samaa mieltä kuin mittari: 8-2 päättyy pomoon niin
kuin muutkin, ja se on ainoa kenttä maailmassa jossa voimatason voi menettää
menettämättä henkeä. Mittari ei osaa lukea sitä, ja tämä kappale on se mitä
sille tehdään.

### Uutta vihollisvarastosta, ja se mitä ei otettu

**Kurnuttaja** (v26.08.09.37) asuu maailman kolossa: `keep_croak` on ruutu
ruudulta `keep_hole`, ja identtisyys on päätös eikä laiskuus — pelaaja on
ylittänyt juuri sen kolon kaksi palikkaa aiemmin, joten ainoa uusi luettava on
se mikä siinä asuu. Ei kolikoita sen yli, samasta syystä kuin `pit_croak`issa:
kolikkokaari on tämän pelin tapa piirtää hyppy, ja sen piirtäminen tähän
osoittaisi pelaajaa siihen yhteen ilmasarakkeeseen joka on toisinaan varattu.

**Juoksuhiekkaa (v26.08.09.35) ei otettu**, ja se on päätös eikä unohdus:
`levels/world2.js` ratkaisi asian jo yhdellä lauseella — *linnakkeessa on
kivilattia eikä hiekkaa* — ja sääntö joka hylätään heti kun se on epämukava ei
ollut sääntö. Ruutu jää aavikkoon.

**Maahanisku** (v26.08.09.31) yltää pomoon tämän avoimessa vaiheessa, ja se on
omistajan päättämää vakiintunutta käytöstä. Ainoa paikka jossa sillä on tässä
maailmassa pudotusta on `boss_arena_big`in kansi eli viimeinen tappelu — liike
avaa paikan eikä kenttää, ja botti joka todistaa jokaisen kentän voimatasolla 0
ei osaa sitä lainkaan.

---

## v26.08.09.41 — hiekka ei tiedä kuka siihen astuu, ja kamera lakkaa leikkaamasta noustessaan

Kaksi bugia, molemmat eilen mitattuja ja tarkoituksella jätettyjä. Ne eivät
liity toisiinsa mitenkään muuten kuin siinä, että kummankin korjaus oli
*mittaus* eikä idea.

### 1. Viholliset uppoavat juoksuhiekkaan

Juoksuhiekka (v26.08.09.35) tuli sisään tietäen tasan yhdestä kehosta.
**Kaikki muu mikä seisoo lattialla käveli lammikon yli**, putosi läpi koska
hiekka ei ole `SOLID`, laskeutui lammikon alla olevalle lattialle ja jatkoi
kävelyä siellä — koko keho pinnan alla, näkymättömänä ja yhä tappavana.
Mitattuna 2-3:n kahden ruudun lammikossa: **890 framea 900:sta pinnan alla,
eikä yksikään laji kadonnut koskaan.** Se ei näytä bugilta vaan vitsiltä.

Julkaistuissa kentissä se ei tapahtunut, ja juuri se oli ongelma: 2-1:n ja
2-3:n penkat aitaavat kävelijät ulos lammikoista. Sijoittelurajoite on rajoite
vain niin kauan kuin kukaan ei siirrä mitään.

**Sääntö on että hiekka ei tiedä mitä siinä on.** `Enemy.sink()` on pelaajan
frame ilman hänen kahta kykyään. Sama pintahaku (`quicksandSurface` siirtyi
`Player`ista `Entity`yn, jotta niitä on yksi eikä kaksi), sama vajoamisnopeus,
sama kahlauskatto, sama armoaika ja ennen kaikkea **sama geometrinen kuolema**:
hukut kun koko keho on pinnan alla, et hetkeäkään aiemmin. Se ei ole koodin
säästämistä vaan koko suunnittelu — siitä seuraa suoraan, että 2-1:n matala
lammikko ei voi hukuttaa kävelijää täsmälleen siitä syystä josta se ei voi
hukuttaa voimatason 0 pelaajaa, ja kenttäsuunnittelija oppii yhden säännön
eikä kahta. Mitattuna: pelaaja **182 framea**, kävelijä **185**, piikkiukko
185, korkki 185, lentäjä 186, kuori 235 (se on lyhyempi ja lähtee matalammalta).

**Kykyä ne eivät saa.** Pelaajan vastaus hiekkaan on potku, ja potku on se asia
jota ensimmäinen lammikko on olemassa opettamaan; millään muulla ei ole nappia.
Siksi tarpeeksi syvä lammikko lopulta aina hautaa vihollisen — ja siksi
lammikosta tulee paikka johon jotain voi ajaa.

**Ketkä uppoavat, ja miksi juuri ne.** Kävelijä, kuori, piikkiukko,
ummetuskorkki ja lentäjä. Sääntö on "painovoima pitää sitä lattiassa", ja
lentäjä on siinä se joka näyttää tulkinnalta eikä ole: hiekka ei ole kiinteä,
joten uppoamaton lentäjä putoaisi pinnan läpi ja pomppisi lammikon pohjasta
hiekan sisältä — sama bugi eri spritellä. **Eivät** putki-kasvi, närästys,
ruskea pilvi, aurinko, kuu (paikallaan tai ilmassa), kurnuttaja (mitoitettu
yhdestä kiinteästä viivasta, ja `checkQuicksand` ei sallisi hiekkaa sen kuopan
pohjalla), papuparooni (pultattu jalustalleen, ja mukanaan menisi pelin ainoa
murtava voima) eikä pomo (**se on kenttä**; lattiaan piilotettu voittonappi
tekisi taistelun sääntöjen arvoksi nolla). Iskuaalto ei uppoa koska se ei ole
keho vaan rintama.

**Portti, ettei tämä unohdu kolmannella kerralla.** Sama kuin `ENEMY_COST`:
luokka joka käyttää `applyGravity`ä on **ilmoitettava** `sinks`-arvo omanaan,
eikä oletusta ole kummallakaan puolella — `true` upottaisi hiljaa seuraavan
lentävän, `false` jättäisi seuraavan kävelijän kävelemään pohjalla. `verify.mjs`
lukee luokan oman `update`in lähdetekstin ajossa (ei käännösvaihetta) ja vaatii
myös, että uppoavaksi ilmoittautunut oikeasti kysyy hiekalta.

**Hukkuminen ei maksa mitään**, eikä se ole mielipide vaan olemassa oleva rivi:
kentän pohjan läpi kävellyt vihollinen katoaa jo nyt ilmaiseksi, ja hukkuminen
on sama tapahtuma kansi päällä. Piste maksetaan tässä pelissä siitä mitä pelaaja
teki — tallaus, potku, laukaus, häntä, puhjennut kupla. Huoneen geometriasta
maksaminen tekisi "astu sivuun ja anna kentän hoitaa" parhaiten pisteitä
tuottavaksi vastaukseksi vihollista vastaan, mikä hinnoittelisi lätäkön jokaisen
annetun välineen yläpuolelle.

**Kuva ja ääni, ja tässä ne eroavat tahallaan** (DESIGN.md kohta 8). Merkki on
hiekan oma rae, sama jonka se heittää pelaajankin päälle, koska sen tekee hiekka
ja hiekka on huoneessa. Ääni **ei** ole jaettu: `upota` ja `kahlaa` ovat
pelaajan ilmoitus siitä että hänet saatiin kiinni, aavikko on kirjekuoressa, ja
kaksi ruutua taaksepäin rapiseva lammikko opettaisi katsomaan alas silloin kun
alla ei ole mitään. Näkymättömästä syystä laukeava signaali on huonompi kuin ei
signaalia — ja kuilu on tässäkin ennakkotapaus: mikään ei soi kun kenttä nielee
vihollisen. Mitattuna: 36 pölyhiukkasta, 0 pelaajan ääntä.

**Se on tavoitettavissa julkaistussa kentässä.** 2-1:n ainoa kuori seisoo
sarakkeessa 166 ja opetuslammikko on sarakkeissa 149–152, yhden palikan
takana. Vasemmalle potkaistu kuori liukuu sisään, pysähtyy sarakkeeseen 152 ja
on poissa **238 framen** kuluttua. Väline muuttuu roskikseksi, kauppa on auki
näkyvillä, ja se maksaa juuri siellä missä sen oppiminen on halvinta.

**Sijoittelu jäi ennalleen, ja penkat eivät ole enää kantavia.**
`dune_sink_deep`in kommentti sanoi että kävelijät on pidettävä ulkona koska
muuten ne kävelisivät pohjalla; nyt moottori tietää, joten penkka on
kenttäsuunnittelua eikä turvatoimi. Kävelijät jäivät silti paikoilleen: ne ovat
samat kaksi jotka `walkers`-palikassakin olivat, eli kentän vihollismäärä,
mitattu vaikeus ja rytmi ovat ne jotka on mitattu. Julkaistun kentän
uudelleensuunnittelu korjauksen esittelemiseksi olisi nämä kaksi asiaa väärässä
järjestyksessä.

**Vaikeusmittari ei liikkunut**, eikä sen pitänytkään: `difficulty.mjs` lukee
ruudukkoa, ruudukko ei muuttunut, ja käyrä on rivi riviltä sama
(`w2 121 → 126 → [124|159]`, yksi notko, nousee joka maailmassa).
`src/data/difficulty.js` ennallaan.

Pikatallennus kulkee ilman riviäkään tallennuskoodia: `sunk` on tavallinen luku
oliossa, ja `REGISTRY` kantaa sen — 42 framea pinnan alla molemmin puolin.

### 2. Kamera ei enää leikkaa noustessaan korotetulle tasolle

Löydetty ja mitattu eilen (v26.08.09.34) ja jätetty korjaamatta sokkona, koska
`CAM_SNAP` oli olemassa tarkoituksella ja korjaus vaati oman mittauksensa
siitä **mitä se suojeli**. Mittaus tehtiin, ja vastaus on: ei mitään.

`CAM_SNAP = 48` väitti suojelevansa tapausta "kuva on kokonaan toisaalla eikä
vain jäljessä — uudelleensyntymä, putki, kuilu". Kaikki kolme menevät ohi:

- **Uudelleensyntymää ja putkea ei pehmennetä lainkaan.** Molemmat päätyvät
  `centerCamera()`iin, joka sijoittaa `cam.y`:n suoraan. Se on se oikea
  leikkaus, sillä ei ole kynnystä, ja se teki tämän työn koko ajan.
- **Kuilun rajaa kentän oma clamp**: pahin ero kuvan ja sen halutun paikan
  välillä yhdessäkään pudotuksessa on 14,5 px.
- **Kaistanvaihto ei koskaan päässyt sille riville**, koska `updateCamera`
  testaa kaistat ensin. Mitattuna se haluaa liikkua 240 px.

Ja **26 kentässä 30:stä kynnys on aritmeettisesti saavuttamaton**: 15 rivin
kenttä on 240 px 208 px:n ikkunassa, eli pystyliikkumavaraa on yhteensä 32 px
eikä 48:aa voi pyytää. Loput neljä ovat kaistakenttiä. Jäljelle jäävät tasan
kirjekuorikentät 2-1 ja 2-3, joissa rajaus ostaa kameralle 80 px — ja ainoa
asia joka siellä koskaan ylitti kynnyksen oli se bugi jota se piilotti.

**Bugi: korotetulle tasolle laskeutuminen.** Ankkuri pidetään paikallaan koko
hypyn ajan ja se siirtyy sillä framella jolla jalat koskettavat, joten neljän
ruudun tasolle laskeutuminen siirtää sitä kerralla tason koko korkeuden.
Aavikon lattia kehystyy 80:een ja taso 30:een, eli kuvalla on 50 px matkaa — ja
50 > 48 leikkasi kaiken yhdellä framella. Mitattuna pelaamalla hyppy padilla
voimatasoilla 0 ja 3: **50,00 px yhdellä framella, asettui 1 framessa.**
Täsmälleen sama tapahtuma tavallisessa kentässä on 32 px:n askel joka liukuu
7,10 px vilkkaimmalla framellaan ja asettuu 12:ssa.

Korjaus on kynnyksen poisto, ja se tekee näistä kahdesta kentästä muiden 28:n
kaltaisia: **12,50 px ensimmäisellä framella, asettui 14 framessa.** Se on 1,6×
tavallisen laskeutumisen ensimmäinen frame koska taso on 1,6× askel — eli ease
on johdonmukainen eikä venytetty — ja neljäsosa siitä mitä kaistan oma ease
tekee ensimmäisellä framellaan pelin siunauksella.

**Miksi tähän ei tullut ennakkoa, vaikka kaksi muuta akselia sai sellaisen.**
`CAM_TOP_LEAD` ja `CAM_FALL_LEAD` tähtäävät siihen mihin keho on menossa
akselilla jota kuva jo seuraa. Tällä akselilla kuva **tarkoituksella ei seuraa**
kehoa: ankkuri pysyy paikallaan kaaren yli, jotta lähtöruutu pysyy ruudulla
(mitattu ja väitetty). Ennakko joka aloittaisi nousun ennen kosketusta olisi
kameran ratsastaminen hypyllä — juuri se mitä pito on olemassa estämään — ja se
maksaisi ruudun alareunasta sen minkä ostaisi yläreunasta.

**Punainen ennen vihreää, ja mitä punainen sanoi.** Uusi testi `a view that has
to rise on landing animates instead of cutting` kaatui lukemiin `2-1 taso 0:
50.00 px/frame, asettui 1 framessa` ja `2-3 taso 0: 50.00 px/frame, asettui 1
framessa`, kun samat rivit 1-1:stä ja 4-1:stä lukivat `7.10 px/frame, asettui
12 framessa` — sama tapahtuma, kaksi käytöstä.

Vihollispuolen punainen sanoi: `g: ei koskaan, 890 framea pinnan alla` (ja
sama neljälle muulle lajille), `ennen uppoama undefined framea`,
`0 pölyhiukkasta`, ja `päättämättä: BeanBaron, Boss, CorkGuy, Flyer, ShellGuy,
Shockwave, SpikeGuy, Walker`.

**Kumpikaan aiempi kamerakorjaus ei regressoinut.** `a view that has to rise
animates instead of snapping` lukee rivi riviltä saman, pahin frame edelleen
**1,95 px** (yksi rivi liikkui 0,00 → 0,02 px), ja `a view that has fallen
stops when the player stops` on identtinen pikselilleen, pahin 2,94 px / 7
framea. Maahaniskun rivi sama, 8,47 px / 11 framea.

**Yksi testi jouduttiin korjaamaan, ja se on kirjattava.** `the view does not
ride a jump upward` alkoi lukea 2,65 px. Ei siksi että kamera ratsastaisi
kaarella, vaan siksi että laskeutumisen liuku voi nyt olla vielä kesken kun
seuraava hyppy lähtee — leikkaus oli ohi yhdessä framessa eikä voinut mennä
päällekkäin. Testiin lisättiin sama "vain asettuneesta kuvasta lähtevät hypyt
lasketaan" -suodatin joka sen sisarella on ollut `CAM_TOP_LEAD`ista asti ja
täsmälleen samasta syystä. Suodatettuna: **0,00 / 0,27 / 0,00 px/frame.**
*Maa*-luku pitää edelleen jokaisen framen: lähtöruudun on pysyttävä ruudulla
myös kesken liukua otetuissa hypyissä.

`playable.mjs` ennallaan: 2-1 pysähtyy yhä sarakkeeseen 264.

---

## v26.08.09.40 — yön lauta näkyy vihdoin: 0,4 % → 17,8 %

Pelin heikoin pari korjattu. Yön tiili oli `#7a5a30` ja yön maa on `#6a5030`:
kaksi nimeä samalle ruskealle, mitattuna **0,4 %** erossa, eli 2-N:n rikottava
lohko oli lattiaa vasten käytännössä näkymätön. Ongelma ehti ohjata kahta muuta
päätöstä ennen kuin se korjattiin — juoksuhiekka jätettiin pois 2-N:stä ja
pilviteema rakennettiin 25 %:n kynnykseen juuri ettei sama toistuisi.

**Tiili liikkui, maa ei.** Omistajan päätös, ja se maksaa molempiin suuntiin:
2-N:n lattia näyttää täsmälleen entiseltä, mutta koko ero on ostettava tiilen
puolelta paletissa joka on tarkoituksella puristettu pimeään päähän. Uusi tiili
on `#c88a62` (varjo `#684230`, valo `#f4c4a0`) — **kuunvalon haalistamaa
lautaa**, vaaleampaa ja kuivempaa kuin maan lämmin multa, eli kaksi eri ainetta
eikä saman aineen kaksi sävyä. Sama vastaus kuin luulaaksossa ja
pilvikerroksessa, vain hillitympi, koska tässä maailmassa ei ole päivänvaloa
myytävänä. Mitattu ero maahan **17,8 %**.

### Kynnys 17 %, ja miksi ei jään 22,3 %

Kynnys on **kaksi kertaa pelin heikoin selviytynyt pari** (aavikko 8,6 %). Jään
22,3 % harkittiin ja hylättiin mitattuna: jään koko paletti asuu
luminanssivälillä 145–224, eli sillä on 80 tasoa liikkumavaraa, kun taas yön
paletti on puristettu pimeään päähän — ja juuri se puristus **on** se mikä
tekee yöstä yön. Jään lukuun yltävä lauta mitattiin: se vaati luminanssin
**142**, mikä on kirkkaampi kuin yön oma kivi (133,1) ja yhtä kirkas kuin
keskipäivän aavikon tiili (141,0). Se olisi ollut numero ilman yötä.

### "Vieläkö se on yö" on nyt mitattu eikä katsottu

Uusi väite `verify.mjs`:ssä: **kova palikka on jokaisen kahdeksan teeman
kirkkain kiinteä ruutu**, maata ja tiiltä myöten. Mitattuna kova/maa/tiili:
ruoho 192/99/106, aavikko 187/166/141, yö 133/87/130, jää 224/204/146, tehdas
162/110/102, luu 211/178/52, pilvi 233/227/118, linnake 171/138/116.

Se on kaksi asiaa yhdessä. Fysiikan puolella kova palikka on se pinta jonka
taivas valaisee kirkkaimmin, joten mikä tahansa sitä kirkkaampi ruutu tekee
valonsa itse — ja juuri se on "hehkuu sisältäpäin" mitattuna eikä arvioituna.
Luettavuuden puolella se on opittu merkki: **kirkkain on se jota ei voi
rikkoa**, ja yksi teema joka kääntää sen nurin opettaa väärän lukutavan
kaikkien muiden jäljiltä. Yön uudelle tiilelle jää pelivaraa 2,9 luminanssia.

Sivutuote, joka on syytä sanoa ääneen: tiilen ja **kovan palikan** ero yössä
putosi 23,5 %:sta 13,9 %:iin samalla mitalla. Se on mitan heikkous eikä uusi
näkymättömyys — ero on nyt lämpimän ja kylmän välillä (72 tasoa siniessä),
mitä kanavakohtainen keskiero aliarvioi ja mitä silmä lukee helpommin kuin
kirkkauseroa. Luumaailman väite koko pelin selvimmästä parista pitää yhä:
48,7 % vastaan yön 17,8 %.

## v26.08.09.39 — laatikko kuvaputken ympäriltä pois, kuvasta ei pikseliäkään

Omistajan havainto Chromella GitHub Pagesista: **"kuvaputkiruudun ympärillä on
laatikko"**. Se oli siellä, ja se oli meidän.

### Syy, mitattuna eikä pääteltynä

`styles.css` piirsi esityskankaalle suorakulmaisen renkaan (`box-shadow: 0 0 0
2px #23233a`), ja `postfx.js`:n tynnyrivääristymä vetää kuvaa **sisäänpäin**
(`uv += uv * offset`, ja rajan yli mennyt näyte piirtyy kehysvärillä). Suora
rengas ja kaareva kuva eivät siis kohtaa missään muualla kuin reunojen
keskellä. Mitattu esityskankaan pikseleistä: nurkassa kuva alkaa **15 pikselin**
päästä elementin kulmasta (640×480 esityskoolla), reunan keskellä **0 pikselin**
päästä. Rako on siis puhtaasti nurkkailmiö — täsmälleen se mikä
ruutukaappauksessa näkyi.

Renkaan puoli mitattiin oikeasta ruutukaappauksesta, koska rengas ei ole
kankaalla vaan sivulla: kirkkain pikseli elementin ulkopuolisessa kahden
pikselin nauhassa oli **37,6** luminanssia sivun oman taustan ollessa **10,9**
— eli kolminkertainen viiva pimeän ympärillä. Korjauksen jälkeen sama mittaus
antaa **9,8**, eli nauha on nyt taustaa tummempi (pudotusvarjo) eikä kirkkaampi.

### Ratkaisu: kehys seuraa kuvaa, ei elementtiä

Uusi luokka `#screen.curved`, jonka `PostFX._syncFrame` asettaa samasta
tiedosta josta `uCurve`kin päätetään: rengas ja pyöristetyt kulmat lähtevät
täsmälleen silloin kun varjostin taivuttaa kuvaa. Jäljelle jää pudotusvarjo,
joka on pehmeä ja elementin ulkopuolella eikä sen reunassa.

**Kolme kuvamoodia, kolme oikeaa vastausta.** `7` kiertää pois → hehku →
kuvaputki, ja vain viimeinen kaartaa; ilman WebGL:ää mikään ei kaarra. Suora
kuva pitää siis kehyksensä, ja se on oma väitteensä `verify.mjs`:ssä (mitattu
37,6 vs. tausta 10,9 molemmissa suorissa moodeissa). Ilman sitä väitettä bugin
olisi voinut "korjata" poistamalla rivin, ja silloin juuri se kone jolle koko
varajärjestelmä on olemassa olisi saanut reunattoman kankaan mustalla sivulla.

**Ylipyyhkäisy harkittiin ja hylättiin.** Varjostin voisi zoomata niin että
kaareva kuva peittää elementin suorakulmion, mutta se maksaa kuvaa: nurkkien
peittämiseen tarvittava kerroin 1/1,055 syö **8 px kuvan molemmilta laidoilta
ja 6 px ylhäältä ja alhaalta** (lähdepikseleinä, 320×240), eli myös HUD-palkin
alareunan — ja kuva vaihtaisi kokoa kesken efektikierron, mikä on oma bugi.
Kehyksen pudottaminen maksaa nolla pikseliä kuvaa.

---

## v26.08.09.38 — yksi ruutu, yksi uusi asia

`tools/curriculum.mjs` on mitannut elokuun 9. päivästä lähtien missä kukin pelin
ominaisuus kohdataan ensimmäisen kerran ja onko se ensiesittely turvallinen. Se
rakennettiin vastaamaan yhteen kysymykseen — kannattaisiko koko kurriculum-
järjestelmä rakentaa — ja vastaus oli **ei**: viimeinen uusi asia esitellään
kentässä 5-3, 18 kenttää 30:stä ei esittele mitään uutta, ja generaattori
noudattaa sääntöä "vain esitelty on sallittu" jo nyt 56 kertaa 58:sta. Mutta
yhden todellisen ja toistuvan vian se löysi, ja omistaja päätti korjata
täsmälleen sen eikä muuta.

### 1. Yhden ruudun sääntö on nyt portti, ei raportti

**Kahden ominaisuuden ensiesittely ei saa olla saman ruudun sisällä.** Ruutu on
20 laattaa = 320 px, eli se mitä pelaaja näkee kerralla. Mittari kutsui tätä
ehtoa YKSINiksi ja se hylkäsi **6 ensiesittelyä 26:sta**, kolmena parina:

    vine@1-2:150   / enemy_p@1-2:165     pavunvarsi ja putkikasvi
    star@1-3:195   / enemy_c@1-3:204     supertähti ja ummetuskorkki
    crumble@2-N:116 / enemy_O@2-N:104    mureneva lava ja kuu

Portti on `tools/verify.mjs`:ssä ja se lukee mittarin tuloksen sen sijaan että
kävelisi kartan uudestaan — toinen kävely olisi toinen totuus. **Se väittää
`earliest`istä**, eli siitä kentästä jossa asian voi *ensimmäisenä* kohdata
jollain reitillä, koska maailma 2 haarautuu 2-2:ssa ja yhdellä ominaisuudella on
siksi kolme eri vastausta siihen missä se kohdataan ensin. `guaranteed`
sallisi tungoksen toisella haaralla sillä perusteella että toinen haara on jo
opettanut toisen asian, mikä on lupaus väärälle pelaajalle.

Punainen ennen vihreää, kuten DESIGN.md kohta 7 vaatii: testi kirjoitettiin
ensin ja se sanoi `6/26: star@1-3:195 crumble@2-N:116 vine@1-2:150
enemy_p@1-2:165 enemy_c@1-3:204 enemy_O@2-N:104`. Nyt se sanoo `26
ensiesittelyä, väljin pakka 20 laattaa`.

### 2. Kenttä 1-2 esitteli seitsemän asiaa kerralla — nyt kolme

Mittarin kova löydös. **1-2 oli pelin ensimmäinen paikka jossa kohtaa
pavunvarren, warp-putken, piilokaistat, nuottipalikan, lentäjän, putkikasvin ja
ruskean pilven.** Seuraavaksi pahin kenttä koko pelissä esitteli kolme. Se on
pelin *toinen* kenttä, mikä on huonoin mahdollinen paikka sille.

Neljä muutti pois, kaikki vaihtoina — pala palasta, samanlevyisenä, mitään
poistamatta:

| ominaisuus | ennen | nyt | mikä maksoi |
| --- | --- | --- | --- |
| nuottipalikka | 1-2 | 2-2 | `note_pair` → `coins`, ja 2-3 sai toisen esiintymän (`walker` → `note_pair`, jossa on oma kävelijänsä) |
| putkikasvi | 1-2 | 2-1 | `pipe_plant` → `pipe_short`; 2-1:ssä oli putkikasvi jo valmiiksi |
| lentäjä | 1-2 | 1-F | `flyer` → `walkers` 1-2:ssa, `flyer` → `plat_float` 1-3:ssa |
| ruskea pilvi | 1-2 | 2-2 | `clouds` → `coin_stack` 1-2:ssa, `clouds` → `ledge` 1-3:ssa |

Kenttäkohtaiset ensiesittelyt ennen ja jälkeen: **1-2 7 → 3**, 1-3 3 → 3,
1-F 2 → 3, 2-1 2 → 3, 2-2 0 → 2, 2-N 2 → 2 (siirto kentän sisällä), muut
ennallaan. Maailma 1 lukee nyt näin: 1-1 puulava, kävelijä, kuoriukko — 1-2
pavunvarsi, warp-putki, piilokaista — 1-3 ummetuskorkki, supertähti, piikkirivi
— 1-F laava, lentäjä, pomo. Toinenkin portti tuli: yksikään kenttä ei saa
esitellä yli kolmea, ja kolme on mitattu pelistä eikä valittu — se oli pelin
seuraavaksi pahin luku ennen tätä.

Kaksi jäljellä olevaa tungosparia korjattiin siirtämällä palikka kentän sisällä
eikä poistamalla mitään: 1-3:ssa `corks` ja `pipe_pair` vaihtoivat paikkaa (ensimmäinen
ummetuskorkki sarakkeeseen 149, 46 saraketta ennen tähteä — `star_block`in oma
kaveriporukka on nyt kolmas kohdattu korkki eikä ensimmäinen, mikä on juuri se
oletus jolle sen palkinto on rakennettu), ja 2-N:ssä `dune_crumble` ja `corks`
vaihtoivat paikkaa (mureneva lava sarakkeeseen 180, 76 saraketta kuusta).

Mitattu hinta: 1-2 122.8 → 114.6, 1-3 101.2 → 98.0, 3-2 133.4 → 130.3, muut
ennallaan. Maailmojen muoto ja maailmasta maailmaan nouseva käyrä ovat molemmat
portteja, ja molemmat pitävät: w1 70 → 115 → 98, yksi notko, ja käyrä nousee
joka maailmassa. `node tools/difficulty.mjs --write` ajettu.

### 3. Warppeja ei saa arvata: neljä kuudesta oli liikaa

**Kuudesta kahden ruudun lattiaputkesta neljä oli warp-putkia.** Pelaaja joka
oppi säännön "paina alas jokaisen lyhyen putken päällä jossa on kolikoita" oli
oikeassa kahdesti kolmesta — ja salaisuus jonka arvaa kahdesti kolmesta on
rutiini eikä salaisuus. Vika löytyi kun kolikkojonot lisättiin (v26.08.09.29) ja
sama agentti nimesi rehellisen korjauksen: **lisää tavallisia lyhyitä putkia**,
ei vähemmän kolikoita. Kolikko putken päällä on ilmaista rahaa ja sen pitää olla,
koska vihjeen koko idea on että sen seuraaminen ei maksa mitään.

Yhdeksän uutta `pipe_short`ia: 1-1 (toinen), 1-2, 1-3, 2-1, 2-N, 3-2, 3-3 —
kaikki *vaihtoina* (`flat` → `pipe_short`, `coins` → `pipe_short`,
`spikes` → `pipe_short`). Peli: 6 putkea → 13, warppeja edelleen 4, eli
**66,7 % → 30,8 %**.

**Miksi kolmasosa.** Luku ei ole makuasia: se on sama kaista jonka peli jo
asettaa toiselle tavalliselta näyttävälle esineelle joka joskus onkin salaisuus.
`verify.mjs` vaatii että alle 35 % tiilistä kätkee jotain (mitattu 19 %), ja
lyhyt lattiaputki on täsmälleen sama väite eri esineestä. Kolmasosa on lähin
luku jonka alle nykyiset neljä warppia mahtuvat, ja se on myös se kohta jossa
väite muuttuu laadullisesti: puolikkaalla "useimmat lyhyet putket ovat
tavallisia" kääntyy takaisin yhdestä lisätystä warpista, kolmasosalla uusi warp
maksaa kolme uutta tavallista putkea. Sivutuotteena kolikkorivien
salaisuusosuus laski 6,4 %:sta 4,7 %:iin.

**Ja mitä siirtyi: ei mitään.** Edellinen agentti nimesi oikean riskin —
palikan *lisääminen* siirtää jokaisen sen jälkeisen piilotiilen, koska ne ovat
paikan hajautus (`src/core/secrets.js`) — ja siksi tässä muutoksessa ei lisätä
yhtään palikkaa. Jokainen muutos on samanlevyisen palikan vaihto
samanlevyiseen, ja `bricks`-palikan siirtämisen sijaan 1-3:ssa vaihdettiin
`corks` ja `pipe_pair`. Mitattu ennen ja jälkeen: 325 tiiltä → 325, 83
salaisuutta → 83, ja jokaisen kentän salaisuusavaimet merkki merkiltä samat.
Kartan salaisuuslaskurit, tallennukset ja sarakkeeseen naulatut testit (1-2:n
varsi 150, warp 229) pysyivät siis koskemattomina.

### Tiedossa, ei korjattu

- **`ENEMY_CHARS.U` (kurnuttaja) puuttuu mittarin vihollistaulusta.** Kurnuttaja
  ja mittari syntyivät samana päivänä eivätkä tienneet toisistaan. Rivin
  lisääminen kaataisi 2-1:n kahdesti: olento on sarakkeessa 117, putkikasvi
  101:ssä ja närästysliekki 134:ssä — ja `levels/world2.js` perustelee pitkästi
  miksi kasvi kuuluu juuri sille ruudulle. Se on aito erimielisyys säännön ja
  suunnittelupäätöksen välillä eikä siivottava lipsahdus, ja se on kirjattu
  `tools/curriculum.mjs`:ään korjausohjeineen (2-1:ssä `pit_croak` ja `pit_l`
  vaihtoon, jolloin olento siirtyy sarakkeeseen 197).
- **Laavan ensiesittely 1-F:ssä hylkää SEURA-ehdon**, koska `fort_gap` asettaa
  kuoriukon kolme saraketta laavaan. Se on eri vika kuin tungos ja pelin ainoa
  laatuaan; omistajan päätös oli portittaa yhden ruudun sääntö eikä muuta.

---

## v26.08.09.37 — kurnuttaja, ja 90 framea ennen kuin hyppy on sidottu

Uusi vihollinen, **KURNUTTAJA**: se asuu kuilun pohjalla ja loikkaa sieltä
ylös. Nimi on `kurnuttaa` (sammakon rekisteri sopii loikkijalle) yhden
kirjaimen päässä `kurnia`sta, joka on se ääni jonka vatsa päästää alhaalta —
samaa yhdyssanaperhettä kuin ummetuskorkki ja närästysliekki. Nimi on neljässä
paikassa eikä useammassa (luokka `Kurnuttaja`, `REGISTRY`, `ENEMY_CHARS.U`,
`drawKurnuttaja`), jos omistaja haluaa vaihtaa sen.

### Ongelma on koko työ, eikä se ole "tehdään sammakko"

**Kuilu on tähän asti ollut binäärinen: joko ylität sen tai kuolet.** Olento
kuilussa tekee vaaralliseksi *ilman kuilun yllä* — juuri sen paikan jossa
pelaajalla on vähiten ohjausta, kesken hyppyä ja sitoutuneena, pelkkä vauhti
jäljellä. Huolimattomasti tehtynä tämä muuttaa hypyn jonka pelaaja itse valitsi
kuolemaksi jota hän ei voinut välttää, eli se on epäreiluuden generaattori.
Siksi tästä ei riitä väitteeksi "vihollinen on olemassa", ja siksi
`verify.mjs`:ään tuli yhdeksän mittausta eikä yhtä.

**1. Varoitus ehtii ennen sitoutumista, ja se on todistus eikä toive.**
Varoitus kestää `KURN_WARN` = 84 framea, ja luku ei ole makuasia: se on mitattu
`tools/jump-budget.json`ia vasten. Pisin hyppy jonka voimatason 0 pelaaja voi
olla ilmassa on **69 framea** (`P-speed, held`). Jos varoitus on vähintään yhtä
pitkä kuin lento, niin jokainen loikka joka voi osua lentävään pelaajaan **oli
jo alkanut kuulua ennen kuin hän lähti maasta**: varoitus alkaa framella t,
loikka framella t+W, pelaaja lähtee framella u ja laskeutuu u+A:lla; osuma
edellyttää t+W < u+A eli t < u + (A−W), ja kun W ≥ A niin t < u. Mitattu
kokonaisviive kuvan alusta siihen framen jolla ruumis voi ensimmäisen kerran
satuttaa: **90 framea**, pelivaraa 21. Juoksuvauhdilla (2,5 px/frame) se on
225 px eli **14 ruutua lähestymistä** kuudelle ruudulle kuilua.

Pieruhyppy (113 framea) on rajattu mittauksen ulkopuolelle tarkoituksella: se on
pelin ainoa hyppy jonka voi muuttaa kesken kaiken, eli se ei ole sitoutuminen
samalla tavalla — ja DESIGN.md kohta 5 sanoo muutenkin että lupaus mitataan
voimatasolta 0.

**2. Sykli on deterministinen.** Ei `Math.random()`ia missään kohtaa: `54 + 84 +
loikka = 176 framea`, joka kierros. Sama peruste kuin pomon piikkisyklillä —
kuilun yllä oleva vaara on opeteltava, ja pikatallennuksen pitää palata samaan
tahtiin. Mitattu: kuusi peräkkäistä kierrosta 176/176/176/176/176, kaksi samalla
framella herännyttä oliota framen tarkkuudella samassa tahdissa, ja pikalataus
kesken kurnutuksen jatkaa täsmälleen samalta framelta (70 → 70).

**3. Loikka pysyy omassa sarakkeessaan.** `x` ei muutu koskaan eikä `vx`
asetu. Vaara on siis *täsmälleen* kuilun yllä oleva ilma, ja reunalla
seisominen on aina turvallista — mikä on se asia joka tekee odottamisesta
oikean vastauksen eikä arvauksen. Mitattu: 0 px sivuliikettä, 40 px nousua
reunan yli, ja reunalla kaksi kokonaista kierrosta seissyt pelaaja ehjä.

### Tapposäännöt, ja kolme rajaa jotka piti vetää

**Tallaus ei käy.** Kuilun yllä olevan olennon päälle laskeutuminen tarkoittaa
kuilun ylle laskeutumista: peli tarjoaisi vastauksen joka tappaa vastaajan.
"Odota" on jo pelin opettama laillinen vastaus — närästyssuihkuun ei voi hypätä
lainkaan. Kaikki muu puree kuten putkikasviin: pierupallo, häntä ja liukuva
kuori. Kuplaa se ei ota, samasta syystä kuin kasvi ei: se on pultattu koloonsa,
ja kuplassa leijuva kurnuttaja jättäisi kuilun vaarattomaksi lopun kenttää.

**Se ei ole piikikäs, ja se on tietoinen ero.** Piikit tarkoittavat "tallaus on
kiinni" ja ne piirretään kärkinä; tämä on kiinni siksi että se roikkuu kolon
päällä, mikä on tieto maastosta eikä eläimestä. Piikikkyys olisi ollut toinen
merkitys samalle kuvalle.

**Maahanisku (v26.08.09.31): geometria vastaa, ei lippu.** Iskuaalto juoksee
lattiaa pitkin ja lattia loppuu kuilun reunaan — eikä sitä tarvinnut kirjoittaa
mihinkään. Mitattu: iskun säde voimatasolla 0 on **22 px**, ja matka reunalta
kuuden ruudun kuilun keskelle on **48 px**. Isku ei siis yletä sinne edes
täydeltä korkeudelta, ja kuiluun sukeltaminen on jo valmiiksi kuolema. Vastaus
on siis "ei mitään", ja se seuraa mitoista eikä erikoistapauksesta.

**Supertähti kantaa sen yli.** Tähti suojaa kentän asukeilta ja nimenomaan ei
kentältä itseltään: kuilu, laava ja kello ovat sen ulkopuolella. Kurnuttaja on
*asukki* kuilun yllä, joten se on tähden puolella rajaa — ja kuilu sen alla ei
ole. Sama testi mittaa molemmat: tähti tappaa olennon kosketuksesta, ja sama
tähti antaa kuilun tappaa pelaajan.

### Kuva ja ääni yhdessä, ja kumpikaan ei ole vanha merkki

Ruumis on kolon pohjalla näkymättömissä (lepokorkeus on kaksi ruutua reunan
alla, eli 15-rivisen kaistan alapuolella), joten **varoitus ei voi olla
olennossa**. Se on kuplapatsas joka nousee kolosta ilmaan: kalpea sinivihreä,
kolme eroa peliin jo kuuluviin varoituksiin. **Paikka** — närästyksen
varoitushiillos on lattialla ja auringon hehku on auringossa; tämä tapahtuu
kolon päällä, ainoassa kohdassa kuvaa jossa lattiaa ei ole. **Väri** — hiillos
on tulta, pelaajan oma kaasu on keltavihreää; tämä on kumpikaan. **Rytmi** —
hiillos välkkyy kahden värin väliä kolmen framen välein, mikä lukee sanana
"päällä"; tämä on nouseva patsas joka kiihtyy ja yltää korkeammalle mitä
lähempänä loikka on, eli se lukee sanana "kohta" ja kertoo *kuinka* kohta.

Kaksi uutta ääntä. **`kurnutus`** on ääni jolla on pituutta, samasta syystä kuin
`sprout`illa: se kuvaa asiaa joka kestää. Mutta se ei ole `sprout` eikä `dive`,
ja ero on rytmissä eikä sointivärissä — nuo kaksi ovat yksi yhtenäinen liu'utus
(toinen ylös, toinen alas), tämä on **kiihtyvä pulssijono**, seitsemän lyhyttä
kurahdusta joiden väli kutistuu 0,20 sekunnista 0,09:ään. Mikään muu tällä
väylällä ei ole jono jonka tiheys muuttuu. **`loikka`** on 0,12 sekuntia märkää
läiskähdystä ja nopeaa nousua, ja se on lyhyt juuri siksi että edellinen oli
pitkä: korva erottaa hetken jolloin odottaminen loppuu vain jos jälkimmäinen
ääni on sen muotoinen mitä edellinen ei ole.

### Mihin kuiluihin, ja miksi ei kaikkiin

**Kaksi**, ja se on koko lista: `2-1` (chunk 7) ja `3-3` (chunk 18). Vaara joka
on jokaisessa kolossa on maastoa, ja maasto ei ole vaara — tyhjän kuilun
kohtaaminen heti asutun jälkeen on se mikä tekee asutusta merkittävän. Maailman
1 paljaat kuilut jäävät tyhjiksi tarkoituksella: kuilu saa tarkoittaa kuilua
yhden maailman ajan, ja 2-1 on ensimmäinen kenttä sen jälkeen.

`pit_croak` on ruutu ruudulta `pit_s`: viisi lattiasaraketta, kuusi tyhjää,
viisi lattiaa. Identtisyys on tässä se päätös. Pelaaja on ylittänyt juuri sen
kolon 1-1:stä asti, joten ainoa uusi luettava on se mikä siinä asuu — eri
levyinen kuilu olisi pyytänyt lukemaan maastonkin uusiksi samalla hetkellä.
Kapeampaa (viisi ruutua) kokeiltiin ja se **hylättiin mittauksen takia**:
`difficulty.mjs` luki 2-1:n silloin *helpompana hirviön kanssa kuin ilman*
(115,7 → 111,0), koska ruutu pois kuilusta on pisteinä enemmän kuin vihollinen
on. Vaara joka mittautuu alennuksena on täsmälleen se vika jolla piikkiukko
lähti tuotantoon.

2-1:ssä putkikasvi on naapurichunkissa, ja se on päätös eikä sattuma. Ne ovat
pelin ainoat tallaamattomat ennakoivat viholliset, ja kohdan 8 oikea huoli on
kaksi merkkiä jotka opettavat yhden lukutavan — joten ne pannaan samaan ruutuun
jossa *ero* näkyy: kasvi kurkottaa kannesta jonka ohi kävellään maata pitkin ja
väistää kun tulet lähelle, kurnuttaja tulee ylös kolosta jonka yllä on pakko
olla ilmassa eikä välitä siitä missä seisot. Vierekkäin ne ovat vastakohta;
ruudun päässä toisistaan ne olisivat toisto.

**3-3:ssä `pit_l` vaihtui `pit_croak`iin ja vaihtoi paikkaa `plat_float`in
kanssa**, ja jälkimmäinen löytyi työkalulla eikä katsomalla. `pit_l`in paikalla
edellinen chunk on `brick_wall`: neljän ruudun pino jonka yli mennään täydellä
16 framen hypyllä ja jolta tullaan alas vauhti käytettynä. `pit_l` selvisi siitä
astinkivensä turvin, paljas kolo ei — `tools/playable.mjs` hukkui siihen
voimatasolla 0, ja kenttä jota pienin koko ei läpäise on rikki eikä vaikea
(DESIGN.md kohta 5). Kuilun leventäminen tai kaventaminen olisi ollut väärä
vipu: vika oli *lähestymisessä*. Kentän pituus ja chunkit ovat ennallaan.

### Vaikeusmittari näkee sen, ja nyt se ei voi olla näkemättä seuraavaakaan

`ENEMY_COST.U = 2.1`, lisättynä vihollisen mukana eikä jälkikäteen. Hinta on
kahden muun tallaamattoman yläpuolella (putkikasvi 1,1, närästyssuihku 1,5) ja
sen syy on *missä* se on eikä mitä se tekee: kasvi ja suihku seisovat lattialla
jota pitkin voi perääntyä, tämä omistaa kolon yllä olevan ilman eli sen paikan
jossa pelaajan vaihtoehdot on jo käytetty. Kasvin väärin ajoittaminen maksaa
voimatason, tämän väärin ajoittaminen maksaa hypyn ja siten hengen. Sitä vastaan
sykli on metronomi 84 framen ennakolla eikä se poistu sarakkeestaan, mikä on syy
sille ettei se ole auringon hinnassa.

Ja koska sama vika on nyt tehty kahdesti (piikkiukko lähti nollalla,
papuparooni melkein), se ei ole huolimattomuutta vaan puuttuva tarkistus:
`verify.mjs` lukee `ENEMY_CHARS`in merkit lähdetekstistä ja **vaatii jokaiselle
hinnan** `ENEMY_COST`-taulusta. 13 merkkiä, 13 hintaa.

Mitattu vaikutus: **2-1 115,7 → 119,7** (pelkkä vihollinen, kuilu ennallaan) ja
**3-3 174,3 → 186,5** (josta suurin osa on menetetty astinkivi — mittari ei osaa
erottaa "eri kuilua" "vaikeammasta kuilusta"). Maailmojen käyrä nousee edelleen
joka maailmassa (w2 147,3 → 148,3, w3 172,3 → 175,4) ja jokaisen maailman muoto
on ennallaan: tasan yksi notko. `node tools/difficulty.mjs --write` ajettu.

---

## v26.08.09.36 — kaasukehä, ja se mikä pilvessä kannattaa

Maailma 7, **KAASUKEHÄ**: pilvikerroksen päällä, neljä kenttää, oma teema, oma
sävellys ja sääherra. Peli on nyt **7 maailmaa ja 30 kenttää**, ja
[ROADMAP.md](ROADMAP.md):n teemalista on täynnä — maailma 8 on viimeinen
linnake, jonka musiikki (*Yö Autiovuorella*) on jo varattuna DESIGN.md kohdassa
1 b.

### Kysymys 1: mikä on lattia pilvimaailmassa

Pilvistä tehty maailma on kuoppa koko pituudeltaan, ellei joku päätä toisin.
DESIGN.md kohta 5 ei jousta — maareitin on auettava voimatasolla 0 — ja
`tools/playable.mjs` ajaa sen lupauksen, joten "ei ole lattiaa, kaikki on
saaria" ei ole rohkea suunnittelu vaan maailma jota kukaan ei läpäise. Päätös
tehdään siksi kerran, `chunks/cloud.js`:n ensimmäisessä kappaleessa:

> **oman painonsa tiivistämä pilvi on maata.**

Lattia on tavallista `#`:ää. Sama ruutu josta maailma 1 on tehty, sama lupaus,
ja `THEMES.cloud` maalaa sen auringon puolelta valaistuna pilvenselkänä eikä
multana. Reiät siinä ovat reikiä pilvessä ja ne tappavat kuten jokainen reikä
tässä pelissä tappaa, koska reikä taivaassa ja reikä maassa ovat pelaajalle
sama asia — toisen kieliopin keksiminen putoamiselle ei opettaisi mitään.

Siitä seuraa kaksi sääntöä, ja ne ovat luumaailman säännöt ylösalaisin.
`chunks/bone.js` perustelee itsensä yhdellä lauseella — *luu seisoo* — joten
sen pystysuunta kasvaa lattiasta selkärankoina ja hautakivinä. Pilvi on
määritelmän mukaan asia joka **ei** kannata itseään:

1. **Mikään ei seiso.** Lattiarivien yläpuolella ei ole yhtään `#`:ää eikä
   `X`:ää. Koko `steps_up` / `ledge` -puolisko jaetusta sanastosta on
   käyttökelvoton täällä, ja korkeus on ostettava laudalla ja kelluvalla
   lohkolla. Mitattu: **0 ruutua vastaan luumaailman 44.**
2. **Ohut pilvi ei ole koskaan tyhjän päällä.** Jokaisen `-`:n alla on samassa
   sarakkeessa kiinteää pilveä. Puoliläpäisevä lava on ollut pelissä alusta ja
   siinä on yksi ansa jonka on voinut sietää siksi että lavoja on ollut vähän:
   alas painaminen pudottaa lävitse, ja jos alla ei ole mitään, se pudottaa
   kuoppaan. Maailma jonka koko pystysuunta on lautaa moninkertaistaisi sen,
   joten ansa poistetaan rakenteesta eikä varoiteta siitä. Mitattu:
   **0 roikkuvaa lautaa vastaan muun pelin 73.**

Sääntö 2 maksaa, ja hinta on koko ero maailmaan 6: **yksikään lauta tässä
maailmassa ei ylitä kuoppaa.** Muualla pelissä lauta kuopan yllä on hyvä
vastaus (`pit_l`, `sky_run`, `bone_ribs`), ja vaikeusmittari on samaa mieltä —
sillattu kuoppa ei tuota lainkaan kuiluriskiä. Täällä jokainen reikä hypätään,
ja juuri siksi maailma 7 pisteytyy maailman 6 yli ilman että yksikään reikä on
leveämpi.

### Kysymys 2: miksi tämä ei ole venytetty bonushuone

Pelissä on ollut taivas maailmasta 1 asti. Jokaisen korkean kentän yllä on
piilotettu kaista, sinne mennään pavunvartta pitkin, ja `sky_garden` on jo
paikka joka on tehty lavoista ilmassa. Kokonainen pilvimaailma joka lukisi
samalta ei olisi vain tylsä: se halventaisi salaisuuden jonka löydettäväksi
tekeminen oli oikeaa työtä.

**Ero on lattia, ja se mitataan.** Kaksi lukua per kenttä, ja ne ovat kaksi eri
kysymystä — *onko täällä lattia* ja *mistä täällä kuljetaan*:

| | maaosuus | lautaosuus astuttavasta |
| --- | --- | --- |
| 7-1 | 91 % | 9 % |
| 7-2 | 97 % | 10 % |
| 7-3 | 89 % | 9 % |
| `sky_garden` | **0 %** | **100 %** |

Yhdellä lauseella: **taivaskaista on paikka jossa hypitään, kaasukehä on paikka
jossa kävellään.** Testi lukee bonushuoneen samoilta riveiltä samalla koodilla,
eli vertailukohta ei ole muistettu luku vaan pelin oma huone; ja se puree —
kun kokeeksi vaihdettiin pilvipalikoiden lattia kahdeksan ruudun saariksi,
luvut putosivat 68/66/70 prosenttiin ja portti kaatui.

Toinen ero on se mitä **ei ole**: koko maailmassa ei ole pavunvartta eikä
taivaskaistaa. Sen salaisuuden koko retoriikka on kiipeäminen ulos maailman
yläpuolelle, eikä tämän maailman yläpuolella ole mitään. Taustan puolisko
samasta väitteestä on `cloudSea`: lähimmän pilvikerroksen repeämistä pilkottaa
maailma jonka päällä ollaan, liian kaukaa erottuakseen miksikään. Bonushuoneen
takana on taivas; tämän takana on matka.

### Maahaniskulla on täällä tilaa, muttei valtaa

Maahanisku (v26.08.09.31) normalisoi voimansa kentän omaa kattoa vasten, joten
kerroksittain ladottu maailma on ensimmäinen paikka jossa liikkeellä on koko
pudotus käytettävissään. `cloud_anvil`in kansi on rivillä 5, ja se on maailman
ylin lauta. Mitattuna ajavasta kohtauksesta eikä laskemalla:

| mistä | voima | tappaako |
| --- | --- | --- |
| alasimen kannelta | **0,67** | kyllä |
| lattiahypyn huipulta | **0,37** | ei |

`POUND_KILL_AT` on 0,5, eli korkeus ostaa tappavuuden — ei tehostus eikä tämä
maailma. Ja se ei ole pakollinen: sama botti joka todistaa maareitin
voimatasolla 0 ei osaa maahaniskua lainkaan ja kävelee alasimen ali. Liike avaa
paikkoja, ei kenttää (DESIGN.md kohta 5).

Testi vaatii myös että ylin lauta on rivillä 5 tai ylempänä, ja se on osa
väitettä eikä sen kuvaus: maailma jonka katto valuisi alaspäin lakkaisi olemasta
se paikka jossa liikkeellä on tilaa, ja tekisi sen huomaamatta. Mitattu
punaisella — alasin laskettuna tavalliselle kansikorkeudelle portti sanoo
"ylin lauta 7-1 rivi 6".

### Musiikki: oma sävellys, ja lyydinen on datassa

Raita on **tätä peliä varten sävelletty**, eikä siinä ole `source`-kenttää:
DESIGN.md kohdan 1 b sääntö koskee lainattua eikä kaikkea. Vapautuneesta
sävelmistöstä ei löytynyt teosta joka olisi ollut *tämä paikka* samalla tavalla
kuin *Danse macabre* oli luulaakso — pilviaiheista klassikkoa on, mutta jokainen
niistä on sään kuvaus ulkoa käsin, ja tämä maailma on sään sisällä. Aihevalinta
on ainoa peruste jolla lainaaminen on tässä pelissä tehty, ja kun sitä ei ole,
ei lainata. Lainattuja raitoja on siis yhä kaksi (`cave`, `bone`), ja portti
sanoo sen ääneen.

Sävellyksen yksi ajatus on kirjoitettavissa numeroina, joten se tarkistetaan:
**D-lyydinen**. Lyydinen on duuriasteikko jonka neljäs sävel on korotettu, ja
juuri se yksi sävel on syy valita se tänne — tavallisessa duurissa neljäs sävel
vetää alaspäin subdominanttiin, ja korotettuna koko vetosuunta katoaa. Se on
kirjaimellisesti sen soundi ettei mikään putoa. Sointukierto on D — E — D — Bm,
ja **E-duuri on koko juttu**: toinen aste duurina on mahdollinen vain
lyydisessä.

Mitattu: **G# soi 12 kertaa, G nolla kertaa, asteikon ulkopuolella ei mitään,
säveliä yhteensä 95.** Yksi ainoa G ja moodi on jälleen tavallinen D-duuri — se
kuulostaisi vain hieman tavallisemmalta, mikä on täsmälleen se vika jota kukaan
ei osaa etsiä. Todistettu punaisella: yksi sävel vaihdettuna portti sanoo
"G# 11 kertaa, G 1 kertaa, asteikon ulkopuolella pc5×1".

Rumpuihin ei tullut takapotkua. Virveli kakkosella ja nelosella on se kuvio joka
sitoo musiikin lattiaan, ja se olisi ollut vastoin kaikkea muuta tässä.

### Sääherra, ja mitä pomo vastaa osumaan

`bossVariant: 5`. Kysymys on sama kuin luurangolla ja vastaus tulee tämän
maailman aiheesta: **sää väistää ylöspäin.** Muut pomot vastaavat osumaan
kiihtymällä, mikä on luku jonka pelaaja tuntee kolmen sekunnin päästä; sääherra
lähtee ilmaan samalla framella ja tulee alas iskuaaltojen kanssa, koska
variantti ≥ 1 heittää ne kovasta laskeutumisesta.

Se on yksi rivi (`jumpTimer = 1`), ja se on tarkoitus: koneisto on jo olemassa,
`REGISTRY` (savestate.js) ei muutu, eikä uutta entiteettiä synny. Nopeus nousee
0,2:lla eikä 0,35:llä samasta syystä kuin luurangolla — nousu **on** se
kiihdytys, ja kaksi kiihdytystä yhdestä osumasta on yksi liikaa. Mitattu
vertailuna eikä yksin, molempien oma hyppykello kaukana: **sääherra ilmassa
framella 0, luuranko ei 40 framen ikkunassa.**

Arvomerkki on **ilmapuntari, jonka neula osoittaa myrskyyn**. Se noudattaa
saman säännön kuin jokainen muu arvomerkki — pyöreä, silmien alapuolella, eikä
mitään pään yläpuolella — ja hahmon koko vitsi on että ilmakehä kuuluu
jollekulle, jolloin omistamisen merkki on se että sen tilan saa lukea.

Väri on **myrskynsininen eikä valkoinen**, vaikka maailma on valkoinen, ja se on
luettavuuspäätös: kruunu on kullanvärinen, ja vaalea pomo kultaisella kruunulla
on pomo jonka kruunua ei näe. Kruunu on se yksi asia jonka pelaajan on luettava,
koska se kertoo milloin häneen ei saa koskea.

### Kontrasti: se teema jonka kuuluisi kaatua omaan porttiinsa

Valkoista valkoisella on koko maailman lähtökohta, ja jos tiili sulautuu maahan,
se ei näytä bugilta vaan siltä ettei palikoita ole. Yön pari (`#7a5a30` ja
`#6a5030`, mitattuna **0,4 %**) on todiste siitä että näin käy vahingossa.

Vastaus on ettei kumpikaan ole valkoinen samasta syystä: **maa on auringon
puolelta valaistua pohjapilveä ja tiili on ukkospilveä.** Kaksi eri pilveä, ei
saman pilven kaksi sävyä.

| teema | tiilen ja maan ero |
| --- | --- |
| yö | 0,4 % |
| linnake | 7,9 % |
| aavikko | 8,6 % |
| ruoho | 9,3 % |
| tehdas | 17,9 % |
| jää | 22,3 % |
| **pilvi** | **40,9 %** |
| luu | 48,7 % |

Kynnys on 25 %, eli korkeampi kuin yhdelläkään ennen luumaailmaa toimitetulla
teemalla — se ei mene läpi vahingossa. Yläraja tulee ilmaiseksi luumaailman
omasta väitteestä, joka vaatii olevansa koko pelin selvin pari. **Yön 0,4 % on
yhä löydös eikä tämän työn korjattava**, samoin kuin viime kerralla: yön paletin
muuttaminen muuttaisi valmiin kentän ulkonäön, ja se on omistajan päätös.

### Vaikeus, mitattuna

| kenttä | pisteet | mikä siinä on |
| --- | --- | --- |
| 7-1 | 252,5 | kerrokset: kaksi korkeutta, sitten reikiä |
| 7-2 | 180,2 | notko — säätä reikien sijaan |
| 7-3 | 278,7 | alasin, ja jokainen reikä minkä maailma omistaa |
| 7-F | 405,3 | linnoitus, ja pelin vaikein kenttä |
| **w7** | **279,2** | ↑ +14,9 maailmasta 6 |

Käyrä nousee ja notkahtaa tasan kerran (`253 → 180 → 279`), kuten jokaisessa
muussakin maailmassa. Ja **käyrän on nyt noustava myös maailmasta maailmaan**,
mikä on eri väite kuin muototesti: muototesti katsoo yhtä maailmaa kerrallaan,
joten uusi maailma voisi olla sisäisesti moitteeton ja silti edellistä
helpompi — pelaajan kannalta juuri se on se vika joka tuntuu. `difficulty.mjs`
on tulostanut rivin "Käyrä nousee joka maailmassa" pitkään, ja tuloste ei ole
portti. Väite meni punaiseksi kertaalleen matkan varrella (**w7 261,5, −2,7**)
ennen kuin vihollistiheys ja reikien määrä oli mitoitettu.

`node tools/difficulty.mjs --write` on ajettu, ja `src/data/difficulty.js`
sisältää neljä uutta riviä.

### Botti saneli geometrian kerran, ja se oli sama oppi kuin luulaaksossa

`tools/playable.mjs` kaatui maailmaan 7 kerran: **7-F, "maasto sarakkeessa
166"**. Syy oli `fort_pillars` suoraan ennen `fort_gap`ia — pilarit ovat seinä,
seinä nostaa hypyn liian aikaisin, ja hyppy päättyy laavaan. Se on täsmälleen
sama vika kuin luulaakson hautakivi kuopan huulella, eri palikalla: **mitattu
hyppybudjetti on se mihin kentät leikataan, ei se mitä vasten ne leikataan.**
Korjaus oli järjestys — `fort_hall` väliin, pilarit takaisin areenan eteen
kuten 6-F:ssä — eikä kuopan kaventaminen.

Numeroidut kentät menivät läpi ensimmäisellä ajolla, ja se on rakenteen ansiota
eikä onnea: kun ohut pilvi ei saa ylittää kuoppaa, botille ei voi rakentaa
sellaista reittiä jota se ei osaa lukea.

**Toinen botti — se meluisa, joka pelaa viholliset päällä ja jonka kuolemat
ovat raportti eikä portti — löysi silti jotain.** Maailman 7 kentät pääsivät
4–9 prosenttiin, kun muu peli on 12–57. Se on liian selvä ero ollakseen
kohinaa, ja syy oli yksi palikka: `cloud_bank` avaa kaikki kolme kenttää, ja
siinä oli kolme asukasta. Palikan oma kommentti sanoi sen itse — *"kielioppi
ilman panosta"* — eli data oli ristiriidassa oman perustelunsa kanssa.
Tyhjennettynä luvut ovat 39/25/28 %. Raportti ei kaada mitään, mutta se
kannattaa lukea.

### Muuta samassa erässä

- **Kartalle kolme uutta maastomerkkiä**: `c` pilvipinta, `i` repeämä jonka
  läpi näkyy alas, ja `U` ukkospää, joka on `TALL_TERRAIN`issa (piirtoala
  y+1…y+13 osuu polun pisteen musteeseen y+5…y+10 kuten puu ja kallo).
  Ruudukko rakennettiin säännöstä käsin: tien raivausalue laskettiin ensin ja
  kalusto istutettiin siihen mikä jäi jäljelle — 20 pyydettyä, 20 istutettua,
  0 hylättyä.
- **Maapinnan kuvio on pystysuunnassa epäsymmetrinen** (`surface: 'cloud'`),
  ainoana pelissä: yläpinta on kiinteä ja alareuna hilseilee, koska pilvi on
  maata vain siltä osin kuin oma paino on sen pakannut. Harja on pyöreä kuhma
  eikä piikki — terävä yksityiskohta pilven yläreunassa lukisi rakeena eli
  vaarana. Sää on viimaa: sama hiukkasmoottori kuin aavikon hiekalla, mutta
  valkoisena, pidempänä ja kahdessa kerroksessa eri nopeuksilla.
- **`THEME_AMBIENCE`: pilvi saa aavikon tuulen.** Se on uudelleenkäyttöä siinä
  mielessä että tuuli on tuulta; kaksi synteesiä samalle ilmiölle olisi kaksi
  tapaa sanoa sama asia (DESIGN.md kohta 8).
- **Putki on messinkiä.** Ruohon vihreä olisi tässä paletissa haalea ja
  valkoinen putki valkoista pilveä vasten ei ole putki vaan aukko; messinki on
  teeman ainoa lämmin väri ja siksi ainoa jonka silmä löytää heti.
- **Maareitin lupaus on nyt portti maailmoissa 6 ja 7.** Sama botti ajetaan
  `verify.mjs`:stä ja tulos kaataa. Maailmoissa 1–5 on kolme tunnettua nimeä
  (4-3, sekä 2-1 / 3-F / 5-F tuplahypyllä) ja niiden avaaminen on eri työ;
  käsintehdyt maailmat luulaaksosta eteenpäin eivät saa kasvattaa sitä listaa.

---

## v26.08.09.35 — juoksuhiekka, ja kolme sekuntia aikaa tehdä jotain

Aavikkoon uusi ruutu `~`, **JUOKSUHIEKKA**. Omistajan pyyntö oli kaksiosainen ja
molemmat puoliskot ovat suunnittelua: *"aavikkokentissä voisi olla
juoksuhiekkaa. Ei kaikissa, mutta joissakin."* Jälkimmäinen ei ole aikataulu.
Uhka joka on joka kentässä on maastoa, ja maasto ei ole uhka — joten aavikon
viidestä kentästä **kaksi** sai hiekkaa ja kolme jäi ilman, kirjatuista syistä.

### Mitä se tekee, ja mistä numerot tulevat

Käytöksen ratkaisi omistaja: *"vetää hitaasti alas, mutta reagoimiseen jää
useita sekunteja."* Sen jälkeen kaikki oli mitattavaa.

Hiekka **korvaa** fysiikan sen sijaan että säätäisi sitä. Sisällä painovoiman
tilalla on 0,16 px/frame alaspäin — päätenopeudella saapuva keho pysähtyy siihen
frameen jolla koskettaa, mikä on koko "se sai minut kiinni" -lukema — vaakaan
jää 0,62 px/frame eli alle puolet kävelykatosta, ja **hyppy lakkaa olemasta
hyppy**: nappi antaa heikon potkun (-2,6 vastaan hypyn -3,5) kahdeksan framen
välein. Ulos pääsee rimpuilemalla, ja se on koko mekaniikka.

Kuolema on **geometriaa eikä ajastinta**: koko keho pinnan alle, ja siitä 88
framea armonaikaa. Mitattuna päästä päähän pienimmällä keholla, ilman yhtään
näppäintä: **182 framea eli 3,03 sekuntia** ensimmäisestä kosketuksesta. Se on
se lause numeroina.

Ja siitä seuraa suoraan se mikä tekee ensimmäisestä kohtaamisesta reilun. Keho
on 16 px, ja kuoppa jonka pohja on 16 px pinnasta ei mahdu hukuttamaan sitä —
pää jää rajalle pikselilleen. **2-1:n kuoppa on yhden ruudun syvyinen**, eli sen
turvallisuus on todistettavissa eikä luvattavissa: `verify.mjs` pudottaa
voimatason 0 pelaajan siihen, ei paina mitään 900 framea ja toteaa hänen olevan
yhä siinä. **2-3:n kuoppa on kahden ruudun**, 32 px, ja pelin kehot ovat
16/26/30/34/38/43 px — joten voimatasot 0, 1 ja 2 voidaan vetää alle ja 3, 4 ja
5 eivät. Sama kauppa kuin kaikilla muillakin uhilla, sanottuna geometriana.

### Missä sitä on, ja missä ei

- **2-1 opettaa.** `dune_sink` korvaa `coins`-palikan ja kantaa samat neljä
  kolikkoa, joten kenttä on saman mittainen ja sama lattia; uutta on vain se
  mitä kolikoiden alla on. Opetettava asia on se jota ei voi arvata: nappi ei
  ole hiekassa hyppy. Se maksaa täällä pari sekuntia kelloa eikä mitään muuta.
- **2-3 testaa.** `dune_sink_deep` korvaa toisen `walkers`-palikan ja pitää
  molemmat kävelijänsä, joten vihollismäärä, pituus ja lattia ovat ennallaan ja
  ainoa uusi asia kentässä on kaksi ruutua hiekkaa. Se on laavakenttä, eli
  "lattia voi tappaa" on lause jota kenttä on jo sanonut neljätoista palikkaa —
  ja hiekka on sen toinen lukutapa: laava on välitön eikä siihen ole vastausta,
  hiekka antaa kolme sekuntia ja siihen on. Vastakkaiset opetukset, eri näköiset,
  eri tuntuiset.
- **Ei 2-2:een**, jonka ainoa tehtävä on piilokaistat. **Ei 2-N:ään**, jonka
  paletissa tiili ja maa ovat 0,4 % päässä toisistaan — pelin heikoin pari ja
  tiedossa oleva ongelma, eli väärin paikka ruudulle joka pitää tunnistaa
  väristä. **Ei 2-M:ään**, jonka alkukävely on olemassa siksi ettei tappion
  uusiminen maksaisi paljon. **Ei 2-F:ään**, koska linnakkeessa on kivilattia.

### Kolme paikkaa oli neljä

ROADMAP varoittaa että uusi ruutumerkki on kolme paikkaa eikä yksi. Se on nyt
**neljä**, ja neljäs on `tools/difficulty.mjs`: ruutu jota mittari ei tunne
maksaa nolla, ja piikkikävelijä teki tämän virheen samana aamuna. Koska käyrän
muoto on nyt portti eikä tuloste, väärä luku ei olisi ollut vain väärä raportti.

Hiekka maksaa **1,2 sarakkeelta kun se on syvä ja 0,5 kun se on matala** —
matala ei voi tappaa, ja hinta on siitä mitä se ottaa: kellon, vauhdin ja sen
mikä oli perässä. Laavan 1,5 alle koska laava on välitön; piikkipedin 1,0 yli
koska piikkipeti on yksi hyppy ja yksi voimataso, kun taas kuopasta on
kiivettävä ylös ilman sitä liikettä joka avaa kaiken muun tässä pelissä.
**2-1 115,7 → 117,4** ja **2-3 156,1 → 159,3**; maailman 2 muoto on yhä
`117 → 126 → [124|159]`, tasan yksi notko, ja käyrä nousee joka maailmassa.
`src/data/difficulty.js` ajettu uusiksi.

**Eikä `SOLID` ollut oikea vastaus, eikä `DEADLY` myöskään.** Hiekka on omassa
joukossaan `SINK`, ja perustelu on kirjoitettu auki joukon viereen: kiinteänä
sen *pinta* olisi mennyt lattiaprofiiliin, jolloin pohjaton lammikko — kuilu
jonka päälle on maalattu hiekkaa — olisi mennyt läpi tavallisena maana.
Kuolettavana taas vuotokartoitus olisi lakannut kulkemasta siitä läpi ja
keksinyt ansan, mitä se on rakennettu olemaan keksimättä. Oma sääntö
`checkQuicksand` vaatii kaksi asiaa jotka ruudukko osaa sanoa: **pohja** ja
**reuna** — reuna mitattuna samaa hyppybudjettia vasten kuin kaikki muukin,
koska varoaika tekee sijoittelusta koko työn. Hiekka aukealla on säikähdys;
hiekka kuilun pohjalla on kuolemantuomio jonka lukemiseen annetaan kolme
sekuntia.

### Maahanisku hautaa, tähti ei kanna

Kaksi samana päivänä liikkunutta asiaa, molemmat päätettyinä eikä sattumalta.

**Maahanisku** (v26.08.09.31) ajaa alaspäin kovaa, ja rehellinen lukutapa
hiekan päällä on epäystävällinen: kovempi tulo, syvemmälle. Syöksy hiekkaan
peruu itsensä — ei aaltoa, ei jälkijähmeää, hiekka nieli koko liikkeen — ja
jättää jälkeensä 20 framea kymmenen kertaa heikompaa otetta. **Varoajasta
katoaa 47 %: 182 framea putoaa 97:ään.** Matalassa kuopassa sekään ei tapa,
koska pohja on pohja eikä uppoama ole teleporttaus, ja yksi rimpuilu peruu sen —
reagoinut pelaaja saa sen mistä maksoi.

**Supertähti** liittyi listaan *kuoppa, laava, kello* eikä listaan *viholliset,
maan piikit*. Hiekka ei ole huoneessa oleva asia joka lyö, se **on** huone. Ja
tähtilohko on 2-1:ssä, eli sama kenttä joka opettaa hiekan jakaa myös sen
kuolemattomuuden — väärä lukutapa olisi tehnyt uhasta näkymättömän kahdeksitoista
sekunniksi juuri siellä missä se opetellaan.

### Kuva ja ääni, kumpikin väistäen kolmea väärää lukutapaa

Ruudulla hiekan piti hävitä kolmelle naapurille eikä yhdellekään: aavikon
maalle, laavalle (ja jään railolle) ja kuilulle. Maa on valaistu ylhäältä ja
*vaalenee* pintaa kohti; tämä tummenee eikä sillä ole lakkia lainkaan, mikä on
se yksi asia joka saa lammikon lukemaan reikänä eikä lattiana. Mitattuna
`verify.mjs`:ssä: **hiekka vastaan aavikon maa 38,7 %** ja **hiekka vastaan
laava 24,3 %**, kun aavikon oma maa/tiili-pari on 8,6 % — kynnys on tuo pari,
koska se on pelin heikoimpia eikä tavoite. Laava ja railo ovat molemmat
*harjanne*: yksi kirkas viiva ruudun poikki, siniaallolla siirrettynä, kulkien
sivusuuntaan. Harjanne on siis se muoto jota tällä ei saa olla, joten se
**pyörii**: kaksi pientä rengasta vastakkaisiin suuntiin, mikä ei mene mihinkään
ja lukee jonakin jota hämmennetään alta.

Ääni on `upota`, ja sen koko suunnittelu on "ei pyyhkäisy eikä märkä". Laava ja
vesi ovat molemmat pyyhkäisyjä — yksi suodin liukumassa yhtenäisen kohinan yli,
sama muoto jota `dive` jo käyttää (2400 → 300 Hz puolessa sekunnissa, eli se
läheltä piti) — ja märkä tulisi `farty`sta, joka on talon ääni kaasulle nesteen
läpi. Jäljelle jää se mitä hiekka on: **rakeita.** Kuusi lyhyttä purskausta
seitsemänkymmenen millisekunnin välein, kukin kapea (Q 9, joten se soi eikä
suhise) ja kukin edellistä matalampi. Korva lukee jonon **aineena** eikä
liikkeenä. Alla yksi hyvin matala runko ilman kuultavaa liukua. `verify.mjs`
lukee lähdekoodia pitääkseen `farty`n poissa tästä rivistä — päätös joka muuten
kumoutuisi hiljaa.

Rimpuilulla on oma äänensä `kahlaa`, ja se **saa** olla kaasua, koska se on
kaasua: 0,13 s ja 118 Hz lähes kuivana, kun `fart` on 0,3 s ja 150 Hz puoliksi
märkänä. Lyhyt, matala, tukahtunut — hiekan alta.

### Testit, ja mikä niistä oli punaista

Ensimmäisellä ajolla punaisena: hiekkaa ei ollut yhdessäkään kentässä (0/26),
uppoamistestit eivät päässeet ajoon asti (`Cannot read properties of undefined`),
hiekka vastaan aavikon maa **0,0 %**, pohjaton lammikko ei tuottanut yhtään
huomautusta (*"ei mitään"* — eli juuri se hiljainen lukutapa), seinien sisään
kaivettu kuoppa ei tuottanut huomautusta, **vaikeusmittari 7,2 vastaan 7,2 eli
+0,0**, ja uusi merkki puuttui kaikista neljästä paikasta.

Yksi testi oli vihreä liian helposti ja se korjattiin: kahlausnopeutta mitattiin
pelaajalta joka oli puskemassa penkkaa vasten, jolloin lukema oli 0,00 px/frame
riippumatta siitä hidastaako hiekka mitään. Nyt matka mitataan lammikon
vasemmasta reunasta ja väite on sidottu olemassa olevaan vakioon eikä valittuun
suhdelukuun: kahlauskaton on oltava alle puolet kävelykatosta. Samasta syystä
ulospääsy mitataan **kuopan pohjalta** eikä reunalta — reunalta pääsee yhdellä
potkulla, ja se ei ole se tapaus jota lupaus koskee.

Uppoaminen on kolme tavallista numeroa pelaajassa (`sunk`, `kickCd`, `plunge`),
joten `savestate.js` kantaa sen ilman riviäkään tallennuskoodia: pikatallennus
kesken uppoamisen palaa kesken uppoamista, 43 framea pinnan alla molemmin puolin.

`playable.mjs` ennallaan: 2-1 pysähtyy yhä sarakkeeseen 264, täsmälleen kuten
ennen muutosta (todennettu ajamalla erikseen ilman muutoksia), eikä 2-3 pysähdy.

---

## v26.08.09.34 — kamera ennakoi myös laskun

Omistajan raportti v26.08.09.23:n jälkeen: *"pystykameran liike kun pudotaan
maanpinnan yläpuolella olevalta tasolta on **edelleen** nykivää."* Nousu
korjattiin ennakoimalla; tämä on sama akseli alaspäin, ja se oli yhä väärin.

### Ankkuri oli jalat, eivätkä jalat ole asettunut viiva

Pudotessa jalat laskevat TERMINALin vauhtia mutta ease sulkee vain neljänneksen
erosta framea kohti, ja eksponentiaalinen ease asettuu tasan
`(1 − 0,25)/0,25 = 3v` kohteensa taakse. Kuva siis kulki koko matkan **12 px
velkaa** — ja koska jalat pysähtyvät osumassa kertaheitolla eikä kuva pysähdy,
**velka maksettiin vasta laskeutumisen jälkeen.**

Mitattuna, oikealta reunalta oikeassa kentässä käveltynä ja hypättynä: kuva
liikkui vielä **10 framea ja 6,97 px** laskeutumisen jälkeen (4-1), 9 framea ja
4,30 px (2-3), 9 ja 4,12 (2-1). Se on inertiaa, ja `updateCamera`in oma
kommentti sanoo suoraan että inertia on juuri se mikä saa tasohyppelyn
tuntumaan merenkäynniltä.

**Miksi omistaja sanoi nimenomaan "maanpinnan yläpuolella olevalta tasolta":**
tavalliset 15-rivin kentät piilottivat vian. 1-1 mittasi 2 framea ja 0,71 px —
ei siksi että kamera käyttäytyi, vaan siksi että 208-rivin ikkunassa kameralla
on vain 32 px pystyliikkumavaraa ja kentän oma raja pysäytti kohteen (ja maksoi
velan) jo ennen kuin jalat ehtivät perille. Kirjekuorikentissä ja kaistoissa,
joissa kameralla on tilaa, mekanismi näkyy sellaisena kuin se on.

### Korjaus on CAM_TOP_LEADin peilikuva

Ankkuri tähtää siihen **mihin jalat ovat menossa**, ei siihen missä ne ovat:
`vy * 3`, kolme framea samalla laskutoimituksella kuin nousussa — kolmen framen
ennakko kumoaa kolmen framen viiveen — **ja katkaistuna siihen pudotukseen joka
oikeasti on alla**. `dropBelow()` katsoo jalkojen alla olevat ruudut samalla
säännöllä jolla `moveY` laskeutuu, joten kun lattia tulee ennakon sisään,
ankkuri pysähtyy sille viivalle jolle jalatkin pysähtyvät ja jää odottamaan.
Kuva easettaa siis lopullista arvoaan kohti putoamisen viimeiset framet ja
**saapuu pelaajan mukana** eikä hänen peräänsä.

Tulos: pahimmillaan 2,94 px / 7 framea (4-1) entisen 6,97 / 10 sijaan, 1,81 / 6
(2-3) entisen 4,30 / 9 sijaan, ja 1-1:ssä kuva pysähtyy framen sisällä, 0,36 px.
Kuoppaan putoaminen ei vastaa mitään eikä sen tarvitse: ilman lattiaa katkaisu
on ääretön, ennakko on `vy * 3`, ja putoamista seurataan kuten mitä tahansa.

**Ennakko saa kasvaa vain sitä vauhtia jolla painovoima sen kasvattaisi**, ja
juuri se rajoitus on syy siihen että `camLead` muistetaan framejen yli. Ennakko
kertoo nopeuden, joten mikä tahansa joka muuttaa putoamisvauhtia yhdellä
framella siirtää kohdetta kolminkertaisesti — sama ansa jonka CAM_TOP_LEAD
dokumentoi pieruhypylle, ja tässä se on **maahanisku**, joka menee paikallaan
roikkumisesta 7,5 px/frameen kahden framen välissä. Ilman rajoitusta kuvan oma
nopeus muuttui **6,79 px kahden framen välissä** iskun alussa, siinä missä
vanha koodi muutti sitä 1,87 — nykäisy omistajan omalla määritelmällä. Rajoitus
painaa sen 1,75:een, alle sen mitä korvattava koodi teki. Tavallinen putoaminen
ei muutu lainkaan, koska putoavan kappaleen vauhti
kasvaa tasan GRAVITYn verran framessa eikä raja koskaan pure. Sama rajoitus
kattaa toisenkin tavan jolla lattia voi kadota yhdessä framessa: murenevan
lankun, tai sen reunan yli liukumisen jolle oli laskeutumassa.

Isku maksaa turvallisuutensa ennakkona ja siis velkana: 8,47 px / 11 framea
2-3:ssa entisen 11,51 / 12 sijaan. Parempi, ei poissa, ja luku on väitetty
sellaisena kuin se on.

### Punainen ennen vihreää, ja mitä punainen sanoi

Kolme uutta testiä `verify.mjs`:ään. `a view that has fallen stops when the
player stops` kaatui lukemiin `4-1 jump 6.97 px / 10 framea, 2-3 walk 4.30 px /
9 framea` ja `a ground pound is not followed down by the view it landed under`
lukemaan `2-3 pound 11.51 px / 12 framea`. Kolmas — että ennakko ei saa maksaa
itseään maasta tai pidosta — oli vihreä jo ennen korjausta ja on sitä yhä.

Nousun korjaus (v26.08.09.23) ei liikahtanut pikseliäkään: `a view that has to
rise animates instead of snapping` lukee edelleen rivi riviltä saman, pahin
frame 1,95 px.

### Mitattu ja jätetty korjaamatta

`CAM_SNAP` **ei osu yhteenkään putoamiseen**: leveintä eroa kuvan ja sen
halutun paikan välillä mitattiin 14,5 px, kynnys on 48. Sen sijaan korotetulle
tasolle **laskeutuminen** osuu siihen: 2-1:ssä aavikon lattia kehystyy kentän
80 px liikkumavaran pohjalle ja neljän ruudun taso kohtaan 30, joten ankkurin
askel kosketuksessa on 50 px ja `CAM_SNAP` leikkaa kaikki 50 yhdellä framella.
Se on nouseva akseli eikä se mistä omistaja raportoi, joten se on kirjattu
`level.js`:ään ja jätetty rauhaan sen sijaan että sitä korjattaisiin sokkona.

---

## v26.08.09.33 — luulaakso, ja keskiyö joka lyö kaksitoista

Maailma 6, **LUULAAKSO**: hautausmaa keskiyöllä, neljä kenttää, oma teema, oma
musiikki ja luurankopomo. Peli on nyt **6 maailmaa ja 26 kenttää**.

Teema tehtiin sen listan mukaan jonka roadmap itse antoi — *"teema on paletti +
taustat + palikat + musiikki, ei pelkkä väri"* — ja neljä osaa ovat
`THEMES.bone`, `bg: 'bones'`, `src/data/chunks/bone.js` ja `TRACKS.bone`.

### Musiikki: Saint-Saëns, ja ehto joka lakkasi olemasta lupaus

**Camille Saint-Saëns (1835–1921), *Danse macabre* op. 40, 1874.** Vapautui
1.1.1992 (suoja = elinaika + 70 vuotta). Valinta oli päätetty jo 9.8.2026 ja se
on aihevalinta eikä tyylivalinta: teos *on* tanssivia luurankoja keskiyöllä, ja
sen kuuluisin yksityiskohta — ksylofonin kalisteleva kuvio — on nimenomaan
luut. Saint-Saëns käytti saman vitsin uudestaan "Fossiles"-osassa, eli hän piti
sitä itsekin luiden äänenä.

DESIGN.md kohdan 1 b ehdot täyttyvät kahdesti: **sävelet on kirjoitettu käsin**
`TRACKS`-tauluun ja syntetisoidaan ajossa, joten repoon ei tullut sampleja,
MIDI-rippiä eikä skannattua nuottia — vapautuminen koskee sävellystä, ja
yksittäinen äänite tai nuottilaitos on eri teos omine oikeuksineen. Ja lähde on
**nimetty**. Rehellisyyden nimissä yksi asia sanottava ääneen: tämä on
*sovitus*, ei transkriptio. Kolme ääntä ja rummut eivät ole orkesteri.

Sovituksen neljä fraasia ovat teoksen neljä ajatusta: **keskiyö** (kaksitoista
lyöntiä D:tä, sitten viulun tritonus A–Es), **tanssi** (laskeva d-mollivalssi,
jossa nouseva johtosävel kääntää seitsemännen tahdin dominantiksi), **ksylofoni**
(kromaattisesti alas kalisevat kuudestoistaosaparit, kolmioaallolla ja lähes
olemattomalla pidolla — lyömäsoitin on isku ja vaimeneminen) ja **laulava teema**
(pitkiä nuotteja vastapainoksi).

**Ja ehto muuttui portiksi.** Raita kantaa nyt lähteensä mukanaan (`source`
`TRACKS`-taulussa, ulos `TRACK_SOURCES`), ja `verify.mjs` vaatii että sekä
säveltäjän että teoksen nimi lukevat **sekä DESIGN.md:ssä että tässä
tiedostossa**. Kohta 1 b perusteli oman ankaruutensa sillä että nimetty lause on
tarkistettavissa ja "kaikki on itse tehtyä" ei ole — ja ankaran säännön ainoa
vika on että se unohtuu kolmannella kerralla. Nyt ei unohdu. Raita ilman
`source`-kenttää on omaa sävellystä eikä sitä kysytä miltään.

**Ja se unohtui heti ensimmäisellä kerralla**, mikä on paras mahdollinen
todiste portin tarpeesta. Griegin `cave` (v26.08.09.32) kirjoitettiin tuntia
ennen kuin mekanismi oli olemassa, joten se oli hetken ajan juuri se tapaus
jota kohta 1 b pelkää: lainattu sävelmä jonka nimeäminen on kiinni siitä että
joku muistaa. `TRACK_SOURCES` ei nähnyt sitä lainkaan, eli portti raportoi
tyytyväisenä **"1 lainattua raitaa"** kun niitä oli kaksi. `cave` sai
`source`-kenttänsä samassa yhteydessä, ja luku on nyt **2**. Portti joka kattaa
puolet tapauksista on huonompi kuin puuttuva portti, koska se näyttää kattavan
kaikki.

Yksi asia mitataan datasta eikä korvasta: **valssi on kolmijakoinen jokaista
ääntä myöten.** Sekvensserin tahti on 16 askelta eli neljäjakoinen, joten
kolmijakoisuus tehdään niin että jokainen ääni ja jokainen rumpukuvio on kuuden
askeleen monikerta (kuusi kuudestoistaosaa = yksi 3/4-tahti). Yksikin ääni
väärän mittaisena ja raita alkaisi vaeltaa muita vasten — se kuulostaisi
rikkinäiseltä eikä väärältä, eli vialta jota kukaan ei osaa etsiä. Mitattu:
`lead 48, harm 48, bass 48, fraasit 48, kick 6, snare 6, hat 6`.

### Palikoiden ehto on tehtaan ehdon peilikuva

`chunks/factory.js` perustelee olemassaolonsa yhdellä lauseella: jokaisella sen
palikalla on katto. Luumaailma tulee heti tehtaan jälkeen, ja sen sääntö kulkee
toiseen suuntaan: **ei kattoa, eikä mitään roikkumassa.**

- **Taivas on auki**: rivit 0–4 ovat tyhjiä jokaisessa luupalikassa. Tämä
  puolisko on aita *edellisen* maailman ympärillä eikä tämän — `fac_*` ei kelpaa
  tänne, koska sen katto peittäisi kuun ja tähdet joiden takia maailma näyttää
  keskiyöltä. Se on rehellisempi muotoilu kuin symmetrinen aita: liikenne joka
  pitää pysäyttää kulkee tehtaalta luulaaksoon.
- **Luu seisoo**: jokainen `X` ja `#` lattiarivien yläpuolella nojaa johonkin
  suoraan allaan. Luuranko on määritelmän mukaan asia joka kannattaa itsensä.

Jälkimmäinen maksoi jotain, ja se on koko syy kirjoittaa sääntö ylös: se sulki
pois ilmeisen ensimmäisen idean, **kylkiluukaaren reitin yli**. Kaari tarvitsee
jalat, jalat kävelylattialla ovat seinä, ja mitattua `wallTiles`-budjettia
korkeampi seinä on kenttä jota pienin koko ei läpäise. Niinpä kylkiluut ovat
tyngät haudan vieressä ja reitin yli menee lauta — lauta ei ole luuta ja saa
leijua. Molemmat puoliskot ovat `verify.mjs`:ssä eivätkä pelkässä kommentissa.

### Botti saneli geometrian, ja se on kirjattu palikka palikalta

`tools/playable.mjs` on suunnittelulupaus ajettavassa muodossa: maareitin pitää
aueta voimatasolla 0. Ensimmäinen versio maailmasta kaatui siihen **neljästi**,
ja jokainen kaatuminen muutti yhtä palikkaa. Ne ovat kirjattuina niihin
palikoihin joita ne muuttivat, koska niistä jokainen on sama oppi eri suunnasta
— *mitattu hyppybudjetti on se mihin kentät leikataan, ei se mitä vasten ne
leikataan*:

| vika | mitattu | korjaus |
| --- | --- | --- |
| hautakivi kuopan huulella | `kuilu sarakkeessa 136`, myöh. 56 ja 104 | kivet pois nousukiidosta; kolikkokaari on merkki |
| nelirivinen tiiliseinä ennen kuoppaa | `kuilu sarakkeessa 215` | seinä kolmeen riviin (`brick_wall` pitää neljänsä, maailmassa 1 on tilaa) |
| kolme kuoppaa peräkkäin | `kuilu sarakkeessa 93` | enintään kaksi ketjussa, väliin `flat8` |
| viiden levyinen piikkipeti sillan alla | `maasto sarakkeessa 130` | kaksi nelosen petiä, silta vain ensimmäisen yli |

Kokonaan pois jäi `bone_twin`, kahden kuopan pari. Kolme mittausta (5+5 kahden
ruudun saarella, 5+5 kolmen, 4+4 neljän) kaatuivat kaikki **toiseen hyppyyn**,
ja syy on `jump-budget.json`:ssa eikä botissa: paikaltaan hyppy kantaa
vaakasuunnassa **0 px**, joten saari on täsmälleen niin hyvä kuin sen jättämä
nousukiito. Maailma 6 ostaa vaikeutensa useammalla yksittäisellä kuopalla.

### Vaikeus, mitattuna

| kenttä | pisteet | mikä siinä on |
| --- | --- | --- |
| 6-1 | 242,5 | haudat: yksi kuoppamuoto opetettuna ja sitten kysyttynä |
| 6-2 | 147,5 | notko — leuat ja lohkot, vain kaksi kuoppaa |
| 6-3 | 271,5 | tanssi: kaikki mitä maailmassa on |
| 6-F | 395,4 | krypta ja luuranko |
| **w6** | **264,2** | ↑ +8,0 maailmasta 5 |

Käyrä nousee ja notkahtaa tasan kerran, kuten jokaisessa muussakin maailmassa
(`243 → 148 → 272`). Nousu maailmasta 5 on **pienin nousu koko pelissä** (+8,0
vastaan +18,8 / +25,1 / +17,0 / +66,8), ja se kannattaa sanoa ääneen eikä
piilottaa: maailman 5 kentät ovat generoituja ja lyhyitä (205–245 saraketta),
ja mittari laskee kaiken per sata saraketta, joten maailma 5 on asteikolla
korkeammalla kuin se on kädessä. Käsintehty maailma ei voi kilpailla siitä
ilman että siitä tulee gauntlet.

Ja **käyrän muoto on nyt portti eikä tuloste.** `difficulty.mjs` on tulostanut
rivin "1 notkoa / ok" pitkään, mutta tulosteen voi ohittaa; uuden maailman voisi
committoida suoraviivaisena tai laskevana eikä mikään sanoisi mitään ennen kuin
joku katsoisi. `verify.mjs` tarkistaa nyt jokaisen maailman muodon.

### Luurankopomo

`bossVariant: 4`, ja hän on olemassa olevaa koneistoa kahta asiaa lukuun
ottamatta:

- **Osuma hajottaa hänet.** Muut pomot vastaavat osumaan kiihtymällä, mikä on
  luku jonka pelaaja tuntee kolmen sekunnin päästä. Luuranko vastaa samalla
  framella: hän lentää palasiksi, luut kalisevat lattiaa pitkin ulos ja hän
  seisoo taas siihen mennessä kun ne ovat poissa. Osuma siis **maksaa myös
  tietoa** — näet että se osui — ja esittää laskun, koska aallot ovat kaksi
  asiaa joiden alta pitää päästä pois. Aalto on olemassa oleva `Shockwave` eikä
  uusi entiteetti: se on esine jonka pelaaja jo lukee oikein, ja `REGISTRY`
  pysyy koskemattomana. Mitattu: luuranko 2 aaltoa per osuma, nyrkkeilijä 0.
- **Hänellä on oma ääni**, ja se on `VOICES`-taulun ensimmäinen käyttö sen
  jälkeen kun taulu kirjoitettiin. Taulun oma kommentti sanoi että ääni jota
  kukaan ei puhu on sama virhe kuin ääni jota mikään ei soita; luuranko on
  luonteva toinen puhuja, koska hän on ainoa hahmo joka sanoo jotain *pelaajalle*.
  Ääni on kanttiaalto oktaavia alempaa, loivilla formanteilla (q 3,5/4,5 vastaan
  pelaajan 7/9 — kallossa ei ole pehmytkudosta) ja kaksinkertaisella
  konsonantilla, koska luurangossa kolisevat juuri ne osat jotka koskevat
  toisiinsa.

**Nauru tulee silloin kun kruunu lähtee päästä**, ei sitä laitettaessa. Kruunun
nousu on varoitus ja varoituksella on jo äänensä (`spikes`), joka tarkoittaa
samaa jokaisen pomon kohdalla; toinen ääni sen päälle olisi kaksi merkkiä
samasta asiasta, mikä on täsmälleen se mitä DESIGN.md kohta 8 kieltää. Kruunun
laskeminen taas on hetki jolloin häneen voi taas osua, ja siihen kuuluu
ilkkuminen. Mitattu soittolokista: yksi nauru per riisuminen, kaikki `open`-
vaiheessa.

Piikit voittavat maahaniskun myös hänellä, eikä se ollut ilmaista vaan
tarkistettu: sääntö on kirjoitettu `poundImpact`iin `e.spiky`-lipun varaan eikä
varianttiluetteloon, joten sen *pitäisi* päteä uuteen pomoon itsestään — ja
juuri sellainen väite rapautuu hiljaa. Mitattu 6-F:ssä: piikkivaiheessa 0 osumaa
ja pelaaja menetti tason, avoinna 1 osuma eikä menettänyt mitään.

Arvomerkki on **taskukello, jonka viisarit osoittavat kahtatoista**. Se
noudattaa samaa sääntöä kuin jokainen muu arvomerkki tässä tiedostossa — pyöreä,
silmien alapuolella, eikä mitään pään yläpuolella — ja se osoittaa samaan
vitsiin kuin musiikin kaksitoista lyöntiä sanomatta sitä ääneen.

### Teeman luettavuus, ja yksi löydös joka ei ole tämän työn korjattava

Kun teemakohtaiset ruutumuodot peruttiin (✘ 9.8.2026), koko ero maailmojen
välillä jäi aineeseen ja väriin — eli väristä tuli mekaniikkaa. Tiili hajoaa ja
maa ei, ja pelaajan on nähtävä kumpi on kumpi hypyn aikana. `verify.mjs` mittaa
nyt tuon parin kanavakohtaisena keskierona, ja luvut kannattaa lukea:

| teema | tiilen ja maan ero |
| --- | --- |
| yö | **0,4 %** |
| linnake | 7,9 % |
| aavikko | 8,6 % |
| ruoho | 9,3 % |
| tehdas | 17,9 % |
| jää | 22,3 % |
| **luu** | **48,7 %** |

Luumaailman maa on luuta ja sen tiili hautamultaa — kaksi eri ainetta eikä saman
aineen kaksi sävyä — ja testi vaatii että se on koko pelin selvin pari, eli
kynnyksenä on nykyinen paras eikä jokin luku. **Yön 0,4 % on löydös eikä tämän
työn korjattava:** `#7a5a30` ja `#6a5030` ovat käytännössä sama väri, eli 2-N:ssä
rikottava lohko sulautuu maahan. Yön paletin muuttaminen muuttaisi valmiin
kentän ulkonäön, ja se on oma päätöksensä.

### Muuta samassa erässä

- **Kartalle kaksi uutta maastomerkkiä**: `b` paljas luumaa ja `K` kallo, joka
  on `TALL_TERRAIN`issa (piirtoala y+4…y+14 osuu polun pisteen musteeseen
  y+5…y+10 kuten puu ja vuori). Ruudukko rakennettiin **säännöstä käsin**: tien
  raivausalue laskettiin ensin ja kalusto istutettiin siihen mikä jäi jäljelle —
  21 pyydettyä, 21 istutettua, 0 hylättyä.
- **Taustalle `bones`**: kylkiluita ja kuolleita puita horisontin kukkuloilla,
  ja ne ovat maisemaa **vaaleampia** — päinvastoin kuin muualla, koska keskiyön
  siluetti erottuu vain jos se on taustaansa vaaleampi. Sää on virvatulia:
  sama hiukkasmoottori kuin tehtaan kekäleillä, mutta sinivalkoinen, hitaampi ja
  matkalla sykkivä. Kuu on pelin suurin.
- **Maapinnan kuvio on pystysuora** (`surface: 'bone'`), ainoana pelissä. Hiekan
  kerrokset, metallin paneelit ja kiven saumat ovat kaikki vaakaan; pystykuvio
  pilkkoutuu sarakkeisiin kameran liikkuessa, mikä on se ero joka näkyy
  kävellessä eikä vain paikallaan seistessä.

---

## v26.08.09.32 — luolalla on oma ääni: Grieg, ja miksi se ei ole löytymisen merkki

Piilokaistan luolahuoneet (`cave_room`, `fac_cellar`, `tomb_cave`) ovat olleet
olemassa pitkään eivätkä ole kuulostaneet miltään erityiseltä. Nyt kuulostavat.

**Edvard Grieg (1843–1907), *I Dovregubbens hall* — "Vuorenkuninkaan luolassa",
näytelmämusiikista *Peer Gynt*, 1875. Sävellys vapautui tekijänoikeudesta
1.1.1978** (tekijän elinaika + 70 vuotta kuolinvuoden lopusta laskettuna). Tämä
on [DESIGN.md](DESIGN.md):n kohdan 1 b ensimmäinen käyttö, ja sen ehdot pitävät:
sävelet on kirjoitettu käsin `TRACKS`-tauluun `[sävelaskel, pituus]`-pareina
samalla tavalla kuin jokainen muukin raita tässä pelissä, ja ne
syntetisoidaan ajossa. **Ei sampleja, ei MIDI-rippiä, ei skannattua nuottia** —
vapautuminen koskee *sävellystä*, kun taas yksittäinen äänite ja yksittäinen
nuottilaitos ovat eri teoksia omine oikeuksineen. Lähde on nimetty tässä,
DESIGN.md:n taulukossa ja `audio.js`:n raidan yllä.

### Miksi juuri tämä teos: se kiihtyy

Valinta ei ole tunnelmavalinta vaan rakennevalinta. Bonushuone jossa ei ole
kiirettä on bonushuone johon pelaaja jää seisomaan. Griegin teos on yksi teema
toistettuna yhä uudelleen, joka kerta nopeammin ja kovempaa — se sanoo "älä jää
tänne" ilman että sitä kirjoitetaan ruudulle.

Ensimmäinen selvitettävä asia oli **osaako moottori kiihtyä lainkaan.** Se osasi
vaihtaa vaihdetta muttei kiihtyä: `Music.setHurry` ja osioiden `speed` ovat
kertavaihtoja, jotka kuullaan vaihtumassa ja joihin johdatellaan omalla
tahdikkeellaan. Kiihdytys on eri muotoinen asia — kaltevuus, jota mikään ei
ilmoita ja jossa yksikään askel ei ole kuultavasti edellistä nopeampi. Siksi
tuli `paceAt(track, step, loopLen)`: raidan `accel`-kenttä kertoo paljonko
lähtötempoa lisätään kierrosta kohti ja mihin se pysähtyy, ja se luetaan
**absoluuttisesta askelluvusta**, joten se on jatkuva eikä nykäise kierroksen
vaihtuessa. Luolaraita: `{ per: 0.18, max: 2 }`, eli tempo 88 → 176.

Mitattu `verify.mjs`:ssä sekunneista eikä vakiosta: **askel 121,4 ms → 60,9 ms
(1,99×)** kuuden kierroksen jälkeen, ja vertailuna sama mittaus kenttäraidalle,
joka ei kiihdy: **96,2 ms → 96,2 ms.** Kiihtyvyys myös nollautuu paikasta
lähtiessä (2,00× → 1,01×), koska `Music.play` nollaa askellaskurin: kiihtyvyys
on kello *tälle* käynnille eikä rangaistus siitä että kävi kerran aiemmin.

### Kysymys joka piti ratkaista ennen yhtäkään säveltä: paikka vai tapahtuma

Kaistalle saapuminen **on** jo salaisuuden löytyminen, ja sillä on merkkinsä:
`noteSecret` kirjaa löydön, putki soi, kartan salaisuuslaskuri nousee. Kaksi
peräkkäistä "jotain tapahtui" -signaalia opettaa lukemaan väärää merkkiä
(DESIGN.md kohta 8), joten musiikinvaihto ei saanut olla toinen samaa sanova
merkki. Ratkaisu on että se sanoo eri lajin asian:

| | löytyminen | musiikki |
| --- | --- | --- |
| laji | tapahtuma | paikka |
| kesto | hetki | niin kauan kuin siellä ollaan |
| montako kertaa | kerran ikinä | joka käynnillä samanlaisena |
| mistä johdettu | matkan päätöshetki | jalkojen sijainti joka framella |

Koodissa siitä seuraa kolme asiaa, ja ne ovat syy siihen ettei tämä ole yksi
rivi `tryWarp`issa:

1. **Sama mittaus kuin löydöllä.** `bandAt(feetY)` on nyt yksi funktio, jota
   sekä `noteBand` että `updateBandMusic` lukevat samalla framella samoista
   jaloista. Kaksi eri tapaa päätellä kaista olisi ennen pitkää eronnut
   pikselin verran, ja bugi olisi ollut huone joka on löydetty muttei kuulosta
   itseltään.
2. **Matkan aikana ei tapahdu mitään.** Vaihto sillä framella jolla putki nielee
   pelaajan olisi osunut suoraan löydön päälle.
3. **`BAND_MUSIC_DWELL` = 24 framea.** Pelkkä "putken jälkeen" ei riitä: vaihto
   sillä framella jolla ohjaus palaa olisi matkan viimeinen isku, ja matka on
   tapahtuma.

Mitattu: **löytö framella 0, ohjaus takaisin framella 31, musiikki framella
54.** Ilman odotusaikaa musiikki tuli framella 31 — täsmälleen samalla framella
kuin ohjaus, nolla framea erotusta. Se luku on testissä eikä muistissa.

Ja toisinpäin: toisella käynnillä raita on `cave` uudelleen vaikka löytöjä on yhä
yksi. Löytymisen merkki soisi kerran; paikan ääni soi joka kerta.

### Taivaskaista pitää kentän oman musiikin — päätös, ei unohdus

`sky_garden` ja `fac_loft` eivät saa omaa raitaa. Ilmeiseltä näyttävä sääntö
olisi "piilokaista → erikoismusiikki", mutta se on sama kohdan 8 virhe
naamioituneena: yksi raita kahdelle vastakkaiselle paikalle tarkoittaisi "olet
salaisuudessa" eikä "olet maan alla" — eli musiikista tulisi taas löytymisen
merkki. Luolaraita sanoo jotain paikkakohtaista (täällä on pimeää, täällä asuu
jotain, älä jää), eikä aurinkoinen puutarha pavunvarren päässä ole mitään
niistä. Kuva on samaa mieltä, mikä on kohdan 8 toinen puolisko: luolakaista on
jo valmiiksi pimennetty (`drawUnderground`), taivaskaista ei, koska se on taivas.

### Kaksi vartijaa, kaksi testiä

Kuoppaan putoaminen käy luolakaistan puolella ennen laavakantta — mitattuna
**yhden framen ajan**. Sitä ei estä odotusaika vaan kuolemaportti
(`state !== 'play'`, `p.dying`), koska sillä framella kuolema on jo tapahtunut.
Molemmat vartijat on todistettu erikseen punaisella: odotusaika pois → musiikki
framella 31 (0 erotusta), kuolemaportti pois → yksi frame luolamusiikkia
kuolinsyöksyn aikana. Kumpikaan ei siis esitä toista.

Muuta samalla korjattua: **kello ei nollaudu raidan mukana.** `Music.play`
aloittaa jokaisen raidan rauhallisena, joten luolaan meno vähissä ajoissa olisi
vienyt kiireen pois — signaalin joka on jo ansaittu. `updateBandMusic` asettaa
sen takaisin, ja se on testattu (aikaa 84, raita `cave`, kiire päällä).

Pikatallennus luolassa palaa luolan musiikkiin ilman että tallennusmuotoon
tuli yhtään uutta kenttää: `enter()` lukee raidan jaloista, ja `restoreState`
kutsuu sitä. Testattu soittamalla väliin `title` ja lataamalla sen päälle.

---

## v26.08.09.31 — maahanisku, ja sen hinta

Ilmassa **alas + hyppy** syöksee Pieruprinssin maahan pierun voimalla. Ohjaus
oli jo vapaana: `down` + `jump` yhdessä ei tarkoittanut ilmassa mitään.

Suurin osa tästä kirjauksesta on hinnasta eikä liikkeestä, koska hinta on se
mikä ratkaisee onko peliin tullut uusi liike vai onko siitä tullut ainoa liike.

### Se ei saa korvata tallausta, joten se maksaa aikaa jona et ohjaa

Tallaus on pelin perusverbi: se tappaa, se pomppauttaa sinut turvaan, ja se ei
maksa yhtään ohjattavaa framea. Pelkästään isompi liike olisi lopettanut
tallauksen uran ilmestymispäivänään, joten maahanisku ostaa leveytensä ajalla:

| vaihe | framea | mitä pelaaja voi tehdä |
| --- | --- | --- |
| lataus (`POUND_CHARGE`) | 12 | ei mitään — hahmo roikkuu paikallaan |
| syöksy (`POUND_SPEED` 7,5 px/frame) | korkeudesta riippuen | ei mitään, ei sivuttaisohjausta |
| maassa (`POUND_LAG_MIN` + korkeus) | 16…36 | ei mitään, **eikä ole kuolematon** |

Mitattu `verify.mjs`:ssä samalta korkeudelta, sama nappi pohjassa: **tallaus 0
framea ilman ohjausta, maahanisku 47.** Ja sivusuunnassa: sama pudotus oikealle
painaen kantaa vapaassa pudotuksessa 16 px, maahaniskussa **0 px**.

Lataus ei ole pelkkä maksu vaan myös ainoa hetki jona ruudulla oleva ehtii
lukea liikkeen ja siirtyä alta pois. Maassa oloaika kasvaa korkeuden mukana
tarkoituksella: se versio joka osuu kovimmin on myös se joka jättää sinut
seisomaan pisimpään, koska tasainen maksu olisi tehnyt parhaasta tapauksesta
suoraan parhaan.

**Eikä se korvaa tallausta myöskään vahingoltaan.** Tavallisen hypyn korkeus on
mitattuna noin kolmannes huoneesta (`1-1`: 70 px 192:sta = 0,36), ja
`POUND_KILL_AT` on puolet. Arkinen maahanisku siis **tainnuttaa** — kupla, sama
kuin pierupallolla — ja tallaus on yhä se liike joka tappaa. Vasta pudotus
jonka yllä on oikeasti tilaa muuttuu tappavaksi.

### Voimataso vahvistaa, ei avaa

Sama lupaus kuin muualla (DESIGN.md kohta 5). Perusliike toimii voimatasolla 0
— mitattu — ja voimataso ostaa kaksi asiaa: sädettä (`POUND_REACH_PER_LEVEL`
5 px/taso) ja halvemman kynnyksen iskuaallolle. Aalto vaatii voimatasolla 0
kolme neljäsosaa huoneesta ja voimatasolla 5 kolme kymmenesosaa, eli **taso 0
saa sen korkeudella ja taso 5 halvemmalla, mutta kumpikaan ei saa sitä
hyppäämällä paikaltaan.**

Ummetus tukkii koko liikkeen samasta syystä kuin se tukkii pieruhypyn, hännän
ja murtavan olkapään: syöksy on kaasua ja korkki on korkki. Se ei ole voimaportti
— korkki on ajastin jonka joku laittoi sinuun, ei taso jota et kerännyt.

### Piikit voittavat sen

Päätetty etukäteen ja toteutettu kirjaimellisesti: `poundImpact` ohittaa
`e.spiky`-viholliset kokonaan, jolloin alle jäänyt piikkiukko jää seisomaan ja
tavallinen törmäystarkistus sattuu pelaajaan — **täsmälleen se tappio jonka
tallauskin ottaa.** Mitattu sekä piikkiukolla (voimataso 3 → 2, piikkiukko
hengissä) että pomolla: piikkivaiheessa **0 osumaa ja pelaaja menetti tason**,
avoimena **1 osuma eikä menettänyt mitään**. Ilman tätä juuri rakennettu pomon
piikkisykli olisi lakannut olemasta sykli.

### Korkeus mitataan, ei arvata

`poundScale(fromY, toY)` normalisoi pudotuksen laskeutumiskohdan omaan y:hyn.
Perustelu on moottorissa: `tileAt` vastaa `T.HARD` kaikelle `ty < 0`, eli taivas
on kansi eikä minkään kappaleen yläreuna voi olla nollan yläpuolella. Suurin
mahdollinen pudotus kohtaan `toY` on siis `toY` itse — mitattu luku eikä vakio,
ja siksi 1,00 tarkoittaa "tämän huoneen katosta" yhtä lailla 15 ruudun kentässä
kuin 30 ruudun kentässä. Todennettu kahdella kentällä joiden katto on eri
korkeudella: **1-1 pudotus 192 px = 1,000 ja 1-2 pudotus 432 px = 1,000**, ero
240 px. Vakioon sidottu asteikko ei voi antaa kumpaakin.

### Kuva ja ääni kuuluvat tähän työhön (DESIGN.md kohta 8)

Kaksi uutta ääntä, ja niiden **pituus on se mikä erottaa ne**. Muutosloki sai
juuri (v26.08.09.25) `sprout`in: pelin ainoa lohkoääni jolla on kesto, koska
se mitä se kuvaa kestää. Sama argumentti käännettynä ylösalaisin:

- **`dive` kestää 0,55 s** ja on `sprout` väärinpäin — liuku laskee siinä missä
  pavunvarren nousee, suodin sulkeutuu siinä missä pavunvarren aukeaa. Syöksy
  kestää, ja lyhyt haukahdus olisi sanonut "valmista" sillä hetkellä kun mikään
  ei ole valmista.
- **`slam` kestää 0,2 s** ja on kokonaan etupainoinen. Se on myös kokonaisen
  oktaavin `stomp`in alapuolella (110→34 Hz vastaan 700→130 Hz), koska juuri
  tallaus on se liike jota tämä ei saa korvata ja se soi jatkuvasti.

Iskuaalto on uusi olio (`PoundWave`) eikä pomon `Shockwave`, ja ero mitataan
pikseleistä: **isku rgb(164,227,105), vihreä−punainen +63; pomo rgb(208,172,106),
−36.** Rytmi samoin: pomon aalto välkkyy kahden kuvan väliä kolmen framen
jaksolla ja jää ruudulle 90 framea, maahaniskun aalto aukeaa kerran pehmeästi
ja on poissa — **12 framessa erilaisia ruutuja: isku 12, pomo 2.** Tärinä
seuraa korkeutta (1,5…6,0, mitattu 2,4 matalalta ja 6,0 katosta).

Pelaajan sprite ei muutu. Se oli valinta: tintit tarkoittavat tässä pelissä
"ei voi satuttaa", ja maassa oloaika on juuri se hetki jona voi — värjätty
hahmo olisi valehdellut siitä mikä on koko liikkeen hinta.

### Portti

Neljätoista uutta tarkistusta `verify.mjs`:ään, ja punainen ensin: kahdeksan
kaatui ennen muutosta (`iskua ei tullut 400 framessa`, `vapaa pudotus 24 framea
ja 16 px sivuun, maahanisku 400 framea ja 580 px`, `poundScale is not a
function`, `korkeusasteikko … ero 0 px`). Testit eivät kysy onko liike olemassa
— se olisi mennyt läpi myös silloin kun liike on korvannut tallauksen — vaan
mittaavat hinnan, rajat ja asteikon. `PoundWave` on `REGISTRY`-taulussa, ja
pikatallennus kesken syöksyn palaa kesken syöksyn ja laskeutuu loppuun.

---

## v26.08.09.30 — kartta saa hengittää: polku raivattuna, laatta väljänä, tiet mutkalla

Kolme valitusta omistajalta, joka pelasi kartan läpi. Ne ovat yksi työ, koska
ne ovat sama kuva: **puut seisovat polulla, numerolaatta on ahdettu täyteen ja
tiet on vedetty viivaimella.** Kaikki kolme on nyt mitattu eikä katsottu.

### 1. Kalusto ei saa seisoa siinä mihin tie menee

Puu polulla ei ollut piirtojärjestysvirhe — `drawTerrain` on aina ajettu ennen
`drawLinks`iä, eli viiva on maalattu puun **päälle**. Se ei silti auta: latvus,
runko ja pisteet luetaan yhtenä sotkuisena läiskänä. Viivalla pitää olla paikka
missä olla.

Siksi tämä on **datasääntö eikä piirtokorjaus**. `worldProblems` sai säännön 8:
`TALL_TERRAIN` (`T P M C R " E`, ne seitsemän jotka nousevat maasta) ei saa
seisoa `clearZone`n sisällä, ja se vyöhyke on jokainen polun ruutu **sekä sen
neljä sivunaapuria**. Puuta polulla ei voi enää committoida.

Miksi naapuritkin — mitattu, ei arvattu. Piirretään maasto kahdesti, kerran
oikeana ja kerran ilman korkeaa kalustoa; erotus **on** kaluston muste, ja siitä
lasketaan tyhjät pikselit polkuun. Pelkillä polkuruuduilla vastaus on **2 px**:
vuori täyttää ruutunsa viimeiseen riviin, 4 px ylös mutkalla oleva tie yltää
omansa riville y+5, ja pisteen tumma reunus lepää vuoren juurella. Naapurit
mukaan luettuna tiukin paikka viidellä kartalla on **7 px** — pisteen oma
leveys. Molemmat luvut ovat portissa, joten tämä kappale ei voi hiljaa lakata
olemasta totta.

Hinta oli **36 siirrettyä koristetta** viidessä maailmassa. Yhtään ei poistettu:
jokainen istutettiin uudelleen paikkaan johon tie ei mene, ja kaluston määrä on
maailma maailmalta sama kuin ennen (32 / 15 / 22 / 15 / 32).

### 2. Laatta kasvoi ulos ruudustaan, ja se maksoi 12 px naapurin väliä

Numero, vaikeuspalkki ja salaisuusmerkki jakoivat yhden 16x16-ruudun, ja
mitattuna **jokainen väli oli 0 px**: merkin oikea reuna numeron vasemmassa
sarakkeessa, laatan alareunus kiinni palkin varjossa, palkin viisi pykälää
pikselin päässä toisistaan. Sitä ei korjaa järjestelemällä uudelleen 16x16:n
sisällä — 3 + 5 pikseliä sisältöä ja 2 px ilmaa joka saumaan ei mahdu
kuuteentoista reunusten kanssa.

Nyt laatta on 16x13 ja alkaa 2 px ruudun **yläpuolelta**, palkki 20x5 ja päättyy
2 px sen **alapuolelle**; pykälän jako on 4 px entisen 3:n sijaan. Jokainen
sauma on 2 px. Mitä se maksaa 320x240-puskurissa:

- leima 20x21 = 420 px² entisen 256:n sijaan, 0,55 % puskurista per solmu;
- kartan lähin solmupari on kaksi ruutua eli 32 px erillään (`w2-3` ja `w2-m`),
  joten leimojen väliin jää **12 px** karttaa entisen 16:n sijaan; lähin
  pystypari on kolme ruutua ja jättää 27;
- lähin polku joka ei liity solmuun kulkee 28 px sen keskeltä, ja leiman ja
  polun väliin jää **17 px**;
- alin kenttäsolmu on rivillä 7, jonka palkki loppuu y=143. Paneeli alkaa 158.

Vanha kommentti kielsi palkkia vuotamasta ruudustaan, koska se muuten osuisi
naapurin maastoon tai naapurin palkkiin. Huoli oli oikea ja johtopäätös väärä:
sitä ei ollut mitattu. Nyt se on, ja portti mittaa kaikki neljä lukua joka ajo —
sinä päivänä kun joku siirtää solmun kaksi ruutua lähemmäs, portti sanoo sen.

Linnakkeen portin vasen pieli kaventui pikselin, jotta salaisuusmerkki saa saman
2 px:n ilman kuin kenttälaatassa. Reittitaulun sarakkeet siirtyivät neljä
pikseliä oikealle leveämmän palkin perässä.

### 3. Tiet mutkittelevat, ja nappula kulkee sitä samaa mutkaa

Jokainen suora saa kaksi ohjauspistettä, kolmannekseen ja kahteen kolmannekseen,
sivuun työnnettynä. Kaksi eikä yksi: yksi työnnetty keskipiste on kulma, kaksi
riippumatonta antaa kaaren kun ne ovat samaa mieltä ja laiskan S:n kun eivät.

Poikkeama tulee **solmujen tunnusten tiivisteestä**, ei `Math.random()`ista.
Kartta piirretään uusiksi kuusikymmentä kertaa sekunnissa ja rakennetaan
tallennuksesta joka latauksella; satunnainen mutka madeltaisi silmissä ja olisi
eri tie pikatallennuksen jälkeen. Mitattu mutka on 2,0–4,0 px.

`BEND_MAX = 4` on kantava luku eikä makuasia: piste on kuusi pikseliä leveä eli
yltää 3 px viivan kummallekin puolelle, ruudun keskeltä reunaan on 8, ja
4 + 3 = 7 < 8. Mutkitteleva tie ei siis pääse ulos niistä ruuduista jotka linkki
ilmoittaa kulkevansa — ja juuri ne ruudut naapureineen on raivattu kohdassa 1.
Viitosella tie alkaisi tökkiä maahan jota mikään ei ole sille raivannut.

**Kuva ja liike lukevat saman geometrian.** `linkCurve` on `worlds.js`:ssä, ja
sekä `drawLinks` että kävelevä nappula lukevat sen. Aiemmin molemmat rakensivat
omat pisteensä `linkPoints`ista, mikä oli harmitonta niin kauan kuin tie oli
suora ja muuttui valheeksi heti kun se ei ollut: kuva mutkittelisi ja nappula
oikaisisi. Se on juuri se jako josta DESIGN.md 8 puhuu, joten korjaus ei ole
"mutkitellaan molemmissa samalla kaavalla" vaan "kaavoja on yksi". Mitattu
poikkeama nappulan reitin ja piirretyn käyrän välillä: **0,000 px**.

Sivutuote: pisteet lasketaan nyt koko tien matkalta eikä pätkä kerrallaan.
Vanha silmukka laski askeleet segmentissä, ja kahden ruudun hypyn kolmannes on
yksitoista pikseliä — `round(11/8)` on 1, ja silmukka joka juoksee ykkösestä
alle ykkösen ei piirrä mitään.

### Punainen ennen vihreää

Kaikki seitsemän väitettä nähtiin punaisena ennen kuin mitään korjattiin:
kalustoa vyöhykkeessä **36 kpl**, polun ja kaluston väli **−1 px** (eli
päällekkäin), `worldProblems` ei tunnistanut polulle istutettua puuta, laatan
välit **0 / 0 / 0 / 0 px**, mutkan syvyys **0,0 px**.

---

## v26.08.09.29 — kolikkojono vie putken päälle

Salaisuuksien löydettävyys, kolmesta osasta toinen. Kartta kertoi jo *että*
kentässä on salaisuuksia ja montako on löytynyt; nyt kentässä itsessään on
vihje siitä mistä yksi niistä aukeaa. Demo-osuus on erikseen ja tekemättä.

### Mihin vihje kuuluu, ja mihin se ei kuulu

Pelissä on 59 salaisuutta (`secretKeys`, mitattu). Vihjeen sai kolme niistä, ja
loput 56 jätettiin tahallaan rauhaan. Rajan veti yksi kysymys: **onko
salaisuuden avaaminen tavallista pelaamista vai ei.**

- **Lastattu tiili, tähtilohko, pavunvarren `?`-lohko.** Kaikki avautuvat
  lyömällä lohkoa alhaalta, mikä on se mitä pelaaja tekee muutenkin joka
  ruudussa. `star_block`in oma perustelu sanoo sen suoraan: palkinto on siitä
  että löi lohkoa joka näyttää ihan tavalliselta lohkolta. Kolikkojono niiden
  päällä sanoisi "tämä lohko on eri" ja tappaisi koko mekaniikan.
- **Kytkin.** Oma ruutunsa, oma piirroksensa, ja tiililaatta näkyvissä pään
  päällä. Se lukee jo.
- **Warp-putki.** Vaatii että seisot sen päällä ja painat **alas**. Mikään muu
  pelissä ei tee sitä. Tämä on pelin ainoa salaisuus johon ei voi kompastua.

Ja juuri se oli ilman vihjettä: `fac_duct_down` sai kolme kolikkoa jo
kirjoitushetkellä, mutta `warp_pipe` — 1-2, 2-2 ja 3-2 — ei ollut saanut
mitään. Mitattuna ennen: kahdeksasta tiestä salaiselle kaistalle **viidellä oli
kolme kolikkoa ja kolmella nolla.**

### Miksi juuri nämä kolikot

Kolme kolikkoa kuoppariville, sarakkeisiin −3, −1 ja +1 putken vasemmasta
reunasta. Jokainen luku on perusteltu, eikä yksikään ole makuasia:

- **Ne maksavat itsestään.** Rivi 9 on neljä ruutua lattian yllä ja paikaltaan
  hyppy nostaa mitattuna 71 px eli 4,4 ruutua jo voimatasolla 0. Ohikulkija saa
  ne ilmaiseksi. Tämä on ero vihjeen ja kyltin välillä: vihjeen seuraaminen ei
  maksa mitään silloinkaan kun se ei vie mihinkään.
- **Ne vievät jalat, eivät katsetta, ja vievät ne paikkaan eivätkä esineeseen.**
  Jono tulee vasemmalta ja sen viimeinen kolikko on putken oman vasemman
  sarakkeen yllä, joten se hyppy joka poimii sen laskee putken kannelle — sinne
  missä pitää seistä. Mikään ei osoita suuaukkoa eikä mikään ole keskitetty sen
  päälle (poikkeama keskeltä 1,5 ruutua).
- **Sama rivi on tavallisen putken päällä.** `pipe_short` sai täsmälleen samat
  kolme kolikkoa. 2-2 asetti tavallisen putken warp-putken eteen nimenomaan
  siksi ettei warp olisi kyltti; vihje pelkälle warpille olisi purkanut sen.
  1-1 on se kenttä jossa tapa opetetaan, eikä 1-1 kätke yhtään mitään — eli
  ensimmäinen putki josta pelaajalle maksetaan ei vie minnekään.

Mitattuna koko pelin yli: **kuoppakaistalla on 219 kolikkoriviä ja niistä 14
(6,4 %) on salaisuuden kohdalla.** Kolikkorivi on siis tavallinen näky ja huono
ennustaja, mikä on juuri se mitä vihjeeltä vaaditaan.

### Portti

Kuusi uutta riviä `verify.mjs`:ään, ja punainen ensin: kaksi niistä kaatui
ennen muutosta (`8 sisäänkäyntiä, kolikoita 0/3/0/3/0/3/3/3` ja `6 putkea,
4 warppia, kolikkorivit [] [-3,-1,1]`). Testit eivät kysy onko jono olemassa
vaan mittaavat ne ominaisuudet joista vihje muuttuu kyltiksi: saako kolikot
pienimmällä koolla ilman salaisuutta, koskettaako jokin kolikko sisäänkäyntiä,
onko jono keskitetty sen päälle, ja kuinka usein kolikkorivi ylipäätään
tarkoittaa jotain. Vaikeustaulukko ei liikkunut lainkaan — kolikko ei ole
uhka eikä kuilu.

---

## v26.08.09.28 — kaksi teosta lisää vapautuneiden listalle

Omistajan valinta, jatkoa kohdan 1 b avaukselle. Sävellyksiä ei ole vielä
kirjoitettu; tämä on lista ja sen perustelu.

**Edvard Grieg (k. 1907), *Vuorenkuninkaan luolassa* (Peer Gynt, 1875)** —
vapautui 1.1.1978. Menee **luolakaistaan**, ja se on ainoa näistä kolmesta jolle
on käyttö jo tänään: piilokaistat ovat olemassa (`cave_room`, `fac_cellar`,
`tomb_cave`) eikä niillä ole omaa musiikkia. Teoksen oma rakenne on syy valita
juuri se: se **kiihtyy**, eli se sanoo "älä jää tänne" ilman että kukaan
kirjoittaa sitä ruudulle. Bonushuone josta ei ole kiire on bonushuone jossa
pelaaja seisoo.

**Modest Mussorgski (k. 1881), *Yö Autiovuorella* (1867), Rimski-Korsakovin
sovitus 1886** — vapautui 1.1.1952, sovitus 1.1.1979. Menee **viimeiseen
linnakkeeseen**, kun sellainen on.

**Kaksi säveltäjää yhdellä rivillä ei ole huolimattomuutta**, ja tämä on koko
kohdan 1 b idea toiminnassa: *Yö Autiovuorella* tunnetaan lähes yksinomaan
Rimski-Korsakovin sovituksena, ja **sovitus on oma teoksensa omine
suoja-aikoineen**. Juuri siinä "tämähän on vanhaa musiikkia" menee useimmiten
pieleen. Molemmat ovat vapaita — mutta se on kaksi tarkistusta eikä yksi, ja
siksi molemmat lukevat DESIGN.md:n taulukossa.

---

## v26.08.09.27 — vapautunut sävelmistö sallitaan, nimettynä

Sääntömuutos, ei koodimuutos. [DESIGN.md](DESIGN.md) sai kohdan **1 b**, ja
[README.md](README.md) kertoo sen lyhyesti heti alussa.

Kohta 1 sanoi tähän asti että kaikki melodiat ovat omia, piste. Sääntö oli
tarpeettoman tiukka: **tekijänoikeus vanhenee**, ja vanhentunut sävellys on
yhtä vapaata materiaalia kuin genrekonventio kohdassa 2 — se on nimenomaan sen
kohdan oma logiikka vietynä loppuun.

Ehto on että lähde **nimetään**. Se on ankarampi kuin vanha sääntö eikä
löysempi, ja tämä on koko muutoksen ydin: *"kaikki on itse tehtyä"* on väite
jota kukaan ei voi tarkistaa, kun taas *"Camille Saint-Saëns (1835–1921), Danse
macabre op. 40, 1874"* on lause jonka kuka tahansa todentaa kymmenessä
sekunnissa. Nimeäminen menee sekä DESIGN.md:n taulukkoon että tänne.

**Miksi tämä on turvallista juuri tässä pelissä.** Vapautuminen koskee
*sävellystä*; yksittäinen äänite ja yksittäinen nuottilaitos ovat eri teoksia
omine oikeuksineen, ja niihin useimmat kompastuvat. Tämä peli ei koske
kumpaankaan — sävelet kirjoitetaan käsin `TRACKS`-tauluun ja syntetisoidaan
ajossa, joten repoon ei tule sampleja, MIDI-rippiä eikä skannattua nuottia.
Sama piirre joka on aina ollut alkuperäväite (kohta 1) tekee tästä halvan.

Muuttumatta jäi se sääntö joka oikeasti suojaa: **suojattua muistuttava sävelmä
ei mene sisään.** Vain sana "olemassa oleva" vaihtui sanaksi "suojattu".

Ensimmäinen ja toistaiseksi ainoa käyttö on **luumaailman teema**:
*Danse macabre* (1874, vapautui 1.1.1992). Valinta on aihevalinta eikä
tyylivalinta — teos *on* tanssivia luurankoja keskiyöllä, ja sen ksylofonikuvio
on nimenomaan kalisevat luut. Sävellystä ei ole vielä kirjoitettu; se tulee
luumaailman mukana.

Kirjattiin myös se mitä **ei** saa ottaa: Jean Sibelius kuoli 20.9.1957, joten
*Finlandia* ja *Karelia* vapautuvat vasta **1.1.2028**. Se on juuri se hylly
johon suomalaisessa pelissä ensimmäisenä kurkotetaan.

---

## v26.08.09.26 — portti ei enää heitä kolikkoa äänitestissä

`a spoken line is loud enough to hear` kaatui satunnaisesti noin joka toinen
ajo. Se ei ollut äänivika vaan mittausvika, ja **portti joka kaatuu sattumalta
on pahempi kuin puuttuva testi**: se opettaa ohittamaan punaisen.

Rivi mittasi väylän pohjakohinan odotettuaan kiinteät 900 ms. Perustelu oli
oikea — suite on soittanut ääniä minuutin ajan, väylän pitää antaa rauhoittua —
mutta luku oli arvaus siitä miten pitkä häntä viimeisellä äänellä sattuu
olemaan. Mitattuna tausta oli milloin **0,000 ja milloin 3,029**: rivi ei
mitannut kohinaa vaan sitä ehtikö edellinen ääni loppua. Vika on vanha, ei
tämän aamun: todennettu ajamalla `230dacc` sellaisenaan (`ok` / `FAIL 3,029`).

Nyt väylää kuunnellaan kunnes se on hiljaa, **samalla 200 ms:n ikkunalla jolla
lopputulos mitataan** ja kaksi peräkkäistä ikkunaa. Molemmat ehdot ovat
mittaustuloksia eivätkä makuasioita:

- eri ikkuna hiljaisuudelle (60 ms) ja mittaukselle (200 ms) kaatui omaan
  mittaansa — "hiljeni 182 ms, tausta 19,450", eli portti julisti hiljaisuuden
  keskellä ryminää;
- yksi ikkuna kahden sijaan osui `sprout`in **sisäiseen taukoon** (kopsahdus,
  hiljaisuus, nouseva kahina): tausta 0,000 ja heti perään ääni 4,250, eli
  mittaus luuli mittaavansa yhtä puhuttua riviä ja mittasi kahinaa sen päällä.

Punainen tehtiin tahallaan, koska satunnaista vikaa ei voi muuten toistaa:
neljä ääntä soi yhtä aikaa juuri ennen mittausta. Vanhalla odotuksella se
kaataa rivin **3/3 ajossa** (tausta 0,104 / 0,116 / 0,104), uudella se menee
läpi **5/5** ja tausta on joka kerta 0,000. Rauhoittuminen kestää mitattuna
1473–1618 ms, eli 900 ms ei koskaan riittänyt.

---

## v26.08.09.25 — pavunvarsi kasvaa lohkosta

Varsi oli tähän asti **pysyvästi näkyvissä**: salaisuuden palkinto seisoi
kentässä ensimmäisestä framesta lähtien. Nyt se on seuraus lohkon lyömisestä —
tavallisen näköinen `?` pudottaa pavun, papu putoaa lattialle ja varsi kasvaa
siitä ruutu kerrallaan taivaskaistalle asti.

### Validointi ratkaistiin ensin, ei viimeisenä

Tämä oli koko työn vaikea kohta. `rules.js` todistaa taivaskaistan
saavutettavuuden **varresta**: `vineCrossings` etsii ruudukosta yhtenäisen
köysipylvään joka ylittää kaistojen sauman. Jos varren ruudut yksinkertaisesti
poistaisi kenttädatasta, validaattori ei enää löytäisi vartta eikä saumaa — se
ei kaatuisi vaan **hiljenisi**, ja hiljainen kattavuuden menetys on pahempi kuin
punainen portti.

Ratkaisu: **kenttädata on kasvanut kenttä**, ja moottori johtaa siitä kasvamattoman.
`chunks/secrets.js` piirtää varren kokonaan, `LevelScene.plantVines` nostaa sen
elävästä ruudukosta pois ja jättää tilalle `?`-lohkon varren omaan sarakkeeseen
bumppirivillä. Yksi totuuden lähde, ja portti tarkistaa juuri sen tilan jonka
pelaaja lopulta saa.

Ero kahden kuvan välillä on rehellinen vain niin kauan kuin kasvaminen on
**taattu**, joten se tarkistetaan eikä oleteta. Uusi `checkBeanBlocks` kysyy
jokaiselta sauman ylittävältä varrelta kolme asiaa, ja jokainen on se osa
"lohkoon yltää" -väitteestä johon ruudukko osaa vastata:

- **onko varsi juurtunut** — alimman ruudun alla on oltava jotain jonka päällä
  seistään. Sinne papu putoaa, sieltä varsi lähtee, ja se on myös ainoa paikka
  josta valmiiseen varteen tartutaan.
- **mahtuuko lohko siihen** — se riippuu `BEAN_BLOCK_OVER_FLOOR` (4) riviä
  lattian yllä varren omassa sarakkeessa, joten varren on oltava sen mittainen.
- **yltääkö siihen** — pienimmän kehon pää on rivin lattian yllä, eli lohko on
  kolme riviä sen yläpuolella mitattua neljän ruudun hyppybudjettia vastaan.
  Vakio molemmin puolin, ja juuri siksi tarkistettu eikä muistettu.

Kirjattu myös se mitä **ei** tarkisteta: lohko itse on kiinteä ruutu joka on
olemassa vain ajonaikaisesti. Se ei ole luotettu vaan rajattu — se seisoo
solussa jonka kenttädata sanoo köydeksi, ja `checkVines` on jo todistanut sen ja
molemmat naapurisarakkeet kivestä vapaiksi suurimmalla koolla.

### Lohko on varressa, ei sen alla — ja se on mittaustulos

Ensimmäinen toteutus oli ilmeinen kuva: lohko bumppirivillä ja varsi kasvamassa
sen päältä ylöspäin. **Mitattuna se oli rikki.** Varteen tartutaan seisomalla
sen juurella ja painamalla ylös; kun varsi alkaa vasta bumppiriviltä, lohko
itse on hypyn tiellä, ja kaikista tarttumisyrityksistä (kävellen ja juosten,
kaikki hyppyframet 0–59) **yksikään ei onnistunut voimatasoilla 0 ja 1** —
salaisuus muuttui saavuttamattomaksi juuri sillä koolla jolla kentän luvataan
toimivan. Siksi lohko istuu varren **sisällä** ja kasvu kirjoittaa köysiruudun
kulutetun lohkon päälle ohi mennessään: valmis varsi kulkee lattiasta taivaaseen
katkeamatta, ja tarttuminen on täsmälleen se mikä se ennenkin oli.

### Kuva ja ääni yhdessä

Papu tulee ulos lohkon **alapuolelta** — jokainen muu `?`-lohkon palkinto
nousee yläkautta, ja kaksi samannäköistä tapahtumaa opettaa yhden väärän
opetuksen kumpikin (DESIGN.md §8). `drawSprout` on oma spritensä eikä
paukkupavun uusiokäyttö samasta syystä: paukkupapu on ruskea, halkeillut ja
poimittava, tämä on vaalean vihreä siemen jota ei voi koskea.

Ääni `sprout` on ainoa lohkoääni jolla on **pituutta**: kolikko, tehostus ja
tömäys ovat ohi kymmenesosasekunnissa ja sanovat "tässä, ota", mutta varsi
kiipeää puolitoista sekuntia ja suurimmaksi osaksi ruudun yläpuolella. Puinen
kopsahdus, sitten nouseva suodatettu kahina ja liuku jotka kestävät kasvun yli.

### Muut jäljet

- `Beanstalk` on entiteetti eikä ajastin kohtauksessa: kasvava kärki on jotain
  mitä katsotaan, ja `savestate.js` sarjallistaa jo jokaisen entiteetin oman
  kentän — pikatallennus puolimatkassa palaa puolimatkaan ilman uutta kenttää
  missään. Lisätty `REGISTRY`-tauluun (DESIGN.md §6).
- Debug-overlayn salaisuuslaskuri laskee istuttamattoman varren varreksi. Luku
  joka ilmestyy vasta kun testaaja on jo löytänyt asian ei auta ketään.
- `tools/verify.mjs`: punainen ennen vihreää sekä mekaniikalle että
  validaattorille — kolme rikottua kiinnitintä (varsi ilmassa, varsi kuilun
  päällä, varsi liian lyhyt) ja sama kiinnitin ehjänä.

---

## v26.08.09.24 — ruskea pilvi näyttää vihdoin siltä miltä se käyttäytyy

Kuolleiden lippujen auditoinnin (9.8.2026) **taso A, kohta 1** — ainoa löydös
jonka pelaaja huomaa — on korjattu.

`StinkCloud.draw` antoi `drawStinkCloud`ille kirjaimellisen `true`:n
**molemmilta kutsupaikoiltaan**, joten `stinkBody`n rauhallista ilmettä ei
piirtynyt kertaakaan. Sillä ilmeellä oli tehtävä: kuplasta karannut pilvi
liikkuu `ANGRY_SPEED`in verran eli **1,6 kertaa nopeammin**, ja kulmakarvat
olivat se paikka jossa peli kertoo sen. Kiihdytys tapahtui, kertominen ei.
Nyt naama seuraa oliota, ja kaksi kertaa kymmenessä sekunnissa kohdattu
vihollinen näyttää siltä kummalla tavalla se kulloinkin liikkuu.

Myös **kuoleva pilvi piirtyy omalla tilallaan** eikä pysyvästi vihaisena. Se ei
ole siisteyttä vaan [DESIGN.md](DESIGN.md) §8: kaksi samannäköistä merkkiä
opettaa lukemaan väärin, ja kulmakarvat jotka tarkoittavat sekä "nopeutui" että
"kaatui" eivät tarkoita kumpaakaan.

Testi vertaa kahta muuten identtistä pilveä pikseli pikseliltä, koska juuri se
ero oli nolla — ja mittaa sen: **ennen 0 px, nyt 8 px** (kaksi 4×1 kulmakarvaa,
eikä mitään muuta). Vertailu tehdään framella 0, koska karkulainen myös vilkkuu
(`get tint`) ja vilkkuva framen valinta olisi mitannut vilkun eikä ilmettä.

---

## v26.08.09.23 — putken suunta kenttiin asti, ja kamera ennakoi nousun

### `WARP_COMPAT` on poissa

v26.08.09.19 korjasi säännön moottoriin mutta jätti yhteensopivuuslipun päälle,
koska kenttien ulostuloputket seisoivat lattialla ja tiukka sääntö olisi
**sulkenut pelaajan bonushuoneeseen**. Nyt kentät on korjattu ja lippu poistettu.

Kaikki suut ovat **rivillä 9**, eikä se ole makuasia: suun alahuulen pitää
mahtua korkeimman pään yli (21×43 = kolme ruuturiviä) **ja** pysyä pienimmän
ulottuvilla, joten kolme tyhjää riviä lattian yllä on ainoa korkeus jota
jokainen koko voi käyttää.

**Yksi moottorin muutos, jonka mitta pakotti:** ylöspäin kurottaminen *pään*
suhteen ei voi toimia. Kuusi kehoa ovat 16/26/30/34/38/43 px, joten kiinteällä
lattialla ja kiinteällä suulla pään ja suun väli on eri luku joka voimatasolla —
ja yksi ruutu ei kata 27 pikselin hajontaa. **Mitattuna tasan kolme kuudesta
koosta pääsi sisään.** Kurotus on nyt kolme ruutua **jaloista**, mikä on se
"seiso suun alla" -sääntö jota vanha kommentti jo väitti tarkoittavansa.

`fac_duct` jakautui kahdeksi (`fac_duct_down`, `fac_duct_up`) ja `fac_loft` ei
muuttunut lainkaan — siitä poistuminen on alaspäin, ja se sanoo sen nyt itse.

**Kattoputki tietää suuntansa naapurista:** `drawTile` saa jo `above`-ruudun
(alun perin maatiilen ruohoa varten), joten putki yläpuolella tarkoittaa että
tämä suu on riippuvan putken alapää, ja piirros peilataan ruudun keskiviivan yli
yhdellä muunnoksella — suu ja hohde samassa, jotta ne eivät voi ajautua erilleen.

`rules.js` osaa nyt suunnan: `warpMouths` palauttaa suun **ja sen ainoan suunnan
johon siitä voi matkustaa**. Aiemmin validaattori siunasi lattiaputken
ulospääsyksi ylöspäin — juuri se tarkistus jonka tehtävä on estää jäämästä
lukkoon.

Todistettu ajamalla eikä lukemalla: viisi bonushuonetta × kuusi kokoa, jokainen
sisään ja ulos.

### Kamera ennakoi nousun

Omistajan raportti: pito toimii ja alaspäin seuraaminen on hyvä, mutta kun hahmo
nousee tarpeeksi korkealle, **kuva hyppää** eikä liu'u.

Syy oli v26.08.09.19:n oma valinta: `CAM_TOP_MARGIN` sovellettiin **kovana
rajana easen jälkeen**. Sillä framella kun pää ylitti rajan, kuva siirtyi
kertaheitolla seuraamaan sitä.

Korjaus ei ole rajan pehmentäminen vaan **aikaisemmin liikkeelle lähteminen**:
raja tähtää siihen missä pää on kolmen framen päästä, jolloin ease on jo
vauhdissa kun raja alkaisi purra. Kolme on `(1 − CAM_V_EASE)/CAM_V_EASE`, eli
easen oma asettumisviive — **pidemmät ennakot mitattiin ja ne olivat huonompia**
(pahin frame ennakoilla 3/4/5/6/8 = 1,95/2,21/2,49/2,68/2,88 px), koska ennakko
kertoo nopeuden ja pieruhyppy portaittaa sen.

**Suurin yhden framen kameraliike noustessa: 2,92 px → 1,95 px**, ja saavutettu
usean framen aikana yhden sijaan. Pää ei enää yllä rajaan lainkaan (16,00 →
16,02…16,28), eli **kova raja siirtää kuvaa nykyään 0,00 px ja on verkko eikä
mekanismi.**

`CAM_SNAP` tarkistettiin eikä muutettu: se **ei laukea** noustessa, 0 framea
seitsemässä mitatussa tapauksessa.

Kaksi rehellistä huomiota luvuista. Mittari piti rajata hyppyihin jotka alkavat
*asettuneesta* kuvasta — rajaamattomana se lukee 6,70 px, mutta se on kuva joka
liukuu juuri saavutetulle tasanteelle, eli alaspäin seuraaminen toimimassa. Ja
`the view does not ride a jump upward` lukee 2-1:n voimatasolla 3 nyt 0,27
px/frame eikä 0,00: se hyppy huipentuu 16,4 px kuvan reunasta, **0,4 px vajaaksi
vanhan rajan laukaisemisesta**, joten se aina liikutti kameraa — nyt se ajelehtii
0,93 px koko kaaren aikana sen sijaan että astuisi.

### Kaksi velkaa maksettu

`watchSecrets`-kääre on poistettu: `bumpTile` ja `tryWarp` kirjaavat löydöt itse.
Avain otetaan **raa'asta ruudusta**, koska päällä oleva kytkin näyttää tiilet
kolikkoina. `worldmap.js` ei enää tuo `LevelScene`ä.

Ja `boss_arena_big`in kuollut kopio `factory.js`:ssä on poistettu — elävä on
`fortress.js`:ssä, ja portti vahti varjostusta siihen asti.

## v26.08.09.22 — kävelyn ohitusasento, kiipeilyasento ja kolme toisen tason seisontaa

### Kävely kulkee ohitusasennon kautta

Kolme jalka-framea olivat aina oikein — 0 ja 2 ovat kosketukset, 1 on ohitus —
mutta ajuri pyöritti niitä `% 3`:lla, joten kerran jokaisessa askelparissa 2
kiertyi suoraan 0:aan ja hahmo laski **molemmat jalat maahan kahdesti peräkkäin.**
Nyt `% 4` ja taulu `[0,1,2,1]`.

Auditointi ennusti korjauksen oikein, mutta kaksi asiaa piti mitata:

- **Piirtopuolen `s.frame % 3` piti silti muuttaa.** Kutsujien osalta ennuste
  piti — 0, 1 ja 2 kuvautuvat itselleen — mutta framea 3 ei ollut, joten se
  olisi piirtynyt framena 0 ja tuottanut auki→auki uudelleen.
- **`% 4` yksin on kolmannes vähemmän askelia samalle matkalle.** Kävelykatolla
  vanha ajastin antaa 6,8 px kosketusta kohti, ja saappaanjälkien väli on 7 px —
  lähes täydellinen istutus. Korjaamaton `% 4` antaisi 9,1. `animTimer` on siis
  skaalattu, jolloin tahti säilyy ja vain epätasaisuus poistuu.

Samalla kutsupaikat pelin ulkopuolella (alkuruudun kävelijä, voittokortti,
karttanappula) ajavat sykliä nyt samasta vakiosta kuin moottori. Ne käyttivät
kirjaimellista kolmosta, ja **juuri siksi ne olisivat jääneet vanhaan
kiertoon sen jälkeen kun kenttä korjattiin.**

### Kiipeilyasento, ja puolet siitä oli jo koodissa

`animFrame` laskettiin köydelle kahden framen sykliksi ja **heitettiin pois**,
koska `Player.state()` palautti `'jump'`. Nyt se palauttaa `'climb'`, ja asento
on olemassa: hahmo selin, ei silmää, niska varjossa, kädet ylös nostettuina
niille samoille sarakkeille joissa riippuvat kädet jo ovat — joten laatikkoon ei
kosketa. Jalat nousevat vastakkain ylhäällä olevan käden kanssa.

Piirtäminen pakotti yhden korjauksen: 14 pikselin kehossa pää on yhdeksän, joten
nostettu käsi asettui kiinni päähän ja ne sulautuivat ihonväriseksi möhkäleeksi
jolla on hattu. Yhden pikselin varjoreuna erottaa ne.

### Kolme toisen tason seisontaa

Tavallisessa kentässä hahmo **nukahtaa**, jäässä **hengittää ulos jääpuikkoja**,
aavikossa **tukka syttyy** ja hän sammuttaa sen paniikissa.

**Laukeaa 1200 framen jälkeen, ja luku on lainattu eikä valittu:** se on
alkuruudun oma `DEMO_AFTER`, joten pelissä on **yksi kuollut aika eikä kahta**,
ja pelaaja oppii sen kerran. Ensimmäisen tason hengitys on koskematta ja alkaa
yhä heti. Katkeaa yhdessä framessa: `threatNear()` nollaa laskurin kun mikä
tahansa aktiivinen vihollinen tai vaara on kuuden ruudun sisällä.

**ZZZ on symboli, ja se ratkaistiin eikä sivuutettu.** Roadmap oli oikeassa
siinä että jääpuikot ja liekki ovat huoneen tekoja hahmolle mutta ZZZ ei ole.
Konventio ei kuitenkaan ole tälle pelille uusi: `addScorePop` leijuttaa jo
sanoja maailman koordinaateissa niiden yläpuolella jotka ne ansaitsivat, ja
`UMMETUS` ponnahtaa pelaajan omasta päästä. ZZZ liittyy siihen kerrokseen eikä
avaa uutta.

Raja kirjattiin siihen **missä koodi asuu**: symboli piirretään kehon templaatin
ulkopuolella, kiinteässä koossa joka **ei skaalaudu voimatason mukana**, eikä se
ota kehon sävytystä. *Ajatus ei kasva siitä että ajattelija syö sienen.*

### Kaksi bugia jotka portti nappasi ja silmä ei

4×4 Z:n yhden pikselin diagonaali kosketti vain kulmista, joten kirjain hajosi
kahdeksi kappaleeksi. Ja kolme Z:tä lyhyellä matkalla sulautui yhdeksi nauhaksi.
Molemmat löytyivät yhtenäisyystarkistuksesta — samasta vuotäytöstä joka löysi
hengityksen repimän pelaajan v26.08.09.18:ssa.

**Ja yksi jonka silmä nappasi ja portti ei:** pesukarhun korvat jäivät
paikoilleen kun pää nyökkäsi.

## v26.08.09.21 — kävelijä täyttää laatikkonsa, ja kaikki elävä hengittää

### Kävelijän piirros laatikkoon

`Walker` on 16×16 mutta piirtyi `+1..+15` leveänä ja `+3..+16` korkeana, eli
**pään yllä oli 3–4 pikselin vyöhyke joka satutti näkymättä.** Omistajan päätös
oli **kasvattaa piirros laatikkoon eikä kutistaa laatikkoa piirrokseen**, koska
laatikko on nyt anteliaampi kuin miltä näyttää ja kutistaminen tekisi
tallauksesta tiukempaa kaikkialla — ja kävelijä on se olio jonka muunnelmia
kaikki muut ovat. Nyt kate on **0 kaikilla neljällä sivulla**, jokaisessa
framessa, molempiin suuntiin, molemmissa hengitysvaiheissa. Törmäyksiin ei
koskettu: `entities/enemies.js` on ennallaan.

Muut oliot mitattiin mutta jätettiin: kilpikonna 1 px, kuori 2 px, piikkiukko
1 px sivuilla (ja piikit 2 px yli — *vaaratonta* taidetta vaarallisen näköisessä
paikassa), kasvi 1 px, ummetuskorkki 2 px, ruskea pilvi 1 px joka sivulla.
Papuparooni oli ainoa joka täytti laatikkonsa valmiiksi. **Jokainen luku on nyt
nimetty sallittuna arvona portissa**, joten minkä tahansa korjaaminen on yhden
merkin muutos ja testi kertoo jos joku frame jäi.

**Sivulöydös, korjattu:** `drawFlyer` syötti olion raa'an tickin
`walkerBody`lle, jonka jalkojen vaihto on `frame % 2` — **lentäjän jalat
vaihtuivat joka framessa**, eli 30 Hz:n välkyntä eikä askellus.

Toinen: ummetuskorkki piirtyi joka toisessa framessa **1 px laatikkonsa alle**,
koska sen vanha `hop` siirsi koko kehoa pohjia myöten. Hyppy muuttui hengitykseksi.

### Hengitys: 163 framea, eikä luku ole keksitty

Ehdokkaat aseteltiin samalle aika-akselille pelin jo lähettämän hengityksen
(pelaajan seisonta) viereen, yksi merkki per frame. 32 ja 64 framea on vapinaa,
96 on hermostunut, 260 antaa kävelijän ylittää puoli ruutua hengitysten välissä.
**163 epäsymmetrisellä kynnyksellä** — ylhäällä 0,93 s, alhaalla 1,8 s — on se
rytmi joka pelissä jo on, ja symmetrinen jaksosuhde lukisi metronomina eikä
hengityksenä. Luku on siis `Math.round(Math.PI * 2 * 26)`, ei arvaus.

### Vaihesiirto, ja sen rehellinen hinta

Pääosa hajonnasta on ilmaista: jokaisen olion `tick` alkaa siitä kun kamera
herättää sen, joten eri hetkellä kohdatut ovat jo eri vaiheessa. Paikkatermi
kattaa sen tapauksen joka jää — ryhmä joka herää samalla framella.

**Hinta sanottuna ääneen:** kävelevä olio kantaa siirtymänsä mukanaan, joten
paikkatermi on myös tahdin muutos — 164 framea paikallaan, 127 oikealle
kävellessä, 229 vasemmalle. Ruutuhilaan napsautettu vaihe erottaisi naapurit
paremmin, ja se hylättiin koska se hyppäyttäisi vaihetta joka kerta kun olio
ylittää ruudun rajan. Roadmap kieltää sen, ja **testi valvoo sitä**: 4 pikselin
siirtymä saa liikuttaa hengitystä korkeintaan yhden animaatiotikin verran, kun
hilaan napsautettu versio liikuttaisi sitä ~54.

### Hengitys ei ole siirto, ja se on todistettu

Ylä- ja alareuna on naulattu ja liike tapahtuu niiden välissä: kävelijällä
kruunu rivillä 0, jalat rivillä 15, hartiat nousevat ja jalat venyvät perässä.
Kokonaan liikkuva keho jättäisi lattiarivin tyhjäksi tai avaisi uudelleen sen
vyöhykkeen jonka työn ensimmäinen puoli sulki.

Valvonta on kolminkertainen, 176 framea × molemmat suunnat × 9 spriteä: taide
laatikon ulkopuolella, laatikko ilman taidetta, ja **yksi yhtenäinen kappale** —
sama vuotäyttö kuin pelaajan auditoinnissa, koska hengitys joka naulaa toisen
pään ja liikuttaa keskeltä on täsmälleen se virhe joka repi pelaajan kahtia
v26.08.09.18:ssa.

### Kaksinkertainen hengitys vältetty nimeltä

Ruskea pilvi (sinibobi), lentäjä (pomppu), papuparooni (fyysinen hyppy,
tarkistettu koodista), aurinko, kuu ja kuplassa olevat jätettiin rauhaan.
**Kuori liukuessaan ei hengitä** — pyörivä esine ei ole keho.

## v26.08.09.20 — jättiläisen areenalle portaat, ja päätös joka osoittautui vääräksi

Tehtävä oli opastaa pelaaja jättiläispomon yläkansille, koska päätös oli että
kannet *ovat* vastaus ja ongelma on vain se ettei niitä huomata. **Mittaus
kumosi päätöksen perusteen.**

### Kansille ei päässyt

Simuloitu kiipeäminen voimatasolla 0 — jokaisesta lattiasarakkeesta, seisova ja
juoksuhyppy vauhdilla ja ilman, leveyssuuntainen haku jokaisesta löydetystä
laskeutumispaikasta — löysi **täsmälleen yhden seisottavan korkeuden: lattian.**
Rivi 6 on 112 px ylhäällä, paras hyppy kantaa 85, eikä välissä ollut mitään.

Kannet eivät siis olleet vastaus jota ei huomata. Ne olivat lavastetta — ja
*siksi* ne luettiin lavasteeksi.

### Ja taistelu oli läpäisemätön

| osumaa | koko | nousu jonka seuraava tallaus vaatii |
| --- | --- | --- |
| 0 | 1,0 | 32 px |
| 1 | 1,5 | 48 px |
| 2 | 2,0 | 64 px |
| 3 | 2,5 | **80 px** |
| 4 | 3,0 | **96 px** |

Voimatason 0 hypyt areenassa: seisova 71, kävely 78, juoksu 85, P-vauhti 100.
**Hyppykorkeus ei riipu koosta**, joten nämä luvut pätevät joka voimatasolla.

Osumat 1–3 lähtevät siis lattialta, mutta neljäs vaatii 80 px ja viides — se
joka päättää taistelun — 96. Roadmapin oma "kahden osuman jälkeen" oli yhden
osuman liian aikaisin, mutta johtopäätös oli **liian lievä**: hp on 5, joten
lattialta taistelua ei voinut voittaa lainkaan.

### Korjaus pysyi rajauksen sisällä

Kokoa ei rajattu eikä kansia laskettu — kumpikin oli kielletty. Kansille tehtiin
**portaat**: askellava rivillä 9, 64 px lattiasta (tasan mitattu `wallTiles`) ja
48 px kannelle, eli kaksi tavallista seisovaa hyppyä.

**Rivi 9 eikä 10, ja se on mitattu:** pomon oma hyppy nostaa jalat y=161:een, ja
rivin 10 lava olisi y=160 — hän laskeutuisi pelaajan portaille. Marginaali on
17 px ja sillä on oma testinsä.

Lavat ovat **puulavoja eivätkä lohkoja**, joten mikään ei jää loukkuun niiden
päälle eikä iskuaalto pysähdy. Kolikkokaari piirtää sen hypyn joka portaalle vie,
ja kansilla on nyt viisi kolikkoa kahden sijaan: DESIGN.md kohta 5 kieltää
portaat tyhjään, ja tämä oli sama sääntö väärinpäin. **Kansi kannattaa nyt
kiivetä ensimmäisellä minuutilla**, kun pomoon vielä yltää lattialtakin — eli
reitti opitaan ennen kuin sitä tarvitaan.

Kasvu pudottaa **pölyä kansilavoista**: eri paikka (katto, ei lattia), eri suunta
(putoaa, ei kulje) ja eri väri kuin iskuaallolla tai auringon
ennakkovaroituksella. Ääntä ei lisätty — kasvun `fart` on jo se puolikas, ja se
soi vain kun koko oikeasti muuttui.

### Helpottuiko vai vaikeutuiko

**Helpottui, ja niin piti käydä:** läpäisemättömästä läpäistäväksi. Voimatason 0
botti vie jättiläisen 5 hp:stä nollaan sekä 4-F:ssä että 5-F:ssä.

Yksi asia **vaikeutui tarkoituksella**: skaalasta 2,5 ylöspäin pomon osumalaatikko
yltää askellavan yli, joten askel muuttuu vaaralliseksi juuri silloin kun hän
kasvaa lattian ulottumattomiin. Turvallinen maa nousee sitä mukaa kuin hän
kasvaa, ja se on koko opetus.

**`difficulty.mjs` sanoo että kentät vaikeutuivat** — 4-F 192,6 → 202,1 ja
5-F 337,4 → 345,5. Se laskee uudet kolikot ja lavat eikä näe taistelusta mitään
(jokainen pomo on 5,0). **Luku nousi samalla kun taistelu helpottui.** Älä lue
sitä tuomiona tästä muutoksesta.

### Velka joka jäi

`boss_arena_big` on nyt määritelty **kahdesti**: elävä `fortress.js`:ssä ja
kuollut kopio `factory.js`:ssä, jota `chunks.js`:n levitysjärjestys varjostaa.
Se on portin vahtima ansa — `verify.mjs` kaatuu äänekkäästi jos varjostus joskus
lakkaa — mutta **kopio pitää poistaa** kun `factory.js`:ää muokkaava rinnakkainen
työ on valmis.

## v26.08.09.19 — putken suunta, putkessa kulkeminen, kameran pito ja linnan ovi

Neljä omistajan raportoimaa vikaa, jotka osuivat samoihin kahteen tiedostoon.

### Ylös mennään katosta roikkuvasta putkesta

`tryWarp` tutki **jalkojen alla olevan ruudun molempiin suuntiin**, joten
ylöspäin matkustaminen tapahtui seisomalla putken päällä ja painamalla ylös.
Sääntö on nyt se jonka lajityyppi on aina käyttänyt: **matkan suunnan pitää
vastata sitä suuta josta mennään sisään.**

**Muutos ei kuitenkaan ole vielä valmis, ja se on sanottu ääneen koodissa.**
Maailmojen 1–4 salahuoneiden ulostuloputket seisovat lattialla ja niistä
mennään ylös. Tiukka sääntö tekisi niistä käyttökelvottomia — eli **sulkisi
pelaajan bonushuoneeseen**, mikä on täsmälleen se ansa jota vastaan `secrets.js`
varoittaa. Siksi mukana on `WARP_COMPAT.upFromFloor`, jota kokeillaan **vasta**
kattotestin epäonnistuttua, ja portti sekä väittää lipun olevan päällä että
todistaa tiukan säännön molemmat puolet lippu pois kytkettynä.

Jäljellä oleva työ on kenttädataa: `cave_room` (1-2 ja 3-2 — yksi muokkaus
korjaa molemmat), `tomb_cave` (2-2), `fac_cellar` (4-2) ja `fac_duct`, joka
pitää jakaa kahdeksi. `fac_loft` ei muutu, koska sieltä poistuminen on
alaspäin. Lisäksi `rules.js` on yhä vanhaa mieltä warpin suunnasta, eikä sitä
voi korjata ennen kenttiä ilman että portti kaatuu.

### Putkessa kulkeminen näkyy

Ennen: `p.y += shift`, eli teleportti. Nyt `Player.transit` — 14 framea sisään,
5 pidossa, 13 ulos. Sama mekanismi hoitaa myös linnan oven, koska molemmat ovat
"pelaaja katoaa hetkeksi johonkin".

`warpLock` luettiin ja jätettiin rauhaan: se estää pohjassa olevaa nappia
kimmottamasta takaisin heti, eikä se koskaan ollut ohjauslukko.

**Pikatallennus kesken matkan tallennetaan, ei kielletä.** Tila on tavallisia
lukuja `Player`in omina kenttinä, ja `savestate.js` tallentaa jokaisen olion
jokaisen oman kentän — joten kuva palautuu pidossa ilman riviäkään
tallennuskoodia. Kieltäminen olisi tarkoittanut näppäintä joka ei tee mitään
puoleen sekuntiin, ja se on bugiraportti.

Bugi joka syntyi ja jäi kiinni matkalla: `beginTransit` otti `controllable`n
pois eikä mikään antanut sitä takaisin. Nyt palautetaan **muistettu** arvo eikä
`true`.

### Kamera ei nouse hypyn mukana

Pystytavoite riippuu nyt `camAnchor`ista — siitä viimeisestä kohdasta johon
pelaaja **asettui**. Ankkuri liikkuu alaspäin heti (putoamisen kohde pitää
nähdä), maahan tullessa ja köydellä. **Hyppy ei ole mikään niistä.**

| maalilaatta näkyvissä koko hypyn ajan | ennen | jälkeen |
| --- | --- | --- |
| 2-1, voimataso 0 | 58,4 % | **100 %** |
| 2-1, voimataso 3 | 58,8 % | **100 %** |
| 1-1, voimataso 3 | 100 % | 100 % |

Kameran nousu hypyn aikana 2-1:ssä: 3,11 px/frame → **0,00**. Kuvasuhteeseen ei
koskettu eikä `CAM_EYE`:hen koskettu, kuten pitikin — vika oli joka kentässä,
laajakuva vain poisti siitä 22 pikselin pelivaran.

Ainoa ohitus on 16 pikselin yläreunus, ja se on **kova raja easen jälkeen** eikä
tavoite: eased raja on yhä viive, ja mitattuna huippu työntyi 2,6 px ulos
laajakuvakaistasta sillä välin kun kuva oli matkalla.

Viisi olemassa olevaa kameratestiä pysyi voimassa sellaisenaan, kolme parani
mitattavasti.

### Linnan ovi aukeaa ja siitä mennään sisään

**Korjaus aiempaan diagnoosiin:** `open`-parametri *oli* käytössä — vilkkuva
kahva ja himmeä hehku. Se mikä ei liikkunut olivat **ovilehdet**, ja se oli
oikea vika. Nyt `open` on luku 0…1: lehdet kääntyvät kumpikin omalle
saranalleen, rako aukeaa keskeltä ja levenee, ja takana on tumma aukko jonka
alimmalla ruudulla on valaistu kynnys.

`bossDefeated` on nyt **se tikki jolloin pomo kaatui** eikä `true`. Se ja `tick`
ovat molemmat jo tilatallennuksessa, joten aukeaminen selviää pikalatauksesta
ilman uutta kenttää — ja vanha tallennus jossa lukee `true` luetaan "aukesi
kauan sitten", mikä on oikein.

**Läpäisyjingle odottaa kuvaa eikä toisin päin.** Palkinto on kentän
läpäisemisestä, läpäiseminen on ovesta meneminen, ja jingle soitettuna pelaajan
vielä kävellessä sanoo että kenttä on ohi samalla kun kuva sanoo ettei ole.
Hinta on 19 framea. Matka päättyy tilaan `'gone'` eikä tyhjään, koska
`completeLevel` asettaa `autoWalk`in — muuten pelaaja ilmestyisi takaisin ja
kävelisi ulos ovesta johon juuri meni.

**Kuollut `door`-lippu otettiin käyttöön** eikä poistettu: se on juuri se
kysymys jota kysytään, joten sitä kysytään nyt sen sijaan että `ch === T.DOOR`
kirjoitettaisiin joka paikassa erikseen.

### `playable.mjs`

Yksi luku muuttui: neljä linnaketta raportoivat `ETENI 98%` eikä `100%`. Se on
oven korjaus eikä regressio — botti käveli ennen oven **ohi** läpäisyjakson
aikana ja pysähtyy nyt siihen. Kaikki neljä ovat yhä `LÄPI`.

## v26.08.09.18 — spritejen animaatiokierrokset läpikäytynä, ja aurinko joka näkyy

Kaksi työtä, jotka molemmat alkoivat "tarkistetaan tämä" ja päättyivät
"tässä on neljä bugia".

### Animaatiokierrokset kaikilla viidellä voimatasolla

Roadmapin kohta on ollut listalla pitkään: käydään läpi. **2220 yhdistelmää**
(6 kokoa × 5 tehostustyyppiä × 37 asentoa/framea × molemmat suunnat) piirrettiin
ja mitattiin: piirroksen rajat osumalaatikkoa vasten, yhtenäisyys, ja
framehash kierrosten vertailuun. Lähtötilanne: **458 asentoa vuoti laatikostaan
ja 160 hajosi kahdeksi kappaleeksi.**

- **Hengitys repi hahmon kahtia.** Paita nousi `b`:n mukana mutta housut oli
  naulattu paikalleen, joten vyötärölle avautui pikselin rako ja koko alavartalo
  irtosi omaksi palakseen — **joka koossa, joka tehostuksella, noin
  kolmanneksessa jokaista hengitystä.** Nyt hengitys nostaa hartioita ja venyttää
  paidan vyölle asti, mikä on se mitä koodin oma kommentti aina väitti sen tekevän.
- **Kävelyn frame 2 jätti takajalan leijumaan** kaikilla koilla ja tyypeillä.
- **Juoksun harppaus romahti voimatasolla 0**: `spread` sulki jalkojen välin
  kokonaan, eli juoksussa oli *vähemmän* jalkojen liikettä kuin kävelyssä.
- **Piirros laatikon alapuolella** — 3 px pienimmällä koolla, ja **ei vain
  kävelyssä vaan myös seisonnassa ja kyykyssä**, koska seisonta lainaa
  kävelysyklin framea. Korjattu **piirrosta kutistamalla, ei laatikkoa
  kasvattamalla**: sama valinta kuin kävelijän kanssa, eli törmäyksiin ei
  koskettu.

Puhtaana todettu ja siksi kirjattu: **paukkupapu piirtyy omanaan** kaikissa
kuudessa koossa ja 37 asennossa (se ei perinyt mitään), skaalattu piirto ei
pyöristä spriteä ulos laatikosta, peilaus on tarkka, eikä yksikään yhdistelmä
piirrä tyhjää.

Kaksi asiaa jäi odottamaan tiedostoa jota työ ei omistanut: **kävelysyklissä ei
ole ohitusasentoa** (`%3` menee auki→auki ilman välivaihetta) ja **kiipeilyllä ei
ole asentoa lainkaan** — `animFrame` lasketaan köydelle ja heitetään pois, koska
`state()` palauttaa `'jump'`.

### Aurinko näkyy, varoittaa ja tietää milloin lopettaa

`Math.min(skyY, cam.y + 18)` oli **räikkä**: aurinko saattoi vain nousta, joten
kameran laskiessa se jäi maailman koordinaatteihin ja katosi ruudun yläpuolelle.

Mitattuna 2-1:ssä (laajakuva, `viewH` 160): kokonaan näkyvissä **21,5 % →
98,3 %**, ja leijuessa **0,6 % → 99,7 %**. Pahin ylitys −52 px → −3 px.
2-2:ssa (ei laajakuvaa) sama vika maksoi vähemmän — ja **juuri siksi se selvisi
huomaamatta**: laajakuva ei aiheuttanut vikaa, se paljasti sen.

Lepokorkeus on nyt osuus ikkunasta (`viewH`, ei `VIEW_H`), joten molemmat
kuvasuhteet lukevat samalla tavalla.

**Palava jälki** on 14 kipinää, kaksi kokonaislukuneliötä kumpikin,
`'lighter'`-tilassa kiekon alla — ja se **tallentuu vain kun aurinko liikkuu**,
joten leijuva aurinko ei jätä mitään ja pysähtynyt ei tuhri. Jälki ilmestyy
itsestään sukelluksessa.

**Sukelluksella on nyt näkyvä ennakkovaroitus** (halo joka paisuu kiihtyvällä
sykkeellä), ja se on tarkoituksella erinäköinen kuin iskuaalto: oranssinvalkoinen
taivaalla vastaan ruskehtava välähdys lattialla.

**Aurinko luovuttaa lipulla.** Kynnys on se mitä pelaaja näkee: sillä framella
kun maali tulee ruutuun, aurinko lakkaa jahtaamasta ja nousee pois — hitaammin
kuin se seuraa, koska poistuminen on tarkoitettu katsottavaksi. Perustelu sille
että juuri tämä vihollinen luovuttaa: loppusuora on joka kentässä rauhallinen
tarkoituksella, aurinko on ainoa joka voi osua tangolla ylhäältä, ja kuolema
voitetun kentän jälkeen on huono viimeinen muisto.

**Eikä se seuraa maan alle.** Vanhalla koodilla se laskeutui **222 pikseliä
sisään 2-2:n suljettuun hautakammioon**. Nyt se odottaa oman kaistansa yllä.
Aavikossa ei ole yhtään warp-putkea, joten tämä on tänään saavuttamaton —
rakennettu silti, koska salaisuuksia lisätään kenttiin jatkuvasti ja vihollinen
jonka rajaus lepää sen varassa ettei kukaan lisää putkea on ansa seuraavalle.

**Vaikeutuiko se?** Ei, ja se on mitattu eikä väitetty: sama siemennetty ajo
antaa identtiset luvut ennen ja jälkeen (12 yritystä, 11 osumaa, 11 kuolemaa).
Rehellinen sivuvaikutus: auringon voi nyt *koskettaa* korkealla hypyllä, koska se
on ruudulla. Ennen se oli 2-1:ssä ulottumattomissa — mutta se oli piilossa oloa
eikä tasapainoa.

**Kamerasidonnaisuuden auditointi:** aurinko oli ainoa. Taustat saavat `viewH`:n
parametrina, kuu ei lue kameraa lainkaan, ja kaikki muut cullit ovat
vaakasuuntaisia — crop on pystysuuntainen.

### Sivuvaikutus jonka ensimmäinen korjaus aiheutti

Kartan pelinappulan nostovakio oli sovitettu käsin siihen aikaan kun pienin
sprite piirtyi kolme pikseliä laatikkonsa alapuolelle, eli **vakio maksoi
hiljaa sitä bugia**. Kun piirros kutistettiin laatikkoon, nappula nousi mukana;
12 → 10 palauttaa sen jalat samalle tasolle muiden voimatasojen kanssa.

## v26.08.09.17 — salaisuudet kartalle: kertoo että, ei missä

Peli kätkee nyt paljon: salainen alue maailmoissa 1–4, tähtilohkot, kytkinseinät
ja salaisuudet tavallisissa tiilissä. **Pelaaja joka ei tiedä niiden olemassaolosta
ei etsi niitä koskaan**, ja linkki on lähdössä kavereille jotka eivät tiedä.

Kartta kertoo nyt että kentässä on salaisuuksia ja montako niistä on löytynyt.
**Ei koskaan missä.** Se ero on koko suunnittelu: `0/1` kutsuu etsimään, merkki
kartalla on vastauskirja ja lopettaa pelin ainoan arvoituksen.

### Yksi salaisuus = yksi asia jonka peli kätkee ja joka maksaa löytyessään

**Salainen alue on yksi**, oli siihen montako reittiä tahansa. 1-2:ssa
pavunvarsi on 22 ruutua, putki alas kaksi ja putki takaisin kaksi lisää —
yhdessä ne ovat yksi löytö ("tämän kentän yllä on huone"). Erikseen laskettuna
pelaaja joka löysi huoneen kerran olisi laskurille kolme velkaa.

Ulkopuolelle jätettiin **murenevat lavat** (vaara näkyvissä, mitään ei löydy
seisomalla) ja **varret ja putket itsessään** (tie salaisuuteen, laskettu jo
sinä alueena jonne se vie). Yhteensä 59 salaisuutta.

**Löytynyt = sillä hetkellä kun peli antaa sen mitä se kätki.** Lohko kun se
maksaa sisältönsä, alue kun **jalat ovat siellä** — ei varteen koskettaessa,
mikä tapahtuu ohi kävellessä, eikä kenttää läpäistäessä.

### Tallennusversiota ei nostettu

Vanhassa tallennuksessa ei ole `secrets`-kenttää, ja `{}` ei ole arvaus vaan
totuus: sille pelaajalle ei ole koskaan kirjattu mitään. Mikään olemassa oleva
kenttä ei vaihda merkitystä — se on se tapaus jota DESIGN.md kohta 6 oikeasti
koskee. Vastakkainen valinta olisi **poistanut jonkun elämät, pisteet ja
läpäisyt** jotta laskuri voi alkaa nollasta.

Tallennettuja avaimia verrataan lisäksi kentän nykyisiin: tallennus joka muistaa
tiilen joka on sittemmin siirtynyt lukee "ei löytynyt" eikä 6/5.

### Kaksi kanavaa, sama jako kuin haaralla

Solmussa **3 pikselin kimallus** kilven vasemmassa yläkulmassa — kultainen kun
jotain on vielä kätkössä, vihreä kun kaikki on löytynyt, ei mitään kun kenttä ei
kätke mitään. Se on ainoa 3×3 aukko 16 pikselin ruudussa jota vaikeuspalkki tai
kenttätunnus ei jo omista. **Tarkoituksella ei toista palkkiriviä**: kaksi
palkkilukemaa samassa ruudussa luettaisiin yhtenä.

Tarkka luku on sanoina paneelissa: `SALAISUUDET 2/5`. Tyhjä kenttä lukee
`EI SALAISUUKSIA` eikä tyhjää — samasta syystä kuin reittitaulu kirjoittaa
`EI PALKINTOA`: tyhjä luetaan "ei vielä tiedossa", ja ero "täällä ei ole mitään"
ja "täällä on kolme, yhtään ei löytynyt" välillä ei saa olla yhden merkin
levyinen.

### Velka joka on kirjattu eikä piilotettu

Laskenta tarvitsee tiedon salaisuustiilien todennäköisyyksistä, ja ne ovat nyt
kolmessa paikassa (`level.js`, `gen-levels.mjs`, `secrets.js`), koska
`LevelScene` ei lataudu selaimen ulkopuolella. **Ei luotettu vaan vahdittu:**
portti vertaa laskennan tulosta moottorin omaan `brickSecret`iin tiili tiileltä
kaikissa kentissä ja kertoo koordinaatit jos ne eroavat.

Löytymisen kirjaus tehdään toistaiseksi kietomalla `LevelScene.prototype`
(`watchSecrets`), koska `level.js` oli toisen työn alla. Loppusijoitus:
`bumpTile` ja `tryWarp` kutsuvat itse, ja kääre katoaa — `secrets.js` ottaa
luokan argumenttina juuri siksi että se päivä on poisto eikä moduulisykli.

## v26.08.09.16 — puhesyntetisaattori sai konsonantit

`vox()` osasi viisi vokaalia, joten jokainen repliikki oli vokaaliliuku: `'iea'`
oli "jee" ja `'ou'` oli "oof". Ääni jolla on vain vokaaleja ei voi sanoa eri
asioita — se voi vain huutaa eri korkeuksilla.

Kolme perhettä, kolme mekanismia, yksi taulu:

- **Nasaalit** (m, n) ovat samat kaksi kaistanpäästösuodinta uusilla kohteilla:
  F1 250 Hz ja yläkaista kymmenesosaan. Ei uutta koneistoa, vain uudet luvut.
- **Frikatiivit** (s, š, f, h) ovat jaettua kohinapuskuria suotimen läpi, ilman
  sävelkorkeutta lainkaan.
- **Klusiilit** (p, t, k) ovat **hiljaisuus ja sitten purske**. Hiljaisuus on se
  osa joka tekee niistä klusiileja; ilman sitä ne ovat napsahduksia.

Peräkkäiset soinnilliset kirjaimet ovat yhä **yksi** oskillaattori joka liukuu
kohteesta toiseen — eli tarkalleen se mitä koko sana ennen oli.

### Kolme mittausta, joista jokainen kumosi oletuksen

1. **Kohinapolku on hiljaisempi kuin vokaalipolku**, ei kovempi kuten oletin —
   noin 6 dB, mikä kohinan huippukertoimen jälkeen on suunnilleen se suhde joka
   oikealla ässällä on. `VOX_HISS` 1,0 on siis mittaustulos eikä oletusarvo.
2. **Nasaali oli liian kova**: 250 Hz:n kaistanpäästö istuu perustaajuuden
   päällä, joten se mittasi 0,81 vokaalin 0,58:aa vastaan. Taso 0,5.
3. **Sanat eivät ole yhtä kovia samalla vahvistuksella.** Viisikohteinen sana
   käy läpi useamman suodinasennon ja voittaa maksimin: samalla gainilla rivit
   mittasivat 0,31–0,81, eli 8 dB. Jokainen repliikki on nyt mitattu erikseen
   noin 0,55:een.

Vanhat vokaalisanat mitattiin rinnakkain vanhaa versiota vastaan: erot ovat
pienempiä kuin mittauksen oma hajonta.

### Tuntematon kirjain pudotetaan, ei korvata

Ennen `VOWELS[v] || VOWELS.a` teki tuntemattomasta kirjaimesta ylimääräisen
"ah":n — eli tavun jota kukaan ei kirjoittanut, mikä lukee pelin bugina eikä
kirjoitusvirheenä. Nyt se pudotetaan, ja tyhjäksi jäänyt sana putoaa yhteen
'a':han, koska **ääniefekti joka hiljaa jättää soimatta on se vika jota kukaan
ei ilmoita**. Puuttuvat kirjaimet ovat approksimantteja (j, v, l, r), jotka
ympäröivät vokaalit kantavat muutenkin: "JES" kirjoitetaan `'ies'`.

### Peli sai suunsa auki suomeksi

Kaikki olemassa oleviin kutsupaikkoihin, ei yhtään uutta ääntä: JES · AUTS ·
NO NIIN · NAM · JIPPII · OHHOH · HIENOA · HUPS · HUP.

### Kaksi asiaa jotka löytyivät matkalla

- **Mutaatiotesti paljasti että klusiilin aaltomuototarkistus meni läpi myös
  hitaalla vokaalin nousulla** eikä vain oikealla umpiolla. Korjattu molemmista
  päistä.
- **Mittaukset heittelivät kaksinkertaisesti**, kunnes syy löytyi:
  esittelytila. Kahdenkymmenen sekunnin jouten olon jälkeen alkuruutu alkaa
  pelata peliä itselleen ja ampuu hyppyjä ja tallauksia **juuri siihen väylään
  jota mitattiin.**

### Valmis pomojen äänille

`voxPlan(word, dur)` on *mitä sanotaan*, `VOICES` on *kuka sanoo*. Pomo saa
`vox({ word, voice: VOICES.joku })` eikä mikään muu argumentti muutu. Taulussa
on toistaiseksi yksi rivi, koska puhujia on yksi — ääni jolla ei puhu kukaan on
sama virhe kuin ääni jota ei laukaise mikään.

## v26.08.09.15 — ohjaimen ääniloukku sanotaan ääneen

Peliohjaintuki on ollut olemassa pitkään ja toimii. Siinä oli kuitenkin reikä
jota ei voi paikata koodilla, ja se piti siksi sanoa ääneen.

**Selain ei avaa ääntä ohjaimen napista.** Äänen avaaminen vaatii käyttäjän
eleen, eikä ohjaimen painallus ole sellainen millään selaimella — eikä sitä voi
kiertää yrittämällä uudestaan. `step()` kutsui `Sfx.resume()`:a aina kun syötettä
tuli, ja `anyKeyPressed` sisältää nykyään myös ohjaimen napit, joten pelaaja joka
nostaa ohjaimen käteensä eikä koske näppäimistöön sai **hiljaisen pelin ja
silmukan joka yrittää ikuisesti**. Se on täsmälleen se vika jota koodin oma
kommentti sanoo joskus tapahtuneen, palanneena ovesta jota kukaan ei ajatellut.

Korjaus ei ole "saa se toimimaan" vaan **huomaa ja kerro**: vihje ilmoitusrivillä
heti kun ohjaimelta tulee syötettä ja ääni on silti kiinni.

**Ehto on syy eikä ajastin**, ja se on tarkoituksellista: ehtona on nimenomaan
*ohjaimelta* tullut syöte, ei mikä tahansa syöte. `ctx.resume()` ratkeaa
asynkronisesti, joten näppäimistöpelaaja jolla on ohjain kiinni näkisi muuten
vihjeen välähtävän 1–3 framen ajan. Kapeampi ehto poistaa väärän hälytyksen
kokonaan eikä melkein.

Oikea ilmoitus voittaa vihjeen: `TILA 1 LADATTU` syrjäyttää sen täydeksi ajakseen,
ja vihje palaa itse kun rivi vapautuu. Kuittaus on **vain muistissa** — se on
yhden istunnon vastaus yhteen kysymykseen eikä asetus, joten selaimen muistiin ei
kirjoiteta uutta avainta. Ohjaimen napilla kuittaaminen on ainoa kuittaus jolla
on merkitystä: näppäin kuittaisi *ja* avaisi äänen, jolloin vihje olisi lähtenyt
muutenkin.

Äänen avaus kytkettiin nyt myös suoraan `keydown`- ja `pointerdown`-käsittelijöihin
(`Input.onGesture`), koska juuri ne kantavat sen tuoreen eleen jota selain vaatii.

### Ohjainta luetaan varovammin

Punainen ajo paljasti kaksi oikeaa kaatumista: `pad.buttons[index]` ohjaimella
jolla ei ole `buttons`-taulukkoa, ja `for…of` kun `getGamepads()` palauttaa
`null`in. Nyt selaimen palauttamaa oliota kohdellaan tuntemattomana.

**Ei-standardi ohjain luetaan vain napeista.** Kun `mapping !== 'standard'`,
selain itse sanoo ettei tiedä mitä akselit ovat: akseli 0 voi olla tatti,
hattukytkin tai liipaisin joka lepää arvossa −1 — jolloin hahmo kävelee
vasemmalle ikuisesti ilman että kukaan koskee mihinkään. Perustelu on
epäsymmetria: **väärä nappi on hiljaa kunnes sitä painetaan, väärä akseli painaa
itse itseään.**

## v26.08.09.14 — murtava tehostus, ja papuparoonit jotka sen pitävät

Haaran palkinto ja sen ainoa lähde, samassa erässä koska ne ovat sama asia.

**PAUKKUPAPU** on neljäs voimatyyppi: sillä tiili hajoaa sivusta juosten. Nimet
ovat omia ja se on sääntö eikä maku — roadmapin *"vasaraveljet"* on suora
käännös toisen sarjan vihollisesta, ja DESIGN.md kohta 1 kieltää sen missä
tahansa muodossa. Vartijat ovat **PAPUPAROONEJA**, pieruprinssin veronkantajia
dyyneillä, jolloin fiktio itse selittää miksi juuri he pitävät papua.

**Mitä se rikkoo, ja tärkeämpää: mitä ei.** Tiili kyllä — se on ainoa ruutu jota
peli on koskaan kohdellut pehmeänä. Ei `?`/`!`/`*` (astiat maksavat ylöspäin,
sivulta puhkaisu tuhoaa sisällön), ei `X` eikä `#` (**`rules.js` lukee juuri ne
lattiaprofiilina jota vasten jokainen reittisääntö mitataan** — murrettava maa
avaisi reiän jota mikään tarkistus ei näkisi), ei `%` (sen sopimus on ajastin ja
se kasvaa takaisin), ei `S` (kentässä on täsmälleen yksi nappi), eikä
salaisuutta kätkevä tiili — sen palkinto kuuluu sille joka lyö alta, kuten
kuorenkin kohdalla jo on.

**Vanha voimatason 4 sivuisku poistettiin**, ei jätetty rinnalle: kaksi ovea
olisi antanut hernekeittolautasen jakaa paroonien palkintoa, ja "ainoa lähde"
on sääntö tai ei mitään.

**Taistelu:** kaksi paroonia jalustoillaan, yhdeksän saraketta hiekkaa välissä,
2 osumapistettä kummallakin, tallattavissa pienimmälläkin koolla. Ne heittävät
kaarevan papupommin puolen sekunnin ennakkovaroituksella; pommia ei voi tuhota,
se väistetään. **Viimeisenä seisova pudottaa pavun**, ja "viimeinen" katsotaan
elävästä sisaruksesta eikä tappolaskurista — muuten kesken taistelun ladattu
tilatallennus jättäisi palkinnon kenellekään kuulumattomaksi.

### Kaksi agenttia oli eri mieltä, ja mittari ratkaisi

Taistelun tekijä halusi ripustaa kentän `2-N`:n taakse, koska yökenttä on
"vaikeampi tie". Mitattuna hiekkatie on 124 ja laavatie 156, ja palkinnon on
oltava mitatusti vaikeammalla reitillä tai `worldProblems` hylkää kartan. Kenttä
meni siis laavatielle. **Tämä on juuri se syy miksi vaikeus mitataan eikä
muisteta.**

### Portin oma bugi, joka löytyi vasta yhdistämisessä

Testi "paroonit pysyvät jalustoillaan" katsoi `onGround`ia **yhdellä framella**
1200:n jälkeen. Parooni pomppii, joten se kertoi vain mihin hypyn vaiheeseen
silmukka sattui pysähtymään: sama simulaatio meni läpi tekijän koneella ja kaatui
yhdistettynä, identtisillä muilla luvuilla. Nyt mitataan alin kohta **joka
framelta** — se on se mitä taistelu oikeasti lupaa (ei putoa jalustaltaan), ja
se on totta tai epätotta riippumatta siitä milloin katsotaan.

## v26.08.09.13 — haarautuva kartta, ja vaikeus näkyy ennen valintaa

`2-N` oli solmu johon pääsi mutta josta ei päässyt pois. Nyt maailma 2 haarautuu
oikeasti: `2-2` on risteys, `HIEKKATIE` kulkee `2-N`:n kautta ja `LAAVATIE`
`2-3`:n, ja molemmat päätyvät linnakkeeseen.

### Vaikeus tulee mittarista, ei näppäimistöltä

`tools/difficulty.mjs --write` kirjoittaa `src/data/difficulty.js`:n, jota kartta
lukee. **Kirjoittaminen on lipun takana** — raportoiva työkalu joka kirjoittaa
syötteensä sivuvaikutuksena on juuri se ansa jonka `measure-jump.mjs` viritti
tänä aamuna.

Vanhentuminen huomataan **johtamalla uudelleen, ei tiivisteellä**: `verify.mjs`
tuo mittarin oman funktion ja vertaa kenttä kentältä. Tiiviste sanoisi "jokin
muuttui"; tämä sanoo `3-2: tiedossa 128,0, mitattu 133,4 — aja: node
tools/difficulty.mjs --write`. Ero on siinä kumman viestin varassa joku korjaa
asian oikein.

### Kaksi keskiarvoa, jotka on perusteltu vastakkaisiin suuntiin

- **Reitin sisällä: suurin.** Kierros kaatuu reitin pahimpaan kenttään, ja
  keskiarvo antaa yhden lempeän kentän piilottaa yhden tappavan.
- **Haaran reittien kesken: pienin.** Helpoin reitti on se jonka jokainen
  pelaaja saa; käyrän veloittaminen vapaaehtoisesta tiestä raportoi rampin jota
  kenenkään ei ole pakko kävellä.

Seuraus: maailman 2 luku laski 149,0:sta 147,3:een. **Se ei ole viritys vaan
seuraus** — `2-N` on nyt vaihtoehto `2-3`:lle eikä enää jokaisen pelaajan
keskiarvossa.

### Muototarkistus lukee tasoja, ei jonoa

Käyrän muototarkistus vertasi peräkkäisiä kenttiä ketjussa, ja se oli oikein
täsmälleen niin kauan kuin kartta oli jono. Haarautuvalla kartalla se alkaa
valehdella molempiin suuntiin: helppo haara vaikean perässä raportoituu notkona
jota kukaan ei pelaa, ja vaikea haara piikkinä jota kenenkään ei ole pakko
selvitä. Nyt yksi taso on yksi askel etenemistä — yksi kenttä tai yksi kokonainen
haara — ja haaran luku on **helpoimman reitin** luku, koska se on se jonka
jokainen kävelee. Haaran oma eriarvoisuus on eri kysymys, ja se tarkistetaan
erikseen.

Tämä oli sama uudelleenkirjoitus jota kahdeksan maailman tavoite roadmapissa jo
vaati. Kaksi kohtaa, yksi työ — ja sen jälkeen kahdeksan porrasta on mittarin
kannalta pelkkää dataa.

### Rakenne on tarkistettu, ei muistettu

`worldProblems` vaatii että jokainen kenttä on jollain reitillä alusta
linnakkeeseen, että jokainen haara on ilmoitettu, että **palkitsematon reitti
vie läpi peliin** ja että palkinto on mitatusti vaikeammalla reitillä. Roadmapin
ehto 3 on siis nyt graafin ominaisuus eikä asia joka pitää muistaa.

### Piirtäminen

Pisteet ovat viisi 2×3 palkkia, **ei kirjoitettuja merkkejä**: puuttuva merkki
jättää aukon ja siirtää kohdistinta silti, joten merkkipohjainen piste läpäisisi
leveystestit ja piirtyisi tyhjäksi. `*` oli toinen ehdokas ja tarkoittaa
pistetaulussa jo "tilatallennus käytössä".

Risteyksessä paneeli kertoo molemmat reitit ja **mitä ne maksavat sanoina**
(`MURTAVA VOIMA` vs. `EI PALKINTOA` — tyhjä luettaisiin "ei vielä päätetty").
Kultainen vinoneliö on palkitsevalla tiellä **risteyksessä**, ei sen tien
päässä joka maksaa.

## v26.08.09.12 — generaattori oppi uudet merkit, maailma 5 arvottiin uusiksi

Maailma 5 oli ainoa jossa aamun mekaniikat eivät näkyneet, koska generaattori ei
tiennyt merkkien olemassaolosta.

**Kaksi neljästä merkistä on paikkoja, kaksi ei — ja koko muutos lepää tuon
jaon päällä.** `%` ja `S` ovat set piecejä palettivalinnassa; `*` ja
salaisuustiilet ovat jälkikäsittelyä valmiille ruudukolle.

**Murenevan lavan leveyskatto on se kohta joka olisi mennyt hiljaa väärin:**
`%` on `rules.js`:lle kiinteä, joten mureneva kansi **vaimentaa
kuilutarkistuksen**. Ilman kattoa palikka voisi salakuljettaa ylittämättömän
kuilun sellaisen lattian taakse jota ei kohta ole. Katto on tavallisen hypyn
budjetti, eli kenttä kestää sen että mekaniikka pettää sinut.

Kytkimen tiilet **leijuvat eivätkä seiso maassa**: kytkin saa vain vähentää
kiinteyttä, joten mikään kuljettava ei saa riippua siitä. Tähti ei ole uusi
palikka vaan **ylennys** — `?` merkitään tähdeksi, koska `TILE_INFO` piirtää ne
samanlaisina tarkoituksella. Salaisuus taataan pidentämällä yhtä olemassa
olevaa tiilijonoa yhdellä ruudulla, mikä pysyy louhitun jonopituusjakauman
sisällä eikä keksi uutta tiiliriviä.

**Se paljasti oikean aukon:** korvatuissa kentissä 5-1:ssä ja 5-2:ssa oli
**nolla salaisuutta**.

### Siemen valittiin mittaamalla, ei ensimmäisestä heitosta

56 siementä. Jokainen mitattiin neljästä asiasta, ja kolmas on se joka
karsi eniten: **notkon syvyys suhteessa naapuripiikkiin** — 0,6 prosentin notko
on pyöristysvirhe eikä hengähdys. 21 läpäisi muototarkistuksen, ja niistä
`playable.mjs`:n rima oli se jonka korvatut kentät täyttivät: kaikki kolme läpi
voimatasolla 0, 100 %. Kuusi läpäisi molemmat.

Valittu 44444, muodon perusteella: 215 → 185 → 279, sama muoto kuin maailmalla 4
(188 → 141 → 226) — kova avaus, oikea hengähdys, piikki viimeisenä. Generaattorin
oletussiemen on nyt sama, joten paljas ajo toistaa sen mikä on tuotannossa.

**Hinta sanottuna ääneen:** w4→w5 kasvaa +39,5:stä +67,2:een. Viimeinen porras on
siis näkyvästi jyrkempi kuin muut, ja se on tietoinen vaihtokauppa maailman
sisäisestä muodosta.

Samankaltaisuustarkistus oli **päällä jokaisella kandidaatilla** (korpus kloonattu
repon ulkopuolelle, DESIGN.md kohta 3), osumia 0. Generaattorin oma `SOLID`-kopio
korjattiin vastaamaan `rules.js`:ää — puuttuva merkki olisi verrannut väärää
ruudukkoa korpukseen.

Salaisuustiilien todennäköisyydet ovat kahdessa paikassa (`LevelScene` ei lataudu
selaimen ulkopuolella). Sitä ei peitelty: `verify.mjs` kysyy nyt **moottorin
omalta `brickSecret`iltä** kätkeekö kenttä jotain, joten jos luvut karkaavat
toisistaan portti kaatuu sen sijaan että maailma hiljaa tyhjenisi.

## v26.08.09.11 — kaikki kolme kaistaa validoidaan

`rules.js` tarkisti vain sen kaistan jossa aloitusmerkki on, joten **jokainen
pelin bonushuone oli validoimatta** — ja juuri siellä liian matala katto on
pahin, koska `secrets.js`:n oma sääntö on että bonus josta ei pääse pois on ansa.

Työ ei ollut tarkistusten kopiointia vaan säännöiden lajittelua kahteen
lajiin. **Yleiset** (rivien pituus, vihollisten jalansija, pääntila) pätevät
missä tahansa kaistassa. **Reittikohtaiset** (kuilun leveys, seinän korkeus,
ei portaita tyhjään, tehostus ensimmäisessä neljänneksessä) eivät tarkoita
bonushuoneessa mitään — taivaskaistan lattiarivit ovat tyhjät, joten koko kaista
lukisi yhtenä pohjattomana kuiluna ja `cave_room`in sivuseinä on seinä
tarkoituksella. Ne olisivat taatusti vääriä hälytyksiä, ja väärä hälytys
vaimennetaan viikossa, minkä jälkeen sääntö ei suojaa mitään.

Kolme uutta sääntöä, jotka koskevat vain bonuskaistoja: **sisääntulo**
(laillinen warp tai saumasta läpi kulkeva pavunvarsi), **uloskäynti isoimmalla
koolla**, ja **lattia näiden kahden välillä**.

**Epäsymmetria on koko juju:** sisääntulo tarkistetaan pienimmällä keholla,
uloskäynti suurimmalla. Jokaisessa pelin salahuoneessa on `!`, joten se joka
lähtee ei ole se joka tuli — sisään pudotaan pienenä, siellä kasvetaan, ja
sitten putken on vedettävä 21×43.

Warpin laillisuus lasketaan `LevelScene.tryWarp`in omista ehdoista (`fits`,
`footingWithin`) eikä toisesta mielipiteestä.

**Mitä ruudukosta ei voi todistaa, on kirjattu tiedoston omaan alkuun:**
yhtenäisyys on ilmaa eikä kävelyä (ei painovoimaa, joten liian korkea hylly on
yhä ilmaa), tiili on täytölle seinä vaikka iso pelaaja rikkoo sen, ja vain ne
tiet tunnetaan jotka ruudukko nimeää. Tarkistus voi siis **jäädä huomaamatta
ansa mutta ei keksiä sellaista.**

### Neljäs tapaus tunnetusta pääntilamuodosta, ja miksi sääntöä ei laajennettu

Tarkistus löysi neljännen tapauksen samasta muodosta jonka linnakkeet jo
tuntevat: `tomb_cave`n `?B!B?`-rivi on kaksi riviä katon alla. **Se ei ole ansa**
— hyllylle ei pääse isoimmalla koolla, joten sinne ei myöskään jää jumiin, ja
huoneen lattia ja reitti ovat vapaat kaikilla kuudella koolla.

Pääntilasääntö rajattiin tarkoituksella kaistan **maahan** eikä jokaiseen
seisottavaan hyllyyn juuri tästä syystä. "Jokainen hylly" -versio hälyttäisi
näistä neljästä eikä mistään muusta, ja sääntö joka valittaa kolmesta
linnakkeesta ja yhdestä oikein toimivasta bonushuoneesta vaimennetaan viikossa —
minkä jälkeen se ei suojaa mitään.

Samalla korjattu: `*` (tähtilohko) puuttui `SOLID`-joukosta vaikka `TILE_INFO`
antaa sille `solid: true`. Merkityksetöntä niin kauan kuin säännöt mittasivat
lattioita, kantava heti kun ne kysyvät mahtuuko keho.

## v26.08.09.10 — tulos kulkee jakolinkissä

Omistajan päätös: pistetaulu ei mene palvelimelle, mutta tulos kulkee linkissä.
`?s=45200&n=OLLI&l=2-3` liitettynä `og:url`iin, jolloin esikatselukortti säilyy.
Perustelut ovat `ROADMAP.md`:ssä; lyhyesti: nimi on lapsen etunimi, pisteet
laskee selain, ja palvelin olisi ensimmäinen ajonaikainen riippuvuus.

**Roskaa ei tulkita puolittain.** Sääntö on että haaste on väite kierroksesta
jonka tämä peli olisi voinut tuottaa, ja jos se ei ole, haastetta ei ole
lainkaan — puolikas haaste näyttää rikkinäiseltä peliltä, ei rikkinäiseltä
linkiltä. Pisteet luetaan **säännöllisellä lausekkeella eikä `Number`illa**,
koska `Number` hyväksyy myös `1e999`:n, `+45200`:n, `45200.5`:n ja
arabialais-intialaiset numerot, ja jokainen niistä pitäisi hylätä erikseen.

**Parametrit poistetaan osoiteriviltä heti luettuaan** (`replaceState`, ei
`pushState`, joten paluunappi ei herätä niitä). Tärkein syy ei ole päivitys
vaan se että vastaanottajan **oma** jakolinkki ei saa kantaa lähettäjän tulosta
eteenpäin — muuten linkki muuttuu matkalla kaveriporukan läpi.

**Vastaanotto ei kirjoita mitään.** Testi täyttää kaikki DESIGN.md:n kohdan 6
localStorage-avaimet tunnetuilla arvoilla, avaa haastelinkin, ajaa 150 framea ja
käy pistetaulun kautta, ja vertaa avaimet tavulleen. Se myös varmistaa että
haaste *luettiin*, jottei tyhjä toteutus läpäise testiä.

Voitosta kerrotaan pistetaulussa, ja **kierroksen tulos kulkee sinne erillään
`highlight`istä**: kierros voi jäädä listan ulkopuolelle ja silti voittaa
haasteen. Warpattu kierros ei voita mitään — jos se ei kelpaa omalle taululle,
se ei kelpaa kaverinkaan päihittämiseen.

### Bugi jonka kuvakaappaus löysi ja testit eivät

Ensimmäinen versio näytti koko haastelinkin jakoruudun osoitelaatikossa. Se
piirtyi muodossa `?S=12345 N=PIKKU L=2-3`: **pelin omassa 5×7-fontissa ei ole
`&`-merkkiä.** Puuttuva merkki ei kaada mitään — se jättää aukon ja siirtää
kohdistinta silti, joten jokainen leveystesti meni läpi.

Laatikko on se vaihe jossa lapsi kirjoittaa osoitteen ylös käsin, ja ruudulla
näkyvä osoite joka ei toimi on huonompi kuin ei osoitetta. Laatikko näyttää nyt
pelkän `og:url`in, jaettava linkki on täysi, ja ero sanotaan ruudulla ääneen.
Puuttuvat merkit mitataan tästä lähtien musteesta merkki kerrallaan.

## v26.08.09.9 — hyppybudjetti mitattu oikeaksi, ja maailma 3 sen mukaan

`tools/jump-budget.json` lupasi 121 px nousun ja 200 px kantaman. Mitattuna 71
ja 155. `src/level/physics.js` ei ole muuttunut sitten sen commitin joka
kirjoitti tiedoston, ja vakioista laskettuna nousu on ~72 px — **tiedosto oli
siis väärässä jo syntyessään**, ei vanhentunut matkalla. Ainoa rivi joka oli
oikein oli P-vauhti, mikä sopii samaan tarinaan.

### Tärkein osa on testi eikä korjaus

`verify.mjs` tarkistaa nyt että budjettitiedosto on **toistettavissa nykyisistä
vakioista**, ja johtaa suunnittelubudjetin uudelleen samalla kaavalla.

Tätä bugia ei voinut saada kiinni millään aiemmalla portilla, ja syy on se joka
kannattaa muistaa: **sekä `rules.js` että `difficulty.mjs` lukevat saman
tiedoston.** Liian antelias budjetti ei siis näy rikkeinä vaan päinvastoin — se
saa jokaisen kentän näyttämään hyväksytyltä. Mittari joka mittaa itseään omalla
väärällä mitallaan on aina vihreä.

**Mikään ei ollut rikki, ja se mitattiin ennen kuin tiedostoon koskettiin:**
validaattori ajettiin kaikille 21 kentälle sekä tallennetulla (8/13/6) että
mitatulla (6/9/4) budjetilla, ja rikkeitä on molemmilla nolla. Yksikään kuilu ei
siis ollut liian leveä; väärä luku oli tehnyt kentistä helpompia, ei
rikkinäisiä.

**Ansa joka tämän alla paljastui, ja joka on tästä lähtien tiedossa:**
`measure-jump.mjs` kirjoittaa `jump-budget.json`in **sivuvaikutuksena**, eli
pelkkä mittaaminen muuttaa juuri sitä tiedostoa jota generaattori ja
validaattori lukevat. Raportoiva työkalu joka kirjoittaa omat syötteensä on ansa,
ja se on sama ansa joka kerta kun siihen astutaan.

### Maailma 3

Oikea budjetti nostaa kaikkia vaikeuslukuja, koska kuiluriski pisteytetään
suhteessa siihen mitä hyppy kantaa. Se paljasti että **maailman 3 avauskenttä
oli sen vaikein** (3-1 204, 3-3 174): 3-1:n kuiluista kolme oli budjetin
rajalla. Vanha tiedosto oli piilottanut sen.

Korjattu 3-1:stä eikä 3-3:sta — avauskentän liika vaikeus *oli* se vika, ja
3-3:n nostaminen olisi ollut luvun virittämistä kentän sijaan. Kaksi uutta
jääkohtaista palikkaa (`ice_pit`, `ice_twin`), koska alkuperäiset ovat yhteisiä
maailmojen 1, 2 ja 4 kanssa.

**Perustelu leveydelle on sama mitattu tiedosto:** kuuden ruudun budjetti on
70 % *juoksu*kantamasta ja olettaa että paikalle saavutaan juosten. Jäällä se ei
ole valinta, joten maailman 3 kuilut mitoitettiin kävelykantamaan samalla
säännöllä — 87 px × 0,7 ≈ 4 ruutua. `pit_twin`in oma kommentti sanoo että sen
vaikeus on pysähtyminen kahden ruudun saarekkeelle, ja pysähtyminen on juuri se
mitä tämä maailma ei salli.

Kaventaminen eikä astinkiviä: `ice_crumble`in kommentti perustelee jo miksi
jäällä ei anneta lepopaikkoja kesken kuilun.

w3 nousee taas: 162 → 133 → 174, notkoja yksi. Koko pelin käyrä
128,5 → 149,0 → 172,3 → 187,0 → 226,5.

**Maailmaa 5 ei generoitu uusiksi.** Sen kentät läpäisevät validaattorin myös
uusilla luvuilla; uusi generointiajo on oma päätöksensä.

## v26.08.09.8 — mekaniikat kaikkiin maailmoihin, jakoruutu, mobiiliohjaus ja yksi fysiikkabugi

Iso erä, ja pääosin rinnakkaisten alaagenttien tekemä: kuusi työtä omissa
työkopioissaan, yhdistettynä ja portti ajettuna kerran kaikelle yhdessä.

### Tauko ei jää päälle kohtauksen vaihtuessa

*(Kirjattu jälkikäteen: korjaus tuli tässä erässä mutta jäi vaille omaa
merkintäänsä, ja sen huomasi vasta roadmapin siivous.)*

Bugi: laita peli tauolle, avaa debug-ruutu ja warppaa seuraavaan maailmaan, niin
taukoa ei saa enää pois. Peli on jumissa eikä siitä pääse kuin lataamalla sivun.

**Syy ei ollut se mitä oire lupasi.** Tauko- ja debug-ruutu eivät kilpailleet
mistään. Tauko jäi päälle kohtaukseen jossa sitä ei voi ottaa pois:
taukonäppäin vastaa vain `LevelScene`ssä, joten maailmankartalla mikään näppäin
ei kosketa lippuun — ja `step` ohittaa kartan päivityksen niin kauan kuin lippu
on päällä. Warppaus on vain lyhin tie sinne; **mikä tahansa kohtauksen vaihto
tauon aikana tekee saman.**

Korjaus on siksi `setScene`ssä eikä warpissa, ja samasta syystä kuin tunnelma
nollataan siellä: tauko kuuluu siihen paikkaan jossa oltiin, ja se että jokainen
kohtaus muistaisi sammuttaa sen itse on juuri se tapa jolla se jäi päälle.

Testi ensin, ja se kaatui oikeasta syystä (`paused true, WorldMapScene`).
Ensimmäinen versio testistä ajoi `game.step()`:n varmistaakseen että kartta
todella päivittyy — ja kaatoi kolme esittelytilan testiä, koska step pyörittää
myös alkuruudun jouten-laskuria. Lippu kohtauksessa jossa ei ole taukonäppäintä
*on* se jumitila, joten lippu on se mitä kannattaa väittää.

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

Selaintuki ei siis ole se joka tämän kaataa. WebGL 1 on ollut mukana vuodesta
2011 ja WebGL 2 on kaikissa nykyselaimissa — viimeinen puuttuja oli Safari, joka
sai sen iOS/macOS 15:ssä (2021) — ja tälle pelille kumpi tahansa riittää, koska
tarvittava on yksi tekstuuri ja yksi fragment-shader. Se mikä *oikeasti* kaataa
WebGL:n on ajuri, ja siksi fallback testataan eikä oleteta. WebGPU olisi taas
liian aikaista: Safarilla se tuli vasta 2025 ja Firefoxin tuki on osittainen,
eikä se toisi tähän mitään mitä WebGL ei tekisi.

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
