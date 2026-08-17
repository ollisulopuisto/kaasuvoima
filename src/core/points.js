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
 * NELIÖT, EIVÄT SADAT. Jokainen luku tässä tiedostossa on kokonaisluvun neliö,
 * ja se on sekä asteikko että allekirjoitus:
 *
 *   5² = 25 · 10² = 100 · 16² = 256 · 20² = 400 · 25² = 625 · 32² = 1024
 *   · 50² = 2500 · 64² = 4096
 *
 * Kolme syytä, tärkein ensin:
 *
 *   1. **Se on tunnistettava eikä pyöreä.** Ruudulle ilmestyvä 256 tai 1024 ei
 *      ole minkään toisen pelin luku. Sadat ovat; 100 · 200 · 400 · 800 on
 *      genren yhteisomaisuutta niin vahvasti että sen kirjoittaminen on
 *      lainaamista silloinkin kun sen keksisi itse.
 *   2. **Neliö kertaa neliö on neliö.** Ketjun kerroin (`CHAIN`) ja kuplan
 *      puhkaisu (`POP_BONUS`) ovat itsekin neliöitä, joten *jokainen* ruudulle
 *      pomppaava luku on neliö riippumatta siitä minkä monen kertoimen läpi se
 *      tuli. Sääntö joka ei kestäisi kertolaskua ei olisi sääntö vaan tyyli.
 *   3. **Kanta kasvaa, ei eksponentti.** Kakkosen potenssit (4 · 8 · 16 · 32)
 *      kasvavat liian hitaasti alussa ja liian nopeasti lopussa: kahden
 *      vihollisen ero olisi joko olematon tai kaksinkertainen, ei koskaan
 *      "vähän parempi". Neliöissä juuri on se luku jota säädetään, ja se saa
 *      olla mikä tahansa — 16 ja 20 ovat naapureita, 1024 ja 4096 eivät.
 *
 * Asteikko on tarkoituksella lähellä vanhaa: 100 pysyi 100:na ja 400 400:na,
 * eli kukaan ei joudu opettelemaan pelin arvojärjestystä uudestaan. Vain ne
 * luvut jotka olivat pyöreitä sadan monikertoja liikkuivat lähimpään neliöön.
 */

/** Neliö. Kirjoitettuna auki, jotta juuri näkyy jokaisessa kutsupaikassa. */
export const sq = (n) => n * n;

/**
 * Vihollisten ja esineiden arvoluokat, halvimmasta kalleimpaan.
 *
 * Nimet kertovat *mitä* eivätkä *paljonko*, koska luku on tässä tiedostossa
 * juuri siksi että se saa vielä muuttua: `PTS.common` on "tavallinen
 * vihollinen", ja jos tavallisen vihollisen hinta joskus siirtyy 256:sta
 * 289:ään (17²), sen tekee yksi rivi eikä kaksitoista.
 */
export const PTS = {
  /** Tiili nyrkillä. Pienin maksu pelissä. */
  brick: sq(5),        //   25
  /** Heikoin vihollinen — se joka kävelee suoraan ja kuolee kerralla. */
  minor: sq(10),       //  100
  /** Tavallinen vihollinen, ja kolikko. */
  common: sq(16),      //  256
  /** Sitkeä: kuori, lentäjä, se joka vaatii kaksi ajatusta. */
  tough: sq(20),       //  400
  /** Harvinainen tai vaarallinen. */
  rare: sq(25),        //  625
  /** Tehostus, tähti, varalokeroon ylivuotanut esine. */
  prize: sq(32),       // 1024
  /** Iso yksittäinen vihollinen, ei pomo. */
  major: sq(50),       // 2500
  /** Se mitä täydellä tasolla syöty hernekeitto maksaa. */
  jackpot: sq(64),     // 4096
};

/** Yksi kolikko. Sama luku kuin tavallinen vihollinen, ja se on tarkoitus. */
export const COIN = PTS.common;

/**
 * Kellon jäännös kentän lopussa, pisteinä per sekunti.
 *
 * Tulo ei ole neliö eikä voi olla — kello on mikä tahansa luku väliltä 0…999,
 * eikä sitä saa pakottaa neliöksi, koska silloin *aika* lakkaisi olemasta
 * lineaarinen ja pelaajan pitäisi arvata mitä sekunti maksaa. Neliö on
 * **hinta**, ei summa, ja se on sama 5² kuin tiilellä. Tämä on myös ainoa
 * maksu koko pelissä joka ei pompi ruudulle lukuna (ks. `awardScore`), eli
 * ainoa jonka neliöllisyyttä kukaan ei näkisi vaikka se olisi.
 */
export const TIME_SECOND = PTS.brick;

/**
 * Maalitangon viisi porrasta, alhaalta ylös. Ks. `grabGoal`.
 *
 * Portaat ovat luettavia lukuja eivätkä liukuva käyrä, koska palkinnon idea on
 * että pelaaja *näkee* saaneensa 900 eikä 2500 ja tietää mitä yrittää ensi
 * kerralla. Juuret ovat 10 · 20 · 30 · 50 · 64: kolme ensimmäistä tasavälein,
 * jotta alaportaiden ero on opeteltava eikä sattuma, ja kaksi ylintä
 * kaukanaan, koska ylin porras antaa myös tähden.
 */
export const GOAL_STEPS = [sq(10), sq(20), sq(30), sq(50), sq(64)];

/**
 * KETJUKERROIN, ja jokainen sen luvuista on neliö: 1 · 4 · 9 · 16 · 25 · 36 ·
 * 49 · 64, eli ketjun *järjestysluku* neliöitynä.
 *
 * Vanha tikapuu oli [1, 2, 4, 8, 10, 20, 40, 80] — SMB3:n 100…8000 kirjoitettu
 * kertoimiksi. Neliötikapuu tekee kaksi asiaa kerralla: se pitää tulon
 * neliönä (neliö kertaa neliö on neliö), ja se sanoo kertoimen samalla
 * säännöllä kuin koko muu taulukko, eli ketjun n:s tappo maksaa n² kertaa.
 *
 * Katto on sama kuin ennen: kahdeksas on viimeinen joka maksetaan pisteinä ja
 * yhdeksäs maksaa elämän. Huippukerroin laski 80:stä 64:ään, eli pisin ketju
 * on nyt hitusen halvempi kuin ennen — ja ketjun alkupää selvästi kalliimpi
 * (toinen tappo 4× eikä 2×). Se on tarkoitus: ketju joka palkitsee vasta
 * kuudennesta on ketju jota kukaan ei aloita.
 */
export const CHAIN = [1, 2, 3, 4, 5, 6, 7, 8].map(sq);

/**
 * Kuplan puhkaisu. Kerroin vihollisen omaan arvoon, ja 2² eikä 2 samasta
 * syystä kuin ketjussa: tulon on pysyttävä neliönä.
 */
export const POP_BONUS = sq(2);

/**
 * Pomon pisteet. Juuri kasvaa kahdeksan per variantti (64 · 72 · 80 …), eli
 * 4096 · 5184 · 6400 · 7744 · 9216 · 10816 · 12544 · 14400.
 *
 * Sääntö eikä taulukko, koska pomoja on kahdeksan ja yhdeksäs tulee samasta
 * kohdasta kuin `hp`: käsin kirjoitettu lista olisi juuri se paikka joka jää
 * jälkeen kun linnakkeita joskus lisätään.
 */
export function bossPoints(variant) {
  return sq(64 + Math.max(0, variant) * 8);
}
