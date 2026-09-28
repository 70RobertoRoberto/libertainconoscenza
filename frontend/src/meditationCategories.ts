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
    name: "Autostima",
    slug: "autostima",
    image: abs("/api/files/meditation-covers/autostima-c9337e39.jpg"),
    description:
      "L'autostima non è pensare di essere perfetti. È sapere di valere, anche quando si sbaglia. È riconoscere il proprio posto nel mondo, la propria voce, il proprio corpo, la propria storia. Viviamo in un tempo che ci chiede continuamente di essere diversi da come siamo: più produttivi, più belli, più forti, più sorridenti.\n\nL'autostima è la pratica di tornare a sé stessi, di guardarsi con occhi buoni, di darsi il permesso di esistere così come si è. Non è arroganza, non è egoismo: è la base per stare con gli altri senza perdersi. Le meditazioni di questa categoria accompagnano in questo ritorno: alla casa dentro di te, alla voce gentile, al corpo amico, alla fiducia che cresce. Il valore non si conquista: si riconosce.",
    benefits: [
      "Riconoscere il proprio valore",
      "Sciogliere la voce critica interiore",
      "Riconciliarsi con il proprio corpo",
      "Darsi il permesso di essere sé stessi",
      "Ritrovare fiducia nelle proprie scelte",
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
    name: "Perdono",
    slug: "perdono",
    image: abs("/api/files/meditation-covers/perdono-01bff283.jpg"),
    description:
      "Il perdono è una delle pratiche più difficili e più liberatorie. Non è dimenticare, non è giustificare, non è fingere che non sia successo niente. È lasciare andare il peso che porti. È scegliere di non farti più male con qualcosa che è già accaduto. Il perdono non è sempre possibile, e non è sempre il momento. Ma la pace sì: la pace è sempre una scelta.\n\nLe meditazioni di questa categoria ti accompagnano con dolcezza, senza forzare niente. Aprono una porta. Non ti spingono dentro. Sei tu che decidi quando e come entrare. Il perdono non è un atto istantaneo: è una direzione. È un aprire la porta e lasciarla aperta. Anche quando non riesci a perdonare, puoi sempre scegliere di non portare più il peso.",
    benefits: [
      "Riconoscere e alleggerire il peso del rancore",
      "Guardare l'altro senza fuggire",
      "Perdonare sé stessi",
      "Scegliere la pace, anche quando il perdono non arriva",
      "Liberare il cuore da ciò che pesa",
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
    name: "Rilassamento",
    slug: "rilassamento",
    image: abs("/api/files/meditation-covers/rilassamento-420c3d89.jpg"),
    description:
      "Il rilassamento è la porta d'ingresso di ogni pratica. Quando il corpo si distende, anche la mente si quieta, anche il cuore si apre. Rilassarsi non è pigrizia, non è perdere tempo: è permettere al corpo di fare ciò che sa fare, cioè sciogliere la tensione che accumula ogni giorno.\n\nViviamo in uno stato di allerta continua, anche quando non ce n'è bisogno. Il rilassamento è la risposta a questo stato: è il ritorno a un ritmo naturale, più lento, più morbido, più umano. Le meditazioni di questa categoria ti accompagnano a sciogliere il corpo, a lasciar andare la tensione, a sentire il peso che si posa. Non serve fare niente: serve solo permettere. Permettere al corpo di rilassarsi. Permettere alla mente di quietarsi. Permettere a te stesso di stare.",
    benefits: [
      "Sciogliere la tensione fisica",
      "Rilassare il corpo dopo una giornata pesante",
      "Prepararsi al riposo",
      "Ritrovare un ritmo naturale",
      "Lasciar andare lo stato di allerta",
    ],
  },
  {
    name: "Sonno",
    slug: "sonno",
    image: abs("/api/files/meditation-covers/sonno-2dd3138d.jpg"),
    description:
      "Il sonno non è tempo perso. È il momento in cui il corpo si ripara, la mente si riordina, le emozioni si depositano. Eppure, per molte persone, dormire è diventato difficile. La mente non si spegne, il corpo resta teso, il riposo non arriva.\n\nLe meditazioni di questa categoria sono pensate per accompagnarti verso il sonno con dolcezza. Non ti chiedono di fare niente: ti invitano solo a lasciarti andare. Una voce lenta, immagini calme, un respiro che si allunga. Il sonno non va cercato: va accolto. E queste meditazioni preparano il terreno perché possa arrivare. Non serve sforzarsi di dormire. Serve solo smettere di trattenere. Il sonno arriva quando smetti di aspettarlo. E quando arriva, ti prende.",
    benefits: [
      "Rilassare il corpo prima di dormire",
      "Liberare la mente dai pensieri",
      "Entrare nel sonno con sicurezza",
      "Ritrovare un rapporto sereno con il riposo",
      "Lasciarsi andare senza forzare",
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
