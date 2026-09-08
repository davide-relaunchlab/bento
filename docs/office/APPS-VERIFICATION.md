# Tre editor nello stesso ambiente

Implementazione sul fork davide-relaunchlab/bento, ramo codex/office-suite.

## Comportamento
La raccolta crea, apre e distingue fogli bento/dash, documenti bento/type e presentazioni bento/slides. Gli ultimi due usano gli editor originali in iframe della stessa origine, con bridge tipizzato verso le transazioni office. Permessi, proposte, cronologia e annullamento passano dallo stesso servizio. Gli editor hosted non avviano il relay o il recupero locale standalone.

MCP e WebMCP leggono i blocchi (`read_blocks`) e le slide con elementi (`read_slides`). Le patch native operano su blocchi, slide, elementi e proprietà consentite; le guardie proteggono il contenuto letto e gli annullamenti preservano modifiche indipendenti. La digitazione viene raggruppata prima del salvataggio; un risultato remoto non sostituisce gli oggetti ancora in modifica. Gli errori conservano la bozza e impediscono di dichiararla salvata.

La migrazione SQL aggiunge il formato con default bento/dash e conserva i record esistenti. Import HTML legge soltanto il blocco JSON; export usa la shell autonoma dell'app corretta. La validazione controlla i campi consumati dai renderer. Corrette due uscite HTML upstream in type: escape degli ID delle note e preview SVG degli embed come immagine statica.

## Verifica locale
- Suite office: 58 test verdi, inclusi API HTTP e MCP reali, ACL, migrazione, concorrenza, proposte, annullamento, coalescing, errori e validazione.
- Typecheck office e delle app durante build; build dei tre HTML autonomi e shell-gate su ciascuno.
- Rig slides store/hosted; type store/hosted, modello, autosave, print, inline ed embed verdi.
- Browser: creazione di entrambi i tipi, testo effettivo, rilettura strutturata via WebMCP, proposta di paragrafo ispezionata/accettata/annullata, presentazione, comandi export senza errori, raccolta e pannelli su mobile.

## Limiti espliciti
bento/type è il word processor del pacchetto: questa integrazione non aggiunge import/export DOCX. Su telefono il documento conserva la dimensione della pagina e si scorre anche orizzontalmente; i pannelli sono sovrapposti e inizialmente chiusi. I conflitti sullo stesso blocco o elemento richiedono rilettura: non viene simulata una fusione arbitraria del testo. Il limite office rimane 8 MB per il contenuto del documento.
