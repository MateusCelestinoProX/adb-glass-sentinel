# Graph Report - adb-glass-sentinel  (2026-10-06)

## Corpus Check
- 16 files · ~344,118 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 666 nodes · 1202 edges · 41 communities (26 shown, 12 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fa000b91`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- _
- ks
- AdbSentinelService
- ar
- U
- AndroidBridge
- q
- K
- V
- tn
- pt
- .z
- W
- zt
- .update
- sr
- ke
- le
- .addAttribute
- .copy
- AdbLogStreamer
- app.js
- .sub
- ct
- zs
- vt
- build_and_install.sh
- j
- gradlew
- oe
- ue
- AdbSocketTracker
- initShader
- 🛡️ ADB Glass Sentinel
- er
- .constructor
- .multiply
- adb_sentinel_daemon.sh

## God Nodes (most connected - your core abstractions)
1. `_` - 207 edges
2. `U` - 35 edges
3. `V` - 32 edges
4. `ks` - 24 edges
5. `tn` - 23 edges
6. `sr()` - 19 edges
7. `ar` - 19 edges
8. `W` - 18 edges
9. `pt` - 17 edges
10. `ke` - 17 edges

## Surprising Connections (you probably didn't know these)
- `MainActivity` --references--> `AdbSentinelService`  [EXTRACTED]
  app/src/main/java/com/mateuscelestino/adbsentinel/MainActivity.kt → app/src/main/java/com/mateuscelestino/adbsentinel/AdbSentinelService.kt

## Import Cycles
- None detected.

## Communities (41 total, 12 thin omitted)

### Community 0 - "_"
Cohesion: 0.04
Nodes (41): _, ae(), at, bs(), ce(), dt, Ei, Et (+33 more)

### Community 1 - "ks"
Cohesion: 0.10
Nodes (3): ge(), ks, me()

### Community 2 - "AdbSentinelService"
Cohesion: 0.09
Nodes (17): AdbSentinelService, IBinder, LocalBinder, MainActivity, WebChromeClient, WebViewClient, AppCompatActivity, Binder (+9 more)

### Community 3 - "ar"
Cohesion: 0.08
Nodes (7): ar, dr(), kt(), mr, pr(), Ut(), yr

### Community 4 - "U"
Cohesion: 0.05
Nodes (16): ai(), ci(), di(), gi(), hi(), ii(), li(), mi() (+8 more)

### Community 5 - "AndroidBridge"
Cohesion: 0.10
Nodes (6): AdbSystemController, AuthorizedKeyInfo, IBinder, AndroidBridge, Context, Parcel

### Community 6 - "q"
Cohesion: 0.09
Nodes (8): As(), en, p(), gr, q, sn, Vr(), ze

### Community 7 - "K"
Cohesion: 0.09
Nodes (11): be(), br, gt, K, kr, nr, rn, l() (+3 more)

### Community 8 - "V"
Cohesion: 0.06
Nodes (7): cr, De(), Ee(), Fs(), ki(), qi(), V

### Community 9 - "tn"
Cohesion: 0.15
Nodes (6): fr(), A(), E(), m(), ns(), tn

### Community 10 - "pt"
Cohesion: 0.09
Nodes (9): bi(), _i(), pn, pt, Se(), Si(), vi(), xn (+1 more)

### Community 11 - ".z"
Cohesion: 0.08
Nodes (4): Gs(), Hs(), qs(), Xs()

### Community 12 - "W"
Cohesion: 0.11
Nodes (6): Ds(), it, on, St, un, W

### Community 13 - "zt"
Cohesion: 0.33
Nodes (3): Ie(), Ne(), zt

### Community 14 - ".update"
Cohesion: 0.16
Nodes (4): cs, is, rr, Ys()

### Community 15 - "sr"
Cohesion: 0.19
Nodes (8): nn(), sr(), C(), et(), L(), N(), tt(), xs()

### Community 16 - "ke"
Cohesion: 0.18
Nodes (4): ji(), ke, we(), xe()

### Community 19 - ".copy"
Cohesion: 0.14
Nodes (5): he(), Ot, ri(), Ti(), ye()

### Community 21 - "app.js"
Cohesion: 0.33
Nodes (6): escapeHtml(), fetchActiveDevices(), fetchAdbStatus(), loadHistoryModalData(), renderActiveDevices(), updateUiWithStatus()

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
Cohesion: 0.33
Nodes (5): ANDROID_HOME, BUILD_TOOLS, JAVA_HOME, PATH, build_and_install.sh script

### Community 27 - "j"
Cohesion: 0.33
Nodes (4): v(), j(), tr, R()

### Community 28 - "gradlew"
Cohesion: 0.70
Nodes (4): gradlew script, die(), save(), warn()

### Community 36 - "🛡️ ADB Glass Sentinel"
Cohesion: 0.29
Nodes (6): 🛡️ ADB Glass Sentinel, 🏗️ Arquitetura do Sistema, 🔒 Auditoria de Segurança & Permissões, 👤 Autor, 📦 Binários e Instalação, 🌟 Funcionalidades Principais

## Knowledge Gaps
- **39 isolated node(s):** `adb_sentinel_daemon.sh script`, `fe`, `pe`, `Ei`, `J` (+34 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 169 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_` connect `_` to `ks`, `ar`, `U`, `q`, `K`, `V`, `tn`, `pt`, `.z`, `W`, `zt`, `.update`, `sr`, `ke`, `le`, `.addAttribute`, `.copy`, `.sub`, `ct`, `zs`, `vt`, `j`, `oe`, `ue`, `er`, `.constructor`, `.multiply`?**
  _High betweenness centrality (0.571) - this node is a cross-community bridge._
- **Why does `ks` connect `ks` to `_`, `q`, `K`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `V` connect `V` to `_`, `ar`, `.constructor`, `K`, `.update`, `sr`, `ke`, `.copy`, `.sub`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `adb_sentinel_daemon.sh script`, `fe`, `pe` to the rest of the system?**
  _39 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `_` be split into smaller, more focused modules?**
  _Cohesion score 0.041742286751361164 - nodes in this community are weakly interconnected._
- **Should `ks` be split into smaller, more focused modules?**
  _Cohesion score 0.09659090909090909 - nodes in this community are weakly interconnected._
- **Should `AdbSentinelService` be split into smaller, more focused modules?**
  _Cohesion score 0.08536585365853659 - nodes in this community are weakly interconnected._