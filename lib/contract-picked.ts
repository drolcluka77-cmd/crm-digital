// Contract for Mr. Picked (AI search visibility / local SEO) packages.
// Used automatically when the quote contains Picked packages. Same {{placeholders}} as the general template.

/** Does this quote sell Mr. Picked packages? */
export function isPickedQuote(items: { name: string }[]) {
  return items.some((i) => /picked|\bvisible\b|\brecommended\b|\bconcierge\b/i.test(i.name));
}

export const PICKED_CONTRACT_TEMPLATE = `POGODBA O IZVAJANJU STORITEV MR. PICKED
(vidnost v iskanju z umetno inteligenco in lokalni SEO)
št. {{stevilka}}

sklenjena med:

{{izvajalec_naziv}}, {{izvajalec_naslov}}, matična številka: {{izvajalec_maticna}}, {{izvajalec_davcna}}, ki ga zastopa {{izvajalec_zastopnik}}, ki storitve izvaja pod blagovno znamko Mr. Picked (v nadaljevanju: izvajalec)

in

{{narocnik_naziv}}, {{narocnik_naslov}}, matična številka: {{narocnik_maticna}}, davčna številka / ID za DDV: {{narocnik_ddv}}, ki ga zastopa {{narocnik_zastopnik}} (v nadaljevanju: naročnik)

1. PREDMET POGODBE

1.1 Izvajalec se zavezuje, da bo za naročnika izvajal storitve za večjo vidnost naročnika v iskalnikih in asistentih z umetno inteligenco (npr. Google, Google Zemljevidi, ChatGPT, Gemini, Perplexity) in lokalni SEO, v obsegu naslednjega paketa in dodatkov (v nadaljevanju: storitve):
{{storitve}}

1.2 Podrobna vsebina paketa je opisana v ponudbi št. {{ponudba}} in na mrpicked.eu na dan podpisa te pogodbe. Ponudba je sestavni del te pogodbe. Če se ponudba in ta pogodba razlikujeta, velja ta pogodba.

1.3 Storitve obsegajo predvsem: izhodiščno meritev vidnosti, ureditev Google profila podjetja, uskladitev podatkov o naročniku na drugih spletnih platformah in imenikih, pripravo strukturiranih podatkov za spletno stran, redne objave in vsebine glede na paket, mesečno meritev vidnosti in mesečno poročilo.

2. CENA IN PLAČILNI POGOJI

2.1 Cena storitev:
{{cene}}

2.2 {{ddv_klavzula}}

2.3 Mesečno nadomestilo se obračunava vnaprej za tekoči mesec. Enkratna namestitev (če je dogovorjena) se obračuna ob začetku izvajanja.

2.4 Izvajalec po podpisu pogodbe izda predračun, ki ga naročnik poravna v {{rok_placila}} dneh. Izvajanje storitev se začne po prejemu plačila; dan prejema plačila je datum začetka izvajanja (v nadaljevanju: datum začetka).

2.5 Pri zamudi s plačilom lahko izvajalec po predhodnem pisnem opozorilu začasno ustavi izvajanje storitev do poravnave dolga in zaračuna zakonske zamudne obresti. Čas ustavitve se ne šteje v rok iz 5. člena.

3. TRAJANJE IN ODPOVED

3.1 Pogodba začne veljati z dnem podpisa in je sklenjena za nedoločen čas.

3.2 Vsaka stranka lahko pogodbo pisno (tudi po e-pošti) odpove z odpovednim rokom 60 dni. V odpovednem roku izvajalec storitve izvaja in jih obračuna v polnem obsegu. Že plačane storitve za tekoče obdobje se ne vračajo.

3.3 Vsaka stranka lahko pogodbo odpove brez odpovednega roka, če druga stranka huje krši pogodbo in kršitve ne odpravi v 15 dneh po pisnem opozorilu.

3.4 Ob prenehanju pogodbe izvajalec naročniku preda podatke in vsebine, pripravljene zanj, ter se odstrani kot upravitelj z naročnikovih profilov ali ga na to opozori, da to stori sam.

4. ZAČETEK IZVAJANJA, DOSTOPI IN SODELOVANJE

4.1 Izvajalec v 3 delovnih dneh po datumu začetka opravi uvodni pogovor z naročnikom in z njim uskladi podatke o podjetju (naziv, naslov, telefon, delovni čas, storitve in cene, opis, fotografije).

4.2 Naročnik izvajalca na Google profilu podjetja, spletni strani in drugih platformah doda kot upravitelja (na e-naslov info@mrpicked.eu ali drug naslov, ki ga sporoči izvajalec). Izvajalec gesel naročnika ne zahteva in jih ne hrani.

4.3 Naročnik v 10 dneh po datumu začetka zagotovi dostope iz 4.2. in podatke iz 4.1. ter jamči, da so podatki resnični in da ima pravico do uporabe posredovanih fotografij, logotipov in drugih gradiv.

4.4 Spletna stran: izvajalec pripravi strukturirane podatke (schema.org), datoteko llms.txt in nastavitve za robote. Kjer ima dostop do urejanja spletne strani, jih vstavi sam; kjer ga nima ali kjer spletno stran vodi tretja oseba (npr. programer naročnika), jih skupaj z navodili posreduje naročniku oziroma tej osebi. Za delo in stroške tretjih oseb izvajalec ne odgovarja. Izdelava ali prenova spletne strani ni del paketa, razen če je dogovorjena kot dodatek.

4.5 Objave in odgovori na ocene: izvajalec vsebine, ki jih objavlja v imenu naročnika, pred objavo pošlje naročniku v pregled. Če naročnik v 2 delovnih dneh ne poda pripomb, se šteje, da je vsebino odobril. Naročnik lahko kadarkoli pisno zahteva, da se vsaka vsebina objavi šele po njegovi izrecni odobritvi.

4.6 Naročnik izvajalca obvesti o spremembah podatkov o podjetju (npr. delovni čas, telefon, naslov, storitve), izvajalec pa jih uskladi na platformah, kjer ima dostop.

4.7 Če naročnik ali tretja oseba brez obvestila izvajalcu spreminja podatke na platformah, ki jih ureja izvajalec, izvajalec ne odgovarja za neskladja, ki zaradi tega nastanejo.

5. MERJENJE IN OBLJUBA 90 DNI

5.1 Pred začetkom del izvajalec naredi izhodiščno meritev: v izbranih AI asistentih postavi nabor vprašanj, ki jih o storitvah naročnika postavljajo stranke, in preveri uvrstitve naročnika na Google Zemljevidih za nabor ključnih iskanj. Nabor vprašanj in iskanj izvajalec sporoči naročniku in ga za namen primerjave ne spreminja.

5.2 Ocena vidnosti je delež odgovorov AI asistentov, v katerih je naročnik omenjen. Izvajalec meritev ponovi vsak mesec z istim naborom vprašanj in iskanj ter rezultate predstavi v mesečnem poročilu, ki ga naročnik prejme do 10. dne v naslednjem mesecu.

5.3 Obljuba 90 dni: če 90 dni po datumu začetka ocena vidnosti ni višja od izhodiščne in hkrati povprečna uvrstitev na Google Zemljevidih ni boljša od izhodiščne, naročnik za četrti mesec ne plača mesečnega nadomestila; izvajalec v tem mesecu storitve izvaja v polnem obsegu. Obljuba ne vključuje enkratne namestitve in dodatkov.

5.4 Obljuba iz 5.3. velja, če je naročnik pravočasno zagotovil dostope in podatke iz 4.3., redno plačuje in ni sam ali prek tretjih oseb ravnal v nasprotju z 4.7. Obljuba velja enkrat, za prvih 90 dni sodelovanja.

5.5 Prikaz in razvrščanje vsebin pri tretjih ponudnikih (npr. Google, OpenAI, Microsoft, Meta, Apple) samostojno določajo ti ponudniki in se lahko spreminjajo brez vpliva izvajalca. Izvajalec zato razen obljube iz 5.3. ne jamči za določeno uvrstitev, za omembo v vsakem odgovoru, za število novih strank ali za prihodke naročnika.

6. OBVEZNOSTI IZVAJALCA IN ODGOVORNOST

6.1 Izvajalec bo storitve opravljal skrbno, strokovno, v skladu s pravili posamezne platforme in v dogovorjenih rokih.

6.2 Izvajalec ne bo objavljal lažnih ocen, prikritega oglaševanja ali drugih vsebin, ki kršijo pravila platform ali predpise o varstvu potrošnikov.

6.3 Izvajalec ne odgovarja za omejitev, začasno ali trajno ukinitev profila pri tretjem ponudniku, razen če jo je povzročil s kršitvijo pravil platforme.

6.4 Odgovornost izvajalca za škodo je omejena na znesek mesečnih nadomestil, ki jih je naročnik plačal v zadnjih treh mesecih, razen pri naklepu ali hudi malomarnosti.

7. VSEBINE IN AVTORSKE PRAVICE

7.1 Vsebine, ki jih izvajalec pripravi posebej za naročnika (besedila, objave, videi, strukturirani podatki), lahko naročnik po plačilu neomejeno uporablja, tudi po prenehanju pogodbe.

7.2 Naročnik izvajalcu za čas trajanja pogodbe dovoli uporabo svojih fotografij, logotipa in drugih gradiv za izvajanje storitev, vključno z izdelavo videov in objav.

7.3 Programska oprema, orodja, predloge in metode izvajalca ostanejo last izvajalca.

8. ZAUPNOST IN VARSTVO OSEBNIH PODATKOV

8.1 Stranki kot poslovno skrivnost varujeta vse podatke, ki jih izvesta pri izvajanju pogodbe, tudi po njenem prenehanju.

8.2 Kadar izvajalec pri izvajanju storitev obdeluje osebne podatke, za katere je upravljavec naročnik (npr. imena in sporočila strank naročnika v ocenah, sporočilih ali rezervacijah), jih obdeluje kot obdelovalec po 28. členu Splošne uredbe o varstvu podatkov (GDPR) in ZVOP-2, in sicer:
– samo po dokumentiranih navodilih naročnika in za namen izvajanja te pogodbe;
– z ustreznimi tehničnimi in organizacijskimi ukrepi za varnost podatkov;
– tako, da so k zaupnosti zavezane vse osebe, ki imajo dostop do podatkov;
– s pomočjo podobdelovalcev (npr. ponudniki gostovanja, e-pošte in orodij umetne inteligence), ki jih izvajalec na zahtevo naročnika navede in s katerimi ima sklenjene ustrezne pogodbe; pri prenosu podatkov izven EU/EGP le na podlagi ustreznih zaščitnih ukrepov po GDPR;
– naročniku pomaga pri uresničevanju pravic posameznikov in ga brez nepotrebnega odlašanja obvesti o kršitvi varnosti osebnih podatkov;
– po prenehanju pogodbe podatke izbriše ali vrne, razen če zakon zahteva njihovo hrambo.

8.3 Izvajalec osebne podatke kontaktnih oseb naročnika obdeluje kot upravljavec za namen izvajanja pogodbe in obračuna.

9. REFERENCE

9.1 Izvajalec lahko naročnika (naziv in logotip) navede med referencami, razen če naročnik temu pisno nasprotuje.

10. KONČNE DOLOČBE

10.1 Za vprašanja, ki jih ta pogodba ne ureja, se uporablja Obligacijski zakonik.

10.2 Spremembe in dopolnitve pogodbe veljajo le v pisni obliki, ki vključuje tudi elektronsko obliko. Prehod na drug paket stranki dogovorita z novo ponudbo, ki postane sestavni del te pogodbe.

10.3 Morebitne spore stranki rešujeta sporazumno, sicer je pristojno stvarno pristojno sodišče v Ljubljani.

10.4 Pogodba je sklenjena v elektronski obliki. Naročnik jo podpiše elektronsko, s potrditvijo kode, poslane na njegov e-naslov. Stranki se strinjata, da je tak podpis zanju veljaven in zavezujoč. Vsaka stranka prejme izvod pogodbe v obliki PDF.
{{opombe}}
Ljubljana, {{datum}}

Za izvajalca: {{izvajalec_zastopnik}}
Za naročnika: {{narocnik_zastopnik}}`;
