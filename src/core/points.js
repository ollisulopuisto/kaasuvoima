/**
 * PISTETAULUKKO. Yksi tiedosto, ja siinä on **kaikki** mitä pelistä voi saada.
 *
 * Ennen tätä pistearvot olivat siellä missä ne maksettiin: `this.score = 200`
 * kahdessatoista vihollisluokassa, `awardScore(1000)` neljässä kohtaa
 * `player.js`:ää, kolikko `level.js`:ssä ja maalitangon portaat sen omassa
 * metodissaan. Kukaan ei nähnyt taulukkoa kerralla, joten kukaan ei myöskään
 * nähnyt sitä että se oli **SMB3:n taulukko**: satoja ja tuhansia, 100 · 200 ·
 * 400 · 1000, eli lainattu asteikko siinä missä lainattu kuvakin.
 *
 * ## Kakkosen potenssit, ja miksi ne korvasivat neliöt (18.8.2026)
 *
 * Omistaja: *"varmista että kaikki pisteet ovat 2:n potensseja, nyt
 * vihollisten tappamisesta tulee välillä 100, 200 jne."*
 *
 * Taulukko oli tätä ennen **neliöitä** (25 · 100 · 256 · 400 · 625 · 1024 ·
 * 2500 · 4096), ja se ratkaisi saman ongelman toisella tavalla. Se ei
 * kuitenkaan ratkaissut sitä loppuun asti, ja omistajan havainto osoittaa
 * tarkalleen mihin se jäi: `100` **on** neliö, ja niin on `400`ja `900` — eli
 * neliöllisyys salli täsmälleen ne genren pyöreät luvut joita vastaan koko
 * sääntö kirjoitettiin. Kakkosen potenssi ei salli. 128, 512, 2048 ja 8192
 * eivät ole minkään toisen pelin lukuja, eikä yksikään niistä ole sata.
 *
 * Kaksi ominaisuutta, ja ne ovat samat kuin neliöillä olivat:
 *
 *   1. **Potenssi kertaa potenssi on potenssi.** Ketjun kerroin (`CHAIN`) ja
 *      kuplan puhkaisu (`POP_BONUS`) ovat itsekin kakkosen potensseja, joten
 *      *jokainen* ruudulle pomppaava luku on kakkosen potenssi riippumatta
 *      siitä minkä monen kertoimen läpi se tuli. Sääntö joka ei kestäisi
 *      kertolaskua ei olisi sääntö vaan tyyli.
 *   2. **Yksi taulukko, yksi tiedosto.** `verify.mjs` vaatii sen kummallakin
 *      puolella: jokainen luku on potenssi, eikä lähdekoodissa ole yhtään
 *      irtonaista pistelukua.
 *
 * **Ja se hinta jonka tämä maksaa, sanottuna ääneen.** Neliöiden perustelu
 * kohta 3 kuului: *"kanta kasvaa, ei eksponentti — kakkosen potenssit kasvavat
 * liian hitaasti alussa ja liian nopeasti lopussa"*. Se pitää yhä paikkansa ja
 * se on nyt hyväksytty hinta: **asteikko on karkea**. Kahden vihollisluokan
 * ero on aina tasan kaksinkertainen, ei koskaan "vähän parempi", eikä
 * väliarvoja ole — 16 ja 20 olivat neliöinä naapureita, 256 ja 512 eivät ole.
 * Sama karkeus näkyy räikeimmin pomoissa: `bossPoints` tuplaantuu variantista
 * toiseen, joten kahdeksas pomo on 2²⁰ eli miljoona. Se on iso luku, ja se on
 * suora seuraus siitä että kahdeksan pomoa mahtuu potenssiasteikolle vain
 * kahdeksan potenssin päähän toisistaan.
 */

/**
 * Kakkosen potenssi. Kirjoitettuna auki, jotta **eksponentti näkyy** jokaisessa
 * kutsupaikassa: `p2(8)` sanoo "kahdeksas potenssi", ei "kaksisataaviisikymmentäkuusi".
 */
export const p2 = (n) => 2 ** n;

/**
 * Vihollisten ja esineiden arvoluokat, halvimmasta kalleimpaan.
 *
 * Nimet kertovat *mitä* eivätkä *paljonko*, koska luku on tässä tiedostossa
 * juuri siksi että se saa vielä muuttua: `PTS.common` on "tavallinen
 * vihollinen", ja jos tavallisen vihollisen hinta joskus siirtyy 256:sta
 * 512:een (2⁹), sen tekee yksi rivi eikä kaksitoista.
 */
export const PTS = {
  /** Tiili nyrkillä. Pienin maksu pelissä. */
  brick: p2(5),        //    32
  /** Heikoin vihollinen — se joka kävelee suoraan ja kuolee kerralla. */
  minor: p2(7),        //   128
  /** Tavallinen vihollinen, ja kolikko. */
  common: p2(8),       //   256
  /** Sitkeä: kuori, lentäjä, se joka vaatii kaksi ajatusta. */
  tough: p2(9),        //   512
  /** Harvinainen tai vaarallinen. */
  rare: p2(10),        //  1024
  /** Tehostus, tähti, varalokeroon ylivuotanut esine. */
  prize: p2(11),       //  2048
  /** Iso yksittäinen vihollinen, ei pomo. */
  major: p2(12),       //  4096
  /** Se mitä täydellä tasolla syöty hernekeitto maksaa. */
  jackpot: p2(13),     //  8192
};

/** Yksi kolikko. Sama luku kuin tavallinen vihollinen, ja se on tarkoitus. */
export const COIN = PTS.common;

/**
 * Kellon jäännös kentän lopussa, pisteinä per sekunti.
 *
 * Tulo ei ole potenssi eikä voi olla — kello on mikä tahansa luku väliltä
 * 0…999, eikä sitä saa pakottaa potenssiksi, koska silloin *aika* lakkaisi
 * olemasta lineaarinen ja pelaajan pitäisi arvata mitä sekunti maksaa.
 * Potenssi on **hinta**, ei summa, ja se on sama 2⁵ kuin tiilellä. Tämä on myös
 * ainoa maksu koko pelissä joka ei pompi ruudulle lukuna (ks. `awardScore`),
 * eli ainoa jonka potenssillisuutta kukaan ei näkisi vaikka se olisi.
 */
export const TIME_SECOND = PTS.brick;

/**
 * Maalitangon viisi porrasta, alhaalta ylös. Ks. `grabGoal`.
 *
 * Portaat ovat luettavia lukuja eivätkä liukuva käyrä, koska palkinnon idea on
 * että pelaaja *näkee* saaneensa 1024 eikä 8192 ja tietää mitä yrittää ensi
 * kerralla. Eksponentit ovat 7 · 9 · 10 · 12 · 13: alin ja ylin ovat kaksi
 * pykälää naapuristaan ja keskimmäiset yhden, eli portaikko on tiheimmillään
 * keskellä. Ylin porras antaa myös tähden, ja siksi se on kaukana.
 */
export const GOAL_STEPS = [p2(7), p2(9), p2(10), p2(12), p2(13)];

/**
 * KETJUKERROIN: 1 · 2 · 4 · 8 · 16 · 32 · 64 · 128, eli ketjun n:s tappo
 * maksaa 2ⁿ⁻¹ kertaa.
 *
 * Tämä on se kohta jossa potenssiasteikko ei jätä valinnanvaraa: tulon on
 * pysyttävä kakkosen potenssina, ja kakkosen potensseja on tarkalleen yksi
 * jono. Vanha neliötikapuu (1 · 4 · 9 · 16 …) kiipesi jyrkemmin alussa ja
 * loivemmin lopussa; tämä on tasainen tuplaus alusta loppuun.
 *
 * Katto on sama kuin ennen: kahdeksas on viimeinen joka maksetaan pisteinä ja
 * yhdeksäs maksaa elämän. Huippukerroin nousi 64:stä 128:aan, eli pisin ketju
 * on kaksi kertaa entistä arvokkaampi — ja ketjun alkupää halpeni (toinen
 * tappo 2× eikä 4×). Ketju on siis nyt jyrkemmin loppupainotteinen, mikä on
 * potenssien hinta eikä valinta.
 */
export const CHAIN = [0, 1, 2, 3, 4, 5, 6, 7].map(p2);

/**
 * Kuplan puhkaisu. Kerroin vihollisen omaan arvoon, ja 2¹ eli kaksinkertainen:
 * pienin kerroin joka on olemassa tällä asteikolla, ja siksi se on tässä.
 */
export const POP_BONUS = p2(1);

/**
 * Pomon pisteet. Eksponentti kasvaa yhdellä per variantti: 2¹³ · 2¹⁴ · 2¹⁵ ·
 * … · 2²⁰, eli 8192 · 16384 · 32768 · 65536 · 131072 · 262144 · 524288 ·
 * 1048576.
 *
 * Ensimmäinen pomo on tasan `PTS.jackpot`, eli täsmälleen pelin kallein
 * ei-pomo — sama suhde kuin neliöasteikolla oli — ja kahdeksas on 128 kertaa
 * se. **Se on iso luku ja se sanotaan ääneen tiedoston alussa**: kahdeksan
 * pomoa mahtuu potenssiasteikolle vain kahdeksan potenssin päähän toisistaan,
 * eikä väliarvoja ole olemassa.
 *
 * Sääntö eikä taulukko, koska pomoja on kahdeksan ja yhdeksäs tulee samasta
 * kohdasta kuin `hp`: käsin kirjoitettu lista olisi juuri se paikka joka jää
 * jälkeen kun linnakkeita joskus lisätään.
 */
export function bossPoints(variant) {
  return p2(13 + Math.max(0, variant));
}
