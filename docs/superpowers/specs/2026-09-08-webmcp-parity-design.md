# dowitme: parità operativa umano/WebMCP

## Requisito e perimetro

Esporre ogni funzione disponibile manualmente nelle tre applicazioni hosted
(type, slides, dash) e nella raccolta, usando gli stessi handler, permessi,
store, parser e strumenti di esportazione. spaces, il relay standalone, recovery
locale e release firmate non appartengono all'interfaccia hosted.

## Architettura

Tre superfici complementari: tool server per dati e gestione workspace; comandi
browser tipizzati per capacità native e stato della vista; registro dinamico
 dei controlli reali della pagina e degli iframe same-origin per tutti i pannelli,
menu, campi e azioni contestuali. Il registro esegue i gestori reali, non codice
fornito dall'agente. Gli id dei controlli sono effimeri: quelli obsoleti vengono
rifiutati. Il catalogo distingue azioni già completate da dialoghi aperti.

Gli adapter degli editor espongono stato, catalogo dei comandi e dispatch
validato. Le modifiche continuano a passare dai delegate hosted, con salvataggio,
conflitti e annullamento esistenti. I tool persistenti mantengono revisioni e
idempotenza. Il browser agent usa il ruolo della sessione autenticata anche per
le funzioni della raccolta; le credenziali remote restano limitate al documento
e alla delega. Nessun tool esegue JavaScript arbitrario o accetta credenziali
come parte del documento.

## Verifica

Inventario per app con riferimento sorgente, test HTTP reali per permessi e
workspace, test DOM per discovery/esecuzione/staleness, prove WebMCP native nei
tre editor. Typecheck, suite e build prima della pubblicazione sul Site esistente.
Stampa, fullscreen e picker comunicano i limiti del browser: aprire un dialogo
non equivale a completare il relativo effetto esterno.
