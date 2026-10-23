# Graph Report - adb-glass-sentinel  (2026-10-23)

## Corpus Check
- 21 files · ~451,116 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 864 nodes · 1662 edges · 57 communities (34 shown, 19 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a9e1d3ad`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- _
- ks
- AndroidBridge
- ar
- U
- AdbLogStreamer
- .constructor
- en
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
- .copy
- zt
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
- Ot
- shaders.js
- 🛡️ ADB Glass Sentinel
- BootReceiver.kt
- AdbSentinelService
- AdbSocketTracker
- adb_sentinel_daemon.sh
- Fs
- fr
- K
- it
- .update
- gr
- St
- W
- .normalize
- .x
- SentinelSecurityAlertActivity
- mr
- .constructor
- .multiply
- qi

## God Nodes (most connected - your core abstractions)
1. `_` - 208 edges
2. `requestAnimationFrame()` - 39 edges
3. `U` - 35 edges
4. `V` - 33 edges
5. `getOptimizedDPR()` - 31 edges
6. `resize()` - 29 edges
7. `ks` - 25 edges
8. `AdbSentinelService` - 25 edges
9. `tn` - 23 edges
10. `AndroidBridge` - 23 edges

## Surprising Connections (you probably didn't know these)
- `MainActivity` --references--> `AdbSentinelService`  [EXTRACTED]
  app/src/main/java/com/mateuscelestino/adbsentinel/MainActivity.kt → app/src/main/java/com/mateuscelestino/adbsentinel/AdbSentinelService.kt

## Import Cycles
- None detected.

## Communities (57 total, 19 thin omitted)

### Community 0 - "_"
Cohesion: 0.04
Nodes (41): _, ae(), at, bs(), ce(), dt, Ei, Et (+33 more)

### Community 2 - "AndroidBridge"
Cohesion: 0.06
Nodes (17): AndroidBridge, Bundle, MainActivity, WebChromeClient, WebViewClient, OnBackPressedCallback, Context, ServerSocket (+9 more)

### Community 3 - "ar"
Cohesion: 0.16
Nodes (3): ar, dr(), pr()

### Community 4 - "U"
Cohesion: 0.05
Nodes (17): ai(), ci(), di(), gi(), hi(), ii(), li(), mi() (+9 more)

### Community 5 - "AdbLogStreamer"
Cohesion: 0.23
Nodes (4): AdbLogStreamer, AdbShellCommandEvent, Context, ParsedTimestampInfo

### Community 9 - "tn"
Cohesion: 0.15
Nodes (3): cs, ns(), tn

### Community 10 - "q"
Cohesion: 0.21
Nodes (4): p(), q, ze, zi()

### Community 11 - ".z"
Cohesion: 0.08
Nodes (4): Gs(), Hs(), qs(), Xs()

### Community 12 - "pt"
Cohesion: 0.12
Nodes (7): bi(), _i(), pt, Se(), Si(), Ti(), vi()

### Community 13 - ".intersectMeshes"
Cohesion: 0.23
Nodes (3): cr, Ee(), ki()

### Community 15 - "sr"
Cohesion: 0.17
Nodes (9): nn(), sr(), C(), et(), j(), L(), N(), tt() (+1 more)

### Community 16 - "ke"
Cohesion: 0.22
Nodes (3): ke, xe(), ye()

### Community 19 - ".copy"
Cohesion: 0.24
Nodes (3): he(), Lt, ur()

### Community 20 - "zt"
Cohesion: 0.11
Nodes (10): be(), gt, Ie(), Ne(), rn, l(), zr, h() (+2 more)

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

### Community 37 - "BootReceiver.kt"
Cohesion: 0.53
Nodes (4): BootReceiver, Context, Intent, BroadcastReceiver

### Community 38 - "AdbSentinelService"
Cohesion: 0.14
Nodes (7): AdbSentinelService, IBinder, Intent, LocalBinder, Binder, Notification, Service

### Community 39 - "AdbSocketTracker"
Cohesion: 0.25
Nodes (3): AdbConnection, AdbSocketTracker, Context

### Community 42 - "fr"
Cohesion: 0.28
Nodes (7): fr(), A(), E(), m(), v(), tr, R()

### Community 43 - "K"
Cohesion: 0.13
Nodes (4): br, K, kr, nr

### Community 45 - ".update"
Cohesion: 0.19
Nodes (3): is, rr, Ys()

### Community 46 - "gr"
Cohesion: 0.29
Nodes (3): As(), gr, Vr()

### Community 48 - "W"
Cohesion: 0.17
Nodes (4): Ds(), on, un, W

### Community 51 - "SentinelSecurityAlertActivity"
Cohesion: 0.39
Nodes (3): Activity, Bundle, SentinelSecurityAlertActivity

### Community 52 - "mr"
Cohesion: 0.29
Nodes (3): kt(), mr, Ut()

## Knowledge Gaps
- **40 isolated node(s):** `adb_sentinel_daemon.sh script`, `fe`, `pe`, `Ei`, `J` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 197 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_` connect `_` to `ks`, `ar`, `U`, `.constructor`, `en`, `V`, `tn`, `q`, `.z`, `pt`, `.intersectMeshes`, `ji`, `sr`, `ke`, `le`, `.addAttribute`, `.copy`, `zt`, `ct`, `zs`, `vt`, `oe`, `ue`, `Ot`, `shaders.js`, `Fs`, `fr`, `K`, `it`, `.update`, `gr`, `St`, `W`, `.normalize`, `.x`, `mr`, `.computeBoundingSphere`, `.constructor`, `.multiply`, `qi`?**
  _High betweenness centrality (0.420) - this node is a cross-community bridge._
- **Why does `V` connect `V` to `_`, `ar`, `shaders.js`, `.intersectMeshes`, `.update`, `St`, `sr`, `ji`, `.copy`, `zt`, `.computeBoundingSphere`, `.constructor`, `qi`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `ks` connect `ks` to `_`, `shaders.js`, `q`, `K`, `.x`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `adb_sentinel_daemon.sh script`, `fe`, `pe` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `_` be split into smaller, more focused modules?**
  _Cohesion score 0.041742286751361164 - nodes in this community are weakly interconnected._
- **Should `AndroidBridge` be split into smaller, more focused modules?**
  _Cohesion score 0.061016949152542375 - nodes in this community are weakly interconnected._
- **Should `U` be split into smaller, more focused modules?**
  _Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected._