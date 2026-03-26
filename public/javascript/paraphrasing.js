// ==============================
// 🔹 WORD COUNTER
// ==============================
function countWords() {
    const text = document.getElementById('inputText').value;

    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;

    document.getElementById('inputWords').innerHTML =
        `<strong>${words}</strong>/500 words`;

    document.getElementById('inputChars').innerHTML =
        `<strong>${chars}</strong> chars`;
}


// ==============================
// 🔹 PARAPHRASING (MAIN FUNCTION)
// ==============================
async function paraphraseText() {
    const text = document.getElementById('inputText').value;
    const mode = document.getElementById('mode').value;
    const output = document.getElementById('outputText');
    const btn = document.getElementById('paraphraseBtn');

    if (!text.trim()) {
        alert("Enter text first");
        return;
    }

    btn.disabled = true;
    btn.innerText = "Processing...";

    try {
        const res = await fetch("http://localhost:3000/paraphrase", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text, mode })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "Failed");
        }

        output.value = data.paraphrased;

        // update output counters
        const words = data.paraphrased.trim().split(/\s+/).length;
        const chars = data.paraphrased.length;

        document.getElementById('outputWords').innerHTML =
            `<strong>${words}</strong> words`;

        document.getElementById('outputChars').innerHTML =
            `<strong>${chars}</strong> chars`;

    } catch (err) {
        console.error(err);
        alert(err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Paraphrase";
    }
}


// ==============================
// 🔹 CLEAR BUTTON
// ==============================
document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("clearBtn").onclick = () => {
        document.getElementById("inputText").value = "";
        document.getElementById("outputText").value = "";
        countWords();
    };

});