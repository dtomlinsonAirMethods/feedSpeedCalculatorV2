// Placeholder for initialization logic
window.addEventListener("DOMContentLoaded", () => {
  console.log("Feed & Speed Calculator initialized");
  console.log("Loaded materials:", Object.keys(materialsData));
  console.log("Loaded thread types:", Object.keys(threadsData));

  const app = document.getElementById("app");
  app.innerHTML = `<p>Materials loaded: ${Object.keys(materialsData).length}</p>`;
});

// ----- Corner Radius State -----
function updateCornerRadiusState() {
  const toolType = document.getElementById("toolType").value;
  const dia = parseFloat(document.getElementById("dia").value) || 0.5;
  const cornerRadiusInput = document.getElementById("cornerRadius");

  if (toolType === "Flat") {
    cornerRadiusInput.disabled = true;
    cornerRadiusInput.value = 0;
  } else if (toolType === "Bull Nose") {
    cornerRadiusInput.disabled = false;
  } else if (toolType === "Ball Nose") {
    cornerRadiusInput.disabled = false;
    cornerRadiusInput.value = (dia / 2).toFixed(4);
  }
}

// ----- Dynamic IPT calculator -----
function getDynamicIPT(toolType, material, dia) {
  // Try to pull matching data from ipt.json
  const dataSet = iptData?.[toolType]?.[material];

  if (dataSet && Array.isArray(dataSet)) {
    // Find correct diameter range
    const match = dataSet.find(entry => dia <= entry.max);
    if (match) {
      console.log(
        `✅ IPT from ipt.json → Tool: ${toolType}, Material: ${material}, Dia: ${dia}, IPT: ${match.val}`
      );
      return match.val;
    }

    // Fallback to highest size range in JSON
    const fallbackVal = dataSet[dataSet.length - 1].val;
    console.warn(
      `⚠ Diameter ${dia}" exceeds all listed ranges for ${material} (${toolType}). Using max IPT value ${fallbackVal}.`
    );
    return fallbackVal;
  }

  // No valid dataset found
  console.warn(
    `⚠ No IPT data found in ipt.json for Tool: ${toolType}, Material: ${material}. Returning 0.002 as safe fallback.`
  );
  return 0.002;
}

// --- Tab switching ---
function openTab(evt, tabName) {
    const contents = document.getElementsByClassName("tabcontent");
    for (let c of contents) c.style.display = "none";
    const links = document.getElementsByClassName("tablink");
    for (let l of links) l.classList.remove("active");
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.classList.add("active");
  }

// ----- Endmill calculation -----
function calculateEndmill() {
  try {
    const isHsm = document.getElementById("hsm").checked;
    const dia = parseFloat(document.getElementById("dia").value);
    const flutes = parseInt(document.getElementById("flutes").value);
    const stickout = parseFloat(document.getElementById("stickout").value);
    const stepover = parseFloat(document.getElementById("stepover").value) / 100;
    const depth = parseFloat(document.getElementById("depth").value);
    const toolType = document.querySelector('input[name="toolType"]:checked').value;
    const cornerRadius =
      toolType === "Bull Nose" || toolType === "Ball Nose"
        ? parseFloat(document.getElementById("cornerRadius").value)
        : 0;
    const mat = document.getElementById("material").value;

    let sfm = materialsData[mat].SFM_endmill;
    let ipt = getDynamicIPT("endmill", mat, dia);
    console.log(`DEBUG → Endmill IPT for ${mat}, dia=${dia}: ${ipt}`);
    let warningText = "";

    // --- Geometry warnings ---
    if (toolType === "Bull Nose" && cornerRadius > dia / 2) {
      warningText += `⚠ Corner radius (${cornerRadius}) > half tool dia (${(dia / 2).toFixed(3)})\n`;
    }

    const ratio = stickout / dia;
    let reduction = 1.0;
    if (ratio > 3.0) {
      reduction = 0.7;
      warningText += `⚠ Stickout too high (S/D=${ratio.toFixed(1)}), feed reduced 30%\n`;
    } else if (ratio > 2.0) {
      reduction = 0.85;
      warningText += `⚠ Stickout high (S/D=${ratio.toFixed(1)}), feed reduced 15%\n`;
    }
    if (stepover > 0.5) warningText += "⚠ Stepover >50% recommended\n";
    if (depth > dia) warningText += "⚠ Depth > diameter\n";

    // --- Tool type modifiers ---
    if (toolType === "Bull Nose") ipt *= 0.95;
    if (toolType === "Ball Nose") ipt *= 0.9;

    // --- HSM modifiers ---
    if (isHsm) {
      if (mat.includes("7075") || mat.includes("6061")) {
        sfm *= 1.25 + (stepover <= 0.2 ? 0.1 : 0) + (depth <= dia * 0.5 ? 0.05 : 0);
        ipt *= 1.2 + (stepover <= 0.2 ? 0.05 : 0);
      } else if (mat.includes("Stainless")) {
        sfm *= 1.15 + (stepover <= 0.2 ? 0.05 : 0);
        ipt *= 1.1;
      } else if (mat.includes("HRS")) {
        sfm *= 1.1;
        ipt *= 1.05;
      }
      warningText += "\n✅ HSM active: feeds/speeds adjusted.";
    }

    const rpmLimit = isHsm ? 9500 : 9000;
    const rpm = Math.min(Math.round((sfm * 3.82) / dia), rpmLimit);
    const ipm = rpm * flutes * ipt * reduction;

    // --- Output ---
    document.getElementById("rpm").innerText = `RPM: ${rpm}`;
    document.getElementById("feedRate").innerText = `Feed Rate (IPM): ${ipm.toFixed(1)}`;
    document.getElementById("sfmOut").innerText = `SFM: ${sfm.toFixed(1)}`;
    document.getElementById("iptOut").innerText = `Feed per Tooth (IPT): ${ipt.toFixed(5)}`;
    const warn = document.getElementById("warnings");
    warn.innerText = warningText.trim();
    warn.style.color = warningText.includes("⚠") ? "orange" : "green";
  } catch (err) {
    alert("Input Error: " + err);
  }
}

// ----- Drill calculation -----
function calculateDrill() {
  try {
    const dia = parseFloat(document.getElementById("diaDrill").value);
    const flutes = parseInt(document.getElementById("flutesDrill").value);
    const mat = document.getElementById("drillMaterial").value;
    const drillType = document.getElementById("drillType").value.toLowerCase();
    const stickout = parseFloat(document.getElementById("stickoutDrill").value);
    const depth = parseFloat(document.getElementById("depthDrill").value);
    const pecking = document.getElementById("pecking").checked;

    // --- Base feed & speed data ---
    let sfm = materialsData[mat]?.SFM_drill || 250;
    let ipr = getDynamicIPT("drill", mat, dia);

    // --- Adjust for special drill types ---
    if (["spotter", "center drill"].includes(drillType)) {
      sfm = materialsData[mat]?.SFM_spot || sfm;
      ipr *= 0.5; // half feed for spotting tools
    } else if (drillType === "reamer") {
      sfm = materialsData[mat]?.SFM_reamer || sfm * 0.6;
      ipr *= 0.4; // much lighter feed for reaming
    }

    // --- Deep hole / stickout reductions ---
    const ratio = stickout / dia;
    let reduction = 1.0;
    let warningText = "";
    if (ratio > 5) {
      reduction = 0.7;
      warningText = "⚠ Stickout or depth high (S/D > 5), feed reduced 30%";
    } else if (ratio > 3) {
      reduction = 0.85;
      warningText = "⚠ Stickout moderate (S/D > 3), feed reduced 15%";
    }

    // --- RPM & Feed calculations ---
    let rpm = Math.floor((sfm * 3.82) / dia);
    rpm = Math.min(rpm, 9500);
    const ipm = rpm * flutes * ipr * reduction;

    // --- Pecking logic ---
    const peckText = pecking
      ? `Suggested Peck: ${Math.min(depth, dia * 3).toFixed(3)} in`
      : "No pecking";

    // --- Output ---
    document.getElementById("rpmDrill").innerText = `RPM: ${rpm}`;
    document.getElementById("feedDrill").innerText = `Feed Rate (IPM): ${ipm.toFixed(2)}`;
    document.getElementById("peckOut").innerText = peckText;

    // --- Warning color ---
    const warn = document.getElementById("drillWarn");
    warn.innerText = warningText;
    warn.style.color = warningText ? "orange" : "green";

    // --- Debug output (optional) ---
    console.log(
      `🧮 Drill Calc → Type: ${drillType}, Material: ${mat}, Dia: ${dia}, SFM: ${sfm}, IPT: ${ipr}, RPM: ${rpm}, IPM: ${ipm.toFixed(
        2
      )}`
    );

  } catch (err) {
    alert("Input Error: " + err);
  }
}

// ----- Thread dropdown updates -----
function updateThreadSizes() {
  const ttype = document.getElementById("threadType").value;
  const sizeMenu = document.getElementById("threadSize");
  sizeMenu.innerHTML = "";

  const sizes = Object.keys(threadsData?.[ttype] || {});
  sizes.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sizeMenu.appendChild(opt);
  });

  console.log(`🔹 Updated thread sizes for ${ttype}:`, sizes);

  // Auto-update class dropdown
  updateThreadClasses();
}

function updateThreadClasses() {
  const ttype = document.getElementById("threadType").value;
  const tsize = document.getElementById("threadSize").value;
  const classMenu = document.getElementById("threadClass");
  classMenu.innerHTML = "";

  const classes = Object.keys(threadsData?.[ttype]?.[tsize] || {}).filter(
    (key) => key !== "pitch"
  );

  classes.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    classMenu.appendChild(opt);
  });

  console.log(`🔹 Updated classes for ${ttype} ${tsize}:`, classes);
}

// ----- Threading Calculation -----
function calculateThreading() {
  try {
    const ttype = document.getElementById("threadType").value;
    const tsize = document.getElementById("threadSize").value;
    const tclass = document.getElementById("threadClass").value;
    const mat = document.getElementById("threadMaterial").value;
    const depth = parseFloat(document.getElementById("threadDepth").value);
    const holeType = document.getElementById("holeType").value;
    const tapType = document.getElementById("tapType").value;

    console.log(`⚙️ Thread Calculation started for ${ttype} ${tsize} ${tclass}`);

    const typeData = threadsData?.[ttype];
    if (!typeData) throw `Thread type '${ttype}' not found.`;

    const sizeData = typeData?.[tsize];
    if (!sizeData) throw `Thread size '${tsize}' not found for ${ttype}.`;

    const classData = sizeData?.[tclass];
    if (!classData) throw `Thread class '${tclass}' not found for ${tsize}.`;

    const pitch = sizeData.pitch ?? 0;

    // --- Geometry extraction ---
    const majorMin = classData.major_dia_min ?? null;
    const majorMax = classData.major_dia_max ?? null;
    const pitchMin = classData.pitch_dia_min ?? null;
    const pitchMax = classData.pitch_dia_max ?? null;
    const tolerance = classData.allowance ?? null;

    let minorMin = null;
    let minorMax = null;
    if (classData.type === "internal") {
      minorMin = classData.minor_dia_min ?? null;
      minorMax = classData.minor_dia_max ?? null;
    } else {
      minorMax = classData.unr_minor_dia_max ?? null;
    }

    // --- Suggested Drill (dynamic)
    const suggestedDrill =
      tapType === "Cut Tap" && majorMin
        ? majorMin - 0.65 * pitch
        : minorMax ?? null;

    // --- Feed & RPM ---
    const sfmThread = materialsData[mat].SFM_thread;
    let rpm = majorMin ? Math.floor((sfmThread * 3.82) / majorMin) : 0;
    rpm = Math.min(rpm, 800);
    const ipr = pitch;
    const ipm = rpm * ipr;

    // --- Pecking suggestion ---
    const peckText =
      holeType === "Blind"
        ? `Suggested Peck: ${Math.min(depth, (majorMin || 0) * 1.5).toFixed(3)} in`
        : "No pecking";

    // --- Output feed & speed ---
    document.getElementById("rpmThread").innerText = `RPM: ${rpm}`;
    document.getElementById("feedThread").innerText =
      `Feed Rate (IPM): ${ipm.toFixed(3)} | Pitch: ${pitch.toFixed(5)} in/rev`;
    document.getElementById("threadPeck").innerText = peckText;

    // --- Output geometry (compact format) ---
    const safe = (v) =>
      v === null || v === undefined
        ? "n/a"
        : typeof v === "number"
        ? v.toFixed(4)
        : v;

    const makeRange = (min, max) =>
      `${safe(min)} - ${max ? safe(max) : "n/a"}`;

    let geometryHTML = `
      <strong>${ttype} ${tsize} ${tclass}</strong><br>
      <strong>Thread Geometry</strong><br>
      Major Diameter: ${makeRange(majorMin, majorMax)}<br>
    `;

    if (classData.type === "internal") {
      geometryHTML += `Minor Diameter: ${makeRange(minorMin, minorMax)}<br>`;
    } else {
      geometryHTML += `Minor Diameter (UNR Max): ${makeRange(null, minorMax)}<br>`;
    }

    geometryHTML += `
      Pitch Diameter: ${makeRange(pitchMin, pitchMax)}<br>
      Tolerance: ${safe(tolerance)}<br>
    `;

    document.getElementById("threadGeometry").innerHTML = geometryHTML;

    document.getElementById("threadGeometry").style.color =
      geometryHTML.includes("n/a") ? "orange" : "black";

    // --- Console output for debug ---
    console.log(
      `🧩 Thread Data → Type: ${ttype}, Size: ${tsize}, Class: ${tclass}, Material: ${mat}`
    );
    console.log(
      `   Geometry → Major: ${makeRange(majorMin, majorMax)}, Minor: ${makeRange(
        minorMin,
        minorMax
      )}, Pitch: ${makeRange(pitchMin, pitchMax)}, Tol: ${safe(tolerance)}`
    );
    console.log(
      `   Feeds → RPM: ${rpm}, Feed: ${ipm.toFixed(3)} ipm, Drill (est.): ${safe(
        suggestedDrill
      )}, Peck: ${peckText}`
    );

  } catch (err) {
    console.error("❌ Thread Calculation Error:", err);
    alert("Input Error: " + err);
  }
}