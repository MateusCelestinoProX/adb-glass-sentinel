# Graph Report - adb-glass-sentinel  (2026-10-31)

## Corpus Check
- 19 files · ~450,256 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 852 nodes · 1661 edges · 45 communities (31 shown, 11 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `13c026cc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- _
- ks
- AndroidBridge
- ar
- U
- AdbLogStreamer
- tn
- q
- V
- W
- K
- .z
- pt
- .constructor
- .x
- sr
- ke
- le
- .addAttribute
- .sub
- gr
- app.js
- AdbSystemController
- As
- zs
- vt
- build_and_install.sh
- .multiply
- gradlew
- oe
- ue
- .copy
- shaders.js
- 🛡️ ADB Glass Sentinel
- BootReceiver.kt
- AdbSentinelService
- AdbSocketTracker
- adb_sentinel_daemon.sh
- AudioStreamManager
- zt
- ji
- .intersectMeshes

## God Nodes (most connected - your core abstractions)
1. `_` - 208 edges
2. `requestAnimationFrame()` - 39 edges
3. `U` - 35 edges
4. `V` - 33 edges
5. `getOptimizedDPR()` - 31 edges
6. `resize()` - 29 edges
7. `AudioStreamManager` - 27 edges
8. `AndroidBridge` - 26 edges
9. `ks` - 25 edges
10. `AdbSentinelService` - 24 edges

## Surprising Connections (you probably didn't know these)
- `MainActivity` --references--> `AdbSentinelService`  [EXTRACTED]
  app/src/main/java/com/mateuscelestino/adbsentinel/MainActivity.kt → app/src/main/java/com/mateuscelestino/adbsentinel/AdbSentinelService.kt

## Import Cycles
- None detected.

## Communities (45 total, 11 thin omitted)

### Community 0 - "_"
Cohesion: 0.04
Nodes (41): _, ae(), at, bs(), ce(), dt, Ei, Et (+33 more)

### Community 2 - "AndroidBridge"
Cohesion: 0.06
Nodes (17): AndroidBridge, MainActivity, WebChromeClient, WebViewClient, OnBackPressedCallback, Context, ServerSocket, Socket (+9 more)

### Community 3 - "ar"
Cohesion: 0.09
Nodes (7): ar, dr(), kt(), mr, pr(), Ut(), yr

### Community 4 - "U"
Cohesion: 0.05
Nodes (17): ai(), ci(), di(), gi(), hi(), ii(), li(), mi() (+9 more)

### Community 5 - "AdbLogStreamer"
Cohesion: 0.23
Nodes (4): AdbLogStreamer, AdbShellCommandEvent, Context, ParsedTimestampInfo

### Community 6 - "tn"
Cohesion: 0.15
Nodes (6): fr(), A(), E(), m(), ns(), tn

### Community 7 - "q"
Cohesion: 0.21
Nodes (4): p(), q, ze, zi()

### Community 8 - "V"
Cohesion: 0.09
Nodes (3): De(), qi(), V

### Community 9 - "W"
Cohesion: 0.06
Nodes (12): cs, Ds(), Fs(), is, it, on, pn, rr (+4 more)

### Community 10 - "K"
Cohesion: 0.13
Nodes (4): br, K, kr, nr

### Community 11 - ".z"
Cohesion: 0.08
Nodes (4): Gs(), Hs(), qs(), Xs()

### Community 12 - "pt"
Cohesion: 0.07
Nodes (9): bi(), en, _i(), pt, Se(), Si(), sn, Ti() (+1 more)

### Community 15 - "sr"
Cohesion: 0.21
Nodes (7): sr(), C(), et(), L(), N(), tt(), xs()

### Community 16 - "ke"
Cohesion: 0.12
Nodes (7): er, v(), ke, tr, R(), we(), xe()

### Community 19 - ".sub"
Cohesion: 0.23
Nodes (3): Ee(), Lt, ur()

### Community 21 - "app.js"
Cohesion: 0.12
Nodes (17): applyAccentColor(), createLogCardElement(), escapeHtml(), fetchActiveDevices(), fetchAdbStatus(), formatRelativeTime(), hexToRgb(), loadHistoryModalData() (+9 more)

### Community 22 - "AdbSystemController"
Cohesion: 0.23
Nodes (6): AdbSystemController, AuthorizedKeyInfo, Context, IBinder, Method, Parcel

### Community 23 - "As"
Cohesion: 0.20
Nodes (5): As(), ct(), fi(), ve, Vr()

### Community 24 - "zs"
Cohesion: 0.33
Nodes (3): bt(), Tt(), zs

### Community 25 - "vt"
Cohesion: 0.33
Nodes (3): Es(), Ms(), vt()

### Community 26 - "build_and_install.sh"
Cohesion: 0.40
Nodes (4): BUILD_TOOLS, JAVA_HOME, PATH, build_and_install.sh script

### Community 28 - "gradlew"
Cohesion: 0.70
Nodes (4): gradlew script, die(), save(), warn()

### Community 34 - ".copy"
Cohesion: 0.14
Nodes (4): he(), Ot, xn, ye()

### Community 35 - "shaders.js"
Cohesion: 0.06
Nodes (59): buildStrandsPalette(), easePower2InOut(), getOptimizedDPR(), hexToRgb(), hexToRgbArr(), initAntigravity(), initAurora(), initBalatro() (+51 more)

### Community 36 - "🛡️ ADB Glass Sentinel"
Cohesion: 0.29
Nodes (6): 🛡️ ADB Glass Sentinel, 🏗️ Arquitetura do Sistema, 🔒 Auditoria de Segurança & Permissões, 👤 Autor, 📦 Binários e Instalação, 🌟 Funcionalidades Principais

### Community 37 - "BootReceiver.kt"
Cohesion: 0.53
Nodes (4): BootReceiver, Context, Intent, BroadcastReceiver

### Community 38 - "AdbSentinelService"
Cohesion: 0.14
Nodes (7): AdbSentinelService, IBinder, Intent, LocalBinder, Binder, Notification, Service

### Community 39 - "AdbSocketTracker"
Cohesion: 0.25
Nodes (3): AdbConnection, AdbSocketTracker, Context

### Community 41 - "AudioStreamManager"
Cohesion: 0.14
Nodes (14): android, AudioJitterBuffer, AudioStreamManager, Context, ServerSocket, Socket, SpeakerAudioSession, AudioManager (+6 more)

### Community 46 - "zt"
Cohesion: 0.11
Nodes (11): be(), gt, Ie(), Ne(), nn(), rn, l(), zr (+3 more)

### Community 50 - ".intersectMeshes"
Cohesion: 0.20
Nodes (3): cr, ki(), j()

## Knowledge Gaps
- **40 isolated node(s):** `adb_sentinel_daemon.sh script`, `fe`, `pe`, `Ei`, `J` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 200 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_` connect `_` to `ks`, `ar`, `U`, `tn`, `q`, `V`, `W`, `K`, `.z`, `pt`, `.constructor`, `.x`, `sr`, `ke`, `le`, `.addAttribute`, `.sub`, `gr`, `As`, `zs`, `vt`, `.multiply`, `oe`, `ue`, `.copy`, `shaders.js`, `zt`, `ji`, `.intersectMeshes`?**
  _High betweenness centrality (0.432) - this node is a cross-community bridge._
- **Why does `V` connect `V` to `_`, `.copy`, `shaders.js`, `W`, `.constructor`, `zt`, `sr`, `ji`, `.intersectMeshes`, `.sub`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `ks` connect `ks` to `_`, `shaders.js`, `q`, `K`, `.x`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **What connects `adb_sentinel_daemon.sh script`, `fe`, `pe` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `_` be split into smaller, more focused modules?**
  _Cohesion score 0.041742286751361164 - nodes in this community are weakly interconnected._
- **Should `AndroidBridge` be split into smaller, more focused modules?**
  _Cohesion score 0.056051587301587304 - nodes in this community are weakly interconnected._
- **Should `ar` be split into smaller, more focused modules?**
  _Cohesion score 0.08858858858858859 - nodes in this community are weakly interconnected._