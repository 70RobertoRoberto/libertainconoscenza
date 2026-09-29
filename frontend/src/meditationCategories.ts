/**
 * Categories for the "Meditazioni" section, in alphabetical order.
 * Content sourced from the "materiale meditazioni" document provided by the client.
 */

export type MeditationCategory = {
  name: string;
  slug: string;
  image: string;         // path relative to backend (e.g. /api/files/...)
  description: string;   // long descriptive paragraph
  benefits: string[];    // "A cosa serve" bullet list
};

// Backend host (Expo Router runs client-side, so build absolute urls here).
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const abs = (p: string) => (p.startsWith("http") ? p : `${BACKEND}${p}`);

export const MEDITATION_CATEGORIES: MeditationCategory[] = [
  {
    name: "Amore e Gioia",
    slug: "amore-e-gioia",
    image: abs("/api/files/meditation-covers/amore-e-gioia-20c47484.jpg"),
    description:
      "L'amore non è un sentimento che si conquista, la gioia non è una ricompensa che si merita. Sono la sostanza stessa di ciò che sei quando smetti di difenderti, quando lasci cadere le maschere, quando torni al respiro. Viviamo cercando amore fuori, e nel farlo dimentichiamo la sorgente che pulsa dentro il petto — quella luce calda che chiede solo di essere riconosciuta.\n\nLa gioia non nasce dagli eventi: nasce dall'apertura del cuore che sa dire sì alla vita così com'è. Le meditazioni di questa categoria ti riportano al centro cardiaco, a quel luogo dove l'amore per sé, per gli altri e per il mondo sono un solo movimento. Non c'è nulla da aggiungere, nulla da diventare. Basta ricordare. E quando ricordi, la gioia fiorisce da sola, come un petalo che si apre al sole.",
    benefits: [
      "Riaprire il cuore dopo ferite e chiusure",
      "Coltivare gratitudine e leggerezza interiore",
      "Riconnettersi alla gioia semplice del presente",
      "Amare sé stessi senza condizioni",
      "Irradiare calore e benevolenza agli altri",
    ],
  },
  {
    name: "Armonizzazione e Radicamento",
    slug: "armonizzazione-e-radicamento",
    image: abs("/api/files/meditation-covers/armonizzazione-e-radicamento-9a6d8b94.jpg"),
    description:
      "Armonizzarsi significa ritrovare un equilibrio tra dentro e fuori, tra sé e gli altri, tra ciò che si sente e ciò che si vive. Il radicamento è la base di questo equilibrio: senza una terra sotto i piedi, l'armonia non regge. Radicarsi non è chiudersi, non è irrigidirsi: è sentire una stabilità che permette di stare aperti senza perdersi.\n\nLe meditazioni di questa categoria lavorano su due movimenti insieme: scendere nelle proprie radici e aprirsi all'incontro con l'altro. Non si tratta di scegliere tra sé e gli altri, ma di stare saldi mentre si è in relazione. L'armonia non è assenza di tensione: è la capacità di attraversarla senza spezzarsi. Il radicamento non è fuga dal mondo: è la condizione per starci davvero.",
    benefits: [
      "Sentire stabilità e sostegno dentro di sé",
      "Non farsi spostare dalle situazioni",
      "Creare risonanza con l'altro",
      "Sciogliere tensione e distanza",
      "Stare saldi senza chiudersi",
    ],
  },
  {
    name: "Calma e Serenità",
    slug: "calma-e-serenita",
    image: abs("/api/files/meditation-covers/calma-e-serenita-fc57933a.jpg"),
    description:
      "La calma e la serenità sono il punto di partenza di ogni altra cosa. Senza calma, la mente corre, il corpo si tende, le emozioni prendono il sopravvento. La calma non è assenza di pensieri o di emozioni: è la capacità di stare in mezzo a loro senza esserne travolti. È uno spazio dentro di te che resta fermo mentre tutto il resto si muove.\n\nLa serenità non è indifferenza: è la pace che resta anche quando le cose non vanno come vorresti. Le meditazioni di questa categoria ti aiutano a ritrovare quello spazio, respiro dopo respiro. Non serve fuggire dal mondo: serve tornare a te stesso, anche solo per pochi minuti. La calma non si compra, non si trova fuori, non dipende dagli altri. È già dentro di te, aspetta solo di essere ascoltata.",
    benefits: [
      "Quietare mente, corpo ed emozioni",
      "Ridurre agitazione e tensione",
      "Ritrovare il centro quando tutto si muove",
      "Preparare il terreno per ogni altra pratica",
      "Coltivare una pace che resta",
    ],
  },
  {
    name: "Concentrazione e Attenzione",
    slug: "concentrazione-e-attenzione",
    image: abs("/api/files/meditation-covers/concentrazione-e-attenzione-e829b1a2.jpg"),
    description:
      "La concentrazione è la capacità di stare su una cosa sola senza farsi portare via. Non è forza di volontà, non è sforzo, non è tensione. È un allenamento gentile dell'attenzione, come si allena un muscolo: un po' alla volta, con costanza, senza giudizio. Viviamo in un tempo che ci abitua a saltare da una cosa all'altra. Il telefono chiama, i pensieri corrono, il corpo si agita.\n\nLa concentrazione è la risposta a questa dispersione. Non serve a fare di più, ma a stare meglio in quello che si fa. Le meditazioni di questa categoria lavorano su tre cose: restare su un oggetto, scegliere cosa guardare e cosa lasciar fuori, tornare con gentilezza ogni volta che ci si distrae. La distrazione non è un fallimento: è parte dell'allenamento. Ogni volta che ti accorgi di esserti distratto e torni, stai già allenando la concentrazione.",
    benefits: [
      "Migliorare la concentrazione nello studio e nel lavoro",
      "Ridurre le distrazioni e la dispersione",
      "Aumentare memoria, lucidità e chiarezza",
      "Stare su un compito senza perdersi",
      "Prepararsi a un esame, a una riunione, a una decisione",
    ],
  },
  {
    name: "Natura e Armonia",
    slug: "natura-e-armonia",
    image: abs("/api/files/meditation-covers/natura-8e171b59.jpg"),
    description:
      "La natura non è un luogo dove andare, ma un luogo da ricordare. È la matrice da cui veniamo, il ritmo che ci ha generato, il respiro che ci precede. E dove c'è natura, c'è armonia: quella intelligenza silenziosa che tiene insieme le cose senza forzarle, che fa fiorire l'albero al tempo giusto, che accorda il canto degli uccelli col sorgere del sole. L'armonia non è perfezione — è relazione: tra dentro e fuori, tra sé e il vivente, tra il proprio respiro e quello del mondo.\n\nQuando ci fermiamo sotto un albero, quando ascoltiamo l'acqua di un fiume, quando sentiamo il vento fra le foglie, qualcosa dentro di noi si riallinea. Non è nostalgia: è casa che ci chiama. Le meditazioni di questa categoria ti riportano a quel legame primordiale — con la terra sotto i piedi, con il cielo sopra il capo, con il verde che respira insieme a te — e ti ricordano che l'armonia che cerchi fuori è la stessa che vive dentro. Sei natura tu stesso, non ospite di essa. E quando lo ricordi, la pace non è più qualcosa da cercare: è qualcosa che ti attraversa.",
    benefits: [
      "Ristabilire il legame con gli elementi (terra, acqua, aria, fuoco)",
      "Sentire il proprio ritmo naturale, oltre la fretta della città",
      "Ricaricarsi con la vitalità degli spazi verdi",
      "Sintonizzarsi con l'armonia del vivente",
      "Ricordare di appartenere alla natura, non di dominarla",
    ],
  },
  {
    name: "Perdono e Valore di Sè",
    slug: "perdono-e-valore-di-se",
    image: abs("/api/files/meditation-covers/perdono-01bff283.jpg"),
    description:
      "Il perdono e il valore di sé sono due volti dello stesso movimento: l'atto di smettere di farsi male con ciò che è stato, per riconoscersi come si è. Il perdono non è dimenticare, non è giustificare, non è fingere che non sia successo niente — è lasciare andare il peso che porti, è scegliere di non farti più male con qualcosa che è già accaduto. Ma non si può perdonare davvero se non si torna prima a casa, dentro di sé, in quel luogo dove il proprio valore non si conquista: si riconosce.\n\nL'autostima non è pensare di essere perfetti: è sapere di valere anche quando si sbaglia, riconoscere la propria voce, il proprio corpo, la propria storia. Viviamo in un tempo che ci chiede continuamente di essere diversi da come siamo, e la voce critica interiore si nutre proprio del rancore verso sé stessi. Le meditazioni di questa categoria ti accompagnano con dolcezza in entrambi i movimenti — aprire una porta al perdono degli altri e di te stesso, e nello stesso tempo ricordare che meriti di esistere così come sei. Non c'è pace vera senza valore riconosciuto. E non c'è valore vero senza il coraggio di perdonarsi.",
    benefits: [
      "Riconoscere e alleggerire il peso del rancore",
      "Perdonare sé stessi e gli altri senza forzare",
      "Sciogliere la voce critica interiore",
      "Riconoscere il proprio valore, anche quando si sbaglia",
      "Scegliere la pace e ritrovare fiducia in sé",
    ],
  },
  {
    name: "Presenza e Ascolto Interiore",
    slug: "presenza-e-ascolto-interiore",
    image: abs("/api/files/meditation-covers/presenza-e-ascolto-interiore-4259aed1.jpg"),
    description:
      "Il passato non c'è più. Il futuro non c'è ancora. C'è solo questo momento. Eppure, quasi sempre, la mente è altrove: nei ricordi, nelle preoccupazioni, nei piani. La presenza è la pratica di tornare qui, ora, in questo respiro, in questo corpo, in questo istante.\n\nL'ascolto interiore è la sua naturale conseguenza: quando sei presente, puoi ascoltare ciò che senti, ciò che vuoi, ciò che la tua voce profonda ti dice. Non è un esercizio intellettuale: è un ritorno a casa. Le meditazioni di questa categoria ti aiutano a entrare nel momento presente attraverso il respiro, il corpo, i suoni, l'ascolto. Non serve fare niente di speciale: serve solo esserci. E da lì, ascoltare.",
    benefits: [
      "Tornare al momento presente",
      "Uscire dal rimuginio e dall'ansia anticipatoria",
      "Sentire il corpo e l'ambiente",
      "Ascoltare la propria voce interiore",
      "Ritrovare pienezza in ciò che c'è",
    ],
  },
  {
    name: "Ricarica energetica",
    slug: "ricarica-energetica",
    image: abs("/api/files/meditation-covers/ricarica-energetica-750ef0a2.jpg"),
    description:
      "Ci sono momenti in cui ti senti svuotato. Non è stanchezza fisica soltanto: è una stanchezza più profonda, che tocca la voglia di fare, di stare, di essere. La ricarica energetica non è un trucco per resistere di più: è un modo per tornare alla sorgente che è dentro di te.\n\nL'energia non arriva solo dal riposo o dal cibo: arriva anche dalla presenza, dal respiro, dal contatto con ciò che ti fa bene. Le meditazioni di questa categoria ti aiutano a ritrovare calore, forza e vitalità. Non si tratta di fare di più, ma di essere più vivi in quello che fai. L'energia non si forza: si accoglie. Si risveglia. Si lascia scorrere. E quando torna, non è mai la stessa di prima: è più consapevole, più calma, più tua.",
    benefits: [
      "Ritrovare forza e vitalità",
      "Uscire dalla stanchezza profonda",
      "Riaccendere il calore interiore",
      "Sentire di nuovo la voglia di esserci",
      "Ritrovare energia da dentro, non da fuori",
    ],
  },
  {
    name: "Rilassamento e Sonno",
    slug: "rilassamento-e-sonno",
    image: abs("/api/files/meditation-covers/rilassamento-420c3d89.jpg"),
    description:
      "Il rilassamento è la porta d'ingresso di ogni pratica, e il sonno il suo compimento più naturale. Quando il corpo si distende, anche la mente si quieta, anche il cuore si apre; e quando il rilassamento è profondo, il riposo arriva da sé, senza che tu debba cercarlo. Rilassarsi non è pigrizia, non è perdere tempo: è permettere al corpo di fare ciò che sa fare, cioè sciogliere la tensione che accumula ogni giorno e prepararsi al ristoro notturno.\n\nViviamo in uno stato di allerta continua, anche quando non ce n'è bisogno, e per molte persone dormire è diventato difficile: la mente non si spegne, il corpo resta teso, il riposo non arriva. Le meditazioni di questa categoria ti accompagnano con dolcezza in un doppio movimento — sciogliere le tensioni della giornata e scivolare verso il sonno senza sforzo. Una voce lenta, immagini calme, un respiro che si allunga. Non serve fare niente: serve solo permettere. Il sonno non va cercato: va accolto. E queste pratiche preparano il terreno perché possa arrivare, semplicemente, quando smetti di trattenere.",
    benefits: [
      "Sciogliere la tensione fisica accumulata",
      "Rilassare corpo e mente dopo una giornata pesante",
      "Prepararsi al riposo e scivolare nel sonno con dolcezza",
      "Liberare la mente dai pensieri prima di dormire",
      "Ritrovare un rapporto sereno con il riposo notturno",
    ],
  },
  {
    name: "Risveglio Dell'Anima",
    slug: "risveglio-dell-anima",
    image: abs("/api/files/meditation-covers/risveglio-dell-anima-cae2da57.jpg"),
    description:
      "Il risveglio dell'anima non è un evento straordinario riservato a pochi: è un ritorno silenzioso a ciò che si è sempre stati. C'è un momento, nella vita di ogni essere, in cui le vecchie certezze non bastano più, in cui una voce sottile inizia a chiamare da dentro. Non è un pensiero: è un sentire. Un ricordo che affiora, come se qualcosa di antichissimo si stesse ridestando.\n\nLe meditazioni di questa categoria accompagnano questo passaggio con rispetto e sacralità. Non offrono risposte pronte, ma aprono spazi: spazi in cui ascoltare la propria luce, riconoscere la propria missione, sentire di essere più della propria storia. L'anima non chiede di essere costruita: chiede solo di essere riconosciuta. E quando la incontri, tutto il resto — corpo, mente, relazioni, scelte — si riordina attorno a lei. Il risveglio non è la fine del cammino: è l'inizio del vero cammino.",
    benefits: [
      "Riconnettersi con la propria essenza spirituale",
      "Sentire un senso di direzione e di missione",
      "Aprirsi a dimensioni più ampie della coscienza",
      "Distinguere l'ego dalla voce dell'anima",
      "Vivere con maggiore sacralità la quotidianità",
    ],
  },
];

export const MEDITATION_HERO_IMAGE = abs(
  "/api/files/meditation-covers/hero-c4cc4b71.webp"
);

export const MEDITATION_HERO_TITLE = "Il valore e l'importanza della meditazione";

export const MEDITATION_ABOUT_TEXT = `La meditazione non è una moda, non è una fuga e non è un lusso per pochi. È una pratica antica, semplice e profonda, che attraversa culture, epoche e tradizioni diverse. È un modo per stare con sé stessi, per conoscersi, per ritrovare un equilibrio che spesso perdiamo nella frenesia della vita quotidiana. Meditare significa fermarsi, respirare, ascoltare. Significa tornare a casa.

La meditazione non serve a diventare qualcun altro. Serve a tornare a sé stessi. Serve a calmare la mente quando è agitata, a rilassare il corpo quando è teso, a ricaricare l'energia quando è finita, a ritrovare la presenza quando si è dispersi, a radicarsi quando ci si sente instabili, a perdonare quando si porta un peso, ad armonizzarsi con gli altri quando c'è distanza, a riconoscere il proprio valore quando ci si sente piccoli, ad accompagnarsi al sonno quando il riposo non arriva. Non è una bacchetta magica. È una pratica. E come ogni pratica, dà frutti con il tempo.

I benefici della meditazione si sentono su più livelli.

Sul corpo: rallenta il respiro, distende la tensione, favorisce il riposo, aiuta a sentire il corpo, migliora il rapporto con sé stessi.

Sulla mente: riduce il rumore dei pensieri, aumenta la chiarezza, aiuta a stare nel presente, riduce il rimuginio, sviluppa l'attenzione.

Sulle emozioni: aiuta a riconoscere ciò che si sente, riduce la reattività, aumenta la calma, sviluppa la compassione, apre il cuore.

Sulle relazioni: migliora l'ascolto, riduce i giudizi, aumenta la pazienza, crea vicinanza, favorisce l'armonia.

Sullo spirito: dà senso, dà direzione, dà pace, dà presenza, dà casa.

La meditazione non richiede molto. Richiede costanza, non perfezione. Anche cinque minuti al giorno fanno la differenza. Anche un respiro consapevole apre una porta. Anche una pausa cambia una giornata. Non serve un luogo speciale, non serve un momento perfetto, non serve essere bravi. Serve solo esserci.

La meditazione guidata è un ponte. È utile per chi non sa da dove cominciare, per chi si perde nei pensieri, per chi ha bisogno di una voce che accompagna, per chi vuole un ritmo lento e sicuro, per chi desidera un momento di calma senza sforzo. Il conduttore non fa il lavoro al posto tuo: ti tiene la mano mentre lo fai, ti accompagna, ti dà tempo, ti dà spazio. E tu, ascoltando, ti prendi cura di te.

Viviamo in un mondo pieno di rumore. Rumore fuori, rumore dentro. La meditazione ci riporta al silenzio. Non un silenzio vuoto, ma un silenzio pieno: pieno di presenza, pieno di ascolto, pieno di pace. Nel silenzio ci ritroviamo, nel silenzio ci ascoltiamo, nel silenzio ci ricomponiamo.

A volte si pensa che prendersi tempo per sé sia egoismo. Non è così. Prendersi cura di sé è la base per prendersi cura degli altri. Calmare sé stessi è la base per calmare le relazioni. Armonizzarsi dentro è la base per armonizzarsi fuori. Chi medita non si isola dal mondo: si prepara a stare nel mondo con più presenza, più calma, più amore.

Questa sezione raccoglie una serie di meditazioni guidate. Ognuna ha uno scopo, ognuna ha una funzione, ognuna è pensata per accompagnarti in un momento preciso della tua vita. Non devi farle tutte, non devi farle perfettamente, non devi farle subito. Scegli quella che ti chiama, scegli il momento giusto, scegli di prenderti cura di te. E quando sarai pronto, comincia. Un respiro alla volta, un momento alla volta, una meditazione alla volta.

La meditazione è un ritorno. Un ritorno a te, alla calma, alla presenza, alla pace. Non serve andare lontano, non serve cercare fuori. È già qui, è già ora, è già tua.

Buona pratica.

NOTA: Le Meditazioni sono pratiche per il Ben-Essere e non sono sostitutive delle terapie professionali. Chi ha un disagio è sempre opportuno che sia seguito da un professionista di settore e utilizzi la Meditazione come integrazione al lavoro su di sé in quanto non possono essere risolutive di una problematica.`;

export function findCategoryBySlug(slug: string): MeditationCategory | undefined {
  return MEDITATION_CATEGORIES.find((c) => c.slug === slug);
}
