# Helyi AMD videóplatform – ellenőrzött metaadatú jelölt

**Állapot: terv/jelölt, nem telepített, tesztelt vagy teljes függőségi hash-zárral lezárt rendszer.** Az aktuális munka és korlátai: `../../state/CURRENT.md`. A gépi leltár, mentési célok és nyers oldalak privát `.local/video-platform/` adatok; ne tedd őket a nyilvános repóba.

## Javasolt első Linux-jelölt

| Elem | Rögzített kiindulás | Bizonyíték és korlát |
|---|---|---|
| OS | Ubuntu Desktop 24.04.5.1 amd64 | Hivatalos kiadáslistában szerepel, kiadói SHA256 megvan; ISO nincs letöltve, GPG-aláírás és tényleges bájtok még nem ellenőrizve |
| Kernel | 7.0.0-31-generic HWE | Az ISO hivatalos manifestje és az AMD 10.1-es mátrix 7.0-s HWE családja illeszkedik; nincs ezen a gépen bootolva |
| Python | 3.12, külön venv | ISO-manifestben 3.12.3-1ubuntu0.17; cp312 Linux wheel-linkek ténylegesen elérhetők |
| Driver / runtime | amdgpu 31.60.0 jelölt, ROCm 10.1.0 család | AMD mátrix; pontos repo/build/aláírás, device-extra kernelcsomagok és Secure Boot út még ellenőrizendő |
| PyTorch / vision | 2.13.0+rocm10.1.0 / 0.28.0+rocm10.1.0, gfx1100 extra | AMD dokumentált páros; a konkrét Linux cp312 wheel-URL-ek HTTP HEAD 200-t adtak. Ez nem letöltési hash- vagy futási ellenőrzés |
| ComfyUI | 446ef4e005fc7134d53ce6869ebd77d2134cd39c | README/requirements erről a commitról lekérve; frontend 1.55.18, templates 0.11.89. Teljes tranzitív függőségi zár és GPU-próba még nincs |
| Modell | natív Wan2.2 TI2V 5B FP16 + UMT5 FP8 encoder + Wan2.2 VAE | Mindhárom fájlhoz konkrét HF-revízió, méret és kiadói LFS-SHA256 rögzítve; súlyok nincsenek letöltve |

Géppel olvasható részletek, URL-ek és elvárt hash-ek: **`candidate.json`**. A kiadói metadata és a ténylegesen letöltött/ellenőrzött fájl külön állapot. A három modellsúly összesen 18 144 966 705 bájt; ez nem az egész környezet helyigénye.

A 2.13-as jelölt oka: az AMD jelenlegi 10.1-es példája a 2.14-es torch mellé `torchvision 0.29.0a0`-t ad. A dokumentált 2.13/0.28 pár konzervatívabb induló hipotézis, **nem** kimért gyorsasági vagy stabilitási fölény. Nem keverjük automatikusan a ComfyUI README régebbi Linux rocm7.2 receptjét a 10.1-es úttal. Torchaudio nem kötelező a most kijelölt core videóworkflowhoz, ezért nem része automatikusan a csomaglistának.

A natív Windows AMD-út is létezik a friss hivatalos leírásokban; nem állítjuk, hogy Linux az egyetlen lehetőség. Az adott Windows/driver pontos megfelelőségét és a videókimenetet külön kellene ellenőrizni. Nincs kimért Ubuntu–Omarchy–Windows teljesítményrangsor, és most nem kezdünk harmadik platformtelepítést összehasonlítás nélkül.

## Kapuk – nem automatikus telepítő

1. Megfelelő mentési scope és valódi recovery-út; a részleges élő fájlmásolat nem rendszerkép. Nincs particionálás ellenőrzött fontosadat-mentés és külön lemezműveleti jóváhagyás nélkül.
2. Pontos driver-artifact/aláírás és venv-függőségi terv lezárása. A ComfyUI requirementsben a torch is rögzítetlen: vak `pip install -r requirements.txt` felülírhatja a kiválasztott ROCm párost. Előbb constraints, tervezett artifactok és függőségi hatások ellenőrzése, majd tényleges verzió/hash-zár.
3. Linux hardver/driver teszt, GPU-azonosítás gfx1100 alapján, matmul és Conv3D véges kimenet GPU-reset nélkül. Nincs alapértelmezett HSA_OVERRIDE_GFX_VERSION vagy sok egyszerre felrakott optimalizációs hack.
4. ComfyUI core, localhost; nincs automatikus Manager/custom-node stack, publikus bind/tunnel, fizetős partner-node vagy modell-API. Súlyok csak ellenőrzött forrásból, rögzített revízióval és hash-összevetéssel.
5. Kis, modellhez igazított workflow, majd lépcsőzetes frame/felbontás-emelés. Fájl/dekódolás, teljes klip vizuális ellenőrzése, majd ismételt stabilitási és idő/memóriateszt külön bizonyíték. A 24 GB VRAM nem sebesség- vagy márkahűségi garancia; FP8 súlytárolás nem natív FP8 számítási bizonyíték.

## Hivatalos források

- AMD kompatibilitás: https://rocm.docs.amd.com/en/latest/compatibility/compatibility-matrix.html
- AMD PyTorch telepítés: https://rocm.docs.amd.com/projects/ai-ecosystem/en/latest/frameworks/pytorch/install.html
- Ubuntu release/manifest/checksum: https://releases.ubuntu.com/24.04/
- ComfyUI a rögzített commiton: https://github.com/Comfy-Org/ComfyUI/tree/446ef4e005fc7134d53ce6869ebd77d2134cd39c
- ComfyUI Wan2.2 útmutató: https://docs.comfy.org/tutorials/video/wan/wan2_2
- Repackaged modellmetadata: https://huggingface.co/api/models/Comfy-Org/Wan_2.2_ComfyUI_Repackaged?blobs=true

A dokumentáció olvasása, artifact-elérhetőség, integritás, telepítés, GPU-helyesség, vizuális review és használható teljesítmény nem felcserélhető elfogadási állapotok.
