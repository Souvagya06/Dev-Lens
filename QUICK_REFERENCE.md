# Quick Reference: Orphan Node Classification

## Visual Quick Guide

### Legend Icons
```
🔴 RED CIRCLE           = High Risk Node (many dependents)
🟡 YELLOW CIRCLE        = Medium Risk Node
🟢 GREEN CIRCLE         = Low Risk Node / Isolated Safe Node
🔵 BLUE CIRCLE          = Entry Point
⚪ DASHED CIRCLE        = Orphan Node (NEW)
```

## Node Status Badges

When you click a node, you'll see one of these badges:

| Badge | Color | What It Means | Action |
|-------|-------|--------------|--------|
| **⚠️ ORPHAN NODE** | RED | File has NO connections at all - likely dead code or WIP | Review for removal or activation |
| **ℹ️ ISOLATED** | YELLOW | File is isolated BUT might have hidden dependencies | Investigate hidden usage patterns |
| **CRITICAL** | RED | 10+ files depend on this file | VERY careful with changes |
| **HIGH RISK** | RED | 5-9 files depend on this file | Handle with care |
| **MED RISK** | YELLOW | 2-4 files depend on this file | Be cautious |
| **LOW RISK** | GREEN | 0-1 files depend on this | Relatively safe to modify |
| **ENTRY POINT** | BLUE | Starting point of the application | Check carefully before changes |

## Classification Types

```javascript
// Automatically detected by filename/path patterns:

'config'    → Files: config.js, types.d.ts, constants.js, settings.json
             Reason: May be imported dynamically

'test'      → Files: *.test.js, *.spec.js, test.js
             Reason: Important for coverage but not imported by app code

'entry'     → Files: index.js, main.js, app.js, server.js
             Reason: Application starting points

'route'     → Files: In routes/, api/, *handler*, *endpoint*
             Reason: May be registered via routing framework

'utility'   → Files: In utils/, helpers/, lib/
             Reason: Commonly used indirectly

'orphan'    → Any file with zero connections
             Reason: Potential dead code
```

## How to Interpret Results

### Scenario 1: ⚠️ ORPHAN NODE (RED)
```
File: src/old_utils/deprecated_helper.js

Status: ⚠️ ORPHAN NODE
Reason: "Unused/orphan node - no incoming or outgoing dependencies 
         detected. May be dead code, work-in-progress, or dynamically loaded."

Action: 
  ✓ Search codebase for dynamic requires/imports
  ✓ Check package.json for bin/main references
  ✓ If truly unused → Schedule for removal
  ✓ If work-in-progress → Complete or delete
```

### Scenario 2: ℹ️ ISOLATED (YELLOW) - Config File
```
File: src/config/database.config.ts

Status: ℹ️ ISOLATED
Reason: "Configuration or type definitions - may be imported via 
         dynamic paths or environment"

Action:
  ✓ Check for dynamic imports: require(process.env.CONFIG)
  ✓ Look for indirect imports via index files
  ✓ Verify it's actually used in the application
  ✓ If truly unused → Consider consolidating configs
```

### Scenario 3: ℹ️ ISOLATED (YELLOW) - Test File
```
File: src/utils/helpers.test.js

Status: ℹ️ ISOLATED
Reason: "Test file - likely unused in production but important for coverage"

Action:
  ✓ This is EXPECTED for test files
  ✓ Don't modify unless updating tests
  ✓ Ensure test coverage is adequate
  ✓ No action needed
```

### Scenario 4: HIGH RISK (RED)
```
File: src/middleware/auth.js

Status: HIGH RISK
Blast Radius: 12 files affected

Action:
  ✗ DO NOT modify this file lightly
  ✓ Review blast radius list carefully
  ✓ Run full test suite before changes
  ✓ Consider impact on all 12 dependent files
  ✓ Plan careful testing strategy
```

## Node Information Display

When you click a node, the sidebar shows:

```
╔════════════════════════════════════════╗
║ FILE: src/utils/helpers.js             ║
╠════════════════════════════════════════╣
║ Status: ⚠️ ORPHAN NODE (RED BADGE)    ║
║                                        ║
║ Isolation Reason:                      ║
║ "Unused/orphan node - no incoming or   ║
║  outgoing dependencies detected.       ║
║  May be dead code, work-in-progress,   ║
║  or dynamically loaded."               ║
╠════════════════════════════════════════╣
║ Connections:                           ║
║ • Incoming: 0 files depend on this     ║
║ • Outgoing: 0 files imported by this   ║
║                                        ║
║ Blast Radius: 0 files would break      ║
╚════════════════════════════════════════╝
```

## Common Patterns

### Pattern 1: Test File
```
✓ Name ends with: .test.js, .spec.js
✓ Status: ℹ️ ISOLATED (yellow)
✓ Expected: YES - this is normal
✓ Action: None - tests should be isolated
```

### Pattern 2: Configuration File
```
✓ Name contains: config, constant, type, settings
✓ Status: ℹ️ ISOLATED (yellow)
✓ Investigation: Check for dynamic imports
✓ Action: Investigate if truly unused
```

### Pattern 3: Dead Code
```
✓ Random name, no obvious pattern
✓ Status: ⚠️ ORPHAN NODE (red)
✓ Expected: NO - should be connected
✓ Action: Schedule for removal or review
```

### Pattern 4: Entry Point
```
✓ Name: index.js, main.js, app.js, server.js
✓ Status: Might be ⚠️ ORPHAN NODE (if nothing imports it)
✓ Expected: YES - entry points often isolated
✓ Action: Check package.json "main" or "entry" fields
```

## Hover Tooltip Information

When you hover over a node, a tooltip appears:

```
src/utils/helper.js
[ORPHAN NODE]
Incoming: 0, Outgoing: 0

Unused/orphan node - no incoming or outgoing dependencies 
detected. May be dead code, work-in-progress, or dynamically loaded.
```

## Color Legend

```
🔴 RED      → High risk, handle carefully
🟡 YELLOW   → Medium risk, investigate
🟢 GREEN    → Low risk, safe
🔵 BLUE     → Entry point
⚪ DASHED   → Orphan/unused
```

## Tips & Tricks

1. **Finding Dead Code**: Look for 🔴 ORPHAN NODE badges in red
2. **Safety Check**: Before modifying, hover over node to see incoming/outgoing counts
3. **Impact Analysis**: Click to see all files that would break if you delete this file
4. **Configuration Audit**: Look for ℹ️ ISOLATED files to audit your app structure
5. **Test Coverage**: Ensure ℹ️ ISOLATED test files have good coverage
6. **Refactoring**: Orphan nodes are good candidates for:
   - Deletion (if truly unused)
   - Consolidation (if similar utilities)
   - Activation (if work-in-progress code)

## Keyboard Shortcuts

- **Click Node**: Show detailed blast radius and isolation info
- **Click Background**: Clear selection and reset view
- **Scroll/Pinch**: Zoom in/out of graph
- **Drag**: Pan around the graph

## Need More Info?

- **Hover**: Get quick tooltip with connection counts
- **Click**: Get detailed panel with blast radius list
- **Legend**: Click legend items to understand color coding
- **Search**: Use file search to find specific files
