"""Seed 30 additional articles + fix the broken morphogenetic-field image.

Idempotent: skips articles whose exact title already exists in Mongo.

Run manually:
    cd /app/backend && python3 seed_more_articles.py
"""

import asyncio
import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


BROKEN_IMAGE = "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800"
REPLACEMENT_IMAGE = "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800"


# 30 additional articles across the app's canonical categories.
# Every image URL below has been verified live (HTTP 200) on Unsplash CDN.
NEW_ARTICLES = [
    # --- Crescita personale ---
    {
        "title": "L'arte di dire no: confini sani per una vita piena",
        "summary": "Imparare a dire no è uno degli atti più grandi di rispetto verso se stessi. Non è egoismo: è chiarezza. Ogni sì detto per paura è un no silenzioso verso i nostri bisogni, sogni ed energie. Stabilire confini sani protegge la nostra vitalità e ci permette di essere autenticamente presenti per gli altri. Il no maturo nasce da un sì più grande alla propria vita.",
        "category": "Crescita personale",
        "image_url": "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=800",
    },
    {
        "title": "Le abitudini invisibili che plasmano il nostro destino",
        "summary": "Il novanta percento delle nostre azioni giornaliere è automatico. Le abitudini invisibili — come iniziamo la giornata, cosa pensiamo appena svegli, come reagiamo allo stress — costruiscono giorno per giorno la persona che diventiamo. Cambiare una piccola abitudine, ripetuta con costanza, produce trasformazioni molto più profonde di grandi propositi presi a Capodanno. La rivoluzione parte da un solo gesto consapevole.",
        "category": "Crescita personale",
        "image_url": "https://images.unsplash.com/photo-1470004914212-05527e49370b?w=800",
    },
    {
        "title": "Vulnerabilità: la porta segreta della forza autentica",
        "summary": "Brené Brown ha dimostrato con anni di ricerca che la vulnerabilità non è debolezza ma il luogo dove nascono coraggio, connessione e creatività. Mostrarsi imperfetti, chiedere aiuto, ammettere paure ci rende umani e ricongiunge agli altri. La corazza che indossiamo per proteggerci è la stessa che ci separa dalla vita. Aprirsi è rischioso, ma è l'unico modo per vivere pienamente.",
        "category": "Crescita personale",
        "image_url": "https://images.unsplash.com/photo-1483736762161-1d107f3c78e1?w=800",
    },

    # --- Spirituale ---
    {
        "title": "Il silenzio interiore come porta del sacro",
        "summary": "Nel rumore incessante della vita moderna, il silenzio è diventato un lusso raro. Eppure è nel silenzio che si manifesta ciò che di più profondo abita in noi. Le tradizioni contemplative — cristiane, buddiste, sufi — concordano: il divino non parla nel frastuono ma nella quiete della coscienza. Coltivare piccole isole di silenzio quotidiano è il primo passo verso una vita davvero interiore.",
        "category": "Spirituale",
        "image_url": "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=800",
    },
    {
        "title": "I sette chakra e i centri energetici del corpo",
        "summary": "La tradizione tantrica descrive sette centri energetici principali lungo la colonna vertebrale, dai chakra della radice al chakra della corona. Ogni centro è collegato a funzioni fisiche, emozionali e spirituali specifiche. L'equilibrio dei chakra si riflette in salute e benessere; il loro blocco genera sintomi. La meditazione, la respirazione consapevole e alcune posture yogiche riattivano il flusso sottile dell'energia vitale.",
        "category": "Spirituale",
        "image_url": "https://images.unsplash.com/photo-1494548162494-384bba4ab999?w=800",
    },
    {
        "title": "Sincronicità: quando l'universo parla il linguaggio dei simboli",
        "summary": "Carl Gustav Jung coniò il termine sincronicità per indicare quelle coincidenze significative che sembrano superare la casualità. Un pensiero e un evento esterno che si specchiano, incontri improbabili al momento giusto, sogni che anticipano fatti reali. La sincronicità è il modo in cui la realtà interiore e quella esteriore comunicano attraverso i simboli. Osservarla con attenzione apre alla dimensione poetica dell'esistenza.",
        "category": "Spirituale",
        "image_url": "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800",
    },

    # --- Fisica quantistica ---
    {
        "title": "Entanglement quantistico: il mistero delle particelle che comunicano a distanza",
        "summary": "Due particelle entangled restano collegate anche a distanze enormi: modificando una, l'altra risponde istantaneamente. Einstein lo definì spooky action at a distance e non lo accettò mai. Oggi l'entanglement è verificato sperimentalmente e alla base delle tecnologie quantistiche emergenti. Filosoficamente, suggerisce che a un livello profondo la separazione tra oggetti sia illusoria: il tessuto della realtà è unificato.",
        "category": "Fisica quantistica",
        "image_url": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800",
    },
    {
        "title": "L'osservatore quantistico: la coscienza modifica la realtà?",
        "summary": "Nell'esperimento della doppia fenditura, il semplice atto di osservare fa collassare la funzione d'onda: la particella si comporta diversamente se guardata o meno. Questo fenomeno ha aperto un dibattito che dura da un secolo sul ruolo della coscienza nella fisica. Non significa che pensiamo la realtà, ma che osservatore e osservato non sono così separabili come credeva la fisica classica. La materia contiene una dimensione di informazione inscindibile dall'atto di conoscerla.",
        "category": "Fisica quantistica",
        "image_url": "https://images.unsplash.com/photo-1470813740244-df37b8c1edcb?w=800",
    },
    {
        "title": "Acqua e memoria: la ricerca di Emoto e i cristalli",
        "summary": "Masaru Emoto ha fotografato per anni cristalli di acqua congelati dopo esposizione a parole, musiche o intenzioni. Le forme cambiavano in modo sorprendente. Al di là del dibattito scientifico sui suoi metodi, la ricerca sulla memoria dell'acqua prosegue in laboratori di tutto il mondo, con studi su clusters molecolari e coerenza. L'acqua, che costituisce il settanta per cento del nostro corpo, potrebbe essere un supporto di informazione molto più raffinato di quanto immaginiamo.",
        "category": "Fisica quantistica",
        "image_url": "https://images.unsplash.com/photo-1441260038675-7329ab4cc264?w=800",
    },

    # --- Meditazione ---
    {
        "title": "La meditazione tonglen: trasformare il dolore in compassione",
        "summary": "Tonglen è una pratica tibetana antica quanto potente: si inspira il dolore proprio o altrui, e si espira benessere e compassione. Al contrario di ciò che l'ego chiederebbe, si accoglie ciò che è difficile invece di respingerlo. Praticata regolarmente, tonglen scioglie la corazza dell'io e apre il cuore. Non è solo una tecnica meditativa: è una rivoluzione del rapporto con la sofferenza, propria e del mondo.",
        "category": "Meditazione",
        "image_url": "https://images.unsplash.com/photo-1477346611705-65d1883cee1e?w=800",
    },
    {
        "title": "Meditazione camminata: presenza in movimento",
        "summary": "Thich Nhat Hanh insegnava che ogni passo può essere una preghiera. La meditazione camminata unisce la pratica alla vita: si cammina lentamente, sentendo il piede che tocca la terra, il respiro che accompagna il passo, lo sguardo morbido sull'orizzonte. Bastano dieci minuti al giorno in natura per riportare tutto il corpo-mente nel presente. Chi non riesce a stare seduto a lungo trova qui una porta di ingresso alla meditazione più accessibile.",
        "category": "Meditazione",
        "image_url": "https://images.unsplash.com/photo-1435527173128-983b87201f4d?w=800",
    },
    {
        "title": "Metta bhavana: la meditazione dell'amore gentile",
        "summary": "La pratica della metta buddista consiste nel coltivare deliberatamente il sentimento di amore incondizionato: prima verso se stessi, poi verso una persona cara, un neutrale, un difficile, e infine verso tutti gli esseri. Studi recenti mostrano che pochi mesi di pratica aumentano l'attività prefrontale legata all'empatia e riducono i biomarcatori dello stress. L'amore gentile non è un sentimento aleatorio: è una capacità che si può allenare.",
        "category": "Meditazione",
        "image_url": "https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?w=800",
    },

    # --- Discipline orientali ---
    {
        "title": "Qi Gong: la ginnastica energetica della tradizione cinese",
        "summary": "Il Qi Gong unisce respiro, movimento lento e intenzione per coltivare il qi, l'energia vitale che secondo la medicina tradizionale cinese scorre nei meridiani. Praticato al mattino, riequilibra il sistema nervoso, migliora la circolazione e prepara la mente. Non richiede forza né flessibilità particolari: chiunque, a qualsiasi età, può iniziare. In Cina è pratica quotidiana di milioni di persone e sta guadagnando riconoscimento clinico in Occidente.",
        "category": "Discipline orientali",
        "image_url": "https://images.unsplash.com/photo-1445264718234-a623be589d37?w=800",
    },
    {
        "title": "Tai Chi: meditazione in movimento per corpo e mente",
        "summary": "Il Tai Chi Chuan è un'arte marziale interna nata come sistema di autodifesa e diventata nei secoli una via di salute e realizzazione interiore. I suoi movimenti fluidi, praticati lentamente, allenano equilibrio, propriocezione, respiro e concentrazione. Studi mostrano benefici nella prevenzione delle cadute negli anziani, nella riduzione della pressione arteriosa e nel miglioramento del sonno. È meditazione in movimento nel senso più letterale.",
        "category": "Discipline orientali",
        "image_url": "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800",
    },
    {
        "title": "Ayurveda: i tre dosha e la medicina della natura",
        "summary": "L'Ayurveda, scienza indiana della vita, descrive tre energie fondamentali — vata, pitta, kapha — che compongono ogni essere umano in proporzioni uniche. Conoscere il proprio dosha aiuta a scegliere alimentazione, ritmi, movimenti e pratiche che ci mantengono in equilibrio. Non è medicina alternativa: è un sistema completo che riconosce la relazione tra costituzione individuale e salute. Curare il singolo, non la malattia, è il suo principio.",
        "category": "Discipline orientali",
        "image_url": "https://images.unsplash.com/photo-1499744937866-d7e566a20a61?w=800",
    },

    # --- Naturopatia ---
    {
        "title": "Fitoterapia: le piante che curano oggi come ieri",
        "summary": "Le piante medicinali sono la farmacia originaria dell'umanità: iperico per la depressione lieve, valeriana per il sonno, echinacea per l'immunità, curcuma per l'infiammazione. La fitoterapia moderna studia i principi attivi con rigore scientifico, riconoscendo sinergie tra molecole che il farmaco isolato non riproduce. Usate correttamente, in dosaggi appropriati e con conoscenza delle interazioni, le piante restano alleate preziose per la salute quotidiana.",
        "category": "Naturopatia",
        "image_url": "https://images.unsplash.com/photo-1500534623283-312aade485b7?w=800",
    },
    {
        "title": "Idroterapia: l'acqua come strumento di guarigione",
        "summary": "Sebastian Kneipp, il curato bavarese del XIX secolo, sistematizzò l'uso terapeutico dell'acqua fredda e calda. Docce alternate, spugnature, camminate in acqua stimolano la circolazione, tonificano il sistema immunitario e riequilibrano il sistema nervoso. Praticata con semplicità a casa, l'idroterapia è uno dei rimedi naturali più efficaci e a costo zero. L'acqua, elemento primordiale, guarisce quando torniamo a rispettarla.",
        "category": "Naturopatia",
        "image_url": "https://images.unsplash.com/photo-1521133573892-e44906baee46?w=800",
    },
    {
        "title": "Digiuno intermittente: pausa metabolica per la longevità",
        "summary": "Le ricerche di Valter Longo, Yoshinori Ohsumi e altri hanno dimostrato che periodi di digiuno controllato attivano l'autofagia, il meccanismo di pulizia cellulare, e la rigenerazione delle staminali. Digiunare sedici ore al giorno o uno-due giorni alla settimana, se ben condotto, migliora insulinoresistenza, marker infiammatori e chiarezza mentale. Non è una moda: è un ritorno a un ritmo biologico che l'umanità ha praticato per millenni.",
        "category": "Naturopatia",
        "image_url": "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=800",
    },

    # --- Psicologia ---
    {
        "title": "Il bambino interiore: guarire le ferite dell'infanzia",
        "summary": "Ognuno di noi porta dentro un bambino interiore, la parte emotiva formata nei primi anni di vita. Le sue ferite — abbandono, svalutazione, ingiustizia — riemergono nelle relazioni adulte come reazioni sproporzionate. Il lavoro terapeutico consiste nel riconoscere quel bambino, dargli ascolto, offrirgli oggi ciò che allora è mancato. Guarire il bambino interiore libera energia enorme e trasforma il modo in cui amiamo e viviamo.",
        "category": "Psicologia",
        "image_url": "https://images.unsplash.com/photo-1489367874814-f5d040621dd8?w=800",
    },
    {
        "title": "Attaccamento sicuro: le radici invisibili delle relazioni adulte",
        "summary": "John Bowlby e Mary Ainsworth hanno mostrato come le prime relazioni infantili modellino stili di attaccamento — sicuro, ansioso, evitante, disorganizzato — che influenzeranno tutta la vita affettiva successiva. Riconoscere il proprio stile è il primo passo per non ripetere copioni invisibili. La buona notizia: gli stili si possono modificare, soprattutto attraverso relazioni riparative e lavoro psicologico consapevole.",
        "category": "Psicologia",
        "image_url": "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=800",
    },
    {
        "title": "Trauma e corpo: come le esperienze rimangono impresse nella carne",
        "summary": "Bessel van der Kolk, nel suo lavoro pluridecennale, ha mostrato che il trauma non è solo un ricordo mentale: è impresso nel corpo. Il sistema nervoso autonomo resta in allerta anche quando il pericolo è passato. Approcci come EMDR, Somatic Experiencing, mindfulness e yoga terapeutico si sono dimostrati efficaci perché lavorano contemporaneamente su corpo, mente e memoria implicita. Guarire richiede tempo, ma è possibile.",
        "category": "Psicologia",
        "image_url": "https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=800",
    },

    # --- Medicina Integrata ---
    {
        "title": "Psiconeuroendocrinoimmunologia: mente, ormoni, difese in un unico sistema",
        "summary": "La PNEI, disciplina nata a fine Novecento, ha smontato la vecchia separazione tra sistema nervoso, ormoni e immunità: sono un unico network che comunica in ogni direzione. Un pensiero produce ormoni, un ormone modifica l'immunità, l'immunità agisce sul cervello. Comprendere questa rete significa riscrivere la medicina: sintomi lontani hanno spesso origini comuni. La cura integrata parte da qui.",
        "category": "Medicina Integrata",
        "image_url": "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=800",
    },
    {
        "title": "Agopuntura: la scienza incontra la tradizione millenaria",
        "summary": "L'agopuntura, inserita dall'OMS tra i trattamenti raccomandati per numerose condizioni, agisce modulando neurotrasmettitori, ormoni e attività cerebrale. Studi con risonanza magnetica funzionale mostrano cambiamenti oggettivi nell'attività cerebrale durante il trattamento. Nella medicina integrata è spesso utilizzata per dolore cronico, emicrania, nausea da chemio, disturbi funzionali. La tradizione millenaria trova conferme nella scienza contemporanea.",
        "category": "Medicina Integrata",
        "image_url": "https://images.unsplash.com/photo-1516571748831-5d81767b788d?w=800",
    },
    {
        "title": "Il microbiota intestinale: il secondo cervello che ci abita",
        "summary": "Nel nostro intestino vivono cento trilioni di microrganismi che comunicano continuamente con cervello, sistema immunitario e ormoni. Un microbiota sano è associato a buon umore, difese efficienti, metabolismo equilibrato. Alimentazione ricca di fibre, fermentati, varietà vegetale nutre questo ecosistema; zuccheri raffinati, antibiotici e stress cronico lo impoveriscono. Prendersi cura dell'intestino è prendersi cura di sé nella sua interezza.",
        "category": "Medicina Integrata",
        "image_url": "https://images.unsplash.com/photo-1470137237906-d8a4f71e1966?w=800",
    },

    # --- Filosofia ---
    {
        "title": "Stoicismo: la filosofia pratica per tempi turbolenti",
        "summary": "Epitteto, Seneca, Marco Aurelio: gli stoici antichi ci hanno lasciato una filosofia pragmatica che oggi rifiorisce. Distinguere ciò che dipende da noi da ciò che non dipende, accettare l'impermanenza, coltivare la virtù come unica ricchezza inattaccabile. Non è rassegnazione: è saggezza operativa. In un mondo dominato dall'ansia e dalla reazione, lo stoicismo offre un ancoraggio interiore che ha superato duemila anni di prova.",
        "category": "Filosofia",
        "image_url": "https://images.unsplash.com/photo-1523712999610-f77fbcfc3843?w=800",
    },
    {
        "title": "Il pensiero taoista: fluire con il Tao",
        "summary": "Lao Tzu e il Tao Te Ching offrono una saggezza che sembra scritta oggi. Non forzare, non contrastare, seguire la corrente della realtà come l'acqua che trova sempre la sua via. Il wu wei — agire senza agire — non è passività ma azione in accordo con la natura delle cose. Chi si allinea al Tao vive con meno sforzo e più efficacia. Antica saggezza cinese e neuroscienza moderna del flow si specchiano sorprendentemente.",
        "category": "Filosofia",
        "image_url": "https://images.unsplash.com/photo-1476611317561-60117649dd94?w=800",
    },
    {
        "title": "Fenomenologia della vita quotidiana: vedere ciò che è",
        "summary": "Husserl e Merleau-Ponty hanno insegnato a sospendere i giudizi per tornare alle cose stesse: come appare l'esperienza prima delle interpretazioni? La fenomenologia è pratica filosofica di attenzione radicale al presente. Non è astratta: incontra la meditazione buddista sulla via dell'osservazione pura. Coltivare questo sguardo trasforma la vita quotidiana in un laboratorio di conoscenza continua.",
        "category": "Filosofia",
        "image_url": "https://images.unsplash.com/photo-1465188162913-8fb5709d6d57?w=800",
    },

    # --- Nutrizione ---
    {
        "title": "Dieta mediterranea: patrimonio dell'umanità per la longevità",
        "summary": "Riconosciuta dall'UNESCO come patrimonio culturale immateriale, la dieta mediterranea è associata dagli studi scientifici a riduzione di malattie cardiovascolari, diabete, alcuni tumori e declino cognitivo. Olio extravergine, verdure, legumi, cereali integrali, pesce, frutta secca, poco vino. Ma è anche stile di vita: convivialità, stagionalità, lentezza a tavola. Mangiare bene è un atto culturale e affettivo insieme.",
        "category": "Nutrizione",
        "image_url": "https://images.unsplash.com/photo-1495837174058-628aafc7d610?w=800",
    },
    {
        "title": "Zuccheri raffinati: il killer silenzioso che infiamma il corpo",
        "summary": "Gli zuccheri raffinati e i carboidrati ad alto indice glicemico producono picchi di insulina che, ripetuti, generano infiammazione cronica silente — la radice di molte malattie moderne. Ridurre drasticamente zucchero bianco, dolci industriali, bevande zuccherate e farine raffinate è forse il singolo cambiamento con maggior impatto sulla salute a lungo termine. Frutta, miele, dolcificanti naturali usati con moderazione sono ben tollerati.",
        "category": "Nutrizione",
        "image_url": "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800",
    },
    {
        "title": "Cibo vivo: enzimi, germogli e fermenti per rigenerarsi",
        "summary": "Il cibo vivo — germogli, verdure lattofermentate, kefir, miso, kombucha — è ricco di enzimi ed è preziosa fonte di probiotici naturali. Ogni cultura ha sviluppato tradizioni di fermentazione che oggi la scienza riscopre come alleati fondamentali del microbiota. Iniziare con una piccola porzione al giorno di alimenti fermentati apporta benefici a immunità, digestione e umore. La cucina è farmacia quando torniamo a rispettare la natura.",
        "category": "Nutrizione",
        "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800",
    },

    # --- Somatognostica ---
    {
        "title": "Ascolto corporeo: quando il corpo diventa maestro",
        "summary": "La somatognostica invita a un ascolto radicale: il corpo sa cose che la mente non sa. Tensioni, sintomi, fatiche non sono nemici da eliminare ma messaggi da decifrare. Ogni parte del corpo custodisce una memoria, un'emozione, una possibilità. Imparare ad abitarlo con presenza e curiosità apre a una conoscenza di sé che nessun libro può dare. Il corpo è la porta della coscienza incarnata.",
        "category": "Somatognostica",
        "image_url": "https://images.unsplash.com/photo-1531379410502-63bfe8cdaf6f?w=800",
    },
    {
        "title": "Le fasce e il tessuto connettivo: la rete che ci tiene insieme",
        "summary": "Le ricerche degli ultimi vent'anni hanno rivoluzionato la comprensione delle fasce, quella rete continua di tessuto connettivo che avvolge muscoli, organi e ossa. Non è un semplice imballaggio: è un organo sensoriale con sette volte più recettori dei muscoli, trasmette informazione, contiene memoria emotiva. Manipolarla con tecniche appropriate — dallo stretching profondo ai trattamenti fasciali — libera schemi cronici e restituisce libertà di movimento.",
        "category": "Somatognostica",
        "image_url": "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800",
    },
]


async def main():
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # 1. Fix broken morphogenetic-field image (and any other doc using the same URL).
    fixed = await db.articles.update_many(
        {"image_url": BROKEN_IMAGE},
        {"$set": {"image_url": REPLACEMENT_IMAGE}},
    )
    fixed_media = await db.media.update_many(
        {"thumbnail_url": BROKEN_IMAGE},
        {"$set": {"thumbnail_url": REPLACEMENT_IMAGE}},
    )
    print(f"Fixed broken image in {fixed.modified_count} articles and {fixed_media.modified_count} media docs.")

    # 2. Insert new articles idempotently.
    inserted = 0
    skipped = 0
    for a in NEW_ARTICLES:
        existing = await db.articles.find_one({"title": a["title"]})
        if existing:
            skipped += 1
            continue
        await db.articles.insert_one({
            "id": str(uuid.uuid4()),
            "title": a["title"],
            "summary": a["summary"],
            "category": a["category"],
            "source_url": "https://www.summaaurea.org/category/summa-aurea-generale/",
            "image_url": a["image_url"],
            "is_premium": False,
            "views": 0,
            "created_at": now_iso(),
        })
        inserted += 1

    print(f"Inserted {inserted} new articles, skipped {skipped} (already present).")
    total = await db.articles.count_documents({})
    print(f"Total articles now: {total}")


if __name__ == "__main__":
    asyncio.run(main())
