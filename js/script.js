// --- Initialization logic ---
window.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Feed & Speed Calculator initialized");

  const app = document.getElementById("app");
  if (app) app.innerHTML = `<p>Materials loaded: ${Object.keys(materialsData).length}</p>`;

  const checked = document.querySelector('input[name="toolType"]:checked');
  currentToolType = checked ? checked.value : "Flat";

  console.log(`🧭 Initial tool type: ${currentToolType}`);
  updateCornerRadiusState("init");
});

// ----- Update Corner Radius -----
function updateCornerRadiusState(reason = "manual") {
  const cr = document.getElementById("cornerRadius");
  const diaEl = document.getElementById("dia");
  if (!cr || !diaEl) return;

  const dia = parseSmartInput(diaEl.value) || 0;
  const selected = document.querySelector('input[name="toolType"]:checked');
  const toolType = selected ? selected.value.toLowerCase() : currentToolType.toLowerCase();
  currentToolType = selected ? selected.value : currentToolType;

  cr.disabled = false;
  cr.value = 0;

  console.log(`⚙️ [${reason}] Tool=${toolType}, Dia=${dia}`);

  if (toolType.includes("flat")) {
    cr.value = 0;
    cr.disabled = true;
    console.log("→ Flat: CR = 0 (disabled)");
    return;
  }

  if (toolType.includes("bull")) {
    cr.value = dia <= 0.125 ? 0.010 : 0.0625;
    console.log(`→ Bull: CR = ${cr.value}`);
    return;
  }

  if (toolType.includes("ball")) {
    cr.value = +(dia / 2).toFixed(4);
    console.log(`→ Ball: CR = ${cr.value}`);
    return;
  }

  if (toolType.includes("shell")) {
    console.log("→ Shell mill selected: CR unchanged");
    return;
}

  cr.value = 0;
  console.warn(`⚠️ Unknown tool type — CR forced to ${cr.value}`);
}

// ----- Smart Calcution Interpreter -----
function parseSmartInput(input, isPercent = false) {
  if (!input) return 0;

  // Remove commas, $, spaces, and any letters
  input = input.toString().replace(/[^0-9.+\-*/()]/g, "").trim();
  if (input === "" || /[+\-*/(]$/.test(input)) return 0; // trailing operator check

  let result = 0;
  try {
    result = Function(`"use strict"; return (${input})`)();
  } catch {
    console.warn(`⚠ Invalid expression: "${input}"`);
    result = parseFloat(input) || 0;
  }

  // NaN fallback
  if (!isFinite(result)) result = 0;

  // Convert to percent if flagged
  if (isPercent && result < 1) result *= 100;

  // Prevent negative diameters or zero stepovers, etc.
  if (result < 0) result = 0;

  // Round for cleaner display
  result = isPercent ? Math.round(result) : Number(result.toFixed(4));
  return result;
}

// ----- Unified dynamic feed calculator (IPT + IPR) -----
function getDynamicFeed(toolType, material, dia) {
  const t = toolType.toLowerCase();
  const useIpr = ["drill", "reamer", "spot", "center drill"].some(k => t.includes(k));

  const source = useIpr ? window.iprData : window.iptData;
  const key = useIpr
    ? (source?.[t] ? t : "drill") // fallback for hole-making tools
    : "endmill";

  const dataSet = source?.[key]?.[material];

  if (dataSet && Array.isArray(dataSet)) {
    const match = dataSet.find(entry => dia <= entry.max);
    if (match) {
      console.log(
        `✅ Feed from ${useIpr ? "ipr" : "ipt"}.json → Tool: ${toolType}, Material: ${material}, Dia: ${dia}, Val: ${match.val}`
      );
      return match.val;
    }

    const fallbackVal = dataSet[dataSet.length - 1].val;
    console.warn(
      `⚠ Diameter ${dia}" exceeds all listed ranges for ${material} (${toolType}). Using max feed value ${fallbackVal}.`
    );
    return fallbackVal;
  }

  console.warn(
    `⚠ No feed data found for ${toolType} in ${material}. Using safe fallback 0.002.`
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
    const dia = parseSmartInput(document.getElementById("dia").value);
    const flutes = parseInt(document.getElementById("flutes").value);
    const engagedTeeth = parseSmartInput(document.getElementById("engagedTeeth").value);
    const stickout = parseSmartInput(document.getElementById("stickout").value);
    const stepover = parseSmartInput(document.getElementById("stepover").value, true) / 100;
    const depth = parseSmartInput(document.getElementById("depth").value);

    const toolType = document.querySelector('input[name="toolType"]:checked').value;
    const mat = document.getElementById("material").value;

    const cornerRadius =
      toolType === "Bull Nose" || toolType === "Ball Nose"
        ? parseSmartInput(document.getElementById("cornerRadius").value)
        : 0;

    // IPT lookup key
    const toolTypeKey =
      toolType === "Shell Mill" ? "shell_mill" : "endmill";

    let ipt = getDynamicFeed(toolTypeKey, mat, dia);

    let sfm = materialsData[mat].SFM_endmill;
    let warningText = "";

    // ==========================================================
    // SHELL MILL LOGIC
    // ==========================================================
    if (toolType === "Shell Mill") {

      // Use SFM_shellmill from material.json
      sfm = materialsData[mat].SFM_shellmill || sfm;

      const effTeeth = flutes * (engagedTeeth / 100);

      const rpm = Math.round((sfm * 3.82) / dia);
      const ipm = rpm * effTeeth * ipt;

      // Debug summary
      console.groupCollapsed(`CALCULATION SUMMARY → SHELL MILL (${mat})`);
      console.table({
        "Tool Type": toolType,
        "Diameter (in)": dia,
        "Inserts": flutes,
        "Engaged Teeth (%)": engagedTeeth,
        "Effective Teeth": effTeeth.toFixed(2),
        "Stickout (in)": stickout,
        "Depth (in)": depth,
        "Stepover (%)": stepover * 100,
        "SFM Used": sfm.toFixed(2),
        "IPT Used": ipt.toFixed(5),
        "RPM Final": rpm,
        "Feed Rate (IPM)": ipm.toFixed(2),
        "HSM Mode": isHsm ? "ON" : "OFF"
      });
      console.groupEnd();

      // Output
      document.getElementById("rpm").innerText = `RPM: ${rpm}`;
      document.getElementById("feedRate").innerText = `Feed Rate (IPM): ${ipm.toFixed(1)}`;
      document.getElementById("sfmOut").innerText = `SFM: ${sfm.toFixed(1)}`;
      document.getElementById("iptOut").innerText = `Feed per Tooth (IPT): ${ipt.toFixed(5)}`;
      document.getElementById("warnings").innerText = "";

      return;
    }

    // ==========================================================
    // SOLID ENDMILL LOGIC
    // ==========================================================

    // Corner radius warning
    if (toolType === "Bull Nose" && cornerRadius > dia / 2) {
      warningText += `⚠ Corner radius (${cornerRadius}) > half tool dia (${(dia / 2).toFixed(3)})\n`;
    }

    // Stickout reduction
    const ratio = stickout / dia;
    let reduction = 1.0;
    if (ratio > 3.0) { reduction = 0.7; warningText += `⚠ Stickout too high (S/D=${ratio.toFixed(1)})\n`; }
    else if (ratio > 2.0) { reduction = 0.85; warningText += `⚠ Stickout high (S/D=${ratio.toFixed(1)})\n`; }

    if (stepover > 0.5) warningText += "⚠ Stepover >50% recommended\n";
    if (depth > dia) warningText += "⚠ Depth > diameter\n";

    // Tool type modifiers
    if (toolType === "Bull Nose") ipt *= 0.95;
    if (toolType === "Ball Nose") ipt *= 0.9;

    // HSM adjustments
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
      warningText += "HSM active\n";
    }

    const rpmLimit = isHsm ? 9500 : 9000;
    const rpm = Math.min(Math.round((sfm * 3.82) / dia), rpmLimit);
    const ipm = rpm * flutes * ipt * reduction;

    // Debug summary
    console.groupCollapsed(`CALCULATION SUMMARY → ${toolType} (${mat})`);
    console.table({
      "Tool Type": toolType,
      "Material": mat,
      "Diameter (in)": dia,
      "Flutes": flutes,
      "Stickout (in)": stickout,
      "Depth (in)": depth,
      "Stepover (%)": stepover * 100,
      "Corner Radius (in)": cornerRadius,
      "SFM Used": sfm.toFixed(2),
      "IPT Used": ipt.toFixed(5),
      "Reduction Factor": reduction.toFixed(2),
      "RPM Final": rpm,
      "Feed Rate (IPM)": ipm.toFixed(2),
      "HSM Mode": isHsm ? "ON" : "OFF"
    });
    console.groupEnd();

    // Output
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
    // ✅ Smart math input support
    const dia = parseSmartInput(document.getElementById("diaDrill").value);
    const flutes = parseInt(document.getElementById("flutesDrill").value);
    const mat = document.getElementById("drillMaterial").value;
    const drillTypeRaw = document.getElementById("drillType").value;
    const drillType = drillTypeRaw.toLowerCase();
    const stickout = parseSmartInput(document.getElementById("stickoutDrill").value);
    const depth = parseSmartInput(document.getElementById("depthDrill").value);
    const pecking = document.getElementById("pecking").checked;

    // --- Base feed & speed data ---
    let sfm = materialsData[mat]?.SFM_drill || 250;
    let ipr = getDynamicFeed("drill", mat, dia);

    // --- Adjust for special drill types ---
    if (["spotter", "center drill"].includes(drillType)) {
      sfm = materialsData[mat]?.SFM_spot || sfm;
      ipr *= 0.5; // reduced feed for spotters
    } else if (drillType === "reamer") {
      sfm = materialsData[mat]?.SFM_reamer || sfm * 0.6;
      ipr *= 0.4; // much lighter feed for reaming
    } else if (drillType === "countersink") {
      sfm = materialsData[mat]?.SFM_countersink || materialsData[mat]?.SFM_spot || sfm;
      ipr = getDynamicFeed("countersink", mat, dia);
      // Countersinks shouldn't peck unless extremely deep
      if (pecking) {
        peckText = "No peck (countersink)";
      }
    }

    // --- Deep hole / stickout reduction ---
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
    let peckText = "";
    let peckAmount = 0;
    const depthToDia = depth / dia;

    if (!pecking) {
      peckText = "No pecking";
    } else {
      if (dia < 0.125) {
        // Tiny drill rule
        peckAmount = Math.min(0.10, dia * 0.75);
      } else if (depthToDia <= 3) {
        peckAmount = 0;
      } else if (depthToDia > 3 && depthToDia <= 6) {
        peckAmount = dia * 1.5;
      } else if (depthToDia > 6 && depthToDia <= 10) {
        peckAmount = dia * 1.0;
      } else {
        peckAmount = dia * 0.75;
      }

      // Never exceed total depth with one peck
      peckAmount = Math.min(peckAmount, depth);

      if (peckAmount <= 0) peckText = "No pecking";
      else peckText = `Suggested Peck: ${peckAmount.toFixed(3)} in`;
    }
    // --- Debug summary ---
    console.groupCollapsed(`CALCULATION SUMMARY → ${drillType.toUpperCase()} (${mat})`);
    console.table({
      "Tool Type": drillTypeRaw,
      "Material": mat,
      "Diameter (in)": dia,
      "Stickout (in)": stickout,
      "Depth (in)": depth,
      "SFM Used": sfm.toFixed(2),
      "IPR Used": ipr.toFixed(5),
      "Reduction Factor": reduction.toFixed(2),
      "RPM Final": rpm,
      "Feed Rate (IPM)": ipm.toFixed(2)
    });
    if (warningText && warningText.trim()) console.warn("WARNINGS:\n" + warningText.trim());
    console.groupEnd();

    // --- Output ---
    document.getElementById("rpmDrill").innerText = `RPM: ${rpm}`;
    document.getElementById("feedDrill").innerText = `Feed Rate (IPM): ${ipm.toFixed(2)}`;
    document.getElementById("peckOut").innerText = peckText;

    // --- Warning color ---
    const warn = document.getElementById("drillWarn");
    warn.innerText = warningText;
    warn.style.color = warningText ? "orange" : "green";

    // --- Debug summary ---
    console.log(
      `Drill Calc → Type: ${drillType}, Mat: ${mat}, Dia: ${dia}, Stickout: ${stickout}, Depth: ${depth}, SFM: ${sfm}, IPR: ${ipr}, RPM: ${rpm}, IPM: ${ipm.toFixed(
        2
      )}`
    );
  } catch (err) {
    alert("Input Error: " + err);
  }
}

// ----- Thread Dropdown Updates -----
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

  updateThreadClasses();
}

// ----- Updates Thread Classes -----
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
}

// ----- Tapping Calculation -----
function calculateTapping() {
  try {
    const ttype = document.getElementById("threadType").value;
    const tsize = document.getElementById("threadSize").value;
    const tclass = document.getElementById("threadClass").value;
    const mat = document.getElementById("threadMaterial").value;
    const depth = parseSmartInput(document.getElementById("threadDepth").value);
    const holeType = document.getElementById("holeType").value;
    const tapType = document.getElementById("tapType").value;

    // --- Thread data lookups ---
    const typeData = threadsData?.[ttype];
    if (!typeData) throw `Thread type '${ttype}' not found.`;

    const sizeData = typeData?.[tsize];
    if (!sizeData) throw `Thread size '${tsize}' not found for ${ttype}.`;

    const classData = sizeData?.[tclass];
    if (!classData) throw `Thread class '${tclass}' not found for ${tsize}.`;

    const pitch = parseFloat(sizeData.pitch ?? 0);

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

    // --- Suggested Drill (dynamic) ---
    const suggestedDrill =
      tapType === "Cut Tap" && majorMin
        ? majorMin - 0.65 * pitch
        : minorMax ?? null;

    // --- Feed & RPM ---
    const sfmThread = materialsData[mat]?.SFM_thread || 200;
    let rpm = majorMin ? Math.floor((sfmThread * 3.82) / majorMin) : 0;
    rpm = Math.min(rpm, 800);
    const ipr = pitch;
    const ipm = rpm * ipr;

    // --- Peck suggestion ---
    const peckText =
      holeType === "Blind"
        ? `Suggested Peck: ${Math.min(depth, (majorMin || 0) * 1.5).toFixed(3)} in`
        : "No pecking";

    // --- Console Summary ---
    console.groupCollapsed(`CALCULATION SUMMARY → ${tapType} (${ttype} ${tsize} ${tclass})`);
    console.table({
      "Thread Type": ttype,
      "Thread Size": tsize,
      "Thread Class": tclass,
      "Material": mat,
      "Tap Type": tapType,
      "Hole Type": holeType,
      "Thread Pitch (in)": pitch.toFixed(5),
      "Depth (in)": depth,
      "Suggested Drill (in)": suggestedDrill ? suggestedDrill.toFixed(4) : "n/a",
      "SFM Used": sfmThread.toFixed(1),
      "IPR Used": ipr.toFixed(5),
      "RPM Final": rpm,
      "Feed Rate (IPM)": ipm.toFixed(3),
      "Pecking": peckText
    });
    console.groupEnd();

    // --- Output Feed & Speed ---
    document.getElementById("rpmThread").innerText = `RPM: ${rpm}`;
    document.getElementById("feedThread").innerText = `Feed Rate (IPM): ${ipm.toFixed(3)} | Pitch: ${pitch.toFixed(5)} in/rev`;
    document.getElementById("threadPeck").innerText = peckText;

    // --- Output Geometry ---
    const safe = (v) =>
      v === null || v === undefined
        ? "n/a"
        : typeof v === "number"
        ? v.toFixed(4)
        : v;

    const makeRange = (min, max) => `${safe(min)} - ${max ? safe(max) : "n/a"}`;

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

    const geomBox = document.getElementById("threadGeometry");
    geomBox.innerHTML = geometryHTML;
    geomBox.style.color = geometryHTML.includes("n/a") ? "orange" : "var(--text)";

  } catch (err) {
    alert("Input Error: " + err);
  }
}

// ----- SMART INPUT HANDLING + CORNER RADIUS SYNC
document.querySelectorAll("input, select").forEach(input => {
  input.addEventListener("blur", () => {
    if (input.tagName !== "INPUT" || input.type === "radio" || input.type === "checkbox") return;

    const isPercent = input.dataset.percent === "true";
    const val = input.value.trim();
    if (!val) return;

    const result = parseSmartInput(val, isPercent);
    if (!isNaN(result)) {
      input.value = isPercent ? Math.round(result) : Number(result.toFixed(4));
    }

    if (input.id === "dia") updateCornerRadiusState("diameter blur");
  });

  if (input.id === "dia") {
    input.addEventListener("input", () => updateCornerRadiusState("diameter typing"));
  }
});

// ----- TOOL TYPE RADIO BUTTONS (CR + Shell Mill UI)
let lastEndmillDia = parseSmartInput(document.getElementById("dia").value) || 0.5;

document.querySelectorAll('input[name="toolType"]').forEach(radio => {
  radio.addEventListener("click", () => {
    requestAnimationFrame(() => {
      const selected = document.querySelector('input[name="toolType"]:checked');
      if (selected) currentToolType = selected.value;

      const isShell = selected?.value === "Shell Mill";
      const flutesLabel = document.getElementById("flutesLabel");
      const engagedLabel = document.getElementById("engagedTeethLabel");
      const engagedInput = document.getElementById("engagedTeeth");
      const diaInput = document.getElementById("dia");

      if (isShell) {
          // save endmill dia
          lastEndmillDia = parseSmartInput(diaInput.value) || lastEndmillDia;

          // apply shell-mill defaults
          diaInput.value = "3.000";
          document.getElementById("flutes").value = "6";
          document.getElementById("stepover").value = "50";  // %
          document.getElementById("depth").value = "0.075";

          engagedLabel.style.display = "block";
          engagedInput.style.display = "block";
          flutesLabel.innerText = "Inserts";
      } else {
        // restore last endmill diameter
        diaInput.value = lastEndmillDia.toFixed(3);

        // hide engaged teeth
        engagedLabel.style.display = "none";
        engagedInput.style.display = "none";

        flutesLabel.innerText = "Flutes";
      }

      updateCornerRadiusState("tool click");
    });
  });
});

// ----- INITIAL CORNER RADIUS SYNC ON PAGE LOAD
document.addEventListener("DOMContentLoaded", () => {
  console.log("⚙️ Initialization: syncing corner radius + Shell Mill UI defaults");

  // Trigger initial UI matching default toolType
  const selected = document.querySelector('input[name="toolType"]:checked');
  if (selected) {
    selected.click();     // ensures UI reacts properly
  }

  updateCornerRadiusState("init");
});