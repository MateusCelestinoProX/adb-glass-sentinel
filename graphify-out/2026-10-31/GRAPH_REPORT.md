# Graph Report - adb-glass-sentinel  (2026-10-31)

## Corpus Check
- 19 files · ~451,863 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 841 nodes · 1624 edges · 50 communities (30 shown, 17 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `54f0d5eb`
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
- it
- .sub
- .z
- pt
- zt
- W
- sr
- ke
- le
- .addAttribute
- .scale
- rr
- app.js
- AdbSystemController
- ct
- zs
- vt
- build_and_install.sh
- .draw
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
- Fs
- .constructor
- De
- .copy
- l
- qi
- ji
- .intersectMeshes

## God Nodes (most connected - your core abstractions)
1. `_` - 208 edges
2. `requestAnimationFrame()` - 39 edges
3. `U` - 35 edges
4. `V` - 33 edges
5. `getOptimizedDPR()` - 31 edges
6. `resize()` - 29 edges
7. `AndroidBridge` - 26 edges
8. `ks` - 25 edges
9. `AdbSentinelService` - 24 edges
10. `AudioStreamManager` - 24 edges

## Surprising Connections (you probably didn't know these)
- `MainActivity` --references--> `AdbSentinelService`  [EXTRACTED]
  app/src/main/java/com/mateuscelestino/adbsentinel/MainActivity.kt → app/src/main/java/com/mateuscelestino/adbsentinel/AdbSentinelService.kt

## Import Cycles
- None detected.

## Communities (50 total, 17 thin omitted)

### Community 0 - "_"
Cohesion: 0.04
Nodes (41): _, ae(), at, bs(), ce(), dt, Ei, Et (+33 more)

### Community 1 - "ks"
Cohesion: 0.05
Nodes (9): br, cs, ge(), K, kr, ks, me(), nr (+1 more)

### Community 2 - "AndroidBridge"
Cohesion: 0.06
Nodes (17): AndroidBridge, MainActivity, WebChromeClient, WebViewClient, OnBackPressedCallback, Context, ServerSocket, Socket (+9 more)

### Community 3 - "ar"
Cohesion: 0.08
Nodes (8): ar, dr(), kt(), mr, Ot, pr(), Ut(), yr

### Community 4 - "U"
Cohesion: 0.04
Nodes (19): ai(), ci(), di(), _e(), gi(), hi(), ii(), li() (+11 more)

### Community 5 - "AdbLogStreamer"
Cohesion: 0.23
Nodes (4): AdbLogStreamer, AdbShellCommandEvent, Context, ParsedTimestampInfo

### Community 6 - "tn"
Cohesion: 0.15
Nodes (6): fr(), A(), E(), m(), ns(), tn

### Community 7 - "q"
Cohesion: 0.08
Nodes (9): As(), en, p(), gr, q, sn, Vr(), ze (+1 more)

### Community 9 - "it"
Cohesion: 0.17
Nodes (3): Ds(), it, St

### Community 10 - ".sub"
Cohesion: 0.22
Nodes (3): cr, Ee(), er

### Community 11 - ".z"
Cohesion: 0.07
Nodes (5): Gs(), Hs(), qs(), Xs(), Ys()

### Community 12 - "pt"
Cohesion: 0.12
Nodes (7): bi(), _i(), pt, Se(), Si(), Ti(), vi()

### Community 13 - "zt"
Cohesion: 0.24
Nodes (4): Ie(), Ne(), or, zt

### Community 14 - "W"
Cohesion: 0.18
Nodes (4): on, rn, un, W

### Community 15 - "sr"
Cohesion: 0.21
Nodes (7): sr(), C(), et(), L(), N(), tt(), xs()

### Community 21 - "app.js"
Cohesion: 0.12
Nodes (17): applyAccentColor(), createLogCardElement(), escapeHtml(), fetchActiveDevices(), fetchAdbStatus(), formatRelativeTime(), hexToRgb(), loadHistoryModalData() (+9 more)

### Community 22 - "AdbSystemController"
Cohesion: 0.23
Nodes (6): AdbSystemController, AuthorizedKeyInfo, Context, IBinder, Method, Parcel

### Community 23 - "ct"
Cohesion: 0.29
Nodes (3): ct(), fi(), ve

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
Cohesion: 0.20
Nodes (4): v(), he(), j(), ye()

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
Cohesion: 0.18
Nodes (10): android, AudioStreamManager, Context, ServerSocket, Socket, AudioManager, ByteArray, LoudnessEnhancer (+2 more)

### Community 46 - "l"
Cohesion: 0.27
Nodes (6): be(), gt, nn(), l(), h(), l()

## Knowledge Gaps
- **40 isolated node(s):** `adb_sentinel_daemon.sh script`, `fe`, `pe`, `Ei`, `J` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 199 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_` connect `_` to `ks`, `ar`, `U`, `tn`, `q`, `V`, `it`, `.sub`, `.z`, `pt`, `zt`, `W`, `sr`, `ke`, `le`, `.addAttribute`, `.scale`, `rr`, `ct`, `zs`, `vt`, `.draw`, `oe`, `ue`, `.copy`, `shaders.js`, `Fs`, `.constructor`, `De`, `.copy`, `l`, `qi`, `ji`, `.intersectMeshes`?**
  _High betweenness centrality (0.444) - this node is a cross-community bridge._
- **Why does `V` connect `V` to `_`, `.copy`, `shaders.js`, `.sub`, `De`, `zt`, `l`, `sr`, `qi`, `ke`, `.intersectMeshes`, `.scale`, `ji`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `ks` connect `ks` to `_`, `shaders.js`, `q`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `adb_sentinel_daemon.sh script`, `fe`, `pe` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `_` be split into smaller, more focused modules?**
  _Cohesion score 0.041742286751361164 - nodes in this community are weakly interconnected._
- **Should `ks` be split into smaller, more focused modules?**
  _Cohesion score 0.05325814536340852 - nodes in this community are weakly interconnected._
- **Should `AndroidBridge` be split into smaller, more focused modules?**
  _Cohesion score 0.056051587301587304 - nodes in this community are weakly interconnected._