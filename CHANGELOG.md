# Muutosloki

Versiointi on CalVer: `vVV.KK.PP.build`. Jokaisesta merkittävästä muutoksesta
kirjataan **mitä** tehtiin ja **miksi** — perustelu on tässä yhtä tärkeä kuin
muutos itse, koska se on myös se todiste siitä mistä mikäkin on peräisin.
Alkuperää ja tekijänoikeuksia koskevat periaatteet ovat [DESIGN.md](DESIGN.md):ssä.

---

## v26.08.18.36 — a life is a red coin, and the score left the screen

Owner, 18.8.2026: *"let's keep pushing the trend of diegetic HUD. Why do we even
need to show the score before the game over hiscores table? Let's say X yellow
coins turns into one red coin, and each death takes away one red coin — maybe
2/3 of the yellow gauge turns into a red coin, all coins fall down and you now
have +1 red coin and a 1/3 full yellow gauge."*

**The full tube already had an animation, and it was lying.** It was written on
17.8 when a full tube *was* the 1UP: the glass drains over `COIN_FLUSH` frames,
the mouth throws a spark "up, where the 1UP came from". A day later coins became
time, the payout moved to a career counter of 500, and nobody moved the
animation — so reaching a hundred coins drained the glass, threw the spark, and
then snapped straight back to full with no life given. The drain was a draw-time
multiplier on `tubeFill` and `state.coins` was never touched.

Now it is true. At `COIN_CAP` the tube pays `RED_COST` **64** coins out and
keeps **36**, and `gainLife` fires on the same frame.

**64 and not 66.7.** Two thirds of a hundred is not a number of coins. 64 is 2⁶,
the scale `core/points.js` is already on, and it leaves 36 — 64 % out against
the 67 % asked for, a coin and a half of difference, 1,8 seconds of clock.

The cap *was* moved to 96 first, because 96 = 64 + 32 is the prettier
arithmetic, and the gate priced it within one run: the tube's interior is
exactly 200 px at **two pixels per coin** and `verify.mjs` measures it. A
96-coin cap in a 100-coin glass is either a fractional pixel scale or a
re-measured tube. The hundred stays.

**The trade is deliberately good and deliberately automatic.** 64 coins are 80
seconds; a level's coins buy 30…54. So a life costs about two levels of income
and is worth much more than that — which matters, because nobody is asked. A
price the player would rather not pay, taken without asking, would make a full
tube something to *avoid*, and the full tube is the one moment this meter exists
to promise. It also cannot kill: 36 coins are 45 seconds, so the glass is never
left empty by its own reward.

**`LIFE_COINS = 500` is gone.** Two ways to buy the same thing is DESIGN.md §8,
and the tube's way is the one you can see. `coinsTotal` stays because the run
card counts it, not because anything is bought with it.

**The score is off the screen.** A running total is a number nobody acts on: it
cannot be spent, it changes nothing about the next jump, and every payment it
records has already said so where it happened, as a figure popping off the thing
that paid. It is read out at the end in `scenes/scores.js`, where somebody is
actually deciding whether the run was any good. The world map lost it too — the
map and the level cannot tell different stories about what the player has.

Lives take the freed row as red coins, drawn the same size as the yellow ones in
the tube on the other side of the screen, so the exchange rate is a picture
rather than a rule. Over five lives the row would leave its corner — `verify.mjs`
measures that the readouts stay in the top corners, and it caught exactly that
with twelve — so the sixth life onward is a plus.

Gate: *täysi putkilo vaihtuu punaiseksi kolikoksi ja jättää reilun kolmanneksen*
— pinta 36, coins 36, elämät 3 → 4.

---

## v26.08.18.35 — the ground moves in 43 levels instead of 19

Owner, having looked at the playtest desk: *"the levels are still super flat."*

**Measured before arguing.** For every column, scan up from the bottom row while
the tile is solid; the topmost solid row is the ground height. Then count how
many columns sit on the level's lowest ground row. The answer split cleanly in
two, and the split was not about tuning:

    13 levels   40 % on the floor   generated, outdoor theme — the pass runs
     6 levels   25 % on the floor   hand-made with the terrain flag
    13 levels  100 % on the floor   generated, ceiling theme — pass switched off
    33 levels   98 % on the floor   hand-made, no flag

Where the terrain pass runs, the ground already moves. **It was switched off for
46 of 65 levels**, so nothing about `MAX_LIFT` or the seam spacing was the
problem — coverage was. (`MIN_SPAN` was tried at 24 instead of 40 and moved the
medians by nothing at all, which is how that was established rather than
assumed.)

**Ceiling themes: the roof rode up with the floor.** The pass lifts whole
columns, which is what makes an enemy rise with the ground it stands on. Under
an open sky there is nothing above to damage; the factory has a lid and the bone
world has a sky that must stay empty, and both are absolute claims about the top
rows. Lifting broke them twice over — the lid moved up with everything else, and
the ramps at each span edge, written as complete columns of sky over ground,
erased the lid outright. Measured: **all 240 seeds** failed for 4-4, 4-5, 4-6,
5-5 and 5-7 with *tehtaassa ei ole kattoa*.

`liftTerrain` now takes `keep`: how many rows at the top it may not touch. The
ground below rises, the roof stays, and the headroom between them shrinks by
exactly the lift — the honest cost, and now what `columnCap` measures. Factory
keeps rows 0-3, the bone world rows 0-5.

The cloud world refuses, and it is the *theme* refusing rather than the pass
failing: `ruleCloudNoLegs` forbids anything solid above the floor, and lifted
ground is solid ground above the floor by definition. 7-4, 7-5 and 7-6 stay
flat and that is the world being what it is.

**Hand-made levels: ten of eleven took the flag.** 1-1, 2-1, 2-3, 4-1, 4-3, 6-1,
6-2, 6-M, 7-1 and 7-3, from 87.3 % of columns on the floor to **57.2 %** on
average. Four needed a named terrain seed rather than `true`, and each name is a
gate the default seed failed:

- `1-1a` — `true` rolled one brick into hiding something, and verify asserts the
  first level hides nothing.
- `2-1i` — `true` cost the camera 15.10 px of lurch against a 13 px ceiling, and
  started the sun walk inside a hillside. 12 seeds measured; `2-1i` reads what
  flat ground read.
- `2-3v` — terrain dilutes the score, and half the seeds cost world 2 its fork by
  dropping LAAVATIE under the 150-point pip threshold. 26 seeds measured;
  `2-3v` is 151.9.
- `7-3m` — `true` made a floor jump under the anvil deck lethal.

3-3 refused again, for the reason it refused the first time: its `sky_run` gap is
exactly the measured six-tile budget, so any ramp that eats the run-up makes it
unclearable. Seven seeds, the bot died in the same gap every time, and the flag
is not there.

**Two generated levels needed `seedOffset`** — 4-5 lost the ground route to its
new terrain, 4-7 came out perfectly flat — which is the knob from v26.08.18.34
being paid for on the same day it was built.

Result, and the boss arenas are excluded because `terrainSeedOf` has always
excluded them (a boss respawns on a fixed row):

    all 65 levels    95 % -> 79 % on the floor,  6 -> 10 height changes
    the 50 non-boss              67 % on the floor,   15 height changes
    perfectly flat   20 -> 15, of which 5 are playable levels: the three cloud
                     levels, 7-P (multi-band), and nothing else

Difficulty moved by a few points either way and no level moved away from its
aim; both branch forks still read differently on the map, which is the gate that
made `2-3v` a measurement instead of a preference.

---

## v26.08.18.34 — feedback moves the generator, and the file can be rebuilt again

Two halves, and the second one was found by shipping the first.

**A note is now an input.** The playtest desk collected opinions and nothing
read them. `tools/read-notes.mjs` parses a note — a level, a column range, and
one of `easier`, `harder` or `shape:<piece>` — and `gen-levels.mjs --notes`
applies it through the same two knobs the telemetry log already moves: the calm
in front of a set piece, and the size of the piece itself. Where a note and a
death cluster land on the same piece the note wins; they answer different
questions, and somebody writing a note has already seen the deaths.

The "harder" direction did not exist before, and adding it is where the care
went. `ctx.ease` had only ever subtracted, so three of its seven sites clamped
to the jump budget *before* the subtraction and would have widened a hole past
a jump this game has measured. `withinBudget` re-applies the cap afterwards; at
ease 0 it is arithmetic that changes nothing, proven by hashing 840 builds
across eight themes before and after. A shape is looked up in the world's own
palette, so a `drop` list still wins and the refusal is printed rather than
granted. A note that changed nothing says which knob stayed still. Two notes
pulling one stretch two ways are both refused and named — file order is not an
opinion anybody holds.

Shapes resolve before directions: a `shape:hill` under a `harder` note used to
let the direction ask `EASEABLE` about the gap the hill replaced, and then
print "gap widened by 1" about a hill.

**And the file could not be rebuilt.** `src/data/generated.js` says at the top
which command rebuilds it. Running that command changed 15 of the 26 levels —
and two consecutive runs agreed with each other, so the tool was deterministic
and the committed file was simply behind the code that writes it. It matters
for the half above: a note names columns of the level as shipped, and the
generator would have rebuilt a different layout underneath it.

Rebuilding is what exposed the reason it had gone stale. Three of the rebuilt
levels — 3-4, 5-1 and 5-4 — came out with a hole the smallest body cannot
cross, i.e. failing the ground-route promise (DESIGN.md §5). The seed search
validates jump budget, headroom, spawn space, theme rule and corpus, all of
which are readable off the grid; *clearable at power 0* is not, and takes the
bot, a browser and five seconds per level. So the file had been correct because
somebody once looked, not because the tool guaranteed it — and a file nobody
dares rebuild is a file that goes stale.

`seedOffset` carries the bot's answer back into `PLAN`, one number per level
that needed one, with the reason written above each. All three cleared at
offset 1, which is the honest shape of the knob: it is not a difficulty dial
and buys nothing but a different draw. Every level is clearable at the smallest
size again, and `node tools/gen-levels.mjs` now reproduces the committed file
byte-for-byte.

Six levels moved on the difficulty meter and none of them moved away from its
aim: 3-4 150.2 → 141.0 (aim 135), 5-1 186.0 → 190.3 (aim 190, now exact),
5-6 245.2 → 240.1 (aim 245), 5-4 200.6 → 199.5 (aim 200), 5-2 163.8 → 162.3,
1-5 62.3 → 60.3. The other twenty measure the same as before.

Ten new checks in `tools/verify.mjs`, each shown red first by breaking the
source it protects.

---

## v26.08.18.32 — puhetesti mittasi näyttämöä, ei puhetta

`a spoken line is loud enough to hear` kaatui satunnaisesti, kolmesti 16.8.2026
aikana ja aina eri lukemin, ja se esti pomoäänet (ROADMAP). Kynnystä ja
odotusaikaa oli jo säädetty kahdesti, kumpikin oikeasta syystä ja kumpikaan ei
auttanut. **Tällä kertaa mitattiin ensin.**

Kaatuneen ajon rivi luettiin loppuun asti — *näyttämö WorldMapScene … ikkunat
65.11 65.11 65.11 13.42 8.96 5.62 5.62 5.62* — ja siinä oli kaksi asiaa jotka
vaimeneva ääni ei voi tehdä: kolme peräkkäistä **täsmälleen** yhtä suurta
lukemaa, ja lopuksi tasainen taso eikä nollaa. Uusi diagnostiikkarivi kertoi
kumman: väylän taso mitattiin **ennen** kuin lohko soitti mitään, ja se oli
*24,25 @ WorldMapScene/m:-/a:wind*. Lohkon oma tahallinen "punainen" (neljä
ääntä) oli murto-osa siitä mitä odotus todella kuunteli, ja `Ambience`in
tuulipeti — jatkuvaa kohinaa, ei häntä — oli päällä. Peti herää joka kerta kun
elossa oleva näyttämö kutsuu `hold()`ia, eli portin lukema riippui siitä mikä
näyttämö sattui jäämään pystyyn edellisestä lohkosta.

Ensimmäinen korjausyritys — peli nimikkösivulle, `Music.stop()`,
`Ambience.stop()` — puhdisti väylän (*ennen 0.00*) ja paljasti toisen puoliskon:
**houkutusdemo lähti kesken odotuksen** ja alkoi soittaa samalle väylälle
(*pitäjät TitleScene/… DemoScene/m:level/…*, ikkunat 282,65 viisi kertaa,
19,4 sekuntia). `game.toTitle()` *ostaa* kaksikymmentä sekuntia; se ei takaa
mitään. Siksi demo ei ole enää ajastettu vaan **irrotettu**: `startDemo` on
mittauksen ajan tyhjä ja palautetaan lopuksi.

Kynnyksiin ja odotusaikoihin ei koskettu, ja tahallinen punainen on yhä
tallella. Todiste on kolme peräkkäistä ajoa, koska yksi vihreä ei kerro mitään
satunnaisesta viasta: **ääni 0,614 / 0,609 / 0,612, tausta 0,000 joka kerta**,
eikä yhdessäkään ollut muuta pitäjää kuin nimikkösivu.

Sama parkki annettiin myös konsonantti- ja pomoäänilohkoille, jotka olivat
tehneet saman käsin ja vajaammin. Niistä kaksi (`every consonant makes a sound
of its own`, `a fricative is audible…`) menee yhä noin kahdessa ajossa kolmesta
läpi tyhjänä — *"ei mitattu (äänikello seisoi)"* — ja se on **eri vika**, ei
sama: päätön Chromium renderöi ääntä ryöppyinä (mitattu *äänikello 3,39 s /
seinäkello 1,56 s*), ja yhden ryöpyn väliin mahtuu enemmän ääntä kuin
analysaattorin 743 ms:n muistiin. Ääntä menee siis oikeasti ohi, joten
"ei mitattu" on totuus eikä liian tiukka raja. Korjaus on mittaustapa joka ei
voi menettää näytteitä (`AudioWorkletNode`); se on kokeiltu toimivaksi ja
kirjattu ROADMAPiin.

Samassa erässä `tools/verify.mjs`:n kenttäkiinnikkeet siirrettiin kuudentoista
rivin ruudukolle: lattia riville 14, kaistat 16/32, pystykoekenttä 48 riville,
ja `4-F`:n möykkyrivin punainen vaihtui `4-2`:een koska salaisuuksien hajautus
arpoi uudelleen. Yksi portti (`potkaistu kuori kiihtyy alamäkeen`) ei ollut
mitannut mitään: kuori syntyi kahdeksan pikseliä lattian sisään, luki lattian
seinäksi ja pomppi paikallaan koko kokeen ajan — nyt jalat pannaan pinnalle
`toShell`in jälkeen, ja alamäki nostaa vauhdin 3,4:stä 4,76:een. Sen pari
(`kävelijä kävelee samaa vauhtia myös rinteessä`) ei ollut sekään: kävelijä ei
ehtinyt rinteeseen asti yhdeksässäkymmenessä framessa, joten koe vertasi kahta
tasamaata. Molemmat lukevat nyt myös sen, montako framea rinteessä oikeasti
kuljettiin.

---

## v26.08.18.33 — pumping: the P-meter has a rhythm

Owner, 18.8.2026: *"could a mechanic work where tapping run repeatedly gives you
more speed? Not continuous mashing — a meter where hitting the right moment in
the cooldown gives a boost, like the active reload in Gears of War."*

**One meter, two ways to fill it.** Holding run fills the P-meter at `P_FILL`
exactly as it always has, and nothing about that changed. What is new is a
technique: let go and press again on the beat, and the gauge jumps. A second
gauge beside the first would have been two answers to one question, which
DESIGN.md §8 forbids — so this is not a gauge, it is a way of filling the one
that already means *"you have run long enough to go faster"*.

**It fills faster, it does not go higher**, and that is not taste. `cap` reads
`pFull ? MAX_P : …`, so the ceiling is untouched: rhythm reaches P-speed sooner
and never passes it. A mechanic that raised the ceiling would invalidate
`gapTiles` 6 and `wallTiles` 4 — both measured at P-speed — and with them every
level's proof that it can be finished.

Measured, empty gauge to full, 1-1 at power 1:

| how it is played | frames | |
| --- | --- | --- |
| hold the button | **100** | unchanged from before this existed |
| on the beat | **78** | 22 % faster |
| one frame early | **77** | the window straddles the beat on purpose |
| off the beat | **491** | 36 vents — far worse than simply holding |
| mashing | never fills | you cannot mash the run button and run at once |

**A miss vents**, which is the thematically exact cost for a body that runs on
gas, and it is what keeps the technique a choice rather than free money. The
window is four frames of twelve and straddles the beat — one early, three late
— because you aim at something you can see, and a hair early is the same
mistake as a hair late.

**The metronome is a puff and not a sound.** The beat is drawn as a fat, slow
puff behind the heels. That is a limitation rather than a decision: an audible
metronome needs a sound of its own, and a new sound is a separate argument.
Venting *is* audible, because that is the half you must not miss.

**Two things were measured and then had to be rebuilt.** The beat first rode
the existing plume, so it would need no new drawing — but the plume's own
rhythm accelerates from `PLUME_SLOW` to `PLUME_FAST` as the gauge fills, so the
cue drifted against a fixed beat and landed on it only by accident. And
`pumping` was first gated on the run cap, which goes false underneath the press:
with the button up the cap drops to `MAX_WALK` and `vx` bleeds 2.50 → 2.44 in
one frame, so the beat clock reset every time the player used it. Rhythm came
out *slower* than holding, 111 frames against 100, and nothing vented at all.
The threshold is now "faster than a walk", which one released frame cannot fall
through.

**It stays optional, and the existing gate proves it.** The power-0 bot in
`playable.mjs` holds the button and cannot play this mechanic, so any level that
came to require rhythm would fail the day it was written. Nothing new had to be
built to protect DESIGN.md §5.

---

## v26.08.18.31 — alkuperäisyystarkistus ei ollut koskaan verrannut mitään

Tämä ei ollut listalla. Se löytyi kun kenttädatan rivimäärä piti käydä läpi
tiedosto tiedostolta.

`tools/originality.mjs` trimmasi **korpuksen** neljääntoista riviin muttei
meidän ruudukkoa. Avain on ikkunan sarakkeet merkkijonoina, ja sarakkeen pituus
on ruudukon korkeus — eli meidän avaimet olivat 15 merkin sarakkeita ja
korpuksen 14 merkin. **Ne eivät voineet olla samoja merkkijonoja.** Tarkistus
palautti aina nollan, ja se nolla luettiin todisteeksi: jokainen
`origin: 'checked'` ja päivän kenttien sormenjälki oli tyhjä väite. Koodin oma
kommentti väitti nimenomaan sitä mitä koodi ei tehnyt (*"Both grids are trimmed
to the same 14 bottom rows"*).

Korjattuna osumia tulee — ja se mitä ne ovat, ratkaisi säännön. Kahdeksan
sarakkeen ikkunassa osumat ovat tasamaata, portaita ja **yksi kävelijä
tasaisella lattialla**: lajityypin aakkosia, jotka DESIGN.md kohdan 2 mukaan
ovat vapaita. Mitattuna, 26 kenttää 481 korpustiedostoa vasten: 640 osumaa
kahdeksalla sarakkeella, 95 kahdellatoista, 8 kuudellatoista, **0
kahdellakymmenellä**. Sama nolla saadaan toista tietä — jättämällä pelkkää
maata ja ilmaa sisältävät ikkunat vertaamatta, koska lattia ei ole sommitelma —
ja kaksi eri sääntöä samaan tulokseen on ristiintarkistus eikä sattuma.

Omistajan päätös: korjaa vertailu ja nosta ikkuna mitatulle rajalle. Väite on
nyt vahvempi kuin se jonka tiedosto luuli tekevänsä: **yksikään ruudullinen
mitään sijoitettua sisältävä pätkä ei toistu korpuksesta** — ja tällä kertaa se
on mitattu. 26 generoitua kenttää ja 1096 päivän kenttää tarkistettiin korpusta
vasten uudestaan, osumia 0.

Hinta sanotaan ääneen: leveämpi ikkuna päästää läpi lyhyemmän lainauksen.
Kahdeksan saraketta ei kuitenkaan **voinut** löytää sellaista, koska se ei
erottanut lainausta lattiasta — mittaamaton tiukkuus ei ole tiukkuutta.

---

## v26.08.18.30 — kuudestoista rivi, ja se mitä sen alta paljastui

Kenttädata kasvoi viidestätoista rivistä kuuteentoista. ROADMAP lupasi siitä
yhden asian ja se toteutui; matkalla löytyi kaksi asiaa joita se ei luvannut,
ja jälkimmäinen on tämän erän tärkein rivi.

**PYSTYVIERITYS PALASI.** Ikkuna on 240 px ja kenttä oli täsmälleen sen
korkuinen, joten kamera ei voinut liikkua pystysuunnassa lainkaan siitä asti
kun HUD-nauha purettiin (17.8.2026). Nyt kenttä on 256 px ja liikkumavaraa on
**16 px** — letterbox-kentissä 64 px, koska niiden ikkuna on 192.

Mitattu eikä oletettu: botti juoksee ja hyppää kentän läpi, ja kamera liikkuu
1-1:ssä 0…16, 2-1:ssä (letterbox) 16…64 ja 1-2:n reittikaistan sisällä 14 px.

**Rivi tuli päälle eikä alle**, ja se on koko ero: alle lisätty rivi olisi
antanut vierityksen muttei yhtään lisää tilaa hypylle. Päälle lisätty siirtää
lattian alemmas ja **kannen kauemmas**, joten maastopassin `MAX_LIFT` nousi
yhdestä kahteen. Mitattu eikä arvattu: korkein pieruhyppy jätti 1-1:ssä 30,38
px kanteen, lisärivi antaa 16 px lisää, ja kahden laatan nosto (32 px) jättää
siitä 14. Kolme ei mahtuisi. **Jokainen seuraava rivi kenttädataan ostaa tasan
yhden laatan lisää.**

Ja se tulee **kokoajassa eikä kenttädatassa**: palikkatiedostot ovat yhä
viisitoista riviä lattioineen riveillä 13-14 — siellä on 370 rivimerkintää
kahdessatoista tiedostossa — ja kokoaja lisää yhden rivin. Kaksi nimeä,
`CHUNK_ROWS` ja `BAND_ROWS`, ja niiden ero on muutoksen koko sisältö.

**Taivasrivi on kopio ylimmästä eikä tyhjä rivi**, ja se on mitattu: palikoiden
rivillä 0 on tasan kaksi merkkiä koko sanastossa, `#` 82 palikassa (katot) ja
`v` yhdessä (pavunvarsi). Kumpikin jatkuu ylöspäin. Tyhjä rivi olisi jättänyt
katon päälle ryömintätilan ja pysäyttänyt varren riviä ennen kaistan rajaa —
portti sanoi jälkimmäisen heti: *"nothing leads into the sky band"*, 1-2, 2-2
ja 3-2.

**GENEROIDUT KENTÄT SAIVAT MAASTON.** Passi on toinen toteutus eikä toisinto,
ja ero on siinä mitä kutsujalla on käsissään: kokoaja pitelee palikkalistaa ja
voi **työntää rinteen väliin**, generaattori kirjoittaa ruudukkoon jonka leveys
on mitoitettu luku — joten se **kirjoittaa rinteen tasamaan päälle** ja vaatii
siksi vauhdinottoa `MAX_LIFT` saraketta enemmän. Portit, rinteen muoto ja se
peruslause että maa nousee ja jättää kiven alle ovat yhteisiä. Ulkoilmateemat
vain, samasta paikasta luettuna kuin mäki lukee omansa.

26 kenttää generoitiin uusiksi korpus käsillä, 16-rivisinä ja maastolla.

**Ja se mitä varianssimittari sanoo koko työstä.** Omistajan alkuperäinen
valitus 17.8.2026 oli *"kentissä on edelleen liian vähän varianssia! Ne
tuntuvat tasaisilta ja toisteisilta"*, ja `tools/variety.mjs` mittasi silloin:
uutuus 38 % (w8) … 82 % (w5), neljä maailmaa kahdeksasta toistaa itseään
mediaania enemmän, ja **kuudessa kahdeksasta loppupuoli on alkupuolta
toistavampi**. Nyt: uutuus **68 % … 99 %**, itseään toistavia yhä neljä, ja
loppupuoli on toistavampi enää **neljässä kahdeksasta**. Maastopassi
käsintehdyissä ja generoiduissa kentissä on se mikä muutti nämä luvut.

**RUUDUN KORKEUS LASKETAAN OIKEIN.** `tools/difficulty.mjs`in `SCREEN_ROWS` oli
13 (= vanha `VIEW_H` 208 / 16) vielä sen jälkeen kun ikkuna kasvoi 240:een. Luku
ei kaada mitään eikä näy missään — se vain lukee kiipeilykentän putoamiset kaksi
laattaa liian aikaisin kuvan ulkopuolelle vieviksi. Nyt 15, ja **portti vertaa
sen `VIEW_H`iin**; leveydellä sellainen on ollut pitkään, korkeudella ei ollut.
Mitattu vaikutus vaikeuslukuihin: nolla. Se on silti korjaus — luku joka on
väärin ja jonka vaikutus sattuu olemaan nolla on luku joka on väärin.

**RINNE KOSKEE MUUTAKIN KUIN PELAAJAA.** ROADMAP kirjasi puuttuvan puoliskon:
*"kuori kiihtyy alamäkeen kuten pelaajakin, mutta kukaan ei ole vielä
suunnitellut sitä."* Suunnitelma on yksi lause: **se mikä liukuu tai vierii
tottelee rinnettä, se mikä kävelee ei.** Kävelijä kävelee omaa vauhtiaan ja se
on sen koko sopimus pelaajan kanssa; potkaistu kuori ja karvapallo ovat
kappaleita joita on työnnetty, ja kappale rinteessä on painovoimaa. Sääntö
siirtyi `player.js`:stä `physics.js`:ään yhtenä funktiona — sama mäki, sama
veto, rajat kutsujalta.

---

## v26.08.18.29 — SID-sanasto loppuun

ROADMAPin lista "mitä SID-sanastosta jäi tekemättä" oli neljä kohtaa, ja ne
olivat siellä siksi että jokaisen voi *melkein* tehdä: rumpu basson päällä on
melkein varastettu kanava, korkeampi nuotti on melkein hard sync, ja äänen
vibrato on melkein nuotin vibrato. Nyt ne ovat tehtyjä, ja **kolme neljästä
päätyi eri paikkaan tai eri lukuun kuin ROADMAPissa luki** — ne kohdat ovat
tässä, koska ne ovat se osa jota diff ei kerro.

**Ensin työkalu, jota ilman mikään tästä ei ole tarkistettavissa.** `tone`
rakentaa graafinsa nyt annettuun kontekstiin (`buildTone`), joten sama koodi
joka soittaa pelin soittaa myös `renderTone`n offline-kontekstiin — ääni on
taulukko eikä korvahavainto. Kaikki alla olevat luvut on renderöity samasta
koodista jonka pelaaja kuulee, eikä mallista siitä.

**1. Kanavan varastaminen (`level`).** Sekvensserissä on käsite "tämä ääni on
varattu": `steal` varaa kanavan PAL-ruuduissa, varattu ääni vaikenee, ja pitkä
nuotti katkaistaan varauksen alkuun (`_spanOf`). Ilman katkaisua varaus olisi
ollut kirjanpitomerkintä, jonka läpi basso olisi soinut.

*Reikä on se ääni.* Rumpu basson **päällä** on paksumpi; rumpu basson
**tilalle** on isku, koska pohja katoaa ja tulee takaisin. Sitä ei saa millään
miksausratkaisulla, ja siksi tekniikka on tässä pelissä muutakin kuin nostalgiaa
— kanavia meillä on niin monta kuin jaksaa rakentaa.

ROADMAP sanoi "kahdeksi framea". **Se on väärä luku tässä tempossa**, ja se
mitattiin: ruutu on 20 ms, `level`in kuudestoistaosa 96 ms, joten kahden ruudun
reikä katoaisi nuotin oman vaimenemisen sisään. Kuusi ruutua on 120 ms ja
nielee varastetun nuotin sekä seuraavan. Portti lukee `audioDiag`ista **4
osumaa ja 4 vaiennettua nuottia** 32 askelta kohti — molemmat, koska osumat
ilman vaikenemista olisi lisätty rumpuraita uudella nimellä.

Koti on yleisraita eikä erikoisraita: sen basso soittaa kuudestoistaosia
keskeytyksettä, eli se on pelin ainoa basso jonka vaikeneminen on tapahtuma.
Ja se on eniten kuultu raita, joten tekniikka joutuu ansaitsemaan paikkansa.
Askeleet 6 ja 13 ovat tahdin kaksi kuudestoistaosaa joilla rumpusetti ei lyö —
setti ei voi soittaa siellä, ja basso voi.

**2. Rengasmodulaatio — tehtaassa (maailma 4), ei luulaaksossa.** ROADMAP
ehdotti luulaaksoa. Se oli väärä ehdotus kahdesta syystä, ja kumpikin riittäisi
yksin: `bone` on **lainattu raita** (Saint-Saëns, *Danse macabre*, DESIGN.md
kohta 1 b), eikä lainattua sävelmää järjestellä uusiksi tekniikan takia — ja
vaikka olisi oma, `bone`in ksylofoni on jo kirjoitettu ulos aaltomuotona ja
verhokäyränä, joten rengasmoduloitu kello olisi toinen tapa sanoa "luut
kalisevat" (DESIGN.md kohta 8).

Tehtaan rummuissa luki jo "metallic sixteenths", mutta hi-hat on suodatettua
kohinaa — metallin pinta eikä metalli. Alasin on `comp`, suhde 2,41, ja
mitattuna se on **tulo eikä sekoitus**: kantoaalto vaimenee 7597-kertaisesti ja
tilalle jää kaksi sivunauhaa kohdissa 1,41× ja 3,41× perustaajuutta. Kumpikaan
ei ole lähelläkään kokonaislukumonikertaa, ja juuri se on ero kellon ja äänen
välillä.

**3. Hard sync — jaksotettuna uudelleenkäynnistyksenä, ja se toimii.** ROADMAP
piti tätä ainoana jota WebAudiolla ei saa suoraan. Reitti oli oikea: koska
`OscillatorNode` alkaa aina vaiheesta nolla, isäntäjakson mittainen
oskillaattori joka käynnistetään joka jakson alussa **on** vaiheen nollaus,
eikä approksimaatio siitä. Kolme lukua, koska "kirkkaampi ääni" olisi mennyt
läpi yhdellä:

| väite | mitattu |
| --- | --- |
| sointiväri seuraa orjaa | huippu isännän 1. osaäänestä 4:nteen kun suhde 1 → 4 |
| sävelkorkeus ei liiku | perustaajuus 0,0114 synkronoituna, **0,0000** nelinkertaisella nuotilla |
| jakso on isännän | energiaa isännän monikerroilla 19× välien verran |

**Hinta ratkaisi paikan, ja se on mitattu.** Yksi oskillaattori isäntäjaksoa
kohti tarkoittaa että hinta kaksinkertaistuu oktaavia kohti: pomoraidan lyijyn
iskut maksaisivat 147 solmua nuottia kohti ja `lead octave up` -osiossa 294.
Basson oktaavihyppy maksaa 37, pahimmillaan 56. Sync meni siis bassoon — mikä
on lisäksi se ääni jonka Hubbard tästä oikeasti teki. Neljä merkittyä nuottia
koko pelissä, ja portti laskee sekä määrän että kalleimman.

**4. Vibrato- ja portamento-taulukot (`marks`, kaasukehä).** Nuotin kolmas
kenttä on avain äänen `marks`-tauluun: soitin antaa oletuksen, nuotti
poikkeuksen — SID-ajurin taulukko sellaisenaan. Taulu kantaa syvyyden,
nopeuden, **viiveen** ja portamenton, ja kohta 3 käyttää samaa taulua. Kaksi
tekniikkaa, yksi mekanismi.

Kaasukehä siksi että raidan koko ajatus on ettei mikään putoa (D-lyydinen), ja
portamento on sama väite melodian puolella. Mitattu: liuku on perillä nuotin
puolivälissä (227 → 330 Hz) ja **pysyy** siellä — liuku joka ei ehdi perille on
glissando eikä portamento. Viivästetty vibrato on alussa 8,4 Hz leveä ja
lopussa 28,0 Hz, kun viiveetön on 28,0 Hz alusta asti. Fraasi 2 (viima) on
kokonaan merkitsemätön, ja se on todiste ettei tämä ole äänen ominaisuus.

Kuusi uutta porttia, ja kaikki kuusi lukevat signaalia eivätkä taulua.

---

## v26.08.18.28 — karvapallo kerää: katamari kaasukehässä

Omistaja 18.8.2026: *"muokkaa jotain vihollista niin, että se voi tarttua
yhteen toisen vihollisen kanssa ja liikkua yhdessä; niiden koko kasvaa
spiraalin muodossa eli vähän kuin katamari damacyssä mutta siten, että
vihollinen itse kasvattaa itsestään isomman."*

**Karvapallo, eikä uusi laji.** Pyyntö luettiin kirjaimellisesti ("muokkaa
jotain vihollista"), ja karvapallo on se ainoa jolle tämä sopii ilman uutta
lakia: se on pallo, se vierii jo, se kasvattaa vauhtiaan jo — ja se **kuolee
itsestään** (`KARVA_LIFE`, seinään puhkeaminen). Kasvava pallo on siis
tilapäinen tapahtuma eikä kentän uusi pysyvä muoto. Nimikin sanoo sen:
karva*pallo*, ja katamari on juuri se mitä karvapallo oikeassa maailmassa tekee.

Pallo nappaa yli vierimänsä kävelijät, kuoret, piikkiukot, korkkiukot ja yökit
(`rollable`, oletus ei — kyky eikä lajilista), kasvaa neljä pikseliä kutakin
kohti neljään asti, ja kyytiläiset asettuvat **arkhimedeen spiraalille**:
mitattuna säteet 19 · 24 · 29 · 34 px, ja ne kiertävät pallon oman pyörinnän
mukana. Kasvun resepti on pomon (`applyScale`) pienempänä — jalat ja keskiviive
pysyvät — ja skaalaus on naapurikuvapiste omaan puskuriin, sama vastaus kuin
pelaajan voimatasoilla 2…5.

**Kolme rajaa, ja jokainen oli jo kirjoitettu jonnekin muualle.**

1. **Kyyti on lainaa, ei tappo.** Puhjetessaan pallo päästää irti ja
   kyytiläiset putoavat maahan elävinä — sama sääntö kuin murenevalla laudalla
   ja kuuran jäljellä. Siitä seuraa myös se mikä tekee tästä pelattavan: pallon
   annettu vieriä **siivoaa reitin hetkeksi** mutta kasvaa samalla isommaksi
   esteeksi. Kauppa on pelaajan, ja hän näkee molemmat puolet koko ajan.
2. **Ei uutta vahingon lähdettä.** Kyytiläisen laatikko on nolla × nolla, eli
   mikään törmäyssilmukka ei löydä sitä. Laki 2 (*vain oma ketju satuttaa*)
   pitää siis rakenteellisesti eikä muistamalla: pelaajaa satuttaa yhä
   täsmälleen se sama pallo jonka hän näkee tulevan.
3. **Ei viittauksia olioiden välillä.** Kyytiläinen kantaa pallon **tunnusta**
   eikä pallon oliota, koska `savestate.js` kopioi jokaisen oman kentän —
   oliokenttä palautuisi prototyypittömänä kaksoiskappaleena eikä yksikään
   portti huomaisi sitä. Samalla korjattiin se mikä teki tunnuksista
   turvallisia: `claimIds` nostaa laskurin palautettujen tunnusten yli, koska
   laskuri ei ole tallenteessa mutta tunnukset ovat.

Yksi vika löytyi portista eikä pelistä: puhjennut pallo ehti vielä yhden
`update`in ennen kuin se poistettiin listalta, ja keräsi juuri päästämänsä
takaisin — jolloin jäljelle jäi kyytiläisiä joiden kyyti oli poissa, eli
näkymättömiä olioita ilman laatikkoa. *"Vapaana 1"* kolmesta.

Viisi uutta porttia.

---

## v26.08.18.27 — potenssit, arpova lohko ja kuolema joka on tämän hahmon oma

Kolme omistajan pyyntöä, ja kaksi niistä korjaa aiemman päätöksen sen omilla
ehdoilla.

**PISTEET OVAT KAKKOSEN POTENSSEJA.** Omistaja: *"varmista että kaikki pisteet
ovat 2:n potensseja, nyt vihollisten tappamisesta tulee välillä 100, 200 jne."*
Taulukko oli neliöitä (v26.08.18.11), ja se ratkaisi saman ongelman
puolittain — **100 on neliö**, ja niin ovat 400 ja 900, eli neliöllisyys salli
täsmälleen ne genren pyöreät luvut joita vastaan koko sääntö kirjoitettiin.
Nyt 32 · 128 · 256 · 512 · 1024 · 2048 · 4096 · 8192, ketju 1 · 2 · 4 … 128, ja
pomot 2¹³…2²⁰. Potenssi kertaa potenssi on potenssi, joten *jokainen* ruudulle
pomppaava luku on potenssi riippumatta siitä minkä monen kertoimen läpi se tuli.

Hinta sanotaan ääneen `points.js`:ssä: **asteikko on karkea.** Kahden
vihollisluokan ero on aina tasan kaksinkertainen, eikä väliarvoja ole — 16 ja
20 olivat neliöinä naapureita, 256 ja 512 eivät ole. Räikeimmin se näkyy
pomoissa: kahdeksas pomo on miljoona, koska kahdeksan pomoa mahtuu
potenssiasteikolle vain kahdeksan potenssin päähän toisistaan.

**KYSYMYSLOHKO ANTAA 1…5 KOLIKKOA.** Omistajan luku. Määrä on **hajautettu
sijainnista** eikä arvottu ajossa, ja se on pakko eikä makuasia: kolikot ovat
aikaa (v26.08.18.24), joten `Math.random()` tekisi kentän aikabudjetista
arpapelin ja `tools/playable.mjs` mittaisi joka ajolla eri kenttää. Nyt yllätys
on kentässä eikä kellossa — lohko antaa saman verran tänään, huomenna ja
jokaiselle pelaajalle.

Arpa on `hashNoise` eikä `hashPlace`, ja ero on mitattu: `hashPlace` on se
tahallaan jäädytetty rikkinäinen versio jonka jakauma on vino, ja sillä pelin
97 kysymyslohkosta **yksikään** ei olisi antanut neljää tai viittä (42 · 38 ·
17 · 0 · 0). `hashNoise`illa jakauma on 19 · 17 · 22 · 26 · 13. Viisi kolikkoa
on yksi kilahdus ja viisi porrastettua lentoa, ei viittä päällekkäistä ääntä.

**KUOLEMA EI OLE ENÄÄ HYPPY.** Omistaja: *"tee pelaajahahmon kuolinanimaatioista
personallisempia … ehkä kaasu paisuu ja poksahtaa? tai hahmo kaatuu suorilta
jaloilta selälleen silmät ristissä?"* `Player.state()` palautti kuolevalle
`'jump'`, eli kuolema oli **hyppy jonka fysiikka oli riisuttu** — genren kuolema
kirjaimellisesti.

Molemmat omistajan ideoista ovat saman animaation kaksi puoliskoa, koska tämä
hahmo kulkee kaasulla: jäykistyminen on se hetki jolloin kaasu lakkaa
liikkumasta, ja poksahdus on se mihin se johtaa. Kolme kuvaa 141 framen
ikkunassa — **jäykkä** (jalat suorina yhdessä, kädet sivuille ojossa, silmät
ristissä), **paisuu** (vyötärölle kasvaa kaasupullistuma, eli ajastin jonka
näkee), **tyhjä kuori** (poksahtanut, litteä, kädet retkottavat). Poksahdus on
kahdeksan kaasupilveä ja `pop` — sama ääni kuin kuplan puhkeamisella, koska se
on sama tapahtuma isompana.

Fysiikka on tavuakaan muuttamatta ennallaan (`vy = -6,6`, painovoima 0,32), eli
jokainen kuolemasta mitattu asia mittaa yhä samaa asiaa. Uusi on vain kuva —
ja `verify.mjs` mittaa sen neljällä väitteellä, joista ensimmäinen on se joka
olisi muuten rapistunut hiljaa: kuoleva ei näytä hyppäävältä, mitattuna
pikseleistä.

---

## v26.08.18.26 — neljä säätä ja metsä joka palaa

Peli on tuntenut yhden sään: tuulen, joka on aavikon yön puuska ja pilvimaailman
laki 3 (*tuuli kantaa kaikkea*). Nyt niitä on neljä, ja jokainen niistä on
rakennettu tuulen mallista — **kenttäkohtainen lippu, johdettu kellosta,**
mikä on myös syy siihen ettei `savestate.js` tarvitse niistä riviä: palautettu
kello palauttaa sään.

Yksi kenttä kutakin, ja se on ROADMAPin oma sääntö juoksuhiekasta luettuna
uudelleen: *uhka joka on joka kentässä on maastoa, ja maasto ei ole uhka.*

**MAANJÄRISTYS (6-1).** Maa tärisee pystyyn ja **nytkäyttää kerran** sen minkä
se kannattelee. Ilmassa oleva ei tunne sitä lainkaan, ja siitä tulee koko
mekaniikka: järistys on kysymys ("olenko juuri nyt maassa?") eikä hidaste.
`quakeborne` on oletuksena **kyllä**, toisin kuin `windborne` — ja se on väite
eikä epäjohdonmukaisuus: tuuli kantaa, ja kantaminen riippuu keveydestä; maa ei
kanna vaan päästää irti, eikä painavuus ole siihen vastaus. Poikkeuksia ovat
vain ne jotka eivät seiso maassa (nielu putkessa, torvi seinässä) ja ne jotka
*ovat* huone (pomo, aurinko, kuu, papuparooni).

**PYÖRREMYRSKY (7-3).** Suppiloita jotka vaeltavat kenttää vasemmalle kahden
ruudun välein. **Ulkokehä vetää, ydin nostaa** — ja se mitä näet on se mikä
koskee: piirretyn suppilon leveys ylhäällä on `TWISTER_REACH` ja alhaalla
`TWISTER_CORE`, eli tasan ne kaksi lukua joilla veto lasketaan. Kulkee tuulen
`push`-tietä, joten laki 3 pätee: se kantaa kuoria ja vihollisia. Ääni on
tuulen peti, koska suppilo on tuulta (DESIGN.md kohta 8).

**TULIMYRSKY (4-3), ja se kohta jossa portti oli oikeassa ja perustelu
väärässä.** Kekäle oli aluksi kohtauksen piirtämä sade — puhdas funktio
kellosta ja paikasta, ei olioita, ei riviä tallennukseen — ja se kaatoi portin
*"jokainen kenttä on läpäistävissä voimatasolla 0"*: 4-3 jäi sarakkeeseen 107.
Se portti **riisuu kentästä viholliset ja vaarat**, koska sen väite koskee
maastoa, ja maastoksi kirjoitettu sade jäi riisumatta. Nyt kekäle on `Entity`,
`kind: 'hazard'`, sama esine kuin happopisara — ja **katto sammuttaa sen**,
mikä on yhtä aikaa se mitä oikea kekäle tekisi ja se sääntö joka tekee
myrskystä väistettävän. Varoitus on puolitoista sekuntia taivaalla: juoksemalla
ehtii yhdeksän laattaa, eli katon alle.

**PUU ON NYT LAATTA (`t`).** Puita on ollut koko ajan, mutta taustanauhassa:
kolme puuta kolmen mäen päällä, 232 px:n kaistaleena jota toistetaan. Se on
maisemaa jota ei voi osoittaa. `t` on sama puu kentässä — sarake, rivi, paikka
jonka kenttäsuunnittelija valitsee. **Ei kiinteä eikä puolikiinteä**, ja se on
päätös: puu jonka läpi ei kuljeta olisi seinä, ja seinä menisi
lattiaprofiiliin, kuilulaskuun ja hyppybudjettiin. Sen ainoa sääntö on että se
seisoo jossakin (`rules.js`, `checkTrees`) — sama lause kuin vihollisella,
koska kysymys on sama. Laji tulee teemasta kuten maanpinnankin: havu, kaktus,
kuiva runko.

**METSÄPALO (6-2).** Syttyy **pelaajan takaa**, leviää puusta puuhun 1,23
px/frame ja sammuu aukiolle. Juoksuvauhti on 2,5, joten pako on mahdollinen
muttei ilmainen — ja koska metsäpalikoita on kolme tiheyttä (`metsikko`,
`aukio`, `metsanreuna`), metsän muoto *on* kentän vaikeus.

Tämäkin oli ensin väärin päin: jos takana ei ollut puuta, palo syttyi lähimpään
edessä olevaan. Portti kaatui 6-2:een sarakkeessa 208, eli tasan siihen kohtaan
jossa metsä alkaa. Takaa-ajaja jonka eteen syttyy tuli ei ole takaa-ajaja vaan
seinä. Nyt ilman puuta takana ei synny paloa lainkaan.

Ja se mikä pitää tämän emergenssin rajan sisällä (ROADMAP 10.8.2026): **puu ei
ole reitti**, joten palava metsä voi olla se mikä muu maasto ei saa olla, ja
**lopputila on lähtötila** — puu palaa, jää hiileksi ja kasvaa takaisin, kuten
kuuran jälki sulaa. Kumpikin on mitattu eikä muistettu.

Yksitoista uutta porttia (`verify.mjs`: *sää*, *puu ja metsäpalo*). 6-2:n
mitattu vaikeus laski 120,9 → 84,1: kolme luupalikkaa vaihtui kolmeen
metsäpalikkaan, ja metsä on maisemaa jonka vaikeus on siinä mikä siellä palaa.

---

## v26.08.18.25 — maastopassi: maa liikkuu palikoiden välillä

ROADMAPin varianssityön kolmas askel, ja se arvioitiin siellä kalleimmaksi:
*"`rules.js`, hyppybudjetti, vaikeusmittari, botti ja jokainen käsintehty
kenttä lukevat tällä hetkellä lattiaa rivinä 13."* Arvio oli oikea toisesta
toteutuksesta kuin tästä.

**Maasto ei siirry, pinta nousee.** `src/data/terrain.js` kelaa palikan rivit
ylös ja jättää alle sitä samaa maata joka palikan alimmalla rivillä oli. Rivit
13-14 pysyvät siis kiinteinä jokaisessa sarakkeessa jossa ne olivat kiinteät
ennenkin, ja `floorProfile`in siemen, `checkGaps`in pohjattomuustesti ja
`difficulty.mjs`:n `lethalCol` lukevat yhä sitä mitä ne ovat aina lukeneet.
`floorProfile` on osannut vaihtelevan korkeuden koko ajan — se kävelee pinon
ylös — ja vain sen siemen oli rivissä 13. Siemen osuu edelleen. Yksikään
lueteltu tiedosto ei muuttunut.

Siirtymät kirjoitetaan **rinteinä**, samalla muodolla kuin `kumpare` ja
generaattorin `hill`: rinne on maan pinta ja sen alla on kiveä lattiaan asti.
Kenttä on maastonsa kanssa yhä yksi kenttä, sama joka kerta — profiili tulee
kentän tunnuksesta siemenenä, joten jokainen portti mittaa sitä ruudukkoa jota
pelataan.

**Kuusi kenttää sai maaston:** 1-3, 2-N, 2-M, 2-4, 2-5, 3-1. Neljä jäi ilman,
ja jokaisen syy on sen omassa kommentissa — ne ovat tämän erän arvokkain osa,
koska jokainen niistä on asia jonka automaattinen maasto rikkoisi hiljaa:

| kenttä | miksi ei |
| --- | --- |
| 1-1 | piilottaa tarkoituksella *ei mitään*, ja piilotiili on sijainnin hajautus: siirretyt sarakkeet arpoivat sinne yhden. Sillä on myös pelin ahtain kansi. |
| 2-1 | sen ainoa kuori päätyy vasemmalle potkaistuna hiekkaan. Nostettuna lammikko oli kolme laattaa kuoren yläpuolella, eikä kuori nouse mäkeä. |
| 2-3 | maailman 2 haaran koko idea on että tiet mittautuvat eri lukemiin. 154,3 → 145,8 pudotti sen samaan pistemäärään toisen tien kanssa. |
| 3-3 | sen `sky_run` on tasan kuuden laatan kuilu eli tarkalleen hyppybudjetti, ja rinteet sen edellä muuttavat sitä mistä kohtaa juoksija sen kohtaa. Botti kuoli siihen jokaisella siemenellä. |

**Kaksi lukua jotka löytyivät punaisesta.**

1. **Sauma vaatii vauhdinoton, kuusi saraketta kumpaankin suuntaan.** Aluksi
   ehtona oli yksi tasainen reunasarake, ja `tools/playable.mjs` kuoli 1-1:ssä
   sarakkeeseen 290: rinne oli kutistanut `pit_plat`in kymmenen sarakkeen
   kuilun edestä kuudentoista sarakkeen vauhdinoton kolmeen. `validateLevel` oli
   tyytyväinen koko ajan, koska se mittaa kuilun leveyden eikä sitä paljonko
   vauhtia sen eteen mahtuu. Sama sokea piste kuin vaikeustason venytyksellä oli
   — ja siksi sama luku: `RUNWAY` on nyt kahden säännön alla, `terrain.js`:ssä,
   ja `scale.js` tuo sen sieltä.
2. **Nosto on yksi laatta, ja sen määrää kentän kansi.** Maailmalla on kansi ja
   tavallinen kenttä on tasan yhden ruudun korkuinen, joten nostettu maa syö
   hyppykorkeutta suoraan. Mitattuna: korkein pieruhyppy jättää 1-1:ssä 30,38
   px kanteen ja 2-1:ssä 27–38 px — alle kaksi laattaa. Kolmen laatan nostolla
   portti luki 1-1:stä `pää 0.00 px`, eli pelaaja kolautti kantta. Yksi laatta
   on se mitä tässä ruudussa on varaa nostaa, ja **ROADMAPin ensimmäinen kohta
   (kenttädata 15 → 16 riviin) on se muutos joka nostaa tuota lukua.**

**Vaikeus laimenee hieman ja se on odotettu:** maasto on sarakkeita ilman
lisähaastetta, sama ilmiö jonka generaattorin mäki mittasi (#98). Kuudessa
kentässä −0,7…−2,3 pistettä, eikä yhdenkään maailman muoto muuttunut.

Portit: neljä uutta väitettä (`verify.mjs`, *maastopassi*) — pohja säilyy,
jokaisen rinteen kummallakin puolella on vauhdinotto, aloitus ja lippu eivät
liiku, ja kenttä joka ei voi saada maastoa heittää sen sijaan että jäisi
hiljaa tasamaaksi. `seedOf` on nyt yhdessä paikassa (`core/utils.js`) kahden
sijaan.

## v26.08.18.24 — kolikot ovat aika

Omistaja 18.8.2026: *"coins = time! Niin aloitetaan jollain määrällä kolikoita
ja ne valuvat vasemman reunan säiliöstä, eli lisää aikaa saa poimimalla lisää
kolikoita. Näin saadaan uusi mekaniikka ja päästään eroon erillisestä
kellosta."*

**AIKA-kello on poissa.** Se oli luku joka ei ollut missään: sitä ei voinut
nähdä kentässä eikä siihen voinut vaikuttaa. Nyt sama tieto on **putkilon
pinta**, se on ruudulla koko ajan, ja siihen vaikutetaan poimimalla.

Kolme asiaa muuttui kerralla ja jokainen on parannus:

- **Kolikko sai merkityksen.** Se oli piste ja sadasosa elämästä. Nyt se on
  **se hetki jonka sillä ostaa**, ja kolikkorivi kuilun yli on ensimmäistä
  kertaa tarjous eikä koriste.
- **Kenttäsuunnittelu ohjaa kelloa.** Kentän kolikot *ovat* sen aikabudjetti:
  sama data joka piirtää palkinnon asettaa myös kiireen. Kaksi lukua yhdeksi.
- **Aurinko seuraa matkaa.** Se oli kentän kello; kelloa ei ole, joten se
  kertoo nyt kuinka pitkällä ollaan. Sama kuva, sama logiikka, uusi lähde —
  ja se pitää paikkansa myös luolassa, jossa kellon lukeminen oli mahdotonta.

**Luvut.** Kolikko valuu 72 framen välein (1,2 s), säiliö vetää sata eli kaksi
minuuttia — tasan sen minkä vanha kello antoi (300 × 24 framea). Kenttien
kolikot (25…45) ostavat 30…54 sekuntia lisää. Kiire alkaa 17 kolikosta, ja
silloin — ja vain silloin — tarkka luku ilmestyy nurkkaan: "vielä vähän" ja
"kaksitoista sekuntia" ovat eri lauseita.

**Kenttään ei lähetetä ketään tyhjänä.** `FUEL_FLOOR` 25 on **lattia eikä
nollaus**: täydempänä saapuvalta ei oteta mitään pois, ja juuri siksi
säästämisellä on merkitystä.

**Elämä tulee nyt urasta.** Sata kolikkoa ei enää kelpaa elämäksi, koska sata
kolikkoa on se säiliö jota kulutetaan — palkinto ja mittari eivät voi olla sama
luku. Elämä on **500 poimittua kolikkoa** (omistajan luku), ja se lasketaan
kulumattomasta kokonaisluvusta.

**Aika-ajon kello ilmestyi ruudulle.** Kulunutta aikaa ei ennen piirretty, ja
perustelu oli hyvä: se oli AIKA-lukeman toisinto framelleen. Toisinnon toinen
puoli katosi, ja kilpa jonka kelloa ei näe on kilpa jota ei voi ajaa.

**Ja yksi hiljainen ansa nimettiin.** Koesilmukat sammuttivat kellon
kirjoittamalla `scene.time = 9999`, mikä toimi vahingossa — iso luku isossa
laskurissa. Kun kello muuttui säiliöksi, ne alkoivat kuolla nälkään kesken
mittauksen ja mittasivat sen jälkeen ruumista (4-F:n jättiläisen kannet olivat
"saavuttamattomissa" siksi että mittaaja kuoli framella 2088). Nyt katkaisin on
nimetty (`clockStopped`), ja sillä on kaksi oikeaa käyttäjää: esittelykenttä
alkuruudun taustalla ja mittarit.

---

## v26.08.18.23 — hössötin, ladattu laukaus ja päivän kentät korpuksella

Kolme tekemätöntä kohtaa ROADMAPista kerralla, ja yksi niistä oli odottanut
korpusta.

**HÖSSÖTIN** — *"tee monster, johon osuessaan pelaajahahmo menettää kontrolit
hetkiseksi: juostaan eteenpäin automaattisesti, pelaaja voi vain hyppiä tai
ampua kuplia."* Pelin ensimmäinen vihollinen jonka kosketus **ei ole tappio**:
elämä ei mene, voimataso ei putoa, ja tähti ei suojaa siltä koska suojattavaa ei
ole. Sen sijaan jalat vievät eteenpäin sata framea eikä suuntaa saa vaihtaa —
hyppy ja laukaus toimivat, eli työkaluja on kaksi ja jarrua ei ole. Vahingosta
tulee *tilanne* eikä tappio.

Laji **pakenee**: se kääntyy pois pelaajasta kolmen laatan sisällä, joten siihen
törmätään useimmiten omasta vauhdista. Nurkkaan ajettuna se osuu, ja se on
oikein — hätä on seurausta kiireestä. Yksi hyppy riittää siihen, eikä siitä saa
mitään erikoista: laji on este eikä palkinto. Esittely on 2-3:ssa tasamaalla
kolikkorivin keskellä, ilman kuilua tai piikkejä lähelläkään.

**LADATTU LAUKAUS, ja se ladataan odottamalla.** Nappia ei ollut vapaana:
ammunta on `run`in painalluksessa ja `run` on myös juoksu, joten pohjassa
pitäminen olisi maksanut juoksusta. Niinpä lataus on **aika ilman laukausta** —
puolitoista sekuntia, ja seuraava pallo on kaksinkertainen eikä pysähdy
ensimmäiseen viholliseen. Se ratkaisee saman asian kuin nappi ja korjaa
toisen: ruiskuttaminen ei enää ole paras tapa ampua, koska ruiskuttaja ei
koskaan lataa.

**Päivän kentät ajettiin korpuksella uusiksi.** Todistus oli jäänyt kiinni
siihen ettei tällä agentilla ollut korpusta; nyt oli. `daily-origin.mjs` rakensi
1096 päivän ikkunan uudelleen, tarkisti jokaisen säännöillä, botilla ja
korpusta vasten (0 osumaa) ja kirjoitti uuden sormenjäljen. Samalla `dailySpec`
lakkasi pudottamasta mäkeä: **päivän kentässä on nyt maastoa** kuten muissakin.

---

## v26.08.18.22 — neljä taloa, kolme uhkapeliä

Omistaja 17.8.2026: *"hernetalo on kiva, mut lisätään siihen
satunnaisuutta/panoksia ja generoi 2–5 muunlaista bonusasiaa, esim. laita panos
ja lyö vetoa jne; enempi tuuria kuin taitoa."*

Rajaus on siinä viimeisessä lauseessa ja se on hyvä: **bonushuone jossa taito
ratkaisee on vain lyhyt kenttä**, ja niitä on jo 65. Se mitä kartalla voi tehdä
ja kentässä ei, on **panos** — kolikot ovat pelin ainoa kertyvä valuutta jolla
on jo merkitys (sata on elämä), joten niiden asettaminen alttiiksi on panos
jonka pelaaja lukee ilman että mitään selitetään.

Talot olivat kartalla jo, yksi per maailma, eikä yhtään uutta solmua lisätty:
kartan muoto on mitattu (jokainen kenttä on tiellä linnakkeeseen), ja uusi
solmu olisi ollut uusi tie. **Talo sai luonteen, ei osoitetta.**

- **HERNETALO** (1, 5) — kolme tuttua esinettä ja **arpa**. Neljäs luukku on nyt
  tuntematon: kolmasosa tähti, kolmasosa hernekeitto, kolmasosa tyhjä. Varma
  valinta säilyi, joten arpa on tarjous eikä pakko.
- **KRUUNA VAI PIERU** (2, 6) — panosta 5, 15 tai 30 kolikkoa. Kolikko lentää
  ilmaan neljäkymmentä framea, ja se odotus on se mitä uhkapelistä ostetaan.
  Voitto tuplaa, häviö vie.
- **KOLME KUPPIA** (3, 7) — yhden alla elämä, kupit sekoitetaan näkyvästi.
  Katse auttaa vähän ja onni loput. Ei panosta: hinta on käynti, ja jokainen
  talo on kerran.
- **VETOTALO** (4, 8) — lyö vetoa **omasta pelaamisestasi**: selvitä seuraava
  kenttä kuolematta ja panos maksetaan tuplana. Ainoa jossa taito on mukana ja
  ainoa jonka palkinto tulee myöhemmin — vedon jälkeen tavallinen kenttä on eri
  kenttä.

Veto elää `game.state`issa eikä kartalla, koska kohtaus katoaa kun kenttä alkaa,
ja `finishLevel` maksaa sen — se on se yksi funktio jonka läpi jokainen kentän
loppu kulkee. Tallennus kantaa vedon (`bet`, ilman versionostoa samalla
perusteella kuin `secrets` ja `bestTimes`).

Neljä porttia, ja kaksi niistä löysi vian ennen kuin sitä ehti pelata: veto
maksettiin **tyngälle** (aiemmat väitteet korvaavat `game.finishLevel`in, ja
tyngälle maksettu veto on veto jota kukaan ei maksanut), ja kuppipelin
sekoitusmittaus oli yhden näytteen kolikonheitto.

---

## v26.08.18.21 — maa liikkuu myös generoiduissa kentissä

Omistaja pyysi ajamaan korpuksen ja katsomaan mitä siitä saa. Korpus (VGLC, 481
kenttätiedostoa) ladattiin väliaikaiseen hakemistoon — **ei repoon**, DESIGN.md
kohta 3 — ja sen kanssa tehtiin se mikä ilman sitä ei ole sallittua: generoidut
kentät kirjoitettiin uusiksi niin että **alkuperätarkistus säilyi**.

Tulos: 26 generoitua kenttää rakennettiin uudelleen, jokainen tarkistettu
korpusta vasten (0 osumaa), ja generaattori tuntee nyt **mäen**. Kentissä joissa
maa liikkuu on yksitoista: aiemmin kolme, ja nekin käsintehtyjä.

**Mäki on pala eikä maastopassi**, ja se on tietoinen rajaus. Se lataa rinteen
ylös, tasanteen ja rinteen alas — sama muoto kuin käsintehdyllä `kumpare`ella —
ja perustaso pysyy rivillä 13, joten `rules.js`, hyppybudjetti, botti ja
vaikeusmittari lukevat lattiaa täsmälleen kuten ennenkin. Koko maailman
korkeusprofiili on eri työ ja se on ROADMAPissa.

Kolme asiaa jouduttiin mittaamaan matkan varrella, ja jokainen on merkitty
koodiin:

1. **Mäellä seisoo joka toisella kerralla joku.** Tyhjä mäki on maisemaa, ja
   maisema laimentaa vaikeutta: mittari lukee saraketta kohti, joten pelkkää
   maata oleva mäki vei kentältä pisteitä (3-6 jäi tavoitteestaan 28). Mäellä
   seisova vihollinen palauttaa sen minkä mäki vei — ja tekee mäestä
   kysymyksen.
2. **Mäkiä on yksi 120 saraketta kohti.** Ilman kattoa 5-1 (208 saraketta) sai
   kolme mäkeä ja sen vaikeus romahti 191:stä 96:een. Lyhyt kenttä täynnä
   maisemaa on kävelyretki.
3. **Mäki on ulkoilmamaailmojen pala** (ruoho, aavikko, yö, jää). Luumaailmassa
   maa on luuta ja tehtaassa lattia; nurmikumpare ei kuulu kumpaankaan, eikä
   kummankaan mitattua käyrää ollut syytä liikuttaa.

Maailmojen 3 ja 5 käyrät muotoiltiin uusiksi siellä missä maasto siirsi niitä:
5-1…5-3 saivat vihdoin tavoitteet (ilman niitä miltä tahansa siemeneltä
kelpasi mikä tahansa vaikeus), ja 3-6:n tiheys nousi niin että maailman huippu
on sen viimeisessä kentässä.

**Päivän kenttä pudottaa mäen yhä** (`dailySpec`): sen 1096 kentän todistus on
committoitu sormenjälkenä, ja se uusitaan omana työnään.

---

## v26.08.18.20 — rinne oli kuljettava vain pienimmällä keholla

Omistajan raportti 17.8.2026 kuvakaappauksen kanssa: *"kun juoksen rinnettä ylös
(1-1), hahmo PYSÄHTYY tähän ylänurkkaan."*

Niin pysähtyikin, ja vika oli askelma-avussa (`stepUp`). Rinteen pinta luetaan
kehon **keskikohdasta**, mutta törmäyksen tekee sen **etureuna** — joka on `w/2`
edempänä ja 45 asteen rinteessä siis `w/2` pikseliä ylempänä. Askelma oli
kiinteä kuusi pikseliä, mikä riitti pienimmälle keholle (12 px → 6) ja **vain
sille**: iso Pieruprinssi on 21 px leveä, eli hänen etureunansa oli kymmenen
pikseliä korkeammalla kuin se kohta jota moottori mittasi. Rampin viimeisen
laatan ja tasanteen sauma oli siis seinä kaikille paitsi pienimmälle.

Nyt askelma tulee kehon leveydestä: `w / 2 + 2`. Puolikas leveys on se virhe
jonka mittapiste tekee, ja kaksi pikseliä on framen liike sen päälle. Isoimmalla
keholla 12 px eli yhä selvästi alle laatan — porrasautomaattia tästä ei tule, ja
ehto vaatii yhä että keho on juuri nyt rinteessä.

**Miksi mikään ei huomannut:** `tools/playable.mjs` ajaa botin voimatasolla 0,
eli sillä ainoalla koolla joka mahtui. Uusi portti ajaa kaikki neljä kokoluokkaa
1-1:n oikean mäen yli, ja se oli punainen ennen korjausta täsmälleen siellä
missä omistaja seisoi: sarakkeessa 103.

**Mäki generaattoriin, mutta ei vielä päivän kenttään.** Generaattori sai
`hill`-palan — rinne ylös, tasanne, rinne alas — eli sen saman maastonmuodon
jota käsintehdyt kentät jo käyttävät. Se on kirjoitettu ja odottaa korpusta:
generoidut kentät kirjoitetaan uusiksi vasta kun `tools/gen-levels.mjs` ajetaan
`VGLC_DIR`in kanssa, koska ilman korpusta jokainen uudelleen kirjoitettu kenttä
menettäisi alkuperätarkistuksensa. Päivän kenttä **pudottaa** mäen erikseen
(`dailySpec`): sen 1096 kentän todistus on committoitu sormenjälkenä, ja vain
korpuksen haltija voi uusia sen.

---

## v26.08.18.19 — kaksi reittiä limittäin

Omistaja 17.8.2026: *"kiva olisi jos niissä vois mennä limittäin."* Ensimmäinen
palikka joka tekee sen: `kaksitie` (3-1).

Limittäin tarkoittaa tässä sitä mitä se Sonicissa tarkoittaa — **kaksi reittiä
jotka kulkevat saman matkan päällekkäin ja yhtyvät takaisin.** Alempi on aina
auki ja se on se jonka jokainen kävelee; ylempi ostetaan vauhdilla rinteen
huipulta, ja sen palkinto (kolikkorivi) näkyy alhaaltakin — syy yrittää on
näkyvissä ennen kuin yrittää.

Ylempi reitti on **puulavaa** eikä maata, ja se on se yksityiskohta joka tekee
limityksestä limityksen: sen läpi pääsee alhaalta hyppäämällä, joten reitit
voivat vaihtua kesken matkan eivätkä vain kulkea rinnakkain.

ROADMAP.md sai samalla mitatun tilannekuvan varianssista (`tools/variety.mjs`:
kuudessa maailmassa kahdeksasta loppupuoli toistaa itseään enemmän kuin
alkupuoli) ja sen yhden rakenteellisen syyn joka selittää tasaisuuden: lähes
jokaisessa palikassa rivit 13-14 ovat samaa lattiaa, eli **maan pinta on samalla
korkeudella koko pelin ajan**. Kolme askelta kirjattu, kallein viimeisenä.

---

## v26.08.18.18 — sama kolikko, ja täysi putkilo valuu tyhjäksi

Kaksi omistajan huomiota putkilosta, ja molemmat osuivat samaan puutteeseen:
mittari oli valmis, mutta kolikon **matka** siihen ei ollut.

**"Osa kolikoista ponnahtaa yhä suoraan ylöspäin tiileistä."** Niin ponnahti, ja
syy oli kaksi oliota yhdestä kolikosta: `CoinPop` pomppasi ja katosi, ja
samasta paikasta lähti lento putkiloon. Nyt lohkosta lyöty kolikko **on** se
kolikko joka lentää — lennolla on yksi vaihe lisää alussa (pomppu ylös ja
takaisin, sama kaari ja sama painovoima kuin ennen), ja vasta sen jälkeen imu
tarttuu. `CoinPop` poistui kokonaan, myös `savestate`n luettelosta.

**"Mitä putkelle tapahtuu kun se on täynnä?"** Ennen: pinta hyppäsi sadasta
nollaan yhdellä framella ja lasi välähti — eli se ainoa hetki jonka koko
mittari on rakennettu lupaamaan meni ohi nopeammin kuin sen ehti nähdä. Nyt
pinta **valuu** alas 34 framen ajan, lasi hehkuu ja suusta nousee kipinä: sata
kolikkoa lähtee sinne minne ne olivat menossa. Kolme kuvaa yhdestä
tapahtumasta, ja jokainen sanoo eri asian — valuva pinta että ne lähtivät,
hehku että se oli iso, kipinä että ne menivät ylös.

Portti mittaa molemmat puolet: sadas kolikko jättää pinnan täyteen ja aloittaa
huuhtelun, ja vasta huuhtelun jälkeen putkilo on tyhjä.

---

## v26.08.18.17 — ilmakartio täydelle mittarille

Omistaja 17.8.2026: *"täyteenlatautuneen voiman koko ruudun välähdys on huono,
se tuntuu damagelta. Voisiko ruutu väreillä? Hahmon ympäriltä säteittäin? Tai
sitten ympärille tulee ilmakartio, sellainen kuin olisi puhkaisemassa
äänennopeuden."*

Raportin diagnoosi oli oikea, ja se on yleisempi kuin yksi efekti: **koko
ruudun peittävä väri on tässä pelissä osuman kieli.** Pelaajaa satutettaessa
ruutu välähtää, joten mikä tahansa muu kokoruudun veto lainaa sen merkityksen
riippumatta väristä — etu ja tappio puhuivat samalla äänensävyllä.

Nyt täysi mittari piirtää **ilmakartion kehon ympärille**: kärki edessä,
varret taaksepäin, kirkas nokka siinä kohdassa jossa ilma ensimmäisenä antaa
periksi. Kolme syytä siihen että se on parempi kuin verho:

1. **Se on kehon ympärillä.** Sama ero kuin kaasusuihkun ja HUD-palkin välillä:
   asia joka koskee sinua piirretään sinuun.
2. **Sillä on suunta.** Kartio aukeaa taaksepäin, joten se sanoo myös minne
   vauhti on menossa. Verho ei sanonut suunnasta mitään.
3. **Se on sama fiktio kuin kaikki muukin tässä pelissä: paine.** Kaasusuihku
   näyttää mittarin täyttyvän, kartio näyttää sen olevan täynnä.

Menetyksen merkki on **luhistuva rengas** eikä pimennys — sama napaisuus kuin
ennen (tuleva aukeaa, menevä sulkeutuu) mutta yhtä paikallisena.

**Portti kääntyi ympäri.** Siinä luki `MOST = 0,6 × pelialue`, eli se *vaati*
että kolme viidesosaa ruudusta muuttuu — oikea vaatimus verholle, ja samalla se
mikä piti verhon pystyssä. Nyt väite on kaksiosainen: merkin on näyttävä kehon
lähellä **ja** jätettävä ruudun vastakkainen laita koskematta. Mitattu: 238 px
kehon ympärillä, 0 px vastakkaisessa laidassa.

DESIGN.md kohta 8 päivitettiin samalla, koska se nimesi vanhan efektin
esimerkkinä.

---

## v26.08.18.16 — iPhonen jumi, kosketusjuoksu ja opetusjärjestyksen budjetti

Kolme asiaa jotka kaikki lähtivät samasta kysymyksestä: mitä peli oikeasti
opettaa ja missä järjestyksessä — ja pääseekö sitä pelaamaan puhelimella.

**Kenttää ei päässyt aloittamaan iPhonella.** Omistajan raportti: *"default
layoutilla ei voinut käynnistää kenttää, molemmat napit käynnistivät
jako-toiminnon."* Syy oli oletusmallin (`rulla`) koko idea: hyppyympyrä on
juoksukentän **sisällä**, joten yksi sormi antaa molemmat — juuri niin että
juoksuhyppy onnistuu ilman toista sormea. Pelissä se on oikein. Mutta `run` ei
ole valikoissa juoksu vaan **komento** (alkuruudulla jako, kartalla varaesine),
ja komennot luetaan reunasta — joten jokainen hyppy oli myös komento, ja
alkuruudulla se komento oli jako.

Korjaus erottaa nämä kaksi: mukana tuleva juoksu on **pito ilman reunaa**.
`held.run` on tosi (juoksuhyppy säilyy), `pressed.run` ei välähdä (valikko ei
näe painallusta jota kukaan ei tehnyt), ja yksin painettu juoksukenttä antaa
reunan normaalisti (ampuminen ja varaesine toimivat).

**Napautus kävelee, pito juoksee.** Omistaja: *"kosketusnäytön ohjainlayoutilla
on vaikea juosta samalla kun hyppää."* Se on totta jokaisella mallilla eikä
vain yhdellä: puhelimessa on kaksi peukaloa, ja kolmas asia on aina jonkun
toisen päällä. Nyt juoksu tulee ajasta — kun suuntaa on pidetty kaksikymmentä
framea, juoksu menee itsestään pohjaan ja pysyy siellä hypyn yli. Tarkkuus
säilyy, koska lyhyt korjausliike ei ehdi kynnykseen. Ja **reunatta**, koska
`run` on myös ampumisnappi: reunallinen automaatti olisi ampunut kaasupallon
joka kerta kun pelaaja lähtee liikkeelle.

**Opetusjärjestys näki vihdoin kaiken mitä pelissä on.** `tools/curriculum.mjs`
ei tuntenut rinteitä eikä neljää lajia — kuura, kolikkovaras, pyörre, kummitus
olivat pelissä ilman että yksikään portti kysyi *milloin* pelaaja tapaa ne.
Sama vika tehtiin kerran kurnuttajalla. Ne ovat nyt taulussa, ja taulu paljasti
heti kaksi asiaa: 1-3 esitteli neljä asiaa ja kolikkovaras seisoi 19 laatan
päässä piikkien esittelystä.

**Ja se raja itse laski väärää asiaa.** Omistaja kysyi voisiko uusia
ominaisuuksia ripotella varhaisempiin kenttiin niin että esittelyidea säilyy —
vastaus löytyi portista: se laski **maaston samaan lukuun vihollisen kanssa**,
joten maailman 1 kolme käsintehtyä kenttää olivat "täynnä" yhdeksällä
esittelyllä joista kuusi ei ollut kenellekään vaarallinen. Nyt kolmen raja
koskee sitä mitä pelaaja voi **hävitä**: vihollisia ja vaaroja. Rinne, puulava,
pavunvarsi, warp-putki ja tähtilohko eivät kuluta samaa budjettia, koska uusi
vihollinen on kysymys jonka väärä vastaus maksaa hengen ja uusi maastonmuoto
kysymys jonka väärä vastaus maksaa sekunnin.

**Mikään ei löystynyt turvallisuuden puolelta:** 20 laatan väli koskee yhä
jokaista esittelyä lajista riippumatta, ja `curriculum.mjs`:n turvaehdot (lattia
alla, tilaa väistää) pätevät maastoon kuten ennenkin.

**Ripottelu, ensimmäiset kaksi:** kuura muutti 8-1:stä **3-2:een** (laji joka
jättää jäätä jälkeensä kuuluu jäämaailmaan) ja kummitus 7-3:sta **6-2:een**
(aavemainen laji kuuluu siihen maailmaan jonka musiikki on *Danse macabre*).
Molemmat vaihtoina eikä lisäyksinä, ja molemmille kirjoitettiin oman maailmansa
sanastolla palikka jonka opetus on turvallinen: kuura tasamaalle jonka jäljen
ehtii nähdä ennen kuin sen päälle astuu, kummitus tasamaalle pelaajan eteen
kolikot takanaan — juuri se hetki jona pelaaja kääntyy pois ja laji tekee sen
mitä se tekee.

---

## v26.08.18.15 — pyörivät jalat, ja mäki joka ansaitsee ne

Omistaja 17.8.2026: *"jalat pyörivät vauhdikkaasti kuin Sonicilla alamäkeen
mennessä."*

**Ehto on yksi lause:** keho menee kovempaa kuin sen jalat osaavat kävellä
(`|vx| > MAX_RUN`). Se on tosi täsmälleen kahdessa tilanteessa — alamäessä,
jossa rinne lainaa ylimmän nopeuden, ja täydellä vauhtimittarilla — eikä
piirroksen tarvitse arvata mitä "vauhdikkaasti" tarkoittaa.

**Kuva on kiekko ja kolme puolaa** eikä kolmas kävelyruutu, ja se on koko idea:
kävelyruutuja vaihtamalla nopeammin saa nopeamman kävelyn, ei pyörimistä. Jalat
lakkaavat olemasta jalkoja ja muuttuvat pyöräksi, jonka liikkeen lukee
puolista — ja puolat ovat **vaaleita eivätkä tummia**, koska kiekon oma väri on
housut ja sen alareuna musta: tumma puola katosi omaan taustaansa. Ylälaidassa
on lisäksi valojuova, koska pyörän yläreuna on se osa joka liikkuu nopeimmin.
Siluetti ei muutu — pelaajan ääriviivasta luetaan osumalaatikko.

**Ja sitten se mikä puuttui:** pelissä ei ollut yhtään alamäkeä joka ehtii antaa
sen vauhdin. `kumpare` on neljä laattaa alas, ja neljässä laatassa alamäen veto
ei ehdi juoksukatosta ylös. `pitkarinne` on kahdeksan: seitsemän askelman
portaat ylös, kahdeksan laatan rinne alas ja seitsemän saraketta juoksualuetta
pohjalla — ylinopeus vuotaa pois tasamaalla, ja se osa on yhtä tarkoituksellinen
kuin itse mäki. Mitattu huippunopeus alamäessä 2,74, eli pyörä pyörii.

Jäämaailmaan (3-1) ja vaihtona `plat_steps`in tilalle, samasta syystä kuin
maailmassa 1: maailman käyrä on portti, ja lisäys olisi siirtänyt sitä. Jää on
myös se maailma jonka maa on jo valmiiksi vauhdista.

Portti mittaa kolme asiaa, ja ne ovat samat kolme jotka mikä tahansa uusi
animaatio joutuu läpäisemään: se on eri kuva kuin se jonka tilalle se tuli, se
liikkuu, eikä se muuta siluettia.

---

## v26.08.18.14 — SID-sanasto: pulssi, arpeggio ja jäämaailman oma raita

Omistaja 17.8.2026: *"take inspiration from the SID chip of the Commodore 64 …
look at the ways Martin Galway, Rob Hubbard and people like that drove it. They
only had a few channels, so they got creative."*

Se on kaksi eri pyyntöä ja ne kannattaa pitää erillään. **Aaltomuodot**:
WebAudion valikoima on sine, square, saw ja triangle, kun SIDin oma on saha,
kolmio, kohina ja **säädettävä pulssi** — ja juuri pulssin leveys puuttui.
`square` on pulssi jonka leveys on tasan 50 %, eli yksi piste koko siltä
akselilta jolla C64-ääni elää. **Kanavapula keinona**: kolmella äänellä ei
soiteta sointuja, joten ne arpeggioidaan.

`tone` sai neljä uutta parametria, ja jokainen on parametri eikä uusi soitin —
sama kutsupaikka, sama envelope, sama väylä:

- **`duty` ja `pwm`** — pulssin leveys ja sen liike. Aalto vaihdetaan
  portaittain, koska SIDissäkin leveys on rekisteri jota ajuri kirjoittaa ruutu
  kerrallaan: portaikko on oikea muoto eikä kompromissi.
- **`arp`** — soinnun sävelet yhdellä äänellä, `arpRate` oletuksena **50 Hz**
  eli PAL-ruutuvauhti, se luku jolla nämä kappaleet oikeasti tehtiin. Askel on
  `setValueAtTime` eikä liuku: portaikko on se mikä tekee siitä soinnun eikä
  glissandon.
- **`ring`** — rengasmodulaatio: kantoaallon amplitudia kerrotaan toisella
  oskillaattorilla jonka lepoarvo on nolla. Sama rakenne kuin sirussa, ja siksi
  se kuulostaa siltä (kellot, metalliset lyömäsoittimet).
- **`cutoff` / `resonance` / `sweep`** — resonoiva alipäästö ja sen pyyhkäisy.
  SIDin toinen allekirjoitus, ja puolet siitä mitä Hubbardin basso on.

**JÄÄTIE**, maailman 3 oma raita, on ensimmäinen joka on kirjoitettu tällä
sanastolla: kapea pulssi jonka leveys hengittää (lyijy), yksi ääni joka käy
mollikolmikon läpi viisikymmentä kertaa sekunnissa (soinnut), ja saha jonka
suodin sulkeutuu nuotin aikana (basso). Sävellys on oma — A-molli, Am–F–G–Em,
melodia joka nousee kolmessa fraasissa ja laskee neljännessä.

Jäämaailmaan siksi että se oli ainoa jolla on oma teema, oma vihollinen ja oma
laattaviritys mutta ei omaa ääntä: sen kolme kenttää soittivat yleisraitaa
`level`.

**Portti mittaa pulssin luvuista eikä korvasta:** 50 %:n pulssilla jokainen
parillinen osaääni on nolla (siitä kanttiaalto on ontto), 25 %:n pulssilla ne
tulevat takaisin lukuun ottamatta neljän monikertoja. Ensimmäinen versio siitä
rivistä väitti "kaikki takaisin" ja oli väärässä — mittaus korjasi sen ennen
kuin se ehti muutoslokiin asti.

Vanhat raidat eivät muuttuneet: jokainen uusi parametri on oletuksena nolla.

---

## v26.08.18.13 — rinteet, ja vauhti muuttuu korkeudeksi

Listan vahvin tekemätön idea tehtiin. [IDEAS.md](IDEAS.md) kohta 1 sai tuomion
*"kyllä, vahvin"* jo 10.8.2026 ja jäi seisomaan hintansa taakse: moottorissa ei
ollut rinteitä lainkaan, `moveX`/`moveY` olivat ruudukkotörmäystä, ja tämä oli
fysiikkamuutos eikä kenttädataa. Nyt se on tehty, ja erottelu jonka omistaja
teki säilyi sellaisenaan:

> *"Slopes turn into speed is a VERY good idea, because Mario does sliding on
> slopes and this would be different."*

Mariossa rinne on **liikkeen laatu** — luiskahdus, joka on itsessään palkinto.
Täällä se on **muunnin**: vaakavauhti vaihtuu korkeudeksi, ja korkeus on pääsy
ylemmälle reitille. Rinteessä ei liu'uta eikä siinä tapeta. Siitä lähdetään.

**Kaksi uutta laattaa** (`/` ja `\`), 45°, ja kumpikaan ei ole kiinteä:
ruudukkotörmäys osaa vain laatikoita, kun rinteen pinta on korkeuskäyrä
sarakkeittain. Pystyratkaisu kysyy siltä yhden asian — millä korkeudella maa on
tässä kohtaa — **kehon keskikohdasta**, koska kaksi mittapistettä antaisi kaksi
eri korkeutta ja korkeampi voittaisi (rinteen vieressä seisova nytkähtäisi ylös
ilman että kukaan liikkui).

**Vauhti, kolme lukua ja yksi ehto:**

- alamäki vetää 0,14/frame ja **lainaa ylimmän nopeuden** (3,5) ilman täyttä
  mittaria — muttei ylitä sitä. Tässä "ei täysi Sonic" on luku eikä mielipide.
- ylämäki vie 0,045/frame, ja **sen on oltava pienempi kuin kiihtyvyys**
  (0,0547). Ensimmäinen versio oli 0,06, ja portti löysi sen samana iltana:
  kävelijä hidastui rinteessä nollaan, eikä 1-1 ollut enää läpäistävissä
  voimatasolla 0 — botti jäi kumpareen juureen 28 %:iin kentästä.
- **kiihtyvyys itse ei muutu.** `ACC` on yhä yksi vakio kävelylle ja juoksulle,
  sama päätös joka tehtiin aikanaan jäälle. Rinne lisää painovoiman komponentin
  pintaa pitkin, mikä on eri asia ja myös se mitä rinne fysiikassa on.

**Ja se muunnin:** huipulta irtoava vaihtaa 0,85 × vaakavauhdin nousuksi, ja
lähtö asettaa `jumpHeld`in — pohjassa pidetty nappi venyttää nousua kuten
hypyssä. Siksi palkinto on portaittainen eikä lineaarinen, ja mitattuna se on
juuri sitä: **kävely ei heitä lainkaan (0 px), juoksu heittää 9 px, täysi
vauhtimittari 39 px.** Kävelijää rinne ei heitä minnekään, ja se on tarkoitus.

**Kolme palikkaa, ja ne opettavat sen kolmessa askeleessa.** `kumpare` (1-1) on
maa jota pitkin kuljetaan — siihen ei voi kuolla eikä sitä voi ohittaa.
`rinnehyppy` (1-3) on kysymys: ylämäki joka päättyy ojaan, jonka yli pääsee
vauhdilla ja jonka pohjalle kävelijä tippuu. `ylareitti` (1-3) on lupaus
lunastettuna: huipulta pääsee vain vauhdilla hyllylle jonka päällä on kolikot.

Molemmat 1-3:n palikat ovat **vaihtoja eivätkä lisäyksiä**, ja se on mitattu
syy: maailman käyrä on portti, ja kaksi palikkaa lisää nosti 1-3:n 100:sta
123:een — jolloin käyrään tuli kaksi peräkkäistä notkoa ja portti punastui.
Sama sääntö kuin `coin_thief`illa aikanaan. Eikä 1-2:een lainkaan: se on se
kenttä jonka sarakkeisiin portit osoittavat nimeltä, ja yksi palikka lisää
siirtäisi ne kaikki.

**Rinne on maata kaikkialla missä maata kysytään.** Sääntötarkistin
(`rules.js`) sai oman joukkonsa — rinne ei ole `SOLID`, koska `SOLID` tarkoittaa
siellä "keho ei mahdu läpi" — ja botti (`level-bot.js`) oppii sen samalla
rivillä. Ilman jälkimmäistä botti luki kumpareen reiäksi ja hyppäsi päin mäkeä
kunnes kello loppui.

**Neljä uutta porttia:** kävelijä nousee rinteen eikä irtoa maasta kertaakaan,
alamäkeen kävelevä pysyy maassa (ei sarjaa pieniä putoamisia), alamäki lainaa
ylimmän nopeuden eikä ylämäki pysäytä, ja huipulta lähtö on portaittainen.
Koekentät rakennetaan käsin: mitattava asia on fysiikka, ja kenttädata voi
muuttua ilman että fysiikka muuttuu.

---

## v26.08.18.12 — nauha pois, mittarit maailmaan, isku kaataa

Jatkoa edelliselle: kun pisteet ja sarakkeet oli kerran katsottu läpi, kävi
selväksi ettei kysymys ollut järjestyksestä vaan siitä **mikä ylipäätään pitää
olla näkyvissä silloin kun se ei kerro mitään.** Vastaus oli: ei mikään.

**HUD-nauha purettiin.** Ikkuna on nyt koko 320×240. Jokainen entinen lukema on
joko maailmassa tai ilmestyy kun sillä on asiaa:

- **Kolikkoputkilo** vasemmassa reunassa. Sisätila on tasan sata kolikkoa
  korkea (2 px/kolikko, joka kymmenes kirkkaampi mittaviiva), eli pinnankorkeus
  vastaa yhtä aikaa kysymyksiin "kuinka monta" ja "kuinka lähellä elämää".
  Poimittu kolikko **lentää kaaressa putkilon suulle ja putoaa pinon päälle** —
  kolikot eivät katoa ilmaan vaan imeytyvät mittariin. Sadas huuhtelee putkilon
  tyhjäksi, ja se on 1UP nähtynä.
- **Aurinko on kello.** Nousee vasemmalta, on korkeimmillaan puolivälissä ja
  koskettaa horisonttia täsmälleen kun aika loppuu. Auringolta poistettiin
  kameraparallaksi: kaksi syytä liikkua tekisi kummastakin lukukelvottoman.
  Luolassa ja viimeisen sadan aikana kello on yhä numero, mutta ilmestyvänä.
- **Kentän nimi kirjoitetaan taivaalle** savukirjoituksena: neljä sekuntia
  kentän alussa ja neljä aina 18 sekunnin välein. Ei sisätiloissa — siellä ei
  ole taivasta johon kirjoittaa.
- **Paine näkyy kehossa.** Vauhtimittarin palkki poistui; sen tilalla on
  kaasusuihku kantapäiden takana, joka tihenee ja kasvaa mittarin mukana.
  Ummetus ei savua, mikä on ensimmäinen kerta kun se tila näkyy kehossa.
- **Tehostuspallot poistettiin** — keho näyttää tyypin ja koon jo.
- Loput (pisteet, elämät, lähtölaskennat, varalokero, nielty kyky, aika-ajon
  jako) ilmestyvät nurkkiin ja katoavat. Pisteet ja elämät näkyvät 2,5 sekuntia
  siitä kun ne muuttuvat.

**Kertoja on yhä efektien ulkopuolella**, ja se on nyt piirtojärjestys eikä
varattu kaista: `main.js` ajaa `PostFX.apply`n ja piirtää vasta sitten
`drawOverlay`in. Kuumuus ei siis väreile pistelukeman läpi, vaikka nauhaa jonka
efektit väistivät ei enää ole. Portti lukee järjestyksen lähdetekstistä.

**Hyväksytty hinta:** tavallinen kenttä on 15 riviä eli täsmälleen 240 px, joten
pystysuuntainen kamera ei enää liiku siellä. Se on tietoinen vaihto, ja
ROADMAP.md kantaa sen ison refaktoroinnin (kenttädata 16 riviin, vaikeusmittarin
ruutukorkeus, ylimpien rivien läpikäynti).

**Maahanisku kaataa kumoon.** Vihollinen kellahtaa selälleen, sätkii ja kääntyy
takaisin — matalalta tullut isku pitää kumossa 3,5 s, katosta tullut 7 s. Isku
ei enää tapa eikä vangitse kuplaan: **kupla on kaasupallon yksinoikeus**, koska
kaksi liikettä joilla on sama lopputulos on yksi liike liikaa. Ja piikit eivät
enää pysäytä shokkiaaltoa: piikikäs kaatuu siinä missä muutkin, ja kumossa se on
ylösalaisin eli ensimmäistä kertaa tallattavissa. Piikkien merkitys säilyy —
suoraan niiden **päälle** syöksyminen häviää yhä kuten tallauskin.

**Ja nielemisen ketju korjattiin samalla.** VERBI 6 rakennettiin lauseesta
"isku vangitsee kuplaan, kupla niellään" — kun isku lakkasi vangitsemasta, ketju
olisi jäänyt kukan varaan. Nyt lause on "isku kaataa, kumossa oleva niellään":
ylös-nappi nielee sekä kuplassa kelluvan että kumossa makaavan, ja ehto on
kummallakin sama — kohde on vaaraton ja paikallaan, eli nieleminen on valinta
eikä osuma.

**Vihollisen iho näkyy vihdoin.** Yksilöllinen pinta oli mitattu liian
hienovaraiseksi — korkeintaan 6 % pikseleistä — eli kaksi kävelijää olivat sama
kävelijä ellei niitä katsonut vierekkäin pysäytyskuvasta. Nyt akseleita on
kuusi: **sävy** (punainen, syvä ruusu, ruoste), ompeleiden määrä ja väli,
tahrojen määrä ja koko, solmun kiillon paikka, katseen suunta ja venttiilin
korkeus. Sävy on niistä ainoa joka näkyy juostessa, ja siksi se on se joka
lisättiin.

Portti kääntyi samalla **kaksisuuntaiseksi**: se vaatii nyt vähintään 5 % eroa
pinnassa, eli liian hienovarainen iho kaatuu punaisena sen sijaan että
vihertäisi. Siluettiehto ei jousta (nolla pikseliä — siitä luetaan
tallattavuus), ja se maksoi itsensä heti takaisin: viisi ompelta kolmen välein
kasvatti ääriviivaa yhden pikselin, ja portti näki sen ennen kuin kukaan ehti
katsoa kuvaa.

**Kaksi liikettä joka jatkui siellä missä kukaan ei ole.** Potkaistu kuori
katosi ruudun ulkopuolelle ja tyhjensi kentän ennen pelaajaa; nyt se häviää kun
se on kulkenut yli ruudun verran **ja** on ikkunan ulkopuolella (kaksi ehtoa,
jotta perässä juostu kuori ei katoa katseen alta). Tulipalloja oli katossa
`2 + voimataso` eli seitsemän; nyt kaksi, ja uusi laukaus syö vanhimman sen
sijaan että nappi lakkaisi vastaamasta.

---

## v26.08.18.11 — pisteet ovat neliöitä, ja HUD on oma

Kaksi lainaa jotka olivat jääneet huomaamatta, koska ne eivät ole kuvaa eivätkä
ääntä: **pisteiden asteikko** ja **HUD-nauhan järjestys**. Kumpikin oli
esikuvan, eikä kumpaakaan ollut koskaan valittu.

**Pisteet ovat kokonaislukujen neliöitä.** 100 · 200 · 400 · 1000 oli genren
yhteisomaisuutta niin vahvasti, että sen kirjoittaminen on lainaamista
silloinkin kun sen keksisi itse. Uusi asteikko on 25 · 100 · 256 · 400 · 625 ·
1024 · 2500 · 4096, ja kanta kasvaa eikä eksponentti: kakkosen potenssit
kasvavat alussa liian hitaasti ja lopussa liian nopeasti, neliöissä juuri on se
luku jota säädetään. Myös kertoimet ovat neliöitä — ketjun n:s tappo maksaa n²
kertaa ja kuplan puhkaisu 2² kertaa — joten **jokainen ruudulle pomppaava luku
on neliö** riippumatta siitä minkä monen kertoimen läpi se tuli. Asteikko on
tarkoituksella lähellä vanhaa (100 pysyi 100:na, 400 400:na), eli pelin
arvojärjestystä ei tarvitse opetella uudestaan.

Samalla koko taulukko muutti yhteen tiedostoon (`src/core/points.js`). Ennen
sitä hinnat olivat siellä missä ne maksettiin — `this.score = 200`
kahdessakymmenessä vihollisluokassa — eikä kukaan nähnyt taulukkoa kerralla,
mikä on juuri se syy miksi kukaan ei myöskään nähnyt sen olevan lainattu.

**HUD-nauha jaettiin uudestaan.** Vanha järjestys oli esikuvan järjestys:
varalokero vasemmassa reunassa, P-mittari sen vieressä, elämät ja kolikot
keskellä, maailma ja aika niiden oikealla, pisteet reunassa. Uusi jako on
työnjako, ei sekoitus:

- **vasen** kierroksen kaksi lukua päällekkäin, pisteet ja AIKA — ne ovat samaa
  lajia ja esikuvassa nauhan eri päissä
- **sen oikealla** mitä sinulla on: elämät ja kolikot
- **keskellä** mitä keho osaa nyt: P-mittari ja tehostuspallot, siellä minne
  silmä poikkeaa kesken juoksun
- **oikealla** missä ollaan, ja lähtölaskennat (tähti, kytkin, ummetus) omassa
  kolossaan
- **reunassa** varalokero — **samassa kulmassa kuin kartan paneelissa.** Se oli
  kartalla oikealla ja kentässä vasemmalla, eli sama esine kahdessa eri
  kulmassa riippuen siitä kummalla ruudulla katsoit.

Kartan yläpalkkiin jäi kaksi asiaa jotka kuuluvat yhteen — mihin maailmaan on
tultu ja millä tilalla pelataan — ja pisteet siirtyivät alapaneeliin muun
omaisuuden viereen. Kentän nimikilpi siirtyi paneelin keskelle.

**Portti mittaa sarakkeet pikseleinä.** Nauha ja paneeli piirretään pahimmalla
mahdollisella tilalla (9999 elämää, 99 kolikkoa, seitsennumeroiset pisteet,
pisin nielty kyky, pisin lähtölaskenta) ja jokaisen musteellisen sarakkeen on
osuttava sille riville ilmoitettuun väliin. Tämä ei ole varmuuden vuoksi: kesken
työtä kartan `KOLIKOT 99` ylsi 118:aan ja nimikilpi alkoi 112:sta, ja portti
kertoi sen. Pistetaulukolla on oma porttinsa: jokaisen arvon neliöjuuren on
oltava kokonaisluku, portaikkojen on noustava, eikä lähdekoodissa saa olla
yhtään irrallista pistelukua.

---

## v26.08.18.10 — nuoli joka opettaa vilkaisun ja katoaa opittuna

Edellinen versio jätti auki sen mikä siinä oli pahinta: **kyky jota kukaan ei
löydä ei ole olemassa.** Vilkaisu ei ollut näppäinlistassa eikä yksikään kenttä
johdattanut siihen.

Ratkaisu on se ainoa joka jää jäljelle pelissä jossa mitään ei selitetä
tekstillä: **ele näytetään siinä hetkessä jossa se toimii.** Syaani nuoli
pelaajan pään päällä osoittaa alas — sitä nappia jota painetaan — ja se
ilmestyy tasan silloin kun mittari on täysi, jalat ovat maassa ja alla on
kaista. Ehto on kirjaimellisesti sama funktio kuin `tryPeek`in ehto
(`peekReady`), joten opetus ei voi valehdella.

Sama syaani kuin haamun pyyhkäisyjuovassa (DESIGN.md 8: yksi signaali, yksi
merkitys) — painallus näyttää saman värin leviävän kaistan yli, ja kaksi asiaa
ovat sama asia.

**Kerran ja lopullisesti.** Ensimmäinen onnistunut vilkaisu kirjaa
`taught.peek`in tallennukseen eikä nuoli tule enää takaisin — opastus joka jää
päälle on koriste, ja koriste joka vilkkuu joka juoksussa on häiriö. Kenttä
menee tallennukseen ilman versionostoa samalla perusteella kuin `secrets`,
`bestTimes` ja `doors`, ja päivän pieru **perii** opitut eleet: oma kierros,
sama pelaaja.

| väite | mitattu |
| --- | --- |
| nuoli näkyy vain kun vilkaisu on totta | `täydellä 36 pikseliä, tyhjällä 0, tasakentässä 0` |
| ensimmäinen vilkaisu lopettaa opetuksen | `kirjattu true, muistissa seuraavassa kentässä true` |
| ja se säilyy levylle asti | `tallennuksesta true` |

**Sivulöydös portista:** nuolta ei voi mitata väristä. Mittarin täyttyessä
`drawSpeedPulse` vetää koko ikkunan yli verhon joka värjää senkin mikä on jo
piirretty, joten nuoli on ruudulla muttei enää `#9fe8ff` — ja se on
väistämätöntä, koska sama täysi mittari joka avaa vilkaisun myös sytyttää sen
verhon. Portti vertaa siksi samaa kohtausta samalla framella opetettuna ja
opettamattomana.

---

## v26.08.18.9 — kaistan vilkaisu: sekunnin juoksu yhdestä silmäyksestä

IDEAS kohta D, tuomio *"tee rajattuna"*, ja rajaus on se joka päätettiin
[ROADMAP.md](ROADMAP.md):ssä 10.8.2026 kolmena lauseena. Ne kolme ovat nyt
kolme mitattua porttia.

| väite | mitattu |
| --- | --- |
| maksaa koko mittarin, ei lähde tyhjällä | `tyhjällä 0 framea, täydellä 95 framea, mittari 0, isona kyykyssä 95 framea` |
| on katsomista eikä kulkemista | `ruudukko sama, kaista 1->1, kamera 272->272` |
| alempi kaista näkyy ja katoaa itsestään | `haamu 22159 pikseliä (juova yksin olisi 640), lopuksi 0 pikseliä` |
| ei veloita kun alas tarkoittaa muuta | `putkella matka alkoi, vilkaisu 0, mittari 111` |

**Täydellä vauhtimittarilla alas** näyttää alemman kaistan 1,6 sekunniksi
läpikuultavana, ja mittari tyhjenee. Sinne ei pääse — putki ja varsi ovat yhä
ainoat tiet — ja se on koko syy siihen että tämä versio hyväksyttiin: kun
kukaan ei astu läpi, **kenttägraafi ei muutu**, ja `rules.js` todistaa yhä
yhden kaistan läpäistävyyden eikä kaistojen välistä graafia. Se raskaampi
versio olisi pitänyt vastata kysymykseen "voiko pelaaja pudota paikkaan josta
ei pääse pois", ja se on sama ongelma kuin areenaa muokkaavalla pomolla.

Hinta on mittari kokonaan, koska ilmaisena tämä ei olisi kyky vaan tutka.
Salaisuusrakenne perustuu siihen että kartta kertoo *että* niitä on muttei
*missä*; kertakäyttöinen läpinäkyvä alakerros kertoisi missä, ja sen jälkeen
etsimistä ei enää olisi. Mittari täyttyy 56 framessa täyttä juoksua ja on
varattu jo kahteen asiaan (nopeuskatto 3,5, kaasulehden lento), joten
katsominen maksaa juoksemisen.

**Vain muoto, ei sisältöä.** Piirretään laatat eikä olioita: näet *missä*
kammio on, et mitä siellä on.

Kaksi asiaa jotka portit löysivät ja joita kukaan ei olisi arvannut:

1. **Sama painallus joka maksaa mittarin myös jarruttaa kehon.** Alas isolla
   keholla aloittaa kyykyn, kyykky jarruttaa 1,4-kertaisella kitkalla, ja
   mittari luetaan vasta jarrutuksen jälkeen — eli täyttä vauhtia juossut iso
   pelaaja olisi mittarin lukuhetkellä 2,38:ssa eikä 2,5:ssä ja vilkaisu ei
   olisi lähtenyt **koskaan**. Pieni keho ei kyykisty, joten vika olisi näkynyt
   vain isona. Nyt luetaan `pFullEntry`, eli se mikä oli totta silloin kun
   nappi painettiin.

2. **Kuvaportti melkein mittasi oman pyyhkäisyjuovansa.** Ensimmäinen versio
   vertasi framea 0 frameen 98 ja sai 2728 pikseliä eroa pelkästä siitä että
   maailma hengittää; korjattu versio vertaa kahta samasta kentästä rakennettua
   kohtausta samalla framella. Ja kun ero silti jäi 960 pikseliin — tasan
   `320 * 2` plus vähän — syy oli että **1-2:n luolakaista on lähtöruudussa
   tyhjä**: koko kaistan muste on 177 laattaa neljälläsadalla sarakkeella. Se
   ei ole vika vaan idean ydin, joten portti seisoo nyt siellä missä kammio on.

---

## v26.08.18.8 — VERBI 6: nielty vihollinen on työkalu

IDEAS kohta 6, tuomio "kyllä": *"syö vihollinen, saat kyvyn — piikkiukko tekee
piikikkääksi, lentäjä antaa hypyn — eli jokaisesta lajista tulee työkalu."*

| väite | mitattu |
| --- | --- |
| kuplassa oleva niellään ylöspainalluksella | `suussa siivet, kupla poissa` |
| kyky tekee sen mitä laji teki | `siivet 0->1 ilmahyppyä, piikit tappoivat, kylmä jäädytti 1 ruutua, magneetti veti` |
| kyky on lainassa ja kuluu loppuun | `480 framea, lopuksi ei mitään` |
| jokainen kuplattava laji antaa jonkin kyvyn | `g:sylky k:kuori f:siivet r:siivet c:sylky x:piikki w:kylmä s:magneetti Z:siivet Y:sylky` |

**Nieleminen tapahtuu kuplasta**, eikä se ole valinta vaan seuraus: kuplassa
oleva vihollinen on määritelmän mukaan vaaraton ja paikallaan, eli se on ainoa
hetki jolloin nieleminen voi olla **päätös** eikä osuma. Suoraan vihollisesta
nieleminen olisi ollut kolmas tapa koskettaa vihollista, ja kaksi (tallaus,
kosketus) on jo se määrä jonka pelaaja lukee kerralla.

Ja siitä syntyy ketju joka ei vaatinut yhtään uutta nappia: **maahanisku
vangitsee kuplaan** (v26.08.18.7) → **kupla niellään** → kyky on kädessä.
Kolme verbiä yhdeksi lauseeksi.

Kuusi kykyä, ja jokainen on **se mitä laji on**:

| laji | kyky |
| --- | --- |
| piikkiukko | kosketus tappaa (muttei suojaa piikeiltä — se on tähden työ) |
| lentäjä, paarma, pilvi | yksi ilmahyppy lisää |
| kuura | laskeutuminen jäädyttää maan |
| kolikkovaras | kolikot tulevat neljän laatan säteeltä |
| kuoriukko | yksi osuma kestetään |
| muut | sylky: laji itse ammuksena |

Kahdeksan sekuntia, ja se on mitattu kentän mitasta: juoksuvauhdilla noin
seitsemänkymmentä laattaa eli kolme ja puoli ruutua. Suunnitelmaksi tarpeeksi,
varusteeksi liian vähän. HUD kertoo nimen ja kutistuvan palkin, koska pelaajan
on tiedettävä *mikä* ja *kuinka kauan vielä*.

**Sivulöydös:** `collisions()` luki syötteensä `this.game.input`ista eikä siitä
mitä sille annettiin. Esittelydemo ajaa oikeaa kenttää **botin ohjaimella**,
joten jokainen sellainen rivi luki sen ihmisen näppäimistöä joka ei pelaa —
demon tallauspomppu luki siis satunnaista näppäintä. Syöte kulkee nyt
parametrina, ja nieleminen olisi perinyt saman vian heti syntyessään.

---

## v26.08.18.7 — isku vangitsee, tappo kuittaa, ja jokainen otus on oma yksilönsä

Kolme omistajan pyyntöä samasta asiasta: miltä pelaaminen tuntuu.

| väite | mitattu |
| --- | --- |
| maahanisku vangitsee kuplaan eikä tapa | `2 kävelijää: kuplassa 2, poissa 0` |
| tapon kuittaus nousee ketjun mukana | `ensimmäinen 580 Hz, neljäs 724 Hz` |
| kävelijällä on yksilöllinen pinta | `erilaisia 5/5, suurin ero 6,3 %` |
| muttei yksilöllistä siluettia | `siluettiero 0 pikseliä` |

**Maahanisku vangitsee.** Tappava isku *poistaa* kaiken ulottuviltaan, eli se on
painike jolla huone tyhjenee; kuplaan vanginnut isku **muuttaa** ne joksikin
muuksi — ja se jokin on tässä pelissä jo kolmen muun verbin raaka-ainetta:
kuplan päälle voi astua, sen voi puhkaista, ja se kantaa hetken. Yksi liike ei
siis enää lopeta tilannetta vaan avaa sen. Pomo, jättiläinen ja piikikkäät eivät
mahdu kuplaan ja saavat saman kohtelun kuin ennen; heikko isku kaataa kumoon
kuten ennenkin, eli korkeus maksaa yhä.

**Tappo kuittaa.** Vanha `stomp` oli isku muttei palkinto: se kertoi että
jotain osui, ei että jotain onnistui. Uusi ääni on kolme kerrosta — napsahdus,
runko ja **nouseva kuittaus** — ja kuittaus on *ketjun mittainen*: puolisävelaskel
per lenkki, tasan sama laskuri joka maksaa pisteet. Neljäs tallaus samalla
kaarella kuulostaa neljänneltä. Katto on oktaavi, koska sen yli mentäessä
kuittaus asuisi kolikon korkeudella.

**Jokainen otus on yksilö.** Sama sääntö kuin laatoilla, mutta yhdellä
lisäehdolla: **siluetti ei saa muuttua**, koska siitä luetaan tallattavuus.
Kävelijällä vaihtelee ompeleiden määrä, tahran paikka ja solmun kiilto — ja
ensimmäinen versio siirsi itse solmua, mikä muutti ääriviivaa kahdeksan
pikselin verran. Portti kertoi sen suoraan, ja se ehto on nyt lukuna:
`siluettiero 0 pikseliä`.

---

## v26.08.18.6 — iho jokaiselle laatalle, ja puolet vaihtelusta joka ei ollut olemassa

Putki sai yksilöllisyytensä; nyt sen saivat **kivi, lauta ja maa**. Ja matkalla
löytyi se syy miksi vaihtelu näytti aina laimealta.

| väite | mitattu |
| --- | --- |
| hash jakaa koko välin nollasta yhteen | `keskiarvo 0.498, viidennekset 19.7/20.5/20.1/19.9/19.7 %` |
| kivi, lauta, maa ja tiili ovat yksilöitä | `8/8 · 6/8 · 8/8 · 7/8 erilaista` |
| muttei eri palikoita | `suurimmat erot 4.7 · 5.5 · 20.7 · 8.2 %` |
| heinä heiluu laatan yläpuolella | `korsia liikkui 140 pikseliä` |
| eikä maa liiku lainkaan | `0 pikseliä` |

### Puolet arvoalueesta puuttui

`hashNoise` päättyi riviin `h ^ (h >> 16)`, ja `>>` on etumerkillinen: kahden
negatiivisen XOR nollaa etumerkkibitin, joten tulos oli **aina alle 0,5**.
Mitattu 8000 pisteen otoksella: keskiarvo `0,254`, yli 0,5 meni **0,0 %**,
ylimmät kaksi viidennestä tyhjiä.

Seuraus ei ole hienovarainen: **jokainen `hashNoise(...) > 0.55` -haara koko
pelissä oli kuollutta koodia.** Tiilen oksankohta, kiven halkeama, hiekan
toinen raita, lumen toinen halkeama — kaikki kirjoitettu, ei koskaan piirretty.
Korjaus on kaksi merkkiä (etumerkitön siirto, `Math.imul`), ja sen jälkeen
jakauma on tasan viidenneksissä.

**Mutta paikka ei saanut muuttua.** Sama hash arpoo piilotiilet ja päivän
pierun kentät, ja korjattu jakauma siirsi jokaisen salaisuuden pelissä
(mitattu: `39/562 tiiltä`, kolme porttia punaisena, kaksi kenttää ilman yhtään
salaisuutta) sekä vanhensi päivän alkuperätodisteen, jota ei voi laskea
uudelleen ilman korpusta. Siksi funktioita on nyt kaksi: **koriste lukee
korjattua, paikka lukee jäädytettyä** (`hashPlace`), ja nimi sanoo sen ääneen.
Kun korpus joskus on käsillä, jäädytetty poistuu yhdellä ajolla.

### Ja ihot

Kivi vaihtelee halkeaman paikassa, kulman lohkeamassa ja kiven suunnassa —
kaksitoista erilaista kiveä. Lauta saa syynsä ja oksankohtansa mutta **ei
animaatiota**: se on puolikiinteä, ja liikkuva lauta lupaisi olevansa menossa
jonnekin. Kivestä irtoaa pölyhiukkanen kerran yhdeksässä sekunnissa, laatan
omassa vaiheessa.

Heinä heiluu, ja se on paras paikka animaatiolle koska korret ovat jo **laatan
ulkopuolella**: niiden liike ei voi muuttaa sitä siluettia jolla seistään.
Vaihe on laatan omasta hashista, joten ruohikko aaltoilee sen sijaan että koko
rivi nykisi kerralla — yhtenäinen nyökkäys lukisi tapahtumana.

---

## v26.08.18.5 — tehostusportti: segmentti jonka läpi ei pääse ilman voimaa

Omistajan päätös, sanatarkasti: *"voi olla segmenttejä, joissa TARVITAAN
powerup, mutta VARMISTA ETTÄ POWERUP on saatavilla sitä ennen!"* Tietoinen
poikkeus DESIGN.md kohtaan 5, ja sen hinta on maksettu portteina.

| väite | mitattu |
| --- | --- |
| botti läpäisee voimatasolla 0 poimimalla lahjan | `4-3 läpi` |
| ilman lahjaa se ei läpäise | `4-3 ilman lahjaa pysähtyy` |
| lahja on ennen porttia ja lähellä | `lahja 150, kuilu 160` |
| kuilun leveys ei riitä poikkeukseksi | `ilman ilmoitusta kaatuu sääntöön` |

Pelin ensimmäinen tehostusportti on **4-3**: kahdeksan laatan kuilu mitattua
kuuden budjettia vastaan, ja sen edessä pierusieni **makaamassa maassa**.

**Lupaus ei väljene vaan täsmentyy.** Vanha muoto oli "kenttä on läpäistävissä
voimatasolla 0"; uusi on "kenttä on läpäistävissä voimatasolla 0 **aloittaen**".
Sama botti joka ajaa jokaisen kentän pienimmällä koolla ajaa myös tämän — se
vain poimii lahjan matkalla.

Neljä rajausta, ja jokainen on koodissa eikä lupauksessa:

1. **Lahja makaa maassa eikä lohkossa.** Maassa makaava poimitaan kävelemällä;
   lohkoon pitää osua, ja "pitää osua" ei ole varmuus.
2. **Se ei vieri pois.** Sieni vierii 0,85 px/frame, ja mitattuna se ehti
   pudota siihen samaan kuiluun jonka se oli tullut ratkaisemaan.
3. **Ilmoitus on lahja itse**, ei sarakeväli datassa. Ensimmäinen versio
   kirjoitti rajat `gates`-kenttään ja kaatui vaikeustasoon: venytetyssä
   kentässä sama kuilu oli sarakkeessa 199 eikä 164. Laatta ruudukossa venyy
   mukana, sarakenumero ei.
4. **Ilmoitus ei ole lupa vaan lupaus joka mitataan.** Portti ajaa botin
   kahdesti: lahjan kanssa läpi, ilman lahjaa jumiin.

Kaksi mittausta matkan varrelta, molemmat kirjattu palikkaan: lahja kolmen
sarakkeen päässä kuilun huulesta tappoi botin (vauhdinotto ei mahtunut väliin),
ja lahja palikan ensimmäisessä sarakkeessa jäi poimimatta koska **edellisestä
palikasta tullaan ilmalennossa** — botti oli ilmassa sarakkeeseen 148 asti ja
laskeutui 149. Lattialla makaava tehostus on varma vain sillä osalla lattiaa
jolla oikeasti kävellään.

---

## v26.08.18.4 — maahanisku mittaa pudotusta eikä huonetta

Omistaja: *"tee niin että ground pound on sitä voimakkaampi (= leviää
laajemmalle) mitä korkeammalta pomppaa."* Se **oli jo** — mutta se mittasi
väärää asiaa.

| väite | mitattu |
| --- | --- |
| sama pudotus antaa saman iskun missä tahansa | `100px matalalla 0.575, syvällä 0.575` |
| täysi isku vaatii pelin pisimmän hypyn | `174 px -> 1` |
| ja isku leviää laajemmalle | `22…44 px eli 1,4…2,75 laattaa` |

Asteikko oli `(pudotus) / (laskeutumisen y)`, eli **osuus huoneen korkeudesta**.
Perustelu oli kaunis — taivas on kansi, joten suurin mahdollinen pudotus on se
y johon päätyy — ja se tekee samasta hypystä eri iskun sen mukaan missä päin
kenttää seisoo: 100 px pudotus lattialle y=208 antoi 0,48, ja sama hyppy
luolakaistassa lattialle y=650 antoi **0,15**. Isku siis heikkeni sitä mukaa
mitä syvemmälle kenttään meni, ja juuri se on se mitä omistaja pelasi.

Nimittäjä on nyt se mitä pelaaja voi tehdä: **174 px, pelin pisin hyppy**
(PHYSICS.md). Kynnykset pysyvät siellä missä ne mitattiin — tappaminen 0,5 on
87 px ja tiilen rikkominen 0,72 on 125 px, sama luku joka `POUND_BREAK_AT`in
perustelussa jo luki — mutta ne pätevät nyt myös luolassa ja pystykentässä.

Ja se mitä pyydettiin: iskun leveys 30 → **44 px**. Vanha kaari oli 15…30 px eli
yhdestä kahteen laattaa, mikä on liian pieni ero tunnettavaksi; uusi on
1,4…2,75 laattaa, eli täysi isku ottaa **kaksi vihollista yhden sijaan** ja
rikkoo kolme tiiltä kahden sijaan.

---

## v26.08.18.3 — kaksi lajia jotka muuttavat kenttää, ja yksi hiljainen vika

Omistaja: *"olisi kiva että oliot voisivat reagoida pelaajaan / maailmaan /
vaikuttaa maailmaan, se olisi dynaamista."* Taulukko sanoi saman ankarammin:
`ENEMY_VERBS`-taulun `maailma`-sarakkeessa luki **"ei" jokaisella
yhdeksällätoista lajilla** — vain pomo koski kenttään.

| väite | mitattu |
| --- | --- |
| kuuran jälki jäätyy ja sulaa | `jäätyi 4 ruutua, sulamisen jälkeen 0 kesken` |
| eikä kenttä jää toisenlaiseksi | `ruudukko ennallaan` |
| kolikkovaras syö ja antaa takaisin | `söi 1, kolikoita 38 -> 37, kukkaro 0 -> 1` |
| jokainen laji selviää pikatallennuksesta | `21 merkkiä, kaikki palasivat` |

**KUURA** (`w`, maailma 8) kävelee, ja sen jäljessä maa on jäätä kuuden sekunnin
ajan. Jää on tässä pelissä laatta eikä teema (päätetty 10.8.2026), joten muutos
käyttää olemassa olevaa sanaa: kiinteä pysyy kiinteänä, vain kitka muuttuu —
yksikään reitti, hyppy tai kuilubudjetti ei liiku. Ja se sulaa, eli kentän
lopputila on sen lähtötila, sama vaatimus jonka valuva hiekka ja areenan
pilarit jo täyttävät.

**KOLIKKOVARAS** (`s`, maailma 1) etsii lähimmän kolikon, juoksee sen luo ja syö
sen. Kolikko on ainoa asia kentässä jonka poistaminen ei voi rikkoa mitään —
se ei kannattele ketään eikä sen puuttuminen sulje reittiä — eli maailmaan
vaikuttava vihollinen saatiin **ilman yhtäkään uutta läpäisykysymystä**.
Tallattuna se pudottaa kaiken syömänsä, joten kilpajuoksun hävinnytkään ei
menetä mitään pysyvästi.

Molemmat menivät maailmoihin joiden sanasto on ohuin (mitattu 14 ja 13).

### Ja se hiljainen vika

`savestate.js` herättää vain ne luokat jotka ovat sen rekisterissä, ja
**seitsemän lajia oli tullut peliin listan kirjoittamisen jälkeen**: torvi,
törähdys, paarma, happopisara, yökki, karvapallo ja paukkupöhö. Pikatallennus
keskellä maailmaa 6 tai 7 palautti kentän ilman niitä. Mikään ei kaatunut, jokin
vain puuttui — ja peli näytti toimivan, se vain oli helpompi.

Portti kävelee nyt jokaisen kenttämerkin läpi ja vaatii että olio on olemassa
myös latauksen jälkeen. `21 merkkiä, kaikki palasivat.`

---

## v26.08.18.2 — sama putki, eri yksilö

Omistajan pyyntö: *"eka putki ei näytä täsmälleen samalta kuin 2. putki… etsi
tasapaino, jossa pelaaja tunnistaa heti elementin samaksi, mutta niissä on
kuitenkin pieni vivahde-ero tekstuurissa."* Ja: *"noihin skin-eroihin voisi
lisätä pikkuanimaatioita."*

| väite | mitattu |
| --- | --- |
| kaksi putkea eroaa toisistaan | `erilaisia 6/12` |
| muttei niin että ne olisivat eri esineitä | `suurin ero 2,3 % laatan pikseleistä` |
| sama putki näyttää samalta joka kerta | `kaksi piirtoa identtiset` |
| kiilto liikkuu, muttei huuda | `17/460 framea, suurin muutos 0,8 %` |

**Tasapaino on sääntönä eikä makuna**, ja se on kolme kieltoa: siluetti ei
muutu (koko on hyppybudjetin asia), pohjaväri ei muutu (tunnistaminen tapahtuu
värillä ja muodolla yhdellä silmäyksellä), ja vaihtelu on **paikan funktio eikä
kellon** — sama putki näyttää samalta joka kerta kun sen näkee, myös
pikalatauksen jälkeen. Satunnaisluku framella olisi kohinaa; hash paikasta on
käsityötä.

Siemen on **sarake eikä laatta**, ja se on koko putken ehto: kaksi laattaa
vierekkäin ja N päällekkäin ovat yksi esine, joten oikea puolisko kysyy
vasemmalta. Ilman sitä putken puolikkaat olisivat kahdesta eri putkesta.

Vaihtelevat: niittiväli (5 tai 6 px), nokipilkku sauman vieressä (paikka ja
korkeus), kolhu oikealla puoliskolla, ja pulttien paikka yhden pikselin.
Animaationa **kiilto** joka laskeutuu saumaa pitkin kerran seitsemässä
sekunnissa, ja jokaisella putkella on oma vaiheensa — kaksi putkea vierekkäin
eivät välähdä yhdessä, mikä olisi konemainen.

Kaksi mittausvirhettä matkalla, molemmat kirjattu: portti mittasi ensin
**suulaattaa**, jonka alla on vain muutama rivi kuilua (ero 0,0 % seitsemällä
putkella kahdeksasta), ja kiiltoa mitattiin 200 framen ikkunalla kun jakso on
420 — eli mitattiin vaihetta eikä kiiltoa. Ja ensimmäinen versio vaihteli vain
niittiväliä, jolloin 12 putkesta oli 2 erilaista: **vaihtoehtojen määrä on
vaihtelun koko kysymys.**

Lämpöputki saa saman ihon kuin tavallinen putki, ja se on salaisuuden kannalta
pakollista: jos vain lämpöputkilla olisi kolhuja, kolhu olisi kyltti.

---

## v26.08.18.1 — kaksi uutta lajia: PYÖRRE ja KUMMITUS

Ensimmäinen erä uusia vihollisia. Omistajan mitta: SMB3:ssa ja SMW:ssä nimettyjä
vihollisia on kummassakin noin 60–80, ja meillä oli **19** (+ 8 pomovarianttia).
Erot ovat pienemmät kuin luvut: alkuperäiset laskevat värivariantit ja siivekkäät
versiot erikseen, joten eri *käyttäytymisiä* niissä on 35–45. Tästä erästä
alkaen tavoite on sama suuruusluokka.

Molemmat menivät maailmaan 7, koska `tools/variety.mjs` sanoo mihin uusi laji
kannattaa laittaa: sanasto per maailma on `w1 14 · w2 24 · w3 26 · w4 21 ·
w5 17 · w6 16 · w7 14 · w8 13`.

**PYÖRRE** (`e`) kiertää näkyvää akselia kahden laatan säteellä, 150 framea
kierrokselta. Se ei jätä kehäänsä koskaan, sitä ei voi tallata, eikä se tuki
reittiä. Maailma 7 on se jossa jokainen kuoppa on pohjaton ja **joskus on pakko
seistä paikallaan**; paarma tehtiin sitä vastaan rankaisemalla odottamista, ja
tämä on sama kysymys toisin päin — se rankaisee väärästä hetkestä.

**KUMMITUS** (`q`) etenee vain kun siihen ei katsota, ja hyytyy paikalleen kun
katsoo. Se on pelin ainoa vihollinen joka mittaa **mihin pelaaja katsoo** eikä
sitä missä hän on, ja se on tässä maailmassa siksi että lyhyt lauta ja pohjaton
kuoppa pakottavat kääntymään ennen jokaista hyppyä. Tallaus ei tepsi (se on
kaasua), se kulkee maaston läpi eikä voi jäädä seinäksi, ja se on hitaampi kuin
kävely (0,55 vastaan 1,5) — kiirehtijä, ei ansa.

Neljä uutta palikkaa sijoittaa ne opetusjärjestyksessä: kumpikin esitellään
tasaisella maalla ja kohdataan reiän vauhdinotolla vasta myöhemmin, sama
järjestys kuin paarmalla.

Kolme porttia kaatui matkalla, ja jokainen niistä on nyt kommenttina siinä
kohdassa jota se koskee: ohut pilvi ei saa leijua tyhjän päällä (kansi oli
reiän yllä), lauta jolle ei ole syytä nousta ei johda mihinkään (kansi oli
tyhjä), ja uusi laji ilman hintaa vaikeusmittarissa mittautuu nollaksi.
Hinnat ovat `pyörre 1,8` ja `kummitus 1,9`, molemmat perusteltuina naapureitaan
vasten.

---

## v26.08.17.99 — Enter on aina valinta

Omistaja pelistä: *"näppäimet ovat menuissa välillä outoja, mielestäni enter
voisi aina olla select."* Ja niin ne olivat.

| ruutu | Enter ennen | Enter nyt |
| --- | --- | --- |
| alkuruutu, kortit, pistetaulu | valitse | valitse |
| vaikeustaso, päivän pieru, jako | **peru** | valitse |
| kartta | **käytä varaesine** | aloita kenttä |

Sama näppäin siis hyväksyi yhdellä ruudulla ja perui seuraavalla. Nyt Enter on
sama nappi kuin hyppy — se nappi jolla valikoissa on aina valittu — ja
peruminen on **Escapessa**, joka on ainoa näppäin joka tarkoittaa jo valmiiksi
"pois täältä". Kentässä Escape on tauko, kuten ennenkin.

Kartan varaesine sai `X`:n (juoksunappi), koska kartalla juoksulle ei ole muuta
käyttöä ja esineen ottaminen on **toiminto eikä valinta**. Numpadin Enter oli
`run`; se on nyt sekin valinta, koska se on Enter.

Portti mittaa lupauksen **ruuduilta eikä taulukosta**, ja koko ketjun läpi
(`event.code` → `KEYMAP` → `Input.pressed` → kohtaus), koska juuri siinä
ketjussa vika oli: `alkuruutu TitleScene->WorldMapScene, kartta
->InterludeScene, vaikeustaso DifficultyScene->WorldMapScene, Escape
->TitleScene`, ja `varasto tyhjeni`.

Ohjetekstit korjattiin samalla, koska ne opettivat vanhan tavan: kartalla luki
`Z ALOITA   ENTER KAYTA ESINE`, vaikeustasoruudulla `ENTER PERUU`. Alkuruutu
kertoo nyt myös valinnan näppäimen: `NUOLET/WASD  HYPPY VÄLI/Z  JUOKSU SHIFT/X
VALINTA ENTER`.

---

## v26.08.17.98 — luulaakso saa minipomon

Toinen minipomo peliin, ja ensimmäinen sitten maailman 2. `6-M
LUUVALTAISTUIMET`: kaksi yökkiä korokkeilla, muurattu holvi heti perässä, ja
palkintona murtava voima.

| väite | mitattu |
| --- | --- |
| palkittu tie on vaikeampi | `6-M 259.2 vastaan 6-K 245.9` |
| ja läpäistävissä voimatasolla 0 | `LÄPI 97 %` |
| maailma on yhä kahdeksan kentän mittainen | `w6 8` |
| kartta kelpaa sääntöineen | `kaikki kartat kelpaavat` |

**Haara jakaa kahdeksan kenttää kahdelle tielle; se ei kasvata niitä
yhdeksään.** Se on portissa lukuna, ja siksi minipomo *korvasi* kentän eikä
lisännyt yhtä: KAIVAUTUMINEN (6-K) on suora tie, LUUTIE on se kalliimpi.
6-5 jää dataan kartan ulkopuolelle, ja se on kirjattu vaihtokauppa —
generaattori kirjoittaa koko tiedoston, ja ilman korpusta jokainen uudelleen
kirjoitettu kenttä menettää `origin: 'checked'` -merkintänsä. Mitattuna 6-5:n
poisto olisi vaihtanut kolmen muun kentän todistetun alkuperän merkintään
`not checked`: todiste on kalliimpi kuin siisteys.

**Kaksi tietä lähtevät eri nuolella**, ja se on navigointisääntö eikä
sommittelu: kartalla liikutaan yhdellä suunnalla kerrallaan. Ensimmäinen
sommitelma lähetti haaran ylös, ja ylös oli jo varattu paluulinkille — portti
kertoi sen suoraan (`w6-2->w6-3 askel (0,-1)`).

**Holvi on tiiltä eikä kiveä**, koska luulaaksossa jokainen `X` ja `#` nojaa
johonkin suoraan allaan — luuranko on määritelmän mukaan asia joka kannattaa
itsensä. Ontto kivihuone on siis mahdoton, ja portti kaatoi sen kahdesti (ensin
hyllynä, sitten kantena). Lopputulos on parempi kuva kuin aavikon kalliohylly:
murtava voima ei avaa ovea vaan **syö seinän**.

Areenan muoto on tarkoituksella sama kuin papuparoonien: kaksi koroketta, yksi
ampuja kummallakin, ja lattia joka kulkee katkeamatta läpi — tappelun voi siis
ohittaa, ja juuri siksi palkinto saa olla tehostus eikä avain.

---

## v26.08.17.97 — SUOLIMATO, ja se kysyy missä eikä milloin

Kahdeksas pomovariantti, 8-5:ssä pöhön toisen esiintymän tilalla.

| väite | mitattu |
| --- | --- |
| maailma 8 ei uusi ketään kahdesti | `uusinnat 0 1 2 3 7 4 5, toistoja 0` |
| se kaivautuu kruunun ajaksi | `siirtyi 171 px, vajosi 44 px` |
| maan alla se ei satuta eikä siihen voi osua | `vaaraton true` |
| eikä se nouse jalkojen alta | `nousi 3.1 laatan päähän` |

**Maailman 8 väite oli tosi vain jos pöhöä ei laske kahdesti.** Se esiintyi
neljästi (4-F, 5-F, 8-4, 8-5) kun jokainen muu esiintyy kahdesti, ja "jokainen
pomo kerran" on koko maailman lause. Nyt uusinnassa on seitsemän eri pomoa
seitsemässä huoneessa.

**Uusi numero ei olisi riittänyt, sen piti olla uusi kysymys.** Jokainen muu
pomo kysyy *milloin*: kruunu nousee päähän, odota, kruunu laskee, lyö. Mato
kysyy **missä**. Se kaivautuu lattiaan tasan siksi aikaa kun kruunu on päässä —
eli kun siihen ei kuitenkaan voi osua — ja nousee jossain muualla siinä hetkessä
kun siihen taas voi. Maanalainen matka näkyy pölykasana lattian pinnassa, joten
se ei katoa vaan menee.

Siitä seuraa että vanha lupaus pysyy koskemattomana: **avoin ikkuna on kokonaan
tallottavaa aikaa**, aivan kuten jokaisella muulla pomolla. Liikkuva maali
avoimen ikkunan aikana olisi rikkonut sen hiljaa.

Silhuetti on 56x28 eli 2:1 — pelin littein, kun jokainen muu on vähintään yhtä
korkea kuin kaksi kolmasosaa leveydestään. Pinnalla se **makaa lattialla** eikä
seiso sen päällä, ja se on sama valinta toisin päin kuin luurangolla, joka on
pelin ainoa pystyyn venytetty. Arvomerkkinä nikamat eikä esine: jokainen muu
kantaa mitalia, satulaa, kelloa tai hermeliiniä, koska jokainen muu on joku joka
pukeutuu — madolla ei ole mitään mikä ei olisi runkoa.

Kaksi poikkeusta, molemmat kirjattu nimellä eikä ohitettu: se on pelin ainoa
**raajaton** pomo (poikkeuslista vanhenee itsestään jos sille joskus piirretään
raajat), ja sen ääni on ainoa jolla on `level`-kerroin — mitattuna sen terävät
formantit päästivät läpi **0,065** kun muut tuottivat 0,23…0,40 samalla
nimellisellä voimakkuudella, ja kuulumaton ääni on sama vika kuin puuttuva.

---

## v26.08.17.96 — jokaisella pomolla on oma ääni

Päätetty 9.8.2026, ja se odotti kahta asiaa: konsonantteja (pelkillä vokaaleilla
puhuva ääni ei voi sanoa eri asioita, se voi vain huutaa eri korkeuksilla) ja
luotettavaa mittausta (v26.08.17.93).

| väite | mitattu |
| --- | --- |
| jokainen seitsemästä puhuu | `huiput 0.23 … 0.40` |
| eivätkä ne ole sama ääni | `0: 498 Hz · 1: 281 · 2: 735 · 3: 352 · 4: 396 · 5: 208 · 6: 243` |
| kuuluu muttei huuda | `kolikko 0.32, kuolema 0.57 — kaikki niiden luokassa` |
| ja kutsupaikkoja on kolme | `arrive hurt die — 3 kutsua` |

**Oma ääni, jaetut toimintaäänet.** Pomo saa oman tulohuutonsa, oman
murahduksensa ja oman kuolinparkaisunsa — mutta iskuaalto, laskeutuminen ja
piikit kuulostavat samalta joka pomolla, jotta "tuo tarkoittaa iskuaaltoa"
opitaan kerran eikä kuutta kertaa (DESIGN.md kohta 8).

Jokainen ääni on **pelaajan ääni siirrettynä siihen suuntaan johon hahmo on**,
ei uusi keksitty ääni: `pitchScale` on koko, `formant` on pään koko, `q` on
kudos (terävä = märkä suu, loiva = luuta tai ilmaa), `hiss` on se osa joka ei
ole ääni vaan kohinaa. Iskuaallon pomo on rintaääntä, rynnäkkö on kireä ja
pieni, jättiläinen on pelin matalin, sääherrassa on enemmän ilmaa kuin ääntä.

**Kuningas puhuu sen äänellä joka hän juuri on.** Osuma vaihtaa hänet
seuraavaksi linnakkeeksi (`KING_FORMS`), ja siitä hetkestä eteenpäin hänen
murahduksensa on sen linnakkeen murahdus. Oman äänensä hän saa takaisin
kaatuessaan, koska se on hetki jolloin hän on taas vain oma itsensä. Se on sama
lause äänenä kuin se mikä hän on: jokainen numero jonka kuningas kantaa on
jonkun toisen numero.

Tulohuuto lähtee **heräämisestä eikä kentän alusta**: pomo herää kun pelaaja
astuu areenaan, ja aiemmin soitettuna huuto kuuluisi käytävään jossa ei vielä
näy ketään — ääni ilman näkyvää syytä opettaa katsomaan väärään suuntaan.

Kaksi mittausvirhettä matkan varrelta, molemmat kirjattuina koodiin: nimellinen
voimakkuus 0,5 tuotti väylällä 0,68…1,17 eli kaksi kertaa pelin kovimman äänen,
ja taajuusmittaus vertaili desibelejä nollaan (`getFloatFrequencyData` palauttaa
negatiivisia lukuja) eli raportoi `0 Hz` kaikilta seitsemältä.

---

## v26.08.17.95 — pomo järjestää huoneen uusiksi

ROADMAP kohta 4, päätetty 9.8.2026 ja "tehdään heti" 16.8.2026. Iskuaallon pomo
nostaa **ensimmäisen osuman jälkeen** areenan lattiasta pilareita.

| väite | mitattu |
| --- | --- |
| ennakoitu: varoitus ennen nousua | `2-F: varoitus framella 13, nousi framella 59` |
| palautuva: pomon kaatuminen palauttaa huoneen | `8/8 linnaketta laatta laatalta` |
| validoitu: jokainen paikka kelpaa | `1-F:3 2-F:5 3-F:3 4-F:5 5-F:5 6-F:3 7-F:5 8-F:5` |
| ja pahin tapaus läpäistävissä | `kaikki pystyssä: 8 linnaketta läpi voimatasolla 0` |

Tämä on se kohta jossa vihollinen koskee siihen mitä pelaaja luuli vakioksi:
lattiaan. Sama laskeutuminen joka lähettää iskuaallon herättää lähimmän paikan,
se pölisee 45 framea, ja sitten kaksi laattaa kiveä nousee. Pilaria ei anneta
jalkojen alta: jos pelaaja seisoo juuri siinä sarakkeessa, nousu **odottaa**
eikä peruunnu — peruuntuminen opettaisi seisomaan pilarin päällä.

**Se on iskuaallon pomon liikettä eikä uusi laji**, koska hänen sanansa on jo
lattia: aalto juoksee sitä pitkin, ja pilarin nostaminen on sama lause
voimakkaampana. Siitä seuraa myös että **kuningas perii sen** kuudentena
muotonaan, mikä on maailma 8:n koko lause — linna lähettää sen mitä se on jo
lähettänyt.

**Validointi ratkaistiin muodolla eikä laskemalla.** Se oli tämän kohdan este
kolmen viikon ajan: `rules.js` katsoo kentän lähtötilaa, eikä mikään portti
katsonut ruudukkoa joka muuttuu kesken taistelun. Kaikkien 2^n järjestelyn
ajaminen olisi ollut sekä hidasta että hauras. Sen sijaan pilari on **yksi
sarake leveä ja kaksi laattaa korkea**, ja mitattu hyppybudjetti on 6 laattaa
kuilua ja 4 laattaa seinää — kaksi laattaa on askelma eikä este. Yksikään
osajoukko ei voi tehdä ovesta saavuttamatonta, koska yksikään yksittäinen
pilari ei voi.

Paikat johdetaan ruudukosta (`plantPillars`) eikä kirjoiteta kenttädataan, sama
tapa kuin lämpöputkien uloskäynneillä ja kaasulyhdyllä. Se maksoi yhden
mittauksen: ensimmäinen versio etsi lattiaa ylhäältä alas ja löysi areenan
**katon** — nolla paikkaa jokaisessa linnakkeessa, ja portti sanoi sen suoraan.

---

## v26.08.17.94 — pomppu, ketju, tanko ja se kuori joka osui maalin jälkeen

Neljä asiaa suoraan pelistä, omistajan raportoimina.

| väite | mitattu |
| --- | --- |
| vihollisen päältä ponnistaa korkeammalle kuin omalla hypyllä | `pomppu 134 px, oma juoksuhyppy 100 px` |
| ilmassa ketjutettu tallaus maksaa enemmän, ja maakosketus katkaisee ketjun | `1. 100, 2. 200, maahan käynnin jälkeen 100` |
| potkaistun kuoren jono maksaa nousevasti | `100 -> 200 -> 400` |
| tangon korkeus maksaa, ja huipulta saa tähden | `alhaalta 100, huipulta 5000` |
| maalin jälkeen mikään ei enää satuta | `osui false, voimataso 2 -> 2` |

**Tallauspomppu oli sama kuin oma hyppy.** Mitattuna lähtönopeudella -4,0 pomppu
nousi napin ollessa pohjassa 100 px — ja pelaajan oma täyden vauhdin juoksuhyppy
nousee saman 100 px. Vihollisen päältä ponnistaminen ei siis antanut mitään mitä
hyppy ei antanut jo; se oli vain hyppy jonka aloitti joku muu. -4,5 nostaa sen
134 px:ään. -5,0 mitattiin myös (172 px) ja hylättiin: se on käytännössä pelin
paras hyppy, eli se tekisi jokaisesta vihollisesta oven kattoon.

**Ketjutappo on kerroin eikä taulukko.** Tässä pelissä viholliset ovat
eriarvoisia, ja kiinteä 100/200/400 olisi hukannut sen eron. Kerroin säilyttää
molemmat: *kuka* kaatui ja *monesko* se oli. Ketjuja on kaksi ja kummallakin on
oma omistajansa — pelaajan ketju katkeaa maahan laskeutumiseen, ja potkaistu
kuori kantaa omaansa potkusta lähtien. Kahdeksas peräkkäinen maksaa elämän.

**Tanko oli kytkin.** Mihin tahansa sen kuudesta ruudusta koskeminen päätti
kentän samalla tavalla, ja ainoa vaihtelu tuli kortin pyörimisestä eli puhtaasta
ajoituksesta johon ei voi tähdätä. Nyt tartuntakorkeus maksetaan kahdesti:
pisteet viidessä portaassa (100 · 400 · 800 · 2000 · 5000) ja **ylin porras
antaa tähden**. Onnenkortti on yhä olemassa — se on nyt se mitä saa kun ei
tähdännyt.

**Ja läpäisty kenttä ei voi enää satuttaa.** Raportoitu pelistä: potkaistu kuori
kimposi takaisin ja osui maalin jälkeen, kesken sitä kävelyä jota pelaaja ei
enää ohjaa. Sääntö on `hurt`issa eikä törmäyksissä, koska vahinkoa jaetaan
kymmenestä paikasta ja yksi tarkistus jokaisen edellä on lista joka vanhenee.

Sivuvaikutus joka mitattiin ja korjattiin samalla: isompi pomppu nosti pommin
päällä pomppivan pelaajan **42 px** sen keskipisteen yläpuolelle, eli kahden
pikselin päähän räjähdyksen 40:n ulkopuolelle. Räjähdyksen *pystyulottuvuus*
pelaajaan kasvoi 56:een; krateri ja tiilet eivät kasvaneet mukana, koska
sivusuunta on kentän geometriaa jota yksi hyppyvakio ei saa liikuttaa.

---

## v26.08.17.93 — demo näyttää tempun, ja puhetestit mittaavat oikeaa kelloa

Kaksi työtä, ja jälkimmäinen ei näy pelaajalle mutta poistaa esteen
pomoäänten tieltä.

### Puhetestit: neljä satunnaista kaatumista, yksi syy

Neljä äänitestiä kaatui noin joka toisessa ajossa. Vikaa oli etsitty **kolme
kertaa testin omista luvuista**; se ei ollut siellä.

| väite | mitattu |
| --- | --- |
| kaatuneessa ajossa äänikello ei edennyt lainkaan | `äänikello 0.00 s / seinäkello 0.47 s` |
| eikä se edennyt täyttä vauhtia vihreässäkään | `2.65 s / 6.14 s` eli 43 % |
| jäätynyt puskuri näkyy toistuvina lukemina | `s 24.82 š 24.82 f 24.82` |
| ja jäätyneeseen hetkeen kasautuneet äänet pohjakohinana | `15.3 · 25.1 · 46.0` |

Renderöijä seisoi kesken mittauksen, ja `ctx.state` sanoi koko ajan `running`.
Silloin analysaattori palauttaa saman vanhan puskurin uudestaan, sillä välin
soitetut äänet ajastuvat samaan hetkeen ja soivat yhtä aikaa kun renderöijä
herää, ja juuri soitettu ääni lukee 0,000. **Kolme neljästä kaatuvasta testistä
oli oire eikä oma vikansa.**

Korjaus on kaksiosainen, eikä kumpikaan osa löysää yhtään kynnystä:
mittausikkuna odottaa **äänikellossa** sen verran soitettua ääntä kuin siltä
pyydettiin (seinäkello on väärä kello äänelle), ja väylällä pidetään mittausten
ajan äänetön oskillaattori joka pitää renderöijän töissä. Jos se silti seisoo,
rivi sanoo *"ei mitattu"* eikä väitä lukua joka ei ole mittaus — ja oma
tarkistuksensa kaatuu jos yksikään äänimittaus ei toteutunut, jottei portti voi
kadota huomaamatta.

**Peli ei vuoda ääntä.** Tämä on headless-Chromiumin renderöijä eikä
`audio.js`: oikealla koneella äänilaite pyytää näytteitä 48 000 kertaa
sekunnissa riippumatta siitä mitä sivu tekee.

### Demo näyttää tempun, kentässä jota ei ole olemassa

Salaisuuksien löydettävyyden kolmas ja viimeinen osa (ROADMAP kohta 9).
Alkuruudun esittely **pysähtyy putken kannelle, painaa alas ja katoaa siihen**
— ja tulee samaa tietä takaisin painamalla ylös katosta roikkuvaa suuta.

| väite | mitattu |
| --- | --- |
| demo menee putkesta alas ja tulee takaisin | `kaistat 1 -> 2 -> 1, alas framella 389, ylös framella 546` |
| eikä sen löytämä kaista päädy pelaajan kirjanpitoon | `ei merkintöjä` |
| esittelykenttä läpäisee samat säännöt kuin pelin kentät | `ei huomautuksia` |
| ja saman botin voimatasolla 0 | `läpi` |

**Verbi opetetaan, paikkaa ei.** Alas painaminen putken päällä on ainoa verbi
jota peli ei pyydä missään, eikä sitä voi arvata näppäimistä. Mutta kaksi
ensimmäistä osaa lupaavat että kartta kertoo vain *että* salaisuuksia on ja
kolikkojono osoittaa vain sitä yhtä johon ei voi kompastua — eli demo ei saa
paljastaa mitään paikkaa. Ristiriita ratkesi omalla **esittelykentällä**
(`src/data/demo-level.js`) jota ei ole pelin kentissä: temppu tehdään oikeasti,
oikealla moottorilla ja oikealla putkella, mutta se putki ei ole missään
kentässä jonka pelaaja pelaa. Paljastettavaa ei ole.

Kolme hylättyä vaihtoehtoa, ja jokainen kaatuu samaan ehtoon: **1-1:n tavallinen
putki** ei tekisi mitään ja näyttäisi rikkinäiseltä; **demo 1-2:ssa** paljastaisi
sarakkeen 229; **salaisuus 1-1:een** panisi sen peliin ainoaan kenttään jonka
jokainen pelaa ennen kuin tietää mitään.

Kenttä ei ole `LEVEL_DEFS`:ssä (sama ratkaisu kuin päivän pierulla), koska
`levelIds()` on se lista jonka päällä kartta, vaikeusmittari, opetusjärjestys ja
vaihtelumittari lasketaan — näyteikkuna ei ole osa opetusjärjestystä. Se on
silti kenttä jonka pelaaja näkee, joten `verify.mjs` ajaa sille `validateLevel`in
ja maabotin erikseen: näyteikkuna jonka läpi ei pääse on huonompi mainos kuin ei
näyteikkunaa lainkaan.

Temppu on **ehdollinen asentoon eikä kelloon**. Ensimmäinen versio jarrutti
mitatusti (juoksusta 19 px vastaan kääntymällä, 56 px otetta irrottamalla) ja
epäonnistui joka kerta: se pysähtyi putken *viereen* maahan ja painoi alas
siellä missä jalkojen alla oli maata — mitattu 30 framea sarakkeessa 52 kun suu
on 53. Ehto on nyt sama kysymys jonka `tryWarp` kysyy: ovatko jalat sillä
rivillä jossa suu on. Kannen päälle noustaan tavallisella seinähypyllä, ja
siihen botti osaa itse.

Jos temppu ei onnistu — botti kuolee matkalla tai putki kieltäytyy — demo
jatkaa tavallisena demona: puolen sekunnin jälkeen suu jätetään rauhaan.
Katsoja näkee silloin demon eikä keskeytynyttä esitystä.

---

## v26.08.16.92 — hiekka tottelee painovoimaa, ja portti mittaa lopputilan

IDEAS-synteesi E, tuomio 16.8.2026 *"tee, ennen pomoa"*. Riko hiekkalammikon
alta tuki ja **hiekka valuu alas ja täyttää sen mihin se putoaa**.

| väite | mitattu |
| --- | --- |
| rikottu tiili tyhjentää oman sarakkeensa, ja vain sen | `sarake 10: hiekka rivillä 12; sarake 11: rivillä 6, koskematon` |
| valunut hiekka kasautuu lattialle | `12 12 12 12` |
| lopputila läpäisee kenttäsäännöt | `ei huomautuksia` |
| ja botti pääsee sen läpi voimatasolla 0 | `2-4 läpi` |

**Tämä on pelin ensimmäinen laki jossa kenttä jää toisenlaiseksi kuin se oli.**
Mureneva lauta kasvaa takaisin, möykky palaa kotiruutuunsa, kytkin nollautuu —
valunut hiekka ei palaa. Se on ominaisuuden koko idea ja samalla se ainoa asia
joka tässä on oikeasti uutta moottorille, joten `verify.mjs` ajaa nyt sekä
`validateLevel`in että maabotin **sille ruudukolle joka jäi jäljelle**. Juuri
tätä IDEAS.md:n ehto vaatii (*"emergenssi saa koskea vain sitä mikä ei ole
reitti"*), ja se on olemassa ennen ensimmäistä areenaa muokkaavaa pomoa
nimenomaan siksi että tämä on halpa harjoitus samasta ongelmasta.

Turvallisuus on rakenteellista eikä toiveajattelua: **hiekka ei ole reitti.**
Se ei ole kiinteä eikä puolikiinteä, joten poistuva hiekka ei voi viedä
askelmaa eikä saapuva tukkia käytävää. Se voi tehdä yhden asian — upottaa
siihen mihin se tuli — ja juuri sen portti mittaa.

**Ja pelissä ei ollut yhtäkään paikkaa jossa laki olisi voinut tapahtua.**
Kahdestatoista hiekkaruudusta yksikään ei ollut rikottavan laatan päällä, eli
mekaniikka olisi ollut olemassa ilman ominaisuutta. Siksi 2-4 sai
`dune_pour`-palikan (`clay_cut`in toisen esiintymän tilalta, joten kentän
pituus ei muutu): **hiekkasiilo**, neljä ruutua hiekkaa kivilaipoissa neljän
tiilen päällä.

Sarake kerrallaan, ja se on koko pulma: jokainen tiili kannattelee täsmälleen
oman sarakkeensa hiekan, joten pelaaja päättää kuinka paljon hiekkaa hän kaataa
itselleen. Keskellä oleva `?` on samalla palkinto ja kilpi — sarake 7 on ainoa
jonka alta ei voi puskea tiiltä, koska lohko pysäyttää pään kaksi riviä
aikaisemmin.

Valuminen on 4 px/frame (möykky 3,2), eikä siinä ole möykyn varoitustärinää:
hiekan varoitus on se lyönti jonka pelaaja itse teki. Ääni on pelin ainoa
täysin sävelettön — valuminen on tila eikä tapahtuma, ja kolmekymmentä pientä
kilahdusta peräkkäin olisi hälytys.

---

## v26.08.16.91 — pieruhylly: kukalla on nyt rakennusverbi

IDEAS-synteesi A, tuomio 16.8.2026 "tee". Seinään litistynyt laukaus jää
**kolmen ruudun kaasuhyllyksi kahdeksi sekunniksi**, ja sen päälle voi astua.
Kukka on pelin ainoa ase, ja ampuminen oli tähän asti vain vahinkoa; tämä antaa
sille rakennusverbin ilman että pelistä tulee rakennuspeli.

| väite | mitattu |
| --- | --- |
| seinäosuma jättää hyllyn seinän omalle puolelle | `3 ruutua rivillä 12, sarakkeet 27–29 (seinä 30)` |
| sen päällä seistään | `jalat 192, hyllyn pinta 192` |
| se haihtuu kahdessa sekunnissa | `0 ruutua jäljellä` |
| lattiaosuma ei jätä mitään | `0 hyllyä ilman seinää` |

Neljä rajaa, ja kolme niistä on kielto — mikä on oikea suhde, koska ainoa tapa
jolla tämä voi rikkoa pelin on tekemällä *liikaa*:

**Vain seinä laukaisee sen.** Pallo pomppii lattiaa pitkin koko matkansa, joten
lattiaosumasta syntyvä hylly tarkoittaisi hyllyä joka toinen ruutu koko juoksun
ajan. Seinä on harvinainen ja tahallinen osuma — ja se on myös se paikka jossa
askelma on jotain.

**Hylly kasvaa seinästä poispäin**, eli sitä kohti josta ammuttiin: seinän
toisella puolella oleva askelma on toisen huoneen askelma.

**Puolikiinteä eikä kiinteä.** Sen läpi mennään alhaalta ylös ja sen päälle
laskeudutaan, joten hylly ei voi sulkea käytävää, tukkia hyppyä eikä puristaa
ketään seinää vasten. Kiinteänä se olisi ollut ammuttava seinä, ja ammuttava
seinä on eri peli.

**Ja se katoaa itsestään.** Kaksi sekuntia on mitattu: juoksuhypyn koko kaari
on ~50 framea, joten 120 framea riittää ampumiseen, kääntymiseen ja yhteen
hyppyyn — muttei siihen että pelaaja kävelee pois ja tulee takaisin. Hylly on
liike, ei rakennelma. Sama perustelu kuin murenevan laudan paluulla: tilapäinen
tapahtuma staattisessa kentässä on turvallinen, pysyvä muutos maastoon ei ole.

Korkeus tulee ilmaiseksi ja on tämän parasta: pallo pomppii kaarina, joten se
osuu seinään eri korkeuksilla sen mukaan **milloin** laukaus lähti. Hyllyn
korkeus on siis ajoitusta.

---

## v26.08.16.90 — kaasulehti tekee hänestä paineastian

Omistajan tuomio 16.8.2026: *"muuta tanooki-design, keksi jotain pierumaisempaa
ja kaasuisempaa"*.

Tämä on **neljäs** korjaus samaan tasoon, ja kolme edellistä osui muotoon
muttei väriin: pesukarhun häntä vaihtui kaasuletkuksi, korvat lehdiksi, ja
puku jäi ruskeanbeigeksi — eli tarkalleen sen yhden puvun väriskaalaan jota
tämä genre ei omista. Muoto oli korjattu, luenta ei.

| ennen | nyt |
| --- | --- |
| `suit: C.tan, shade: C.brownDark, legs: C.brown` | messinki `#b8862c` / `#5c3c0c` / `#8c6414` |
| kaksi lehteä pään päällä korvien paikalla | kaksi messinkiventtiiliä samoissa pikseleissä |

**Hän ei muutu eläimeksi vaan laitteeksi.** Messinki on jo pelin oma metalli —
vyön paineventtiili, letkun suutin, torven torvi — ja kun sama metalli tulee
haalariin ja kahteen venttiiliin pään päälle, lentäminen lakkaa olemasta
"lentopuku" ja alkaa olla painetta jota päästetään ulos hallitusti.

Venttiilit ovat **samat kaksi 2x3-palikkaa samoissa pikseleissä** kuin lehdet
ja korvat ennen niitä: ne koskettavat pään yläreunaa täsmälleen kuten ennen, ja
se vierekkäisyys on se mikä pitää hahmon yhtenä kappaleena. Vaihtui väri ja
sisärakenne (vaalea laippa alas, tumma rako ylös — rako on se yksi yksityiskohta
joka tekee tolpasta venttiilin), ei silhuetti. Portti vahvistaa: *"the player is
one piece in every pose at every power level — 0 broken"*.

Vihreä hiuspohja jää tarkoituksella: se on tason ainoa vihreä, ja se sitoo
laitteen siihen kaasuun jota se käsittelee.

---

## v26.08.16.89 — putkesta tullaan ulos putkesta

Omistajan havainto 16.8.2026: luolasta noustessa hahmo "ilmestyy tyhjästä".
Se oli totta, ja mitattuna se oli pahempaa kuin miltä kuulosti: **pelin
jokainen kymmenestä kaistamatkasta päättyi paljaaseen ilmaan**, eikä yhdenkään
päässä ollut putkea. Pahimmillaan neljä ruutua lattian yläpuolelle (1-2, sarake
250: saapuminen rivillä 24, lattia rivillä 28), josta pelaaja tipahti maahan
kuin pudotettuna.

| väite | ennen | nyt |
| --- | --- | --- |
| matkan päässä on putki | `0/10` | `10/10` |
| jalat osuvat sen suulle | `–` | `10/10` |
| ja siitä noustaan ylös | `–` | `10/10` |

Syy oli `tryWarp`in laskussa: se säilyttää **suhteellisen korkeuden** kaistan
sisällä (`arriveY = p.y + shift`) ja tarkistaa vain että keho mahtuu ja että
jotain kiinteää on jossain alla. Kumpikaan ei ole väärin, mutta yhdessä ne
tarkoittivat että matkan pää on se kohta johon lähtökorkeus sattuu osoittamaan
— ei paikka.

Korjaus on pari, ja se **johdetaan datasta eikä kirjoiteta siihen**
(`plantWarpExits`): joka suulle etsitään kohdekaistasta se lattiarivi jolle
matka päättyy, ja siihen upotetaan putken suu. Kolme rajausta:

**Suu upotetaan lattiaan eikä rakenneta sen päälle.** Kiinteä laatta vaihtuu
kiinteään laattaan, joten kentän geometria ei muutu pikseliäkään — yksikään
reitti, hyppy tai kuilubudjetti ei tiedä että tässä tapahtui mitään. Kaksi
ruutua korkea putki olisi ollut uusi este keskellä todistettua reittiä.

**Uloskäynti on tavallinen putki eikä lämpöputki.** Se ei vie minnekään, ja
juuri siksi se ei saa näyttää siltä että veisi: lämpöputken oma piirros
tarkoittaa tässä pelissä "tästä pääsee", eikä alimmasta kaistasta pääse
alaspäin mihinkään. Tavallisia putkia kenttä on täynnä eikä yksikään niistä
lupaa matkaa (DESIGN.md kohta 8).

**Ja perillä noustaan ylös, myös alaspäin kuljetulta matkalta.** Meno ja tulo
ovat saman matkan päät eivätkä saman liikkeen jatko: kaista vaihtuu
leikkauksena, eikä leikkauksen yli kuljeteta liikesuuntaa. Molemmissa päissä
tapahtuu siis sama luettava asia — keho häviää suuhun, keho nousee suusta —
ja kaukopäähän tuli oma leikkuri (`farHide`), joten keho ei ole hetkeäkään
maalattuna lattian päälle.

---

## v26.08.16.88 — kaasulyhty: pitkä kenttä ei ala enää alusta

Omistajan kysymys 16.8.2026: onko kentän puolivälissä tarkistuspisteitä, ettei
tarvitse aina aloittaa alusta. **Ei ollut.** Pelissä oli tasan yksi lähtöruutua
siirtävä asia, linnakkeen ovi, ja se on eri asia: se koskee vain linnakkeita ja
sen perustelu on pomon jälkeen toistuva käytävä.

Nyt jokainen **yli 340 saraketta pitkä** kenttä saa yhden kaasulyhdyn, ja siitä
kuolema jatkuu. Mitattuna se on 15 kenttää 64:stä.

| väite | mitattu |
| --- | --- |
| pitkä kenttä saa lyhdyn, lyhyt ei | `400 saraketta: 1, 300 saraketta: 0` |
| ohi käveleminen sytyttää sen ja merkitsee sarakkeen | `laatta palaa, muistiin jäi sarake 200, ääni soi kerran` |
| uusi yritys alkaa lyhdyltä, ja lyhty palaa jo | `aloitus sarakkeesta 200/400` |
| vaikeustason vaihto unohtaa pisteen | `420 sarakkeen kentässä aloitus sarakkeesta 1` |
| ja jokaisesta lyhdystä pääsee maaliin voimatasolla 0 | `15/15 kenttää botilla` |

**Raja 340 saraketta on aikaa eikä pituutta.** Täydellä juoksuvauhdilla se on
~36 s, eli puoliväliin kävelee ~18 s — pitempään kuin koko linnakkeen käytävä
(19–24 s), jonka toisto perusteli oven. Mediaanikenttä on 314 saraketta ja jää
tarkoituksella ilman: lyhty ei ole palkinto vaan korjaus pituuteen.

**Se mitä lyhty ei tee, on yhtä tärkeää.** Kuolema vie yhä karttaan, maksaa yhä
elämän ja pudottaa yhä voimatason. Lyhty säästää kävelyn, ei kenttää — sama
lause kuin linnakkeen ovella. Ja **läpäisy tyhjentää sen**: tarkistuspiste on
yhden yrityssarjan muisti, ei pysyvä oikotie. Muuten kentän alkupuolisko
pelattaisiin kerran eikä koskaan enää.

Kolme asiaa ratkesi tekemällä:

**Lyhty pystytetään kohtauksessa, ei kirjoiteta kenttädataan.** Se ei ole
kiinteä, ei vaarallinen eikä se muuta yhtään hyppyä, kuilua tai kattoa, joten
yksikään validaattori ei tarvitse sitä nähdäkseen kentän oikein. Vaihtoehto oli
17 muutosta kenttädataan, uusi vaikeustaulu ja uusi opetusjärjestyksen
tarkistus, eikä yksikään niistä olisi mitannut mitään uutta.

**Talteen menee sarake eikä `true`.** Vaikeustaso venyttää kentän (`scale.js`),
joten HELPOSSA sytytetty sarake ei ole NORMAALIssa sama paikka. Sisääntulo
vertaa lukua tämänhetkiseen lyhtyyn ja unohtaa pisteen jos ne eivät täsmää:
menetetty lyhty maksaa yhden kävelyn, väärään paikkaan herätetty pelaaja
maksaisi kentän.

**Ja herätyspaikan edessä pitää olla 24 laattaa rauhallista.** Tämä on se luku
jonka portti opetti. Ensimmäinen versio vaati kaksi laattaa tasaista, ja botti
kuoli viidessä kentässä heti lyhdyn jälkeen: 3-3:n lyhty oli kolme laattaa
ennen kuuden laatan laavalampea, 3-1:n kolme ennen kuilua, 3-7:n neljä ennen
piikkejä. Kentän alusta juostessa ne ylitetään täydellä vauhdilla, seisaaltaan
ei yhtäkään. Kahdeksan laattaa korjasi neljä viidestä; 2-1 vaati 24, koska sen
kuilu on kuusi laattaa eli budjetin maksimi ja ylittyy vain oikealla
irtoamishetkellä. Hinta on kirjattu: lyhty ei ole enää tarkassa puolivälissä
vaan lähimmässä rauhallisessa paikassa, mitattuna 35–72 % kentästä.

Kaksi merkkiä eikä yksi (`L` sammunut, `l` palava), koska sytytys on ruudukon
kirjoitus samalla tavalla kuin kolikon poiminta — jolloin pikatallennus muistaa
liekin ilmaiseksi, `savestate.js` kun tallentaa ruudukon.

---

## v26.08.16.87 — ponnahduslauta: vauhtimittari ostaa korkeutta

IDEAS-synteesi H, tuomio 16.8.2026 "tee", ja se on kohdan 1 (*vauhti
korkeudeksi*, omistajan vahvimmaksi arvioima verbi) halpa muoto: rinteitä ei
ole eikä niitä kannata rakentaa, mutta **täysi vauhtimittari voi ostaa
korkeutta ponnahduslaudalta**.

| väite | mitattu |
| --- | --- |
| tyhjällä mittarilla lauta antaa jotain | `100 px` |
| täysi mittari antaa enemmän | `192 px` |
| ...ja enemmän kuin mikään muu tässä pelissä | `paras hyppy on 174 px` |

Laatta on `J`, kiinteä, ja se asetetaan **lattiariviin**. Nosto on
`SPRING_LOW` (-4,0) ja `SPRING_HIGH` (-5,4) väliltä mittarin täyttöasteen
mukaan, ja molemmat luvut on johdettu nousun kaavasta eikä valittu: kun
hyppynappi on pohjassa, lähtönopeus `v` nostaa `(v² - 4) × 8 + 6,4` pikseliä.
Tyhjä mittari on siis suunnilleen tallauspomppu (`STOMP_BOUNCE` on sama -4,0)
— laatta joka ei tekisi mitään ilman mittaria olisi pelaajalle rikki eikä
ehdollinen — ja täysi on kolmetoista ruutua.

Kolme asiaa ratkesi tekemällä, ja kaksi niistä oli virhe jonka mittaus näytti:

**Lauta on lattiarivissä eikä sen päällä.** Laatta on kiinteä, joten lattian
päälle pantuna se on yhden ruudun seinä jota vasten juostaan. Mitattu: nosto
0 px, koska kukaan ei koskaan seissyt sen päällä.

**Mittari luetaan siltä frameelta jolla lauta lukee sen.** Ensimmäinen koe otti
suurimman arvon koko ajolta ja raportoi molemmille tapauksille 100 %, koska kun
lauta ei laukea, pelaaja juoksee sen ohi ja täyttää mittarin myöhemmin. Koe
kertoi siis mittarista eikä laudasta.

**Ja se ei kuluta mittaria.** Lauta myy korkeutta vauhdista, ja vauhti on jo
maksettu juoksemalla; mittarin nollaaminen veisi pelaajalta sen edun (`MAX_P`,
lento kaasulehdellä) jonka hän juuri osti, ja tekisi laudasta toisen
`pSpent`-tapahtuman.

Paikka on **3-1**, ja se on valinta: jäämaailma on se jossa vauhti jo
merkitsee, ja kolmentoista ruudun nousu päättyy siellä liukkaaseen
laskeutumiseen. Opetusjärjestys sanoi missä se *ei* voi olla — 1-3 esitteli jo
kolme asiaa ja neljäs olisi kaatanut portin, ja lauta olisi ollut neljäntoista
laatan päässä piikkien ensiesittelystä.

---

## v26.08.16.86 — kupla kantaa, ja pierupompusta tuli panos

Kaksi ensimmäistä kohtaa 16.8.2026 tehdystä läpikäynnistä ([IDEAS.md](IDEAS.md),
"Omistajan tuomiot 16.8.2026"). Ne ovat samassa erässä koska ne ovat molemmat
**ilmassa olemista**, ja koska ne vetävät samaan suuntaan: ilmaan pääsee yhä,
mutta siellä on nyt sekä uusi askelma että hinta.

| väite | punainen | vihreä |
| --- | --- | --- |
| kuplan päälle voi astua | `kosketus puhkaisi sen heti` | `kantoi 18 framea, sitten puhkesi ja pomppasi` |
| kupla ei ole hissi | — | `18 framea < lyhin hyppy 22 framea` |
| sivulta kupla puhkeaa yhä heti | — | `puhkesi, carried 0` |
| viisi panosta ei nosta kuin yksi | `124 px vs 165 px` | `124 px vs 134 px` |
| viisi panosta ei kanna kuin yksi | `205 px vs 402 px` | `205 px vs 250 px` |
| panoksia ehtii silti käyttää | — | `4 panosta viidestä pitkässä pudotuksessa` |

### Kupla kantaa

Kuplaan vangittu vihollinen oli jo leijuva ja jo vaaraton, eli kaikki mitä
askelma tarvitsee oli valmiina — puuttui vain se että kuplalla saisi seistä
hetken. Nyt saa 18 framea, joiden ajan pelaaja istuu kuplan katolla ja kulkee
sen mukana, ja sitten se puhkeaa alta.

Luku on hypyn mitasta eikä tunnelmasta: lyhin mitattu hyppy on paikaltaan
näpäytetty 22 framea, joten **kupla kantaa vähemmän aikaa kuin kestää hypätä
sen yli**. Se on askelma jonka ajoittaa, ei taso jolla odotetaan, ja se on koko
ero kuplaloukun ja hissin välillä.

Sivulta ja alta kupla on merkilleen se mitä se on aina ollut, ja se on portissa
regressiona: uusi tapa kaataa kupla ei saa viedä pois vanhaa.

Kannon toteutus on istuttaminen eikä fysiikka. `moveY` tuntee laatat eikä
olioita, ja sen opettaminen tuntemaan olioita olisi ollut fysiikkaremontti
yhden kuplan takia; sen sijaan pelaaja asetetaan kuplan katolle joka framella,
mikä on myös se mikä tekee tästä *kannettavana olemisen* eikä paikallaan
seisomisen — kupla keinuu ja tuore kupla nousee.

### Pierupompusta tuli panos, ja se maksoi kaksi väärää korjausta

Vika oli mitattu ja se oli talouden vika: `airJumpsMax` on pierusienellä sama
kuin voimataso, eli tasolla 5 ilmassa on viisi ponnistusta — ja kenttägeometria
on hinnoiteltu **yhtä** hyppyä vasten. Kuilubudjetti on 6 ruutua eli 96 px ja
mitattu juoksuhypyn kantama 155 px, joten viidellä ponnistuksella pelin levein
kuilu on lyhyempi kuin yksi ponnistus. Palkinto ei tehnyt hypystä parempaa vaan
poisti kysymyksen.

Korjaus tuli kolmessa osassa, ja **kaksi ensimmäistä olivat vääriä**. Ne ovat
tässä siksi että molemmat kuulostivat oikealta:

1. **Jäähdytys** (`AIR_JUMP_CD` 40 framea, johdettu nousun kestosta: 2,3 /
   0,0625 = 37 framea plus loput ≈ 43 framen huippu). Se kesytti korkeuden
   41 px:stä 41:een… eli ei mitään, mutta esti kasaamisen. Mitattuna korkeus
   putosi mutta **kantama ei**: 402 px viidellä panoksella vastaan 205 yhdellä.
2. **Vauhdin leikkaus** (`vx *= 0,55` toisesta panoksesta), perusteluna että
   alaspäin purkava kaasu ei saa työntää eteenpäin. Se teki asian
   **pahemmaksi**: kantama nousi 402:sta **554:ään**. Syy on että tässä pelissä
   on ilmaohjaus — `ACC` toimii myös ilmassa — joten leikattu vauhti palaa
   kattoon neljässäkymmenessä framessa ja ainoa saavutus oli pidempi kaari
   (160 framesta 240:een). **Kantaman ajuri ei ole vauhti vaan ilma-aika.**
3. **Suppeneva nosto** (`AIR_JUMP_DECAY` 0,5): jokainen panos nostaa puolet
   edellisestä. Ketju suppenee, kaari ei veny, ja mitattu kantamaero on
   197 px:stä **45 px:ään** ja korkeusero 41:stä **10:een**.

**Ensimmäinen panos on tasan entisensä**, ja se on ehto eikä armo: mitattu
tapaus *juoksu + pieruhyppy* (174 px nousua, 285 px kantamaa) on se josta
`softGapTiles` on johdettu ja jota vasten jokainen kenttä on validoitu.
Ensimmäisen panoksen hinnoittelu olisi liikuttanut kaikkien kenttien sääntöjä;
toisesta eteenpäin ei liikuta mitään, koska yksikään mitattu tapaus ei käytä
kahta.

Ja se mitä voimatasosta yhä ostetaan on portissa omana rivinään: pitkässä
pudotuksessa panoksia ehtii käyttää neljä viidestä. **Panos on pelastus, ei
lento** — ja se on nyt kaksi mitattua lukua eikä yksi lause.

---

## v26.08.16.85 — maahaniskun kyykky, neljä uutta vihollista, mitatut hyppysarjat ja tähden oma raita

Omistajan viisi pyyntöä 16.8.2026, yhtenä eränä. Neljä niistä on samaa asiaa
eri suunnista — **peli oli normaalilla liian helppo** — ja viides on merkki
jota ei ollut.

| väite | punainen | vihreä |
| --- | --- | --- |
| maahaniskulla on asento | `seisten 0, kyykyssä 0` | `L1 seisten 0, kyykyssä 11, noustessa 9` |
| lattian rikkoo se joka rikkoo katon | `pieni puskee false, iskee 5 tiiltä` | `pieni: puskee false, iskee 0 — kasvanut: molemmat` |
| rikkominen on tappamista tiukempi | `voima 0.60 rikkoi` | `voima 0.60 tappaa mutta ei riko, 0.82 rikkoo` |
| jokaisella uudella lajilla on hinta | `13 merkkiä` | `17 merkkiä: g k f p r c x A H b O P U T Z Y m` |
| ammuksen päälle voi hypätä | — | `putosi 0 px, tallaus poisti sen` |
| paarma ampuu vain alleen | — | `alla 1 pisara, kaukana 0` |
| karvapallo kiihtyy eikä talloudu | — | `0,91 → 1,75 px/frame, tallaus maksoi tason` |
| paukkupöhö syttyy tallauksesta | — | `jäi henkiin, tiiliä 3 → 2, voimataso 1 → 0` |
| hyppysarja on hypättävissä voimatasolla 0 | — | `kolme sarjaa, kaikki läpi ratkaisijalla` |
| ...ja tiukin on tiukka | — | `9 px = 3,6 framea juoksuvauhdilla` |
| tähtiraita on pelin nopein | — | `star 208, boss 176, cave 88` |

### Maahanisku näyttää nyt siltä mitä se maksaa

Liike on maksanut alusta asti ohjaamattomia frameja — kaksitoista latausta,
syöksy, ja kuudestatoista kuuteentoista+kahteenkymmeneen framea laskeutumisen
jälkeen — ja **se hinta oli näkymätön**: `state()` sanoi ilmassa `jump` ja
maassa `idle`, joten lataus näytti leijumiselta ja jäykkyys siltä että hahmo
seisoo tumput suorina. Nyt keho menee kerälle latauksessa, pysyy kerällä
syöksyssä ja nousee siitä viimeisillä frameilla.

**Osumalaatikko ei liiku.** `ducking` on se lippu joka kutistaa kehon, eikä
tämä asento aseta sitä: syöksy joka kutistaisi laatikkonsa muuttaisi sen mihin
se törmää, ja jokainen maahaniskusta mitattu luku on mitattu sillä laatikolla
joka sillä on aina ollut. Muuttunut on vain se missä piirros istuu laatikon
sisällä — sen pohjalla, ilmaa pään yllä, mikä on se miltä kyykky näyttää.

Iso keho käyttää **kyykkypiirrosta siirrettynä**, ei omaansa: kyykky on kyykky,
ja kaksi piirrosta samasta asennosta on kaksi tapaa ajautua erilleen. Pieni
keho ei ole koskaan saanut kyykistyä (`wantDuck` vaatii `big`), joten sen
kyykky piirrettiin tässä.

### Lattian rikkominen on katon ehto ylösalaisin

Ehto oli **voimataso 3**. Nyt se on `p.big`, eli täsmälleen sama ehto jonka
päänpusku on aina asettanut: pieni Pieruprinssi kolauttaa tiiltä alta eikä se
hajoa, ja nyt hän myös laskeutuu sen päälle eikä se hajoa. Omistajan pyyntö oli
tämä symmetria sanasta sanaan, ja se on parempi sääntö kuin vanha siksi ettei
se ole tämän liikkeen oma luku lainkaan — pelaaja on jo oppinut kerran kuka
tiilen rikkoo.

Hinta siirtyi korkeuteen. `POUND_BREAK_AT` on 0,72 ja se on **tappamisen rajaa
(0,50) ylempänä**: syöksy joka tappaa vihollisen ei vielä riitä tiileen. Se on
mitattu molemmista suunnista — voima 0,60 tappaa muttei riko, 0,82 rikkoo —
eikä yksikään hyppy tasamaalta yllä siihen (mitattu paras nousu 100 px,
[PHYSICS.md](PHYSICS.md)), joten reikä lattiassa on aina joko korokkeelta tai
pieruhypyllä ansaittu.

### Neljä uutta vihollista, ja ne kysyvät neljää eri kysymystä

Peli oli helppo koska **jokainen vihollinen kysyi samaa kysymystä**: milloin
hyppään sen yli tai päälle. Kun se osataan, kentän pidentäminen kysyy sitä
useammin eikä vaikeammin — ja juuri sen NORMAALI-taso tekee. Neljä uutta on
valittu peittämään neljä eri **etäisyyttä**:

| laji | mistä se tulee | vastaus | hinta mittarissa |
| --- | --- | --- | --- |
| **törähdystorvi** (`T`) | kaukaa vaakasuoraan | mene ali tai talloo torvi | 2,2 |
| **paarma** (`Z`) | ylhäältä alas | älä jää seisomaan | 1,8 |
| **yökki** (`Y`) | lattiaa pitkin | hyppää pallon yli, kaada lähde | 2,4 |
| **paukkupöhö** (`m`) | lähietäisyydeltä, kun siihen on koskettu | lähde heti | 1,9 |

Kaksi niistä on myös **työkalu**: törähdys on tallattava, eli kuilun yli lentävä
ammus on askelma; paukkupöhön räjähdys rikkoo tiiliä `burstBricks`in omilla
säännöillä, eli seinän voi avata ilman voimatasoa, häntää ja maahaniskun
korkeutta.

Kaikki neljä läpäisevät samat kolme spriteporttia kuin vanhat lajit, ja **kaksi
mittausta ostettiin punaisella**:

- **messinkitorvi erottui tehtaan lattiasta 5,4 prosentilla** (kynnys 8,6).
  Syy oli kirjoitettu auki jo pöntön kohdalle eikä sitä tarvinnut arvata
  uudestaan: yhtä paljon lämmintä ja kylmää keskiarvoistuu tasan siksi
  keskiharmaaksi joka tehtaan lattia on. Esine valitsi puolen — pönttö on
  terästä, torvi on messinkiä läpi koko esineen — ja luku on nyt 12,0.
- **karvapallo erottui yön maasta 1,7 prosentilla**, eli se oli käytännössä
  näkymätön juuri sillä lattialla jota pitkin se vierii. Vaalennettuna 12,0.
- ja sama vika kolmannen kerran: **törähdys 2,6 % aavikon maata vasten**.
  Korjaus on kaasupyrstö, joka on kolmannes rungosta ja samalla se osa joka
  kertoo mikä ammuksen liikkeelle panee — **6,9 %**, ja se on yhä alle 8,6:n.
  Se jää tähän tietoisena eikä huomaamatta: laji on maailmassa 4 eikä aavikolla,
  eikä `scale.js` lisää sitä (torvi ei ole `GROUNDLINGS`issa), joten mitattu
  huonoin tapaus on tilanne jota peli ei tänään tuota. Jos joku panee torven
  aavikolle, tämä rivi on se joka kertoo mitä sille pitää ensin tehdä.

### Hyppysarjat: "vaikea muttei mahdoton" on kaksi mitattavaa väitettä

Omistaja pyysi *algoritmia* joka tekee hyppysarjoja jotka ovat vaikeita muttei
mahdottomia. Siinä lauseessa on kaksi vaatimusta jotka osoittavat vastakkaisiin
suuntiin, eikä kumpaakaan voi jättää arvioitavaksi:

- **"Ei mahdoton" on olemassaoloväite.** Jonkin syötejonon on vietävä läpi.
- **"Vaikea" on niukkuusväite.** Niitä jonoja ei saa olla montaa.

Molemmat lasketaan, koska fysiikka on deterministinen.
`tools/jump-solver.js` hakee jokaiselle loikalle ponnistuskohdan pikselin
tarkkuudella ja pitoajan neljästä, mittaa **ikkunan** — montako
ponnistuskohtaa vie perille — ja ajaa lopuksi koko sarjan yhtenä juoksuna
voimatasolla 0, pelkällä juoksulla ja hypyllä. `tools/gen-jumps.mjs` arpoo
ehdokkaita, mittaa neljätoista kutakin reseptiä kohti ja valitsee sen jonka
**kapein** loikka on lähimpänä reseptin tavoitetta.

Ikkuna on pikseleinä eikä frameina, ja se on päätös: ponnistuskohta on paikka,
ja pelaaja näkee paikan muttei framea. Juoksukatolla kymmenen pikseliä on neljä
framea, kävelyvauhdilla seitsemän — sama ikkuna on eri määrä armoa eri
vauhdilla, ja niin se on myös pelattuna.

Kolme sarjaa, kaikki maailmaan 8 jossa hyppy saa olla pelin vaikein asia:

| sarja | loikat | ikkunat | kenttä |
| --- | --- | --- | --- |
| HARJOITUS | 5 | 40–49 px | 8-5 |
| KAMPI | 6 | 28–49 px | 8-6 |
| NEULA | 6 | 9–33 px | 8-7 |

Yhdeksän pikseliä on 3,6 framea juoksuvauhdilla, ja se on koko sarjaston
tiukin kohta. `verify.mjs` ajaa saman todistuksen samasta moduulista joka
ajolla: fysiikan muutos ei vanhenna näitä hiljaa vaan kaataa portin.

**Ehto koskee kapeinta loikkaa eikä kaikkia.** Ensimmäinen versio vaati
haarukan joka loikalta ja hylkäsi jokaisen ehdokkaan yhdestä helposta loikasta
viidestä — se olisi ollut vaatimus "tasainen sarja", ja tasainen sarja on
rytmitön. Sarjan vaikeus on sen tiukin kohta; väljä loikka sen keskellä on
hengähdys.

### Ja se mitä tämä paljasti botista

Maareitin todistaja (`tools/level-bot.js`) **ei osaa lankkusarjaa**. Ei siksi
että lankku olisi sille tuntematon — se tähtää astinkiveen aivan oikein — vaan
siksi että se pitää hyppyä pohjassa kuusitoista framea joka kerta kun se
tähtää: yksi lankku kuilussa menee siitä hyvin, viisi peräkkäistä ei.

Se on botin karkeus eikä kentän vika, ja sellaiselle paikalle on nyt **oma,
vahvempi todistaja**. Raja kahden todistajan välillä on kirjattu koodiin ja se
on tiukka: ylitys kelpaa vain jos tyhjä on leveämpi kuin *kaksi* mitattua
hyppyä ja sen yllä on vähintään kolme lankkua. Kapeamman botti hyppää itse —
myös silloin kun siinä on lankku, kuten 4-1:ssä ja 4-3:ssa. Ylitysten määrä
tulostetaan joka kentästä, ja koko muu peli antaa nollan.

Samalla korjaantui vanha kahdennus: maailmojen 6–8 portilla oli **oma kopio
botista**, yksinkertaisempi kuin varsinainen. Se tarkoitti kahta mielipidettä
siitä mitä "läpäistävissä" tarkoittaa, ja ero näkyi ensimmäisenä päivänä jona
botille kirjoitettiin uusi taito: yksi portti kertoi kentän aukeavan ja toinen
ettei se aukea, samasta kentästä samana ajona. Nyt molemmat ajavat samaa
`runGround`ia.

### Supertähdellä on oma raita

Jokainen muu raita `TRACKS`-taulussa vastaa kysymykseen *missä olen*. Tämä
vastaa kysymykseen *mitä minulle juuri nyt tapahtuu*, ja siksi se on ainoa joka
soi minkä tahansa huoneen päällä — **myös pomohuoneen**. Se on `trackFor`in
ensimmäinen rivi ja samalla se rivi joka näyttää kyseenalaiselta: tähti
pomohuoneessa on juuri se hetki jona pelaaja tekee sen mitä tähti lupaa, eli
kävelee suoraan päin.

Järjestys on sama kuin ruudun värillä (`PALETTE`: osuma > tähti > huone), koska
kahden signaalin eri järjestys olisi kaksi eri väitettä samasta hetkestä.

Raita on **pelin nopein**, 208 vastaan pomon 176, ja kaikki siinä on
kirjoitettu sen loppumista vasten: yksi kahden tahdin riffi ilman yhtään
taukoa, kromaattisesti nouseva basso, ja bassorumpu kahdeksasosille. Omaa
sävellystä — vapautuneesta sävelmistöstä ei löydy teosta joka olisi *tämä
lause*, koska klassikot ovat paikkoja ja tunnelmia eikä kuudentoista sekunnin
voittoputki ole kumpikaan.

---

## v26.08.16.84 — kuvaefektit: tärinällä on suunta, ja tapahtumilla on väri

Kaksi jonossa ollutta kuvaefektiä (ROADMAP, *"Ruutuefektit"* kohta 1 ja
*"Kuvaefektit: jäljellä olevat efektit"* kohta 1). Ne ovat samassa erässä
siksi että ne ovat sama kysymys kahdessa muodossa: **mistä pelaaja tietää mitä
juuri tapahtui, silloin kun se tapahtuu koko ruudulle eikä yhdelle oliolle.**

| väite | punainen | vihreä |
| --- | --- | --- |
| pystyisku tärisyttää pystyyn | `pysty 6x/4y — sama ellipsi kuin kaikella` | `pysty 0x/6y, sivu 6x/0y` |
| pomon laskeutuminen kertoo massan | `ei suuntaa, koko 1 ja 3 samanlaisia` | `koko 1 → 3 y, koko 3 → 5 y` |
| jättiläisen askel tuntuu | `0 askelta 160 px:llä` | `7 askelta 160 px:llä, kevyt 0/288` |
| iskuaalto kulkee lattiaa pitkin | `3 both` | `3 x` |
| osuma välähtää | `ei siirtoa` | `0.42 → 0 kymmenessä framessa` |
| välähdys ei toistu | — | `1 välähdys 240 framessa = 0,25 Hz` |
| verho ja siirto eroavat | — | `verhon keskus 128,128,128, siirron 181,136,134` |
| tähti sykkii muttei välky | — | `1,54 Hz, luminanssia 2,2 %` |
| pomohuoneella on oma sävy | `ei siirtoa` | `tulee 40 framessa, lähtee oven mukana` |

### Tärinän suunta, ja kuka sen valitsee

`shake(amount)` sai toisen parametrin: `'both'` (vanha leveä ellipsi, ja yhä
oletus), `'y'` tai `'x'`. Kolme päätöstä jäi kirjatuksi, ja kaksi niistä on
sellaisia jotka olisi ollut helppo tehdä toisin ja väärin:

**Suunnatut ovat puhtaita eivätkä painotettuja.** Pystyisku ei liikuta kuvaa
sivuun lainkaan (mitattu `0x/6y`). Puolikas sivuliike olisi tehnyt
pystyiskusta vain *kapeamman ellipsin*, ja silloin ero olisi ollut makuasia
eikä merkki — juuri se vika joka tässä oltiin korjaamassa.

**Kun kaksi tärähdystä osuu samaan frameen, kovempi valitsee suunnan.** Sitä
tapahtuu joka kerta kun pomo laskeutuu ja aalto lähtee, joten sääntö on
pakollinen eikä hienosäätöä. Se on sama järjestys jolla voimakkuus itse on
aina valittu (`Math.max`), eli sitä ei tarvitse opetella erikseen; tasapeli
palaa ympyrään, koska kaksi yhtä kovaa iskua eri suunnista *on* ympyrä. Ja
vaimennut tärinä nollaa suuntansa: seuraava isku ei peri edellisen suuntaa.

**Askel on matkaa, ei kelloa.** Jättiläisen askel lähtee kuljetusta
pikselimäärästä (`GIANT_STEP_PX` 22), joten syöksyssä askeleet tihenevät
itsestään ja paikallaan seisova pomo on hiljaa — ajastin olisi antanut
seisovallekin askelia, ja se olisi lukenut rikkinäiseltä kuvalta. Se alkaa
vasta koosta 2, eli kahden osuman jälkeen: tärinä on **tieto siitä että hän
kasvoi** eikä pomon vakio-ominaisuus. Ääntä ei tullut, koska pomoääniä on
kaksi opeteltavaa ja kolmas olisi kolmas — sama perustelu jolla kuninkaan
muodonvaihdos jäi olemassa olevan äänen varaan.

### Palettisiirto, ja miksi se ei ole varjostimessa

Kolme tapahtumaa — vahinkovälähdys, tähden syke ja pomohuoneen sävy — jakaa
yhden mekanismin: `PostFX.setTint(r, g, b, amount)`, yksi `multiply`-veto koko
pelikentän yli, yhden framen ajaksi. Roadmap arveli tähän yhtä varjostimen
uniformia. Se olisi ollut lyhyempi diffi ja väärä paikka:

**Palettisiirto on pelin puhetta, ei kuvaputken.** Varjostin on olemassa vain
kun WebGL saatiin ja vain kun esiasetus ei ole "pois", eli siellä asuva
vahinkovälähdys katoaisi kahdella eri tavalla — ajurin ja asetuksen mukana.
Nyt se piirtyy myös esiasetuksella "pois" (mitattu: `rgb(128,80,80)` sen
sijaan että kuva jäisi harmaaksi). **Kuvaefektit saa sammuttaa; merkkiä joka
kertoo osumasta ei.** Toinen puoli on että yksi toteutus on yksi mittaus:
portin lukema pikseli on se pikseli jonka pelaaja näkee, oli koneessa WebGL
tai ei.

**Ei läpikuultavaa peitettä, vaan kaksi vetoa.** Puoliksi läpinäkyvä väri
kuvan päällä vetää kaiken kohti samaa keskiharmaata: tumma tiili vaalenee ja
vaalea taivas tummenee. Kerto ja lisäys pitävät kuvan omat kontrastit ja
siirtävät vain väriä — siksi tämä on siirto eikä sumu.

Ja vetoja on kaksi, koska merkityksiä on kaksi. **Kerto vie väriä ja on
paikan väri**: pomohuone on lämmin ja tumma, ja jokainen tiili siinä pysyy
sinä tiilenä jonka pelaaja tunnistaa. **Lisäys tuo valoa ja on tapahtuman
väri**: osuman pitää näkyä myös siellä missä kuva on jo tumma. Ero on
mitattu eikä makuasia — tumma ruutu (32) nousee lisäyksellä 126:een ja
laskee kerrolla 32:een. Ensimmäinen versio tästä oli kerto myös osumalle, ja
kuvakaappaus kertoi miksi se on väärin: kerto ei voi tehdä sinisestä
taivaasta punaista, se tekee siitä violetin, eikä *"taivas muuttui
violetiksi"* ole se lause jonka osuman pitää sanoa.

**HUD jää ulkopuolelle** (mitattu: `rgb(128,128,128)` nauhassa samalla kun
kenttä on `rgb(128,80,80)` samalla vedolla), samasta syystä kuin hehku, kuumuus ja huurre
jäävät: numerot ovat pelin puhetta pelaajalle, ja punaiseksi värjätty
pistelukema tarkoittaisi jotain mitä se ei tarkoita.

**Siirto elää yhden framen.** Sama sääntö kuin maailman valoilla: kohtaus
työntää sen joka framella ja `apply` kuluttaa sen. Kartta, valikko ja
pistetaulu eivät pyydä sitä koskaan, eikä edellisen kentän osuma siksi voi
värjätä niitä.

**Järjestys on osa määrittelyä.** Osuma > tähti > huone: osuma kesti kymmenen
framea, tähti yksitoista sekuntia ja huone koko kentän — mitä lyhyempi, sitä
tuoreempi, ja sitä tärkeämpi juuri nyt.

### Löydös joka ei ollut tehtävälistalla: tähti ei saa välkkyä

Nappulan oma tähtiväri vaihtuu kolmen framen välein, eli 20 Hz. Sama tahti
koko ruudulle olisi ollut suora käännös — ja se olisi ollut se yksi kohta
tässä pelissä jossa kuvavalinta on **turvallisuuskysymys**: WCAG 2.3.1:n
yleinen välähdyskynnys on alle kolme välähdystä sekunnissa *tai* alle 10 %
suhteellisen luminanssin muutos ruudun isolla alalla, ja peliä pelaa lapsi
kavereineen.

Ruutu siis hengittää eikä välky: sinikäyrä 46 framen jaksolla (1,3 Hz) ja
viimeiset 138 framea 23 framen jaksolla (2,6 Hz) merkkinä siitä että tähti on
loppumassa. Molemmat luvut ovat portissa mitattuina — **1,54 Hz ja 2,2 %
luminanssia** — eivätkä kommenttina. Ja 138 on sekä 46:n että 23:n monikerta,
joten tahdin vaihto osuu aallon pohjalle eikä ole askel.

Ja kirkastuvalla välähdyksellä on sama kysymys kuin sykkeellä: entä jos niitä
tulee monta peräkkäin? Ei voi tulla. Osuman jälkeen on 110 framea
kuolemattomuutta, joten välähdyksiä tulee enintään yksi per osuma ja osumia
enintään yksi per 110 framea — mitattuna **0,25 Hz** kun osumaa yritetään joka
ainoalla framella. Se luku ei ole tätä varten tehty; se oli jo pelissä, ja
tämä efekti on turvallinen sen ansiosta.

### Naapuri joka tuli väliin: kuninkaan verho

Tämä työ alkoi ennen kuin **kuninkaan verho** (v26.08.10.65) oli
`main`illa, ja yhdistämisessä samaan tiedostoon jäi kaksi koko ruudun väriä.
Ne eivät ole sama mekanismi eikä niistä tehty yhtä, ja perustelu on se sama
jota tässä pelissä on käytetty joka kerta kun kaksi merkkiä on ollut vaarassa
sekaantua: **kaksi samannäköistä "jotain tapahtui" opettaa lukemaan väärää.**

Ero on muoto eikä väri, ja se on nyt portissa: **verho on rengas jonka keskus
jätetään koskematta** (mitattu keskeltä `rgb(128,128,128)`, nurkasta
`rgb(255,171,171)`), **siirto on tasainen** (keskeltä ja nurkasta sama
`rgb(181,136,134)`). Ne myös vastaavat eri kysymyksiin — verho kertoo *kuka
saapui*, siirto *mitä minulle juuri tapahtui* — ja elävät eri tavalla: verho
laskee omat framensa `PostFX`issä, siirto pyydetään joka framella uudestaan.

Kuolema ei välähdä. Sillä on jo oma kuvansa — musiikki lakkaa, keho kaartuu
ruudun alle — ja välähdys olisi siinä toinen merkki asiasta josta ei ole
epäselvyyttä. Välähdys on nimenomaan sen osuman merkki jonka jälkeen peli
jatkuu.

---

## v26.08.13.83 — pilvi joka keinui lattian sisään, ja portti joka näki sen joka toinen kerta

Portti oli punaisella `main`illa: *7-P: 1 vihollista seinän sisällä —
StinkCloud@17,42*. Vika tuli 7-P:n mukana (#67) eikä vaikeustasoista (#68), ja
se oli **satunnainen** — mikä on tässä koko juttu.

### Merkki ei ole ruutu vaan kaistan keskiviiva

Ruskea pilvi on 14 px korkea ja keinuu ±14 px merkkinsä ympärillä, ja keinun
vaihe arvotaan `Math.random()`illa oliota luotaessa. Merkki ei siis kerro mihin
ruutuun pilvi jää vaan minkä kaistan ympärillä se liikkuu, ja runko yltää
alimmillaan 14 + 14 − 1 = 27 px merkkiruudun yläreunasta alaspäin — kokonaisen
laatan merkkiä syvemmälle.

7-P:ssä pilvi oli rivillä 42 ja lattia rivillä 43, joten se syntyi lattian
sisään aina kun arvottu vaihe osui alaspäin: noin 43 % ajoista, erikseen joka
vaikeustasolla. Siksi samassa ajossa HELPPO ja NORMAALI kaatuivat ja VAIKEA meni
läpi. **Portti näki vian mutta vain kolikonheitolla**, ja satunnaisesti näkevä
portti opettaa ajamaan uudestaan — se on pahempi kuin vika jonka se näkee aina.

### Kolme muutosta, ja vain yksi niistä on se kenttä

**Pilvi siirtyi riville 41.** Se on pienin siirto joka vie keinun kokonaan
lattian yläpuolelle, ja pienin on tässä tarkoitus eikä laiskuus: pienimmän kehon
laatikko on rivillä 42, joten pilvi on yhä tiellä keinunsa alalaidassa ja
alitettavissa sen ylälaidassa. Kohtaaminen terassin kuiluhypyn jälkeen säilyy —
se muuttui väistämättömästä luettavaksi. Rivi 40 olisi poistanut sen kokonaan.

**`checkEnemyFooting` sai oman peilikuvansa** (`src/data/rules.js`): kävelijä
tarvitsee alleen kiinteän laatan, keinuja tarvitsee alleen tyhjän.
`STINK_BOB_ROWS` on kopio kahdesta moottorin luvusta samassa idiomissa kuin
`BEAN_BLOCK_OVER_FLOOR` — validaattori ei tuo olioita — ja portti vertaa kopiota
alkuperäiseen.

**Portti mittaa nyt sen mitä sääntö väittää.** Se ajaa pilveä 300 framea eli yli
kaksi kokonaista keinukierrosta kahdeksalla eri arvotulla vaiheella ja katsoo
mihin alimpaan ruutuun runko koskee. Keinun tai korkeuden kasvattaminen kaataa
portin ja kertoo uuden luvun sen sijaan että sääntö jäisi hiljaa kattamaan liian
vähän. Lisäksi koekenttäpari yhden rivin erolla: rivillä 11 puhdas, rivillä 12
raportoidaan — se yhden rivin ero **on** koko sääntö, ja sääntö jota on koeteltu
vain laukeamalla ei ole koeteltu.

### Mikä tarkistettiin eikä oletettu

Kaikki pelin **697 `r`-merkkiä** käytiin läpi jokaisella kolmella
vaikeustasolla: 7-P oli ainoa rikkoja, ja jokaisella muulla pilvellä on
vähintään neljä laattaa ilmaa allaan. Uusi sääntö ei siis kiristä mitään mikä on
jo olemassa. `src/data/difficulty.js` ei muuttunut — 7-P on yhä 293,0, koska
mittari ei painota vihollisen riviä — joten kannettu taulukko ei vanhentunut
tästä.

## v26.08.12.82 — kolme vaikeustasoa, ja häntä joka rikkoo tiilen

Omistaja juoksi **kolme ensimmäistä maailmaa läpi kuolematta kertaakaan**. Se on
mittaus eikä mielipide, ja siitä seurasi tämä erä: nykyinen viritys on nyt
HELPPO, ja sen rinnalle tuli kaksi tasoa jotka pitävät pelin auki pidempään.

### Vaikeustasot: sama peli kolmessa mitassa

| Taso | Pituus | Vihollisia | Kello |
| --- | --- | --- | --- |
| HELPPO | kuten ennen | kuten ennen | kuten ennen |
| NORMAALI | 2,03x | 2,84x | pituuden mukana |
| VAIKEA | 3,01x | 4,70x | pituuden mukana |

**HELPPO on merkilleen se peli joka datatiedostoissa lukee** — `scaleLevel`
palauttaa alkuperäisen määrittelyn samana oliona eikä `src/data/scale.js`:ää
edes ajeta. Se on ehto eikä tyylivalinta: `src/data/difficulty.js`,
`tools/curriculum.mjs`, `tools/variety.mjs` ja jokainen portin 60 kentän kierros
on mitattu siitä kentästä, ja jos oletustaso poikkeaisi siitä yhdenkin merkin
verran, jokainen niistä luvuista olisi mitattu kentästä jota kukaan ei pelaa.
Portti vertaa rivi riviltä.

Pidempi kenttä **toistaa omia tahtejaan**. Ruudukosta etsitään sarakkeet joissa
on pelkkää maata ja tyhjää, ja sauma sallitaan vain kohdassa jossa kaksi
peräkkäistä sellaista saraketta ovat merkilleen samat — silloin jokainen liitos
asettaa vierekkäin sarakeparin joka on alkuperäisessä kentässä jo vierekkäin, ja
liitoskohtaan ei voi syntyä seinää, kuilua, puolikasta putkea eikä katkennutta
lauttaa. Ja koska ehto koskee koko saraketta **kaikissa kaistoissa**, sauma ei
voi osua salaiseen huoneeseen eikä sen ja sinne vievän varren väliin: 1-2:n
taivastarha ja sen papuvarsi siirtyvät aina yhtenä palana.

Uutta maastoa ei generoida, vaikka generaattori on olemassa. Käsintehdyn kentän
jatkaminen arvotulla maastolla tekisi siitä kaksi kenttää joilla on sama nimi.

**Sauman toinen ehto löytyi punaisesta, ja se on tämän erän tärkein rivi.**
Sääntö oli aluksi pelkkä "kaksi peräkkäistä samanlaista maasaraketta", mikä
riittää laattojen jatkuvuuteen — ja `validateLevel` sanoi jokaisen kentän olevan
kunnossa jokaisella tasolla. `node tools/playable.mjs --mode hard` oli eri
mieltä: **viisi kenttää joissa botti ei enää päässyt läpi voimatasolla 0.**
7-3 oli selvin. Sen rytmi on 43 saraketta lattiaa ja viiden sarakkeen kuilu, ja
ehjä liitos pani kuilun eteen viisi saraketta vauhdinottoa 43:n sijaan. Kuilu oli
yhä hyppybudjetin sisällä, ja juuri siksi validaattori vaikeni: se mittaa kuilun
leveyden eikä sitä paljonko vauhtia sen eteen mahtuu.

Sauma vaatii siis nyt myös **kuusi saraketta samaa maastoa kumpaankin suuntaan**,
ja maasto luetaan kaistan alimmasta viidestä rivistä eikä koko sarakkeesta.
Sekin ero on mitattu: koko sarakkeella yksikään kentän 64:stä ei venynyt
lainkaan, koska kahdentoista sarakkeen mittaista tyhjää taivasta ei ole missään —
ja yläpuolinen kolikkorivi ei hidasta juoksijaa. Viholliset luetaan tyhjänä
samasta syystä: maasto on sama maasto seisoi sen päällä kuka tahansa.

Molemmat venytetyt tasot ajetaan nyt sen läpi mistä vika löytyi: `--mode hard`
ja `--mode normal`, jokainen 64 kenttää, **jokainen läpi pienimmällä koolla**.
Kolme linnakekäytävää (6-F, 7-F, 8-5) ei veny lainkaan — niissä ei ole
kahtatoista saraketta samaa maastoa ennen areenaa — ja ne saavat silti lisää
vihollisia. Se kirjataan tähän sen sijaan että väännettäisiin sääntöä kolmen
kentän takia.

Neljä rajausta, kaikki samasta syystä — kenttä saa pidentyä, ei muuttua toiseksi
kentäksi:

- **Avausneljännestä ei toisteta.** Se on se osa joka opettaa, ja se on myös se
  osa jossa validaattori vaatii tehostuksen olevan; kun mikään sitä ennen ei
  liiku, tehostus on yhä siellä missä sääntö sen vaatii — myös uudessa,
  pidemmässä neljänneksessä.
- **Ainutkertaista ei monisteta**: aloitusruutu, lipputanko, pomo, ovi, kytkin,
  papuvarsi, lämpöputken suu, tähtilaatta, vihainen aurinko, kuu ja
  papuparooni. Kumpi kuuluu listalle on **laskettu eikä arvattu** — ja se
  maksoi kerran: närästys oli listalla set piecenä, ja 2-F ei siksi voinut
  toistaa itsestään yhtään pätkää, koska siinä on yksitoista liekkiä.
- **Järjestys ei muutu.** Sekoittaminen olisi ollut vaihtelevampaa ja se olisi
  rikkonut sen mikä kentässä on kertomusta: vaikeus kasvaa vasemmalta oikealle.
- **Kiipeilykentät (6-K, 7-T) eivät veny.** Ne ovat säännön mukaan tasan yhden
  ruudun levyisiä ja niiden akseli on toinen.

Lisäviholliset ovat **niitä lajeja jotka kentässä jo ovat**, joten tämä lisää
ruumiita eikä sanastoa: kenttä jonka lukemisen pelaaja on opetettu pysyy
kenttänä jonka lukemisen hän on opetettu, ja `tools/curriculum.mjs`:n vastaus
ensiesittelyistä pysyy totena joka tasolla. Paikan ehdot ovat samat jotka
kenttädatassakin kelpaisivat: tyhjä ruutu, kiinteä maa alla ja sen molemmin
puolin, kaksi tyhjää riviä yllä, kuusi laattaa väliä lähimpään toiseen, eikä
lähtöruudun, maalin tai pomoareenan tuntumassa. Arvonta on siemenetty kentän
tunnuksesta ja tason nimestä — tilatallennus, salaisuuslaskuri ja aika-ajon
ennätykset kaikki olettavat että kenttä on eilen sama kuin tänään.

Kolme asiaa jotka seurasivat ja jotka olisi voinut unohtaa:

- **Kello venyy pituuden mukana**, katto 999 aikayksikköä — suurin luku joka
  mahtuu HUD-nauhan kolmeen numeroon, eli nauhaa ei tarvinnut koskea. Mitattu
  ettei se ole tiukka: pisin VAIKEA kenttä vaatii 0,82 px/frame keskinopeuden,
  kun juoksuvauhti on 2,5.
- **Aika-ajon ennätys tuntee radan.** NORMAALIn 2-3 on kaksi kertaa pidempi rata
  kuin HELPON 2-3, ja sama avain niille tarkoittaisi että toisella tasolla
  ajettu aika voittaa toisella ajetun. HELPPO pitää paljaan tunnuksen, jotta jo
  ajetut ajat ovat yhä omistajansa.
- **Päivän pieru ei veny.** Yksi yritys päivässä ja sama kenttä kaikille on eri
  lupaus kuin vaikeustaso, eikä sitä lupausta voi pitää kolmessa eri
  pituudessa. Ajossa rekisteröity kenttä on nyt omassa taulussaan eikä
  kenttävälimuistissa — samassa taulussa HELPOLLA kerran rakennettu kenttä olisi
  vastannut myös NORMAALIn kyselyyn.

Valinta on **oma ruutunsa** eikä alkuruudun kuudes rivi: viisi riviä on siellä
mitattu maksimi (`tools/verify.mjs` piirtää alkuruudun 280 px korkealle
alustalle), ja tärkeämpi peruste on se mikä valinta on — vaikeustaso on osa
kierrosta, se kulkee tallennuksen mukana, ja JATKA PELIÄ jatkaa sitä kierrosta
kysymättä uudestaan. `newGame()` tarkoittaa yhä "aloita kierros nyt".

### Häntäisku rikkoo tiilen kyljestä, maahanisku jalkojen alta

Häntä oli tähän asti pelkkä ase: se kaatoi vihollisen ja lensi seinän läpi kuin
sitä ei olisi. Nyt se on kolmas tapa rikkoa tiili päänpuskun ja potkaistun
kuoren jälkeen, ja **maahanisku on neljäs** — voimatasolla 3 ja pudotuksella
joka on vähintään puolet huoneesta, eli tasan sillä rajalla jolla isku muuttuu
kaadosta tapoksi. Yksi raja eikä kaksi: "tämä isku oli tosissaan" on yksi asia
ja pelaajan pitää pystyä oppimaan se kerran.

Voimataso on tässä poikkeus, ja se on kirjoitettu poikkeuksena eikä pujahtanut
sisään: maahaniskun oma lupaus on "voimataso vain vahvistaa". Lattian rikkominen
on ainoa asia jonka se avaa, ja se on omistajan pyyntö ("at least when the
character is sufficiently powered up") — ja myös ainoa luenta joka estää liikettä
korvaamasta häntää ja puskua, jotka molemmat ovat tehostuksia jotka pitää käydä
hakemassa.

Sopimus siitä **mikä tiili on rikottava** on nyt yksi metodi
(`LevelScene.burstBricks`) eikä neljä kopiota: vain `B`, eikä `B` joka piilottaa
jotain. Neljä kopiota olisi neljä tapaa olla eri mieltä, ja se erimielisyys
näkyisi pelaajalle vasta siinä että yksi liike söi salaisuuden jonka toinen
jätti.

Hännälle tuli oma laatikkonsa tiiliä varten (`tailBox`) eikä vihollisten
`spinBox`ia levennetty: `spinBox` on tarkoituksella vartalon alempi 60 %, mikä
on oikein lattialla seisovalle otukselle ja väärin tiiliseinälle — mitattuna se
kattaa `brick_wall`in neljästä rivistä tasan yhden, eli häntä olisi purkanut
seinää yksi tiili per pyörähdys ja lukenut vialta. Laatikon leventäminen olisi
samalla leventänyt sitä mitä häntä *tappaa*, eli tasapainomuutos tiilimuutoksen
sisään piilotettuna.

### Ja yksi vika joka löytyi matkan varrelta

`tools/playable.mjs --frames 9000` ei ole koskaan toiminut. Kenttätunnus
luetaan ensimmäisestä paljaasta argumentista, ja `9000` on paljas argumentti —
työkalu kaatui lauseeseen `unknown level: 9000`, ja sama olisi tapahtunut
`--mode hard`ille. Lipun arvot ovat nyt listalla nimeltä (`VALUE_FLAGS`), jotta
seuraavan lipun lisääjä joutuu sanomaan kumpaa lajia se on.

### Portti

Uudet väitteet: HELPPO merkilleen datatiedosto; jokainen kenttä jokaisella
tasolla sääntöjen mukainen, yksi aloitusruutu, yksi uloskäynti, kello nauhaan
mahtuva, kiipeily venymätön, aloitus ei kiinteän laatan sisällä eikä yhtään
vihollista seinän sisällä (192 kenttää); venytys osuu luvattuun pituuteen ±10 %;
vihollisia tulee **tiheämpään** eikä vain pidemmälle matkalle. Mekaniikoista:
maahanisku rikkoo tiilen vain korkealta ja vain kyllin vahvana, häntä rikkoo
sen siltä puolelta jonne se osoittaa eikä toiselta, eikä kumpikaan riko tiiltä
joka piilottaa jotain. Koekenttien tiilirivi etsitään `brickSecret`illä eikä
valita silmällä — muuten kokeen tulos riippuisi siitä mihin kohtaan ruudukkoa se
sattui kirjoittamaan.

---

## v26.08.11.82 — 7-P POLVI, se kenttä joka kääntyy

Omistaja pyysi tätä näillä sanoilla: *"voisimmeko tehdä kentän, jossa on sekä
vaaka- että pystysuuntaista liikettä, vuorotellen? ensin mennään oikealle,
sitten ylös, sitten oikealle, sitten alas."* Kameran puoli siitä toimitettiin
edellisessä erässä; nyt on kenttä.

`7-P POLVI` on 80×45 ruudukkoa neljässä osiossa — terassi, nousu, harjanne,
kuilu — ja se korvaa generoidun `7-7`:n maailman seitsemäntenä kenttänä. Käänne
ei ole sauma vaan sivunvaihdon lyönti: sama beat jonka pystykenttä jo omisti.

### Validaattori joka ei osannut hylätä, ja se huomattiin koekappaleella

Ensimmäinen versio osiotarkastuksesta palautti *ei ongelmia* ruudukolle josta
oli poistettu yksi nousun puola. Syy: pystypalassa ei ole aloitusmerkkiä eikä
lippua, joten kulkukelpoisuustarkastus palasi heti — **sääntö joka ei voi
laueta**, sama vika kuin edellisen erän tallennusportissa ja yhtä hyvin
piilossa.

Korjaus on kaksiosainen. Reitti kysytään **koko ruudukosta** eikä palasta,
koska osioidun kentän vika asuu saumassa: pala kerrallaan kaikki neljä voivat
olla moitteettomia ja kenttä silti pelaamaton. Ja pala saa säännöiltä puuttuvat
kaksi lukuaan naapureiltaan — tulo- ja lähtörivin — jolloin `checkClimbTraverse`
ja umpiperäsääntö toimivat siinä samoin kuin kokonaisessa kiipeilykentässä.

Koekappaleita on nyt viisi ja jokainen on rikottu toimitetusta kentästä:
puuttuva puola, reikä nousun lattiassa, tikapuusarake, vajaa osiointi, puuttuva
tehostus. Kaikki hylätään; ehjä menee läpi.

### Kaista ja suunta johdetaan, eivät ole kenttädatassa

Osio ilmoittaa vain kaksi asiaa: mihin sarakkeeseen se loppuu ja onko se
pystysuuntainen. Kaikki muu — mitkä viisitoista riviä vaakaosio asuu, mille
riville pystyosioon saavutaan, kuinka pitkä matka osio on — luetaan ruudukosta
yhdessä paikassa (`segmentSlices`), ja **sekä säännöstö että vaikeusmittari
lukevat sen sieltä**. Ensimmäinen versio otti kaistan `bandTop`-kentästä, mikä
olisi ollut seitsemäs kerta tässä projektissa jolloin käsin ylläpidetty kopio
jostakin luettavissa olevasta vanhenee äänettömästi.

Vaikeusmittari mittaa osiot erikseen ja painottaa matkalla: vaakaosion
sarakkeet ja pystyosion rivit ovat sama valuutta, koska molemmat mittarit ovat
"sataa yksikköä kohti". Yhtenä kaistana luettuna kolme neljäsosaa kentästä
olisi raportoitu pohjattomana kuiluna. `7-P` mittaa **293,0**, eli maailman
seitsemäs kenttä on sen kovin ennen linnaketta (294,6).

### Kiipeilijä ei tuntenut kuilua, ja se oli botin vika eikä kentän

`isClimb` tuntee nyt osioidun kentän, koska oikealle juokseva botti kävelee
nousun juurelle ja raportoi kentän loppuneen sinne. Ensimmäinen ajo kuoli silti
framella 138 sarakkeessa 14 — ensimmäiseen reikään.

Syy oli verkossa: `climbGraph` antaa samantasoisten tasanteiden välille kaaren
ilman ehtoja, ja kiipeilykentässä se on oikein, koska siellä "samalla tasolla ja
vieressä" tarkoittaa käytännössä samaa lattiaa. Vaakaosiossa se ei tarkoita.
Ponnistus lähtee nyt myös reunalta kun kohde on samalla rivillä mutta eri
tasanne — ja **vain silloin**, koska kaivautumiskentässä reunan yli
käveleminen on se tapa jolla edetään. Ajo: läpi voimatasolla 0, 2983 framea,
11 sivunvaihtoa.

### Ja yksi velka maksettiin sivutuotteena

`gen-levels.mjs`:ssä luki että maailman 7 tiheysrivin ylin luku 10,1 oli
poistuneen `7-2`:n perua eikä enää maailman omalta väliltä, mutta ettei sitä
lasketa alas koska se generoisi toimitetun kentän uudelleen. Se kenttä oli
`7-7`, ja sen paikalla on nyt `7-P` — joten rivi on poissa eikä yhdenkään
jäljellä olevan kentän tavu liikahtanut.

---

## v26.08.11.81 — portti joka ei voinut kaatua, ja seitsemän muuta

Toinen katselmointikierros, ja sen tärkein löydös oli edellisen kierroksen
korjaus.

### Portti oli kirjoitettu kiinni ottamaan tasan se vika jonka se päästi läpi

`write → load` -kierrostesti vertasi `Save.load()`in tulosta — ja `load`
levittää `DEFAULT_SAVE()`n ensin, joten `write`istä pudonnut avain täyttyy
oletuksella eikä lue koskaan `undefined`ina. **Portti ei voinut kaatua.**
Poistin `doors`-rivin `write`istä kokeeksi ja se meni läpi.

Se on huonompi kuin ei porttia lainkaan, koska se näyttää katetulta. Testi
lukee nyt raa'an `localStorage`in, ja kokeiltu rikkinäisellä syötteellä:
`katosi: doors`.

### Kaksi sääntöä jotka erosivat rungon säännöstä

- **Raajan katkaisu ei tarkistanut asentoa.** Pelkkä `fallVy > 0` antoi
  ilmaisen pompun ja katkaisun myös kyljestä osuvasta kosketuksesta, kun sama
  kosketus vartaloon maksoi osuman. Nyt sama jalat-yllä-ehto kuin rungolla.
- **Ja vaihe erosi:** raaja käytti `spikePhase === 'open'`, runko `!spiky`.
  Telegraph-vaiheessa vartalo oli tallottavissa mutta raaja satutti — tasan
  päinvastoin kuin sen yläpuolella lukeva lause "kruunu pois: kaikki on
  tallottavissa".

### Ja neljä muuta

- **Kannen saavutettavuus mitattiin summana eikä askelmana**, joten portti olisi
  hyväksynyt 112 px korkean kannen jonka alla ei ole mitään — ja 112 px on
  enemmän kuin 100 px juoksuhyppy. Se on tasan se "kannet olivat lavasteita"
  -areena jonka portti sanoo estävänsä.
- **Kannettoman korkean pomon kohdalla portti kaatui** koko `page.evaluate`n
  mukana, eli yksi puuttuva kansi olisi vienyt jokaisen muun tuloksen.
- **Pikatallennuksen `vertical`-korjaus luki pelaajaa riviä ennen sen
  sijoitusta**, eli johti osion aloituspaikasta: no-op joka jätti juuri sen
  turhan sivunvaihdon jonka se lupasi estää.
- **Käänteen lähtölinja oli `camPageY`**, jota vain pystykamera ylläpitää —
  vaakaosiosta tultaessa satoja pikseleitä vanha, eli kuva olisi napsahtanut.
- **Taukovalikko väitti `(TYHJÄ)` siitä mitä se itse oli juuri tallentanut.**

---

## v26.08.11.80 — katselmointi löysi kaksi asiaa jotka olisivat menneet tuotantoon

### Ovi ei tallentunut lainkaan

`doors` lisättiin `DEFAULT_SAVE`en muttei `Save.write`in käsin kirjoitettuun
kenttälistaan. Ovi toimi siis istunnon sisällä ja katosi jokaisesta
latauksesta — ominaisuus joka on olemassa vain kunnes välilehti suljetaan.

**Kuudes kerta tässä erässä samalle vialle:** kaksi paikkaa jotka kuvaavat
samaa muotoa, ja vain toinen päivittyy. Portti vertaa nyt `DEFAULT_SAVE`n
avaimia siihen mitä `write` → `load` palauttaa.

### Ja kaksi pomoa kasvoi kannettoman areenan sisällä

Korkeudet nostettiin varianteille 1 ja 5 olettaen että ne tappelevat
`boss_arena_big`issa. Maailmassa 8 on **jokainen pomo**, ja `8-2` (variantti 1)
ja `8-7` (variantti 5) käyttivät kannetonta `boss_arena`a. Ne olisivat olleet
voittamattomia voimatasolla 0.

Portti ei nähnyt sitä, koska `BOSS_LEVELS` oli käsin kirjoitettu lista joka
pysähtyi `7-F`:ään — eli maailman 8 seitsemän pomokenttää olivat jokaisen
pomoportin ulkopuolella. Lista luetaan nyt kenttädatasta.

8-7:n pituus piti kompensoida kahdella lisäpalikalla, koska isompi areena
laimensi sen alle 8-6:n ja teki maailmaan kolmannen notkon. Ensimmäinen yritys
**poisti** palikan ja laski vaikeutta lisää — `fort_gap` on kuilu, eli vaikea.

### Neljä pienempää

- **Ovi ei ollut linnakekohtainen** vaan `def.boss`-kohtainen, ja maailmassa 8
  jokainen kenttä on pomokenttä: ovi olisi ohittanut ~144 saraketta tavallista
  kenttää. Ehto on nyt linnaketunnus.
- **Ovi ei ollut poissa aika-ajosta.** Uusinta olisi alkanut pomon vierestä ja
  kirjoittanut kentän rehellisen ennätyksen yli kymmenen sekunnin ajalla.
- **`deckAbove` hyväksyi areenan seinäpilarit kanneksi**, joten kansiportti
  löysi "kannen" myös sieltä missä kantta ei ole. Kansi on `isSemi`, ei mikä
  tahansa kiinteä ruutu — ja korkean pomon talloportti asetti pelaajan
  kannen korkeudelle *pomon viereen*, eli ilmaan. Kolmas kerta tässä erässä
  sille että itse asetettu koe asettaa kappaleen paikkaan jota ei ole.
- **Taukovalikko luki tallennuspaikan joka framella** (`readSlot` jäsentää koko
  tilannekuvan) yhden `(TYHJÄ)`-sulkulausekkeen takia, ja **kursori muisti
  valintansa**: START+hyppy olisi ollut vahvistamaton pikalataus.

---

## v26.08.11.79 — kamera osaa kääntyä, ja käänne on sivunvaihdon lyönti

Kysymys oli kentästä jossa mennään vuorotellen oikealle ja ylös. Se ei ole
kenttä vaan **kolmas kameratila**, koska nykyiset kaksi puhuvat tarkoituksella
vastakkaista kieltä:

| | leveys | kameran kieli |
| --- | --- | --- |
| vaakakenttä | monta ruutua | pehmeä seuranta, liikkuu koko ajan |
| pystykenttä | tasan 20 saraketta | seisoo paikallaan ja **leikkaa** |

Jos ne vain yhdistäisi, tulos olisi kamera joka liukuu sivulle ja nykii ylös —
rikkinäinen eikä tyylikäs.

Kenttä ilmoittaa siis osionsa (`segments`), ja **käänne saa sen beatin joka
pystykentillä jo on**: kello ja viholliset seisovat, musiikki ei. Se ele on jo
maksettu ja jo pyydetty, joten käänteestä tulee tapahtuma eikä saumaa, ja
kumpikin kieli säilyy omanaan.

**Ja osioitu kenttä ei ole kaistoitettu.** Kaistat ovat kolme erillistä
huonetta joiden välillä kamera ei saa nähdä, mikä on oikein salaisuudelle ja
väärin reitille: osioidussa kentässä ylös meneminen *on* reitti, ja
kaistarajaus olisi pysäyttänyt kameran ensimmäiseen saumaan. Sama haara kuin
kiipeilykentällä, samasta syystä.

### Mitä tässä ei ole

**Valmista kenttää.** Koneisto on olemassa ja portti todistaa käänteen
synteettisellä kentällä, mutta suunniteltu kenttä on sisältötyötä joka
ansaitsee oman erän: validaattorin säännöt, vaikeusmittari ja molemmat botit
on ajettava **osio kerrallaan**, ja se on se työ jonka osiointi tekee
mahdolliseksi mutta ei tee itse. Puolivalmis kenttä olisi huonompi kuin ei
kenttää.

---

## v26.08.11.78 — raaja katkeaa, ja kruunu vastaa koko koosteesta

Raajoilla oli osumalaatikko; nyt niillä on myös **kohtalo**. Avoimen ikkunan
aikana päältä tuleva katkaisee raajan pysyvästi, ja katkennut vie mukanaan oman
vahinkoalueensa — loppufight on sen verran turvallisempi.

### Yksi merkki, yksi vastaus

Kruunu vastaa **koko koosteesta** eikä pelkästä rungosta: päällä ollessaan
mihinkään ei saa koskea, pois ollessaan kaikki on tallottavissa. Siksi raajalla
ei ole omaa varoitustaan — kruunusääntö ostettiin aikoinaan playtestillä jossa
pelaajat eivät ehtineet erottaa kahta piikkiriviä toisistaan, eikä sitä makseta
uudelleen.

Valinta on siis ikkunan **sisällä**: runko maksaa osuman, raaja katkeaa. Se on
vaihtokauppa eikä arvoitus.

**Ja raaja ei ole koskaan pakollinen.** DESIGN.md kohta 5 lupaa että pomon voi
kaataa voimatasolla 0, ja talloportti todistaa sen käymällä jokaisen pomon läpi
pelkkää runkoa tallomalla. Katkaisu on oikotie, ei lukko.

`brokenLimbs` on **bittimaski eikä `Set`**, koska pikatallennus sarjallistaa
jokaisen oman kentän: `Set` katoaisi hiljaa tyhjäksi olioksi ja pelaaja saisi
rikkomansa nyrkit takaisin latauksesta.

### Kaksi omaa mittausvirhettä, molemmat uskottavia

- **Vanha raajatesti alkoi mitata väärää asiaa** sillä hetkellä kun katkaisu
  tuli: se seisotti pelaajaa raajassa ja vaati osumaa, mutta kruunu pois päältä
  sama kosketus katkaisee eikä satuta. Testi ajaa nyt kruunu päällä.
- **Molemmat vaiheet ajettiin samassa kohtauksessa.** Piikkivaiheen kosketus
  tappaa voimatason 0 pelaajan, kohtaus siirtyy tilaan `dead`, eikä
  `collisions` enää aja lainkaan — joten avoimen ikkunan koe ei mitannut
  katkaisua vaan kuollutta kohtausta, ja epäonnistuminen näytti aidolta.
  Kumpikin vaihe saa nyt oman kohtauksensa.

Kolmas kerta tässä erässä sille että itse asetettu koe asettaa kappaleen
paikkaan jota pelissä ei ole.

---

## v26.08.11.77 — raajat, ja laatikko joka lupasi vahinkoa ilman piirrosta

NES-sprite oli 8x8 tai 8x16, kahdeksan juovaa kohti ja 64 ruudulla, joten pomo
**ei koskaan ollut yksi piirros** vaan metasprite. Ja kun pomo on jo osista,
yhden osan liikuttaminen omalla kellollaan on ilmaista — sieltä tulevat
ketjunyrkit ja jaksotetut selkärangat. Rajoite synnytti idiomin.

Meillä ei ole sitä rajoitetta, ja noudatimme hiljaa pahempaa: `BOSS_SIZES` oli
sekä osumalaatikko **että** piirros, joten mikään ei voinut ulottua itsensä
ulkopuolelle. Nyt `BOSS_LIMBS` on eri taulukko ja saa ulottua minne tahansa.

Mitattu läsnäolo, ilman että tallottava laatikko kasvaa pikseliäkään:

| | 1-F | 2-F | 3-F | 4-F/5-F | 6-F | 7-F |
| --- | --- | --- | --- | --- | --- | --- |
| kasvu | 1,37× | 1,47× | 1,69× | 1,70× | **2,75×** | 1,59× |

Kolme sääntöä, kaikki portissa: **raaja satuttaa** (piirretty raaja jonka läpi
kävelee on sama valhe kuin piikki joka ei satuta), **raaja ei tule
laskeutumiskaistalle** (pään yläpuolinen sarake on kruunun, ja sillä saa olla
yksi vastaus), ja **raaja kasvattaa läsnäoloa** vähintään 1,2× tai se on
koriste jolla on kello.

### Ja neljäs sääntö, jonka kuvalevy paljasti ja portti ei

Ensimmäinen versio mittasi **laatikoita eikä pikseleitä**, ja päästi läpi tasan
sen mitä sillä tavalla pääsee: nyrkkeilijä piirretään omalla funktiollaan eikä
`drawStandardBoss`in kautta, joten hänellä oli **raajan osumalaatikko ilman
raajaa**. Vahinko tyhjästä on sama valhe kuin raaja jonka läpi kävelee, vain
toisin päin.

Portti piirtää nyt pomon ja vaatii että jokaisessa raajalaatikossa on
pikseleitä. Laatikko ja piirros ovat kaksi eri asiaa, joten ne mitataan
kahdesti — sama läksy kuin koko erän ajan.

---

## v26.08.11.76 — kansi nostaa katon, ja katto on nyt nimetty luku

52 px oli se korkeus jonka yli voimataso 0 pääsee **areenan lattialta**, ja
kolme asiaa oli liimattu siihen yhteen lukuun. Yksi niistä irtoaa tässä.

`FLOOR_REACH` on nyt nimetty vakio, ja sääntö kuuluu: sen **alle** jäävä pomo
luvataan tallottavaksi lattialta, sen **ylittävä** kannelta. Lupaus ei
heikkene vaan vaihtaa reittiä, ja portti vaatii korkealta pomolta areenan
jossa on kansi, kannen pomon pään yläpuolella ja kannen jolle pääsee
lattialta kahdella paikaltaan hypyllä.

| pomo | ennen | nyt | areena |
| --- | --- | --- | --- |
| 1 jyskyttäjä | 56×48 | **60×80** | `boss_arena_big` |
| 5 sääherra | 68×46 | **68×88** | `boss_arena_big` |

Kummallekin vaihdettiin areena eikä keksitty uutta: `boss_arena_big` osaa jo
reitin lattia 208 → askelma rivillä 9 (64 px) → kansi rivillä 6 (48 px).
Suoraan lattialta kannelle olisi 112 px eikä 100 px juoksuhyppy riitä — juuri
se teki kansista aikoinaan lavasteita.

### Ja korkeuden nostaminen ei ole yhden luvun muutos

Ensimmäinen yritys nosti vain luvut, ja tulos oli **32 px tyhjää
osumalaatikkoa jyskyttäjän jalkojen alla**: piirros oli 48 px korkea
laatikossa joka on 80. Pelaaja olisi ottanut osuman ilmasta.

Molemmat rungot on siis piirretty uusiksi siihen laatikkoon. Ylimääräinen
korkeus meni jyskyttäjällä **jalkoihin**, koska hän on se joka laskeutuu
päällesi, ja sääherralla **höyryyn**, koska hän on se joka ei seiso missään.
Sääherran ääriviiva ei käänny kertaakaan 88 pikselin matkalla, mikä on
paljon vaikeampi lupaus kuin 46:lla ja siksi vahvempi siluetti.

Siluettien erillisyys parani sivutuotteena: pahin pari 0,547 → **0,521**.

---

## v26.08.11.75 — turvaverkko oli olemassa vain näppäimistöllä

Taukoruudussa luki `1 TALLENNA  2 LATAA  3 PAIKKA n`, ja se on ohje eikä
käyttöliittymä. `input.js` pitää apunäppäimet **tarkoituksella** poissa
ohjaimelta ("a pad plays the game; a keyboard also administers it"), eikä
kosketusohjaimessa ole niille paikkaa lainkaan.

Peli siis tarjosi pikatallennuksen — joka on *vahvempi* kuin mikään välipiste,
koska sen saa mihin tahansa — vain yhdelle kolmesta ohjaustavasta. Se on
oikea vika, ja se on eri vika kuin "kentät ovat pitkiä": mitattuna kenttä on
31 s eikä kaipaa välipistettä, mutta puhelimella pelaavalla ei ollut mitään.

Tauko on nyt valikko: **ylös/alas valitsee, hyppy vahvistaa** — ainoat napit
jotka ovat kaikilla kolmella ohjaustavalla. Vanhat näppäimet toimivat yhä;
valikko on lisäys niille joilla ei ole näppäimistöä eikä korvaaja niille
joilla on.

Aika-ajossa listalla ei ole tallennusta eikä latausta, ja se on sama päätös
kuin ennenkin: kello käy tauon yli, joten ladattu tila tekisi ajasta väitteen
jota kukaan ei ole juossut.

---

## v26.08.11.74 — linnakkeen ovi, ja portti joka piti omaa kopiotaan tallennuksesta

Kysymys oli "pitäisikö kenttiin lisätä välipisteitä". Mitattuna vastaus oli ei,
mutta mittaus osoitti toiseen suuntaan kuin odotin.

### Pituus ei ole ongelma, toisto on

Parhaan mahdollisen juoksun mitta, ilman hyppyjä ja vihollisia:

| | paras tapaus |
| --- | --- |
| keskimääräinen kenttä | 31 s |
| pisin (3-2, 1-2, 3-3) | 41–43 s |
| linnakkeen käytävä | 19–24 s |

Välipiste säästäisi 15–30 s, mikä ei yksin oikeuta uutta mekaniikkaa — SMB3:ssa
ei ole välipisteitä juuri siksi ettei tämänmittainen kenttä niitä tarvitse.

**Mutta linnakkeen käytävä kävellään uudelleen joka kerta kun pomo voittaa**, ja
se on pelin toistetuin matka. Ero ei ole pituus vaan toisto, ja siksi ovi on
vain linnakkeissa.

Kuolema vie karttaruutuun eikä suoraan takaisin kenttään, joten ovi ei ole
"kentän sisäinen tarkistuspiste" vaan **se kohta josta kenttä alkaa kun siihen
astuu uudelleen**. Siksi se on tallennuksessa (`doors`) eikä kohtauksen
muistissa. Kello ei nollaudu eikä voimataso palaudu: ovi säästää kävelyn, ei
kenttää, joten aika-ajo ei muutu.

Areenan sarake **lasketaan palikoiden leveyksistä** eikä kirjoiteta kenttädataan
(`arenaColumn`), koska kirjoitettu luku vanhenee heti kun joku lisää palikan
areenan eteen. Tässä erässä on kolme esimerkkiä siitä mitä se maksaa.

### Ja portti piti omaa kopiotaan tallennuksen muodosta

`verify.mjs`:n `reset()` rakensi pelitilan luettelemalla kentät nimeltä. Seuraus
ei ollut kaatuva testi vaan **testi joka ei näe uutta kenttää lainkaan**:
`secrets`, `continues`, `bestTimes` ja nyt `doors` puuttuivat jokaisesta
testistä, ja niitä lukeva koodi sai `undefined`in siellä missä pelaajalla on
`{}`. Tila rakennetaan nyt `DEFAULT_SAVE`sta.

Neljäs kerta tässä erässä samalle läksylle.

### Kaksi omaa virhettä matkan varrella

- **`doorOpen` oli jo varattu** ja tarkoitti *uloskäyntiä* joka aukeaa pomon
  kaaduttua. Kaksi eri ovea samalla nimellä; oma on nyt `arenaReached`.
- **Ovi kirjoitettiin `spawn`iin ennen `scanGrid`iä**, joka lukee aloitusmerkin
  ruudukosta ja kirjoittaa sen yli. Ovi on viimeinen sana eikä ensimmäinen.

---

## v26.08.11.73 — osoite vaihtui, ja sen kopiot eivät olisi kaatuneet mihinkään

Vercel-projekti ja GitHub-repo nimettiin `kaasuvoima`ksi, joten
`sfb3.vercel.app` → `kaasuvoima.vercel.app` ja `github.io/sfb3` →
`github.io/kaasuvoima`.

Koodissa vaihdettavia oli neljä: `index.html`:n `og:url`, `og:image` ja
`twitter:image`, sekä `challenge.js`:n esimerkkiosoite. **`og:url` on niistä
ainoa jolla on ajonaikainen merkitys** — `share.js` lukee juuri sen metatagin
eikä `location.href`:iä, jotta jaettu linkki on aina se osoite jolla on
esikatselukuva.

Ja juuri siksi vika ei olisi ollut siinä tagissa vaan sen **kopioissa**:
README:n pelilinkki, CLAUDE.md:n julkaisuohje ja `challenge.js`:n esimerkki
eivät ole koodia, eivät aja mitään eivätkä siksi kaadu mihinkään. Kaikki kolme
olisivat jääneet osoittamaan kuolleeseen domainiin hiljaa.

Portti vertaa nyt jokaisen kopion `og:url`:n isäntänimeen ja Pages-polun repon
nimeen. Kokeiltu rikkinäisellä syötteellä: README takaisin vanhaan osoitteeseen
→ `README.md: sfb3.vercel.app != kaasuvoima.vercel.app`.

**CHANGELOGin vanha julkaisurivi jätettiin ennalleen.** Se kertoo missä peli
*oli* 8.8.2026, ja historian korjaaminen nykyhetkeen tekisi lokista valheen.

Kolmas kerta tässä erässä samalle läksylle: jakorivi piti omaa kopiotaan pelin
nimestä, talloportti omaa kopiotaan pomon koosta, ja nyt kolme dokumenttia omaa
kopiotaan osoitteesta.

**localStorage-avaimet eivät liiku**, mutta osoitteen vaihtuminen tekee saman
asian toista kautta: `localStorage` on origin-kohtainen, joten
`sfb3.vercel.app`iin tallennettu edistyminen jää sinne. Pages-polun muutos on
turvallinen, koska origin (`ollisulopuisto.github.io`) pysyy samana.

---

## v26.08.11.72 — katselmointi löysi vanhentuvan pikatallennuksen

Erän katselmointi, ja se löysi neljä asiaa joista kolme olivat omia ja yksi
vanha. Kaikki neljä oli helppo tarkistaa mittaamalla, ja kaksi niistä ei ollut
sitä miltä ne ensin näyttivät.

### Vanha pikatallennus toi takaisin vanhan osumalaatikon

Tämä on niistä ainoa oikea vika. `entityToJSON` kopioi jokaisen oman kentän ja
`entityFromJSON` herättää olion **ilman konstruktoria**, joten tallennettu
`w/h/baseW/baseH` palasi sellaisenaan. Niin kauan kuin `BOSS_SIZES` ei
muuttunut, se oli sama asia — ja tässä erässä se muuttui. Ennen päivitystä
otettu pikatallennus herätti pomon **vanhalla osumalaatikolla uuden piirroksen
alla**: 36x52 luuranko jonka päätä ei voi tallata. Tallennusversio on yhä
`v: 1`, joten mikään ei hylännyt sitä.

Korjaus ei ole version nosto — se heittäisi pelaajien pikatallennukset menemään
— vaan `rehydrate()`: olio kertoo mikä sen tilasta on **johdettua** ja johtaa
sen uudelleen purettaessa. Osumalaatikko on johdettu piirroksesta, ei
tallennettu tosiasia.

**Ja ensimmäinen testi tästä oli väärin.** Se vaihtoi tallennukseen vanhan
korkeuden mutta jätti uuden `y`:n, eli väärensi tilan jota ei ole koskaan ollut
olemassa, ja kaatui siihen eikä korjaukseen. Uskottava väärennös on
johdonmukainen: vanha korkeus *ja* sitä vastaava `y`, jalat samalla lattialla.

### Kolme kirjanpitovirhettä

- Portin loppubanneri sanoi yhä `Super Fart Bros 3 — verify`. Nimenvaihdon
  haku oli rajattu `src/`:ään eikä kattanut `tools/`:ia.
- `Boss`-konstruktorin kommentti sanoi että **64 px on katto**, vaikka
  `BOSS_SIZES` sanoo 52 ja kirjaa 64:n yhdeksi niistä kahdesta korkeudesta
  jotka *kaatuivat* portista. Hylättyä luonnosta lainaava kommentti sen vakion
  vieressä joka hylkäsi sen on huonompi kuin ei kommenttia lainkaan.
- ROADMAP väitti että `w / 2 + 25 + h` palauttaa vanhat luvut 30x32:lla. Ei
  palauta: 15 + 25 + 32 = 72 vanhan vakion 40 sijaan. Testi menee silti läpi,
  mutta *"tämä ei muuta vanhaa käytöstä"* on eri väite kuin *"tämä toimii"*.

---

## v26.08.11.71 — pomot piirrettiin siluetti edellä, ja viisi seitsemästä oli päätöntä

Omistaja katsoi kokoja ja sanoi että mittasuhteet ovat yhä pielessä, ja pyysi
tekemään sen oikein päin: **ensin armatuuri ja siluetti, vasta sitten
yksityiskohdat.** Se oli oikea neuvo ja se paljasti vian jota kolme
kokokierrosta ei ollut löytänyt.

### Väri pois, ja kuusi seitsemästä oli huonekalu

Maskeina ne olivat **mäki, veturi, muna, läiskä ja porttikäytävä**. Veturi oli
kirjaimellinen: valtikka seisoi pystyssä matalan takapään päällä, eli savupiipun
paikalla ja savupiipun muotoisena.

Yhteinen vika oli viidessä sama: **päätä ei ollut siluetissa.** Se oli piirretty
vartalon ääriviivan sisään ja merkitty värillä, ja väri on ensimmäinen asia joka
katoaa siltä etäisyydeltä jolta peliä pelataan. Luuranko oli ainoa luettava, ja
ainoa jolla oli kaularako.

### Runkotyyppi on ilmoitus, ja portti mittaa sen

"Jokaisella pomolla pitää olla kaula" olisi tehnyt sääherrasta miehen
pilviasussa ja antanut pöhölle leuan. TAI-ehto joka hyväksyy minkä tahansa
lausekkeen taas hyväksyy kaiken. Siksi **jokainen pomo ilmoittaa itse mikä se
on** (`BOSS_PLANS`), ja portti tarkistaa että se toimitti sen:

| runkotyyppi | kuka | mitä on velkaa |
| --- | --- | --- |
| `figure` | nyrkkeilijä, luuranko, kuningas | kurouma kaulan kohdalla ≥ 1,5 |
| `anvil` | jyskyttäjä | massa **alhaalla**, jalusta ≥ 0,8 leveimmästä, ja silti kaula |
| `quadruped` | syöksyjä | harja yläreunassa ≥ 0,18 |
| `wedge` | sääherra | ääriviiva ei käänny, monotonisuus ≥ 0,78 |
| `blob` | pöhö | ≥ 6 eri leveyttä, eli ääriviiva kaartuu |

Kaksi mittaria kirjoitettiin ensin väärin ja korjattiin mittaamalla:

**Ensimmäinen pään mittari kysyi "onko pää pieni"**, mikä on täsmälleen väärin
päin — haettu mittasuhde on *iso* pää, ja luuranko, seitsemästä paras, sai
nollan koska sen kallo on 88 % leveimmästä rivistä. Pään tekee luettavaksi
**kurouma**, ei koko.

**Ja jyskyttäjä kaatoi korkean massakeskipisteen sääntöön 0,415:llä — ja hän oli
oikeassa ja sääntö väärässä.** Hänen koko luonteensa on laskeutua päällesi.
Vapautus olisi ollut helppo ja epärehellinen liike; vapautus on tarkistus jonka
lakkasi ajamasta. Nyt hän ilmoittaa päinvastaisen väitteen ja häntä mitataan
sitä vasten.

### Ja portti löysi kaksi asiaa joita kukaan ei etsinyt

**Siluettiportin kehys oli 40x40 ajalta jolloin jokainen pomo oli 30x32.** Kun
koot erosivat, 68 leveä sääherra **rajautui 36 pikseliin** ja 52 korkea kuningas
katkesi — eli portti vertaili typistettyjä siluetteja ja piti niitä kokonaisina.
Se meni läpi, mikä on juuri se tapa jolla tällainen vika jää huomaamatta.
Kehyksen korjaaminen paransi mittausta: pahin pari 0,802 → **0,547**.

**Ja nyrkkeilijän hanskat täyttivät hänen kaulansa.** Ne lepäsivät riveillä 10
ja 15, ja ylempi peitti tasan sen kahden pikselin raon jonka takia päätä
ylipäänsä näkee. Kurouma 1,00. Maailman 1 pomo oli ainoa jota tässä erässä ei
piirretty uusiksi — eli juuri se johon kukaan ei katsonut.

Jyskyttäjän jalat levenivät 22:sta 24:ään samasta syystä: `anvil` lupaa jalustan
joka on 0,8 leveimmästä, ja leveimmäksi kohdaksi paljastui *kädet*.

---

## v26.08.11.70 — pomoilla on vihdoin koko, ja portti mittasi hyppyä väärältä puolelta

Omistaja katsoi pomojen kuvalevyä kolme kertaa ja sanoi joka kerta saman asian
eri sanoin: *"ne ovat edelleen kutakuinkin samankokoisia"*, ja lopulta
*"nyt ne näyttävät venytetyiltä — haluan ISOJA ja JÄREITÄ, kuten
arcade-pelien pomot"*. Molemmat pitivät paikkansa ja ne olivat eri vika.

### 1. Koko: laatikko per pomo, katto 52 px ja mitattu

Kaikki seitsemän mahtuivat 30x32:een, eli kahteen laattaan, ja pelkkä muoto ei
sitä korjaa: seitsemän siluettia samassa laatikossa on edelleen seitsemän
samankokoista asiaa. Nyt laatikko on pomokohtainen (`BOSS_SIZES`) ja piirrokset
on kirjoitettu siihen.

**Katto on 52 px ja se on mitattu kahdesti.** Voimatason 0 pelaajan *jalat*
nousevat 71 px paikaltaan hypätessä ja 100 px vauhdista. Ensimmäinen luonnos
laittoi luurangon 64:ään ja kuninkaan 60:een — molemmat alle 71:n, molemmat
kaatoivat portin. Seitsemän pikselin marginaali on marginaali jonka pomon oma
hengitys syö.

### 2. Muoto: massa eikä mitta

Ensimmäinen kokoluonnos venytti leveydet 72:een ja 76:een ja jätti korkeudet
30:een ja 44:ään. 2,4:1-vartalo jonka toisessa päässä on naama on bussi, ei
pomo. Nyt **1,6:1 on levein sallittu suhde** ja korkeusbudjetti käytetään:
syöksyjä 72x30 → 64x40, sääherra 76x44 → 68x46.

Se ei vielä riittänyt, ja kolme korjausta olivat kaikki samaa sukua:

- **Syöksyjä oli veturi**, koska tasakorkea palkki jonka päässä on pää on
  veturi millä tahansa suhteella. Nyt selkä on **portaikko** — kolme askelmaa,
  kukin kahdeksan pikseliä edellistä korkeammalla — ja pää roikkuu kyhmyn
  *alla* eikä sen päässä.
- **Sääherra oli bussi kahdesti.** Ensin suhde, sitten — suhteen korjaamisen
  jälkeenkin — **kaksi vaaleaa silmää rinnakkain tummalla rungolla, eli
  valaistut ikkunat**. Ratkaisu on se johon isot pomot aina turvautuvat: *yksi
  valtava silmä keskellä*. Yksisilmäinen ei ole ajoneuvo. Ilmapuntari siirtyi
  alemmas ja pienemmäksi, koska kultakehyksinen vaalea neliö silmän korkeudella
  oli se toinen silmä.
- **Kuningas oli kaappi**, koska vaippa oli yhtä leveä kuin hän: vaakaviiva
  siluetin poikki leikkaa sen kahdeksi laatikoksi. Nyt olkapanssarit työntyvät
  ulos, vyötärö kapenee 18 pikseliin ja turkis on vain panssarien päällä.

Luuranko sai päinvastaisen hoidon: pääkallo lähes koko leveydeltä ja
reisiluut kuusi pikseliä korkeat. Iso pää lyhyillä paksuilla jaloilla on se
mittasuhde josta jokainen arcade-järkäle on piirretty.

Siluettiportti (`jokainen pomo on oman muotoinen`) pitää: pahin pari 0,802
kynnyksen 0,82 alla. Marginaali on ohut ja se on tässä sanottu ääneen.

### 3. Ja portti mittasi hyppyä väärältä puolelta

Seitsemän linnaketta kahdeksasta kaatui testiin *"voimatason 0 talloo yhden
avoimen ikkunan sisällä"*, ja kumpikaan syy ei ollut pomon koko sinänsä.

**Lämmittely oli 90 framea, ja työ vaatii viisitoista.** Pomo syntyy hieman
lattian yläpuolelle ja seisoo sillä ennen framea 15; loput 75 se käveli, ja
1,5 px/frame kantoi sen 130 px pois paikaltaan. Pelaaja asetetaan *suhteessa
pomoon*, joten pelaaja asetettiin areenan ulkopuolelle — 7-F:ssä sitä edeltävän
käytävän piikkipenkkiin. Linnake kaatui testissä siihen mihin testi hänet
laittoi. Silmukan ehto on nyt `boss.onGround`, eli se asia jota se odottaa.

**Ja lähestymismatka luettiin vain leveydestä.** Vakio 40 px keskustasta
tarkoitti 30x32-pomolla "irtoa 25 px kyljestä ja nouse yhden pomonkorkeuden
verran". 68 leveän sääherran keskustasta 40 px on 6 px kyljen sisällä — mutta
tärkeämpi puolikas oli korkeus: **tallominen lasketaan vain laskeutuessa**,
joten 52 px korkean pomon kohdalle saapuminen *nousevassa* liikkeessä ei ole
tallominen vaan törmäys. Juuri sen jälki näkyi 8-F:n framedumpissa, osuma
kylkeen `vy` yhä negatiivisena. Matka on nyt `w / 2 + 25 + h`, ja se palauttaa
vanhat luvut 30x32:lla.

Kumpikaan korjaus ei koske voimatasoa, ikkunan pituutta eikä pomoa. Kokeiltiin
myös kolmatta (botti jarruttaisi ennen kylkeä noustessaan) — se ei muuttanut
yhtäkään tulosta, joten sitä ei jätetty koodiin.

---

## v26.08.10.69 — molemmat pystykentät olivat ratkaistavissa liikkumatta sivuun

Omistaja pelasi 6-K:n ja raportoi kaksi asiaa. Molemmat pitivät paikkansa, ja
niiden alta löytyi kolmas joka oli pahempi kuin kumpikaan.

### Kolme vikaa, joista yksikään ei näkynyt yhdessäkään portissa

**1. 6-K:n läpi meni yksi avoin sarake.** Sarake 3 oli auki riviltä 5 riville 43
ja maali oli sen pohjalla: kävele vasemmalle, pidä alas, olet perillä. Kaikki
kahdeksan käytävää olivat koristetta.

**2. Ja se sarake oli yhden laatan levyinen.** Tämä on se jota ei raportoitu ja
joka on pahempi: aukko on 16 px ja levein keho **21** (`PLAYER_SIZES`), joten
voimatasolla 3–5 kentästä ei päässyt alas **lainkaan**. Kyykky ei auta — se
madaltaa eikä kavenna — eikä pelaaja voi kutistua omasta tahdostaan, joten
isona saapuminen oli ansa. Syy siihen ettei tätä nähnyt mikään on yhdellä
rivillä: **jokainen portti mittaa voimatasoa 0**, eli tasan sitä kokoa joka
mahtui.

**3. Ja 7-T:ssä oli sama vika toisin päin.** Sen puolat olivat `########---` ja
`---########`, ja ne jakoivat sarakkeet 9–10 — eli oli sarake jolla oli
jalansija joka ikisellä askelmalla. Kentän saattoi läpäistä hyppimällä
paikallaan.

### Yksi sääntö, kaksi peilikuvaa

`checkClimbTraverse` kieltää laskeutuvalta kentältä **vapaan sarakkeen** ja
nousevalta **tikapuusarakkeen**, ja molemmissa vika on sama lause: kenttä on
ratkaistavissa liikkumatta sivuun. `checkClimb` on tyytyväinen kumpaankin, ja
aivan oikein — se todistaa että reitti on *olemassa*, ei että se on ainoa.

`checkClimbWidth` vaatii jokaiselta riviltä aukon joka päästää läpi leveimmän
kehon. Kaksi laattaa, ja luku tulee `PLAYER_SIZES`ista eikä mausta.

Uudet säännöt kaatoivat kolme kenttää samalla lauseella: 6-K:n, 7-T:n ja
`verify.mjs`:n **oman koekentän**, joka oli kirjoitettu samalla päällekkäisellä
lankulla. Se on niiden paras suositus.

### Ja botti oli läpäissyt molemmat *täsmälleen niillä vioilla*

Tämä on erän epämukavin löydös. Kiipeilybotti ei osannut kolmea asiaa, ja
jokainen puute vastasi tasan yhtä kentän vikaa:

| botti ei osannut | siksi se tarvitsi |
| --- | --- |
| astua reiästä alas (se tähtäsi *lähimpään* sarakkeeseen, joka on jalkojen alla) | yhden avoimen sarakkeen koko matkalta |
| hypätä sivuun ylöspäin (hyppy lähti vain kun kohde oli suoraan yllä) | päällekkäiset lankut |
| väistää piikkejä (se ei tuntenut tappavia ruutuja lainkaan) | ettei kävelylinjalla ole piikkejä |

Eli botti läpäisi kentät sillä vialla jota sen oli tarkoitus mitata, ja kun viat
korjattiin, se jäi ensimmäiselle lattialle. Kaikki kolme on nyt korjattu
bottiin — ei kenttiin — koska tämän repon oma sääntö on että botin puolikas
sanasto ei saa määrätä sisältöä (ks. `level-bot.js`, astinkivi).

Neljäs korjaus on mitta eikä puute: botti **juoksee viisi laattaa ennen
piikkiä**. Kävelykatosta juoksukattoon menee `ACC`:llä noin 18 framea, joten
ponnistusframella syttyvä juoksu jättää kehon ilmaan kävelyvauhtia — mitattuna
ponnistus sarakkeesta 7, laskeutuminen sarakkeeseen 9, piikki sarakkeessa 9.

### Kamera sai lyöntinsä

`CAM_PAGE_FRAMES` **0 → 60**, ja se on omistajan päätös joka kumoaa mittauksen.
Mittaus on yhä oikeassa siitä mitä se mittasi (hallinnan menetys, uuden maan
näkyminen); se ei mitannut sitä mitä leikkaus tekee silmälle. Nollan framen sivu
ei ole nopea vaan **olematon** — kuva vaihtuu kokonaan yhdellä framella.

Sekunti, smoothstepillä eikä tasaisesti (tasainen sekunti lukee hissiltä), kello
pysähtyy sivun ajaksi mutta **musiikki ei** — `Music` on omalla kellollaan eikä
sitä ajeta `update`sta, ja juuri se tekee pysähtyneestä kuvasta kameratyötä eikä
kaatunutta peliä.

### Mitä kentille tehtiin

6-K on piirretty uudelleen: kerrokset neljän rivin välein, **kolmen laatan aukko
joka vaihtaa puolta**, eli reitti alas on sahalaita. Ensimmäinen huone on rivin
korkeampi koska `!` tarvitsee neljä vapaata riviä ollakseen puskettava. Piikit
ovat yhden laatan levyisiä ja vähintään seitsemän saraketta laskeutumispaikasta:
molemmat mitattu **kävelyhypystä**, samalla perusteella kuin `ice_pit`in kuilut —
pystykentässä laskeudutaan ja lähdetään kävelemään, vauhtia ei ehdi ottaa.

7-T:n pankit erotettiin: sivusiirtymä on nyt **yksi sarake eikä nolla**. Yksi
eikä kaksi, ja sekin on mitattu — neljän ruudun nousulla hyppy kantaa tasan
yhden, ja ensimmäinen yritys kahdella kaatui `checkClimb`iin heti.

Vaikeus: 6-K 247,3 → 245,9 (muoto säilyi), 7-T 202,5 → 214,3.

---

## v26.08.10.68 — JÄÄ on laatta, ei teema

`SURFACES` on ollut olemassa siitä asti kun emergenssin ensimmäinen erä tuli
sisään, ja sen laki 1 kuuluu *"jää on liukas kaikille"*. Se oli tosi puolittain:
**pelaaja ei lukenut taulua lainkaan.** Koko maailma 3 oli liukas kävelijälle ja
kuorelle, ja pelaajalle se oli tavallista maata.

Sen rivin perustelu oli oikea eikä sitä kumota tässä: maailman 3 kahdeksan
kenttää on mitoitettu tavallisen kitkan varaan, joten pelaajan kitkan
pudottaminen *teeman* perusteella olisi muuttanut kahdeksan kenttää yhdellä
committilla ja syönyt juuri sen marginaalin jonka DESIGN.md kohta 5 lupaa.

Tässä erässä se tehtiin toisin päin: **jää on laatta (`T.ICE`, `'I'`), jonka saa
ladota mihin tahansa maailmaan.** Teemana se olisi muuttanut kahdeksan kenttää
kerralla; laattana se ei muuta yhtäkään ennen kuin joku ladotaan jonnekin — ja
se kantaa maailmaa 3 pidemmälle, jäiselle kielekkeelle luumaailmassa ja liukkaalle
kulkusillalle tehtaassa.

### Se yksi luku, ja mitä se **ei** koske

`SURFACES` sai kolmannen sarakkeen `grip`in, joka on kerroin kehon **omalle
jarrutusvallalle** — `FRICTION_SMALL`, `FRICTION_BIG` ja `SKID`. Jäällä se on
0,4. Mitattu `tools/measure-braking.mjs`:n uudella osalla 1b, voimataso 0:

| vauhti | irrota ote | käänny vastaan |
| --- | --- | --- |
| 1.5 kävely | 71 px (4,4 laattaa) | 22 px (1,4) |
| 2.5 juoksu | 199 px (12,4) | 40 px (2,5) |
| 3.5 P | 390 px (24,4) | 68 px (**4,3**) |

**`ACC` ei ole listalla, ja se on tämän erän tärkein päätös.** Koko mitattu
hyppybudjetti johtuu siitä luvusta, joten jään lähellä oleva kuilu on mitoitettu
sillä vauhdinotolla joka siinä oikeasti on. Se on myös oikea tuntuma — jäällä ei
ole vaikeaa lähteä vaan pysähtyä — ja se on se lause joka pitää
`tools/playable.mjs`:n todistuksen voimassa: botti pitää oikeaa pohjassa eikä
jarruta kertaakaan, joten se mittaa jään päällä framelleen saman kuin ilman.

Se on kirjoitettu myös `level-bot.js`:ään ääneen, koska se leikkaa molempiin
suuntiin: **botin LÄPI ei ole todiste siitä että jäinen kohta on reilu.** Se on
todiste siitä että sen läpi pääsee pysähtymättä.

### Sääntö on kapea, ja kapeus on mittaustulos

Ensimmäinen luonnos oli reunasääntö juoksuhiekan malliin. Mittaus tappoi sen:
pahin *tahallinen* pysähdys jäällä on 68 px, ja eteen näkyy juostessa ~176 px,
eli **jäällä ei ole vaaraa jota ei ehtisi väistää** — kunhan on jotain minkä
päällä jarruttaa. Tavallista maata pitkin jäälle saapuva voi jarruttaa jo ennen
jäätä, ja jään jälkeinen kuoppa on hypättävissä kuten mikä tahansa kuoppa.

Jäljelle jää tasan yksi asetelma jota **mikään muu sääntö ei näe**: kelluva
lautta kuilun päällä. Sille tullaan kaaressa, sillä vauhdilla jonka hyppy vaati,
eikä ennen sitä ole mitään millä hidastaa. `checkGaps` on tyytyväinen, koska
kuilu on hypättävissä molemmilta puolilta — ja juuri se hyppy on se joka tappaa.
`checkIce` vaatii sellaiselta saarelta `ICE_BRAKE` = 5 laattaa, eli tuon 4,3
pyöristettynä ylöspäin.

Portti koettelee myös sen ettei sääntö ole kielto: **viiden laatan lautta menee
läpi**, kolmen ei.

### Hinta on tarkkuudessa eikä vaaralistalla

Jää ei satuta — sen päällä voi seistä loputtomiin. Se vie *tähtäyksen*, ja
mittarilla on jo termi sille: `precision`. Kolme laattaa on se leveys jolla
laskeutuminen lakkaa vaatimasta tähtäystä; jäällä se leveys on `ICE_BRAKE`.
Uusi laatta ei siis ole uusi termi vaan vanhan termin toinen kynnys.

Vaaralistalla se olisi myös mekaanisesti väärässä paikassa: `HAZARD_COST`
luetaan sarakkeen **pahimpana**, joten jään ja piikin jakava sarake olisi
hinnoitellut vain piikin — jää olisi ollut ilmaista tasan siellä missä se maksaa
eniten.

### Ja se mitä silmä ei nähnyt: 2,7 %

Jään ensimmäinen väritys oli vaaleansininen ja **näytti hyvältä**. Mitattuna se
oli jäämaailman omaa maata vastaan **2,7 %** — huonompi kuin yön tiili ennen
korjaustaan (0,4 % oli pelin pahin, ja kynnykseksi asetettiin silloin 17 %), ja
tasan siinä maailmassa johon ensiesittely oli juuri sijoitettu. Liukas laatta
jota ei erota lumesta on mekaniikka jota ei ole.

Toinen löytö oli pahempi ja tuli vasta kun halkeama otettiin mittaan: **jää vs.
halkeama 14,8 %.** Turvallinen laatta ja tappava laatta jakoivat saman vaalean
yläreunan — ja se on tasan se sekaannus jota tässä pelissä ei saa olla. Se on
sama ehto joka juoksuhiekalle on kirjattu ("ei saa lukea laavana"), nyt
maksettuna toisen kerran.

Nykyinen turkoosi on molempien mittausten tulos, ei makuasia: syvä kylläinen
sinivihreä, jonka *kansi* on turkoosi eikä valkoinen, koska valkoinen yläreuna
on halkeaman allekirjoitus. Ja koska jään saa ladota mihin tahansa, kynnys ei
ole yhdessä teemassa vaan **kaikissa kahdeksassa kertaa neljä naapuria** (maa,
kova palikka, laava/halkeama, piikki), huonoin luku ratkaisee: nyt 17,9 %.

### Ensiesittely: 3-1, sarake 52

`ice_first`: kahdeksan laattaa jäätä yhtenäisen maan päällä, kolikot sen yllä,
neljä laattaa tavallista maata ja sitten yksi tiili. Tiili on se seinä johon
liu'un loppu näkyy, ja se on tiili eikä piikki koska **hinta on nolla** —
kylkeen törmääminen pysäyttää eikä satuta. Se on tämän maailman versio 2-1:n
matalasta juoksuhiekasta: mekaniikka opetetaan siellä missä sen kohtaaminen on
ilmaista.

Neljä laattaa run-offia on mitattu eikä silmämääräinen: jäältä tavalliselle
maalle tullut voimatason 0 pelaaja pysähtyy juoksuvauhdista 4,9 laatassa, joten
täyttä vauhtia tullut *osuu* tiileen ja kävellen tullut ei. Kumpikin on oikea
lopputulos ja kumpikaan ei maksa mitään.

`curriculum.mjs`: POHJA, SEURA ja YKSIN kaikki läpi. 3-1 vaikeus 161,6 → 156,3,
maailman muoto 156 → 130 → 187 eli yhä yksi notko.

### Mitä tässä ei ole

**Maailmaa 3 ei ole jäädytetty.** `ice_crumble`in 12 laatan run-off on mitoitettu
tavallisen maan 9,7 laatan liu'ulle; jäällä sama liuku on 24,4, joten jään
latominen siihen chunkkiin on eri työ ja se on mitattava erikseen. Sama koskee
`ice_pit`iä ja `ice_twin`iä — ne on kirjoitettu ikään kuin lattia olisi liukas,
mikä ei ole koskaan ollut pelaajalle totta. Nyt se voidaan tehdä todeksi yksi
kenttä kerrallaan ja mitaten, mikä oli koko syy tehdä tämä laattana.

---

## v26.08.10.67 — möykylle hinta, ja portti joka kysyy sitä jokaiselta vaaralaatalta

Möykky asetettiin kahteen kenttään eikä `src/data/difficulty.js` muuttunut
riviäkään. Syitä oli kaksi, ja **toinen on se oikea**: mittari ei tuntenut
merkkiä `'C'`, ja portti *"jokaisella vihollismerkillä on hinta"* kävelee
**vihollistaulua** — laattana oleva vaara oli sen ulottumattomissa, joten
mikään ei koskaan olisi napannut tätä.

Pelkän möykyn hinnoittelu olisi jättänyt reiän auki seuraavalle vaaralaatalle.

### Auditointi: neljä satuttavaa laattaa, kolme jo hinnoiteltua

Sama 32 sarakkeen koekenttä, yhden merkin ero, perustaso 7,2:

| merkki | lippu | ennen | jälkeen |
| --- | --- | --- | --- |
| `^` piikki | `hazard` | +9,8 | +9,8 |
| `W` laava | `hazard` | +14,7 | +14,7 |
| `~` juoksuhiekka | `quicksand` | +4,9 | +4,9 |
| `C` möykky | `falls` | **0,0 hinnaton** | **+5,9** |

Kaksi jotka **eivät** kuulu listalle, ja perustelu: `H` närästyssuihku on
`ENEMY_CHARS`-merkki ja vihollisportti hinnoitteli sen aina — se ei ollut
koskaan reiässä. `%` mureneva lauta on tarkoituksella luokiteltu kosketuksesta
vaarattomaksi: se vie jalansijan eikä voimaa, ja se hinta on jo `gaps`- ja
`precision`-luvuissa. Vaarana hinnoittelu **laskisi sen kahdesti**.

### Portti joka ei voi toistaa tätä

Uusi väite johtaa satuttavat merkit **`TILE_INFO`sta**, samasta taulusta jonka
peli lukee, tuotuna eikä tekstistä haravoituna — käsin kirjoitettu lista on
tasan se mikä tässä petti. Ja se **portittaa luokittelun itsensä**: mikä tahansa
`TILE_INFO`n lippu jota kumpikaan lista ei tunne kaataa portin ja kysyy kummalle
puolelle se kuuluu. Todistettu ei-tyhjäksi keinotekoisella laatalla.

### Toinen vika samalla matkalla: `SOLID`illa on viisi kopiota

Vanha portti vertasi **kolmea**. `tools/curriculum.mjs` oli päivitetty muttei
tarkistettu; `tools/difficulty.mjs` ei kumpaakaan — **eli mittari luki möykyn
ei-kiinteänä**. Se ei muuta yhtäkään pistettä tänään (molemmat möykyt ovat
rivillä 8, `lethalCol` lukee rivit 13–14), mutta se on **väärä vastaus joka
odottaa oikeaa kysymystä**. Molemmat tiedostot ovat nyt portissa.

### Hinta 0,6 per sarake, ja se on perusteltu eikä sovitettu

**Ei nolla**, koska se osuu ja koska molemmissa huoneissa se on suoraan sen
`BB?BB`-lohkorivin yllä jota pelaajan on tarkoitus lyödä. Nolla on
SAVIKUOPPAn taksa, ja sen ansaitsee kuoppa joka ei voi maksaa mitään
**millään** ketjulla.

**Ei piikin 1,0**, kolmesta syystä jotka kasautuvat: se ei putoa ellei pelaaja
itse pudota sitä, joten ohikulkija ei kohtaa sitä lainkaan; se ei voi viedä
henkeä sillä ketjulla jonka ympärille se on rakennettu (voimatasolla 0 tiiltä ei
saa rikki, joten pudottaja on iso ja osuma maksaa koon); ja se varoittaa 12
framea ja liikkuu 3,2 px/frame — **paikallaan seisova menettää tason, kävelevä
ei mitään**.

Silti **yli matalan hiekan 0,5:n**, koska matala hiekka ei voi satuttaa
lainkaan — se maksaa kelloa. Osuma on enemmän kuin vero, muttei paljon enempää
kahden ison alennuksen jälkeen.

**Rajoitus kirjattuna luvun viereen:** potkaistu kuori rikkoo tiilen myös
pienelle pelaajalle, joten kuoren ulottuvilla oleva möykky **voi tappaa**.
Kumpikaan pelin kahdesta möykystä ei ole sellaisessa huoneessa, eikä mittari voi
kysyä kuoren ulottuvuutta lähtöruudukosta. Jos sellainen huone joskus
rakennetaan, 0,6 on sille liian vähän.

### Knock-on

`4-2` 141,2 → **141,7**, `4-F` 214,1 → **215,2**, w4 keskiarvo 191,3 → **191,5**.
Muoto ennallaan (2 notkoa), käyrä nousee joka askeleella (+10,8 alle, +41,7
yli). **Mikään ei tarvinnut antaa periksi**, eli hintaa ei sovitettu porttiin.
Muut **62 kenttää tavu tavulta ennallaan** — diff on tasan kaksi riviä.

### Löydetty, ei korjattu

`measureClimb` ei laske juoksuhiekkaa lainkaan, vain `HAZARD_COST`:in. Toimeton
tänään (yksikään kenttä ei ole `vertical: true`), mutta **möykky on nyt
käsitelty molemmilla akseleilla ja hiekka ei**.

---

## v26.08.10.65 — ruutu pukee saapuvan maailman värin kun kuningas vaihtuu

Omistaja pyysi kokoruudun palautetta megapomon muodonvaihtoon ja hyväksyi
muotoilun: **ruutu pukee hetkeksi sen maailman värin josta muoto tulee.**

PIERUKUNINGAS on pelin ainoa pomo joka vastaa tallaukseen **vaihtumalla
joksikin toiseksi**; kaikki muut nostavat yhtä omaa numeroaan. Se ero lunastuu
vain jos pelaaja tunnistaa kesken tappelun **kuka juuri saapui** — tasan se
taito jonka maailman 8 seitsemän uusintaa opettivat. Tähän asti vaihdos luki
vain spritin ja nopeuden muutoksena, ja sen ainoa oma ääni oli lainattu `fart`,
**eli jättiläisen kasvun ääni**: lainaa pahimmassa mahdollisessa paikassa,
koska kuningas on se yksi pomo joka ei kasva.

Yleinen valkoinen välähdys olisi heittänyt ominaisuuden pois: se sanoisi
*että* jotain vaihtui, mikä on juuri se tieto joka pelaajalla jo on — hän
tallasi.

### Väri luetaan paletista, ja rajaus on mitattu

`themeTint` laskee teeman **maan ja kukkulan kuudesta sävystä** yhden värin.
Uutta sävyä ei keksitty eikä vanhaa kirjoitettu toiseen kertaan, koska toinen
kopio ajautuisi erilleen sinä päivänä kun jotakin palettia siirretään.

Kuusi sävyä eikä koko paletti eikä yksi, ja molemmat ääripäät mitattiin:
**koko paletin keskiarvo kutistaa kaikki teemat samaan harmaaseen** (heikoin
pari 5,5 %), ja pelkkä `groundTop` on jäällä, luulla ja pilvellä kolmesti
lähes valkoinen (3,9 %). Maat ja kukkulat antavat **12,7 %**, reilusti yli sen
8,6 %:n jonka peli jo sietää.

### Verho on rengas eikä verho, ja se on reiluutta

Pelaaja on sillä framella kesken hyppyä pomon päällä, ja läpinäkymätön
täysvälähdys juuri siinä olisi epäreilu. Kirkas ydin, väri reunoilla:
**76,1 % pelialueesta, 19 framea (317 ms), pomon päällä enintään 3/255 ja
pelaajan päällä 0/255.** Lisäävä (`lighter`) eikä peittävä, koska ruohon tumma
vihreä peittävänä olisi lukenut varjoksi eikä väriksi. Tärähdys jää sille mitä
se on aina ollut — osuman merkki — eikä verho lainaa sitä.

`_flashPass` ajetaan ennen `apply`n paluuta, koska **"pois" sammuttaa
kuvatehosteet eikä peliä**: verho olisi muuten näkymätön tasan sille pelaajalle
joka on pyytänyt nähdä pelin sellaisenaan. Mitattu kaikilla kolmella
asetuksella ja molemmilla piirtopoluilla; ilman ajuria kuvaputken vinjetti syö
nurkan noususta 106 → 42, mikä on yhä nelinkertainen kynnykseen nähden.

Pikatallennus palauttaa kuninkaan samaan muotoon **ja verhon samaan väriin**.

---

## v26.08.10.66 — möykky kahteen kenttään, ja kolme porttia jotka mittaavat sijoituksen

`T.LUMP` rakennettiin fysiikkoineen, kolmine turvaehtoineen ja tallennuksineen
— **eikä sitä asetettu yhteenkään kenttään.** Laatta jota ei ole missään on
koodia joka esittää ominaisuutta: jokainen sitä koskeva väite on tosi tyhjästä
joukosta, ja **tyhjä joukko läpäisee mitä tahansa.**

### Maailma 4, ja perustelu on sekä rekisteri että rakenne

Möykky on ummetuskorkin sukua, ja korkki asuu tehtaassa (`corks`, `cork_gap`,
`fac_star`, `fac_shaft` asettavat sen jokainen). Tehdas on myös **pelin ainoa
maailma joka on sisätilaa ensimmäisestä laatasta viimeiseen**, eli ainoa jossa
laatan yllä on aina jotain mistä se on voinut irrota — avoimen taivaan alla
möykky luetaan kiveksi, ja `tiles.js` sanoo suoraan ettei se ole kivi.

Kaksi kenttää eikä kuusi, koska tämä on uusi verbi:

- **4-2 ensiesittely** — tavallinen `BB?BB`-lohkorivi, möykky `?`:n vasemmalla
  naapurilla, tyhjä huone, tasainen lattia.
- **4-F** — sama rivi ja sama möykky, mutta kolmen närästyssuihkun huoneessa.
  Sama huone kahdesti, ja toisella kerralla sen katossa on jotain.

### Miksi ensiesittely on turvallinen rakenteesta eikä varovaisuudesta

Möykyn tuki voi olla **vain tiili** (`dropAbove` lähtee ruudun tyhjenemisestä,
ja mureneva lauta on kielletty), ja tiilen hajottaa **vain iso pelaaja**.
Kukaan ei siis voi pudottaa möykkyä itselleen voimatasolla 0, joten osuma
maksaa aina koon eikä koskaan henkeä — täsmälleen se raja jonka TURVAPROXY
vetää. Mitattuna 4-2: POHJA on, SEURA on, YKSIN on.

Mitattu moottorista, oikeista kentistä eikä koekentästä: 4-2 möykky lähtee
framella 12, laskeutuu 27, on kotona 153 framea myöhemmin; voimatasolla 0
mikään ei liikkunut 90 framessa; 4-F paikallaan jäänyt 1 → 0, kävelyvauhdissa
1 → 1 ja 8,4 laattaa sivuun.

### Löydetty, ei korjattu: mittari ei tunne möykkyä

`src/data/difficulty.js` **ei muuttunut riviäkään**, vaikka kaksi kenttää sai
tappavan laatan. Syy on että `tools/difficulty.mjs` ei tunne merkkiä `'C'`, ja
olemassa oleva portti *"jokaisella vihollismerkillä on hinta vaikeusmittarissa"*
kattaa **vihollismerkit** eikä laattavaaroja.

Se on sama vika kuin piikkiäijän puuttuva hinta jonka tämä sama sessio korjasi
aiemmin, yhtä luokkaa siirrettynä. Ei korjattu tässä, koska hinnan lisääminen
liikuttaa 4-2:n ja 4-F:n lukuja ja siten maailman 4 käyrä- ja muotoportteja —
oma muutoksensa omalla punaisellaan.

---

## v26.08.10.64 — emergenssin ensimmäinen erä: neljä lakia ja yksi laatta joka putoaa

Omistajan päätös 10.8.2026 (ROADMAP, *"emergenssi ulottuu olioiden välille,
muttei maastoon"*) toteutettuna. Neljä lakia, kukin omalla punaisellaan.

| laki | punainen | vihreä |
| --- | --- | --- |
| jää on liukas | `ruoho 33 px, jää 33 px — 100 % ruohosta` | `jää 18.1 px — 55 % ruohosta` |
| lauta murenee vihollisen alta | `ajastin framella 0, poissa false` | `poissa true, **palasi true**` |
| tuuli kantaa kuoria | `puuskassa 30 px, tyynellä 30 px — ero 0.0` | `ero 46.9 px` |
| potkaistu kuori tappaa | `papupommi jäi koskematta` | `kävelijä kuoli, papupommi räjähti` |

### Löydös joka on tärkeämpi kuin laki jota se koski

**Tässä pelissä ei ole jään kitkaa eikä ole koskaan ollut.** `player.js` lukee
`FRICTION_SMALL`/`FRICTION_BIG` eikä mitään muuta; **yksikään koodirivi ei lue
teemaa fysiikkaa varten.** Neljä kommenttia väittää toisin (`chunks/ice.js`,
`generator.js` kahdesti, `gen-levels.mjs`), ja maailman 3 generaattorin
`minIntro` 48 saraketta **ostettiin sillä väitteellä**.

Pelaajalle ei annettu jään kitkaa, ja syy on mitattu eikä varovainen:
`chunks/ice.js` laskee `ice_crumble`n 12 laatan liu'un luvuista 0,0391 ja
0,0547 — voimataso 0 liukuu 154,9 px, pysähtyy sarakkeeseen 262 ja liuku
päättyy 264:ään. **Kaksi laattaa pelivaraa.** Pelaajan kitkan laskeminen kuluttaa
tasan sen pelivaran, ja se pelivara on kohta 5. Mikä tahansa tuntuva liukkaus
(pito ≤ 0,83) syö sen. Se on oma muutoksensa joka pitää maksaa maailman 3
kenttädatasta, ja perustelu asuu `SURFACES`-taulussa eikä vain commitissa.

Laki toimitettiin siis **tasan niin kuin päätös sen nimeää** — kävelijät ja
kuoret — yhden jaetun taulun kautta jota pelaajakin voi joskus lukea. Muut
seitsemän maailmaa ovat tavu tavulta ennallaan, koska tavallisella maalla
`steer` on 8 px/frame² eli todistetusti välitön.

### Putoava laatta on uusi laatta, ja se perustellaan

Yksikään vanha laatta ei ansaitse pudota: maa, kovaa, tiili, lankku,
palkintolohko ja putki ovat kaikki jossain lattia, seinä, askelma tai katto, ja
kaikki kolme porttia lukevat ne pysyviksi. `T.CRUMBLE` oli lähinnä — se katoaa
ja palaa jo — mutta **putoava lankku laskeutuu jonnekin muualle**, ja laatta
uudessa paikassa muokkaa kenttää yhtä lailla kuin puuttuva: se voi tukkia
käytävän tai luoda askelman jota lähtötilassa ei ollut.

Siksi `T.LUMP` (`'C'`), **möykky** — kalkkeutunut massa, ummetuskorkin sukua,
pelin omassa suolistorekisterissä. Se ei voi poistaa reittiä koska `rules.js`
kieltää kolmella portilla: sen on lähtötilassa seisottava kiinteän päällä (tai
kenttä muokkaisi itseään framella 1 ja jokainen portti mittaisi kenttää jota
kukaan ei pelaa), sen päällä ei saa olla mitään, eikä sen tuki saa olla
mureneva lankku. Ja se palaa kotiin, joten tukos on aina tilapäinen.

Putoaminen on **tapahtumavetoista** (`setTile` → `dropAbove`) eikä
framekohtaista pyyhkäisyä: kotiin palannut möykky ei saa heti lähteä uudelleen
siksi että sen tuki on yhä poissa. Jatkuva tukitarkistus tekisi "palaa itse"
-lupauksesta silmukan, ja silmukka ei lupaa mitään.

**Möykkyä ei ole vielä yhdessäkään kentässä.** Sen sijoittaminen muuttaisi
kenttää ja siten `difficulty.js`:ää. Velkaa.

### Reiluus ilman kirjanpitoa

Päätöksen sääntö oli että pelaajaa saa satuttaa vain ketju jonka hän itse
aloitti, **eikä ruudun ulkopuolen kirjanpitoa saa tarvita**. Kolme osaa: emergentit
iskut iteroivat vain `enemy`/`hazard`, joten pelaaja on niiden ulottumattomissa
**rakenteellisesti**; ainoa laatta jonka vihollinen voi poistaa on mureneva
lankku, eikä möykky saa levätä sellaisen päällä, joten jäljelle jäävät
pääntökkäys, potkaistu kuori ja kytkin — kaikki pelaajan tekoja; ja pelaajan
aloittama ketju **omistaa seurauksensa** (mitattu: voima 1 → 0 kun hän rikkoo
tuen ja seisoo alla). Se osuu iskuna eikä paikkana, joten **tähti suojaa** —
sama raja jonka piikki ja närästysliekki vetävät.

### Determinismi ja mitattu ennallaan

Ei uutta `Math.random()`:ia. Pikatallennus kesken putoamisen palauttaa laatan
samalle riville samalla ajastimella, ja 60 framea myöhemmin sarake on merkki
merkiltä sama. `src/data/difficulty.js` ja `src/data/generated.js` **ennallaan**,
`playable.mjs` yhä `Jokainen kenttä on läpäistävissä pienimmällä koolla` (64/64).

Mukana kaksi rippettä: kaksi `powerup` → `payout` esineenpudotuksessa, ja
`LETTERBOX_BAR`in kommentti korjattu 100 px → **174 px**, mikä **kääntää sen oman
johtopäätöksen** (lakipiste ei mahdu paikallaan; kamera kantaa sen), joten palkki
pysyy 24 px:nä uudella perustelulla.

### Löydetty, ei korjattu

- **Neljä vanhentunutta "jää on liukas" -kommenttia** muualla repossa.
- `tools/originality.mjs` taittaa tuntemattomat merkit ilmaksi, joten `'C'`:n
  sisältävä kenttä verrattaisiin korpukseen reikä keskellä. Vaaraton tänään,
  todellinen aukko sinä päivänä kun möykky sijoitetaan.
- `Heartburn` ja `BeanBaron` kutsuvat yhä `Math.random()`:ia konstruktorissaan.

---

## v26.08.10.63 — kolme ripettä mitattaviksi, ja kaksi poikkeuslistaa nollaan

Pelillä ei ollut enää velkaa, joten nämä kolme ovat epäsiisteyksiä joilla on
numero. Kunkin arvo ei ole poisto vaan se väite joka jää jäljelle.

### Neljä orpoa palikkaa, ja poikkeuslista nollaan

`pyre_ledge`, `crypt_ossuary`, `crypt_stair` ja `spire_squall` olivat
määriteltyjä muttei yhdenkään kentän asettamia. Viitetarkistus ennen poistoa:
ne esiintyivät **täsmälleen kahdessa paikassa**, omissa määritelmissään ja
portin `OWED`-listalla. Yksikään kenttä, generaattori, työkalu tai testi ei
nimennyt niitä, joten mitään ei tarvinnut jättää.

```
punainen  179 palikkaa, 175 käytössä, 4 orpoa (poikkeuksia 0)
vihreä    175 palikkaa, 175 käytössä, 0 orpoa (poikkeuksia 0)
```

**Väitteessä ei ole enää yhtään varausta**, ja se on tämän kohdan koko tulos:
portti joka sanoo "ei orpoja" ilman poikkeuslistaa on arvokkaampi kuin neljä
poistoa. Kolme sanastokuvausta kertoi poistetuista huoneista ja kirjoitettiin
uusiksi. Sivulöydös korjattuna: `spire_lattice`in kuvaus istui väärän palikan
(`spire_hail`) päällä.

### Kartta sanoi "kasvoit" kun mikään ei kasvanut

`worldmap.js` soitti `powerup`in kun esine menee varastoon — sama vika joka
kentän puolella korjattiin aamulla. Kartan **kaikki yksitoista** ääntä luettiin
kohtaa 8 vasten, ja se on merkinnän arvokkaampi puolisko:

| ääni | missä | tuomio |
| --- | --- | --- |
| `cursor` ×3 | nappula lähtee, talon valinta liikkuu | **rauhaan** — yksi merkitys: kohde vaihtui, mitään ei sitouduttu |
| `select` ×2 | kenttään, taloon | **rauhaan** — molemmat ovat "sitoudun siihen mihin osoitin osoittaa" |
| `bump` ×4 | suljettu polku, tyhjä talo, tyhjä varasto, jo täysi voima | **rauhaan** — neljä syytä, **yksi merkitys** (*mitään ei tapahtunut*), ja syyn kertoo ruudun teksti. Neljä eri ääntä tekisi kieltäytymisestä tapahtuman |
| `powerup` (varastoon) | `updateHouse` | **korjattu → `reserve`** |
| `powerup` (varasto käytetään) | `useReserve` | **rauhaan** — voimataso oikeasti nousee |
| `Music.play('map')` | `enter` | **rauhaan** — kertojan kerros |

Kaksi väitettä tarkoituksella: ajettu tapahtuma, **ja koko tiedoston luku**
(`powerup` täsmälleen kerran, `useReserve`in sisällä). Jälkimmäinen on se joka
nappaa kutsupaikan jota mikään testi ei aja.

### Resepti osoitti kahteen kenttään jotka eivät enää toimitu

`gen-levels.mjs` selittää maailmojen 6 ja 7 luvut käsintehdyillä ankkureilla
`6-3` ja `7-2`, ja molemmat korvattiin pystykentillä. Valittu ratkaisu:
**luvut pidetään, proosa kirjoitetaan uusiksi** — ja perustelu on mitattu eikä
väitetty. Korvaajat ovat **pystykenttiä**: tiheys on merkkejä sataa
**saraketta** kohden ja `difficulty.mjs` pisteyttää kiipeilyn **riveinä**, joten
kiipeilyn luvun syöttäminen vaakareseptiin olisi yksikön vaihto eikä mittaus.
Ja mikä tahansa uudelleenmittaus joka liikuttaisi reseptilukua regeneroisi
toimitetun, korpustarkistetun kentän.

Selvinneet ankkurit mitattiin silti, ja **yksi luku maksoi**:

- w6 tiheys 8,4…9,8 vastaan toimitettu 8,3…9,8 — **kestää**
- w6 `maxGap` 5: todistus puolittui (18 kuilua → 9), johtopäätös ei muuttunut
- w7 tiheys pyytää **10,1**, joka ei enää ole toimitetulla välillä 9,4…9,5 —
  eli **7-7:n tiheyden perustelee kenttä jota ei toimiteta.** Se on kirjoitettu
  reseptiin **velaksi eikä korjattu pois.**

Portti lukee reseptin tekstinä ja **laajentaa välit** (`6-1…6-3` väittää
jokaista päiden välissä), mikä on tapa jolla `7-2` jäi kiinni vaikkei sitä
kirjoiteta auki. Ei poikkeuslistaa: poistuneet ankkurit ilmoitetaan tiedostossa
muodossa `POISTUNUT 6-3 -> 6-K`, ja väite **kääntyy** niille — vasen puoli ei
saa toimittua ja oikea pitää. **Palannut poistettu kenttä punastuttaa itsensä.**

### Löydetty, ei korjattu

**Reseptien lihavoidut `aim`-tikkaat eivät ole koskaan täsmänneet `PLAN`in
rivien kanssa** — eivät siitä committista jossa ne kirjoitettiin. w4 175/195/215/240
vastaan 168/181/197/212; w5, w6 ja w7 samoin. Maailmat 1 ja 3 täsmäävät. Proosa
kantaa sen tikkaan joka **päätettiin**, PLAN sen johon haku **ylsi**. Ei korjattu
tässä: se koskee neljää maailmaa, ja w5:n kohdalla oikea luku kumoaa seuraavan
lauseen samassa kappaleessa. **Väitettä ei myöskään kirjoitettu, koska punaiseksi
jätetty väite ei ole väite.**

---

## v26.08.10.62 — maailma 2 kahdeksaan: mitä "kahdeksan kenttää" on kun kartta haarautuu

**Peli on 8 maailmaa ja 64 kenttää.** Maailma 2 oli viimeinen, ja se jätettiin
viimeiseksi siksi että se on ainoa haarautuva maailma — siellä väite
"kahdeksan kenttää" ei tarkoita samaa kuin muualla.

### Kaksi hylättyä ehdokasta, ja miksi

- **Kahdeksan kenttää joka reitillä — hylätty aritmetiikalla.** Kun runko on
  `t` kenttää ja kaksi reittiä omistaa omansa, kahdeksan kentän *kävely*
  vaatii kartalle `15 − t` solmua: maailma 2 olisi tällä rungolla **12
  kenttää** ja pelin summa 68 eikä 64. **Saavuttamaton ehto ei ole tiukka vaan
  väärä.**
- **Kahdeksan solmua ja ei muuta — hylätty löysänä.** Se päästäisi läpi
  maailman jossa runko on kolme ja sivupolku neljä, eli kahdeksan kenttää
  joista yksi kävely näkee viisi.

### Valittu: kahdeksan solmua **ja** lattia kävelylle

Jokainen reitti kävelee vähintään **kuusi** maailman kahdeksasta, eikä reittien
ero ole yhtä suurempi. Kuusi ei ole poimittu luku vaan toinen muoto lauseelle
*"korkeintaan kaksi kenttää saa olla yhden reitin yksinoikeutta"* — valinta saa
piilottaa neljänneksen maailmasta eikä enempää. Mitattuna **HIEKKATIE 6,
LAAVATIE 7**.

### Ja toinen puolisko: muoto on kävelyn ominaisuus, ei kartan

`shapes` luki `tiersOf`, joka litistää haaran yhdeksi askeleeksi — eli maailma
2:n kohdalla se mittasi **riviä jota kukaan ei kävele**. Se lukee nyt uutta
`walksOf()`:ia, ja seitsemälle haarattomalle maailmalle tulos on merkki
merkiltä sama kuin ennen (yksi maailma = yksi kävely), joten mikään ei löystynyt.

### Punainen joka oli löydös eikä muodollisuus

```
FAIL jokainen kävely nousee   [w2 LAAVATIE 119→126→159→111]
```

**LAAVATIE päättyi 2-M:ään (110,7), joka on alle 2-1:n (118,6) — se kävely ei
noussut.** Vika oli olemassa ennen tätä työtä eikä mikään ollut sitä mitannut,
koska muototesti katsoi litistettyä riviä.

Se mittaus myös **päätti minne uudet kentät menevät**: tienhaaran *jälkeen*,
ei ennen sitä. Ennen haaraa ne eivät olisi koskeneet tuohon lukuun lainkaan.
Sivutuotteena paukkupavulle tuli paikka jossa se kuluu (`clay_vault`) ja haaran
pituusrangaistus pieneni yhdestä neljästä yhteen kuudesta.

### Numerot

- **Reittien pituudet** 4 / 5 → **6 / 7** (kävely sisältää linnakkeen).
- **Käyrä:** `112,8 · 133,2 · 180,7 · 191,3 · 233,2 · 248,2 · 256,5 · 283,5`.
  w2 132,5 → **133,2**; marginaalit +20,4 ja +47,5, ja pelin ohuin askel
  w6→w7 (+8,3) on koskematon.
- **Vaikeampi reitti mitattuna uudelleen:** LAAVATIE **159,3** vastaan
  HIEKKATIE **124,2** — *sama kuin ennen*, koska kumpikaan uusi kenttä ei ole
  reitin oma solmu. Palkinto on yhä mitatusti vaikeammalla tiellä, ja
  palkitsematon tie pelin läpi on yhä olemassa.
- **`difficulty.js` kasvoi tasan kahdella rivillä**; muiden **62 kentän pisteet
  ovat tavu tavulta ennallaan**.
- **Voimataso 0:** `Jokainen kenttä on läpäistävissä pienimmällä koolla.`

### Sisältö

**2-4 SAVIKUOPPA** on *kuoppa johon kävellään*: lattian ylempi rivi puuttuu,
alempi ei, joten `checkGaps` lukee käytävän eikä reikää ja vaikeusmittari
antaa siitä nollan — se mitä se muuttaa on se mihin kaikki muu asettuu.
`clay_boards` on pelin ainoa palkinto joka on **reitin alapuolella**: lankkukansi
on tie, kolikot sen alla. **2-5 PAAHDE** on kuumuus metronomina, kolme liekkiä
kolmella omalla laskurillaan, maan noustessa kolme riviä porttia kohti.

### Löydetty, ei korjattu

**Uudet kentät eivät esittele mitään uutta** (`variety.mjs` MYKKIÄ 0 → 2), ja se
on rakenteellista: kaikki minkä maailma 2 tietää on jo maailmassa 2, joten uusi
mekaniikka olisi lainattava myöhemmästä maailmasta ja rikkoisi opetusjärjestyksen.
Maailman uutuuskeskiarvo 49,3 → 44,7. Tämän nostaminen tarkoittaa uutta sanastoa
maailmalle jonka opetussuunnitelma on jo täynnä — eri muutos.

Ja **notko 2-4 → 2-5 on 13,1 pistettä**. Ei ohut pelin mittapuulla, mutta portti
lukee etumerkin, joten kumman tahansa kentän muokkaus voi kääntää sen.

---

## v26.08.10.60 — kaksi pystykenttää kentiksi, ja neljä velkaa mitattavaksi

### Pystykentät: 6-3 → 6-K KAIVAUTUMINEN, 7-2 → 7-T TERMIIKKI

Pystytuki tehtiin aamulla eikä yksikään kenttä käyttänyt sitä. Nyt kaksi
käyttää — ja ne **korvaavat** kentän eivätkä lisää sitä, koska kahdeksan kentän
muoto on portti. Paikat valittiin `variety.mjs`:llä eikä mukavuudella:

- **6-3 oli koko pelin vähiten uusi kenttä** (11,7 % omalle maailmalleen,
  84,6 % muodoistaan jaettuna 6-1:n kanssa) — niin selvästi, että
  `variety.mjs` käyttää sitä oman ansakokeensa fikstuurina.
- **7-2 oli w7:n vähiten uusi** (17,6 %). 7-3 oli toinen 18,4 %:lla, ja ero on
  ohut, joten toinen mittaus ratkaisi: 7-3:n `cloud_anvil` on se ylin lauta
  josta portti mittaa maahaniskun tappavuuden. Sen purkaminen purkaisi
  mittauksen.

**Miten lasku eroaa noususta, ja missä maastossa.**

| | 7-T (ylös) | 6-K (alas) |
| --- | --- | --- |
| mitä virhe maksaa | sivun jolla olit | kantaa **eteenpäin**, väärään paikkaan |
| tappavia rivejä | **0** | **7** |
| rankaiseva maasto | ei mitään — putoaminen on rangaistus | piikkilattiat, neljän rivin terassit joilta takaisin nouseminen vaatii **juoksuvauhdin** |
| murenevat lavat | ei yhtään | kaksi — alaspäin ne ovat **ovia**, joille astutaan tahallaan |

Kolme väitettä joita `validateLevel` ei tee: **ei ansoja** (vahva
yhteys — jokaiselta saavutettavalta lavalta maali on yhä saavutettavissa,
6-K 12/12, 7-T 16/16), **umpikujasääntö on käytössä oikeassa sisällössä**
(6-K 3, 7-T 2 maksettua umpikujaa), ja **rangaistuksen jako mitattuna**
(0 vastaan 7 tappavaa riviä).

7-T:n muoto oli itsekin punainen: ensimmäisessä versiossa lavat olivat
pakattua pilveä reunasta reunaan, ja `playable.mjs` sanoi **JUMISSA, 2 %
kiivetty** — kiipeilijä hyppää kohteensa alta ja `#`:n alapinta pysäytti hypyn
16 pikseliin.

### Neljä velkaa, ja ensimmäinen kääntyi toisin päin kuin odotettiin

**4-3: botti oli väärässä, ei kenttä. Kenttä ei liikkunut yhtä laattaa.**

Botti luki maaston siltä riviltä jolla se **seisoi**. 4-3:ssa se laskeutuu
kahden laatan pilarille sarakkeessa 220, ja sieltä katsottuna rivi 11 on tyhjä
niin pitkälle kuin skannaus ulottuu — eli **askel alas ehjälle lattialle luki
14 laatan kuiluksi**. Se ponnisti täydellä pidolla, lensi viiden laatan
vauhdinottokaistan yli ja putosi siihen oikeaan yhdeksän laatan kuiluun jota
sen olisi pitänyt mitata.

Korjaus lukee maaston siltä riviltä jolle botti on **astumassa**, ja kolme muuta
mitattua korjausta putosi mukana validoinnista: askeleen alas on tapahduttava
**ilman** läpi (juoksuhiekka ei ole lattiaa, 2-3), tappava este maksaa laatan
enemmän kuin saman levyinen kuoppa (8-2), eikä laskeutumisframella ponnisteta
(8-2). Ja neljäs: **askelkivi** — kuilun sisällä olevalle lankulle tähtääminen,
joka on tasan se "puuttuva liike" jonka työkalun oma varaus nimesi.

Se liike oli jo **saneellut sisältöä**: `generator.js`:n `softGap` kaventaa
jokaista maailmaa joka nimeää `maxGap`in, ja `corkGate`n lankku poistettiin
kokonaan — molemmat siksi ettei botti osannut lankkua.

**Tulos: kaikki 60 kenttää läpäistävissä voimatasolla 0**, mukaan lukien
**2-1**, joka oli myös rikki (`VAATII TUPLAHYPYN`, sarake 264) eikä ollut
kirjattuna mihinkään. Väitteessä ei ole poikkeuslistaa.

**Kuolleita palikoita kaksi, ei seitsemää.** Kenttädatasta laskettuna vain
`fort_blocks` ja `fort_trench` ovat käyttämättä; maailma 8 asettaa yhä muut
viisi. Merkintä v26.08.10.55 väitti kaikkia seitsemää kuolleiksi, ja se on
**tosi `x-F`-linnakkeista mutta epätosi pelistä**. Uusi väite nimeää neljä
jäljelle jäävää orpoa yksitellen, joten viides punastuttaa heti.

**Kontrasti:** piikkiukko 3,3 → **11,9 %**, papuparooni 3,3 → **11,6 %**,
ummetuskorkki 7,2 → **10,8 %**, ruskea pilvi 7,4 → **10,0 %** (kynnys 8,6 %).
Mikään muu ei repaantunut: korkkiukko sai omat värinsä koska `C.cork` on
**pelaajan** korkki, ja se on kohdan 1 c mukaan **muodon** korjaus — litteästä
neliöstä kartioksi. Väri oli silti välttämätön piikkiukolle: mitattuna
täysin musta runko yltää yökamaraa vasten vain **8,9 %:iin**, koska luupiikit
ovat neljännes laatikosta ja pitävät keskiarvon harmaana.

**`oneup` poistettiin.** Sille ei ollut paikkaa: tehostuslohkosta arvottu
lisäelämä on lohko joka ei antanut tehostusta (§5), ja salainen tiili on oikea
**muoto** muttei oikea **määrä** — 186 tiiltä, kalibroituna 23 kolikkotiileen
ja **kuuteen** tehostustiileen. Ratkaiseva tosiasia: **mikään 60 kentässä ei
ole koskaan tuottanut sitä.** `Sfx.play('oneup')` jää (100 kolikkoa, korttien
maksu).

---

## v26.08.10.61 — tähti suojaa vaaralta joka osuu, ja 4 ohittaa kentän

### Tähti ei suojannut närästysliekiltä, ja koodi oli kahta mieltä itsensä kanssa

Omistaja kuoli 4-1:ssä liekkiin tähti päällä. Syy oli epäjohdonmukaisuus eikä
päätös: **lattian piikki on aina lukenut tähteä** (`T.SPIKE && !(p.star > 0)`),
mutta `kind === 'hazard'` -haara ei lukenut sitä lainkaan. Tähti suojasi siis
piikiltä lattiassa muttei liekiltä joka nousee samasta lattiasta.

Kaksi kommenttia samassa tiedostossa väitti eri asiaa, ja **toinen oli koodia
vasten väärässä**: yksi sanoi "the star covers spikes too", toinen luetteli
piikin ja närästyksen suojaamattomien joukkoon.

Raja jonka tähti vetää ei ole *vihollinen vastaan kenttä* vaan **isku vastaan
paikka**: kuoppa, laava ja kello ovat paikkoja joihin pelaaja menee eivätkä ole
suojattuja; piikki, närästysliekki ja papupommi osuvat pelaajaan, ja ne ovat.

```
punainen  närästysliekki ilman 2->1, tähdellä 2->1, papupommi ilman 2->1, tähdellä 2->1
vihreä    närästysliekki ilman 2->1, tähdellä 2->2, papupommi ilman 2->1, tähdellä 2->2
```

Molemmat vaaraoliot mitataan, ei vain se jonka omistaja löysi.

### `4` ohittaa kentän, kartalla yhä maailman

Omistaja kysyi ohitusnäppäintä, ja syy oli tarkka: **maailmawarppi ei riitä
testaamiseen.** Se vie maailman *alkusolmuun*, ja siitä eteenpäin `isLinkOpen`
vaatii että jompikumpi pää on selvitetty — eli kenttään 4-3 pääsemiseksi piti
pelata 4-1 ja 4-2 läpi, mikä on mahdotonta juuri silloin kun ohitettava kenttä
on se joka on rikki.

Sama näppäin, konteksti päättää: numerorivi on täynnä, eikä kaksi näppäintä
joista toinen ohittaa kentän ja toinen maailman ole kahden muistamisen arvoinen.
**Ohitus kulkee `finishLevel`in läpi** eikä oikoteitä sen ohi, joten seuraava
polku aukeaa samalla koodilla jolla maali sen avaisi — oikotie olisi toinen tapa
läpäistä kenttä, ja kaksi tapaa eroaa aina lopulta.

Kaksi vanhaa väitettä kaatui tästä ja **molemmat oli oikeassa kaatua**: ne
rakentavat kentän suoraan ja tarkoittivat maailmawarppia. Ne sanovat nyt
kohteensa ääneen. Punaisesta löytyi myös ehto `pendingNode`: kenttä voi olla
ruudulla ilman karttasolmua (päivän yritys, portin rakentamat kentät), eikä
sellaista voi merkitä selvitetyksi.

---

## v26.08.10.58 — maailma 8 kahdeksaan: seitsemän uusintaa ja PIERUKUNINGAS

Omistajan muotoilu kuukausi sitten: *"shouldn't we have 7 bosses in worlds 1-7,
so repeating them would bring us to 7 bosses in world 8? and then you just add
one final MEGABOSS"* — ja pomovalikoimasta kysyttäessä: **seitsemän linnaketta
uusintoina, ja megapomo on kuningas.**

**8-1…8-7 ovat maailmojen 1–7 seitsemän linnakepomoa siinä järjestyksessä jossa
linnake ne lähetti** (variantit 0 1 2 3 3 4 5), ja **8-F on PIERUKUNINGAS**,
variantti 6, salissa `VALTAISTUINSALI`. Uudet kentät ovat **8-4 KONEHOLVI** ja
**8-5 SULATTO**; vanhat 8-4 ja 8-5 ovat nyt 8-6 ja 8-7 **tavu tavulta
ennallaan** ja pitivät tarkat pisteensä.

Peli on nyt **62 kenttää**, ja jäljellä on vain maailma 2.

### Seitsemän eikä kuusi, ja miksi vanha portti oli väärässä

Jättiläinen on **kahden** linnakkeen pomo (4-F ja 5-F), joten *varianttien
joukko* ja *linnakkeiden jono* ovat eri olioita — ne osuivat yksiin vain niin
kauan kuin maailmassa 8 oli kuusi kenttää. Vanha väite *"jokainen pomovariantti
kerran"* olisi kieltänyt tasan sen toiston joka on tämän maailman koko lause.
Se mittaa nyt jonoa jonoa vasten.

### Mitä megapomo tekee, mitä yksikään muu ei tee

Jokainen tämän pelin pomo vastaa tallaukseen **nostamalla jotakin omaa
numeroaan** — nopeus +0,35, luuranko ja sääherra +0,2, jättiläinen puoli kokoa.
Sama tappelu, nopeampana.

**Kuningas vastaa muuttumalla joksikin toiseksi.** Jokainen osuma antaa hänelle
seuraavan linnakkeen liikevalikoiman, joten **jokainen numero jonka hän
kantaa on jonkun toisen numero** eikä yhtäkään uutta mekaniikkaa ole. Pelaajan
tehtävä lakkaa olemasta "toista oppimasi rytmi" ja muuttuu siksi että
tunnistat kesken tappelun **kuka juuri saapui** — mikä on täsmälleen se mitä
seitsemän uusintaa opetti. Toteutus on yksi `form`-kenttä: `update()` osasi jo
kaikki kuusi valikoimaa.

Yhtä asiaa hän **ei** lainaa: kokoa. Koko on ainoa pomon ominaisuus tässä
pelissä joka vaatii eri huoneen — jättiläisen kannet ovat olemassa koska hänen
päänsä on voimatason 0 ulottumattomissa. Kuningas joka kasvaisi kesken
valikoiman olisi saavuttamaton tai kutistuisi takaisin.

**Väite hylkäsi kaksi ensimmäistä muotoaan, ja molemmat ovat kirjattuna
porttiin.** Nollahypoteesi *"jokainen muu pomo kiihtyy"* on epätosi — jättiläiset
eivät kiihdy (1,2 → 1,2), ne kasvavat. Ja *"kuningas ei kiihdy"* on
saavuttamaton, koska `speed = 0.75 + variantti·0.15` tekee maailmajärjestyksestä
nopeusjärjestyksen. Jäljelle jäi vahvempi väite: **yksikään numero jonka hän
kantaa ei ole hänen omansa**, eikä yksikään muu pomo koskaan vaihda muotoa.

### Yksitoikkoisuus mitattuna — ja löydös jota ei etsitty

Seitsemän uusintaa **ei** mitannut yksitoikkoiseksi (maailman uutuus 27,1 % →
31,2 %, ja 8-4 on 60,4 % omalle maailmalleen uutta). Mutta ensimmäinen versio
mittasi, ja odottamattomassa paikassa: **8-5 avautui alun perin `keep_forge`lla,
ja se pudotti 8-6:n — kentän jonka oma ensimmäinen lause on ahjo — 23,8 %:sta
5,9 %:iin**, eli pelin toistavimmaksi kentäksi.

Kaksi uutta kenttää voi siis **ontota vanhan kentän ilman että siihen
kirjoitetaan riviäkään**, ja se tapahtuu sen *parhaan* palikan kautta. Suihkut
ovat nyt 8-6:n omat.

### Käyrä

`112,8 · 132,5 · 180,7 · 191,3 · 233,2 · 251,2 · 253,7 · 283,5`. w7 → w8
marginaali **+29,8**, ja pelin ohuin askel w6 → w7 **+2,5** on koskematon.
Maailman muoto `245 → 117 → 302 → 169 → 354 → 378 → 386`: kaksi notkoa, ei
vierekkäin, pisin nousu 3 — sama muoto joka maailmalla 8 jo oli.
`src/data/difficulty.js` muuttui neljältä riviltä, kaikki maailmaa 8; **54 muuta
kenttää tavu tavulta ennallaan**.

### Jäi tekemättä

Maailma 8 on yhä pelin vähiten uusi maailma (31,2 % vastaan w5:n 82,1 %), ja
sen "mykkien" määrä nousi 0 → 2: 8-6 ja 8-7 eivät enää esittele mitään mitä
maailma ei ole näyttänyt, koska uudet kentät tulevat ennen niitä. Niiden
**muodon** uutuus on ennallaan. Korjaus tarkoittaisi uutta sanastoa kentille
joiden perustelut ovat jo päätetyt, eli eri muutosta.

---

## v26.08.10.59 — kamera hyllyllä, ja neljä ääntä jotka tarkoittivat kahta asiaa

### Kamera 2-1:ssä: vika joka oli pelaajan tavoitettavissa

```
punainen  2-1 taso 3 (227,9): 2.73 px/frame, pää 16.10 px    (katto 2.5, lattia 16)
vihreä    2-1 taso 3 (227,9): 2.17 px/frame, pää 16.18 px
```

**Mikä oli vialla.** `CAM_TOP_LEAD` kumoaa pehmennyksen *viiveen* eikä mitään
muuta, joten vauhtiin päästyään näkymä istuu tasan kohdassa
`pää − CAM_TOP_MARGIN` ja liikkuu kehon omalla nousuvauhdilla. Se on
vaaratonta kun pää saavuttaa marginaalin vasta lähellä lakipistettä, jossa se
vauhti on ~0 — ja se on nykäisy kun pää saavuttaa sen aikaisin. Ja **missä
kohtaa kaarta se tapahtuu, päättää rajaus eikä hyppy**: 2-1:n aavikkolattialla
`rest` haluaa 94 px ilmaa pään päälle ja kentän pohja pinnittää näkymän ennen
kuin se ehtii ottaa siitä takaisin, mutta sarakkeen 228 tiilihyllyllä pelaaja
saa ne 80 px jotka `CAM_EYE` oikeasti pyytää. Ne 14 px siirtävät ylityksen
78 px:n kohdalta 64:ään, jossa keho nousee vielä 3,9 px/frame.

Korjaus: näkymä kuluttaa kuvaa **jalkojen alta** aikaisin
(`CAM_GROUND_MARGIN`, kaksi laattaa eli tasan se paksuus josta jokaisen kentän
lattia on tehty, joten kentän omalla lattialla väljyyttä ei ole ja mekanismi on
aritmeettisesti poissa), ja se vapautuu sekä siitä miten pitkälle pää on tullut
ikkunan yläosaan että siitä **työnnetäänkö hyppyä yhä**. Jälkimmäinen on
kantava: saman kentän hylly sarakkeessa 38 on rajattu identtisesti ja tulee
45,8 px:n päähän kehyksen ylälaidasta tarvitsematta mitään — mutta se saapuu
sinne lakipisteessään, paikallaan. **Sijainti ei erota näitä kahta tapausta,
vauhti erottaa.**

Kaksi vaihtoehtoa rakennettiin ja mitattiin ennen tätä, ja molemmat ovat
kirjattuna vakion viereen: pidempi lead (mitattuna huonompi, 1,95 → 2,88) ja
katto näkymän omalle vauhdille — joka korjaa kehyksen (2,20) ja maksaa sen
toisesta lupauksesta (pelivara 16,10 → **15,29**).

### Kattavuus joka ei voi hiljaa lakata

Tämä oli vian tärkeämpi puolisko. Vanha kamerafikstuuri ei ollut koskaan
napannut tätä koska **sen botti kuolee 2-1:ssä aiemmin** — pääseekö se hyllylle
on palikkajärjestyksen sattuma. Uusi lohko ei aja bottia lainkaan: se **etsii**
kentästä sen hyllyn jonka pään päällä on vähiten kuvaa, asettaa pelaajan siihen
ja käsikirjoittaa hypyn. Se löysi `(227,9)`:n itse. Jos kenttädata liikkuu,
haku löytää uuden pahimman paikan; jos paikkaa ei löydy, jos rivi ei koskaan
ollut ilmassa tai jos näkymä ei liikkunut, väite kaatuu sen sijaan että
vihertäisi hiljaa.

**Sivunvaihto on koskematon rakenteeltaan** (pystykenttä palaa `cameraY()`stä
ennen leania) ja kaikki viisi sivunvaihto- ja kiipeilyriviä tulostavat
identtiset luvut. Neljä riviä tulostaa muuttuneet luvut, **jokainen kynnys
ennallaan ja kaikki läpi**; kolme niistä on parannuksia.

### Neljä ääntä, neljä tuomiota

- **`door` — jaettu.** Oven aukeaminen pitää `door`in; siitä sisään käveleminen
  sai `doorin`.
- **`onBossDefeated` — purettiin, mutta vain lainattu puolisko.** `clear`
  poistettiin: se on **kentän läpäisyjingle** ja se soi uudelleen 55 framea
  myöhemmin kun kenttä oikeasti päättyy. `door` jää, koska se on sen hetken oma
  ääni ja sillä on kuva. Hetki ei ohene — se mikä lähtee kuului toiseen hetkeen.
- **`powerup` — yksi merkitys.** Lohkon maksu → `payout` (mikä korjasi samalla
  `?`-lohkon, joka soitti `bump`ia eli sitä ääntä jonka tiili antaa kun se ei
  anna **mitään**); kytkin → `kytkin`; kasvaminen pitää `powerup`in. Valikot ja
  kartta pitävät omansa — kertojan puoli, kohta 8.
- **`SFX.land` — poistettu**, ja tilalle portti joka vaatii jokaiselle
  määritellylle äänelle kutsupaikan. Se löysi heti toisen, `SFX.card`, myös
  poistettu. Tiedostolista kävellään `main.js`:stä moduuligraafia pitkin
  (65 tiedostoa) eikä kirjoiteta käsin.

Huiput samasta ajosta: `payout` 0,260, `kytkin` 0,321, `doorin` 0,161 — vasten
`pipe` 0,168, `coin` 0,322, `powerup` 0,587. Melupohja jälkeen **0,000**.

### Löydetty, ei korjattu

- `powerup` soi yhä **kartalla** kun esine menee varastoon — tasan se vika joka
  kentän puolella korjattiin aamulla `reserve`llä.
- `powerup` soi yhä kahdessa esineenpudotuskohdassa `entities/enemies.js`:ssä.
- `LETTERBOX_BAR`:n kommentti väittää korkeimman hypyn nousevan 100 px; mitattu
  budjetti sanoo 174 juoksevalle pieruhypylle. **Vanhentunut väite.**
- 2-3:n hyllyllä rivillä 6 kamera on jo alarajassaan, joten pieruhyppy vie pään
  kehyksen reunaan (0,00 px). Kentän korkeus, ei moottorin korjattavissa —
  väitetty sellaisena.

---

## v26.08.10.57 — päivän pieru: generaattori selaimeen, ja tuhat kenttää tarkistettuna etukäteen

Omistajan valitsema toinen pelitila: **yksi generoitu kenttä päivässä, sama
kaikille, yksi yritys**, ja tulos jakoruudulle rivinä jossa ei ole
juonipaljastuksia.

Tilan hinta sanottiin ääneen jo ehdotusvaiheessa eikä se ollut yllätys:
`tools/gen-levels.mjs` on ollut käännösaikainen työkalu joka kirjoittaa
`src/data/generated.js`:n, ja **tämä tila on se joka pakotti generoinnin
selaimeen**. Se siirto on työn runko; päivittäinen kuori on pienempi puolisko.

### Siirto

`gen-levels.mjs`:n keskiosa — palat, teemat, `THEME_RULES`, `buildLevel`,
`validateGenerated` — siirtyi sanasanaisesti `src/data/generator.js`:ään.
Työkalu piti sen mikä on vain Nodea (`PLAN`, siemenhaku, telemetria,
korpustarkistus, tiedoston kirjoitus) ja vie `THEME_RULES`/`themeProblems`
edelleen, joten `verify.mjs` ei huomaa mitään. Mitatut luvut tulevat sivulle
`src/data/pacing.js`:n kautta, ja **työkalu lukee saman kopion** — peilistä
tuli siis se mistä toimitetut kentät oikeasti rakennetaan eikä lupaus.

Todiste että siirto ei muuttanut mitään: `gen-levels.mjs` tuottaa
`generated.js`:n md5 `c7ceafa7…` ennen ja jälkeen, ja työkalun tulostekin
diffaa puhtaana.

### Alkuperäisyys: aukko joka olisi ollut helppo lakaista maton alle

Selaimessa generoitu kenttä **ei voi** olla korpustarkistettu — korpus ei ole
repossa eikä koskaan toimiteta (kohta 3). Kenttä olisi siis rakenteellisesti
`not checked`, ja se on reikä kohdassa 1, siinä säännössä jonka varaan koko
projekti on rakennettu.

Ratkaisu: **luetteloi siemenavaruus etukäteen ja toimita vain tuomio.**
Päivän kenttä on päivämäärän funktio, joten avaruus on äärellinen.
`tools/daily-origin.mjs` (kieltäytyy ajamasta ilman `VGLC_DIR`) generoi jokaisen
päivän ikkunassa, vertaa korpukseen samalla kahdeksan sarakkeen ikkunalla kuin
toimitetut kentät, ja kirjoittaa vain tuomion: rajat, yksi 36-kantainen
yritysnumero per päivä, sormenjälki. Ei korpusta, ei kenttädataa — **yksi luku
päivää kohden ei ole kenttäkartta.**

Ensimmäinen ajo: **1096 päivää (10.8.2026–9.8.2029), 481 korpustiedostoa, 0
osumaa**, 7295 siementä hylättynä sääntöjen ja 40 botin toimesta.

Kaksi asiaa tekee tästä tarkistuksen eikä väitteen:

- **Sormenjälki on kenttien omista tavuista** ja `verify.mjs` laskee sen
  uudelleen. Muuta generaattoria, rytmilukuja, hyppybudjettia tai päivän
  reseptiä ja tuomio koskee eri kenttiä kuin ne jotka pelaaja saa — **portti
  menee punaiseksi silloin ja vain silloin.** Kalenteri ei tee siitä punaista;
  umpeutuva ikkuna on tulostettu varoitus (alle 90 päivää), koska pysyvästi
  punainen portti kytketään pois.
- **Ikkunan ulkopuolella tila ei tarjoa kenttää lainkaan.** Tämä on
  tarkoituksella tiukempi kuin `origin: 'not checked'` toimitetuissa kentissä:
  toimitettu kenttä on maailmassa jonka pelaaja valitsi, päivän kenttä
  *tarjotaan päivän kenttänä* ja lähtee rivinä muille ihmisille.
  **Tarkistamaton päivän kenttä on huonompi kuin ei päivän kenttää.**

### Voimataso 0: mitä takuu kattaa ja mitä ei

| | todistaa |
| --- | --- |
| `validateLevel` + `themeProblems`, sivulla, joka kerta | ruudukon geometrian: kuilut mitattua budjettia vasten, seinäkorkeus, tehostus ensimmäisessä neljänneksessä, ei portaita tyhjään. **Ei simulaatio** — `rules.js`:n oma varaus |
| botti, Nodessa, ennen kuin päivä pääsee todistukseen | että joku pääsee alusta maaliin voimatasolla 0, oikealla kitkalla ja liikemäärällä. Siemen jonka botti kaataa **korvataan**, ei tarkastella käsin |
| sormenjälki | että molemmat yllä tehtiin **tasan niille** kentille jotka peli rakentaa |

Ei kata: botti ei osaa kellulavoja, kyykkyä, putkia, kuoren potkimista eikä
odottamista, eikä mikään tässä sano että kenttä on **hyvä**. Samat rajat kuin
60 toimitetulla kentällä — takuu siirtyi ajassa, ei heikentynyt.

### Aikavyöhyke ja yritys

**UTC**, myös ruudulla näkyvä päivämäärä. Yksi kello on tilan edellytys
(Helsingin ja Kalifornian eri mieltä oleminen tekisi jakorivistä vertailun
tyhjäksi), ja UTC on ainoa kello joka jokaisella selaimella on ilman
aikavyöhyketietokantaa (kohta 7). Hinta kirjattu koodiin: suomalainen pelaaja
klo 00–02 saa eilisen kentän **ja eilisen päivämäärän** — kenttä ja päiväys ovat
keskenään samaa mieltä, mikä on tärkeämpää kuin seinäkalenterin kanssa.

Yritys kuluu kun kenttä **alkaa**. Uudelleenlataus kesken kentän ei ole uusi
yritys eikä nolla vaan **luovutus siihen sarakkeeseen johon ehdit**, minkä takia
eteneminen kirjoitetaan puolen sekunnin välein. Oma avain `sfb3.daily.v1`:
se vanhenee päivittäin eikä ole etenemistä, joten sen muoto ei saa koskaan
pakottaa versionostoa joka pyyhkisi kaikkien elämät ja maailmat.

### Kaksi tilaa samana päivänä, ja niiden yhteentörmäys

Aika-ajo tuli tuntia aiemmin, ja molemmat lisäsivät valikkorivin. Portti sai
tästä oman väitteensä, ja se kirjoitettiin ajamaan **oikeaa** `TitleScene`ä
eikä omaa kopiotaan valikosta — ensimmäinen versio kovakoodasi oman listansa ja
olisi jäänyt mittaamaan neljää riviä ruudulla jossa on viisi:

```
punainen  5 riviä 263, 4 riviä 250   (ruudun viimeinen rivi 239)
vihreä    5 riviä 239, 4 riviä 239
```

Ja uusi väite siitä että päivän yritys **ei ole aika-ajo**: yksi yritys ei voi
tuottaa ennätystä, ja ennätys avaimella `PP` olisi huomenna eri kenttä.

### Tallennuspäätökset eivät ole ristiriidassa

`bestTimes` meni **sisään** `sfb3.save.v2`:een koska ennätysaika on kertynyttä
etenemistä; päivän tulos jää **ulos** koska se vanhenee huomiseen mennessä.
Lause lisätty DESIGN.md:hen jottei niitä lueta toistensa vastakohdiksi.

### Löydetty, ei korjattu

- **4-3 kaatuu yhä voimatason 0 botilla** (vanha; käytettiin tässä punaisena
  fikstuurina).
- Päivän ajot kirjoittavat telemetriaa kenttätunnuksella `PP`, jolloin
  `gen-levels.mjs --telemetry` tulostaa `ignored PP`.
- `secrets.js`:n välimuisti pitää eilisen listan sivuistunnossa joka ylittää
  UTC-keskiyön. Tässä tilassa ei näytetä salaisuuslaskuria, joten se on
  näkymätön.
- Todistettu ikkuna päättyy **9.8.2029**. Uusiminen on yksi komento.

---

## v26.08.10.56 — neljä hiljaista tilanvaihdosta sai kuvan ja äänen

Omistaja: *"we need more AUDIO VISUAL feedback on P meter filling up! and the
player going down the pipe etc. various state & level changes need to be
signalled."*

Kaksi nimettyä tapausta ja avoin luokka. Avoin luokka otettiin vakavasti:
**peli käytiin läpi ja jokainen tilanvaihdos sai tuomion**, myös ne jotka
jätettiin rauhaan. Lista on `tools/verify.mjs`:n kommentissa; tässä sen tulos.

### Neljä korjattua

| vaihdos | mitä puuttui | mitä lisättiin |
| --- | --- | --- |
| vauhtimittari täyttyy | HUD-pipit vilkkuivat 320×240-ruudun alalaidassa, **ei ääntä**. Mitattuna vain 3772/66560 px **pelialueesta** muuttui | `pfull` + pelialueen pulssi |
| vauhtimittari lakkaa olemasta täysi | yksi pippi tummeni, **ei ääntä** — vaikka nopeuskatto putosi 3,5 → 2,5 | `pspent` |
| lento loppuu ilmassa | painovoima muuttui, muuta ei. **Äänetön ja näkymätön** | sama `pspent`, koska se on **sama tilanvaihdos** eikä toinen |
| putkesta ulos | 4 kaasupilveä ja `door`, lainattuna | `pipeout` |
| varalokero täyttyy | soitti `powerup`in, eli peli sanoi "kasvoit" kun mikään ei kasvanut | `reserve` (vain ääni) |

Lennon loppuminen taitettiin mittarin tyhjenemiseen eikä omaksi merkikseen, ja
se on kohta 8 sovellettuna: **yksi tilanvaihdos, yksi merkki.** "Tehoste loppui"
ja "lento loppui" ovat pelaajalle sama tapahtuma.

### Ja neljätoista jätettiin rauhaan, mikä on merkinnän tärkein osa

Kohta 8 tekee liikamerkitsemisestä **vian**, ei vaaratonta kiillotusta.
[IDEAS.md](IDEAS.md) hylkäsi kokonaisen mekaniikan tällä perusteella (nouseva
vesi luolakaistassa, koska Griegin raita jo kiihtyy). Siksi:

- **Kello alle sadan** sai jäädä: `timewarn`, musiikin kiihdytys **ja** HUDin
  punainen `AIKA` — kolme merkkiä jo, ja neljäs olisi ollut nousevan veden vika
  sanasta sanaan.
- **Salaisuuden löytyminen** on tarkoituksella merkitsemätön sellaisenaan:
  palkinto itse on merkki, ja "löysit salaisuuden" -merkki olisi se toinen.
- **Tähden ja ummetuksen loppuminen** jätettiin hiljaisiksi, ja perustelu on
  mitattu eikä arvattu: molemmilla on jo **ennakoiva** merkki (sekuntilaskuri,
  joten hetki ei voi yllättää), ja molempien kuva on **pelaajassa itsessään**
  eikä HUDissa — siinä mihin silmä jo katsoo. Ja jokainen ääni joka sopisi
  merkitykseen "hyvä asia loppui" osuisi `powerdown`in viereen, joka tarkoittaa
  aineellisesti eri asiaa. Lähisukuinen ääni siinä kohdassa opettaisi tasan sen
  väärinluennan josta kohta 8 varoittaa.

### Mitattu ääni, ei arvioitu

| uusi | huippu | vertailukohta samasta ajosta |
| --- | --- | --- |
| `pfull` | 0.350 | `coin` 0.322, `powerup` 0.567 (katto) |
| `pspent` | 0.161 | puolet `pfull`ista tarkoituksella — se laukeaa aina kun juoksu päästetään |
| `pipeout` | 0.169 | `pipe` 0.168 — putken kaksi päätä ovat nyt saman kokoisia |
| `reserve` | 0.234 | `bump`-luokkaa, mekaaninen eikä palkitseva |

Melupohja kaiken jälkeen **0.000**: mitään ei peitetty eikä pohjaan lisätty.

### Mittausvika joka olisi julistanut äänen olemattomaksi

`reserve` mittautui aluksi **0.000**:ksi. Ääni on 95 ms ja analysaattorin
ikkuna oli 2048 näytettä eli 46 ms — portti olisi siis todennut hiljaiseksi
äänen jonka kaiuttimet soittavat. Ikkuna on nyt 16384 näytettä, pidempi kuin
mikään mitä se mittaa (sama korjaus ja sama syy kuin konsonanttilohkossa).
**Korjattiin testi eikä kynnystä.**

### Löydetty, ei korjattu

- **`door` tarkoittaa yhä kahta asiaa**: linnakkeen oven aukeamista ja siitä
  sisään kävelemistä. Lievempi kuin putkitapaus, mutta samaa lajia.
- **`onBossDefeated` soittaa `clear`in ja `door`in samalla framella**, päälle
  musiikin uudelleenkäynnistys, tärähdys ja pistepomppu. Se on kohdan 8 omalla
  mittarilla liikamerkitsemistä; purkaminen muuttaisi pelin suurinta hetkeä,
  joten se on raportoitu eikä koskettu.
- **`powerup` on pelin lainatuin ääni**, 12 kutsupaikkaa.
- **`SFX.land` on kuollutta koodia** — määritelty, ei koskaan soitettu.

HUD-rivejä ei koskettu yhtäkään: pulssi piirretään `LevelScene.draw()`ssa
`ctx.restore()`n ja `drawLetterbox`in välissä, ja `drawHud` on tavulleen
ennallaan. Varalokeron korjaus on pelkkä ääni juuri siksi.

---

## v26.08.10.55 — AIKA-AJO: kello jota vastaan ajetaan on oma ennätys

Omistaja valitsi tämän pelitilaksi kahdeksan ehdotuksen joukosta. Peruste oli
että **peli pitää jo nopeutta pointtina muttei sano sitä ääneen**: maali maksaa
`jäljellä oleva aika × 50`, eli pisteytyksellä on tästä jo mielipide.

Tila avataan alkuvalikosta. Kentän oma ennätysaika, elävä ero kahdeksassa
välipisteessä, tilalatausten kieltäminen, kello joka käy taukovalikossa, ja
`5` nollaa ajat vahvistuksen kanssa.

### Pitchin oma väite ei kestänyt mittausta

Sanoin ehdotusta esitellessäni että *"par-aika on jo laskettu jokaiselle 60
kentälle"*. **Se ei pidä paikkaansa.** `defaultTime` antaa 1,3 yksikköä
(31,2 framea) saraketta kohden, kun täysillä juostu kierros maksaa 6,4 framea
saraketta kohden. Kenttäkello on siis **4,8–4,9-kertainen** täysillä juostuun
kierrokseen nähden kaikissa 60 kentässä (pienin 4,8× kentässä 4-6, portissa
pysyvänä mittauksena).

Se on **määräaika, ei tavoiteaika**: jokainen pelaaja istuisi minuutin sen
edellä joka kentässä, eikä sellaista vastaan aja kukaan. Vertailukohta on siis
pelaajan **oma** ennätys, ja "ei ennätystä" on suunniteltu tila eikä
reunatapaus — himmeä `--.-` täsmälleen niissä pikseleissä joissa oikea lukema
tulee olemaan, ja maalin jälkeen `AIKA KIRJATTU 1:20.4`, jottei ensimmäinen
läpäisy ole hiljainen.

### HUD, mitattuna eikä silmämääräisesti

Ero mahtuu nauhan ainoaan aukkoon: elämät loppuvat sarakkeeseen 153, `MAAILMA`
alkaa 196:sta, ja levein ero (nuoli 5 px + väli 2 + `+9999` 29 px) on 156–192.

```
ok  aika-ajon lukema ei peitä yhtään olemassa olevaa HUD-pikseliä
    [uutta mustetta 471 px, peitettyä 0 px, laatikko x 155-185 y 5-13,
     lähin vanha muste 3 px]
```

**Kulunutta aikaa ei piirretä lainkaan**, koska se on `AIKA` väärinpäin:
kaava täsmää **900/900 framella**. Kohta 8 kieltää kaksi samaa asiaa sanovaa
merkkiä, ja tässä toinen niistä olisi ollut sama luku toisin päin. Itse ero ei
ole kellon kopio: sama `AIKA 440` antaa `+4.7` tai `+3.7` riippuen vain
tallennetusta ennätyksestä.

Rakennuksen aikana löytyi toinen punainen, mittaamalla eikä katsomalla:
maalirivi peitti läpäisybannerin. **`drawBanner` käyttää mittakaavaa 3
ensimmäiset 8 framea**, joten näennäisesti tyhjä väli on 7 px matalampi kuin
miltä näyttää. `uutta mustetta 1434 px, peitettyä 2304 px` → `peitettyä 0 px`.

### Tauko: ajokello käy, kenttäkello seisoo

Mitattu: 120 framea taukoa → ajokello 0→120, `AIKA` 460→460. Perustelu oli jo
kirjoitettuna `updateTimer`issa: kello joka voi tappaa pelaajan paikassa jossa
hän ei voi tehdä mitään. Valikko on täsmälleen se paikka. **Tauko maksaa eron,
ei koskaan henkeä**, ja valikko sanoo sen itse (`TAUKO - KELLO KÄY`).

**Alt-tab on kirjattu aukko eikä korjattu.** Taustalla oleva välilehti ei aja
frameja, eikä seinäkelloon siirtyminen sulje sitä halvalla: `Game.frame`
kaventaa yli 250 ms:n askeleen yhdeksi, ja ilman sitäkin silmukka ajaa
korkeintaan viisi askelta framessa. Seinäkelloon siirtyminen olisi
aika-askeleen uudelleenrakennus, joka tekisi hitaasta koneesta häviäjän samalla
pelaamisella.

### Tavallinen kierros ei liikkunut — todistettuna

- Sama kenttä, sama syöte, sama siemen, tila päällä vs pois: **600 framea, 0
  eroa** sijainnissa, nopeudessa, kellossa, pisteissä, kolikoissa, kamerassa.
- Käännösten välillä (`3d84e77` vs tämä): 5 kenttää × 2 voimatasoa × 600 framea
  + 30 koko ruudun tiivistettä + molemmat vanhat valikkopituudet →
  md5 **identtinen**.
- `difficulty.mjs` ja `playable.mjs` tavulleen samat, `src/data/difficulty.js`
  ei liikkunut riviäkään.

### Tallennusyhteensopivuus molempiin suuntiin

`bestTimes` menee sisään ilman versionostoa, `secrets`/`continues`-ennakkotapauksella.
Vanha tallennus → uusi käännös: 12/12 vanhaa kenttää ehjänä. Uusi → vanha
lataaja: sama. **Rehellinen hinta kirjattuna `save.js`:ään:** vanha käännös
jättää avaimen lukematta ja pudottaa sen kirjoittaessaan, eli vanhalla
käännöksellä pelaaminen pyyhkii ajat. Se on ainoa kenttä jonka menetys ei maksa
etenemistä.

### Tähtimerkintää ei kahdennettu

`usedSaveState` asetetaan yhä vain `quickLoad`in onnistumishaarassa, johon
aika-ajo ei koskaan pääse — merkintä ei siis voi syntyä eikä sitä tarvinnut
vaimentaa. Myös pikatallennus kieltäydytään: tilannekuva jonka peli lupaa ottaa
mutta kieltäytyy palauttamasta on lupaus jota se ei pidä.

### Löydetty, ei korjattu

- Alkuvalikossa ei ollut tilaa neljännelle riville: 13 px riviltä olisi vienyt
  vihjerivin y-koordinaattiin 244 eli ruudun ulkopuolelle. Korjattu
  `panelY = Math.min(184, 240 − 11 − panelH)`, joka on tavulleen sama kahdella
  ja kolmella rivillä. Neljällä rivillä paneeli tummentaa kävelevän hahmon
  kaksi alinta riviä — kosmeettista, hyväksytty, katsottava jos viides rivi
  joskus tulee.
- Nollausnäppäin `5` on toimeton tilan ulkopuolella ja dokumentoitu vain tilan
  sisällä.
- Pystykentät ottavat y-akselin `raceProgress`issa, kirjoitettuna ja
  perusteltuna muttei ajettuna: yksikään toimitettu kenttä ei vielä ole pysty.

---

## v26.08.10.54 — luulinnake ei ole pilvilinnake: kahdeksan linnakesanastoa

`tools/variety.mjs` mittasi eilen illalla asian jota kukaan ei ollut etsimässä:
**puolet pelin linnakkeista ei tuonut peliin yhtään uutta muotoa.** 6-F, 7-F ja
8-F toivat 0.0 %, 3-F 3.0 %. Seitsemän jaettua `fort_*`-palikkaa eri
järjestyksessä kahdeksan kertaa. Omistaja ratkaisi: **jokaiselle maailmalle oma
linnakesanasto.**

### Muoto, ei paletti

Uusi `src/data/chunks/fortresses.js` kantaa kahdeksan sanastoa
(`root_ kiln_ frost_ mill_ pyre_ crypt_ spire_ throne_`, 5–7 palikkaa kukin).
Yksi tiedosto eikä kahdeksaa, koska `bone.js` ja `cloud.js` kantavat portteja
jotka vaativat avointa taivasta — katettu käytävä niissä olisi tarvinnut
hiljaisen poikkeuksen portin sisään.

Ratkaiseva rajaus on että jokaisella on **rakenteellinen lause**, ei väri.
Omistaja oli jo sanonut ettei teemakohtaista laattamuotoa tarvita — nykyinen
skinnaus riittää — ja saman pohjan uudelleenvärjäys olisi mitannut identtisesti.
Siksi:

| maailma | lause |
| --- | --- |
| w1 `root_` | kaksi lattiaa |
| w2 `kiln_` | ei yhtään kuoppaa |
| w3 `frost_` | lattia joka ei kanna |
| w4 `mill_` | koneisto pään päällä |
| w5 `pyre_` | kaikki on ylitystä |
| w6 `crypt_` | reitti menee alas |
| w7 `spire_` | reitti menee ylös |
| w8 `throne_` | huone kutistuu `HEAD`in korkuiseksi |

### Mitattu, kaikki kahdeksan johdotettuna

| linnake | ennen | nyt |
| --- | --- | --- |
| 1-F | 100.0 | 100.0 |
| 2-F | 14.3 | **85.7** |
| 3-F | **3.0** | **83.8** |
| 4-F | 37.9 | **86.2** |
| 5-F | 31.4 | **61.4** |
| 6-F | **0.0** | **75.0** |
| 7-F | **0.0** | **82.2** |
| 8-F | **0.0** | **65.1** |

Kierrätyslista 7/44 → **2/60**, ja linnakkeita siinä 4 → **0**.

**Yksi luku ei ole voitto vaan siirto, ja se pitää sanoa.** 2-F nousi
14.3 → 85.7 ilman että siihen alun perin kosketttiin: mittari on
järjestysriippuvainen, ja 2-F:n `fort_*`-muodot olivat "jo nähtyjä" vain siksi
että 1-F näytti ne ensin. 1-F taas oli jo 100 % eikä voinut nousta — siellä
todellinen muutos on muotojen määrä 96 → 124 ja tyhjien ikkunoiden osuus
33.7 % → 13.0 %.

### Portti, punainen ennen vihreää

```
punainen 1  linnakesanastoja ei päästy lukemaan: Cannot find module …/fortresses.js
punainen 2  omasta sanastostaan rakennettuja linnakkeita 0, vaadittu 3
vihreä      8/8 linnaketta omasta sanastostaan — 1-F 100 % … 8-F 100 %
```

Väite tarkistaa kolme asiaa: sanastot ovat olemassa ja erillisiä (johdettuna
yhdestä taulukosta eikä toisesta listasta), yksikään linnake ei sekoita kahden
maailman sanastoa (tämä on liittämisvirheen vahti), ja omasta sanastostaan
rakennettuja on vähintään kolme — räikkä joka kiristyi kahdeksaan kun loput
viisi soittolistaa liitettiin.

### Väite joka todisti itsensä tyhjäksi

Uusi 1-F kaatoi portin *"the boss cannot leave its arena and fall out of the
level"*. Syy oli **voittoanimaatio**: `Boss.stomp` antaa kaadetulle pomolle
`noclip`in ja pudottaa sen kentän alle — tasan se ehto jolla testi tunnisti
karanneen pomon. Ja väitteen oma suoja oli `!s.bossDefeated === !s.bossDefeated`,
joka on aina tosi: rivi näytti tarkistavan voiton eikä tarkistanut mitään.
Ehto lukee nyt vain elävää pomoa, ja tilatallennustarkistus sai oman tuoreen
skenensä — tallennus jossa pomo on jo kaadettu ei voi kertoa mitään siitä
palaako pomo takaisin.

### Integroinnissa: kuori linnakkeen kynnyksellä

Viisi soittolistaa liitettiin tässä. Yksi kaatui heti: **`spire_hole` panee
kuoren omaan viimeiseen sarakkeeseensa**, joten soittolistan päättäminen siihen
jätti kuoren aivan areenan ovelle, ja voimatason 0 pelaaja kuoli ennen kuin
pomon ikkuna ehti aueta (`7-F: osui framella -1/120`). Viimeinen palikka on nyt
`spire_hail`. Sama vika kuin kurnuttajan merkissä kaksi merkintää sitten:
**palikan reunaan asetettu olio on sommitteluvika, ei sisältövirhe.**

### Vaikeus

Kahdeksan linnakkeen luku muuttui, **muut 52 kenttää ovat ennallaan**. Käyrä
nousee joka maailmassa: 112.8 · 132.5 · 180.7 · 191.3 · 233.2 · 251.2 · 253.7 ·
290.8.

**Kapein marginaali on w6 → w7, +2.5 pistettä**, ja se on kirjattava eikä
piilotettava: se on koko pelin tiukin kohta, ja seuraava kenttämuutos
maailmoissa 6 tai 7 kääntää sen helposti laskuksi. 6-F ja 7-F kantavat
neljänneksen maailmansa keskiarvosta.

`playable.mjs`: **5-F oli tähän asti rikki** (`VAATII TUPLAHYPYN 32 %`,
`fort_trench`in yhdeksän ruutua laavaa ja yksi lauta) ja on nyt läpäistävissä
voimatasolla 0. Jäljelle jää vain 4-3, joka on vanha eikä tästä.

### Jäi tekemättä

`fort_hall`, `fort_gap`, `fort_spikes`, `fort_blocks`, `fort_pillars`,
`fort_burn` ja `fort_trench` ovat nyt **kuollutta koodia** — yksikään linnake ei
enää käytä niitä. Ne kuuluvat pois samalla perusteella jolla `bone_twin`
poistettiin, mutta poisto on oma muutoksensa oman punaisensa kanssa.

Ja yksi korjaus omaan aiempaan väitteeseeni: sanoin `fort_gap`in esiintyvän
**28 kertaa**; mitattuna kenttädatasta se on **20 paikassa seitsemässä
maailmassa**. Havainto oli oikea, luku ei — ja jaetuin palikka ei ollut
`fort_gap` vaan `fort_power`, joka oli kaikissa kahdeksassa.

---

## v26.08.10.53 — kurnuttaja opetusmittariin, ja kuusi kuoppaa joista ei ehtinyt pysähtyä

Omistajan ratkaisu riitaan oli **korjaa 2-1, pidä sääntö ehdottomana** — ei
poikkeusta, ei kirjattua varausta. Tämä merkintä on se työ, ja se paljasti
vian joka oli kuudessa kentässä.

### Riita oli proosaa, ei koodia

Portissa ei ollut `disputed`-lippua eikä RIITA-osiota siinä puussa jossa työ
tehtiin: riita oli **25 rivin kommentti** `ENEMY_NAMES`in yllä, joka perusteli
miksi riviä ei saa lisätä. Rivin lisääminen oli siis koko purkaminen.
`U: 'kurnuttaja'` on nyt tavallinen rivi, ja kommentti on kirjoitettu
uudelleen muotoon *mitä uskottiin, mitä mitattiin, mikä muuttui* — vanhaa
päättelyä ei poistettu, koska se on osa sitä miksi tässä on nyt näin.

### Punainen, kun rivi lisättiin eikä muuta

```
FAIL kahta ensiesittelyä ei ole saman 20 laatan ruudun sisällä
     [3/27: enemy_p@2-1:101 enemy_H@2-1:134 enemy_U@2-1:119]
FAIL yksikään kenttä ei esittele yli kolmea uutta asiaa
     [2-1 4: enemy_p enemy_A enemy_H enemy_U]
```

**Levittäminen yksin ei riittänyt.** Kolmen raja tarkoitti että yhden neljästä
oli lähdettävä 2-1:stä. Närästysliekki oli ainoa siirrettävä — aurinkoa ei ole
missään muualla, kasvin luovutti juuri 1-2, ja kurnuttaja on koko pointti — ja
se laskeutui 2-2:een, joka seuraa **molemmilla reiteillä**, joten se siirtyi
yhden kentän eikä yhtä haaraa.

| | aurinko | kasvi | kurnuttaja | liekki | välit |
|---|---|---|---|---|---|
| ennen | 71 | 101 | 119 | 134 | 30, **18**, **15** |
| nyt | 71 | 101 | 197 | → 2-2 | 30, 96 |

### Ja sitten se oikea löydös: jarrutusikkuna

Voimatason 0 jarrutusmatka on **56 px eli 4 laattaa**, joten ikkuna jossa
pelaaja voi vielä pysähtyä on `[merkki−4, merkki−1]`. Merkki oli kuilun
**keskellä**, ja keskeltä laskettuna ikkunan kaksi viimeistä saraketta olivat
jo ilman päällä:

| | merkki | kuilu | ikkuna | maata ikkunassa |
|---|---|---|---|---|
| `pit_croak` ennen | 7 | 5–10 | 3–6 | **2 / 4** |
| `pit_croak` nyt | 5 | 5–10 | 1–4 | **4 / 4** |
| `keep_croak` ennen | 11 | 9–13 | 7–10 | **2 / 4** |
| `keep_croak` nyt | 9 | 9–13 | 5–8 | **4 / 4** |

Pelaaja joka näki olennon ja päästi napista irti oikealla hetkellä **ei silti
ehtinyt pysähtyä**. Se ei ole vaikeus vaan virhe, ja se oli tosi kuudessa
kentässä: 2-1, 3-3, 8-3, 8-4, 8-5 ja 8-F.

Korjaus siirtää **merkin, ei kuiluja**: kuilut ovat yhä kuusi ja viisi laattaa,
yksikään sarake ei liikkunut, joten `pit_s`:n kanssa mitattu vaikeusvastaavuus
säilyy ja olento on yhä lattiattomassa sarakkeessa. `difficulty.js` ei muuttunut
yhdeltäkään riviltä.

Se on myös parempaa peliä. Loikka on pystysuora, joten vaara on tasan **yksi
sarake**; lähireunalla se sarake osuu ponnistukseen, jota pelaaja yhä ohjaa,
eikä lakipisteeseen, jota kukaan ei ohjaa.

### Uusi väite, koska tämä löytyi vahingossa

Vika löytyi vasta kun opetusmittari sai kurnuttajalle rivin — eli
**kertaalleen, kolmannen työkalun sivutuotteena**. Vanha portti mittasi kuilun
**leveyden** (pääseekö yli) muttei koskaan sitä pääseekö **pysähtymään**.

```
ok  kurnuttajan eteen mahtuu koko jarrutusmatka maata
    [6 kuoppaa, jokaisen edessä 4/4 laattaa maata]
```

Väite ei kysy mistä palikasta kuoppa tuli, vaan mittaa jokaisen merkin oman
ympäristön. Todistettu punaiseksi palauttamalla vanha palikka:
`2-1 @199: ikkuna [195, 198] 2/4 maata; 3-3 @304: 2/4 maata`.

### Väliaikainen palikka eli tasan sen elinkaaren jonka se lupasi

Työ tehtiin haarassa jossa `chunks/common.js` oli toisen agentin hallussa,
joten 2-1 sai hetkeksi oman `pit_croak_rim`-palikan ja oman koostajan. Korjaus
on nyt siellä minne se kuuluu, joten palikka, koostaja ja `rows:`-poikkeus on
poistettu ja 2-1 on taas tavallinen soittolista. Väliaikaisen ratkaisun arvo on
nolla jos kukaan ei tiedä milloin se saa poistua.

### Löydetty, ei korjattu: kamera 2-1:ssä

Pelaajan tavoitettavissa oleva vika, joka **ei** ole tästä työstä ja joka on
toimitetussa 2-1:ssä nytkin: voimatasolla 3 tiilillä sarakkeessa 228 seisten
pieruhyppy nostaa kuvaa **2.85 px yhdellä framella** (katto 2.5) ja pää on
tasan **16.00 px** ylhäällä (lattia 16). Portin kamerafikstuuri ei ole
napannut sitä koska sen botti kuolee 2-1:ssä aiemmin — se pääseekö tiilille
asti on palikkajärjestyksen sattuma. Kuuluu tiedostoon `src/scenes/level.js`.

---

## v26.08.10.52 — ylös on suunta: sivuttain vaihtuva kamera, ja kolme työkalua jotka oppivat kiipeämään

Omistaja pyysi pilvimaailmaan **pystykentän**: kiivetään tasanteelta toiselle,
putoaminen ei tapa vaan pudottaa alemmas ja kiivetään uudestaan. Tämä muutos
ei tee kenttää — sen sijoittaa myöhempi tekijä — vaan **kyvyn**, ja todistaa
sen `tools/verify.mjs`:n koekentällä samasta syystä kuin karttavieritys
todistettiin koemaailma `wL`:llä: kyky jota kokeillaan vain sillä sisällöllä
jonka se on siunaamassa ei ole kokeiltu.

Ja koko työn kova reunaehto oli, että **mikään olemassa oleva ei saa liikkua**:
toinen tekijä virittää samaan aikaan kuuttatoista kenttää nykyistä mittaria
vasten. Se ei ole väite vaan mittaus, kolmesti:

| mitattu | ennen ja jälkeen |
| --- | --- |
| `node tools/difficulty.mjs` (myös `--raw` ja `--json`) | tavulleen sama, md5 `ec331323…` / `3d452afe…` / `75e659af…` |
| `PW_MODULE=… node tools/playable.mjs` | tavulleen sama, md5 `cc7c683f…` |
| kameran rata: `cam.x`,`cam.y` neljän desimaalin tarkkuudella, 44 kenttää × 2 voimatasoa × 900 framea = **55 684 framea** | tavulleen sama, md5 `094fc014…` |

Kolmas on omistajan oma vaatimus tältä illalta — *"vaakakentissä pystysuoran
kameran pitää seurata pelaajaa kuten nyt"* — eikä sitä voi väittää
rakenteesta, koska rakenne on juuri se mikä muuttui. Sen lisäksi `verify.mjs`
ajaa jokaisen kentän 600 framea ja kysyy paljonko se vaihtoi sivua: **44
kenttää, 0 sivunvaihtoa.**

### 1. Kamera: paikallaan, sivunvaihto, paikallaan

Omistajan sanoin: *"hahmo pysähtyy siihen, ja sitten kamera kallistuu alas… ja
peli jatkuu niin että hahmo on ruudun yläreunassa. Silloin alaspäin mennessä
näet mitä alla on."*

**Liipaisin on `camAnchor`, ja se valinta on koko suunnittelu.** Ankkuri on se
viimeinen jalkalinja johon pelaaja oikeasti *asettui*: se liikkuu sillä
framella jolla jalat koskettavat, se seuraa putoamista sillä framella jolla se
tapahtuu, eikä se liiku nousevan kaaren aikana. Siitä seuraa kolme asiaa jotka
kaikki ovat mittauksia eivätkä toiveita:

1. **Sivunvaihto ei voi katkaista hyppyä kesken nousun** — mitattuna
   koekiipeilyssä **0/5**, voimatasolla 0 ja 5, sekä leikkauksena että 12
   framen panorointina.
2. **Se ei voi värähdellä.** Päähän ripustettu sivunvaihto nousee kaaren
   huipulla ja putoaa takaisin lähtölavalle, joka on nyt uuden ruudun alapuolella
   — ja vaihtaa heti takaisin. Se ei ole viritettävissä pois: turvallinen
   sivunvaihto on `viewH − 32 − h − J`, mikä isoimmalla keholla ja pieruhypyllä
   on **−41 px**.
3. **Putoaminen vaihtaa sivua heti**, koska ankkuri seuraa laskua. Kiipeilyssä
   putoaminen on tavallista, joten alla oleva pitää näkyä jo ilmassa.

**Ja tämä on kova leikkaus tarkoituksella, ei `CAM_SNAP` palaamassa.**
Perustelu on kirjoitettu `level.js`:ään neljänä kohtana, koska se on juuri se
asia jonka seuraava lukija tulkitsee väärin: `CAM_SNAP` laukesi *etäisyydestä*
(48 px, sääntö virheen koosta) ja laukesi siksi tavalliseen laskeutumiseen;
tämä laukeaa *ylityksestä* (keho on poistunut nimetyltä kaistalta, sääntö
paikasta kuvassa). `CAM_SNAP` oli kiinniottoa easen päällä; tämä on ainoa asia
joka kuvaa liikuttaa. `CAM_SNAP` mitattiin **0 laukeamaan 30 kentässä**; tämä
laukeaa rakenteesta viisi kertaa koekiipeilyssä. Ja `CAM_SNAP` koski jokaista
kenttää; tämä ei kosketa yhtäkään olemassa olevaa.

**Ruutu on 13 ruutua ja hyppy 5,3 — joten koko ruudun sivunvaihtoa ei ole.**
Omistaja pyysi ruudullista; aritmetiikka kieltää sen. Sivunvaihdon jälkeen
ankkurin on jäätävä niin kauas vastakkaisesta kaistasta, ettei yksi tavallinen
askelma työnnä sitä takaisin yli, eli `CAM_PAGE_LAND − CAM_PAGE_EDGE` (112−32 =
80 px) > yksi askelma (64 px). Yli jää **64–112 px, 4–7 ruutua**. Se on
mitattu raja eikä varovaisuus, ja se lukee koodissa lukuina.

**Pää ei silti pysyisi ruudussa pelkällä sivunvaihdolla**, ja se on toinen
saman aritmetiikan seuraus: viimeinen lava ennen sivunvaihtoa voi olla
`CAM_PAGE_EDGE`:n päässä ylälaidasta, ja hyppy siitä nousee askelman +
ylityksen + kehon = 77 px. Ilman kattoa mitattiin **45,31 px päätä ruudun yli**
jokaista sivunvaihtoa edeltävällä hypyllä. Ratkaisu ei ole uusi vaan vanha:
`CAM_TOP_MARGIN`, sama turvaverkko jonka tavallinen kamera jo dokumentoi
sanoilla *"raja, ei kohde… nostaa kuvaa vain sen verran kuin on pakko"*. Sen
kanssa **0,00 px**, ja hinta on kirjattu sellaisena kuin se on: katto on se
sitova termi 167 framella 779:stä voimatasolla 0 ja 365:llä 777:stä tasolla 5.

**Jäädytys: rakennettiin molemmat, mitattiin molemmat, ja suositus on ilman.**

| sivunvaihto | ohjausta pois | uusi maa näkyy | kesken nousua | kiipeäminen |
| --- | --- | --- | --- | --- |
| 0 framea (leikkaus) | **0 framea** | samalla framella | 0/5 | 779 framea |
| 12 framea (panorointi) | 60 framea | 12 framen päästä | 0/5 | 899 framea |

Jäädytys ostaa tasan yhden asian: se estää pelaajaa toimimasta kuvasta jota ei
ole vielä lukenut. Ankkurisääntö osti sen jo — sivunvaihto tapahtuu vain
laskeutumisella tai putoamisessa, ei koskaan nousevan kaaren aikana — joten
jäädytys maksetaan tyhjästä kahdesti: uusi maa näkyy kokonaisen sivunvaihdon
*aiemmin* ilman sitä, ja sekunti kiipeilyä palautuu. `camPageFrames` jää silti
kentän kenttänä, koska taulukko yllä on mittaus ja mittauksen pitää olla
toistettavissa; `verify.mjs` ajaa saman kiipeilyn molemmilla ja tulostaa
molemmat rivit.

**Kaistat ja pystykenttä rinnakkain.** Ne ovat sama rivimäärä ja ei mitään
muuta samaa. Kaistoitettu kenttä on kolme erillistä 15 rivin **huonetta**
päällekkäin, joihin mennään putkella tai pavunvarrella, ja kamera pysyy siinä
jossa jalat ovat (`clampCamY`) juuri siksi, ettei salaisuutta näytetä alta
kävelevälle. Pystykenttä on **yksi huone joka sattuu olemaan 45 riviä korkea**:
ei saumoja, ei huoneita, ei piilotettua, ja kameran kuuluu kulkea sen koko
korkeus. Siksi `getLevel` antaa kiipeilylle `bands: null` vaikka ruudukko on
pitkä — kaistarajaus naulaisi näkymän viiteentoista riviin ja pysäyttäisi
kiipeämisen ensimmäiseen saumaan.

### 2. Kolme työkalua oppii että ylös on suunta

**`tools/playable.mjs`.** Botti juoksi oikealle ja hyppi. Kahdenkymmenen
sarakkeen kentällä se ei heikkene vaan **kääntyy nurin**: se kävelee oikeaan
seinään kahdessa sekunnissa ja raportoi 100 % edenneensä eikä maalia. "Yksikään
kenttä ei liity kaatuneiden listalle" on ollut koko päivän kova sääntö, joten
vastaus ei voinut olla poikkeuslupa: pystykenttä saa **yhtä oikean todisteen**
— sama moottori, sama fysiikka, voimataso 0, ja `finishLevel` oikeasti
laukeaa. Kiipeilijä on omassa tiedostossaan (`tools/climb-bot.js`), koska
`verify.mjs` todistaa sen koekentällä ja `playable.mjs` käyttää samaa. Se lukee
reittinsä **validaattorin omasta verkosta** (`climbGraph`): botti joka kiipeäisi
sen minkä säännöt kieltävät tekisi säännöistä muodollisuuden, ja botti joka ei
kiipeäisi siunattua kaatasi kelvollisia kenttiä.

Kaksi punaista tuli botista itsestään ja molemmat ovat kirjattuina koodissa:
reitinhaku joka minimoi *hyppyjen määrän* valitsi ensimmäiseksi neljän ruudun
loikan yhden ruudun levyiselle tehostuspalikalle (kiipesi **5 %**), ja hypyn
pito joka kysyi vapautusehtoa samalla framella kuin painallusta ei pitänyt
koskaan (**32 px** nousua siinä missä pidetty seisova hyppy antaa 71).

**`src/data/rules.js`.** `floorProfile`, `checkGaps` ja `checkWalls` lukevat
riviä 13. Pystykentässä ne eivät heikkene vaan vastaavat toiseen kenttään, ja
se on mitattu: sama koekenttä vaakasäännöillä raportoi **seitsemän ongelmaa
joista yksikään ei ole totta**. Tilalla on `climbGraph` — mikä tasanne on minkä
päästä saavutettavissa — ja neljä sääntöä joiden vastineet ovat DESIGN.md
kohdassa 5. Yksi luku on kirjoitettava tähän erikseen: **mitä yksi hyppy kantaa
sivusuunnassa kun sen pitää myös nousta.** Päät ovat mitattuja (`gapTiles` 6
tasamaalla, `wallTiles` 4 nousua), väli on suora viiva niiden välillä, ja se
sanotaan koodissa ääneen — oikea kaari on kovera, joten suora **lupaa liian
vähän keskellä**, mikä on turvallinen suunta säännölle jonka tehtävä on hylätä
mahdottomia kenttiä.

**`tools/difficulty.mjs`.** Mittari laskee per sata **saraketta**, ja
kiipeilyssä se on hiljaista valehtelua: 20 saraketta viisinkertaistaa kaiken.
Kiipeily mitataan per sata **riviä**, ja neljä akselia nimeävää suuretta
käännetään. Yksi niistä on kirjattu virheenä koska se oli sellainen: naiivi
käännös — sama neliö per askelma kuin per kuilu — antoi koekiipeilylle **1920,5
pistettä** maailman 1 tason sadan sijaan. Syy on että tasamaalla hyppy on
poikkeus ja kiipeilyssä *jokainen* liike on hyppy, joten hinta per askelma
mittaa muotoa eikä vaikeutta. Oikea kysymys on **tarvitseeko askelma
vauhtia**: `jump-budget.json` mittaa sekä seisovan (71 px) että juoksevan
(85 px) hypyn, mikä samalla 0,8 turvakertoimella on 3 ja 4 ruutua, ja
kolmen ruudun askelma on ilmainen. Nyt koekiipeily saa **104,3**.

### 3. Korpus, ja mitä siitä otettiin

Rainbow Islands ja Kid Icarus ovat korpuksen ainoat pystypelit, ja omistaja
nosti asian itse esiin. `tools/mine-pacing.mjs --vertical` louhii niistä
**pelkkiä aggregaatteja** (DESIGN.md kohta 3): 34 kenttää, 6054 riviä, 2341
tasannetta. Mediaaniaskelma **4 ruutua**, p90 **6**; tasanteen leveys mediaani
4; **47,9 %:lla tasanteista on useampi kuin yksi tie ylös**; ja **24,2 %:lla ei
ole mitään ulottuvilla ylhäällä**. Viimeinen on se joka muutti sääntöä: se
kertoo että umpiperät ovat lajityypissä tavallisia, joten meidän tiukempi
sääntö ("umpiperä maksaa palkinnon") on tämän pelin oma valinta eikä
konvention kopio, ja se lukee nyt DESIGN.md:ssä sellaisena.

Yhtään kenttäkarttaa, palikkasommitelmaa tai pätkää ei otettu, korpus on repon
ulkopuolella (`VGLC_DIR=/workspace/thevglc/thevglc`), ja vanhat aggregaatit
**yhdistettiin eikä korvattu** — `git diff tools/pacing-stats.json` on 115
lisättyä riviä ja yksi poistettu, joka on sulkeva hakasulje.
`VGLC_DIR=… node tools/originality.mjs` jälkeenpäin: **481 korpustiedostoa, 11
generoitua kenttää, 0 osumaa.**

### Punainen ennen vihreää, ja mitä punainen sanoi

- `a climbing view holds still and then pages`: **0 sivunvaihtoa, 388
  liikeframea 779:stä, pahin 12,00 px** — tavallinen ease tekemässä juuri sitä
  mitä sen kuuluu tehdä, väärän muotoisella kentällä: kuva liikkuu joka toisella
  framella eikä koskaan seiso.
- `a climb is passable at power 0, and the bot climbs it`: vanha botti
  **96 % oikealle, 11 % ylös, ei maalia** — se löysi oikean seinän ja jäi
  sinne.
- `vaakasäännöt lukevat pystykentän väärin`: **7 huomautusta**, kärjessä
  `no power-up in the first quarter`.
- `vaikeusmittari mittaa kiipeilyn riveinä eikä sarakkeina`: vaakana **73,1**,
  ensimmäisenä pystyversiona **1920,5**, oikein **104,3**.
- `a paging view keeps the climber in the frame`: **45,31 px päätä ruudun yli**
  ennen kattoa.
- Ja neljä pystyvalidaattorin sääntöä yksi vika kerrallaan: liian korkea
  loikka, pohjaton sarake, piikit putoamisen päässä, tehostus alkuneljänneksen
  ulkopuolella, umpiperä — jokainen punainen erikseen ja jokainen sama
  koekenttä ilman vikaa vihreä.

### Neljä vanhaa kameraporttia, ennen ja jälkeen

Rivi riviltä samat, mikä on sama asia kuin taulukon kolmas rivi mutta
tarkistettuna toisesta suunnasta:

| portti | ennen | jälkeen |
| --- | --- | --- |
| `a view that has to rise animates instead of snapping` | pahin 1,95 px | 1,95 px |
| `a view that has fallen stops when the player stops` | pahin 2,94 px / 7 framea | sama |
| `a view that has to rise on landing animates instead of cutting` | 12,50 px, asettui 14 framessa | sama |
| `the view does not ride a jump upward` | alle 2 px kaikilla riveillä | sama |

## v26.08.10.51 — kuusitoista kenttää neljään maailmaan: 4, 5, 6 ja 7 kahdeksaan

Peli on nyt **8 maailmaa ja 60 kenttää** (oli 44). Maailmat 4, 5, 6 ja 7 ovat
kahdeksan kentän mittaisia sen muodon mukaan joka päätettiin v26.08.09.46:ssa —
`W-1`…`W-7` ja `W-F`, seitsemän askelta, kaksi hengähdystä — eikä muotoa
johdettu uudestaan. Jäljellä ovat maailmat **2** (haara) ja **8** (pomo joka
kentässä), ja ne ovat eri työ eri ehdoilla, kuten edellinen merkintä sanoi.

Ja alkuperäisyystarkistus **ajettiin**: korpus saapui, ja kaikki 27 generoitua
kenttää — myös maailmojen 1, 3 ja 5 vanhat yksitoista — kantavat nyt merkinnän
`origin: 'checked'`, 481 korpustiedostoa, **0 osumaa**.

### Se mikä oli päätetty, ja se mikä oli laskettava

Muoto oli päätetty. Käyrä ei ollut, ja se oli tämän työn koko sisältö:
**maailman keskiarvon on noustava maailmasta maailmaan**, ja nämä neljä
maailmaa ovat kaikki keskellä ketjua — puristettuna sekä alta että päältä.
Maailmoilla 1 ja 3 oli tilaa yhteen suuntaan; näillä ei kumpaankaan.

Ja muoto puristi lisää. Neljässä maailmassa neljästä kävi näin:

> Ensimmäinen notko on käsintehty (`4-2`, `5-2`, `6-2`, `7-2`), ja käsintehty
> huippu sen perässä (`4-3`, `5-3`, `6-3`, `7-3`) on **korkeampi kuin mihin
> generoitu kenttä tällä sanastolla yltää**. Siitä seuraa että toinen notko on
> pakko olla neljäs kenttä, ja että loput kolme askelta ovat kaikki nousua.

Kolme on pelin pisin sallittu nousuputki (portti: *"ei yli kolmen nousun
putkea"*), joten muoto ei ollut valinta vaan ainoa ratkaisu: `W-4` on
hengähdys, `W-5`…`W-7` on täysi kolmen askelen kiipeäminen maailman omaan
huippuun. Se on sama muoto neljä kertaa, ja se on mittauksen seuraus eikä
kaava.

### Käyrä, ennen ja jälkeen

| maailma | muoto ennen | muoto nyt | keskiarvo |
| --- | --- | --- | --- |
| w4 | 188 → 141 → 227 | 188 → 141 → 227 → **168 → 181 → 197 → 215** | 189,4 → **189,8** |
| w5 | 215 → 185 → 279 | 215 → 185 → 279 → **201 → 226 → 245 → 303** | 256,2 → **250,0** |
| w6 | 243 → 148 → 272 | 243 → 148 → 272 → **216 → 233 → 256 → 282** | 264,2 → **255,4** |
| w7 | 253 → 180 → 279 | 253 → 180 → 279 → **234 → 240 → 272 → 273** | 279,2 → **266,9** |

Maailmojen ketju: `111,3 · 148,7 · 171,8 · 189,8 · 250,0 · 255,4 · 266,9 ·
301,0`, eli nouseva joka askeleella. Tiukin askel on **w5 → w6, +5,4**, ja se
on tämän muutoksen hinta sanottuna ääneen: se oli +8,0 ennen.

**Kolme maailmaa neljästä laski, ja se on tulos eikä vahinko** — sama ilmiö
jonka maailma 1 kirjasi v26.08.09.46:ssa, samasta syystä ja isompana. Generoitu
kenttä ei tällä sanastolla yllä käsintehdyn huipun tasolle: mitattu katto on
tehtaassa **215**, luussa **285** ja pilvessä **275**, kun samojen maailmojen
käsintehdyt huiput ovat 227, 272 ja 279 ja linnakkeet 202, 395 ja 405. Neljä
uutta kenttää maailman keskitasolla vetävät keskiarvoa alas kun maailman
vanhat neljä sisältävät sen huipun ja sen linnakkeen. **Nämä ovat pidempiä
maailmoja eivätkä kovempia**, ja koska ne laskivat eri verran, käyrän loppupää
on nyt loivempi kuin se oli. Se on mitattavissa oleva seuraus siitä että
sisältö tehdään generaattorilla, ja se lukee tässä eikä kenenkään muistissa.

Tavoitteet osuivat: kuudestatoista kentästä **kolmetoista on neljän pisteen**
sisällä tavoitteestaan ja yksitoista kahden, ja pahin ero on `7-5` **9,7** —
pilven sanasto ei yllä sinne mihin tähdättiin, ja `aim` jätettiin siihen mihin
se suunniteltiin sen sijaan että se olisi siirretty sinne mihin osuttiin.

### Punainen ennen vihreää — mitä kukin punainen sanoi

**1. `maailmat 1 ja 3–7 ovat kahdeksan kentän mittaisia`** — uusi portti.
Punainen: `w1 8, w3 8, w4 4, w5 4, w6 4, w7 4 — vajaana 4`.

Vanha väite (*"kahdeksan kentän maailmassa on kaksi hengähdystä"*) oli
ehdollinen: *jos* maailmassa on kahdeksan kenttää, siinä on kaksi notkoa. Se ei
sanonut mitään siitä kuinka moni maailma on siinä mitassa, eli maailman olisi
voinut jättää neljään ikuisiksi ajoiksi. Lista on **nimiä eikä lukua**, koska
`>= 6` ei erottaisi "maailma 4 on täytetty" ja "maailma 2 on täytetty kahdesti"
-tapauksia toisistaan — ja koska maailmat 2 ja 8 ovat tarkoituksella poissa
kunnes ne tehdään.

**2. `generoitu kenttä ei kata rivejä 0–1`** — uusi portti, ja se sai kiinni
juuri sen mitä edellinen merkintä varoitti tulevan.

`ceilingPass(c, 3)` maalasi `X`:n riville 3 **ja jokaiselle riville sen
yläpuolella**, eli riveille 0 ja 1 — täsmälleen ne kaksi joilta maailman 8
väite *"joka sarakkeen yllä on kiveä"* mitataan. Generaattorin oma kommentti
sanoi jo oikean säännön — *"tehtaan kansi roikkuu rivillä 2 ja alempana"* —
mutta koodi teki toisin eikä mikään mitannut kumpaa. Punainen, neljä
generoitua tehdaskenttää kirjoitettuna:

| portti | punainen |
| --- | --- |
| generoitu kenttä ei kata rivejä 0–1 | 4-4, 4-5, 4-6, 4-7 **100 % kukin**, w4 **79,4 %** |
| viimeisessä linnakkeessa ei ole ulkopuolta | `seuraavaksi suljetuin maailma w4 79 %` (raja 60) |

Kansi on nyt **rivit 2–3**: kaksi riviä paksu, sama kuin linnakkeen, kaksi riviä
alempana. Vihreä: kaikki kuusi generoitua tehdaskenttää (4-4…4-7, 5-5, 5-7)
mittaavat **0 %**, ja maailma 4 laski **56,6 %:sta 27,1 %:iin**. Finaalin väite
siis *vahvistui*: lähin kilpailija on kaukana kuin se on koskaan ollut. Katto
itsessään ei kadonnut mihinkään — `ruleFactoryCeiling` vaatii yhä katteen
jokaisen sarakkeen yllä riveiltä 0–5, ja se pitää; muuttui vain se korkeus
jolla kansi roikkuu.

**3. `maailmojen 6–8 jokainen kenttä on läpäistävissä voimatasolla 0`** — vanha
portti, joka kaatui oikeasta työstä. Punainen: `22 kenttää` kun ehto oli
`rows.length === 14`. Neljätoista oli maailmojen 6, 7 ja 8 yhteinen kenttämäärä
sinä päivänä jona se kirjoitettiin, ja jokainen 22:sta meni läpi. Luku
johdetaan nyt kentistä (`rows.length === handmade.length`) ja lattia on
erikseen (`>= 22`), joten maailman 8 puuttuvat neljä nostavat sitä eivätkä
kaada sitä. Otsikosta lähti sana **"käsintehtyjen"**: maailmoissa 6 ja 7 on nyt
kahdeksan generoitua kenttää, ja juuri niille tätä porttia eniten tarvitaan —
käsi katsoo kentän, generaattori ei katso mitään.

**4. `generoitu kenttä kantaa sen mitä sen alkuperästä on mitattu`** — vanha
portti, joka oli **väärin päin**, ja se paljastui vasta kun tarkistus
ensimmäisen kerran oikeasti ajettiin. Ks. oma lukunsa alempana.

### Neljä säätöä generaattoriin, ja jokainen on mittauksen seuraus

**`ceilingPass` sai yläreunan.** Yllä.

**`platforms` sai kattorajan (`maxPlatform`), ja luulaakso käyttää sitä.** Tämän
palikan ylin muste ei ole sen lauta vaan **kolikko kaksi riviä sen yläpuolella**,
eikä millään muulla palikalla ole tuota muotoa. Luussa taivas on auki viisi
riviä kuun takia, seitsemän korkea lauta istuu rivillä 6 ja sen kolikko rivillä
4 — eli suoraan kuun läpi. Mitattuna: **10 siementä 80:stä** rakensi
sääntöjen mukaisen `6-4`:n, ja "kuu ei näy" oli yksi kolmesta syystä. Raja
kiristetään **vasta arvonnan jälkeen**, joten teema joka ei sitä laske arpoo
saman luvun kuin ennen — maailmat 1, 3 ja 5 eivät liiku tästä lainkaan.

**Haun leveys on rivin luku eikä vakio (`SEARCH = 240`).** Kahdeksan
kymmentä siementä ei ole kahdeksankymmentä ehdokasta: sääntöjä rikkova siemen
heitetään pois ennen pisteytystä, ja luussa niin kävi useimmille. Se ei näkynyt
virheenä vaan vaihteluvälinä — `6-4`:n siemenjoukko ylsi 325:een ja `6-7`:n
214:ään **samoilla nupeilla**, mikä on siemenjoukon puhetta eikä kentän
suunnittelua. Oletus pysyy 80:ssä ja juuri se on koko pointti: maailmat 1 ja 3
toimitettiin kahdeksankymmenen haulla, ja leveämpi haku kirjoittaisi kahdeksan
mitattua kenttää uusiksi murto-osan takia. Sama peruste kuin maailman 5
siemenkaavalla — **haku on osa sitä miten kenttä on tehty, joten valmis kenttä
pitää sen haun jolla se tehtiin.**

**Pilven painot kirjoitettiin uusiksi sen oman maailman mukaan.** Ne olivat
niityn painot mahdottomat palikat poistettuina, mikä on oikea tapa *aloittaa*
teema ja väärä tapa jättää se. Mitattuna: `7-1`, `7-2` ja `7-3` kantavat
**17 kuoppaa 1008 sarakkeella — yksi joka 59:s — eikä yhtäkään ole sillattu**,
mikä on maailman oma lause lukuna. Vanha painotus tuotti siitä noin kolmasosan.
`gap` ja `stinkGap` ovat nyt 12 osaketta 33:sta (oli 7/26) ja `crumbleWalk` 2 →
3. Tämä on toimituksellista ja saa olla: DESIGN.md kohta 3 sanoo että korpus
päättää **milloin** haaste tulee eikä koskaan **mikä**, joten palikkavalikoima
on juuri se puolisko joka kirjoitetaan käsin — tässä tämän maailman omia
käsintehtyjä kenttiä vasten, mikä on lähde jonka omistamme.

### Maailmakohtaiset luvut

Jokainen tiheys on **sen maailman oma mitattu vihollismerkkien tiheys**, ja
jokainen `maxGap` on sen maailman oma levein hyppy — ei makua kummassakaan:

| maailma | tiheys (mitattu) | pyydetty | maxGap | miksi |
| --- | --- | --- | --- | --- |
| w4 tehdas | 6,8 / 7,1 / 8,4 / 6,8 | 7,0…8,4 | 5 | kuusi on budjetin oma reuna ja kuuluu linnakkeille |
| w5 jälkipyykki | 9,8 / 9,0 / 10,6 | 9,0…10,6 | 6, jäällä 5 | jäällä ei ehdi pysähtyä (maailman 3 mittaus) |
| w6 luu | 9,8 / 8,3 / 8,7 | 8,4…9,8 | **5** | maailman jokainen kuilu on **tasan viisi**: kolme kenttää, 18 kuilua, ei poikkeusta |
| w7 pilvi | 9,5 / 10,1 / 9,4 | 9,4…10,1 | 5 | kuilut ovat neljä tai viisi, ei kertaakaan kuutta |

`minIntro` on 32 saraketta lattiaa ennen ensimmäistä haastetta, paitsi jäällä
48 — molemmat maailmojen 1 ja 3 mittaamia lukuja. `intensity` nousee maailman
sisällä (1,05 → 1,7) ja se on se nuppi jolla kolmen askelen nousu tehdään:
tehdas on tuotantolinja, ja tuotantolinjalla on vähemmän joutomaata kuin
niityllä.

**Maailma 5 on jälkipyykki, ja sen teemat ovat vain niitä joita pelaaja on jo
nähnyt.** Kolme ensimmäistä kantavat ruohon, aavikon ja jään; toinen kaari
täydentää setin (yö on aavikon toinen puoli, tehdas on maailma 4) ja kiipeää
takaisin niiden kahden läpi joilla on kovin sanasto. Luu ja pilvi loistavat
poissaolollaan: ne ovat maailmoissa 6 ja 7 eli tästä eteenpäin, ja bonusmaailma
joka näyttää tulevan on juonipaljastus. Nimet ovat pesun vaiheita, koska
maailman nimi on JÄLKIPYYKKI.

### Kartat: neljä uutta, ja yksikään ei leventynyt

Vieritys tuli (v26.08.09.43) ja `mapWidthPx` lukee leveyden datasta, joten
näiden ruudukoiden olisi saanut olla 26 saraketta. Ne ovat 20, ja syy on
mitattu kummastakin suunnasta:

- **Kahdeksan solmua mahtuu kahteenkymmeneen.** Maailmat 1 ja 3 tekivät sen, ja
  tiukin solmupari koko pelissä on yhä `w2-3`/`w2-m` **12 pikselillä** eli sama
  väljyys joka on ollut tuotannossa alusta asti.
- **Leventäminen maksaisi yhden porteista.** *"Kapea kartta ei vieri
  pikseliäkään"* nojaa siihen että jokainen laivattu kartta on tasan näkymän
  levyinen, ja juuri se väite todistaa että vieritys tuli sisään muuttamatta
  yhtään olemassa olevaa karttaa. Sen vaihtaminen koristeeseen olisi mitatun
  väitteen vaihtamista mittaamattomaan haluun.
- **Leveä polku ei jää senkään takia ajamatta.** `verify.mjs`:n oma 30
  sarakkeen koemaailma kävelee sen läpi joka ajolla, kamera, kulmat ja leimat
  mukaan lukien.

Kaikki neljä tietä kutovat kahden rivin väliä ja jokainen peräkkäinen pari on
tasan kaksi ruutua, kuten maailmoissa 1 ja 3. Erot ovat tarkoituksellisia ja
halpoja: tehtaan pomo asuu **ylhäällä** (rivi 2) eikä laaksossa, jälkipyykin
hernetalo roikkuu **tien alapuolella** rannassa — koko pelin ainoa — ja
luulaakson linnake on alimmalla rivillä, koska laakson pohja on se paikka johon
mennään. Kalusto istutettiin säännön 8 mukaan kuten maailmoissa 6–8: polun
raivattu vyöhyke otettiin ensin pois ja loput istutettiin siihen mikä jäi.
**w4 20/20, w5 28/28, w6 20/20, w7 25/25 — nolla hylättyä.**

### `origin`-portti oli väärin päin, ja se selvisi vasta kun tarkistus ajettiin

Korpus saapui, `tools/originality.mjs` korjattiin lukemaan alihakemistot
(v26.08.10.48), ja kaikki 27 generoitua kenttää generoitiin `VGLC_DIR`
asetettuna. Mitattu: **481 korpustiedostoa, 0 osumaa**, ja maailmojen 1, 3 ja 5
yksitoista vanhaa kenttää tulivat ulos **tavu tavulta samoina** — vain
`origin`-rivi vaihtui, 11 riviä 11:stä, nolla muuta muutosta. Siemenpolku on siis
niin deterministinen kuin sen väitettiin olevan.

Ja sitten ajo ilman korpusta muuttui punaiseksi: **27 kenttää, 27 kaatavaa
riviä**, tekstinä *"merkintä 'checked' ilman korpusta — tarkistusta ei ole
tehty"*. Yksikään niistä ei ollut valhe.

Portti oli väärin päin. `origin` on **tallenne siitä mitä generointiajossa
tapahtui**, ei väite siitä ajosta joka lukee sen, ja ehto `origin !== 'not
checked'` → kaadu teki repostä punaisen jokaiselle jolla ei ole korpusta —
eli se **rankaisi työn tekemisestä** ja kumosi DESIGN.md kohdan 3 oman lauseen
*"repo saa olla vihreä ilman korpusta"* samalla hetkellä.

Ilman korpusta portti mittaa nyt sen minkä voi mitata — **jokainen kenttä
kantaa merkinnän ja merkintä on toinen kahdesta tunnetusta sanasta** — eikä
sitä mitä ei voi: onko merkintä ansaittu. Korpuksen kanssa mikään ei muuttunut:
jokainen ikkuna verrataan, osuma kaataa, ja `not checked` kaataa ympäristössä
jossa tarkistus olisi ollut mahdollinen. Sääntö on siis yhä kaksipuolinen,
mutta oikein päin, ja DESIGN.md kohta 3 sanoo sen nyt näin.

### Mitä ei tehty

- **Maailmat 2 ja 8** ovat ennallaan neljässä ja kuudessa kentässä. Maailmassa
  2 on haara ja maailmassa 8 pomo joka kentässä; kumpikin on eri työ eri
  ehdoilla, ja generaattorissa ei ole yhä areenapalikkaa.
- **`tools/curriculum.mjs`:n oma maailma 5 -osio** listaa yhä `5-1 5-2 5-3`
  nimeltä eikä tunne uusia kenttiä. Se on raportin rivi eikä portti, ja portti
  (*"kahta ensiesittelyä ei ole saman 20 laatan ruudun sisällä"*) mittaa koko
  pelin ja on vihreä: **26 ensiesittelyä, YKSIN hylkää 0**, sama kuin ennen.
  Kuusitoista uutta kenttää eivät esittele mitään, koska peli esittelee
  viimeisen uuden asiansa kentässä `3-3`.

### Integroinnissa: sama kartanvika neljässä uudessa maailmassa

Nämä neljä maailmaa rakennettiin haarasta joka oli tehty ennen kuin
kulmapistevika löytyi, joten niiden siksak-kartat syntyivät **ilman
kulmapisteitä** — sama vika kuin maailmoissa 1 ja 3, neljä kertaa lisää.
Tunti aiemmin lisätty portti nappasi sen ensimmäisellä ajolla:

```
FAIL jokaiselta solmulta pääsee jokaista linkkiä pitkin jollakin nuolella
     [58/138 umpikujaa: w4 … w5 … w6 … w7 …]
```

Kulmapisteet kirjoitettiin kaikkiin 31 linkkiin samalla säännöllä. Yksi
poikkeus: maailmassa 7 hernetalo on solmun `w7-1` yläpuolella, joten paluu
alkuun ei voi olla "ylös" — se olisi ollut portin toisen väitteen mukainen
törmäys. Siellä tie lähtee alkusolmulta **alas** ja paluu on **vasen**.

Uudet kulmat vievät polun ruutuihin joissa ennen ei ollut polkua, ja maisema
oli istutettu vanhoja polkuja vasten: **8 puuta, kiveä ja koneistoa** jäi
raivausvyöhykkeen sisään (w4 2, w5 4 — sitten w6 4, w7 4). Ne poistettiin,
ja kapein etäisyys polun ja kaluston välillä nousi 7 pikselistä 13:een.

---

## v26.08.10.50 — maailmoissa 1 ja 3 ei päässyt ensimmäistä kenttää pidemmälle

Omistajan pelitesti: *"I just did a playtest where I completed the first world
and then couldn't move anywhere on the main map. I warped to world six, the bone
place, and thereafter completing their first world, I could move to the first
level, I could move to the second level."*

Havainto oli tarkka ja osoitti suoraan vikaan: maailma 6 toimi, maailma 1 ei.

### Vika

`WorldMapScene.tryMove` lukee suunnan linkin **ensimmäisestä laatta-askeleesta**
ja vaatii että askel on tasan yksi nuolista — eli että toinen komponentti on
nolla. Kun maailmat 1 ja 3 kasvatettiin kahdeksaan kenttään, solmut aseteltiin
siksakkiin (rivit 7-5-7-5) **ilman kulmapistettä**, jolloin joka linkin
ensimmäinen askel on vinottain: (1,-1) tai (1,1). Yksikään nuoli ei osu
sellaiseen, joten `tryMove` kävi silmukkansa läpi ja palasi tekemättä mitään.

Maailmoissa 4 ja 5 sama siksak toimii, koska niiden linkeissä on kulmapiste
(`path: [[8, 4]]`). Kahdeksaan kasvatettuihin ei kirjoitettu yhtään.

**Mitattuna: 26 linkinpäätä 106:sta oli sellaisia joihin mikään nuoli ei osu**,
kaikki maailmoissa 1 ja 3. Pelaaja pääsi maailmassa 1 ensimmäiselle kentälle ja
siihen se loppui.

### Miksi portti ei huomannut

Tämä on merkinnän tärkein osa. Portissa **oli jo** testi joka ajaa `tryMove`n
joka linkille — se päättelee suunnan linkin omasta askeleesta ja mittaa
kävelijän poikkeaman piirretystä käyrästä. Mutta tulos oli kääritty ehtoon:

```js
m.tryMove(dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up');
if (m.mode === 'walk' && m.targetNode && m.targetNode.id === link.b) { … }
```

Linkki jota mikään nuoli ei osu ei siis kaada mitään: `tryMove` palaa hiljaa,
`if` ei aukea, eikä yksikään väite jää kertomatta. Testi mittasi mutkan syvyyden
**niistä linkeistä joita pitkin pääsi kulkemaan** ja oli täysin sokea niille
joita pitkin ei päässyt.

Se on sama muoto kuin alkuperäistarkistuksen nolla korpustiedostoa kaksi
merkintää aiemmin: mittaus joka vastaa kysymykseen jota ei kysytty, ja näyttää
vihreältä. Kaksi samaa vikaa kahdessa päivässä on kuvio eikä sattuma —
**ehtoon kääritty väite ei ole väite.**

### Korjaus

**Data**, ei moottori: kaikille siksak-linkeille kulmapiste muodossa
`[kohteen sarake, lähdön rivi]`, sama kuin maailmoissa 4 ja 5. Yksi luku tekee
kaksi asiaa — eteenpäin lähdetään aina vaakasuoraan (oikealle) ja takaisin aina
pystysuoraan — joten oikea on koko maailman läpi "eteenpäin" eikä kaksi linkkiä
samalta solmulta koskaan vaadi samaa nuolta.

**Portti** sai kaksi uutta väitettä, joita ei voi ohittaa hiljaa:

1. jokaiselta linkiltä, **kummastakin päästä**, jokin nuoli vie perille
   — `106 linkinpäätä, kaikki nuolen päässä`
2. eikä kaksi linkkiä samalta solmulta vaadi samaa nuolta — muuten "oikealle"
   tarkoittaisi kahta paikkaa ja valinnan ratkaisisi kirjoitusjärjestys
   — `106 suuntaa, ei päällekkäisyyksiä`

Punainen ennen vihreää: väitteet kirjoitettiin ensin, ja ne nimesivät kaikki 26
umpikujaa askelineen ennen kuin dataan koskettiin.

Tallennuksia ei tarvitse nollata — vika oli kartan geometriassa, ei
tallennetussa tilassa, joten kesken jäänyt peli jatkuu siitä mihin se jäi.

---

## v26.08.10.49 — vaihtelumittari: uusi muoto, ei uusi mekaniikka

Uusi `tools/variety.mjs` vastaa kysymykseen jota kentien generointi synnytti:
**onko maailma kahdeksassa kentässä pidempi vai vain venytetty.** Se ei ole
portti vaan mittari; `tools/verify.mjs` ei lue sitä.

### Miksi tämä ei ole `curriculum.mjs`:n jatke

Kaksi eri kysymystä samasta datasta. Curriculum kysyy **missä jokin asia
kohdataan ensi kertaa** — hetki. Vaihtelu kysyy **kuinka usein sama asia
sanotaan uudelleen** — jakauma. Curriculum on lisäksi nykyään portin
kantava osa (`verify.mjs` tuo sen YKSIN-tarkistusta varten), eikä siihen
kannata kasata toista, suurempaa mittausta.

Sanasto ei silti ole kahdennettu: `CURRICULUM_USES` on uusi vienti, joten
repossa on tasan yksi määritelmä sille mikä on "ominaisuus". Kaksi
määritelmää antaisi mittareiden olla eri mieltä siitä mitä peli sisältää.

### Mitä mitataan, ja miksi juuri sitä

**Kenttä ansaitsee paikkansa näyttämällä järjestyksen jota maailma ei ole
näyttänyt — ei mekaniikkaa jota se ei ole näyttänyt.**

Kaksi akselia, rinnakkain eikä koskaan yhteen laskettuna:

- **SANASTO** — montako eri ominaisuutta maailma kenttiin panee. Tulostetaan,
  ei pisteytetä. Kapea sanasto on se miltä identiteetti näyttää ulkoapäin, ja
  maailma 1:n sanastoa kavennettiin tarkoituksella.
- **UUTUUS** — kuinka suuri osa kentän kahdeksan sarakkeen ikkunoista on
  sellaisia joita sama maailma ei ole aiemmin näyttänyt. Vain tämä tuottaa
  huomautuksia.

Ikkuna on tuotu `originality.mjs`:stä eikä kirjoitettu uudelleen, joten repolla
on yksi käsitys siitä mikä on "pala kenttää". Aakkosto on karkeampi kuin
ruudukko (kaikki kova maasto yhdeksi kirjaimeksi; lämpöputki taittuu tavalliseksi
putkeksi, koska `secrets.js` rakentaa koko löydettävyytensä sille että ne
näyttävät samalta) mutta hienompi kuin alkuperäistarkistuksen, koska jokainen
vihollislaji pitää oman kirjaimensa: piikkiäijä siellä missä oli kävelijä on
eri huone.

### ANSAN KOE — mittari koettelee itseään joka ajolla

Vaara on ilmeinen: mittari joka palkitsee "uutta" opettaa ahtamaan mekaniikkoja.
Siksi työkalu ajaa joka kerta kokeen pelin **vähiten uudella kentällä** (6-3),
jossa houkutus olisi suurin, ja tulostaa tuloksen:

| 6-3 | uutuus |
|---|---|
| sellaisenaan | 11.73 % |
| + laji jota kentässä jo on (`r`), sarake 122 | 16.17 % (+4.44) |
| + laji jota siinä ei ole koskaan ollut (`p`), sama sarake | 16.17 % (+4.44) |
| palikkalista käännettynä keskeltä — 0 uutta mekaniikkaa, 0 uutta laattaa | 23.17 % (+11.44) |

**Uusi laji ostaa tutun lajin yli 0.00.** Mittari ei näe mikä laji ruudussa on,
vain että ruutu ei näytä samalta. Uudelleenjärjestäminen ostaa **2.6×** sen mitä
vihollisen lisääminen ostaa. Gradientti osoittaa järjestykseen eikä ahtamiseen,
ja se oli koko ehto sille että luvun saa julkaista.

Ja toisin päin, itse puusta johdettuna: **w5 ja w4 toistavat edeltäjänsä
ominaisuusjoukkoa yhtä paljon (53 % / 57 %), mutta uutuus on 85 % ja 39 %** —
46 %-yksikköä eroa. Pelkkä ominaisuuspäällekkäisyys, eli se ilmeinen mittari,
olisi rangaissut yhtenäistä maailmaa siitä että se pitää sanastonsa kasassa.

### Vastaus siihen mitä kysyttiin

**Maailma 1 kahdeksassa kentässä on rytmiä, ei täytettä** — mutta viimeinen
päivämäärä on tiedossa.

- w1:n uutuus **53.1 %**, mediaanimaailman yläpuolella (48.8 %)
- kahdeksan kentän maailmat **52.0 %**, neljän kentän **40.2 %** — täyttäminen
  on tässä puussa **nostanut** vaihtelua 11.8 %-yksikköä
- neljä lisättyä kenttää tuovat 72.8 / 67.9 / 45.0 / 40.7 % uutta — jokainen
  yli w6:n ja w7:n **käsintehtyjen** kenttien (11.7–27.5 %)
- lasku on silti todellinen, noin −11 %-yksikköä kenttää kohden. **Kahdeksan on
  suunnilleen se kohta jossa tämän generaattorin ideat loppuvat**: yhdeksäs ja
  kymmenes olisivat lähellä nollaa.
- ja jos täytesyytös osuu w1:ssä johonkin, se osuu **1-3:een (29.7 %)**, joka on
  käsintehty.

### Löydetty, ei korjattu: linnakkeet ovat se yksitoikkoisuus

6-F, 7-F ja 8-F tuovat **0.0 %** koko pelille uutta, 3-F tuo 3.0 %. Puolet pelin
linnakkeista on saman seitsemän palikan permutaatioita, ja `fort_gap` esiintyy
**28 kertaa seitsemässä maailmassa**. Tämä on toistoa paikassa jota kukaan ei
katsonut, ja se on suurempi kuin mikään minkä kenttien täyttäminen aiheutti.

Samoin: **w6 ja w7 neljässä kentässä (19.6 % ja 18.0 %) ovat yksitoikkoisempia
kuin w1 kahdeksassa (53.1 %)**. Niiden pidentäminen ei ole se mikä niitä
satuttaisi.

### Kurnuttaja taulukkoon, ja riita joka nyt on luku

`ENEMY_NAMES` sai rivin `U: 'kurnuttaja'`, mitattuja ominaisuuksia 26 → 27.
Rivi kantaa kaksi lippua, ja molemmat ovat rehellisyyden takia:

- **`hazard: true`** — merkki on *määritelty* olemaan lattiattomassa sarakkeessa,
  joten POHJA omalle sarakkeelle lukisi määritelmän takaisin. Nyt mitataan vain
  lähestyminen — ja **se hajoaa oikeasta syystä**: `pit_croak` on kuuden levyinen
  kuoppa sarakkeissa 117–122, olento 119:ssä, joten jarrutusikkunan [115, 118]
  kaksi viimeistä saraketta ovat jo ilman päällä, mitattua voimatason 0
  jarrutusmatkaa (4 laattaa) vasten.
- **`disputed: '2-1'`** — ensikohtaaminen on 2-1 sarake 119; putkikasvi on
  101:ssä (18 päässä) ja närästyssuihku 134:ssä (15 päässä), molemmat YKSIN:n
  yhden ruudun sisällä. Rivin kanssa **2-1 esittelee neljä uutta asiaa** ja on
  pelin ainoa kenttä yli kolmen rajan.

Riitaa ei ratkaistu, se **nimettiin**: portin lukemat viennit
(`CURRICULUM_ROWS`, `CURRICULUM_INTRO`, `FIRST_IN_LEVEL`) jättävät riitaisan
ominaisuuden ulos, `CURRICULUM_ROWS_ALL` kantaa kaiken, ja työkalu tulostaa
**RIITA**-osion jossa molemmat törmäykset ovat etäisyyksineen. Portti on siis
vihreä eikä valehtele: se sanoo mitä se jättää lukematta. Kolmas tila — riita
joka on olemassa mutta josta mikään luku ei kerro — on poissa.

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
