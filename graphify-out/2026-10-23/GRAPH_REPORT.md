# Graph Report - adb-glass-sentinel  (2026-10-23)

## Corpus Check
- 20 files · ~449,933 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 851 nodes · 1634 edges · 47 communities (31 shown, 13 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `20805d8e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- _
- ks
- AndroidBridge
- ar
- U
- AdbLogStreamer
- .draw
- sn
- V
- tn
- q
- .z
- pt
- .intersectMeshes
- ji
- sr
- ke
- le
- .addAttribute
- .sub
- W
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
- BootReceiver.kt
- AdbSentinelService
- AdbSocketTracker
- adb_sentinel_daemon.sh
- Fs
- .constructor
- As
- AudioStreamManager
- en
- gr

## God Nodes (most connected - your core abstractions)
1. `_` - 208 edges
2. `requestAnimationFrame()` - 39 edges
3. `U` - 35 edges
4. `V` - 33 edges
5. `getOptimizedDPR()` - 31 edges
6. `resize()` - 29 edges
7. `ks` - 25 edges
8. `tn` - 23 edges
9. `AndroidBridge` - 23 edges
10. `WebcamStreamServer` - 22 edges

## Surprising Connections (you probably didn't know these)
- `MainActivity` --references--> `AdbSentinelService`  [EXTRACTED]
  app/src/main/java/com/mateuscelestino/adbsentinel/MainActivity.kt → app/src/main/java/com/mateuscelestino/adbsentinel/AdbSentinelService.kt

## Import Cycles
- None detected.

## Communities (47 total, 13 thin omitted)

### Community 0 - "_"
Cohesion: 0.04
Nodes (41): _, ae(), at, bs(), ce(), dt, Ei, Et (+33 more)

### Community 1 - "ks"
Cohesion: 0.06
Nodes (8): br, ge(), K, kr, ks, me(), nr, zr

### Community 2 - "AndroidBridge"
Cohesion: 0.06
Nodes (17): AndroidBridge, MainActivity, WebChromeClient, WebViewClient, OnBackPressedCallback, Context, ServerSocket, Socket (+9 more)

### Community 3 - "ar"
Cohesion: 0.08
Nodes (7): ar, dr(), kt(), mr, pr(), Ut(), yr

### Community 4 - "U"
Cohesion: 0.05
Nodes (17): ai(), ci(), di(), _e(), gi(), hi(), ii(), li() (+9 more)

### Community 5 - "AdbLogStreamer"
Cohesion: 0.23
Nodes (4): AdbLogStreamer, AdbShellCommandEvent, Context, ParsedTimestampInfo

### Community 8 - "V"
Cohesion: 0.09
Nodes (3): De(), qi(), V

### Community 9 - "tn"
Cohesion: 0.15
Nodes (6): fr(), A(), E(), m(), ns(), tn

### Community 10 - "q"
Cohesion: 0.21
Nodes (4): p(), q, ze, zi()

### Community 11 - ".z"
Cohesion: 0.05
Nodes (8): cs, Gs(), Hs(), is, qs(), rr, Xs(), Ys()

### Community 12 - "pt"
Cohesion: 0.11
Nodes (7): bi(), _i(), pt, Se(), Si(), Ti(), vi()

### Community 13 - ".intersectMeshes"
Cohesion: 0.17
Nodes (3): cr, Ee(), ki()

### Community 15 - "sr"
Cohesion: 0.16
Nodes (10): nn(), sr(), C(), et(), j(), L(), N(), tt() (+2 more)

### Community 16 - "ke"
Cohesion: 0.17
Nodes (4): er, ke, we(), xe()

### Community 20 - "W"
Cohesion: 0.06
Nodes (17): be(), Ds(), gt, Ie(), it, Ne(), on, or (+9 more)

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
Cohesion: 0.12
Nodes (14): ByteArray, Context, ServerSocket, Socket, WebcamStreamServer, StateCallback, StateCallback, CameraCaptureSession (+6 more)

### Community 28 - "gradlew"
Cohesion: 0.70
Nodes (4): gradlew script, die(), save(), warn()

### Community 34 - ".copy"
Cohesion: 0.17
Nodes (4): he(), Ot, ri(), ye()

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
Cohesion: 0.15
Nodes (7): AdbSentinelService, IBinder, Intent, LocalBinder, Binder, Notification, Service

### Community 39 - "AdbSocketTracker"
Cohesion: 0.25
Nodes (3): AdbConnection, AdbSocketTracker, Context

### Community 42 - ".constructor"
Cohesion: 0.40
Nodes (3): v(), tr, R()

### Community 44 - "AudioStreamManager"
Cohesion: 0.33
Nodes (5): AudioStreamManager, ByteArray, Context, ServerSocket, Socket

## Knowledge Gaps
- **40 isolated node(s):** `adb_sentinel_daemon.sh script`, `fe`, `pe`, `Ei`, `J` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 198 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_` connect `_` to `ks`, `ar`, `U`, `.draw`, `sn`, `V`, `tn`, `q`, `.z`, `pt`, `.intersectMeshes`, `ji`, `sr`, `ke`, `le`, `.addAttribute`, `.sub`, `W`, `ct`, `zs`, `vt`, `oe`, `ue`, `.copy`, `shaders.js`, `Fs`, `.constructor`, `As`, `en`, `gr`?**
  _High betweenness centrality (0.433) - this node is a cross-community bridge._
- **Why does `V` connect `V` to `_`, `.copy`, `ar`, `shaders.js`, `.z`, `.intersectMeshes`, `ji`, `sr`, `.sub`, `W`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `ks` connect `ks` to `_`, `q`, `shaders.js`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **What connects `adb_sentinel_daemon.sh script`, `fe`, `pe` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `_` be split into smaller, more focused modules?**
  _Cohesion score 0.041742286751361164 - nodes in this community are weakly interconnected._
- **Should `ks` be split into smaller, more focused modules?**
  _Cohesion score 0.05660377358490566 - nodes in this community are weakly interconnected._
- **Should `AndroidBridge` be split into smaller, more focused modules?**
  _Cohesion score 0.061016949152542375 - nodes in this community are weakly interconnected._