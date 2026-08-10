# Ohjeet tälle repolle

## Julkaisurytmi: usein, muttei joka commitista

**Deployaa usein** — omistaja pelaa peliä ja muutos jota ei voi pelata ei ole
vielä valmis. Mutta **Vercelin ilmaistaso sallii sata deployta vuorokaudessa**,
ja se katto tuli vastaan kesken työn 10.8.2026: `sfb3.vercel.app` jäi
vanhentuneeksi tunneiksi juuri sinä iltana kun uusia kenttiä olisi pitänyt
päästä kokeilemaan. GitHub Pages (`ollisulopuisto.github.io/sfb3/`) jatkoi
julkaisemista, ja se on varareitti — mutta se on varareitti eikä ratkaisu.

Käytännön säännöt, tärkeimmästä alkaen:

1. **Yksi deploy per pelattava kokonaisuus, ei per commit.** Jos kolme agenttia
   valmistuu peräkkäin, ne kuuluvat samaan haaraan ja samaan PR:ään silloin kun
   ne eivät ole toistensa tiellä. Kaksi kenttää ja äänikorjaus on yksi
   "kokeilepa tätä", ei kolme.

2. **Työnnä haara vasta kun työ on valmis.** Jokainen `git push` haaraan tekee
   Vercelille esikatselu-deployn, joten kolme välityöntöä maksavat kolme
   deployta joita kukaan ei katso. Committaa vapaasti, työnnä harkiten.

3. **`[skip ci]` yhdistämiskommentin otsikkoon kun muutos on pelkkää
   dokumenttia.** Perustelu ja rajaukset ovat [DESIGN.md](DESIGN.md):n
   kohdassa 7 — lyhyesti: vain puhtaat dokumenttimuutokset, koska sama merkintä
   ohittaa myös GitHub Pagesin työnkulun.

4. **Kiireellinen korjaus deployataan heti.** Rikkinäinen peli tuotannossa on
   aina kalliimpi kuin yksi deploy. Tämä sääntö koskee kasaamista, ei
   korjaamista.

Nyrkkisääntö: **kysy "haluaisiko omistaja avata pelin juuri tämän takia".**
Jos vastaus on ei, se odottaa seuraavaa erää.
