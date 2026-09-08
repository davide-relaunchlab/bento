# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
Persone e agenti AI esterni che lavorano sugli stessi fogli di calcolo. Più persone collaborano con ruoli e permessi fin dalla prima versione.

## Product Purpose
Una suite web generale, basata sul fork reale di nyblnet/bento. La prima versione riguarda i fogli; i documenti costituiscono l'estensione successiva, non un secondo editor da costruire in questa fase.

## Operating Context
Uso remoto tramite Sites con ingresso pubblico autorizzato, contenuti protetti da permessi, salvataggio persistente e condivisione controllata. Agenti esterni con MCP e supporto aggiuntivo WebMCP nei browser che lo espongono. Nessuna dipendenza da una chat integrata.

## Capabilities and Constraints
- Riutilizzare dash, modelli, formule, grafici e import/export esistenti; non riscrivere l'editor.
- Suggerimenti delle funzioni digitando =, completamento da tastiera e sintassi contestuale coerente con il motore.
- Modifiche puntuali, verificabili, attribuite, rifiutabili e reversibili. Persona e agente passano per gli stessi controlli.
- Ruoli proprietario, editor e lettore; agenti distinti con accesso limitabile e revocabile. Le proposte possono essere sottoposte a un editor prima dell'applicazione.
- Gestire modifiche concorrenti senza sovrascrittura silenziosa; errore e recupero espliciti quando cambia la stessa porzione di contenuto.
- Import/export XLSX limitati a ciò che Bento supporta, con segnalazione delle perdite; CSV e HTML autonomo restano percorsi reali.
- L'archivio condiviso aggiunge un servizio remoto alla suite; gli HTML esportati conservano il comportamento autonomo di Bento, i suoi identificatori e il blocco #bento-doc.
- Nessuna parità completa con Microsoft Office, nessuna specializzazione settoriale.

## Brand Commitments
Il marchio della suite è dowitme, in minuscolo, con monogramma dw fluido (direzione D) e palette 02: viola #503178 e albicocca #FFB278. Preservare semplicità e cura di bento: contenuto centrale, comandi compatti e proprietà contestuali; mantenere crediti, identificatori e formati bento.

## Product Principles
- Il contenuto strutturato è la fonte di verità.
- Le azioni degli agenti si vedono nel lavoro e nella cronologia.
- Un risultato plausibile non sostituisce un calcolo corretto.
- Condivisione e revoca sono controlli effettivi, non etichette dell'interfaccia.

## Evidence on Hand
Base upstream 01000838496ec863ba1035eae12a8a4943020cdc. La suite riusa dash e kernel. Test office, regressioni Bento, browser desktop/mobile e WebMCP sono documentati in docs/office/IMPLEMENTATION.md. Sites configurato in .openai/hosting.json.
