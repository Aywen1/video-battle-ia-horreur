# SFX du jeu — feuille de route

Liste des 20 SFX a recolter et placer dans ce dossier. Tant qu'un fichier est
absent, le jeu continue d'utiliser le son procedural correspondant defini dans
`src/audio/proceduralSounds.ts` (fallback).

## Workflow rapide

1. Ouvre la recherche Google associee (colonne **Recherche**).
2. Ecoute 2-3 candidats sur freesound.org / pixabay / zapsplat.
3. Verifie la **licence** (CC0 ideal, CC-BY exige un credit a noter en bas).
4. Telecharge en `.mp3` (sinon `ffmpeg -i in.wav -b:a 192k out.mp3`).
5. Renomme **exactement** selon le tableau, place dans le bon sous-dossier.
6. Quand tu en as plusieurs, on plug le loader cote code.

## Conventions

- `snake_case`, pas d'accent, pas d'espace.
- Suffixe `_loop` pour les ambiances continues, sinon one-shot.
- Format `.mp3`, 192 kbps recommande (poids/qualite OK pour le web).
- Duree visee : voir colonne **Duree**.

## Les 20 SFX

### Ambient (loops continues)

| # | Fichier | Duree | Recherche Google |
|---|---------|-------|-------------------|
| 1 | `ambient/studio_drone_loop.mp3` | 30-60s | `horror ambient sub bass drone loop freesound` |
| 2 | `ambient/audience_murmur_loop.mp3` | 30-60s | `crowd murmur loop low whispering audience freesound` |
| 3 | `ambient/crt_buzz_loop.mp3` | 10-30s | `crt tv monitor hum buzz loop freesound` |
| 4 | `ambient/backstage_hum_loop.mp3` | 30-60s | `industrial fan compressor hum loop horror freesound` |

### Voice (voix)

| # | Fichier | Duree | Recherche Google |
|---|---------|-------|-------------------|
| 5 | `voice/host_evil_laugh.mp3` | 2-3s | `creepy game show host evil laugh freesound` |
| 6 | `voice/host_breath_distorted.mp3` | 1-2s | `distorted breathing breath horror male freesound` |
| 7 | `voice/child_giggle.mp3` | 1-2s | `creepy child giggle laugh horror freesound` |
| 8 | `voice/child_whisper_hello.mp3` | 1-3s | `creepy child whisper hello voice freesound` |
| 9 | `voice/child_scream.mp3` | 1-2s | `little girl scream high pitched horror freesound` |

### Show (plateau TV)

| # | Fichier | Duree | Recherche Google |
|---|---------|-------|-------------------|
| 10 | `show/tv_show_intro_jingle.mp3` | 3-5s | `vintage tv game show intro jingle bumper royalty free` |
| 11 | `show/studio_countdown_beep.mp3` | 0.1-0.2s | `tv studio countdown beep tally tone freesound` |
| 12 | `show/applause_burst.mp3` | 3-5s | `studio audience applause burst short freesound` |
| 13 | `show/audience_canned_laugh.mp3` | 2-4s | `sitcom canned laugh track vintage freesound` |
| 14 | `show/audience_gasp.mp3` | ~1s | `crowd gasp shock surprise audience freesound` |

### Scare (horreur)

| # | Fichier | Duree | Recherche Google |
|---|---------|-------|-------------------|
| 15 | `scare/screamer_impact_loud.mp3` | 1-1.5s | `horror jumpscare scream impact sound effect freesound` |
| 16 | `scare/glitch_sting.mp3` | 0.3-1s | `horror glitch sting digital distortion sfx freesound` |
| 17 | `scare/metallic_screech.mp3` | 2-3s | `psycho violin screech horror sting freesound` |
| 18 | `scare/heartbeat_slow.mp3` | 1-2s | `slow dramatic heartbeat single thump freesound` |

### Mech (mecaniques)

| # | Fichier | Duree | Recherche Google |
|---|---------|-------|-------------------|
| 19 | `mech/power_cut_thump.mp3` | 0.5-1s | `electric power cut off thump silence sfx freesound` |
| 20 | `mech/vhs_cassette_insert.mp3` | 1-2s | `vhs vcr cassette insert mechanism freesound` |

## Sons "bonus" si tu as de la place plus tard

- `ambient/cuckoo_clock_glitched_loop.mp3` — coucou detraque qui sonne hors temps.
- `scare/whisper_behind_you.mp3` — voix "regarde derriere toi" pour les easter eggs.
- `mech/footsteps_wood_creak.mp3` — pas dans couloir de planches qui craquent.

## Credits

Si certains sons sont en licence CC-BY, note ici le credit (auteur + URL) :

```
- studio_drone_loop.mp3 : <nom>, <url freesound>
- ...
```
