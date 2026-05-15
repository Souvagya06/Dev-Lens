function drawGraph(nodes, links) {

    console.debug('[DevLens graph] drawGraph called', {
        nodesCount: Array.isArray(nodes) ? nodes.length : 'invalid',
        linksCount: Array.isArray(links) ? links.length : 'invalid'
    });

    const canvas = document.getElementById("graph-canvas");

    console.debug('[DevLens graph] graph-canvas lookup', {
        exists: !!canvas,
        width: canvas ? canvas.clientWidth : null,
        height: canvas ? canvas.clientHeight : null
    });

    if (!canvas) {
        console.error('[DevLens graph] #graph-canvas not found. drawGraph cannot continue.');
        return;
    }

    if (!Array.isArray(nodes) || !Array.isArray(links)) {
        console.error('[DevLens graph] Invalid graph input. nodes and links must both be arrays.', { nodes, links });
        return;
    }

    if (!nodes.length) {
        console.warn('[DevLens graph] drawGraph received no nodes. Nothing will render.');
    }

    if (!links.length) {
        console.warn('[DevLens graph] drawGraph received no links. Only isolated nodes can render.');
    }

    const repoInputState = document.getElementById('repo-input-state');
    const graphLoadedState = document.getElementById('graph-loaded-state');

    if (repoInputState) {
        repoInputState.style.display = 'none';
    }

    if (graphLoadedState) {
        graphLoadedState.style.display = 'none';
    }

    // Remove old graph
    d3.select("#graph-svg").remove();

    // Create SVG
    const svg = d3.select("#graph-canvas")
        .append("svg")
        .attr("id", "graph-svg")
        .attr("width", "100%")
        .attr("height", "100%");

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (!width || !height) {
        console.warn('[DevLens graph] graph-canvas has zero size. Deferring render until the next frame.', {
            width,
            height
        });
        requestAnimationFrame(() => drawGraph(nodes, links));
        return;
    }

    console.debug('[DevLens graph] rendering into canvas', { width, height });

    // Zoom feature
    const zoomGroup = svg.append("g");

    svg.call(
        d3.zoom()
            .scaleExtent([0.5, 3])
            .on("zoom", (event) => {
                zoomGroup.attr("transform", event.transform);
            })
    );

    // Force simulation - adjust parameters for small canvas size
    // Scale forces proportionally to canvas dimensions
    const scaleFactor = Math.min(width, height) / 500; // Normalize to ~500px reference
    const simulation = d3.forceSimulation(nodes)
        .force(
            "link",
            d3.forceLink(links)
                .id(d => d.id)
                .distance(60 * scaleFactor) // Reduced from 120
        )
        .force("charge", d3.forceManyBody().strength(-150 * scaleFactor)) // Reduced from -400
        .force("center", d3.forceCenter(width / 2, height / 2))
        .alpha(1) // Restart with full energy
        .alphaDecay(0.05); // Slow down decay to let it settle

    // LINKS with styling
    const link = zoomGroup
        .selectAll("line")
        .data(links)
        .enter()
        .append("line")
        .attr("stroke", (d, i) => {
            // Color edges based on target's blast radius
            const targetRadius = d.target.blastRadius || 0;
            if (targetRadius >= 10) return "#ef4444"; // Red for critical
            if (targetRadius >= 5) return "#f59e0b"; // Orange for medium
            return "#6b7280"; // Gray for low impact
        })
        .attr("stroke-width", (d) => {
            // Thicker edges for critical dependencies
            const targetRadius = d.target.blastRadius || 0;
            if (targetRadius >= 10) return 2.5;
            if (targetRadius >= 5) return 2;
            return 1.5;
        })
        .style("opacity", 0.6);

    // NODE COLORS based on blast radius
    function getColor(node) {
        const radius = node.blastRadius || 0;
        
        // Red: High blast radius (many files depend on it - critical)
        if (radius >= 10) return "#ef4444";
        
        // Orange: Medium-high blast radius
        if (radius >= 5) return "#f59e0b";
        
        // Yellow: Medium blast radius
        if (radius >= 2) return "#eab308";
        
        // Blue: Low blast radius (independent, few depend on it)
        return "#3b82f6";
    }

    // NODES
    const node = zoomGroup
        .selectAll("circle")
        .data(nodes)
        .enter()
        .append("circle")
        .attr("r", (d) => {
            // Larger radius for high blast radius nodes (more important)
            const radius = d.blastRadius || 0;
            if (radius >= 10) return 12;
            if (radius >= 5) return 10;
            if (radius >= 2) return 8;
            return 6;
        })
        .attr("fill", d => getColor(d))
        .style("cursor", "pointer")
        .style("filter", (d) => {
            // Add glow to critical files
            const radius = d.blastRadius || 0;
            if (radius >= 10) return "drop-shadow(0 0 8px rgba(239, 68, 68, 0.6))";
            if (radius >= 5) return "drop-shadow(0 0 4px rgba(245, 158, 11, 0.4))";
            return "none";
        });

    // Add tooltip titles to nodes
    node.append("title")
        .text(d => {
            const filename = d.id.split("/").pop();
            return `${filename}\nBlast Radius: ${d.blastRadius || 0} dependents\n${d.id}`;
        });

    // Add drag behavior to nodes
    node.call(
        d3.drag()
            .on("start", dragStarted)
            .on("drag", dragged)
            .on("end", dragEnded)
    );

    // LABELS
    const labels = zoomGroup
        .selectAll("text")
        .data(nodes)
        .enter()
        .append("text")
        .text(d => {
            const parts = d.id.split("/");
            return parts[parts.length - 1];
        })
        .attr("fill", (d) => {
            // White text for red/orange nodes, dark for blue/yellow
            const radius = d.blastRadius || 0;
            if (radius >= 5) return "#fff";
            return "#000";
        })
        .attr("font-size", "10px")
        .attr("font-weight", (d) => {
            // Bold for critical files
            const radius = d.blastRadius || 0;
            if (radius >= 10) return "bold";
            if (radius >= 5) return "600";
            return "400";
        })
        .attr("text-anchor", "middle")
        .attr("dy", "0.3em")
        .style("pointer-events", "none");

    // BLAST RADIUS ANIMATION GROUP
    let blastGroup = zoomGroup.append("g").attr("class", "blast-group");

    // Function to find all files impacted (BFS on incoming edges)
    function getImpacted(nodeId) {
        const adj = {};
        nodes.forEach(n => adj[n.id] = []);
        links.forEach(l => {
            const sid = typeof l.source === "object" ? l.source.id : l.source;
            const tid = typeof l.target === "object" ? l.target.id : l.target;
            adj[tid].push(sid); // reverse: who imports nodeId
        });
        const visited = new Set();
        const queue = [nodeId];
        while (queue.length) {
            const cur = queue.shift();
            if (visited.has(cur)) continue;
            visited.add(cur);
            (adj[cur] || []).forEach(n => { if (!visited.has(n)) queue.push(n); });
        }
        visited.delete(nodeId);
        return visited;
    }

    // Show blast radius panel
    function showBlastPanel() {
        const panel = document.getElementById("blast-info-panel");
        if (panel) panel.style.display = "flex";
    }

    // Trigger blast animation and update sidebar
    function triggerBlast(d) {
        const impacted = getImpacted(d.id);
        showBlastPanel();

        // Update sidebar
        document.getElementById("file-name-el").textContent = d.id;
        document.getElementById("file-summary-el").textContent = `Blast Radius: ${impacted.size} file${impacted.size === 1 ? "" : "s"} depend on this.`;
        document.getElementById("blast-number").textContent = impacted.size;

        // Risk badge
        const radius = d.blastRadius || 0;
        let riskLabel = "LOW RISK";
        let riskClass = "danger-low";
        if (radius >= 10) { riskLabel = "CRITICAL"; riskClass = "danger-high"; }
        else if (radius >= 5) { riskLabel = "HIGH RISK"; riskClass = "danger-high"; }
        else if (radius >= 2) { riskLabel = "MED RISK"; riskClass = "danger-med"; }

        const badgeEl = document.getElementById("danger-badge-el");
        badgeEl.innerHTML = `<span class="danger-badge ${riskClass}">${riskLabel}</span>`;

        // Impact list
        const impactEl = document.getElementById("impact-list-el");
        if (impacted.size > 0) {
            impactEl.innerHTML = `<div style="font-size:0.6rem; color:#8b93a1; letter-spacing:2px; text-transform:uppercase; margin-bottom:6px;">💥 Breaks these files</div>`
                + [...impacted].slice(0, 6).map((f, i) =>
                    `<div class="impact-item" style="animation-delay:${i * 0.06}s">
                        <span class="impact-arrow">▶</span>${f}
                    </div>`
                ).join("")
                + (impacted.size > 6 ? `<div class="impact-item"><span class="impact-arrow">▶</span>+${impacted.size - 6} more…</div>` : "");
        } else {
            impactEl.innerHTML = `<div style="font-size:0.6rem; color:#10b981; letter-spacing:2px; text-transform:uppercase;">✓ No dependents — safe to modify</div>`;
        }

        document.getElementById("file-card").classList.add("active");

        // Dim/highlight links
        link.each(function (l) {
            const sid = typeof l.source === "object" ? l.source.id : l.source;
            const tid = typeof l.target === "object" ? l.target.id : l.target;
            const isBlast = (sid === d.id && impacted.has(tid)) ||
                (tid === d.id && impacted.has(sid)) ||
                (impacted.has(sid) && impacted.has(tid));
            d3.select(this)
                .classed("highlighted", isBlast)
                .classed("dimmed", !isBlast);
        });

        // Flash impacted nodes
        node.each(function (n) {
            if (impacted.has(n.id)) {
                d3.select(this).classed("impacted", false);
                setTimeout(() => d3.select(this).classed("impacted", true), 50);
            }
        });

        // Blast rings from clicked node
        blastGroup.selectAll("*").remove();

        for (let i = 0; i < 3; i++) {
            const ring = blastGroup.append("circle")
                .attr("class", "blast-ring")
                .attr("cx", d.x).attr("cy", d.y)
                .attr("r", d.r || 6)
                .attr("fill", "none")
                .attr("stroke", "#ef4444")
                .attr("stroke-width", 2.5 - i * 0.5)
                .attr("opacity", 0.85);

            ring.transition()
                .delay(i * 180)
                .duration(900)
                .ease(d3.easeQuadOut)
                .attr("r", 80 + i * 40)
                .attr("opacity", 0)
                .attr("stroke-width", 0.5);
        }

        // Propagation lines to each impacted node
        impacted.forEach(targetId => {
            const tNode = nodes.find(n => n.id === targetId);
            if (!tNode) return;
            const line = blastGroup.append("line")
                .attr("x1", d.x).attr("y1", d.y)
                .attr("x2", d.x).attr("y2", d.y)
                .attr("stroke", "#ef4444")
                .attr("stroke-width", 1.5)
                .attr("stroke-dasharray", "4,4")
                .attr("opacity", 0.7);

            line.transition()
                .duration(500)
                .delay(Math.random() * 200)
                .ease(d3.easeQuadOut)
                .attr("x2", tNode.x)
                .attr("y2", tNode.y)
                .transition()
                .duration(600)
                .attr("opacity", 0)
                .remove();
        });
    }

    // BLAST RADIUS CLICK EFFECT
    node.on("click", function (event, clickedNode) {
        event.stopPropagation();
        triggerBlast(clickedNode);
    });

    // Click background to reset
    svg.on("click", () => {
        link.classed("highlighted", false).classed("dimmed", false);
        blastGroup.selectAll("*").remove();
        document.getElementById("file-name-el").textContent = "— Click a node —";
        document.getElementById("file-summary-el").textContent = "Select any file in the graph to see its details.";
        document.getElementById("danger-badge-el").innerHTML = "";
        document.getElementById("impact-list-el").innerHTML = "";
        document.getElementById("blast-number").textContent = "0";
        document.getElementById("file-card").classList.remove("active");
    });

    // Tick updates
    simulation.on("tick", () => {

        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);

        labels
            .attr("x", d => d.x)
            .attr("y", d => d.y);

    });

    // Drag functions
    function dragStarted(event, d) {
        if (!event.active)
            simulation.alphaTarget(0.3).restart();

        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragEnded(event, d) {
        if (!event.active)
            simulation.alphaTarget(0);

        d.fx = null;
        d.fy = null;
    }
}

const previousWindowOnload = window.onload;
window.onload = () => {
    if (typeof previousWindowOnload === 'function') {
        previousWindowOnload();
    }

    if (!window.__DEVLENS_ENABLE_GRAPH_TEST__) {
        return;
    }

    const canvas = document.getElementById('graph-canvas');
    const existingSvg = document.getElementById('graph-svg');

    console.debug('[DevLens graph] window load check', {
        canvasExists: !!canvas,
        existingSvg: !!existingSvg
    });

    if (!canvas || existingSvg) {
        return;
    }

    const testNodes = [
        { id: 'test/auth.js' },
        { id: 'test/db.js' },
        { id: 'test/config.js' },
        { id: 'test/api.js' }
    ];

    const testLinks = [
        { source: 'test/auth.js', target: 'test/db.js' },
        { source: 'test/db.js', target: 'test/config.js' },
        { source: 'test/config.js', target: 'test/api.js' }
    ];

    console.debug('[DevLens graph] rendering temporary test graph');
    drawGraph(testNodes, testLinks);
};