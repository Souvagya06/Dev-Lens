const logoutBtn = document.getElementById("logoutBtn");

logoutBtn.addEventListener("click", () => {
  window.location.href = "../pages/index.html";
});

const recentAnalysisContainer = document.getElementById("recent-analysis");

// Example recent analysis data
const recentAnalysis = [
  "Player performance report",
  "Tournament ranking analysis",
];

// Check if recent analysis exists
if (recentAnalysis.length === 0) {
  recentAnalysisContainer.innerHTML = `
    <p class="text-gray-400 text-sm">No recent analysis</p>
  `;
} else {
  recentAnalysisContainer.innerHTML = "";

  recentAnalysis.forEach((item) => {
    const analysisCard = document.createElement("div");

    analysisCard.className =
      "bg-zinc-800 text-white p-4 rounded-lg mb-3 border border-zinc-700";

    const currentTime = new Date().toLocaleString();

    analysisCard.innerHTML = `
      <h3 class="font-semibold text-lg">Recent Performance Analysis</h3>
      
      <p class="text-sm text-gray-300 mt-1">
        ${item}
      </p>

      <div class="flex items-center justify-between mt-3 text-xs text-gray-400">
        <span>${currentTime}</span>
        <span>AI-generated insights</span>
      </div>
    `;

    recentAnalysisContainer.appendChild(analysisCard);
  });
}