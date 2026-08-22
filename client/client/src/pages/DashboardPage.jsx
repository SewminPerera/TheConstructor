import { useState, useRef, useCallback } from "react";
import DashNav         from "../dashboard/DashNav";
import UploadView      from "../dashboard/UploadView";
import LoadingView     from "../dashboard/LoadingView";
import ResultsView     from "../dashboard/ResultsView";
import ScaleHelper     from "../components/ScaleHelper";
import ScaleCalibrator from "../components/ScaleCalibrator";
import { useToast }    from "../components/Toast";
import { analyzeBlueprint, calculateCost } from "../services/blueprintApi";
import "./DashboardPage.css";

const DEFAULT_SPECS = {
  cementBrand:    "generic",
  wallThickness:  "9",
  planWidth:      "",
  metalBrand:     "generic",
  steelBrand:     "generic",
  soilType:       "normal",
  wastagePct:     "10",
  plinthHeight:   "0.45",
  labourDays:     "0",
  labourWorkers:  "1",
  // Superstructure
  wallHeight:     "3.0",
  numberOfFloors: "1",
  floorArea:      "0",
  roofType:       "none",
  brickType:      "cement_block",
  plasterType:    "both",
  paintType:      "emulsion",
  floorFinish:    "cement",
};

export default function DashboardPage({ onGoHome, onGoAdmin, onGoProjects }) {
  const [file,               setFile]               = useState(null);
  const [aiResult,           setAiResult]           = useState(null);
  const [quotation,          setQuotation]          = useState(null);
  const [previewUrl,         setPreviewUrl]         = useState(null);
  const [loading,            setLoading]            = useState(false);
  const [recalculating,      setRecalculating]      = useState(false);
  const [error,              setError]              = useState("");
  const [specs,              setSpecs]              = useState(DEFAULT_SPECS);
  const [showScale,          setShowScale]          = useState(false);
  const [showCalibrator,     setShowCalibrator]     = useState(false);
  const [wallLengthOverride, setWallLengthOverride] = useState(null);
  const [pixelRatio,         setPixelRatio]         = useState(null);

  const abortRef    = useRef(null);
  const debounceRef = useRef(null);
  const { showToast } = useToast();

  // ── Full analysis (file upload + AI + initial calc) ─────────────────────
  const runAnalysis = async (targetFile, overrideSpecs = {}) => {
    const merged = { ...specs, ...overrideSpecs };
    setLoading(true);
    setError("");
    try {
      const result = await analyzeBlueprint(targetFile, merged);

      // Handle backend errors/warnings
      if (result.ai_summary?.error) {
        setError(result.ai_summary.message || "Analysis failed");
        setLoading(false);
        return;
      }
      if (result.ai_summary?.warning) {
        showToast(result.ai_summary.warning, "warning", 6000);
      }

      setAiResult(result.ai_summary);
      setQuotation(result.quotation);
      setPreviewUrl(result.preview_url || null);

      // Auto-populate floor area from room detection
      if (result.ai_summary?.rooms?.total_floor_area_m2 > 0 && merged.floorArea === "0") {
        const detected = result.ai_summary.rooms.total_floor_area_m2;
        setSpecs(prev => ({ ...prev, floorArea: String(detected) }));
        showToast(`Floor area auto-detected: ${detected} m²`, "info");
      }
    } catch (err) {
      if (err.name !== "AbortError" && err.name !== "CanceledError") {
        setError(err.message);
        showToast(err.message, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Fast recalculation (cost only, no file upload) ──────────────────────
  const runRecalculation = useCallback(async (ai, updatedSpecs, lengthOverride = null) => {
    if (!ai) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRecalculating(true);
    try {
      const result = await calculateCost({
        wall_length_m:    lengthOverride !== null ? lengthOverride : (ai.length_m || 0),
        door_count:       ai.doors     || 0,
        window_count:     ai.windows   || 0,
        wall_thickness:   parseFloat(updatedSpecs.wallThickness) || 9,
        cement_brand:     updatedSpecs.cementBrand  || "generic",
        metal_brand:      updatedSpecs.metalBrand   || "generic",
        steel_brand:      updatedSpecs.steelBrand   || "generic",
        soil_type:        updatedSpecs.soilType     || "normal",
        wastage_pct:      parseFloat(updatedSpecs.wastagePct)    || 10,
        plinth_height:    parseFloat(updatedSpecs.plinthHeight)  || 0.45,
        labour_days:      parseInt(updatedSpecs.labourDays)      || 0,
        labour_workers:   parseInt(updatedSpecs.labourWorkers)   || 1,
        // Superstructure
        wall_height:      parseFloat(updatedSpecs.wallHeight)     || 3.0,
        number_of_floors: parseInt(updatedSpecs.numberOfFloors)   || 1,
        floor_area:       parseFloat(updatedSpecs.floorArea)      || 0,
        roof_type:        updatedSpecs.roofType     || "none",
        brick_type:       updatedSpecs.brickType    || "cement_block",
        plaster_type:     updatedSpecs.plasterType  || "both",
        paint_type:       updatedSpecs.paintType    || "emulsion",
        floor_finish:     updatedSpecs.floorFinish  || "cement",
      }, controller.signal);

      if (!controller.signal.aborted) {
        setQuotation(result.quotation);
      }
    } catch (err) {
      if (err.name !== "AbortError" && err.name !== "CanceledError") {
        showToast(err.message, "error");
      }
    } finally {
      if (!controller.signal.aborted) {
        setRecalculating(false);
      }
    }
  }, [showToast]);

  const handleFileSelect = (f) => {
    setFile(f); setAiResult(null); setQuotation(null); setPreviewUrl(null);
    setError(""); setWallLengthOverride(null); setPixelRatio(null);
    runAnalysis(f);
  };

  const handleWallLengthChange = (newLen) => {
    setWallLengthOverride(newLen);
    if (aiResult) runRecalculation(aiResult, specs, newLen);
  };

  const handleRecalculate = (patch) => {
    const updated = { ...specs, ...patch };
    setSpecs(updated);

    if (!aiResult) return;

    // planWidth changes affect AI scaling — need full re-analysis
    if ("planWidth" in patch) {
      if (file) runAnalysis(file, updated);
      return;
    }

    // All other spec changes use fast /calculate endpoint (debounced)
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runRecalculation(aiResult, updated, wallLengthOverride);
    }, 200);
  };

  const handleCalibration = (ratio) => {
    setPixelRatio(ratio);
    setShowCalibrator(false);
    if (file) {
      showToast("Re-analyzing with calibrated scale...", "info");
      runAnalysis(file, { ...specs, pixelRatio: ratio });
    }
  };

  const handleReset = () => {
    if (abortRef.current) abortRef.current.abort();
    clearTimeout(debounceRef.current);
    setFile(null); setAiResult(null); setQuotation(null); setPreviewUrl(null);
    setLoading(false); setRecalculating(false); setError("");
    setSpecs(DEFAULT_SPECS); setWallLengthOverride(null); setPixelRatio(null);
  };

  const data = (aiResult && quotation) ? {
    ai_summary: aiResult,
    quotation:  quotation,
  } : null;

  // Parse specific error types for better UX
  const getErrorSuggestion = (err) => {
    if (err.includes("photo") || err.includes("photograph"))
      return "Try uploading a scanned floor plan or DXF file instead.";
    if (err.includes("resolution") || err.includes("small"))
      return "Try scanning at 300 DPI or higher for better accuracy.";
    if (err.includes("contrast") || err.includes("blank"))
      return "Check the scan quality — adjust brightness and contrast.";
    return null;
  };

  const renderBody = () => {
    if (error) {
      const suggestion = getErrorSuggestion(error);
      return (
        <div className="dp-error">
          <div className="dp-error-icon">⚠️</div>
          <h3>Analysis Failed</h3>
          <p>{error}</p>
          {suggestion && <p className="dp-error-hint">{suggestion}</p>}
          <button className="btn-primary" onClick={handleReset}>Try Again</button>
        </div>
      );
    }
    if (loading && !data) return <LoadingView />;
    if (data) return (
      <ResultsView
        data={data}
        previewUrl={previewUrl}
        recalculating={recalculating}
        wallLengthOverride={wallLengthOverride}
        onWallLengthChange={handleWallLengthChange}
        {...specs}
        onRecalculate={handleRecalculate}
        onReset={handleReset}
        onShowScaleHelper={() => setShowScale(true)}
        onShowCalibrator={() => setShowCalibrator(true)}
      />
    );
    return <UploadView loading={loading} onFileSelect={handleFileSelect} />;
  };

  return (
    <div className="dash-shell">
      {showScale && (
        <ScaleHelper
          onClose={() => setShowScale(false)}
          onApply={(m) => { handleRecalculate({ planWidth: m }); setShowScale(false); }}
        />
      )}
      {showCalibrator && previewUrl && (
        <ScaleCalibrator
          previewUrl={previewUrl}
          onApply={handleCalibration}
          onClose={() => setShowCalibrator(false)}
        />
      )}
      <DashNav
        hasResults={!!data}
        onNewProject={handleReset}
        onGoHome={onGoHome}
        onGoProjects={onGoProjects}
        onGoAdmin={onGoAdmin}
      />
      <main className="dash-body">{renderBody()}</main>
    </div>
  );
}
