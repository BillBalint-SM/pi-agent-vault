# Pi Agent Vault – hordozható munkakörnyezet és élő állapotlenyomat

Ennek a repónak a fő célja a személyes Pi-asszisztens munkamódjának, engedélyezett eszközeinek és **mindenkori érdemi állapotának** visszaállíthatósága másik PC-n. Nem modellsúly-mentés, nem teljes beszélgetésarchívum, és nem háttérben önmagát frissítő memóriaszolgáltatás.

A repó **nyilvános**. Hitelesítés, cookie, session, személyes napló, privát brief, márkaanyag és gépi mentési részlet nem kerülhet bele. A helyi `.local/` teljes egészében gitből kizárt. A projekt saját `DESIGN.md`-je a projektben marad.

## Mi a központi forrás?

| Hely | Tartalom |
|---|---|
| `AGENTS.md`, `working-policy.md` | Kötelező munkamód, L0–L3, önállóság/engedélyezés, ellenőrzés és állapotkarbantartás |
| `state/CURRENT.md` | Aktuális, megtisztított állapot: döntések, igazolt képességek, korlátok, nyitott munkák és folytatási pont |
| `skills/` | Pontosan két engedélyezett skill: browser-control, evidence-led-design |
| `extensions/`, `agents/`, `config/` | Korlátozó wrapperök, read-only reviewer, hordozható konfigurációforrások |
| `knowledge/ui-ux/`, `tools/check-design-review*` | Evidenciakeret, forrásregiszter, struktúraellenőrző és tesztjei – nem minőségi tanúsítás |
| `tools/content-generator/` | Opcionális, alapból offline API-adapter; nincs privát brief vagy élő generálás |
| `package.json`, `package-lock.json` | Pontos csomagverziók és integritásadatok; nincs automatikus frissítés |
| `scripts/`, `lib/`, `tests/` | Profilgenerálás, visszaállítás, szűk ellenőrzések és Git-állapot |

Öt aktív extension, két skill; Lens telepítve, de **globálisan kikapcsolva**. Background csak process; subagent csak `pi-reviewer`, read/grep/find/ls, örökölt modell, extra extension nélkül. Web: Exa → DuckDuckGo, közvetlen HTTP, nincs cookie vagy rejtett összegző modell. Ezek nem OS-sandboxok. Részletek: `working-policy.md`.

## Új PC – telepítés

Referenciaverzió: **Node 26.x és Pi 1.3.0**. Git és npm kell. A profilt Windows alatt ellenőrizzük; a path-kezelés gépfüggetlen, de Linux/macOS teljes körű futási próba nem történt. A shellválasztás Windows: cmd, más rendszeren: bash.

1. Telepítsd külön a Node-ot, Git-et és a Pi megfelelő verzióját. Ha még nincs Pi: `npm install -g @earendil-works/pi-coding-agent@1.3.0`. Ez tudatos globális hosttelepítés, a vault setup nem végzi el helyetted.
2. Klónozd a repót a saját **Pi-only** munkakönyvtárad alá, például `~/pi/pi-agent-vault` (Windows: `%USERPROFILE%\pi\pi-agent-vault`). Ne más ügynök shared skillkönyvtárába.
3. A repó gyökerében:

```sh
npm ci --ignore-scripts --legacy-peer-deps --no-audit --no-fund
npm run check
npm run setup
```

Az utolsó parancs csak **előnézet**, nem ír konfigurációt. A telepítés hálózatot használ az npm-hez; a setup csak helyi adatokat olvas, nem tölt le hostot vagy böngészőt. A `--legacy-peer-deps` szándékos: nem telepítünk második Pi-hostot elavult peer-deklarációk miatt. Ez nem bizonyít kompatibilitást, ezért kell a pilot. Lifecycle scriptek tiltva maradnak; ezt a repó `.npmrc` fájlja alapértelmezésként is rögzíti. Lens nincs aktiválva.

4. Elkülönített próba, éles konfiguráció módosítása nélkül:

```sh
npm run setup -- --agent-dir .local/pilot-agent --apply
npm run verify -- --agent-dir .local/pilot-agent --exercise
```

A verify offline SDK-sessionben ellenőrzi a pontos erőforráslistát, toolokat/commandokat, subagent ceilinget, todo-t, tiltott agentet és providert, valamint egy valódi echo háttérfolyamatot. Nem hív modellt. Az opcionális `--web` az IANA nyilvános oldalának közvetlen HTTP-letöltését is teszteli.

5. Sikeres próba és a konfiguráció áttekintése után:

```sh
npm run setup -- --apply
```

Alapcél: `~/.pi/agent`, illetve ha be van állítva, `PI_CODING_AGENT_DIR`. A `--agent-dir` felülírja. A hostot a globális npm-gyökérből keresi; egyedi telepítéshez `--host-root <Pi-package-root>` adható meg. Más hostverziót új kompatibilitási pilot nélkül nem fogad el.

Meglévő, nem e vault által kezelt `AGENTS.md` esetén a telepítő megáll: előbb olvasd át, és csak szándékos kiváltáshoz add hozzá a `--replace-instructions` kapcsolót. A korábbi tartalom privát backupba kerül. Másik felhasználó utasításait ne cseréld le hallgatólagosan.

A setup a saját resource/policy kulcsait cseréli (`packages`, `extensions`, `skills`, `prompts`, `themes`, `subagents`, skill commandok és projekttrust); az egyéb modell/provider/UI-preferenciákat megtartja. Pontosan öt profilfájlt kezel: settings, AGENTS, web-search, subagent config, vault pointer; emellett a repó privát hostpointerét. **Nem olvas/másol auth- vagy sessionfájlokat.** A saját korábbi erőforráslistád felülíródik, visszaállítható privát mentéssel.

6. A saját szolgáltatói belépést külön végezd el helyben. A tokenek nem kerülnek a repóba. Indítsd újra a Pi-t vagy használd a `/reload` parancsot; a már futó beszélgetés nem feltétlenül az új profilból működik. Új sessionben a generált globális AGENTS a vault szabályaihoz és aktuális állapotához irányít.

A repó költöztetése után futtasd újra a setupot: a helyi abszolút útvonalakat az aktuális gyökérből állítja elő. Régi abszolút pathokat ne commitolj forrásként.

## Állapotkarbantartás és checkpoint

Érdemi változás és átadás előtt a Pi frissíti a közös forrásokat és a `state/CURRENT.md`-t: mi működik, mi van ténylegesen ellenőrizve, mi maradt nyitva, mi legyen a következő lépés. Nem kell minden parancsot vagy L0-választ naplózni. A forrásutasítás ezt előírja, de nem jelent garantált autonóm működést leállított Pi mellett.

```sh
npm run check
npm run status
git diff --stat
git diff -- <érintett-fájlok>
# Csak az átnézett, engedélyezett fájlok kerüljenek stage-be és commitba.
```

A `status` nem végez hálózatot vagy feltöltést: külön mutatja a working tree-t, helyi commitot és az utoljára lekért távoli refhez képesti eltérést. Élő távoli ellenőrzéshez külön `git fetch origin`, majd új status szükséges. A helyi checkpoint nem GitHub-szinkron. Feltöltés előtt célrepó/láthatóság, teljes kimenő diff és privacy-ellenőrzés kell. Nincs automatikus push-hook, telemetriás memória, force-push vagy teljes beszélgetésfeltöltés.

## Visszaállítás

Minden tényleges setup-változás előtt a módosítandó fájlokról byte-pontos privát snapshot készül `.local/backups/<azonosító>/manifest.json` alatt. A setup kiírja ennek útvonalát. Az ismételt, azonos setup nem készít új mentést. Futó saját háttérmunkát/gyermeket előbb biztonságosan zárj le; ne állíts le idegen folyamatot.

```sh
node scripts/setup.mjs --rollback <a-setup-által-kiírt-manifest-útvonala>
```

A rollback az előző tartalmat visszaírja, a setup által újonnan létrehozott fájlokat eltávolítja, más fájlhoz nem nyúl. **Megáll**, ha a telepítés óta valamelyik kezelt fájl változott; nem írja felül az újabb kézi munkát. Ezután újraindítás/reload kell. Áramkimaradás vagy félbeszakadt setup esetén a `prepared` snapshotot előbb kézzel vizsgáld meg; ez nem teljes fájlrendszer-tranzakció vagy rendszermentés.

A migráció előtti dokumentációs tár az eredeti Git-commiton visszakereshető: `de64d2a5a5a204bcfe374dc140a1dadcd25efaaf`. Visszanézéshez külön worktree/klón ajánlott; nem kell a mostani munkát resetelni. A régi docs-vault szolgáltatás nem települ ezzel a profillal.

## Opcionális Windows-mentési és videóplatform-segédek

Ezek nem részei a Pi profiltelepítésének, és nem indítanak automatikus rendszermentést vagy Linux-telepítést. A Python-segédekhez Python 3.10+ kell, kizárólag standard libraryt használnak; a Pi alapprofil továbbra is Node/Git/npm alapú.

- `scripts/storage-inventory.ps1`: csak olvasó, sekély disk/partíció/drive-mapping és felső szintű mappametadata; nincs teljes profilbejárás vagy cloud-hidratálás. A kimeneti könyvtárat a gitből kizárt `.local/` alatt add meg.
- `scripts/windows-storage-preflight.ps1`: natív GPT, boot és WinRE-lekérdezés. A `shrink querymax` csak külön `-QueryShrink` kapcsolóval indulhat, felügyelt időkorláttal; a korábbi időtúllépést nem szabad vakon újrapróbálni. Soha nem futtat tényleges shrink/resize/formázást.
- `scripts/backup-io-pilot.py`: legfeljebb 32 MiB / 100 fájl nem érzékeny tesztminta, új célmappa, másolat és ZIP hash-visszaolvasás. Elutasítja a reparse/offline/recall útvonalakat. Ez nem rendszerkép, hideg lemezbenchmark, ACL/ADS-ellenőrzés vagy Windows restore-teszt; nem indokol teljes backupra extrapolált időígéretet. Csak a ténylegesen átnézett publikus forrásokkal használd.
- `scripts/video-stack-sources.py`: kis, rögzített körű hivatalos dokumentum- és indexlekérés; `--details` a mentett ComfyUI-refhez rögzített forrást és wheelindexeket kér le. Nem tölt le modelleket, wheelcsomagokat vagy ISO-t, és nem telepít.

A mentési pilot célzott tesztjei külön futnak, hálózat és valódi backup nélkül:

```sh
python -B -m unittest discover -s tests -p "*_test.py" -v
```

A gépi kimenet, tényleges mentési útvonalak és restore-tervek privát `.local/video-platform/` adatok. A közös, megtisztított folytatási állapot a `state/CURRENT.md`-ben marad. Nagy backup, partíciómódosítás vagy USB-írás e segédek meglétéből nem kap automatikus felhatalmazást.

## Határok

- A secret/path scanner célzott, nem teljes titokdetektor vagy biztonsági audit. A diff emberi/ügynöki áttekintését nem helyettesíti.
- Az npm-integritás és dependency audit nem teljes forrásaudit vagy kompatibilitási garancia.
- Nincs más ügynökök könyvtárának, személyes profiloknak vagy project-sessionöknek automatikus importja.
- A privát géptérkép, régi mentési állapot és helyi rollback csak azon a PC-n marad meg; új gépen a project checkoutokat és authot külön kell megadni. A rendszerindító/lemezműveletekre ez a helyreállítás nem ad engedélyt.
- A jelenlegi ellenőrzött állapot és nyitott tesztek: **`state/CURRENT.md`**.
