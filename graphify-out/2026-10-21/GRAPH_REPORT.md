# Graph Report - adb-glass-sentinel  (2026-10-21)

## Corpus Check
- 19 files · ~449,081 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 839 nodes · 1614 edges · 46 communities (27 shown, 15 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2b550df3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- _
- ks
- AndroidBridge
- ar
- U
- .multiply
- q
- l
- V
- tn
- pt
- .z
- it
- .intersectMeshes
- ji
- sr
- ke
- le
- .addAttribute
- .scale
- AdbLogStreamer
- app.js
- AdbSystemController
- ct
- zs
- vt
- build_and_install.sh
- WebcamStreamServer
- gradlew
- oe
- ue
- .copy
- shaders.js
- 🛡️ ADB Glass Sentinel
- .sub
- AdbSentinelService
- W
- adb_sentinel_daemon.sh
- Fs
- .draw
- .constructor
- zi

## God Nodes (most connected - your core abstractions)
1. `_` - 208 edges
2. `requestAnimationFrame()` - 39 edges
3. `U` - 35 edges
4. `V` - 33 edges
5. `getOptimizedDPR()` - 31 edges
6. `resize()` - 29 edges
7. `ks` - 25 edges
8. `tn` - 23 edges
9. `AndroidBridge` - 22 edges
10. `WebcamStreamServer` - 20 edges

## Surprising Connections (you probably didn't know these)
- `MainActivity` --references--> `AdbSentinelService`  [EXTRACTED]
  app/src/main/java/com/mateuscelestino/adbsentinel/MainActivity.kt → app/src/main/java/com/mateuscelestino/adbsentinel/AdbSentinelService.kt

## Import Cycles
- None detected.

## Communities (46 total, 15 thin omitted)

### Community 0 - "_"
Cohesion: 0.04
Nodes (41): _, ae(), at, bs(), ce(), dt, Ei, Et (+33 more)

### Community 1 - "ks"
Cohesion: 0.10
Nodes (3): ge(), ks, me()

### Community 2 - "AndroidBridge"
Cohesion: 0.06
Nodes (17): AndroidBridge, MainActivity, WebChromeClient, WebViewClient, OnBackPressedCallback, Context, ServerSocket, Socket (+9 more)

### Community 3 - "ar"
Cohesion: 0.08
Nodes (8): ar, dr(), kt(), mr, Ot, pr(), Ut(), yr

### Community 4 - "U"
Cohesion: 0.05
Nodes (16): ai(), ci(), di(), gi(), hi(), ii(), li(), mi() (+8 more)

### Community 6 - "q"
Cohesion: 0.05
Nodes (12): As(), br, en, gr, K, kr, nr, q (+4 more)

### Community 7 - "l"
Cohesion: 0.31
Nodes (5): be(), gt, l(), h(), l()

### Community 8 - "V"
Cohesion: 0.11
Nodes (3): De(), qi(), V

### Community 10 - "pt"
Cohesion: 0.12
Nodes (7): bi(), _i(), pt, Se(), Si(), Ti(), vi()

### Community 11 - ".z"
Cohesion: 0.08
Nodes (4): Gs(), Hs(), qs(), Xs()

### Community 12 - "it"
Cohesion: 0.08
Nodes (7): cs, Ds(), is, it, rr, St, Ys()

### Community 15 - "sr"
Cohesion: 0.21
Nodes (8): nn(), sr(), C(), et(), L(), N(), tt(), xs()

### Community 16 - "ke"
Cohesion: 0.07
Nodes (16): er, fr(), A(), E(), m(), v(), p(), Ie() (+8 more)

### Community 19 - ".scale"
Cohesion: 0.31
Nodes (3): he(), Lt, ur()

### Community 20 - "AdbLogStreamer"
Cohesion: 0.23
Nodes (4): AdbLogStreamer, AdbShellCommandEvent, Context, ParsedTimestampInfo

### Community 21 - "app.js"
Cohesion: 0.13
Nodes (14): applyAccentColor(), createLogCardElement(), escapeHtml(), fetchActiveDevices(), fetchAdbStatus(), formatRelativeTime(), hexToRgb(), loadHistoryModalData() (+6 more)

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

### Community 27 - "WebcamStreamServer"
Cohesion: 0.09
Nodes (21): AudioStreamManager, ByteArray, Context, ServerSocket, Socket, ByteArray, Context, ServerSocket (+13 more)

### Community 28 - "gradlew"
Cohesion: 0.70
Nodes (4): gradlew script, die(), save(), warn()

### Community 35 - "shaders.js"
Cohesion: 0.06
Nodes (59): buildStrandsPalette(), easePower2InOut(), getOptimizedDPR(), hexToRgb(), hexToRgbArr(), initAntigravity(), initAurora(), initBalatro() (+51 more)

### Community 36 - "🛡️ ADB Glass Sentinel"
Cohesion: 0.29
Nodes (6): 🛡️ ADB Glass Sentinel, 🏗️ Arquitetura do Sistema, 🔒 Auditoria de Segurança & Permissões, 👤 Autor, 📦 Binários e Instalação, 🌟 Funcionalidades Principais

### Community 38 - "AdbSentinelService"
Cohesion: 0.10
Nodes (10): AdbSentinelService, IBinder, LocalBinder, AdbConnection, AdbSocketTracker, Context, Binder, Intent (+2 more)

### Community 39 - "W"
Cohesion: 0.20
Nodes (4): on, rn, un, W

## Knowledge Gaps
- **40 isolated node(s):** `adb_sentinel_daemon.sh script`, `fe`, `pe`, `Ei`, `J` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 198 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_` connect `_` to `ks`, `ar`, `U`, `.multiply`, `q`, `l`, `V`, `tn`, `pt`, `.z`, `it`, `.intersectMeshes`, `ji`, `sr`, `ke`, `le`, `.addAttribute`, `.scale`, `ct`, `zs`, `vt`, `oe`, `ue`, `.copy`, `shaders.js`, `.sub`, `W`, `Fs`, `.draw`, `.computeBoundingSphere`, `.constructor`, `zi`?**
  _High betweenness centrality (0.446) - this node is a cross-community bridge._
- **Why does `V` connect `V` to `_`, `.copy`, `ar`, `shaders.js`, `.sub`, `l`, `.computeBoundingSphere`, `.constructor`, `.intersectMeshes`, `it`, `sr`, `ji`, `.scale`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `ks` connect `ks` to `_`, `shaders.js`, `q`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `adb_sentinel_daemon.sh script`, `fe`, `pe` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `_` be split into smaller, more focused modules?**
  _Cohesion score 0.041742286751361164 - nodes in this community are weakly interconnected._
- **Should `ks` be split into smaller, more focused modules?**
  _Cohesion score 0.09879032258064516 - nodes in this community are weakly interconnected._
- **Should `AndroidBridge` be split into smaller, more focused modules?**
  _Cohesion score 0.062310949788263764 - nodes in this community are weakly interconnected._