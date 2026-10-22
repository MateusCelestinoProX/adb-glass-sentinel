# Graph Report - adb-glass-sentinel  (2026-10-21)

## Corpus Check
- 19 files · ~449,394 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 842 nodes · 1623 edges · 47 communities (29 shown, 15 thin omitted)
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
- zt
- V
- tn
- pt
- .z
- W
- .intersectMeshes
- ji
- sr
- ke
- le
- .addAttribute
- .sub
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
- MainActivity
- AdbSentinelService
- AdbSocketTracker
- adb_sentinel_daemon.sh
- SamsungDeXController
- .constructor
- WebChromeClient
- .constructor
- qi
- OnBackPressedCallback

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
10. `WebcamStreamServer` - 22 edges

## Surprising Connections (you probably didn't know these)
- `MainActivity` --references--> `AdbSentinelService`  [EXTRACTED]
  app/src/main/java/com/mateuscelestino/adbsentinel/MainActivity.kt → app/src/main/java/com/mateuscelestino/adbsentinel/AdbSentinelService.kt

## Import Cycles
- None detected.

## Communities (47 total, 15 thin omitted)

### Community 0 - "_"
Cohesion: 0.04
Nodes (41): _, ae(), at, bs(), ce(), dt, Ei, Et (+33 more)

### Community 1 - "ks"
Cohesion: 0.10
Nodes (3): ge(), ks, me()

### Community 3 - "ar"
Cohesion: 0.08
Nodes (7): ar, dr(), kt(), mr, pr(), Ut(), yr

### Community 4 - "U"
Cohesion: 0.05
Nodes (17): ai(), ci(), di(), gi(), hi(), ii(), li(), mi() (+9 more)

### Community 6 - "q"
Cohesion: 0.05
Nodes (13): As(), br, en, p(), gr, K, kr, nr (+5 more)

### Community 7 - "zt"
Cohesion: 0.16
Nodes (8): be(), gt, Ie(), Ne(), l(), h(), l(), zt

### Community 9 - "tn"
Cohesion: 0.15
Nodes (6): fr(), A(), E(), m(), ns(), tn

### Community 10 - "pt"
Cohesion: 0.09
Nodes (9): bi(), _i(), pn, pt, Se(), Si(), Ti(), vi() (+1 more)

### Community 11 - ".z"
Cohesion: 0.08
Nodes (4): Gs(), Hs(), qs(), Xs()

### Community 12 - "W"
Cohesion: 0.06
Nodes (12): cs, Ds(), Fs(), is, it, on, rn, rr (+4 more)

### Community 15 - "sr"
Cohesion: 0.15
Nodes (11): he(), nn(), sr(), C(), et(), j(), L(), N() (+3 more)

### Community 16 - "ke"
Cohesion: 0.16
Nodes (4): er, ke, we(), xe()

### Community 19 - ".sub"
Cohesion: 0.25
Nodes (3): Ee(), Lt, ur()

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
Nodes (19): AudioStreamManager, ByteArray, Context, ServerSocket, Socket, ByteArray, Context, ServerSocket (+11 more)

### Community 28 - "gradlew"
Cohesion: 0.70
Nodes (4): gradlew script, die(), save(), warn()

### Community 35 - "shaders.js"
Cohesion: 0.06
Nodes (59): buildStrandsPalette(), easePower2InOut(), getOptimizedDPR(), hexToRgb(), hexToRgbArr(), initAntigravity(), initAurora(), initBalatro() (+51 more)

### Community 36 - "🛡️ ADB Glass Sentinel"
Cohesion: 0.29
Nodes (6): 🛡️ ADB Glass Sentinel, 🏗️ Arquitetura do Sistema, 🔒 Auditoria de Segurança & Permissões, 👤 Autor, 📦 Binários e Instalação, 🌟 Funcionalidades Principais

### Community 37 - "MainActivity"
Cohesion: 0.19
Nodes (8): MainActivity, WebViewClient, AppCompatActivity, Bundle, WebResourceRequest, WebResourceResponse, WebView, WebViewAssetLoader

### Community 38 - "AdbSentinelService"
Cohesion: 0.15
Nodes (6): AdbSentinelService, IBinder, LocalBinder, Binder, Notification, Service

### Community 39 - "AdbSocketTracker"
Cohesion: 0.25
Nodes (3): AdbConnection, AdbSocketTracker, Context

### Community 41 - "SamsungDeXController"
Cohesion: 0.32
Nodes (5): Context, ServerSocket, Socket, SamsungDeXController, Intent

### Community 42 - ".constructor"
Cohesion: 0.40
Nodes (3): v(), tr, R()

## Knowledge Gaps
- **40 isolated node(s):** `adb_sentinel_daemon.sh script`, `fe`, `pe`, `Ei`, `J` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 198 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_` connect `_` to `ks`, `ar`, `U`, `.multiply`, `q`, `zt`, `V`, `tn`, `pt`, `.z`, `W`, `.intersectMeshes`, `ji`, `sr`, `ke`, `le`, `.addAttribute`, `.sub`, `ct`, `zs`, `vt`, `oe`, `ue`, `.copy`, `shaders.js`, `.constructor`, `.constructor`, `qi`?**
  _High betweenness centrality (0.443) - this node is a cross-community bridge._
- **Why does `V` connect `V` to `_`, `.copy`, `ar`, `shaders.js`, `zt`, `.constructor`, `.intersectMeshes`, `qi`, `sr`, `W`, `ji`, `.sub`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `ks` connect `ks` to `_`, `shaders.js`, `q`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `adb_sentinel_daemon.sh script`, `fe`, `pe` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `_` be split into smaller, more focused modules?**
  _Cohesion score 0.041742286751361164 - nodes in this community are weakly interconnected._
- **Should `ks` be split into smaller, more focused modules?**
  _Cohesion score 0.09879032258064516 - nodes in this community are weakly interconnected._
- **Should `ar` be split into smaller, more focused modules?**
  _Cohesion score 0.08232118758434548 - nodes in this community are weakly interconnected._