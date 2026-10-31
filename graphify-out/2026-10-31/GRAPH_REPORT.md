# Graph Report - adb-glass-sentinel  (2026-10-31)

## Corpus Check
- 19 files · ~450,748 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 831 nodes · 1603 edges · 42 communities (32 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c2a85494`
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
- .normalize
- V
- W
- .z
- pt
- sr
- ke
- le
- .addAttribute
- .sub
- zt
- app.js
- AdbSystemController
- ct
- zs
- vt
- build_and_install.sh
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
- q
- K
- ji
- .intersectMeshes

## God Nodes (most connected - your core abstractions)
1. `_` - 208 edges
2. `requestAnimationFrame()` - 39 edges
3. `U` - 35 edges
4. `V` - 33 edges
5. `getOptimizedDPR()` - 31 edges
6. `resize()` - 29 edges
7. `ks` - 25 edges
8. `AdbSentinelService` - 24 edges
9. `tn` - 23 edges
10. `AndroidBridge` - 23 edges

## Surprising Connections (you probably didn't know these)
- `MainActivity` --references--> `AdbSentinelService`  [EXTRACTED]
  app/src/main/java/com/mateuscelestino/adbsentinel/MainActivity.kt → app/src/main/java/com/mateuscelestino/adbsentinel/AdbSentinelService.kt

## Import Cycles
- None detected.

## Communities (42 total, 7 thin omitted)

### Community 0 - "_"
Cohesion: 0.04
Nodes (42): _, ae(), at, bs(), ce(), dt, Ei, Et (+34 more)

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
Nodes (17): ai(), ci(), di(), _e(), gi(), hi(), ii(), li() (+9 more)

### Community 5 - "AdbLogStreamer"
Cohesion: 0.23
Nodes (4): AdbLogStreamer, AdbShellCommandEvent, Context, ParsedTimestampInfo

### Community 7 - ".normalize"
Cohesion: 0.20
Nodes (3): tr, R(), we()

### Community 8 - "V"
Cohesion: 0.09
Nodes (3): De(), qi(), V

### Community 9 - "W"
Cohesion: 0.05
Nodes (13): cs, Ds(), Fs(), is, it, on, pn, rn (+5 more)

### Community 11 - ".z"
Cohesion: 0.08
Nodes (4): Gs(), Hs(), qs(), Xs()

### Community 12 - "pt"
Cohesion: 0.10
Nodes (8): bi(), _i(), pt, Se(), Si(), Ti(), vi(), zi()

### Community 15 - "sr"
Cohesion: 0.17
Nodes (11): v(), nn(), sr(), C(), et(), j(), L(), N() (+3 more)

### Community 16 - "ke"
Cohesion: 0.21
Nodes (6): fr(), A(), E(), m(), ke, xe()

### Community 19 - ".sub"
Cohesion: 0.24
Nodes (3): er, Lt, ur()

### Community 20 - "zt"
Cohesion: 0.21
Nodes (4): Ie(), Ne(), or, zt

### Community 21 - "app.js"
Cohesion: 0.13
Nodes (15): applyAccentColor(), createLogCardElement(), escapeHtml(), fetchActiveDevices(), fetchAdbStatus(), formatRelativeTime(), hexToRgb(), loadHistoryModalData() (+7 more)

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
Nodes (3): ri(), ui(), ye()

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
Cohesion: 0.23
Nodes (8): AudioStreamManager, Context, ServerSocket, Socket, ByteArray, LoudnessEnhancer, PowerManager, WifiManager

### Community 43 - "q"
Cohesion: 0.09
Nodes (8): As(), en, p(), gr, q, sn, Vr(), ze

### Community 46 - "K"
Cohesion: 0.09
Nodes (10): be(), br, gt, K, kr, nr, l(), zr (+2 more)

### Community 50 - ".intersectMeshes"
Cohesion: 0.25
Nodes (3): cr, Ee(), ki()

## Knowledge Gaps
- **40 isolated node(s):** `adb_sentinel_daemon.sh script`, `fe`, `pe`, `Ei`, `J` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 198 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_` connect `_` to `ks`, `ar`, `U`, `tn`, `.normalize`, `V`, `W`, `.z`, `pt`, `sr`, `ke`, `le`, `.addAttribute`, `.sub`, `zt`, `ct`, `zs`, `vt`, `oe`, `ue`, `.copy`, `shaders.js`, `q`, `K`, `ji`, `.intersectMeshes`?**
  _High betweenness centrality (0.454) - this node is a cross-community bridge._
- **Why does `V` connect `V` to `_`, `.copy`, `ar`, `shaders.js`, `.normalize`, `W`, `K`, `sr`, `ji`, `.intersectMeshes`, `.sub`, `zt`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `ks` connect `ks` to `_`, `shaders.js`, `q`, `K`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `adb_sentinel_daemon.sh script`, `fe`, `pe` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `_` be split into smaller, more focused modules?**
  _Cohesion score 0.04067796610169491 - nodes in this community are weakly interconnected._
- **Should `ks` be split into smaller, more focused modules?**
  _Cohesion score 0.09659090909090909 - nodes in this community are weakly interconnected._
- **Should `AndroidBridge` be split into smaller, more focused modules?**
  _Cohesion score 0.05901639344262295 - nodes in this community are weakly interconnected._