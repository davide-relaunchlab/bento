# dowitme: inventario WebMCP e interfaccia

Verifica del codice: 8 settembre 2026. Applicazioni effettivamente montate
nella raccolta: type, slides, dash. spaces e i flussi esclusivamente standalone
(recovery locale, relay cifrato, aggiornamenti firmati) non fanno parte di dowitme hosted.

## Come si scoprono le capacità

`get_page_context` identifica il file e la revisione. `get_editing_schema`
restituisce gli schemi delle operazioni persistenti, `read_document` tutti i
campi e gli id. `get_editor_commands` restituisce i comandi nativi dell'app
aperta con schema individuale; `editor_command` li esegue. Le funzioni dei
menu e pannelli si scoprono con `list_interface_controls`: aprire il menu,
rileggere il catalogo e usare `use_interface_control` sull'id restituito.
Il registro attraversa anche gli iframe degli editor e richiama gli handler
originali. Gli id non sono selettori CSS e decadono con i nodi.

Le API persistenti usano gli stessi service, permessi, revisioni, conflitti,
storico e annullamento del lavoro manuale. I comandi locali usano gli store
hosted; non espongono store mutabili né esecuzione di JavaScript arbitrario.
Un accesso browser eredita il ruolo della persona; un token remoto conserva
il perimetro e i permessi della propria delega.

## Raccolta e collaborazione

Riferimenti: `office/client/dashboard.ts`, `office/client/main.ts`,
`office/server/worker.ts`, `service.ts`, `folders.ts`.

- Creazione type/dash/slides: `create_workbook`; apertura: `open_workbook`;
  ritorno alla raccolta: `open_workspace`; salvataggio: `save_document`.
- Elenco file, contenuto, formato, struttura: `list_workbooks`,
  `describe_workbook`, `read_document` e letture paginate specifiche.
- Cartelle: `list_folders`, `create_folder`, `rename_folder`, `move_workbook`.
- Accessi: `list_members`, `share_workbook`, `unshare_workbook`,
  `list_folder_members`, `share_folder`, `unshare_folder`.
- Deleghe: `list_agents`, `create_agent`, `revoke_agent`. Nessuna chiave
  viene aggiunta ai documenti. Le credenziali remote non possono creare deleghe.
- Cronologia e snapshot: `list_changes`, `get_change`, `read_revision`,
  `undo_change`. Proposte: `propose_change`, `list_proposals`, `get_proposal`,
  `accept_proposal`, `reject_proposal`; modifica diretta: `apply_change`.
- Ricerca, filtri tipo/accesso/cartella, ordinamento, lingua e pannelli:
  controlli reali del registro, con gli stessi valori e listener dell'interfaccia.
- Import CSV/TSV/XLSX/HTML: `import_file` con payload testuale o base64;
  export HTML completo: `export_document`, con contenuto restituito o download.

## slides

Riferimenti: `slides/src/editor/editor.ts`, `canvas.ts`, `properties.ts`,
`clipboard.ts`, `model.ts`, `present.ts`, `measure.ts`, `validate.ts`.

- Aggiunta/rimozione/riordino slide, elementi e proprietà: patch native
  `addSlide`, `setSlide`, `reorderSlides`, `addElement`, `updateElement`,
  `setElement`, `reorderElements`, `setSlideProps`, `setDocProps`.
- Testo, codice, forme, immagini, SVG, grafici, tabelle, video e audio:
  schema e template nativi; inserimento e picker dei pulsanti originali.
- Selezione: `select_slide`, `select_elements`, selezione DOM e doppio click
  per editing; geometria, trascinamento, disegno e ridimensionamento attraverso
  patch o eventi mouse sui controlli reali. Selezione testo per offset.
- Allineamento, distribuzione, dimensioni uguali, raggruppamento, livelli,
  duplicazione, copia/incolla: controlli contestuali e scorciatoie originali;
  non ricostruire le operazioni composite con cloni superficiali.
- Tipografia, colori, gradienti, ombre, bordi, opacità, rotazione, crop,
  tabella/celle, opzioni grafico, animazioni, link, note, commenti, tema,
  dimensioni pagina, transizioni, slide nascoste, layout e font: proprietà
  native e pannelli scoperti dinamicamente.
- Diagnostica render: `validate`, `measure_text`, `measure_element`.
- Vista, pannelli, zoom, presentazione, navigazione e speaker: controlli
  originali; avvio diretto `present`, `speaker_view`, stampa `print`.
- Testo in corso: commit esplicito prima di salvataggio/export/navigazione e
  operazioni server; non viene chiuso prima dei comandi di formattazione locali.

## type

Riferimenti: `type/src/main.ts`, `editor.ts`, `layout.ts`, `docstyles.ts`,
`move.ts`, `comments.ts`, `track.ts`, `redlineview.ts`, `canon.ts`, `cite.ts`,
`math.ts`, `xref.ts`, `toc.ts`, `find.ts`, `image.ts`, `embed.ts`, `print.ts`.

- Blocchi, ordine, titolo, pagina, stili, sezioni, note, asset, font,
  bibliografia, revisioni, tracking e firme: `setBlock`, `reorderBlocks`,
  `setTitle`, `setDocProps`, secondo schema e validatori nativi.
- Selezione testo `select_text`, inserimento via pipeline editor `insert_text`,
  formattazione `toggle_mark`; formati complessi e selezioni DOM attraverso
  i controlli. I nomi dei mark vengono tradotti nel formato nativo b/i/u/s.
- Paragrafi, titoli, elenchi, rientri, font, interlinea, spaziatura, margini,
  interruzioni, header/footer e numerazione: campi e handler dei pannelli.
- Tabelle, righe/celle, immagini, artifact embed, formule matematiche,
  didascalie/riferimenti incrociati, indice, citazioni/BibTeX: menu inserimento
  e pannelli originali, payload file e risposte ai prompt del singolo comando.
- Ricerca/sostituzione, commenti/risposte/risoluzione, tracked changes,
  accetta/rifiuta, snapshot e redline: pannelli originali e dati persistenti.
- Firma `sign` attende WebCrypto, usa la stessa chiave locale del pulsante e
  rifiuta modifiche concorrenti; `verify_signatures` verifica la catena.
  La chiave privata non è esposta.
- Paginazione reale `paginate`, HTML di stampa `print_html`, dialogo `print`.

## dash

Riferimenti: `dash/src/main.ts`, `grid.ts`, `gridmenu.ts`, `select.ts`,
`tabs.ts`, `cellfmt.ts`, `datavalid.ts`, `condfmt.ts`, `pastespecial.ts`,
`tocolumns.ts`, `promote.ts`, `steps.ts`, `pivot.ts`, `dashboard.ts`,
`story.ts`, `comments.ts`, `names.ts`, `xlsx.ts`, `print.ts`.

- Celle, formule, dataset, righe/colonne, proprietà e ordine fogli, viste,
  commenti, dimensioni, pipeline e binding: patch dash dello schema comune.
- Selezione reale `select_cell`, `select_range`, lettura `copy_tsv`,
  incolla `paste_tsv`, cancella `clear_selection`, riempimento `fill_down`.
- Inserimento/rimozione righe/colonne, duplicazione fogli, copia/incolla
  speciale: handler originali, inclusa traslazione delle formule.
- Ordinamento, filtri, formati numerici, stile celle, convalida, formattazione
  condizionale, nomi definiti: pannelli e menu originali o proprietà tipizzate.
- Pipeline filter/derive/sort/group/join/limit/union/patch/split, tipizzazione,
  testo in colonne, promozione dataset e appiattimento: pannelli originali;
  `sql` usa il compilatore query→pipeline e limita le righe restituite.
- Grafici, 3D, pivot/drill-down, dashboard e filtri incrociati, story/cattura/
  riordino/presentazione: UI nativa e proprietà persistenti dove previste.
- Diagnostica `validate`, commenti `comments`, import dataset `import_csv`;
  XLSX/CSV e stampa tramite esportatori originali; HTML via host.
- Ogni azione conserva i gate nativi sul tipo di foglio, senza aggirarli.

## Contratto di esecuzione e limiti osservabili

Il tool di interfaccia restituisce `dispatched`, non una falsa conferma di
completamento. Per handler asincroni (picker/import media, popup) rileggere
stato/documento: l'avvio dell'handler non significa che l'effetto sia concluso.
I comandi tipizzati attendono la propria promessa e il salvataggio; undo/redo
attendono anche la transazione di inversione. Le risposte a prompt e file
sono limitate al click richiesto e ripristinate subito dopo; i picker aperti
successivamente da un callback asincrono richiedono il successivo controllo.

La parità riguarda le funzioni dell'applicazione nella sessione browser.
Non annulla le restrizioni del browser su fullscreen, popup, clipboard di
sistema o stampa. `printDialogRequested` e `downloadStarted` descrivono un
avvio, non un file stampato/scaricato verificato. Le funzioni DOM/locali non
sono disponibili a un client MCP remoto senza pagina aperta.

## Eliminazione dei file

`delete_workbook({workbookId,baseRevision})` elimina definitivamente un file,
cronologia, proposte e credenziali delegate. Disponibile al proprietario dalla
raccolta e dalla sessione WebMCP; editor, viewer e token remoti non possono
eliminare file. La revisione e i permessi sono ricontrollati nella transazione.
Il pulsante della raccolta mostra il nome del file e la natura definitiva
dell'operazione. I contenuti senza più riferimenti vengono rimossi dallo storage;
nessun altro file viene modificato. Se il file eliminato è quello aperto,
WebMCP torna alla raccolta. Catalogo aggiornato: 45 strumenti complessivi.

Verifica: 85 test passati, typecheck e build riusciti; prova browser del pulsante
su mobile, annullamento che conserva il file, eliminazione e lettura successiva
404, nessun errore JavaScript. Sono stati eliminati soltanto file locali di test.
