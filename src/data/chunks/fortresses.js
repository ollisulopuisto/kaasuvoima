/**
 * KAHDEKSAN LINNAKETTA, KAHDEKSAN SANASTOA.
 *
 * ## Mikä tämän tiedoston maksoi
 *
 * `tools/variety.mjs` kysyy kentältä yhden asian: kuinka suuri osa sen
 * kahdeksan sarakkeen ikkunoista on muotoja joita peli ei ollut vielä
 * näyttänyt. Linnakkeissa vastaus oli 10.8.2026 tämä:
 *
 *     6-F 0,0 %     7-F 0,0 %     8-F 0,0 %     3-F 3,0 %
 *
 * Puolet pelin linnakkeista ei tuonut peliin yhtään uutta muotoa. Mittaus
 * osoitti myös miksi: `chunks/fortress.js`:n seitsemän käytäväpalikkaa olivat
 * koko sanasto. `fort_gap` oli kahdessakymmenessä paikassa seitsemässä
 * maailmassa ja `fort_power` kaikissa kahdeksassa, eli luulinnake oli
 * pilvilinnake toisella värillä.
 *
 * Omistajan ratkaisu: **jokainen maailma saa oman linnakesanastonsa.** Se on
 * suurin tarjolla ollut vaihteluvoitto eikä se lisää yhtään mekaniikkaa.
 *
 * ## Muoto, ei nahka
 *
 * Tämä on tarkoituksella *muoto*-ongelma eikä *nahka*-ongelma. Teemakohtaisia
 * laattamuotoja ei tehdä — omistaja päätti 9.8.2026 että nykyinen värjäys
 * riittää — ja sama pohjapiirros toisella paletilla mittaisi mittarissa
 * täsmälleen saman luvun kuin ennen. Se mikä tässä eroaa on **järjestys**:
 * missä kuilut ovat, mitä niiden yllä on, mitä huone pyytää tekemään.
 *
 * Siksi jokaisella sanastolla on yksi lause, ja jokainen palikka on sen lauseen
 * osa. Lause on rakenteellinen eikä kuvaileva, koska vain rakenne näkyy
 * mittarissa:
 *
 *   | maailma | linnake | lause |
 *   | --- | --- | --- |
 *   | 1 | `root_*`   | kaksi kerrosta: palkinnot ovat parvella, reitti maassa |
 *   | 2 | `kiln_*`   | ei yhtään kuilua — kynnykset, kuumuus ja murtuva silta |
 *   | 3 | `frost_*`  | lattia joka ei kanna: murenevaa jäätikön päällä, saarekkeita |
 *   | 4 | `mill_*`   | koneisto katossa: kuljetaan aina jonkin ali |
 *   | 5 | `pyre_*`   | kaikki on ylitys: laavaa ja astinlautoja kahdella korkeudella |
 *   | 6 | `crypt_*`  | tie vie alaspäin: hyllyltä pudotaan kammioon |
 *   | 7 | `spire_*`  | tie vie ylöspäin: kannet nousevat, lattiassa on reikiä |
 *   | 8 | `throne_*` | huone kutistuu: katto laskeutuu, matalinta kohtaa ei hypätä |
 *
 * ## Miksi yksi tiedosto eikä kahdeksan
 *
 * `chunks/keep.js` on maailman 8 oma tiedosto ja tämän muutoksen ennakkotapaus,
 * joten ilmeinen ratkaisu olisi ollut laittaa luulinnakkeen huoneet
 * `chunks/bone.js`:ään ja pilvilinnakkeen `chunks/cloud.js`:ään. Se ei käy, ja
 * syy on mitattu eikä maun asia: **teematiedostoilla on rakenteelliset
 * sääntönsä, ja linnake rikkoo ne kaikki.** `verify.mjs` vaatii että jokaisessa
 * `BONE_CHUNKS`in palikassa taivas on auki ja jokaisessa `CLOUD_CHUNKS`in
 * palikassa mikään ei seiso maassa — ja linnake on sisätila, jonka jokaisen
 * sarakkeen yllä on kiveä. Kryptahuone luumaailman tiedostossa olisi joko
 * rikkonut sen portin tai vaatinut portin sisään poikkeuksen, ja hiljainen
 * poikkeus on juuri se tapa jolla sääntö lakkaa olemasta sääntö.
 *
 * Nämä huoneet ovat siis omassa tiedostossaan siksi että ne ovat *sisätiloja*,
 * ja se on sama peruste jolla `chunks/factory.js` on erillään: yksi katto,
 * yksi sääntö, yksi paikka.
 *
 * ## Mitä jää `fortress.js`:ään
 *
 * Areenat, ja vain ne. Pomoareena on pomoareena — se on nimenomaan se osa jonka
 * jakaminen kannattaa, ja `boss_arena_big`illa on oma pitkä perustelunsa siitä
 * miksi sen kannet ovat siellä missä ovat. Vanhat `fort_*`-käytävät jäävät
 * paikoilleen niin kauan kuin jokin linnake yhä käyttää niitä; kun kaikki
 * kahdeksan soittolistaa on liitetty, ne ovat kuollutta koodia ja kuuluvat pois
 * samalla perusteella jolla `bone_twin` poistettiin.
 *
 * ## Sanasto on taulu, ei lista
 *
 * `FORTRESS_VOCAB` on tämän tiedoston ainoa totuus siitä mikä palikka kuuluu
 * kenellekin, ja `FORTRESS_WORLD_CHUNKS` johdetaan siitä. Kaksi käsin
 * kirjoitettua listaa ehtii olla eri mieltä ennen kuin kukaan huomaa; johdettu
 * ei ehdi. `tools/verify.mjs` lukee taulun ja väittää kolme asiaa: sanastoja on
 * kahdeksan, yksikään palikka ei kuulu kahteen maailmaan, eikä yksikään linnake
 * sekoita kahden maailman sanastoa.
 */

import { ck, G } from './common.js';

/* ============================ maailma 1 ================================== */
/**
 * JUURILINNA — kaksi kerrosta.
 *
 * Maailma 1 on se maailma jossa opetetaan puulava: sen läpi hypätään alhaalta
 * ja sen päälle lasketaan ylhäältä. Ensimmäinen linnake on se lause loppuun
 * asti vietynä — **käytävällä on parvi**, parvi on palkintojen kerros ja maa on
 * reitti. Kumpikaan ei ole toisen vaihtoehto: parvelta ei pääse maaliin eikä
 * maasta käsin lohkoihin.
 *
 * Se on myös syy siihen miksi tämän linnakkeen lohkot ovat rivillä 5 eivätkä
 * rivillä 9. Rivi 9 on tavallinen kolautusrivi *lattiasta mitattuna*, ja tässä
 * huoneessa se on jo varattu: siinä on parvi. Lohkot nousevat neljä riviä
 * parven yli, eli ne ovat kolautusrivi *parvelta* mitattuna — sama etäisyys,
 * eri lattia.
 */
const ROOT_CHUNKS = {
  /** Portti, ja parven alku: kolikkokaari nousee laudalle, kävelijä jää alle. */
  root_gate: ck(16, {
    0: G,
    1: G,
    8: '      o o o',
    9: '     -------',
    12: '  g',
    13: G,
    14: G,
  }),

  /**
   * Ruoka-aitta: parvi jatkuu koko huoneen läpi ja tehostuslohko on sen yllä.
   *
   * Tehostus on parvella eikä maassa, ja se on tämän linnakkeen ainoa kohta
   * jossa se on. DESIGN.md kohta 5 vaatii perustehostuksen ensimmäiseen
   * neljännekseen, ei sitä että se olisi reitin päällä — ja neljä ruutua ylös
   * on 64 px mitattua 71 px:n seisontahyppyä vastaan, eli voimatason 0 pelaaja
   * yltää laudalle ilman mitään.
   */
  root_pantry: ck(16, {
    0: G,
    1: G,
    5: '      ?!?',
    9: '  -----------',
    12: '             k',
    13: G,
    14: G,
  }),

  /**
   * Vaaka: kolme lautaa nousevassa portaassa, ja korkki maassa.
   *
   * Nousut ovat 4, 1 ja 3 ruutua — jokainen seisontahypyn sisällä, koska
   * laudalta ei saa vauhtia. Ylimmällä laudalla on kolikko: DESIGN.md kohta 5
   * kieltää kiipeämisen tyhjään, ja yksikin tyhjä kiipeäminen opettaa
   * ohittamaan seuraavatkin.
   */
  root_scale: ck(16, {
    0: G,
    1: G,
    4: '          o',
    5: '         ---',
    7: '      o',
    8: '   o ----',
    9: '  ---',
    12: '            c',
    13: G,
    14: G,
  }),

  /**
   * Holvi: kolautusrivin tiilirivi, ja sen päältä lauta ylemmäs.
   *
   * Tässä huoneessa parvi ei ole valmis vaan se rakennetaan: tiilirivin päälle
   * noustaan, ja vasta sieltä yltää laudalle. Se on sama kahden kerroksen lause
   * kuin muuallakin, mutta luettuna alhaalta ylös.
   */
  root_vault: ck(16, {
    0: G,
    1: G,
    5: '         ooo',
    6: '        -----',
    9: '  BB?BB',
    12: '            g',
    13: G,
    14: G,
  }),

  /**
   * Vallihauta: yhdeksän saraketta vauhtia, viisi laavaa, kaksi laskeutumista.
   *
   * Profiili on `keep_hole`in, ja se on lainattu tarkoituksella: seisova hyppy
   * kantaa **0 px** sivusuunnassa, joten laskeutuminen on täsmälleen niin hyvä
   * kuin se vauhdinotto jonka se jättää. Ero maailman 8 reikään on se mikä
   * ruudussa lukee — siellä lattia vain puuttuu, täällä sen tilalla on laavaa —
   * ja se on eri ruutu pelaajalle ja mittarille.
   *
   * Parvi ei ulotu tänne. Kahden kerroksen huoneessa on aina se kysymys mitä
   * ylhäältä tapahtuu kuilun kohdalla, ja vastaus on että ylhäällä ei ole
   * mitään: yläkerros on olemassa vain turvallisen maan päällä.
   */
  root_moat: ck(16, {
    0: G,
    1: G,
    9: '         o o o',
    12: '  g',
    13: '#########WWWWW##',
    14: '#########WWWWW##',
  }),

  /**
   * Pudotus: parven pää, ja piikit sen jälkeen.
   *
   * Lentäjä on laudan korkeudella eikä maan yllä, eli se on ylemmän kerroksen
   * asukas — ylhäällä kulkeva kohtaa sen päänsä korkeudella, alhaalla kulkeva
   * kiertää sen. Piikkipeti on kolme ruutua ja alkaa vasta laudan loputtua, eli
   * se on se hinta jonka parvelta laskeutuminen väärässä paikassa maksaa.
   */
  root_drop: ck(16, {
    0: G,
    1: G,
    7: '       f',
    8: '   o o o',
    9: '  -------',
    12: '       k    ^^^',
    13: G,
    14: G,
  }),
};

/* ============================ maailma 2 ================================== */
/**
 * UUNILINNA — ei yhtään kuilua.
 *
 * Aavikon linnake on ainoa pelissä jonka lattiassa ei ole reikää. Se on
 * tarkoituksellinen vastakohta: jokainen muu linnake kysyy "yletätkö yli", ja
 * tämä kysyy "ehditkö ohi". Vaikeus tulee närästyssuihkuista, jotka ovat pelin
 * halvin rehellinen vaikeus — ne on pultattu yhteen sarakkeeseen ja ne palavat
 * kiinteällä jaksolla, eli ne ovat metronomi, ja metronomin ajoittaminen on
 * taito joka palkitsee kärsivällisyyden eikä refleksiä.
 *
 * Hiekkaa täällä ei ole, ja se on `levels/world2.js`:n oma päätös yhdellä
 * rivillä: *linnakkeessa on kivilattia eikä siellä ole hiekkaa*. Sääntö joka
 * hylätään heti kun se on epämukava ei ollut sääntö.
 */
const KILN_CHUNKS = {
  /** Portti: suihku heti, ja kynnys jonka yli noustaan huoneesta toiseen. */
  kiln_gate: ck(16, {
    0: G,
    1: G,
    9: '      o o o',
    11: '           XXX',
    12: '   H       XXX',
    13: G,
    14: G,
  }),

  /**
   * Pesä: tehostuslohko, kynnys ja suihku sen takana.
   *
   * Kynnys on kaksi ruutua eli se kävellään yli hyppäämällä kerran, ja se on
   * koko tämän sanaston pystysuora liike. Uunissa ei nousta korkealle, siinä
   * astutaan kammiosta kammioon.
   */
  kiln_hearth: ck(16, {
    0: G,
    1: G,
    9: '   !',
    11: '      XXXX',
    12: '      XXXX   H',
    13: G,
    14: G,
  }),

  /**
   * Uuni: laavakouru ja sen yli murtuva ritilä.
   *
   * Tämä on 2-N:n lankkusillan sama kysymys kalliimmalla vastauksella. Siellä
   * lankkujen alla on hiekkaa, joten putoaminen maksaa kolikkolinjan ja
   * kiipeämisen takaisin; täällä alla on tuli. `chunks/desert.js` sanoo miksi
   * murtuva lava on juuri tämän maailman kappale: yön paletissa tiili ja maa
   * ovat lähes samaa ruskeaa, ja murtuva lava ilmoittaa itsestään tärisemällä
   * ja halkeamalla — liike kestää huonon paletin.
   *
   * Ritilä on rivillä 11 eli kaksi ruutua lattian yläpuolella. Laavan päällä
   * lattiaprofiilia ei ole, joten tämä ei ole kuilu eikä seinä millekään
   * tarkistukselle — se on jalansija joka lakkaa olemasta.
   */
  kiln_grate: ck(16, {
    0: G,
    1: G,
    9: '  o o o o o',
    11: '   %%%%%%%%%',
    13: '###WWWWWWWWW####',
    14: '###WWWWWWWWW####',
  }),

  /**
   * Savupiippu: kaksi kiviseinää kattoon asti ja nuottipalikka niiden välissä.
   *
   * Nuottipalikka on ainoa asia tässä pelissä joka nostaa pelaajan korkeammalle
   * kuin hyppy, ja kuilutonta linnaketta se palvelee täsmälleen: ainoa
   * pystysuora matka on se jonka joku muu tekee puolestasi. Kuilu seinien
   * välissä on neljä saraketta, eli ylös lähdetään sieltä mistä alaskin
   * tullaan, ja huipulla on kolikoita — kiipeäminen tyhjään opettaa
   * ohittamaan seuraavatkin kiipeämiset.
   *
   * Seinät päättyvät riville 9 eivätkä lattiaan: alta pitää päästä kävelemään
   * ohi, tai huone olisi este eikä palkinto.
   */
  kiln_flue: ck(16, {
    0: G,
    1: G,
    2: '      XX    XX',
    3: '      XX    XX',
    4: '      XX  o XX',
    5: '      XX    XX',
    6: '      XX  o XX',
    7: '      XX    XX',
    8: '      XX  o XX',
    9: '      XX    XX',
    12: '         N',
    13: G,
    14: G,
  }),

  /**
   * Palkeet: neljä suihkua rivissä ja lauta niiden yli.
   *
   * Kaksi reittiä joista kumpikaan ei ole oikea: maassa neljä metronomia
   * peräkkäin, laudalla ei yhtään mutta myös ei mitään mihin tarttua jos
   * ajoitus menee ohi. Lauta on koko leveydeltä, eli se on silta eikä
   * astinkivi, ja sillan yli meneminen on itsessään palkinto (DESIGN.md kohta
   * 5) — kolikot ovat sen päällä siksi että ahne linja ja turvallinen linja
   * olisivat sama linja.
   */
  kiln_bellows: ck(16, {
    0: G,
    1: G,
    8: '    o o o o',
    9: '   ------------',
    12: '  H   H   H   H',
    13: G,
    14: G,
  }),
};

/* ============================ maailma 3 ================================== */
/**
 * JÄÄLINNA — lattia joka ei kanna.
 *
 * Jäämaailman vaikeus on lattiassa, ja linnakkeessa lattia ei ole liukas: teema
 * vaihtuu ovella. Sanasto vie saman ajatuksen toiseen suuntaan, joka on
 * käytettävissä myös kivellä — **lattia ei kanna.** Murenevaa lavaa jäätikön
 * yllä, lyhyitä saarekkeita kahden kolmen ruudun kuilun välissä, ja tasan yksi
 * paikka jossa saa seistä.
 *
 * Kuilut ovat kolme ja neljä saraketta eivätkä kuusi, ja se on `ice_pit`in
 * mittaus eikä uusi: kuusi olettaa että pelaaja saapuu juosten, ja tässä
 * maailmassa se ei ole valinta. Kolme ja neljä puhdistuvat kävelystä.
 */
const FROST_CHUNKS = {
  /**
   * Portti: ensimmäinen mureneva jakso, ja sen alla on maata.
   *
   * Vaaraton versio ensin, kuten `dune_crumble` opetti murtuvan lavan hiekan
   * yllä ennen kuin `fac_crumble` vei pohjan pois. Täällä ero on yksi rivi:
   * murtuva lattia on rivillä 13 ja rivi 14 on yhä kiveä, joten läpi
   * putoaminen maksaa askeleen eikä henkeä.
   */
  frost_gate: ck(16, {
    0: G,
    1: G,
    9: '     o o o',
    12: '        x',
    13: '####%%%%%%%%####',
    14: G,
  }),

  /**
   * Halkeamat: kaksi kolmen ruudun kuilua ja tehostuslohko saarekkeen yllä.
   *
   * Lohko on saarekkeen päällä eikä kuilun yllä, ja se on koko huoneen
   * suunnittelu: kolautettava lohko kuilun päällä on lohko jota ei voi
   * kolauttaa, ja pelaaja saa selville sen vain putoamalla.
   */
  frost_rift: ck(16, {
    0: G,
    1: G,
    9: '         !',
    12: '   k',
    13: '####   #####   #',
    14: '####   #####   #',
  }),

  /**
   * Sali: pitkä kivilattia ja sen päässä neljän ruudun halkeama.
   *
   * Tämän sanaston hengähdys, ja hengähdys tässä maailmassa on nimenomaan
   * *pitkä yhtenäinen lattia* — se on se mitä muualla ei ole. Korkki on sen
   * asukas: se pomppii pois tallauksen ulottuvilta, eli se on hidaste eikä
   * uhka, ja se on oikea asia huoneessa jonka jälkeen tulee hyppy.
   */
  frost_hall: ck(16, {
    0: G,
    1: G,
    9: '        o o o',
    12: '   c',
    13: '##########    ##',
    14: '##########    ##',
  }),

  /**
   * Kaksoishalkeama: kaksi kuilua ja neljän ruudun saareke välissä.
   *
   * `ice_twin`in mitat sellaisenaan, ja sen kommentti kertoo miksi: kahden
   * ruudun saareke ei ole laskeutumispaikka vaan liuku toiseen kuiluun. Neljä
   * on se leveys jolle voimatason 0 pelaaja pysähtyy. Kolikot ovat kuilujen
   * eivätkä saarekkeen yllä, eli maksava linja ja selviävä linja ovat sama
   * linja.
   */
  frost_twin: ck(16, {
    0: G,
    1: G,
    9: '     o o    o o',
    12: '         x',
    13: '#####   ####   #',
    14: '#####   ####   #',
  }),

  /**
   * Hylly: mureneva lattia jäätikön yllä, ja keskellä yksi kivi.
   *
   * Tämä on koko sanaston lause yhdessä huoneessa. Kaikkialla muualla mureneva
   * lattia on jakso jonka läpi juostaan; tässä sen keskellä on yksi sarake
   * kiveä, ja se on ainoa paikka tässä linnakkeessa jossa saa seistä paikallaan
   * jäätikön päällä. Se ei ole armo vaan mitta: pelaaja saa selville mitä
   * pysähtyminen maksaa vain jos jossain saa pysähtyä.
   */
  frost_shelf: ck(16, {
    0: G,
    1: G,
    9: '    o o  o o',
    12: '  k',
    13: '###%%%%#%%%%####',
    14: '###WWWWWWWWW####',
  }),

  /**
   * Aarrekammio: supertähti kolautusrivillä ja piikkiukko sen jälkeen.
   *
   * `ice_star`in perustelu sellaisenaan: tähti korvaa täsmälleen yhden asian,
   * sen osuman jonka asukas laskisi, ja tämän maailman asukkaista se jota
   * kannattaa käyttää on piikkiukko — ainoa jota tallaus ei poista. Jäätikköä
   * se ei korvaa, joten tässä huoneessa ei ole yhtään laavaruutua: tähden
   * seisottaminen halkeaman edessä lupaisi jotain mitä se ei tee.
   */
  frost_vault: ck(16, {
    0: G,
    1: G,
    9: '  *   BB?BB',
    12: '            x',
    13: G,
    14: G,
  }),
};

/* ============================ maailma 4 ================================== */
/**
 * MYLLYLINNA — koneisto katossa.
 *
 * Tehtaan linnake on jo nyt lähempänä omaansa kuin muut, koska se käyttää
 * `fac_*`-palikoita. Sen oma sanasto vie eron loppuun asti yhdellä
 * rakenteellisella lauseella: **täällä kuljetaan aina jonkin ali.** Katosta
 * roikkuu kiveä, ja se mikä muissa linnakkeissa on ylhäällä palkinto, on täällä
 * ylhäällä este.
 *
 * Se on myös ainoa sanasto jossa matala katto tulee vastaan ennen maailmaa 8:
 * `mill_press` jättää kolme riviä, joka on suurimman voimatason mitta (`HEAD`),
 * eli suurin pelaaja kulkee siitä juuri ja juuri.
 */
const MILL_CHUNKS = {
  /**
   * Portti: kaksi laskeutuvaa kiveä katosta, ja niiden väliin jää oviaukko.
   *
   * Tehostuslohko on tässä eikä omassa huoneessaan, koska tämä sanasto on
   * ainoa jossa jokainen muu huone on jonkin ali kulkemista: lohko vaatii
   * hypyn, ja hyppy vaatii katon.
   */
  mill_gate: ck(16, {
    0: G,
    1: G,
    2: '    XX      XX',
    3: '    XX      XX',
    4: '    XX      XX',
    5: '    XX      XX',
    9: '   !   o o o',
    12: '  g',
    13: G,
    14: G,
  }),

  /**
   * Puristin: kivi katosta riville 9, eli kolme riviä jalansijaa.
   *
   * Kolme riviä on `HEAD` rules.js:ssä — 43 px kroppaa 48 px ilmaa vasten — eli
   * matalin mitta jonka läpi peli päästää suurimman koon. Sen alla kävellään,
   * ei hypätä, ja se on koko huoneen kysymys: närästyssuihku on toisella
   * puolella eikä sen ohi pääse ilmateitse.
   */
  mill_press: ck(16, {
    0: G,
    1: G,
    2: '     XXXXXX',
    3: '     XXXXXX',
    4: '     XXXXXX',
    5: '     XXXXXX',
    6: '     XXXXXX',
    7: '     XXXXXX',
    8: '     XXXXXX',
    9: '     XXXXXX',
    12: '            H',
    13: G,
    14: G,
  }),

  /**
   * Hihna: kaksi kapeaa laavaränniä ja niiden yli kaksi lautaa eri
   * korkeuksilla.
   *
   * Kaksi lautaa eikä yksi pitkä, ja porrastettuina: ylempi reitti on kaksi
   * hyppyä joista jälkimmäinen alkaa laudalta eli ilman vauhtia. Se on eri
   * taito kuin yksi pitkä hyppy.
   *
   * **Maassa on silti reitti, ja se on mitattu eikä oletettu.** Ensimmäinen
   * versio oli yksi kymmenen ruudun kouru jonka yli pääsi vain laudoilla, ja
   * `tools/playable.mjs` sanoi mitä se maksoi: voimatason 0 botti jäi
   * sarakkeeseen 90. Lauta on validaattorille reitti mutta ei botille, ja
   * DESIGN.md kohta 5 puhuu maareitistä. Nyt rännejä on kaksi kolmen ruudun
   * levyistä ja niiden välissä kiveä: laudat ovat nopea linja, hyppy on
   * varma.
   */
  mill_belt: ck(16, {
    0: G,
    1: G,
    8: '        ooo',
    9: '       -----',
    10: '  ----',
    12: '             c',
    13: '###WWW###WWW####',
    14: '###WWW###WWW####',
  }),

  /**
   * Poistoputki: kolme suihkua ja niiden yllä tiilirivi jonka päälle ei pääse.
   *
   * Tiilirivi on tavallisella kolautusrivillä, mutta neljä riviä sen yllä on
   * teräslaatta — eli lohkot saa vain alhaalta. Kaikkialla muualla pelissä
   * lohkorivi on myös hylly jolle noustaan; tehtaan linnakkeessa se on pelkkä
   * lohkorivi, koska koneisto on sen päällä. Sama palkinto, puolet liikkeistä.
   */
  mill_duct: ck(16, {
    0: G,
    1: G,
    5: '   XXXXXXX',
    9: '   BB?BB',
    12: '  H    H    H',
    13: G,
    14: G,
  }),

  /**
   * Kuilu: viisi ruutua laavaa, mureneva huuli ja yhdeksän saraketta vauhtia.
   *
   * Huuli on murtuvaa lavaa eikä kiveä, eli vauhdinoton viimeinen askel on
   * jalansija joka lähtee alta jos sillä viipyy. Se ei muuta hypyn mittaa
   * millään tavalla — se muuttaa sen milloin hyppy on pakko tehdä.
   */
  mill_gap: ck(16, {
    0: G,
    1: G,
    9: '          o o o',
    12: '  g',
    13: '#########%    ##',
    14: '#########WWWWW##',
  }),
};

/* ============================ maailma 5 ================================== */
/**
 * ROVIOLINNA — kaikki on ylitys.
 *
 * 5-F on uusintaottelu ja pelin viimeinen kenttä ennen finaalia. Sen vaikeus on
 * `levels/world5.js`:n mukaan käytetty kouruihin eikä vihollisiin, koska tässä
 * kohtaa pelaaja on nähnyt jokaisen vihollisen eikä yksikään niistä ole uutinen.
 * Sanasto on tuo päätös rakenteena: **jokainen huone on ylitys**, ja se mikä
 * vaihtelee on se mistä ylitetään ja mille laskeudutaan.
 *
 * Kolme ylitystä, kolme eri kysymystä: kuusi ruutua ilman mitään, kahdeksan
 * kahdella astinlaudalla, ja mureneva ritilä.
 *
 * Neljäs oli kivihylly josta astuttiin alas (`pyre_ledge`), ja se on poistettu
 * 10.8.2026: 5-F ei asettanut sitä kertaakaan. Poistoperuste on `bone_twin`in
 * eikä uusi — palikka jota mikään kenttä ei aseta lupaa sanaston jota ei ole —
 * ja `verify.mjs` mittaa sen nyt ilman yhtään nimettyä poikkeusta.
 */
const PYRE_CHUNKS = {
  /** Portti: tehostuslohko ja kouru heti perään, eli mitään ei anneta ilmaiseksi. */
  pyre_gate: ck(16, {
    0: G,
    1: G,
    9: '     !',
    12: '  g        k',
    13: G,
    14: G,
  }),

  /**
   * Sali: se yksi huone jossa lattia on ehjä.
   *
   * Sanaston lause on että kaikki on ylitys, ja lause tarvitsee vastaesimerkin
   * ollakseen luettavissa: jos jokainen huone on kouru, kouru lakkaa olemasta
   * huomio ja muuttuu maastoksi. Tämä on myös se paikka jossa vaikeus on
   * ihmisiä ja piikkejä eli halpaa — voimataso menee, henki ei — ja se on
   * mitattu tarve eikä armo: pelkistä kouruista koottu 5-F mittasi 650 pistettä
   * eli kaksi kertaa maailman 6 linnakkeen, ja vaikeuskäyrä kääntyi laskuun
   * heti sen jälkeen.
   *
   * **Eikä täällä ole piikkejäkään, ja se on mitattu kolmesti.** Kolme versiota
   * yritti panna piikkipedin tähän huoneeseen ja `tools/playable.mjs` kaatoi
   * jokaisen: peti tiilirivin alla (5-F sarake 39, hyppy osui riviin), neljän
   * ruudun peti kahden sarakkeen laskeutumisella (sarake 76), ja kolmen ruudun
   * peti heti murtuvan ritilän jälkeen (sarake 74, botti tulee kannelta ilman
   * vauhtia). Yhteinen syy on tämän sanaston oma rakenne: kun **joka toinen
   * huone on ylitys**, hengähdyshuone on aina se paikka johon saavutaan vauhti
   * käytettynä, eikä siellä siksi ole varaa yhteenkään esteeseen.
   *
   * Niinpä tässä ei ole yhtään tappavaa ruutua. Se on rovion vastaus samaan
   * kysymykseen jonka `keep_watch` ratkaisi asukkailla: hengähdys ei saa olla
   * tyhjä, mutta se saa olla vaaraton.
   */
  pyre_hall: ck(16, {
    0: G,
    1: G,
    9: '  BB?BB',
    12: '  k          g',
    13: G,
    14: G,
  }),

  /**
   * Kouru: viisi ruutua laavaa ja seitsemän saraketta vauhtia.
   *
   * Viisi eikä kuusi, vaikka mitattu budjetti on kuusi: `tools/playable.mjs`:n
   * voimatason 0 botti ei ole luotettava kuudella, ja se on sama mittaus jonka
   * luulaakso teki ensin. 5-F on jo nyt se kenttä jossa botti luovuttaa
   * (`fort_trench`in yhdeksän ruutua ja yksi lauta), joten tämä sanasto on se
   * paikka jossa asia korjataan eikä toistetaan.
   *
   * Kouru alkaa sarakkeesta 7 eikä 9, ja se on tarkoituksellinen ero maailman 1
   * vallihautaan: sama kysymys eri kohdassa huonetta on eri ikkuna sekä
   * mittarille että pelaajalle, joka lukee huoneen vasemmalta oikealle.
   */
  pyre_trench: ck(16, {
    0: G,
    1: G,
    9: '       o o o',
    12: '  g          k',
    13: '#######WWWWW####',
    14: '#######WWWWW####',
  }),

  /**
   * Astinkivet: kymmenen ruutua laavaa ja kaksi kivipaatta siinä.
   *
   * Paadet ovat kaksi riviä korkeita ja niiden laki on ruudun verran
   * ympäröivää lattiaa ylempänä, eli ne ovat kiviä laavassa eivätkä siltoja sen
   * yli. Ylitys on kolme kolmen sarakkeen loikkaa, ja kolme on 48 px mitattua
   * 155 px:n juoksuhyppyä vasten — eli tämä on ajoituskysymys eikä
   * pituuskysymys, ja se on eri kysymys kuin `pyre_trench`in yksi täysi hyppy.
   *
   * **Miksi paadet eivätkä laudat.** Ensimmäinen versio oli seitsemän ruutua
   * laavaa ja kaksi lautaa, ja `tools/playable.mjs` kaatoi sen: voimatason 0
   * botti kuoli sarakkeeseen 89. Lauta kelpaa validaattorille reitiksi mutta ei
   * botille, ja 5-F on jo entuudestaan se kenttä jossa botti luovuttaa
   * (`fort_trench`). Sanaston tarkoitus oli korjata se eikä toistaa sitä.
   *
   * Lauta on yhä paikallaan paatten yllä, mutta nyt se on nopea linja eikä
   * ainoa linja.
   */
  pyre_steps: ck(16, {
    0: G,
    1: G,
    8: '     ooooo',
    9: '    --------',
    12: '     XX  XX',
    13: '###WWXXWWXXWW###',
    14: '###WWWWWWWWWW###',
  }),

  /**
   * Ritilä: mureneva lava kourun yllä, ja suihku sen huulella.
   *
   * Ritilä on rivillä 12 eli ruudun verran ympäröivää lattiaa korkeammalla,
   * eikä lattian tasossa: se on **kansi tulen päällä** eikä palanut lattia, ja
   * ero näkyy siinä että sen alle jää tilaa jota ei ole. Yhdeksän murtuvaa
   * ruutua on jalansija niin kauan kuin liikkuu.
   *
   * Suihku on lähtöpäässä eikä kannen päällä: se ei muuta hypyn mittaa, se
   * maksaa sen hetken jolloin lähdet — `keep_forge`in peruste sellaisenaan,
   * koska suihku ei ole maastoa.
   */
  pyre_grate: ck(16, {
    0: G,
    1: G,
    9: '    o o o o',
    12: ' H %%%%%%%%%',
    13: '###WWWWWWWWW####',
    14: '###WWWWWWWWW####',
  }),
};

/* ============================ maailma 6 ================================== */
/**
 * KRYPTA — tie vie alaspäin.
 *
 * `chunks/bone.js` perustelee itsensä yhdellä lauseella — *luu seisoo* — ja
 * siksi luumaailman pystysuora kiinnostavuus kasvaa maasta: selkärankoja,
 * hautakiviä, harjuja. Krypta on sama lause sisätiloissa ja ylösalaisin:
 * **maasta noussut kivi on täällä se lattia jolta pudotaan.**
 *
 * Käytävä kulkee kivihyllyllä ja putoaa säännöllisin välein kammioon. Se on
 * silhuetti jota millään muulla linnakkeella ei ole: muissa lattia on yksi
 * viiva ja poikkeukset ovat reikiä, täällä lattia on porras alaspäin.
 *
 * **Eikä ylös enää noustakaan, ja se on mittaus eikä tiukennus.** Sanastossa
 * oli portaat takaisin hyllylle (`crypt_stair`) ja luukammio piikkiukkoineen
 * (`crypt_ossuary`), ja 6-F:n soittolista ei asettanut kumpaakaan kertaakaan.
 * Ne poistettiin 10.8.2026 samalla perusteella jolla `bone_twin` lähti. Lause
 * on siis nyt se joka kentässä oikeasti soi: **krypta menee alas ja jää alas.**
 *
 * Luulinnakkeen huoneissa on katto, ja siksi ne eivät ole `bone.js`:ssä: se
 * tiedosto lupaa että taivas on auki jokaisessa palikassaan, ja `verify.mjs`
 * mittaa lupauksen. Krypta ei ole luuvainio, ja `bg: 'none'` sanoo saman
 * ruudulla.
 */
const CRYPT_CHUNKS = {
  /**
   * Portti: sisään astutaan hyllylle, ei lattialle.
   *
   * Ensimmäinen sarake on kaksi ruutua koholla, eli maailman ensimmäinen ele on
   * pudotus. Tehostuslohko ja kolikot ovat hyllyn *jälkeen* eivätkä sen yllä,
   * ja se on mitta eikä sommittelu: hyllyn pinta on rivillä 11, joten sen yllä
   * kolme riviä kuuluu kulkijalle (`HEAD`), ja lohko rivillä 9 olisi katto joka
   * ei päästä suurinta kokoa läpi.
   */
  crypt_gate: ck(16, {
    0: G,
    1: G,
    9: '        !  o o',
    11: 'XXXXXXXX',
    12: 'XXXXXXXX     g',
    13: G,
    14: G,
  }),

  /**
   * Kirkkosali: kammion pohja, kolme asukasta eikä yhtään reikää.
   *
   * Luulaakson `bone_dance` sisätiloissa. Se on halvin vaikeus mikä pelissä on
   * — ei kuilua, ei vaaraa, ei tähtäystä — ja siksi sitä saa käyttää
   * anteliaasti ilman että maailmasta tulee kujanjuoksu. Tässä sanastossa se on
   * myös se huone joka on aina *alhaalla*, eli se on palkinto pudotuksesta.
   */
  crypt_nave: ck(16, {
    0: G,
    1: G,
    9: '     o o o',
    12: '  g   X k   X g',
    13: G,
    14: G,
  }),

  /**
   * Kuoppa: viisi ruutua tyhjää, yhdeksän saraketta vauhtia, kaksi laskeutumista.
   *
   * Viisi eikä kuusi, ja se on luulaakson mittaus eikä uusi: voimatason 0 botti
   * ei ole luotettava kuudella, ja tämän maailman jokainen reikä on yhden alle
   * budjetin — niitä on vain enemmän. Vauhdinoton puolella ei ole mitään, koska
   * kaksi ruutua ylhäällä oleva kappale luetaan seinäksi ja hyppy alkaa liian
   * aikaisin.
   *
   * Vauhtia on kahdeksan saraketta ja laskeutumista kolme, eikä luulaakson
   * yhdeksän ja kaksi. Ero on tarkoituksellinen: sama reikä eri kohdassa
   * huonetta on eri huone sille joka lukee sen vasemmalta oikealle, ja krypta
   * on se sanasto jossa laskeutumispuolella on tilaa, koska sen jälkeen
   * pudotaan.
   *
   * **Laskeutumispuoli on tyhjä sekin, ja se on mitattu.** Ensimmäisessä
   * versiossa maalin puolella seisoi hautakivi, ja `tools/playable.mjs` kertoi
   * mitä se maksoi: kivi oli kaksi saraketta ennen palikan reunaa, eli se oli
   * seuraavan huoneen vauhdinotossa, ja voimatason 0 botti kuoli 6-F:n
   * sarakkeeseen 73. Luulaakson sääntö koskee siis myös naapuria: reiän
   * jälkeinen maa kuuluu sille kuilulle joka tulee seuraavaksi.
   */
  crypt_pit: ck(16, {
    0: G,
    1: G,
    9: '         o o o',
    12: '  k',
    13: '########     ###',
    14: '########     ###',
  }),

  /**
   * Leuat: kaksi hammasriviä ja lauta ensimmäisen yli.
   *
   * `bone_jaws` sisätiloissa, ja sen mittaus sellaisenaan: kaksi neljän ruudun
   * petiä eikä yhtä kahdeksan, koska botti lukee piikkipedin yhtenä esteenä ja
   * pitää sen leveyteen suhteutetun hypyn. Lauta on ensimmäisen yli ja loppuu
   * ennen toista — silta joka päättyy hampaiden päälle on se sommitelma joka
   * kaatoi 6-3:n.
   *
   * Krypta tarvitsee tämän siksi että sen muut huoneet ovat reikiä ja
   * pudotuksia: maailma jossa jokainen virhe tappaa on maailma jossa jokainen
   * virhe on sama virhe.
   */
  crypt_jaws: ck(16, {
    0: G,
    1: G,
    8: '     ooo',
    9: '    -------',
    12: '  ^^^^    ^^^^',
    13: G,
    14: G,
  }),

  /**
   * Tuhkakuoppa: kahdeksan saraketta vauhtia, viisi laavaa, kolme laskeutumista.
   *
   * Kryptan ainoa tuli, ja se on tässä koska 6-F on aina ollut maailmansa
   * korkein luku: maailmassa on neljä kenttää, joten linnake kantaa
   * neljänneksen sen keskiarvosta, ja pelkistä rei'istä koottu krypta mittasi
   * 168 pistettä siinä missä vanha 395. Kuoppa jonka pohjalla on tulta on se
   * ero, ja se on luulaakson oma kuva: hauta jota ei ole suljettu.
   */
  crypt_ash: ck(16, {
    0: G,
    1: G,
    9: '        o o o',
    12: '  k',
    13: '########WWWWW###',
    14: '########WWWWW###',
  }),
};

/* ============================ maailma 7 ================================== */
/**
 * PILVITORNI — tie vie ylöspäin.
 *
 * `chunks/cloud.js` perustelee itsensä sillä että mikään ei seiso: pilvi on
 * määritelmän mukaan se aine joka ei kanna itseään, joten kaasukehän korkeus
 * ostetaan laudoilla ja leijuvilla lohkoilla. Linnake on saman lauseen
 * sisätilaversio ja kryptan peilikuva: **käytävä nousee.**
 *
 * Kannet nousevat riveillä 9, 7 ja 5, ja lattiassa on reikiä niiden alla. Se
 * tekee ylemmästä reitistä turvallisen ja alemmasta lyhyen, mikä on
 * päinvastoin kuin missään muualla pelissä — ja se on tarkoitus. Maareitti on
 * silti auki voimatasolla 0 (DESIGN.md kohta 5): jokainen reikä on viisi
 * ruutua ja jokaisen edessä on yhdeksän saraketta lattiaa.
 *
 * Puuska (`spire_squall`) oli tässä sanastossa hengähdyshuoneena ja poistettiin
 * 10.8.2026: 7-F ei asettanut sitä kertaakaan. Torni hengähtää nyt siellä missä
 * se oikeasti hengähtää, eli portilla ja rakeiden välissä.
 */
const SPIRE_CHUNKS = {
  /** Portti: ensimmäinen kansi, ja ruskea pilvi sen yllä. */
  spire_gate: ck(16, {
    0: G,
    1: G,
    6: '        r',
    8: '     ooo',
    9: '    -----',
    12: '  g',
    13: G,
    14: G,
  }),

  /**
   * Nousu: kolme kantta riveillä 9, 7 ja 5, ja tehostuslohko ylimmällä.
   *
   * Jokainen nousu on kaksi ruutua eli 32 px, ja ensimmäinen lattiasta neljä
   * eli 64 px — kaikki seisontahypyn 71 px:n sisällä, koska kannella ei ole
   * vauhtia otettavaksi. Se on sama laskutoimitus jolla `cloud_updraft` on
   * mitoitettu ja se on ainoa laskutoimitus joka tekee lautamaailmasta
   * kiivettävän.
   */
  spire_climb: ck(16, {
    0: G,
    1: G,
    4: '          !',
    5: '         ----',
    6: '      oo',
    7: '     ----',
    8: '   oo',
    9: '  ----',
    12: '              g',
    13: G,
    14: G,
  }),

  /**
   * Aukko: viisi ruutua reikää, ja sen yllä kansi joka ei ylitä sitä.
   *
   * Kansi loppuu huulen kohdalla eikä jatku reiän yli, ja se on kaasukehän
   * oma sääntö sellaisenaan: **yksikään lauta tässä maailmassa ei silloita
   * reikää.** Ylempi reitti on turvallinen kulkea muttei ylittää — ylityksen
   * tekee jokainen itse. Vauhdinoton puolella ei ole mitään.
   */
  spire_hole: ck(16, {
    0: G,
    1: G,
    8: '  ooo',
    9: ' -----',
    12: '               k',
    13: '#########     ##',
    14: '#########     ##',
  }),

  /**
   * Rakeita: kaksi raekenttää ja kansi ensimmäisen yli.
   *
   * `cloud_hail` sisätiloissa. Ruskea pilvi on toisen pedin yllä eikä maassa —
   * se keinuu syntymäkorkeutensa ympärillä (DESIGN.md kohta 6), joten maahan
   * sitä ei saa panna — ja se mitä se tekee on työntää sivulle sen lattian
   * kohdalla joka puree.
   *
   * Tämä on se huone jolla pilvitorni saa vaikeutensa ilman lisää reikiä.
   * Maailmassa on neljä kenttää, joten linnake kantaa neljänneksen sen
   * keskiarvosta, ja pelkistä rei'istä ja kansista koottu torni mittasi 245
   * pistettä siinä missä vanha 405 — eli vaikeuskäyrä olisi kääntynyt laskuun
   * pelin viimeistä maailmaa edeltävässä kohdassa.
   */
  spire_hail: ck(16, {
    0: G,
    1: G,
    6: '          r',
    8: '   ooo',
    9: '  ------',
    12: '   ^^^^   ^^^^',
    13: G,
    14: G,
  }),

  /**
   * Ristikko: pitkä kansi koko huoneen läpi ja raekenttä sen alla.
   *
   * Tämä on se huone joka antaa alaspainamiselle seurauksen. Kansi on pitkä
   * mutta se **loppuu raekentän kohdalla** eikä ennen sitä: `cloud_lattice`
   * panee piikit kannen keskelle, tässä ne ovat sen päässä, eli kansi ei ole
   * silta piikkien yli vaan tie niiden luo. Hinta on voimataso, sama minkä peli
   * veloittaa jokaisesta huolimattomasta laskeutumisesta.
   *
   * Kolme ruutua piikkejä eikä viisi: viisi kannen alla on se sommitelma jonka
   * luulaakso mittasi botin tappajaksi.
   *
   * (Kommentti oli 10.8.2026 asti `spire_hail`in yllä eli väärän palikan päällä.
   * Se siirtyi tähän kun `spire_squall` poistettiin — poistetun naapurin vieressä
   * väärin osuva kommentti on juuri se joka jää huomaamatta.)
   */
  spire_lattice: ck(16, {
    0: G,
    1: G,
    6: '     ooo',
    9: '  ---------',
    12: '  k      ^^^ g',
    13: G,
    14: G,
  }),
};

/* ============================ maailma 8 ================================== */
/**
 * VALTAISTUINSALI — huone kutistuu.
 *
 * Maailmalla 8 on jo oma sanastonsa, `chunks/keep.js`, ja se on tämän
 * tiedoston ennakkotapaus. Silti 8-F mittasi **0,0 %** koko pelille uutta, ja
 * syy on eri kuin muilla: 8-F ei toistanut muiden maailmojen linnakkeita vaan
 * *omia kenttiään*. `keep_vault`, `keep_teeth`, `keep_watch` ja `keep_croak`
 * ovat kaikki nähty kentissä 8-1…8-7 ennen kuin linnakkeen ovi aukeaa, joten
 * viimeisellä käytävällä ei ollut mitään sanottavaa.
 *
 * Siksi finaalilla on oma sanastonsa erikseen maailman omasta. Lause on se
 * ainoa jota `keep.js` ei sano: **huone kutistuu.** Katto laskeutuu riville 9,
 * joka on `HEAD` — kolme riviä, 48 px ilmaa 43 px:n kroppaa vasten — eli
 * matalimmassa kohdassa suurin pelaaja mahtuu kävelemään muttei hyppäämään.
 * Peli jossa kaikki ratkaistaan hyppäämällä saa lopuksi käytävän jossa ei voi
 * hypätä.
 *
 * Maailman 8 kolme sääntöä pätevät jokaiseen palikkaan tässä, ja `verify.mjs`
 * mittaa ne: jokaisen sarakkeen yllä on kiveä, tiili ei kosketa kiveä, ja
 * jokaisen kuilun edessä on yhdeksän saraketta lattiaa.
 */
const THRONE_CHUNKS = {
  /** Portti: täysi korkeus vielä kerran, ja katto alkaa laskea perällä. */
  throne_gate: ck(16, {
    0: G,
    1: G,
    2: '          XXXXXX',
    3: '          XXXXXX',
    9: '   o o o',
    12: '  g      k',
    13: G,
    14: G,
  }),

  /**
   * Ryömintä: katto rivillä 9, eli kolme riviä jalansijaa ja ei hyppyä.
   *
   * Kolme riviä on `HEAD` rules.js:ssä ja se on tarkka mitta eikä varmuusvara:
   * suurin voimataso on 43 px ja kolme riviä on 48 px. Kuori kävelee kaidassa
   * osassa, koska ryömintä ilman asukasta olisi vain kävelyä — ja koska kuori
   * on ainoa vihollinen jonka ohi pääsee ilman että sen yli hypätään.
   *
   * Kahdeksan samanlaista riviä on paljon kirjoitettavaa, ja ne ovat tässä
   * kirjoitettuina siksi että muoto pitää näkyä tiedostossa. Palikka jonka
   * muodon näkee vain ajamalla ei ole luettava palikka.
   */
  throne_crawl: ck(16, {
    0: G,
    1: G,
    2: '    XXXXXXXX',
    3: '    XXXXXXXX',
    4: '    XXXXXXXX',
    5: '    XXXXXXXX',
    6: '    XXXXXXXX',
    7: '    XXXXXXXX',
    8: '    XXXXXXXX',
    9: '    XXXXXXXX',
    12: '       k',
    13: G,
    14: G,
  }),

  /**
   * Aarrekammio: kaksi kerrosta tiiltä ilmassa, eikä kumpikaan koske kiveen.
   *
   * Maailman 8 sääntö 2 kirjoitettuna paikaksi eikä kielloksi — sama mitä
   * `keep_vault` tekee, mutta eri sommitelmalla: siellä tiilet ovat päällekkäin
   * samassa sarakkeessa, tässä ne ovat porrastettuina, joten ylemmälle tasolle
   * noustaan sivusuunnassa eikä suoraan ylös. Tehostuslohko on alemmassa
   * kerroksessa, koska DESIGN.md kohta 5 haluaa sen alkuneljännekseen ja koska
   * ylempi kerros on palkinto eikä huolto.
   */
  throne_hoard: ck(16, {
    0: G,
    1: G,
    5: '    B?B',
    9: '        B!B',
    12: '  g',
    13: G,
    14: G,
  }),

  /**
   * Kouru: mureneva huuli ja neljä ruutua laavaa.
   *
   * Yhdeksän saraketta kiveä ja yksi mureneva ennen laavaa: sääntö 3 laskee
   * murtuvan lavan jalansijaksi, ja se on oikein — se kantaa kunnes sille
   * astuu. Mitä se muuttaa on lähtöhetki eikä hypyn mitta, ja se on ainoa asia
   * jonka viimeinen käytävä lisää tuttuun kouruun.
   */
  throne_moat: ck(16, {
    0: G,
    1: G,
    9: '          o o o',
    12: '  g          k',
    13: '#########%    ##',
    14: '#########WWWWW##',
  }),

  /**
   * Hampaat: kaksi piikkipetiä, lentäjä välissä ja katto niiden yllä.
   *
   * Kaksi kolmen ruudun petiä eikä yhtä kuutta, ja se on luulaakson mittaus:
   * botti lukee piikkipedin yhtenä esteenä ja pitää sen leveyteen suhteutetun
   * hypyn, joten leveä peti on pitkä loikka siitä vauhdista mitä sattuu
   * jäämään. Lentäjä on kattoa vasten sillä korkeudella jolla hyppy on jo
   * sitoutunut — se on se hinta jonka piikkien yli hyppääminen tässä huoneessa
   * maksaa.
   */
  throne_teeth: ck(16, {
    0: G,
    1: G,
    2: '      XXXX',
    3: '      XXXX',
    7: '           f',
    12: '  ^^^      ^^^',
    13: G,
    14: G,
  }),

  /**
   * Vahtihuone: kolme asukasta ja ei yhtään tappavaa ruutua.
   *
   * Finaalin ainoa hengähdys, ja se on `keep_watch`in peruste sellaisenaan:
   * käytävä jossa kaikki tappaa on käytävä jossa jokainen virhe on sama virhe.
   * Ihmiset ovat halpaa vaikeutta — kävelijä maksaa voimatason, ja voimataso on
   * resurssi jonka voi käyttää ja saada takaisin.
   *
   * Ero `keep_watch`iin on korkeus: siellä lentäjä on rivillä 7 avoimessa
   * huoneessa, tässä katto on rivillä 5 sen yllä, eli väistötilaa on kaksi
   * riviä eikä kuusi.
   */
  throne_watch: ck(16, {
    0: G,
    1: G,
    2: '   XXXXXXXXXX',
    3: '   XXXXXXXXXX',
    4: '   XXXXXXXXXX',
    5: '   XXXXXXXXXX',
    7: '      f',
    9: '  o o o',
    12: '  c         g',
    13: G,
    14: G,
  }),
};

/**
 * Kuka omistaa minkäkin palikan. Tämä taulu on ainoa totuus; kaikki muu
 * johdetaan siitä, jotta kaksi listaa ei voi olla eri mieltä.
 */
export const FORTRESS_VOCAB = {
  w1: ROOT_CHUNKS,
  w2: KILN_CHUNKS,
  w3: FROST_CHUNKS,
  w4: MILL_CHUNKS,
  w5: PYRE_CHUNKS,
  w6: CRYPT_CHUNKS,
  w7: SPIRE_CHUNKS,
  w8: THRONE_CHUNKS,
};

/** Sama sanasto litteänä, `chunks.js`:n koottavaksi. */
export const FORTRESS_WORLD_CHUNKS = Object.assign({}, ...Object.values(FORTRESS_VOCAB));
